class XPWebampHTMLAudioMedia {
  constructor() {
    this.audio = document.createElement('audio');
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
    this.listeners = new Map();
    this.status = 'stopped';
    this.volume = 100;
    this.analyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteTimeDomainData(data) {
        data.fill(128);
      },
      getFloatTimeDomainData(data) {
        data.fill(0);
      },
      getByteFrequencyData(data) {
        data.fill(0);
      },
      getFloatFrequencyData(data) {
        data.fill(-100);
      },
    };
    this.handlers = new Map([
      ['loadedmetadata', () => {
        this.emit('fileLoaded');
        this.emit('stopWaiting');
        this.emit('timeupdate');
      }],
      ['waiting', () => this.emit('waiting')],
      ['canplay', () => this.emit('stopWaiting')],
      ['timeupdate', () => this.emit('timeupdate')],
      ['playing', () => this.setStatus('playing')],
      ['pause', () => {
        if (this.status === 'playing') this.setStatus('paused');
      }],
      ['ended', () => {
        this.setStatus('stopped');
        this.emit('ended');
      }],
      ['suspend', () => this.emit('stallChanged')],
      ['error', () => {
        console.error('Webamp direct audio error:', this.audio.error);
        this.setStatus('stopped');
        this.emit('ended');
      }],
    ]);

    for (const [event, handler] of this.handlers) {
      this.audio.addEventListener(event, handler);
    }
  }

  on(event, callback) {
    let callbacks = this.listeners.get(event);
    if (!callbacks) {
      callbacks = new Set();
      this.listeners.set(event, callbacks);
    }
    callbacks.add(callback);
  }

  emit(event, ...args) {
    for (const callback of this.listeners.get(event) || []) {
      callback(...args);
    }
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    if (status === 'playing') this.emit('playing');
    this.emit('timeupdate');
  }

  duration() {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  timeElapsed() {
    return Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
  }

  async play() {
    try {
      await this.audio.play();
      this.setStatus('playing');
    } catch (error) {
      console.error('Webamp direct audio playback failed:', error);
      this.setStatus('stopped');
    }
  }

  pause() {
    this.audio.pause();
    this.setStatus('paused');
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.setStatus('stopped');
  }

  seekToPercentComplete(percent) {
    this.seekToTime(this.duration() * percent / 100);
  }

  seekToTime(seconds) {
    this.audio.currentTime = Math.max(0, Math.min(this.duration(), Number(seconds) || 0));
    this.emit('timeupdate');
  }

  async loadFromUrl(url, autoPlay) {
    this.emit('waiting');
    this.audio.pause();
    this.status = 'stopped';
    this.audio.src = url;
    this.audio.load();
    this.emit('stopWaiting');
    if (autoPlay) await this.play();
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(100, Number(volume) || 0));
    this.audio.volume = this.volume / 100;
  }

  setBalance() {}

  setPreamp() {}

  setEqBand() {}

  disableEq() {}

  enableEq() {}

  getAnalyser() {
    return this.analyser;
  }

  dispose() {
    for (const [event, handler] of this.handlers) {
      this.audio.removeEventListener(event, handler);
    }
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.listeners.clear();
  }
}

window.XPWebampHTMLAudioMedia = XPWebampHTMLAudioMedia;
