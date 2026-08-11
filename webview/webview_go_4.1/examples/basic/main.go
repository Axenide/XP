package main

import webview "github.com/Axenide/web/static/xp/webview/webview_go_4.1"

func main() {
	w := webview.New(false)
	defer w.Destroy()
	w.SetTitle("Basic Example")
	w.SetSize(480, 320, webview.HintNone)
	w.SetHtml("Thanks for using webview!")
	w.Run()
}
