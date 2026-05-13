#!/bin/bash
set -e

echo "=== darkmic System Dependencies ==="

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "[macOS]"

  # mkcert for trusted local HTTPS certs
  if ! command -v mkcert &> /dev/null; then
    echo "  mkcert: not found (optional — server uses self-signed certs)"
    echo "  Install: brew install mkcert && mkcert -install"
  else
    echo "  mkcert: found"
  fi

  # BlackHole for virtual audio device
  if ! system_profiler SPAudioDataType 2>/dev/null | grep -q "BlackHole"; then
    echo "  BlackHole: not found (needed for F-003 audio output)"
    echo "  Install: brew install blackhole-2ch"
  else
    echo "  BlackHole: found"
  fi
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  echo "[Windows]"
  echo "  VB-Cable: install from https://vb-audio.com/Cable/"
else
  echo "[$OSTYPE] — unsupported for virtual audio device"
fi

echo "=== Setup check complete ==="
