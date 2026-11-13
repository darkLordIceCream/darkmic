#!/bin/bash
# E2E test: Android emulator (Brave/Chromium) → darkmic server (file mode).
# Replaces QR-code scanning during automated iteration — the emulator is a
# real Chromium client, so transport/UI layers are verified without a phone.
#
# Usage:
#   ./scripts/e2e-emulator.sh [--keep-server]
#
# Requirements (one-time setup, see progress.md 2026-11-14 session):
#   - Android SDK + emulator + a system image (arm64 on Apple Silicon)
#   - An AVD (default name: darkmic-test; override with DARKMIC_AVD)
#   - Brave installed in the AVD (com.brave.browser) — official arm64 APK from
#     https://github.com/brave/brave-browser/releases (SHA256-verified)
#   - dist/ built (pnpm build)
#
# The emulator mic is silent unless the host grants macOS mic permission to
# qemu — silence still produces real opus packets, which is enough to verify
# transport, UI and decode. Real-mic quality checks still need a phone.
set -e

ADB="$HOME/Library/Android/sdk/platform-tools/adb"
SERIAL="${DARKMIC_AVD_SERIAL:-emulator-5554}"
PORT="${DARKMIC_E2E_PORT:-3100}"
WORK=/tmp/darkmic-e2e
SERVER_LOG="$WORK/server.log"
AUDIO_FILE="$WORK/darkmic-audio.raw"   # file mode writes ./darkmic-audio.raw relative to CWD
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL_HOST="10.0.2.2"
URL="https://$URL_HOST:$PORT/phone"
MIN_CHUNKS="${DARKMIC_E2E_MIN_CHUNKS:-20}"
KEEP_SERVER=0
[ "${1:-}" = "--keep-server" ] && KEEP_SERVER=1

mkdir -p "$WORK"
: > "$SERVER_LOG"
rm -f "$AUDIO_FILE"
: > "$AUDIO_FILE"

# ── helpers ──────────────────────────────────────────────────────────

adb_do() { "$ADB" -s "$SERIAL" "$@"; }

# Print "cx cy" for the first UI node matching text or content-desc exactly.
# uiautomator dump fails intermittently while animations run — retry inside.
ui_center() {
  local attempt node nums
  for attempt in 1 2 3; do
    adb_do shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
    node=$(adb_do shell cat /sdcard/ui.xml 2>/dev/null | tr '<' '\n' \
      | grep -E "(text|content-desc)=\"$1\"" | head -1)
    if [ -n "$node" ]; then
      nums=$(echo "$node" | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' \
        | grep -o '[0-9]*' | paste -d' ' - - - -)
      if [ -n "$nums" ]; then
        set -- $nums
        echo $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

# Tap the first visible node whose text/content-desc matches any pattern.
# Retries for up to $1 seconds (dialogs can be slow to render).
tap_when_visible() {
  local timeout="$1"; shift
  local deadline=$(( $(date +%s) + timeout ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    for pattern in "$@"; do
      local pos
      if pos=$(ui_center "$pattern"); then
        echo "  tap: $pattern @ $pos"
        adb_do shell input tap $pos
        return 0
      fi
    done
    sleep 1
  done
  echo "  WARN: none visible: $*" >&2
  return 1
}

# ── 1. server ────────────────────────────────────────────────────────

if curl -sk -o /dev/null "https://localhost:$PORT"; then
  echo "WARN: port $PORT already in use — assuming an external server" >&2
  EXTERNAL_SERVER=1
else
  EXTERNAL_SERVER=0
  # Launch from $WORK so the file-mode output lands in $WORK/darkmic-audio.raw
  (cd "$WORK" && AUDIO_PIPE_MODE=file PORT=$PORT node "$ROOT/dist/index.js" > "$SERVER_LOG" 2>&1) &
  SERVER_PID=$!
  trap '[ $KEEP_SERVER -eq 1 ] || { kill $SERVER_PID 2>/dev/null || true; }' EXIT
  for _ in $(seq 1 20); do
    curl -sk -o /dev/null "https://localhost:$PORT" && break
    sleep 0.5
  done
  echo "server started (pid $SERVER_PID, port $PORT)"
fi

# ── 2. emulator ──────────────────────────────────────────────────────

STATE=$("$ADB" devices | awk -v s="$SERIAL" '$1 == s && $2 == "device" {print $2}')
if [ -z "$STATE" ]; then
  AVD="${DARKMIC_AVD:-darkmic-test}"
  echo "booting emulator $AVD ..."
  "$HOME/Library/Android/sdk/emulator/emulator" -avd "$AVD" >/dev/null 2>&1 &
  EMU_PID=$!
  "$ADB" -s "$SERIAL" wait-for-device
  until [ "$(adb_do shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
  echo "emulator ready"
fi

# ── 3. open URL in Brave ─────────────────────────────────────────────

adb_do shell am start -n "com.brave.browser/org.chromium.chrome.browser.ChromeTabbedActivity" \
  -a android.intent.action.VIEW -d "$URL" >/dev/null
sleep 3

# First-run onboarding (skipped on a warm device): cancel/continue/skip steps.
tap_when_visible 6 "CANCEL" "Maybe later" "Continue" "Accept & continue" || true

# If the intent was swallowed by onboarding, the omnibox may be focused on a
# blank new tab — type the URL as a fallback.
if ! ui_center "Start Microphone" >/dev/null 2>&1; then
  adb_do shell input text "https://$URL_HOST:$PORT/phone"
  adb_do shell input keyevent 66   # ENTER
  sleep 4
fi

# ── 4. cert interstitial + start + mic permission ────────────────────

# Cert interstitial appears on a first-visit origin. Brave remembers cert
# exceptions per HOST, so re-runs on another port may skip it entirely.
tap_when_visible 12 "Advanced" || true
tap_when_visible 6 "Proceed to $URL_HOST (unsafe)" || true
sleep 1

# Start triggers the web-level mic prompt (Brave asks lazily on getUserMedia).
tap_when_visible 15 "Start Microphone" \
  || { echo "FAIL: Start Microphone button not found"; exit 1; }

# Wait for the permission prompt that the Start click just triggered, then
# remember the decision and allow. Both steps are skippable on a warm origin.
tap_when_visible 12 "forever" || true
tap_when_visible 8 "Allow" || true

# ── 5. verify audio frames arrive ────────────────────────────────────

echo "streaming for 8s ..."
sleep 8
CHUNKS=$(grep -c "Chunk #" "$SERVER_LOG" 2>/dev/null | head -1)
[ -z "$CHUNKS" ] && CHUNKS=0
if [ "$EXTERNAL_SERVER" = "1" ]; then
  # Can't read the external server's log — use the client-side stats instead.
  adb_do shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  CLIENT_STATS=$(adb_do shell cat /sdcard/ui.xml 2>/dev/null \
    | grep -o 'text="[0-9]* chunks[^"]*"' | head -1 | sed 's/text="//;s/"$//')
  echo "client stats: $CLIENT_STATS"
  CHUNKS=$(echo "$CLIENT_STATS" | grep -o '[0-9]*' | head -1)
fi

if [ "${CHUNKS:-0}" -lt "$MIN_CHUNKS" ]; then
  echo "FAIL: only $CHUNKS opus chunks received (need >= $MIN_CHUNKS)"
  exit 1
fi

# ── 6. stop + report ─────────────────────────────────────────────────

tap_when_visible 6 "Stop" || true
sleep 1

echo ""
echo "=================================================="
if [ "$EXTERNAL_SERVER" != "1" ]; then
  echo "PASS: $CHUNKS opus chunks received (>= $MIN_CHUNKS)"
  [ -f "$AUDIO_FILE" ] && echo "audio file: $AUDIO_FILE ($(wc -c < "$AUDIO_FILE" | tr -d ' ') bytes)"
else
  echo "PASS: client reports $CHUNKS chunks sent (external server mode)"
fi
echo "server log: $SERVER_LOG"
echo "=================================================="
