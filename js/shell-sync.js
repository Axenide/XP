// Cross-layer sync for the AXTML shell. Every layer surface renders
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
  layer: window.__axtmlLayer || 'background',
  channel: null,
  lastState: null,
  nativeWindows: new Map(),
  externalWindows: [],
  closedNativeWindows: new Set(),
  authority: true,
  _ro: null,
  _rescanTimer: 0,

  // The taskbar is visible only in the view whose slice includes it
  // (the shell's slicing CSS hides every other layer's widgets).
  computeAuthority() {
    if (!window.axtml) return true;
    const bar = document.querySelector('.xp-taskbar');
    return Boolean(bar && bar.getClientRects().length > 0);
  },

  get isAuthority() {
    return this.authority;
  },

  init() {
    this.authority = this.computeAuthority();
    this.lastState = { windows: [], externalWindows: [], focusedId: null };
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
        if (payload?.closed) this.markNativeWindowClosed(payload.id);
        else if (payload?.id) {
          const id = String(payload.id);
          if (!this.closedNativeWindows.has(id)) this.nativeWindows.set(id, payload);
        }
        if (this.isAuthority) this.renderTaskbar();
      } else if (topic === 'xp-window-action') {
        if (!window.__axtmlWindowMode || String(payload?.id) !== String(window.__axtmlWindowId)) return;
        if (payload.action === 'minimize') XPWindowManager.minimizeWindow(Number(payload.id));
        else if (payload.action === 'restore') XPWindowManager.restoreWindow(Number(payload.id));
        else if (payload.action === 'activate') window.axtml.call('windowActivate').catch(() => {});
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
    window.addEventListener('axtmlWindowClosed', (event) => {
      this.markNativeWindowClosed(event.id);
      if (this.isAuthority) this.renderTaskbar();
    });

    // A click that reaches a non-authority view fell through the
    // authority's input regions, i.e. it landed "outside" the taskbar,
    // windows and start menu: relay it so the start menu closes, as it
    // would in a single-document page.
    if (!this.isAuthority && (this.channel || window.axtml)) {
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
      if (window.__axtmlRescan) window.__axtmlRescan();
    }, 120);
  },

  send(topic, payload) {
    if (this.channel) {
      this.channel.postMessage({ topic, payload });
    } else if (window.axtml) {
      window.axtml.call('broadcast', topic, payload);
    }
  },

  // Drags own the pointer: a stale or lagging region can drop the
  // cursor mid-gesture, so a window drag grabs the whole surface and
  // hands control back to the auto scanner when it ends.
  grabInput(band = 2) {
    if (!window.axtml) return;
    window.axtml.call('setInputRegions', {
      band,
      rects: [{ x: 0, y: 0, width: 99999, height: 99999 }],
    });
  },

  releaseInput() {
    if (!window.axtml) return;
    window.axtml.call('setInputRegions', null);
  },

  observeWindow(el) {
    if (this._ro) this._ro.observe(el);
  },

  publish() {
    if (!this.isAuthority || (!this.channel && !window.axtml)) return;
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
      externalWindows: this.externalWindows,
      focusedId: XPWindowManager.focusedWindowId,
    });
  },

  setExternalWindows(windows) {
    this.externalWindows = Array.isArray(windows) ? windows : [];
    if (!this.isAuthority) return;
    this.renderTaskbar();
    this.publish();
  },

  publishWindow(windowData) {
    if (!window.__axtmlWindowMode || (!this.channel && !window.axtml)) return;
    const id = String(window.__axtmlWindowId);
    if (this.closedNativeWindows.has(id)) return;
    this.send('xp-window-state', {
      id,
      title: windowData.title,
      icon: windowData.icon,
      minimized: windowData.minimized,
      focused: XPWindowManager.focusedWindowId === windowData.id,
      showInTaskbar: windowData.showInTaskbar,
    });
  },

  addNativeWindow(spec) {
    const id = String(spec.id);
    this.closedNativeWindows.delete(id);
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
    const windowId = String(id);
    this.markNativeWindowClosed(windowId);
    if (window.__axtmlWindowMode) {
      this.send('xp-window-state', { id: windowId, closed: true });
    } else {
      if (this.isAuthority) this.renderTaskbar();
    }
  },

  markNativeWindowClosed(id) {
    if (id === undefined || id === null) return;
    const windowId = String(id);
    this.closedNativeWindows.add(windowId);
    this.nativeWindows.delete(windowId);
  },

  request(payload) {
    if (this.isAuthority) {
      this.dispatchRequest(payload);
      return;
    }
    if (!this.channel && !window.axtml) return;
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
    } else if (p.type === 'external-taskbar') {
      window.XPAxctlTaskbar?.activateGroup(p.groupId).catch(() => {});
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
          externalWindows: this.externalWindows,
          focusedId: XPWindowManager.focusedWindowId,
        }
      : this.lastState;
    const taskbarApps = document.querySelector('.taskbar-apps');
    if (!state || !taskbarApps) return;

    taskbarApps.innerHTML = '';
    (Array.isArray(state.windows) ? state.windows : []).forEach((w) => {
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

    this.renderExternalTaskbar(taskbarApps, state.externalWindows);
  },

  renderExternalTaskbar(taskbarApps, windows) {
    const groups = new Map();
    (Array.isArray(windows) ? windows : []).forEach(windowData => {
      if (!windowData?.groupId) return;
      const group = groups.get(windowData.groupId) || {
        id: windowData.groupId,
        name: windowData.appName || windowData.title,
        icon: windowData.icon,
        windows: [],
      };
      group.windows.push(windowData);
      if (windowData.focused) group.focused = true;
      groups.set(windowData.groupId, group);
    });

    groups.forEach(group => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `taskbar-app taskbar-app-external${group.focused ? ' focused' : ''}`;
      button.dataset.groupId = group.id;
      const titles = group.windows.map(windowData => windowData.title).filter(Boolean);
      button.title = [group.name, ...titles].join('\n');
      button.setAttribute(
        'aria-label',
        `${group.name}${group.windows.length > 1 ? `, ${group.windows.length} windows` : ''}`,
      );

      const icon = document.createElement('img');
      icon.src = group.icon || 'assets/windowsIcons/windows.png';
      icon.alt = '';
      icon.draggable = false;
      button.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'taskbar-app-title';
      label.textContent = group.name || 'Application';
      button.appendChild(label);

      if (group.windows.length > 1) {
        const count = document.createElement('span');
        count.className = 'taskbar-app-count';
        count.textContent = String(group.windows.length);
        count.setAttribute('aria-hidden', 'true');
        button.appendChild(count);
      }

      button.addEventListener('click', () =>
        this.request({ type: 'external-taskbar', groupId: group.id }),
      );
      taskbarApps.appendChild(button);
    });
  },
};

window.XPShellSync = XPShellSync;
