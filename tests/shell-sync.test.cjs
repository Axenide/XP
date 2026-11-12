const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

test('a delayed window state cannot restore a window after its close event', () => {
  const windowListeners = new Map();
  const channels = [];
  const taskbarButtons = [];
  const taskbarApps = {
    set innerHTML(value) {
      taskbarButtons.length = 0;
    },
    appendChild(button) {
      taskbarButtons.push(button);
    },
  };
  const document = {
    querySelector(selector) {
      if (selector === '.xp-taskbar') return { getClientRects: () => [{}] };
      if (selector === '.taskbar-apps') return taskbarApps;
      return null;
    },
    createElement() {
      return { addEventListener() {} };
    },
    addEventListener() {},
  };
  class MockBroadcastChannel {
    constructor() {
      channels.push(this);
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage() {}

    receive(data) {
      this.listeners.get('message')({ data });
    }
  }
  const window = {
    axtml: {},
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    dispatchEvent(event) {
      windowListeners.get(event.type)(event);
    },
  };
  const context = vm.createContext({
    BroadcastChannel: MockBroadcastChannel,
    document,
    window,
    XPWindowManager: { windows: [], focusedWindowId: null },
  });

  vm.runInContext(readFileSync(require.resolve('../js/shell-sync.js'), 'utf8'), context);
  window.XPShellSync.init();
  window.XPShellSync.addNativeWindow({ id: '17', title: 'Minesweeper', icon: 'mine.png' });
  assert.equal(taskbarButtons.length, 1);

  window.dispatchEvent({ type: 'axtmlWindowClosed', id: '17' });
  channels[0].receive({
    topic: 'xp-window-state',
    payload: { id: '17', title: 'Minesweeper', icon: 'mine.png', showInTaskbar: true },
  });

  assert.equal(window.XPShellSync.nativeWindows.has('17'), false);
  assert.equal(taskbarButtons.length, 0);
});

test('drag input capture expands and restores the requested layer region', () => {
  const calls = [];
  const window = {
    axtml: {
      call(...args) {
        calls.push(args);
        return { catch() {} };
      },
    },
    addEventListener() {},
  };
  const context = vm.createContext({ window, document: {} });
  vm.runInContext(readFileSync(require.resolve('../js/shell-sync.js'), 'utf8'), context);
  window.XPShellSync.grabInput();
  window.XPShellSync.releaseInput();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['setInputRegions', { band: 2, rects: [{ x: 0, y: 0, width: 99999, height: 99999 }] }],
    ['setInputRegions', null],
  ]);
});
