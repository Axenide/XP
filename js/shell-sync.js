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
  taskbarMenuSequence: 0,
  inputDebugSequence: 0,
  currentInputCommand: null,
  activeWindow: null,
  activeWindowRevision: 0,
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

  handleCommand(event) {
    if (event.command !== 'start') return;
    if (!this.isAuthority) {
      this.debugInput('start-command-ignored', { command: event.command, reason: 'not-authority' });
      return;
    }
    const commandId = ++this.inputDebugSequence;
    this.currentInputCommand = commandId;
    this.debugInput('start-command-received', {
      command: event.command,
      commandId,
      trusted: event.isTrusted ?? null,
    });
    const button = document.getElementById('start-button');
    this.debugInput('start-click-before', { commandId, buttonFound: Boolean(button) });
    button?.click();
    this.debugInput('start-click-after', { commandId, buttonFound: Boolean(button) });
    this.currentInputCommand = null;
  },

  debugInput(event, details = {}) {
    if (!window.axtml?.call) return;
    const active = document.activeElement;
    const menu = document.getElementById('start-menu');
    const describe = (element) => element ? {
      tag: String(element.tagName || '').toLowerCase(),
      id: String(element.id || ''),
      className: typeof element.className === 'string' ? element.className : '',
      tabIndex: Number.isInteger(element.tabIndex) ? element.tabIndex : null,
    } : null;
    let menuDisplay = menu?.style?.display ?? null;
    if (menu && typeof window.getComputedStyle === 'function') {
      menuDisplay = window.getComputedStyle(menu).display;
    }
    const record = {
      source: 'XP',
      event,
      time: new Date().toISOString(),
      commandId: this.currentInputCommand,
      layer: this.layer,
      authority: this.isAuthority,
      documentHasFocus: typeof document.hasFocus === 'function' ? document.hasFocus() : null,
      menu: menu ? { display: menuDisplay, expanded: menu.getAttribute?.('aria-expanded') ?? null } : null,
      activeElement: describe(active),
      ...details,
    };
    window.axtml.call('__inputDebug', record).catch(() => {});
  },

  handleWindowFocus(event) {
    const next = {
      class: String(event.class || ''),
      title: String(event.title || ''),
    };
    if (!next.class) return;
    this.activeWindowRevision += 1;
    const previous = this.activeWindow;
    this.activeWindow = next;
    this.debugInput('hyprland-window-focus', {
      className: next.class,
      title: next.title,
      previousClassName: previous?.class || '',
      previousTitle: previous?.title || '',
    });
    if (
      previous &&
      previous.class === next.class &&
      (!previous.title || !next.title || previous.title === next.title)
    ) {
      this.debugInput('hyprland-window-focus-ignored', { reason: 'same-window' });
      return;
    }
    if (window.setStartMenuVisible) window.setStartMenuVisible(false, 'hyprland-window-focus');
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
          if (!this.closedNativeWindows.has(id)) {
            this.nativeWindows.set(id, { ...this.nativeWindows.get(id), ...payload });
          }
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

    document.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('.taskbar-app-grouped, .taskbar-group-menu')) return;
      this.closeTaskbarGroupMenus();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.closeTaskbarGroupMenus();
    });

    document.addEventListener('focusin', event => {
      if (this.isAuthority) this.debugInput('dom-focusin', { target: this.describeInputTarget(event.target) });
    });
    document.addEventListener('focusout', event => {
      if (this.isAuthority) {
        this.debugInput('dom-focusout', {
          target: this.describeInputTarget(event.target),
          relatedTarget: this.describeInputTarget(event.relatedTarget),
        });
      }
    });
    document.addEventListener('keydown', event => {
      if (!this.isAuthority) return;
      this.debugInput('dom-keydown', {
        key: event.key,
        code: event.code,
        trusted: event.isTrusted,
        defaultPrevented: event.defaultPrevented,
        target: this.describeInputTarget(event.target),
      });
    }, true);

    window.addEventListener('axtmlCommand', (event) => this.handleCommand(event));

    // Ignore focus notifications when keyboard release reactivates this same window.
    window.addEventListener('hyprlandWindowFocus', event => this.handleWindowFocus(event));
    if (this.isAuthority && window.axtml?.call) {
      const revision = this.activeWindowRevision;
      window.axtml.call('hyprlandSendCommand', 'j/activewindow').then(activeWindow => {
        if (this.activeWindowRevision !== revision || !activeWindow?.class) return;
        this.activeWindow = {
          class: String(activeWindow.class),
          title: String(activeWindow.title || ''),
        };
      }).catch(() => {});
    }
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

  describeInputTarget(element) {
    if (!element) return null;
    return {
      tag: String(element.tagName || '').toLowerCase(),
      id: String(element.id || ''),
      className: typeof element.className === 'string' ? element.className : '',
    };
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
          groupId: w.taskbarGroup,
          source: 'internal',
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
      groupId: windowData.taskbarGroup,
      source: 'native',
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
      groupId: spec.taskbarGroup || spec.icon || spec.app || id,
      source: 'native',
      x: spec.x,
      y: spec.y,
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
    } else if (p.type === 'taskbar-window') {
      if (this.nativeWindows.has(String(p.id))) {
        this.send('xp-window-action', {
          id: String(p.id),
          action: this.nativeWindows.get(String(p.id)).minimized ? 'restore' : 'activate',
        });
        return;
      }
      const win = XPWindowManager.windows.find(windowData => windowData.id === p.id);
      if (!win) return;
      if (win.minimized) XPWindowManager.restoreWindow(p.id);
      else XPWindowManager.focusWindow(p.id);
    } else if (p.type === 'external-taskbar') {
      window.XPAxctlTaskbar?.activateGroup(p.groupId).catch(() => {});
    } else if (p.type === 'external-window') {
      window.XPAxctlTaskbar?.activateWindow(p.id).catch(() => {});
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
              groupId: w.taskbarGroup,
              source: 'internal',
              minimized: w.minimized,
              focused: XPWindowManager.focusedWindowId === w.id,
            })), ...[...this.nativeWindows.values()].filter((window) => window.showInTaskbar !== false)],
          externalWindows: this.externalWindows,
          focusedId: XPWindowManager.focusedWindowId,
        }
      : this.lastState;
    const taskbarApps = document.querySelector('.taskbar-apps');
    if (!state || !taskbarApps) return;

    this.closeTaskbarGroupMenus();
    document.querySelectorAll('.taskbar-group-menu').forEach(menu => menu.remove());
    taskbarApps.innerHTML = '';
    const groups = new Map();
    const addWindow = (windowData, source) => {
      if (!windowData || windowData.id === undefined) return;
      const groupId = String(windowData.groupId || `window:${source}:${windowData.id}`);
      const key = `${source}:${groupId}`;
      const group = groups.get(key) || {
        key,
        id: groupId,
        source,
        name: windowData.appName || windowData.title || 'Application',
        icon: windowData.icon,
        windows: [],
      };
      group.windows.push({ ...windowData, source });
      if (windowData.focused || windowData.id === state.focusedId) group.focused = true;
      groups.set(key, group);
    };

    (Array.isArray(state.windows) ? state.windows : []).forEach(windowData => {
      addWindow(windowData, windowData.source || 'internal');
    });
    (Array.isArray(state.externalWindows) ? state.externalWindows : []).forEach(windowData => {
      if (windowData?.groupId) addWindow(windowData, 'external');
    });

    groups.forEach(group => this.renderTaskbarGroup(taskbarApps, group));
  },

  renderTaskbarGroup(taskbarApps, group) {
    const grouped = group.windows.length > 1;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `taskbar-app${group.focused ? ' focused' : ''}${grouped ? ' taskbar-app-grouped' : ''}`;
    button.dataset.groupId = group.id;
    button.dataset.windowFocused = String(Boolean(group.focused));
    const titles = group.windows.map(windowData => windowData.title).filter(Boolean);
    button.title = [group.name, ...titles].join('\n');
    button.setAttribute(
      'aria-label',
      `${group.name}${grouped ? `, ${group.windows.length} windows` : ''}`,
    );

    const icon = document.createElement('img');
    icon.src = group.icon || 'assets/windowsIcons/windows.png';
    icon.alt = '';
    icon.draggable = false;
    button.appendChild(icon);

    if (grouped) {
      const count = document.createElement('span');
      count.className = 'taskbar-app-count';
      count.textContent = String(group.windows.length);
      count.setAttribute('aria-hidden', 'true');
      button.appendChild(count);
    }

    const label = document.createElement('span');
    label.className = 'taskbar-app-title';
    label.textContent = group.name || 'Application';
    button.appendChild(label);

    let menu = null;
    if (grouped) {
      const arrow = document.createElement('span');
      arrow.className = 'taskbar-app-arrow';
      arrow.textContent = '▾';
      arrow.setAttribute('aria-hidden', 'true');
      button.appendChild(arrow);
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      menu = this.createTaskbarGroupMenu(group);
      button.setAttribute('aria-controls', menu.id);
    }

    button.addEventListener('click', () => {
      if (grouped) {
        this.toggleTaskbarGroupMenu(button, menu);
      } else {
        this.activateTaskbarWindow(group.windows[0], group);
      }
    });
    taskbarApps.appendChild(button);
    if (menu) document.querySelector('.xp-taskbar')?.appendChild(menu);
  },

  createTaskbarGroupMenu(group) {
    const menu = document.createElement('div');
    menu.className = 'taskbar-group-menu';
    menu.id = `taskbar-group-menu-${++this.taskbarMenuSequence}`;
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    group.windows.forEach(windowData => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'taskbar-group-menu-item';
      item.setAttribute('role', 'menuitem');
      item.title = windowData.title || group.name;

      const icon = document.createElement('img');
      icon.src = windowData.icon || group.icon || 'assets/windowsIcons/windows.png';
      icon.alt = '';
      icon.draggable = false;
      item.appendChild(icon);

      const title = document.createElement('span');
      title.textContent = windowData.title || group.name || 'Application';
      item.appendChild(title);

      item.addEventListener('click', () => {
        this.closeTaskbarGroupMenus();
        this.activateTaskbarWindow(windowData, group);
      });
      menu.appendChild(item);
    });

    return menu;
  },

  toggleTaskbarGroupMenu(button, menu) {
    const wasOpen = !menu.hidden;
    this.closeTaskbarGroupMenus();
    if (wasOpen) return;

    const taskbar = document.querySelector('.xp-taskbar');
    if (!taskbar) return;
    const barRect = taskbar.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    menu.style.width = `${button.offsetWidth + 10}px`;
    menu.hidden = false;
    const left = Math.max(0, Math.min(buttonRect.left - barRect.left, barRect.width - menu.offsetWidth));
    menu.style.left = `${left}px`;
    button.classList.add('focused');
    button.setAttribute('aria-expanded', 'true');
  },

  closeTaskbarGroupMenus() {
    document.querySelectorAll('.taskbar-group-menu').forEach(menu => {
      menu.hidden = true;
    });
    document.querySelectorAll('.taskbar-app-grouped[aria-expanded="true"]').forEach(button => {
      button.setAttribute('aria-expanded', 'false');
      if (button.dataset.windowFocused !== 'true') button.classList.remove('focused');
    });
  },

  activateTaskbarWindow(windowData, group) {
    if (windowData.source === 'external') {
      this.request({ type: 'external-window', id: windowData.id });
    } else if (group.windows.length > 1) {
      this.request({ type: 'taskbar-window', id: windowData.id });
    } else {
      this.request({ type: 'taskbar', id: windowData.id });
    }
  },
};

window.XPShellSync = XPShellSync;
