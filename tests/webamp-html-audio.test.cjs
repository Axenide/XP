const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function setup() {
  const audio = {
    listeners: new Map(),
    currentTime: 0,
    duration: 120,
    volume: 1,
    paused: true,
    addEventListener(type, callback) {
      const callbacks = this.listeners.get(type) || new Set();
      callbacks.add(callback);
      this.listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback);
    },
    dispatch(type) {
      for (const callback of this.listeners.get(type) || []) callback({ target: this });
    },
    async play() {
      this.paused = false;
      this.dispatch('playing');
    },
    pause() {
      this.paused = true;
      this.dispatch('pause');
    },
    load() {},
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    },
  };
  const window = {};
  const document = {
    createElement(name) {
      assert.equal(name, 'audio');
      return audio;
    },
  };
  const context = vm.createContext({ window, document, console });
  vm.runInContext(readFileSync(require.resolve('../js/webamp-html-audio.js'), 'utf8'), context);
  return { Media: window.XPWebampHTMLAudioMedia, audio };
}

test('direct media plays the URL on an HTMLAudioElement and applies volume', async () => {
  const { Media, audio } = setup();
  const media = new Media();
  const events = [];
  media.on('playing', () => events.push('playing'));
  media.on('fileLoaded', () => events.push('fileLoaded'));
  media.setVolume(65);

  await media.loadFromUrl('https://example.test/track.mp3', true);
  audio.dispatch('loadedmetadata');

  assert.equal(audio.crossOrigin, 'anonymous');
  assert.equal(audio.preload, 'auto');
  assert.equal(audio.src, 'https://example.test/track.mp3');
  assert.equal(audio.volume, 0.65);
  assert.deepEqual(events, ['playing', 'fileLoaded']);
});

test('direct media supports pause, stop, seek, and a silent visualizer', async () => {
  const { Media, audio } = setup();
  const media = new Media();
  await media.loadFromUrl('https://example.test/track.mp3', true);
  media.seekToPercentComplete(25);
  assert.equal(audio.currentTime, 30);

  media.pause();
  assert.equal(media.status, 'paused');
  media.stop();
  assert.equal(audio.currentTime, 0);
  assert.equal(media.status, 'stopped');

  const samples = new Uint8Array(4);
  media.getAnalyser().getByteTimeDomainData(samples);
  assert.deepEqual(Array.from(samples), [128, 128, 128, 128]);
  media.dispose();
  assert.equal(audio.src, '');
});
