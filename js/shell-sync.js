// Cross-layer sync for the awesomx shell. Every layer surface renders
// its own isolated copy of this document; layers only decide WHAT SHOWS
// WHERE (ax-* slicing). State authority is a property of the content,
// not of a layer name: it is whichever view renders the taskbar (the
// anchor that hosts window state), so re-tagging the taskbar into
// another ax-* layer moves the authority with it. That view executes
// every state mutation; the others drive it through BroadcastChannel
// (with the shell bridge as a compatibility fallback):
//
//   xp-windows  (authority -> others)  taskbar snapshot after any change
//   xp-request  (others -> authority)  open app / taskbar button action
//   xp-menu     (others -> authority)  a click landed outside the
//                                      authority's widgets: close the
//                                      start menu in the view showing it
//
// Outside the shell there is one unsliced document, so it remains the
// local authority and does not need cross-view messages.
const XPShellSync = {
  layer: window.__awesomxLayer || 'background',
  channel: null,
  lastState: null,
  nativeWindows: new Map(),
  authority: true,
  _ro: null,
  _rescanTimer: 0,

  // The taskbar is visible only in the view whose slice includes it
  // (the shell's slicing CSS hides every other layer's widgets).
  computeAuthority() {
    if (!window.awesomx) return true;
    const bar = document.querySelector('.xp-taskbar');
    return Boolean(bar && bar.getClientRects().length > 0);
  },

  get isAuthority() {
    return this.authority;
  },

  init() {
    this.authority = this.computeAuthority();
    this.lastState = { windows: [], focusedId: null };
    if (typeof BroadcastChannel === 'function') {
      this.channel = new BroadcastChannel('xp-shell-sync');
    }
    const receive = ({ topic, payload }) => {
      if (topic === 'xp-windows') {
        this.lastState = payload;
        if (!this.isAuthority) this.renderTaskbar();
      } else if (topic === 'xp-request') {
        if (!this.isAuthority) return;
        this.dispatchRequest(payload);
      } else if (topic === 'xp-menu') {
        if (window.setStartMenuVisible) window.setStartMenuVisible(false);
      } else if (topic === 'xp-window-state') {
        if (payload?.closed) this.nativeWindows.delete(payload.id);
        else if (payload?.id) this.nativeWindows.set(payload.id, payload);
        if (this.isAuthority) this.renderTaskbar();
      } else if (topic === 'xp-window-action') {
        if (!window.__awesomxWindowMode || String(payload?.id) !== String(window.__awesomxWindowId)) return;
        if (payload.action === 'minimize') XPWindowManager.minimizeWindow(Number(payload.id));
        else if (payload.action === 'restore') XPWindowManager.restoreWindow(Number(payload.id));
        else if (payload.action === 'activate') window.awesomx.call('windowActivate').catch(() => {});
      }
    };
    if (this.channel) {
      this.channel.addEventListener('message', (event) => receive(event.data || {}));
    } else {
      window.addEventListener('bridgeMessage', receive);
    }

    // Clicks on regular Wayland windows never reach any shell surface
    // (they fall through), so the only signal is the shell's own
    // hyprlandWindowFocus event: focus left the overlay, close the menu
    // in every view's copy to keep them consistent.
    window.addEventListener('hyprlandWindowFocus', () => {
      if (window.setStartMenuVisible) window.setStartMenuVisible(false);
    });
    window.addEventListener('awesomxWindowClosed', (event) => {
      this.nativeWindows.delete(String(event.id));
      if (this.isAuthority) this.renderTaskbar();
    });

    // A click that reaches a non-authority view fell through the
    // authority's input regions, i.e. it landed "outside" the taskbar,
    // windows and start menu: relay it so the start menu closes, as it
    // would in a single-document page.
    if (!this.isAuthority && (this.channel || window.awesomx)) {
      document.addEventListener('click', () => {
        this.send('xp-menu', { action: 'close' });
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
      if (window.__awesomxRescan) window.__awesomxRescan();
    }, 120);
  },

  send(topic, payload) {
    if (this.channel) {
      this.channel.postMessage({ topic, payload });
    } else if (window.awesomx) {
      window.awesomx.call('broadcast', topic, payload);
    }
  },

  // Drags own the pointer: a stale or lagging region can drop the
  // cursor mid-gesture, so a window drag grabs the whole surface and
  // hands control back to the auto scanner when it ends.
  grabInput() {
    if (!window.awesomx) return;
    window.awesomx.call('setInputRegions', [
      { x: 0, y: 0, width: 99999, height: 99999 },
    ]);
  },

  releaseInput() {
    if (!window.awesomx) return;
    window.awesomx.call('setInputRegions', null);
  },

  observeWindow(el) {
    if (this._ro) this._ro.observe(el);
  },

  publish() {
    if (!this.isAuthority || (!this.channel && !window.awesomx)) return;
    this.send('xp-windows', {
      windows: [...XPWindowManager.windows
        .filter((w) => w.showInTaskbar)
        .map((w) => ({
          id: w.id,
          title: w.title,
          icon: w.icon,
          minimized: w.minimized,
          focused: XPWindowManager.focusedWindowId === w.id,
        })), ...this.nativeWindows.values()],
      focusedId: XPWindowManager.focusedWindowId,
    });
  },

  publishWindow(windowData) {
    if (!window.__awesomxWindowMode || (!this.channel && !window.awesomx)) return;
    this.send('xp-window-state', {
      id: window.__awesomxWindowId,
      title: windowData.title,
      icon: windowData.icon,
      minimized: windowData.minimized,
      focused: XPWindowManager.focusedWindowId === windowData.id,
      showInTaskbar: windowData.showInTaskbar,
    });
  },

  addNativeWindow(spec) {
    const id = String(spec.id);
    this.nativeWindows.set(id, {
      id,
      title: spec.title,
      icon: spec.icon,
      minimized: false,
      focused: false,
      showInTaskbar: spec.showInTaskbar !== false,
    });
    this.renderTaskbar();
  },

  closeWindow(id) {
    if (window.__awesomxWindowMode) {
      this.send('xp-window-state', { id: String(id), closed: true });
    } else {
      this.nativeWindows.delete(String(id));
      if (this.isAuthority) this.renderTaskbar();
    }
  },

  request(payload) {
    if (this.isAuthority) {
      this.dispatchRequest(payload);
      return;
    }
    if (!this.channel && !window.awesomx) return;
    this.send('xp-request', payload);
  },

  dispatchRequest(p) {
    if (!p) return;
    if (p.type === 'open') {
      XPApps.open(p.app);
    } else if (p.type === 'taskbar') {
      if (this.nativeWindows.has(String(p.id))) {
        const win = this.nativeWindows.get(String(p.id));
        const action = win.minimized ? 'restore' : win.focused ? 'minimize' : 'activate';
        this.send('xp-window-action', { id: String(p.id), action });
        return;
      }
      const win = XPWindowManager.windows.find((w) => w.id === p.id);
      if (!win) return;
      if (win.minimized) XPWindowManager.restoreWindow(p.id);
      else if (XPWindowManager.focusedWindowId === p.id)
        XPWindowManager.minimizeWindow(p.id);
      else XPWindowManager.focusWindow(p.id);
    }
  },

  renderTaskbar() {
    const state = this.isAuthority
      ? {
          windows: [...XPWindowManager.windows
            .filter((w) => w.showInTaskbar)
            .map((w) => ({
              id: w.id,
              title: w.title,
              icon: w.icon,
              minimized: w.minimized,
              focused: XPWindowManager.focusedWindowId === w.id,
          })), ...[...this.nativeWindows.values()].filter((window) => window.showInTaskbar !== false)],
          focusedId: XPWindowManager.focusedWindowId,
        }
      : this.lastState;
    const taskbarApps = document.querySelector('.taskbar-apps');
    if (!state || !taskbarApps) return;

    taskbarApps.innerHTML = '';
    state.windows.forEach((w) => {
      const btn = document.createElement('div');
      btn.className = 'taskbar-app' + (w.focused || w.id === state.focusedId ? ' focused' : '');
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
