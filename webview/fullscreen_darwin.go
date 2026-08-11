//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

static void makeFullscreen(void *window) {
	NSWindow *w = (NSWindow *)window;
	[w setCollectionBehavior:NSWindowCollectionBehaviorFullScreenPrimary];
	[w toggleFullScreen:nil];
}
*/
import "C"
import "unsafe"

func setFullscreen(window unsafe.Pointer) {
	C.makeFullscreen(window)
}