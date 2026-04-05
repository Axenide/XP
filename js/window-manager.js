const XPWindowManager = {
  windows: [],
  nextId: 1,
  nextZIndex: 1,
  focusedWindowId: null,
  dragState: null,

  init() {
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('click', this.handleClickOutside.bind(this));
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
      onClose = null,
      onMinimize = null,
      onMaximize = null,
      onRestore = null,
    } = options;

    const id = this.nextId++;
    const zIndex = this.nextZIndex++;

    const windowEl = document.createElement('div');
    windowEl.className = 'xp-window focused';
    windowEl.id = `window-${id}`;
    windowEl.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
      height: ${height}px;
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
      windowEl.style.resize = 'both';
      windowEl.style.minWidth = `${minWidth}px`;
      windowEl.style.minHeight = `${minHeight}px`;
    }

    document.querySelector('.xp-desktop').appendChild(windowEl);

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

  closeWindow(id) {
    const winIndex = this.windows.findIndex(w => w.id === id);
    if (winIndex === -1) return;

    const win = this.windows[winIndex];
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
    this.focusWindow(id);
    if (win.onRestore) win.onRestore();
  },

  toggleMaximize(id) {
    const win = this.windows.find(w => w.id === id);
    if (!win || !win.resizable) return;

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

    this.dragState = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - win.x,
      offsetY: e.clientY - win.y,
    };
  },

  handleMouseMove(e) {
    if (!this.dragState) return;
    e.preventDefault();

    const win = this.windows.find(w => w.id === this.dragState.id);
    if (!win || win.maximized) return;

    win.x = e.clientX - this.dragState.offsetX;
    win.y = e.clientY - this.dragState.offsetY;

    win.element.style.left = win.x + 'px';
    win.element.style.top = win.y + 'px';
  },

  handleMouseUp() {
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

    this.dragState = null;
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
  },
};

window.XPWindowManager = XPWindowManager;
