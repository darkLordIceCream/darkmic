#!/bin/bash
set -e

echo "=== darkmic System Dependencies ==="
echo "=== 系统依赖检查 ==="

# Detect OS | 检测操作系统
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "mingw"* ]]; then
  echo "[Windows]"
  echo "  Make sure VB-Cable is installed: https://vb-audio.com/Cable/"
  echo "  After install, set VB-Cable as the default recording device in Windows Sound settings."

  # mkcert for trusted local HTTPS certs (optional)
  if ! command -v mkcert &> /dev/null; then
    echo "  mkcert: not found (optional — server uses self-signed certs)"
    echo "  Install: choco install mkcert  (or: winget install mkcert)"
  else
    echo "  mkcert: found"
  fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "[macOS]"
  echo "  Warning: macOS is not a supported target for this project."
  echo "  The server will still run, but audio output requires VB-Cable."
  echo "  VB-Cable is available for macOS too: https://vb-audio.com/Cable/"
else
  echo "[$OSTYPE] — not tested. VB-Cable required for audio output."
fi

echo ""
echo "=== Setup check complete | 检查完成 ==="
