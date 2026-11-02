const XPWindowManager = {
  windows: [],
  nextId: 1,
  nextZIndex: 1,
  focusedWindowId: null,
  dragState: null,
  nativeStateSyncTimer: 0,
  nativeStateSyncGeneration: 0,

  init() {
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('click', this.handleClickOutside.bind(this));
    document.addEventListener('selectstart', this.handleSelectStart.bind(this));
    window.addEventListener('awesomxWindowConfigure', event => {
      if (!window.__awesomxWindowMode || !this.windows.length) return;
      const win = this.windows[0];
      const { width, height, states } = event.detail || {};
      if (width > 0) win.width = width;
      if (height > 0) win.height = height;
      const stateList = Array.isArray(states) ? states : [];
      const fallbackState = {
        maximized: stateList.includes(1),
        fullscreen: stateList.includes(2),
        tiled: stateList.some(state => state >= 5 && state <= 8),
        floating: null,
      };
      const activated = Array.isArray(states) && states.includes(4);
      win.element.classList.toggle('focused', activated);
      win.element.classList.toggle('unfocused', !activated);
      this.focusedWindowId = activated ? win.id : null;
      this.scheduleNativeStateSync(fallbackState);
    });
    window.addEventListener('hyprlandWindowFocus', event => {
      if (window.__awesomxWindowMode && event.class === window.__awesomxWindowAppId) {
        this.scheduleNativeStateSync();
      }
    });
    window.addEventListener('awesomxWindowClose', () => {
      if (window.__awesomxWindowMode && this.windows.length) this.closeWindow(this.windows[0].id, false);
    });
  },

  applyNativeState(win, state) {
    const floating = typeof state.floating === 'boolean' ? state.floating : null;
    win.maximized = Boolean(state.maximized);
    win.fullscreen = Boolean(state.fullscreen);
    win.tiled = Boolean(state.tiled);
    win.floating = floating;
    win.nativeState = {
      maximized: win.maximized,
      fullscreen: win.fullscreen,
      tiled: win.tiled,
      floating: win.floating,
    };
    win.element.classList.toggle('maximized', win.maximized);
    const maximizeButton = win.element.querySelector('.window-btn.maximize');
    if (maximizeButton) {
      maximizeButton.classList.toggle('active', win.maximized);
      maximizeButton.title = win.maximized ? 'Restore' : 'Maximize';
    }
    window.dispatchEvent(new CustomEvent('awesomxWindowState', {
      detail: { id: win.id, appId: window.__awesomxWindowAppId, ...win.nativeState },
    }));
    this.updateTaskbar();
  },

  scheduleNativeStateSync(fallbackState = null) {
    const win = this.windows[0];
    if (!window.__awesomxWindowMode || !win) return;
    if (!window.awesomx) {
      if (fallbackState) this.applyNativeState(win, fallbackState);
      return;
    }
    clearTimeout(this.nativeStateSyncTimer);
    const generation = ++this.nativeStateSyncGeneration;
    const fallback = fallbackState || win.nativeState;
    this.nativeStateSyncTimer = setTimeout(() => {
      this.syncNativeState(generation, fallback);
    }, 80);
  },

  async syncNativeState(generation, fallbackState) {
    const win = this.windows[0];
    if (!win || generation !== this.nativeStateSyncGeneration) return;
    const appId = window.__awesomxWindowAppId;
    if (!appId) return;
    const clients = await window.awesomx.call('hyprlandSendCommand', 'j/clients').catch(() => null);
    if (this.windows[0] !== win || generation !== this.nativeStateSyncGeneration) return;
    const matchingClients = Array.isArray(clients)
      ? clients.filter(client => client && client.class === appId)
      : [];
    const client = matchingClients.find(item => item.title === win.title) || matchingClients[0];
    if (client) {
      const mode = Number(client.fullscreen);
      const floating = typeof client.floating === 'boolean' ? client.floating : null;
      this.applyNativeState(win, {
        maximized: mode === 1,
        fullscreen: mode === 2,
        tiled: floating === false && mode === 0,
        floating,
      });
      return;
    }
    if (fallbackState) this.applyNativeState(win, fallbackState);
  },

  isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
  },

  clearTextSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
  },

  handleSelectStart(e) {
    if (this.isEditableTarget(e.target)) return;
    e.preventDefault();
  },

  createWindow(options) {
    const {
      title,
      icon,
      content,
      width = 400,
      height = 300,
      x = 100,
      y = 100,
      resizable = true,
      minimizable = true,
      maximizable = true,
      closable = true,
      showInTaskbar = true,
      minWidth = 220,
      minHeight = 140,
      windowId = null,
      role = 'ax-top',
      onClose = null,
      onMinimize = null,
      onMaximize = null,
      onRestore = null,
    } = options;

    const id = windowId === null ? this.nextId++ : Number(windowId);
    this.nextId = Math.max(this.nextId, id + 1);
    const zIndex = this.nextZIndex++;

    const windowEl = document.createElement('div');
    windowEl.className = `xp-window focused ${role}`;
    windowEl.id = `window-${id}`;
    windowEl.dataset.axWindowId = String(id);
    windowEl.style.cssText = `
      position: absolute;
      left: ${window.__awesomxWindowMode ? 0 : x}px;
      top: ${window.__awesomxWindowMode ? 0 : y}px;
      width: ${window.__awesomxWindowMode ? '100vw' : `${width}px`};
      height: ${window.__awesomxWindowMode ? '100vh' : `${height}px`};
      z-index: ${zIndex};
    `;

    windowEl.innerHTML = `
      <div class="window-header-bg"></div>
      <div class="window-header" data-window-id="${id}">
        <img class="window-icon" src="${icon}" alt="${title}" />
        <span class="window-title">${title}</span>
        <div class="window-buttons">
          ${
            minimizable
              ? `<button class="window-btn minimize" data-action="minimize" title="Minimize"></button>`
              : ''
          }
      ${
        maximizable
          ? `<button class="window-btn maximize${!resizable ? ' disabled' : ''}" data-action="maximize" title="${resizable ? 'Maximize' : 'Cannot maximize'}"></button>`
          : ''
      }
          ${
            closable
              ? `<button class="window-btn close" data-action="close" title="Close"></button>`
              : ''
          }
        </div>
      </div>
      <div class="window-content">${content}</div>
    `;

    if (resizable) {
      windowEl.classList.add('resizable-window');
      if (!window.__awesomxWindowMode) windowEl.style.resize = 'both';
      windowEl.style.minWidth = `${minWidth}px`;
      windowEl.style.minHeight = `${minHeight}px`;
    }

    document.body.appendChild(windowEl);
    if (window.XPShellSync) XPShellSync.observeWindow(windowEl);

    const winData = {
      id,
      element: windowEl,
      title,
      icon,
      x,
      y,
      width,
      height,
      originalWidth: width,
      originalHeight: height,
      originalX: x,
      originalY: y,
      zIndex,
      minimized: false,
      maximized: false,
      resizable,
      showInTaskbar,
      minWidth,
      minHeight,
      onClose,
      onMinimize,
      onMaximize,
      onRestore,
    };

    this.windows.push(winData);
    this.focusWindow(id);

    windowEl.querySelector('.window-header').addEventListener('dblclick', e => {
      if (e.target.classList.contains('window-btn')) return;
      if (resizable && maximizable) this.toggleMaximize(id);
    });

    windowEl.querySelectorAll('.window-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.classList.contains('disabled')) return;
        const action = btn.dataset.action;
        this.handleWindowAction(id, action);
      });
    });

    this.updateTaskbar();

    return id;
  },

  handleWindowAction(id, action) {
    const win = this.windows.find(w => w.id === id);
    if (!win) return;

    switch (action) {
      case 'close':
        this.closeWindow(id);
        if (win.onClose) win.onClose();
        break;
      case 'minimize':
        this.minimizeWindow(id);
        break;
      case 'maximize':
        this.toggleMaximize(id);
        if (win.onMaximize) win.onMaximize();
        break;
    }
  },

  focusWindow(id) {
    const win = this.windows.find(w => w.id === id);
    if (!win || win.minimized) return;

    win.zIndex = this.nextZIndex++;
    win.element.style.zIndex = win.zIndex;
    win.element.classList.add('focused');
    win.element.classList.remove('unfocused');

    this.windows.forEach(w => {
      if (w.id !== id && !w.minimized) {
        w.element.classList.remove('focused');
        w.element.classList.add('unfocused');
      }
    });

    this.focusedWindowId = id;
    this.updateTaskbar();
  },

  closeWindow(id, notifyShell = true) {
    const winIndex = this.windows.findIndex(w => w.id === id);
    if (winIndex === -1) return;

    const win = this.windows[winIndex];
    if (window.__awesomxWindowMode && notifyShell && window.awesomx) {
      window.awesomx.call('closeWindow').catch(() => {});
      if (window.XPShellSync) XPShellSync.closeWindow(id);
    }
    win.element.remove();
    this.windows.splice(winIndex, 1);

    if (this.focusedWindowId === id) {
      const topWin = this.windows
        .filter(w => !w.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      if (topWin) {
        this.focusWindow(topWin.id);
      } else {
        this.focusedWindowId = null;
      }
    }

    this.updateTaskbar();
  },

  minimizeWindow(id, triggerCallback = true) {
    const win = this.windows.find(w => w.id === id);
    if (!win) return;
    if (win.minimized) return;

    win.minimized = true;
    win.element.style.display = 'none';
    if (window.__awesomxWindowMode && window.awesomx) {
      window.awesomx.call('windowMinimize', win.nativeState).catch(() => {});
    }

    const topWin = this.windows
      .filter(w => !w.minimized)
      .sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topWin) {
      this.focusWindow(topWin.id);
    } else {
      this.focusedWindowId = null;
    }

    if (triggerCallback && win.onMinimize) {
      win.onMinimize();
    }

    this.updateTaskbar();
  },

  restoreWindow(id) {
    const win = this.windows.find(w => w.id === id);
    if (!win) return;

    win.minimized = false;
    win.element.style.display = '';
    if (window.__awesomxWindowMode && window.awesomx) window.awesomx.call('windowActivate').catch(() => {});
    this.focusWindow(id);
    if (win.onRestore) win.onRestore();
  },

  toggleMaximize(id) {
    const win = this.windows.find(w => w.id === id);
    if (!win || !win.resizable) return;

    if (window.__awesomxWindowMode) {
      const maximized = !win.maximized;
      if (window.awesomx) {
        window.awesomx.call('windowMaximize', maximized)
          .then(() => this.scheduleNativeStateSync(win.nativeState))
          .catch(() => {});
      }
      return;
    }

    if (win.maximized) {
      win.maximized = false;
      win.element.style.left = win.originalX + 'px';
      win.element.style.top = win.originalY + 'px';
      win.element.style.width = win.originalWidth + 'px';
      win.element.style.height = win.originalHeight + 'px';
      win.element.style.resize = 'both';
      win.element.classList.remove('maximized');
      const maximizeButton = win.element.querySelector('.window-btn.maximize');
      if (maximizeButton) {
        maximizeButton.classList.remove('active');
        maximizeButton.title = 'Maximize';
      }

      win.x = win.originalX;
      win.y = win.originalY;
      win.width = win.originalWidth;
      win.height = win.originalHeight;
    } else {
      win.originalX = win.x;
      win.originalY = win.y;
      win.originalWidth = win.element.offsetWidth;
      win.originalHeight = win.element.offsetHeight;
      win.maximized = true;
      const taskbar = document.querySelector('.xp-taskbar');
      const taskbarHeight = taskbar ? taskbar.offsetHeight : 30;
      const maximizedHeight = window.innerHeight - taskbarHeight + 3;
      win.element.style.left = '-3px';
      win.element.style.top = '-3px';
      win.element.style.width = window.innerWidth + 6 + 'px';
      win.element.style.height = maximizedHeight + 'px';
      win.element.style.resize = 'none';
      win.element.classList.add('maximized');
      const maximizeButton = win.element.querySelector('.window-btn.maximize');
      if (maximizeButton) {
        maximizeButton.classList.add('active');
        maximizeButton.title = 'Restore';
      }

      win.x = -3;
      win.y = -3;
      win.width = window.innerWidth + 6;
      win.height = maximizedHeight;
    }
  },

  handleMouseDown(e) {
    const windowEl = e.target.closest('.xp-window');
    if (!windowEl) return;

    const id = parseInt(
      windowEl.dataset.windowId || windowEl.id.replace('window-', ''),
    );
    const win = this.windows.find(w => w.id === id);
    if (!win || win.minimized) return;

    this.focusWindow(id);

    const header = e.target.closest('.window-header');
    if (!header) return;

    if (e.target.classList.contains('window-btn')) return;

    e.preventDefault();
    this.clearTextSelection();

    if (window.__awesomxWindowMode) {
      window.awesomx?.call('windowMove').catch(() => {});
      return;
    }

    this.dragState = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - win.x,
      offsetY: e.clientY - win.y,
    };

    if (window.XPShellSync) XPShellSync.grabInput();
    document.body.classList.add('xp-no-select');
  },

  handleMouseMove(e) {
    if (!this.dragState) return;
    e.preventDefault();
    this.clearTextSelection();

    const win = this.windows.find(w => w.id === this.dragState.id);
    if (!win || win.maximized) return;

    win.x = e.clientX - this.dragState.offsetX;
    win.y = e.clientY - this.dragState.offsetY;

    win.element.style.left = win.x + 'px';
    win.element.style.top = win.y + 'px';
  },

  handleMouseUp() {
    if (window.__awesomxWindowMode) return;
    if (this.focusedWindowId !== null) {
      const focusedWindow = this.windows.find(
        win => win.id === this.focusedWindowId,
      );

      if (
        focusedWindow &&
        focusedWindow.resizable &&
        !focusedWindow.maximized
      ) {
        const width = Math.max(
          focusedWindow.minWidth,
          focusedWindow.element.offsetWidth,
        );
        const height = Math.max(
          focusedWindow.minHeight,
          focusedWindow.element.offsetHeight,
        );

        focusedWindow.width = width;
        focusedWindow.height = height;
        focusedWindow.element.style.width = width + 'px';
        focusedWindow.element.style.height = height + 'px';
      }
    }

    if (window.XPShellSync) XPShellSync.releaseInput();
    this.dragState = null;
    document.body.classList.remove('xp-no-select');
    this.clearTextSelection();
  },

  handleClickOutside(e) {
    const isDesktop = e.target.classList.contains('xp-desktop');
    const isIcon = e.target.closest('.xp-icon');
    const isTaskbar = e.target.closest('.xp-taskbar');
    const isStartMenu = e.target.closest('.xp-start-menu');

    if (isDesktop && !isIcon && !isTaskbar && !isStartMenu) {
      this.focusedWindowId = null;
      this.windows.forEach(w => {
        w.element.classList.remove('focused');
        w.element.classList.add('unfocused');
      });
    }
  },

  updateTaskbar() {
    if (window.__awesomxWindowMode) {
      if (window.XPShellSync) {
        const win = this.windows[0];
        if (win) XPShellSync.publishWindow(win);
      }
      return;
    }
    // Non-authority layers render from the authority's snapshots; the
    // authority renders locally and publishes after every mutation.
    if (window.XPShellSync && !XPShellSync.isAuthority) {
      XPShellSync.renderTaskbar();
      return;
    }

    const taskbarApps = document.querySelector('.taskbar-apps');
    if (!taskbarApps) return;

    taskbarApps.innerHTML = '';

    this.windows.forEach(win => {
      if (!win.showInTaskbar) return;

      const btn = document.createElement('div');
      btn.className = `taskbar-app ${
        this.focusedWindowId === win.id ? 'focused' : ''
      }`;
      btn.innerHTML = `
        <img src="${win.icon}" alt="${win.title}" />
        <span>${win.title}</span>
      `;
      btn.addEventListener('click', () => {
        if (win.minimized) {
          this.restoreWindow(win.id);
        } else if (this.focusedWindowId === win.id) {
          this.minimizeWindow(win.id);
        } else {
          this.focusWindow(win.id);
        }
      });
      taskbarApps.appendChild(btn);
    });

    if (window.XPShellSync) XPShellSync.publish();
  },
};

window.XPWindowManager = XPWindowManager;
