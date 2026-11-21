const XPStartMenuProfile = {
  initialized: false,

  async init(startMenu) {
    if (
      this.initialized ||
      !startMenu ||
      !window.axtml ||
      window.__axtmlWindowMode ||
      !window.XPShellSync?.isAuthority
    ) {
      return;
    }
    this.initialized = true;

    const image = startMenu.querySelector('.header-img');
    const label = startMenu.querySelector('.header-text');
    if (!image || !label) return;

    try {
      const result = await window.axtml.call('execRun', {
        cmd: ['sh', '-c', 'printf "%s\\n%s" "$(whoami)" "$HOME/.face.icon"'],
        timeoutMs: 3000,
        maxBytes: 4096,
      });
      const output = String(result?.stdout || '');
      const separator = output.indexOf('\n');
      if (result?.code !== 0 || separator < 0) return;

      const username = output.slice(0, separator).trim();
      const facePath = output.slice(separator + 1).trim();
      if (username) {
        label.textContent = this.capitalize(username);
        image.alt = label.textContent;
      }
      if (facePath) await this.loadFaceIcon(facePath, image);
    } catch {}
  },

  capitalize(value) {
    const [first, ...rest] = Array.from(String(value || '').trim());
    return first ? first.toLocaleUpperCase() + rest.join('') : 'User';
  },

  imageMimeType(base64) {
    if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('AAABAA')) return 'image/x-icon';
    if (base64.startsWith('Qk')) return 'image/bmp';
    if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWwg')) {
      return 'image/svg+xml';
    }
    return '';
  },

  async loadFaceIcon(path, image) {
    try {
      const result = await window.axtml.call('execRun', {
        cmd: ['cat', path],
        timeoutMs: 3000,
        maxBytes: 1 << 20,
        binary: true,
      });
      const base64 = String(result?.stdout || '');
      const mime = this.imageMimeType(base64);
      if (
        result?.code !== 0 ||
        result?.base64 !== true ||
        result?.stdoutTruncated ||
        !mime ||
        !image.isConnected
      ) {
        return;
      }
      image.src = `data:${mime};base64,${base64}`;
    } catch {}
  },
};

window.XPStartMenuProfile = XPStartMenuProfile;
