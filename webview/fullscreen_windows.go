//go:build windows

package main

/*
#include <windows.h>

static void makeFullscreen(void *window) {
	HWND hwnd = (HWND)window;
	LONG_PTR style = GetWindowLongPtrW(hwnd, GWL_STYLE);
	style &= ~(WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_SYSMENU | WS_MAXIMIZEBOX | WS_MINIMIZEBOX);
	style |= WS_POPUP | WS_VISIBLE;
	SetWindowLongPtrW(hwnd, GWL_STYLE, style);

	HMONITOR monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
	MONITORINFO mi;
	ZeroMemory(&mi, sizeof(mi));
	mi.cbSize = sizeof(mi);
	GetMonitorInfoW(monitor, &mi);
	SetWindowPos(hwnd, HWND_TOP,
		mi.rcMonitor.left, mi.rcMonitor.top,
		mi.rcMonitor.right - mi.rcMonitor.left,
		mi.rcMonitor.bottom - mi.rcMonitor.top,
		SWP_FRAMECHANGED | SWP_NOZORDER | SWP_NOACTIVATE);
}
*/
import "C"
import "unsafe"

func setFullscreen(window unsafe.Pointer) {
	C.makeFullscreen(window)
}