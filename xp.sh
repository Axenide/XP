#!/usr/bin/env sh

URL="https://axeni.de/fix"

detect_distro() {
	if [ -f /etc/os-release ]; then
		. /etc/os-release
		echo "$ID"
	else
		echo "unknown"
	fi
}

install_arch() {
	echo "→ Installing dependencies on Arch Linux..."
	missing=""
	for pkg in gtk3 webkit2gtk python-gobject gst-plugins-base gst-plugins-good gstreamer; do
		if ! pacman -Q "$pkg" >/dev/null 2>&1; then
			missing="$missing $pkg"
		fi
	done

	if [ -z "$missing" ]; then
		echo "✓ Dependencies already installed."
		return 0
	fi

	sudo pacman -S --needed $missing
}

install_fedora() {
	echo "→ Installing dependencies on Fedora..."
	missing=""
	for pkg in gtk3 webkit2gtk3 python3-gobject gstreamer1 gstreamer1-plugins-base gstreamer1-plugins-good; do
		if ! rpm -q "$pkg" >/dev/null 2>&1; then
			missing="$missing $pkg"
		fi
	done

	if [ -z "$missing" ]; then
		echo "✓ Dependencies already installed."
		return 0
	fi

	sudo dnf install -y $missing
}

run_app() {
	WEBKIT_DISABLE_COMPOSITING_MODE=1 python3 - <<EOF
import os
os.environ["WEBKIT_DISABLE_COMPOSITING_MODE"] = "1"

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.0")

from gi.repository import Gtk, WebKit2

win = Gtk.Window()
win.set_decorated(False)
win.fullscreen()
win.set_keep_above(True)
win.connect("destroy", Gtk.main_quit)

webview = WebKit2.WebView()
webview.load_uri("$URL")

win.add(webview)
win.show_all()

Gtk.main()
EOF
}

run_nixos() {
	echo "→ Running in temporary Nix shell..."
	nix-shell -p gtk3 webkitgtk python3 python3Packages.pygobject3 gst_all_1.gstreamer gst_all_1.gst-plugins-base gst_all_1.gst-plugins-good --run "
    export WEBKIT_DISABLE_COMPOSITING_MODE=1
    python3 - <<'EOF'
import os
os.environ['WEBKIT_DISABLE_COMPOSITING_MODE'] = '1'

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.0')

from gi.repository import Gtk, WebKit2

win = Gtk.Window()
win.set_decorated(False)
win.fullscreen()
win.set_keep_above(True)
win.connect('destroy', Gtk.main_quit)

webview = WebKit2.WebView()
webview.load_uri('$URL')

win.add(webview)
win.show_all()

Gtk.main()
EOF
  "
}

DISTRO=$(detect_distro)

case "$DISTRO" in
arch | manjaro | endeavouros)
	install_arch
	run_app
	;;
fedora)
	install_fedora
	run_app
	;;
nixos)
	run_nixos
	;;
*)
	echo "Unsupported distro: $DISTRO"
	echo "Please install manually: gtk3, webkit2gtk, python-gobject"
	run_app
	;;
esac
