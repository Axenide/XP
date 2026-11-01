// Cross-layer sync for the widgetweb shell. Every layer surface renders
// its own isolated copy of this document; layers only decide WHAT SHOWS
// WHERE (ax-* slicing). State authority is a property of the content,
// not of a layer name: it is whichever view renders the taskbar (the
// anchor that hosts window state), so re-tagging the taskbar into
// another ax-* layer moves the authority with it. That view executes
// every state mutation; the others drive it through the bridge's
// broadcast channel:
//
//   xp-windows  (authority -> others)  taskbar snapshot after any change
//   xp-request  (others -> authority)  open app / taskbar button action
//   xp-menu     (others -> authority)  a click landed outside the
//                                      authority's widgets: close the
//                                      start menu in the view showing it
//
// Outside the shell (plain browser) there is no bridge and no slicing:
// the page behaves as before, as its own authority.
const XPShellSync = {
  layer: window.__widgetwebLayer || 'background',
  lastState: null,
  authority: true,
  _ro: null,
  _rescanTimer: 0,

  // The taskbar is visible only in the view whose slice includes it
  // (the shell's slicing CSS hides every other layer's widgets).
  computeAuthority() {
    if (!window.widgetweb) return true;
    const bar = document.querySelector('.xp-taskbar');
    return Boolean(bar && bar.getClientRects().length > 0);
  },

  get isAuthority() {
    return this.authority;
  },

  init() {
    this.authority = this.computeAuthority();
    window.addEventListener('bridgeMessage', (e) => {
      if (e.topic === 'xp-windows') {
        this.lastState = e.payload;
        if (!this.isAuthority) this.renderTaskbar();
      } else if (e.topic === 'xp-request') {
        if (!this.isAuthority) return;
        this.dispatchRequest(e.payload);
      } else if (e.topic === 'xp-menu') {
        if (window.setStartMenuVisible) window.setStartMenuVisible(false);
      }
    });

    // Clicks on regular Wayland windows never reach any shell surface
    // (they fall through), so the only signal is the shell's own
    // hyprlandWindowFocus event: focus left the overlay, close the menu
    // in every view's copy to keep them consistent.
    window.addEventListener('hyprlandWindowFocus', () => {
      if (window.setStartMenuVisible) window.setStartMenuVisible(false);
    });

    // A click that reaches a non-authority view fell through the
    // authority's input regions, i.e. it landed "outside" the taskbar,
    // windows and start menu: relay it so the start menu closes, as it
    // would in a single-document page.
    if (!this.isAuthority && window.widgetweb) {
      document.addEventListener('click', () => {
        window.widgetweb.call('broadcast', 'xp-menu', { action: 'close' });
      });
    }

    // Window geometry changes (CSS resize grip) must refresh the shell's
    // input regions or the grown area stays dead until the next change.
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.scheduleRescan());
    }
  },

  scheduleRescan() {
    clearTimeout(this._rescanTimer);
    this._rescanTimer = setTimeout(() => {
      if (window.__widgetwebRescan) window.__widgetwebRescan();
    }, 120);
  },

  // Drags own the pointer: a stale or lagging region can drop the
  // cursor mid-gesture, so a window drag grabs the whole surface and
  // hands control back to the auto scanner when it ends.
  grabInput() {
    if (!window.widgetweb) return;
    window.widgetweb.call('setInputRegions', [
      { x: 0, y: 0, width: 99999, height: 99999 },
    ]);
  },

  releaseInput() {
    if (!window.widgetweb) return;
    window.widgetweb.call('setInputRegions', null);
  },

  observeWindow(el) {
    if (this._ro) this._ro.observe(el);
  },

  publish() {
    if (!this.isAuthority || !window.widgetweb) return;
    window.widgetweb.call('broadcast', 'xp-windows', {
      windows: XPWindowManager.windows
        .filter((w) => w.showInTaskbar)
        .map((w) => ({
          id: w.id,
          title: w.title,
          icon: w.icon,
          minimized: w.minimized,
        })),
      focusedId: XPWindowManager.focusedWindowId,
    });
  },

  request(payload) {
    if (this.isAuthority) {
      this.dispatchRequest(payload);
      return;
    }
    if (!window.widgetweb) return;
    window.widgetweb.call('broadcast', 'xp-request', payload);
  },

  dispatchRequest(p) {
    if (!p) return;
    if (p.type === 'open') {
      XPApps.open(p.app);
    } else if (p.type === 'taskbar') {
      const win = XPWindowManager.windows.find((w) => w.id === p.id);
      if (!win) return;
      if (win.minimized) XPWindowManager.restoreWindow(p.id);
      else if (XPWindowManager.focusedWindowId === p.id)
        XPWindowManager.minimizeWindow(p.id);
      else XPWindowManager.focusWindow(p.id);
    }
  },

  renderTaskbar() {
    const state = this.lastState;
    const taskbarApps = document.querySelector('.taskbar-apps');
    if (!state || !taskbarApps) return;

    taskbarApps.innerHTML = '';
    state.windows.forEach((w) => {
      const btn = document.createElement('div');
      btn.className =
        'taskbar-app' + (w.id === state.focusedId ? ' focused' : '');
      btn.innerHTML = `
        <img src="${w.icon}" alt="${w.title}" />
        <span>${w.title}</span>
      `;
      btn.addEventListener('click', () =>
        this.request({ type: 'taskbar', id: w.id }),
      );
      taskbarApps.appendChild(btn);
    });
  },
};

window.XPShellSync = XPShellSync;
