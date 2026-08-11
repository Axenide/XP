#!/usr/bin/env sh
set -e

REPO="Axenide/XP"
BIN="webview"
DEST="/tmp/xp"

VERSION="${XP_VERSION:-latest}"

uname_os() {
	os=$(uname -s | tr '[:upper:]' '[:lower:]')
	case "$os" in
		linux) echo "linux" ;;
		*) echo "unsupported:$os" >&2; return 1 ;;
	esac
}

uname_arch() {
	arch=$(uname -m)
	case "$arch" in
		x86_64|amd64) echo "amd64" ;;
		aarch64|arm64) echo "arm64" ;;
		*) echo "unsupported:$arch" >&2; return 1 ;;
	esac
}

OS=$(uname_os)
ARCH=$(uname_arch)

if [ "$VERSION" = "latest" ]; then
	URL="https://github.com/${REPO}/releases/latest/download/${BIN}-${OS}-${ARCH}"
else
	URL="https://github.com/${REPO}/releases/download/${VERSION}/${BIN}-${OS}-${ARCH}"
fi

echo "→ Fetching ${BIN} ${OS}/${ARCH} (${VERSION})"
curl -fL --retry 3 --connect-timeout 10 -o "$DEST" "$URL" || {
	echo "Download failed: $URL" >&2
	exit 1
}

chmod +x "$DEST"

exec "$DEST" "$@"