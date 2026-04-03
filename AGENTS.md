# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-01 17:58:54
**Commit:** 8c7a7cf
**Branch:** main

## OVERVIEW
Windows XP web simulator - vanilla JS/CSS/HTML desktop recreation with working apps (Internet Explorer, Minesweeper, Notepad, Paint, Winamp, My Computer).

## STRUCTURE
```
./
├── index.html       # Entry point - desktop container
├── js/
│   ├── window-manager.js   # Window creation, drag, resize, z-index
│   └── apps.js             # App factories (ie, minesweeper, notepad, etc)
├── css/
│   └── main.css            # 2051 lines - all styling
└── assets/
    ├── windowsIcons/       # Desktop icons
    ├── minesweeper/        # Game assets
    ├── sounds/             # Audio files
    ├── font.css
    └── clear.css
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add new app | js/apps.js | Register in apps object, create createXxx() method |
| Window behavior | js/window-manager.js | Drag, resize, minimize, maximize |
| Styling | css/main.css | Large file - use offset to navigate |
| Desktop icons | index.html | data-app attributes in start menu |

## CONVENTIONS
- No build system - vanilla JS/CSS served directly
- Global XPWindowManager and XPApps objects
- App factory pattern: apps[name] returns createXxx() function
- Window options: title, icon, content, width, height, x, y, resizable, minimizable, maximizable, closable, showInTaskbar, minWidth, minHeight, onClose, onMinimize, onMaximize
- CSS uses custom properties: --xpi-font, --xpi-blue-focused, --xpi-blue-unfocused

## ANTI-PATTERNS (THIS PROJECT)
- Many apps return error box: "C:\\nApplication not found"
- No npm/package.json - single HTML file with CDN fonts
- All CSS in one 2000+ line file

## COMMANDS
```bash
# No build required - serve directly
python3 -m http.server 8080
# or
npx serve .
```

## NOTES
- base href="/xp/" in index.html assumes /xp/ path
- Some apps (winamp, allprograms) stubbed as not found
- WindowManager uses global zIndex for focus stacking
- Start menu uses data-app attributes for routing