# webview

Go binary that displays https://axeni.de/xp fullscreen via an embedded webview.

## Layout

```
webview/
├── main.go                # Entry point (cross-platform)
├── fullscreen_linux.go    # gtk_window_fullscreen via CGO
├── fullscreen_darwin.go   # NSWindow toggleFullScreen via CGO
├── fullscreen_windows.go  # Win32 borderless + monitor via CGO
├── webview_go_4.1/        # Patched fork of webview/webview_go
│                           (uses webkit2gtk-4.1 on Linux)
├── Makefile               # linux | amd64 | arm64 | release | run | clean
└── go.mod                 # replace directive -> local fork
```

## Why a fork?

`github.com/webview/webview_go` vendors the upstream C++ library pinned to
`webkit2gtk-4.0`. Modern distros (Arch, current Ubuntu/Fedora) only ship
`webkit2gtk-4.1`. The fork inside `webview_go_4.1/` only changes the
`pkg-config` directive in `webview.go` (`4.0` -> `4.1`). The bundled
`webview.h` header is identical.

## Build

### Linux (native)

Dependencies:

- `webkit2gtk-4.1`
- `gtk3`
- `gcc` / `pkg-config`

Arch: `sudo pacman -S webkit2gtk-4.1 gtk3 gcc pkgconf`
Debian/Ubuntu: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev gcc pkg-config`
Fedora: `sudo dnf install webkit2gtk4.1-devel gtk3-devel gcc pkgconf-pkg-config`

```
make linux
```

Output: `dist/webview-linux`

### Cross-compile (release artifacts)

For `linux-amd64`:

```
make amd64
```

For `linux-arm64` (requires `gcc-aarch64-linux-gnu`):

```
make arm64
```

Both at once:

```
make release
```

Output: `dist/webview-linux-amd64`, `dist/webview-linux-arm64`

## Run

```
make run
```

The window opens, navigates to `https://axeni.de/xp`, and goes fullscreen
on the main/UI thread via a platform-specific call.

- Linux: `gtk_window_fullscreen()` (true WM fullscreen)
- macOS: `NSWindowCollectionBehaviorFullScreenPrimary` + `toggleFullScreen:`
- Windows: removes caption/thickframe/border/sysmenu, resizes to monitor via
  `MonitorFromWindow` + `SetWindowPos`

`WEBKIT_DISABLE_DMABUF_RENDERER=1` is set by the binary itself (WebKit
DMA-BUF bug workaround, see WebKit #261874). Override with
`WEBKIT_DISABLE_DMABUF_RENDERER=0 ./webview`.