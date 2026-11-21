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

test('external application windows share one taskbar button and relay activation', () => {
  const listeners = new Map();
  const buttons = [];
  const calls = [];
  const taskbarApps = {
    set innerHTML(value) {
      buttons.length = 0;
    },
    appendChild(button) {
      buttons.push(button);
    },
  };
  const document = {
    querySelector(selector) {
      if (selector === '.xp-taskbar') return { getClientRects: () => [{}] };
      if (selector === '.taskbar-apps') return taskbarApps;
      return null;
    },
    createElement() {
      return {
        children: [],
        listeners: new Map(),
        dataset: {},
        addEventListener(type, listener) { this.listeners.set(type, listener); },
        appendChild(child) { this.children.push(child); },
        setAttribute() {},
      };
    },
    addEventListener() {},
  };
  const window = {
    axtml: { call() { return Promise.resolve(); } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    XPAxctlTaskbar: {
      activateGroup(groupId) {
        calls.push(groupId);
        return Promise.resolve();
      },
    },
  };
  const context = vm.createContext({
    document,
    window,
    XPWindowManager: {
      windows: [],
      focusedWindowId: null,
      minimizeWindow() { assert.fail('external windows must not be minimized'); },
    },
  });

  vm.runInContext(readFileSync(require.resolve('../js/shell-sync.js'), 'utf8'), context);
  window.XPShellSync.init();
  window.XPShellSync.setExternalWindows([
    {
      id: 'window-1',
      groupId: 'org.example.browser',
      appName: 'Browser',
      title: 'First tab',
      icon: 'data:image/png;base64,AA==',
      focused: true,
    },
    {
      id: 'window-2',
      groupId: 'org.example.browser',
      appName: 'Browser',
      title: 'Second tab',
      icon: 'data:image/png;base64,AA==',
      focused: false,
    },
  ]);

  assert.equal(buttons.length, 1);
  assert.match(buttons[0].className, /focused/);
  assert.equal(buttons[0].children[1].textContent, 'Browser');
  assert.equal(buttons[0].children[2].textContent, '2');
  buttons[0].listeners.get('click')();
  assert.deepEqual(calls, ['org.example.browser']);
});

test('XP-managed taskbar windows keep their minimize behavior', () => {
  const buttons = [];
  const taskbarApps = {
    set innerHTML(value) {
      buttons.length = 0;
    },
    appendChild(button) {
      buttons.push(button);
    },
  };
  const document = {
    querySelector(selector) {
      if (selector === '.xp-taskbar') return { getClientRects: () => [{}] };
      if (selector === '.taskbar-apps') return taskbarApps;
      return null;
    },
    createElement() {
      return {
        listeners: new Map(),
        addEventListener(type, listener) { this.listeners.set(type, listener); },
      };
    },
    addEventListener() {},
  };
  let minimized = 0;
  const windowManager = {
    windows: [{ id: 5, title: 'Notepad', icon: 'notepad.png', showInTaskbar: true }],
    focusedWindowId: 5,
    minimizeWindow(id) {
      assert.equal(id, 5);
      minimized += 1;
    },
    restoreWindow() {},
    focusWindow() {},
  };
  const window = { addEventListener() {} };
  const context = vm.createContext({ document, window, XPWindowManager: windowManager });

  vm.runInContext(readFileSync(require.resolve('../js/shell-sync.js'), 'utf8'), context);
  window.XPShellSync.init();
  window.XPShellSync.renderTaskbar();
  buttons[0].listeners.get('click')();

  assert.equal(minimized, 1);
});

test('axtml start clicks the Start button and survives same-window focus', async () => {
  const listeners = new Map();
  const inputDebug = [];
  let menuOpen = false;
  let startButtonClicks = 0;
  const window = {
    axtml: {
      call(name, ...args) {
        if (name === '__inputDebug') {
          inputDebug.push(args[0]);
          return Promise.resolve(null);
        }
        const [command] = args;
        assert.deepEqual([name, command], ['hyprlandSendCommand', 'j/activewindow']);
        return Promise.resolve({ class: 'com.mitchellh.ghostty', title: 'terminal' });
      },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    getComputedStyle() { return { display: menuOpen ? 'flex' : 'none' }; },
    setStartMenuVisible(open) { menuOpen = open; },
  };
  const startButton = {
    click() {
      startButtonClicks += 1;
      const isVisible = window.getComputedStyle().display !== 'none';
      window.setStartMenuVisible(!isVisible);
    },
  };
  const document = {
    querySelector(selector) {
      if (selector === '.xp-taskbar') return { getClientRects: () => [{}] };
      return null;
    },
    getElementById(id) { return id === 'start-button' ? startButton : null; },
    addEventListener() {},
  };
  const context = vm.createContext({ document, window });

  vm.runInContext(readFileSync(require.resolve('../js/shell-sync.js'), 'utf8'), context);
  window.XPShellSync.init();
  await Promise.resolve();
  const receiveCommand = listeners.get('axtmlCommand');
  const receiveFocus = listeners.get('hyprlandWindowFocus');

  receiveCommand({ command: 'unconfigured' });
  assert.equal(menuOpen, false);
  assert.equal(startButtonClicks, 0);
  receiveCommand({ command: 'start' });
  assert.equal(menuOpen, true);
  receiveFocus({ class: 'com.mitchellh.ghostty', title: 'terminal' });
  assert.equal(menuOpen, true);
  receiveCommand({ command: 'start' });
  assert.equal(menuOpen, false);
  receiveFocus({ class: 'com.mitchellh.ghostty', title: 'terminal' });
  assert.equal(menuOpen, false);
  receiveCommand({ command: 'start' });
  assert.equal(menuOpen, true);
  receiveFocus({ class: 'com.mitchellh.ghostty', title: 'terminal' });
  assert.equal(menuOpen, true);

  assert.deepEqual(
    inputDebug
      .filter(record => record.event === 'start-command-received')
      .map(record => record.commandId),
    [1, 2, 3],
  );
  assert.equal(inputDebug.filter(record => record.event === 'start-click-before').length, 3);

  receiveFocus({ class: 'org.mozilla.firefox', title: 'Browser' });
  assert.equal(menuOpen, false);
  receiveCommand({ command: 'start' });
  receiveFocus({ class: 'org.mozilla.firefox', title: 'Another browser window' });
  assert.equal(menuOpen, false);

  window.XPShellSync.authority = false;
  menuOpen = true;
  receiveCommand({ command: 'start' });
  assert.equal(menuOpen, true);
  assert.equal(startButtonClicks, 4);
});
