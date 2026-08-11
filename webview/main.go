package main

import (
	"os"
	"unsafe"

	webview "github.com/Axenide/web/static/xp/webview/webview_go_4.1"
)

const (
	appURL    = "https://axeni.de/xp"
	appTitle  = "Axenide XP"
	appWidth  = 1280
	appHeight = 800
)

func init() {
	if os.Getenv("WEBKIT_DISABLE_DMABUF_RENDERER") == "" {
		os.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
	}
}

func main() {
	w := webview.New(false)
	if w == nil {
		panic("failed to create webview")
	}
	defer w.Destroy()

	w.SetTitle(appTitle)
	w.SetSize(appWidth, appHeight, webview.HintNone)
	w.Navigate(appURL)

	w.Dispatch(func() {
		setFullscreen(unsafe.Pointer(w.Window()))
	})

	w.Run()
}