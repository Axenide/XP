//go:build linux

package main

/*
#cgo pkg-config: gtk+-3.0

#include <gtk/gtk.h>

static void makeFullscreen(void *window) {
	gtk_window_fullscreen((GtkWindow *)window);
}
*/
import "C"
import "unsafe"

func setFullscreen(window unsafe.Pointer) {
	C.makeFullscreen(window)
}