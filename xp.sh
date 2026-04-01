#!/bin/sh

URL="http://localhost:8080/"

WEBKIT_DISABLE_COMPOSITING_MODE=1 python3 - <<'EOF'
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

# 🔥 esto arregla tu problema
win.connect("destroy", Gtk.main_quit)

webview = WebKit2.WebView()
webview.load_uri("http://localhost:8080/")

win.add(webview)
win.show_all()

Gtk.main()
EOF
