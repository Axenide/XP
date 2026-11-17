const XPAxctlTaskbar = {
  fallbackIcon: 'assets/windowsIcons/windows.png',
  active: false,
  socketPath: '',
  subscriptionSocketId: null,
  commandSocketId: null,
  commandConnectPromise: null,
  daemonProcessId: null,
  exitedProcessIds: new Set(),
  requestSequence: 1,
  pendingRequests: new Map(),
  applications: new Map(),
  icons: new Map(),
  windows: [],
  stateGeneration: 0,
  connectPromise: null,
  reconnectTimer: 0,

  init() {
    if (
      this.active ||
      !window.axtml ||
      window.__axtmlWindowMode ||
      !window.XPShellSync?.isAuthority
    ) {
      return;
    }

    this.active = true;
    window.addEventListener('socketData', event => this.handleSocketData(event));
    window.addEventListener('socketClosed', event => this.handleSocketClosed(event));
    window.addEventListener('processExit', event => this.handleProcessExit(event));
    this.connect().catch(() => this.scheduleReconnect());
  },

  async getSocketPath() {
    const result = await window.axtml.call('execRun', {
      cmd: [
        'sh',
        '-c',
        'if [ -n "$AXCTL_SOCKET" ]; then printf "%s" "$AXCTL_SOCKET"; elif [ -n "$XDG_RUNTIME_DIR" ]; then printf "%s/axctl.sock" "$XDG_RUNTIME_DIR"; else printf "/tmp/axctl-%s.sock" "$(id -u)"; fi',
      ],
      timeoutMs: 3000,
      maxBytes: 4096,
    });
    const path = String(result?.stdout || '').trim();
    if (result?.code !== 0 || !path) {
      throw new Error(result?.stderr || 'Unable to determine the axctl socket path');
    }
    return path;
  },

  connectSocket(timeoutMs = 300) {
    return window.axtml.call('socketConnect', {
      path: this.socketPath,
      timeoutMs,
      lineMode: true,
    });
  },

  connect() {
    if (!this.active || this.subscriptionSocketId !== null) {
      return Promise.resolve();
    }
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.openSubscription()
      .catch(error => {
        this.closeSubscription();
        throw error;
      })
      .finally(() => {
        this.connectPromise = null;
      });
    return this.connectPromise;
  },

  async openSubscription() {
    if (!this.socketPath) this.socketPath = await this.getSocketPath();

    let connection;
    try {
      connection = await this.connectSocket();
    } catch {
      if (this.daemonProcessId === null) await this.startDaemon();
      connection = await this.waitForSocket();
    }

    this.subscriptionSocketId = connection.id;
    await window.axtml.call(
      'socketSend',
      connection.id,
      JSON.stringify({ id: 1, method: 'System.Subscribe', params: {} }) + '\n',
    );
  },

  async startDaemon() {
    const result = await window.axtml.call('execSpawn', {
      cmd: ['axctl', 'daemon'],
      lineMode: true,
    });
    const processId = String(result?.id ?? '');
    if (!processId) throw new Error('axctl daemon did not start');
    this.daemonProcessId = this.exitedProcessIds.has(processId) ? null : processId;
  },

  async waitForSocket() {
    let lastError;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        return await this.connectSocket(200);
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    throw lastError || new Error('Timed out waiting for axctl');
  },

  closeSubscription() {
    if (this.subscriptionSocketId === null) return;
    const socketId = this.subscriptionSocketId;
    this.subscriptionSocketId = null;
    window.axtml.call('socketClose', socketId).catch(() => {});
  },

  scheduleReconnect() {
    if (!this.active || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = 0;
      this.connect().catch(() => this.scheduleReconnect());
    }, 5000);
  },

  handleSocketData(event) {
    const socketId = String(event?.id ?? '');
    let message;
    try {
      message = JSON.parse(event?.data);
    } catch {
      return;
    }

    if (socketId === String(this.subscriptionSocketId)) {
      if (Array.isArray(message?.state?.windows)) {
        this.updateWindows(message.state.windows);
      }
      return;
    }

    if (socketId !== String(this.commandSocketId) || message?.id === undefined) return;
    const request = this.pendingRequests.get(String(message.id));
    if (!request) return;
    clearTimeout(request.timer);
    this.pendingRequests.delete(String(message.id));
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.result);
  },

  handleSocketClosed(event) {
    const socketId = String(event?.id ?? '');
    if (socketId === String(this.commandSocketId)) {
      this.commandSocketId = null;
      this.commandConnectPromise = null;
      this.applications.clear();
      this.icons.clear();
      for (const request of this.pendingRequests.values()) {
        clearTimeout(request.timer);
        request.reject(new Error(event?.error || 'axctl connection closed'));
      }
      this.pendingRequests.clear();
    }

    if (socketId === String(this.subscriptionSocketId)) {
      this.subscriptionSocketId = null;
      this.windows = [];
      window.XPShellSync?.setExternalWindows([]);
      this.scheduleReconnect();
    }
  },

  handleProcessExit(event) {
    const processId = String(event?.id ?? '');
    if (!processId) return;
    this.exitedProcessIds.add(processId);
    if (processId === String(this.daemonProcessId)) this.daemonProcessId = null;
  },

  async ensureCommandSocket() {
    if (this.commandSocketId !== null) return this.commandSocketId;
    if (this.commandConnectPromise) return this.commandConnectPromise;

    this.commandConnectPromise = this.connectSocket(1000)
      .then(connection => {
        this.commandSocketId = connection.id;
        return connection.id;
      })
      .finally(() => {
        this.commandConnectPromise = null;
      });
    return this.commandConnectPromise;
  },

  async request(method, params = {}) {
    const socketId = await this.ensureCommandSocket();
    const id = this.requestSequence++;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(String(id));
        reject(new Error(`axctl request timed out: ${method}`));
      }, 5000);
      this.pendingRequests.set(String(id), { resolve, reject, timer });
      window.axtml
        .call(
          'socketSend',
          socketId,
          JSON.stringify({ id, method, params }) + '\n',
        )
        .catch(error => {
          clearTimeout(timer);
          this.pendingRequests.delete(String(id));
          reject(error);
        });
    });
  },

  normalizeIdentity(value) {
    return String(value || '').trim().toLowerCase().replace(/\.desktop$/, '');
  },

  isInternalWindow(windowData) {
    const appId = this.normalizeIdentity(windowData?.app_id);
    const ownAppIds = [
      document.body?.dataset?.axWindowClass,
      window.__axtmlWindowAppId,
    ]
      .map(value => this.normalizeIdentity(value))
      .filter(Boolean);
    return (
      ownAppIds.includes(appId) ||
      appId === 'dev.axtml.dialog' ||
      appId === 'dev.axtml.popup'
    );
  },

  resolveApplication(identity) {
    const key = this.normalizeIdentity(identity);
    if (this.applications.has(key)) return this.applications.get(key);

    const application = (async () => {
      let entry = null;
      try {
        entry = await this.request('Application.Resolve', { identity });
      } catch {}

      let icon = this.fallbackIcon;
      const iconName = entry?.icon || identity;
      if (iconName) icon = await this.resolveIcon(iconName);

      return {
        id: entry?.id || '',
        name: entry?.name || identity,
        icon,
      };
    })();
    this.applications.set(key, application);
    return application;
  },

  resolveIcon(name) {
    const key = String(name || '').trim();
    if (!key) return Promise.resolve(this.fallbackIcon);
    if (this.icons.has(key)) return this.icons.get(key);

    const icon = this.loadIcon(key).catch(() => this.fallbackIcon);
    this.icons.set(key, icon);
    return icon;
  },

  async loadIcon(name) {
    const resolved = await this.request('Icon.Resolve', { name, size: 32, scale: 1 });
    const path = String(resolved?.path || '');
    if (!path) return this.fallbackIcon;

    const extension = path.split('.').pop().toLowerCase();
    const mime = {
      png: 'image/png',
      svg: 'image/svg+xml',
      xpm: 'image/x-xpixmap',
    }[extension];
    if (!mime) return this.fallbackIcon;

    const result = await window.axtml.call('execRun', {
      cmd: ['cat', path],
      timeoutMs: 3000,
      maxBytes: 1 << 20,
      binary: true,
    });
    if (
      result?.code !== 0 ||
      result?.base64 !== true ||
      result?.stdoutTruncated ||
      !result?.stdout
    ) {
      return this.fallbackIcon;
    }
    return `data:${mime};base64,${result.stdout}`;
  },

  async updateWindows(windows) {
    const generation = ++this.stateGeneration;
    const external = windows.filter(
      windowData => windowData?.id !== undefined && !this.isInternalWindow(windowData),
    );
    const normalized = await Promise.all(
      external.map(async windowData => {
        const id = String(windowData.id);
        const appId = String(windowData.app_id || '').trim();
        const identity = this.normalizeIdentity(appId);
        const application = identity
          ? await this.resolveApplication(appId)
          : { id: '', name: '', icon: this.fallbackIcon };
        const groupId = this.normalizeIdentity(application.id || appId) || `window:${id}`;
        return {
          id,
          appId,
          groupId,
          appName: application.name || windowData.title || appId || 'Application',
          title: String(windowData.title || application.name || appId || 'Application'),
          icon: application.icon || this.fallbackIcon,
          focused: Boolean(windowData.is_focused),
        };
      }),
    );

    if (generation !== this.stateGeneration) return;
    this.windows = normalized;
    window.XPShellSync?.setExternalWindows(normalized);
  },

  async activateGroup(groupId) {
    const windows = this.windows.filter(windowData => windowData.groupId === String(groupId));
    if (!windows.length) return;
    const focusedIndex = windows.findIndex(windowData => windowData.focused);
    if (windows.length === 1 && focusedIndex === 0) return;
    const target = windows[focusedIndex < 0 ? 0 : (focusedIndex + 1) % windows.length];
    await this.request('Window.Focus', { id: target.id });
  },
};

window.XPAxctlTaskbar = XPAxctlTaskbar;
