const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function setup() {
  const nodes = [];
  const windows = new Map();
  const instances = [];
  const createElement = () => ({
    style: {},
    classList: new Set(),
    remove() { nodes.splice(nodes.indexOf(this), 1); },
  });
  const document = {
    createElement,
    body: { appendChild(node) { nodes.push(node); } },
    getElementById: (id) => nodes.find((node) => node.id === id) || null,
  };
  const manager = {
    nextId: 1,
    createWindow(options) {
      const id = this.nextId++;
      const element = createElement();
      element.id = `window-${id}`;
      document.body.appendChild(element);
      windows.set(id, { ...options, element });
      return id;
    },
    closeWindow(id) {
      const win = windows.get(id);
      if (!win) return;
      win.element.remove();
      windows.delete(id);
    },
    restoreWindow(id) { windows.get(id)?.onRestore(); },
    focusWindow() {},
    minimizeWindow() {},
  };
  class Webamp {
    constructor() { instances.push(this); this.reopenCount = 0; }
    async renderWhenReady() {
      this.root = createElement();
      this.root.id = 'webamp';
      document.body.appendChild(this.root);
    }
    onClose(callback) { this.closeCallback = callback; }
    onWillClose() {}
    onMinimize(callback) { this.minimizeCallback = callback; }
    close() { this.closed = true; this.closeCallback(); }
    reopen() { this.closed = false; this.reopenCount++; }
  }
  const context = vm.createContext({ document, window: {}, console, XPWindowManager: manager });
  vm.runInContext(readFileSync(require.resolve('../js/apps.js'), 'utf8'), context);
  const apps = context.window.XPApps;
  apps.getWebampConstructor = async () => Webamp;
  apps.getWebampTracks = async () => [];
  return { apps, document, windows, instances, manager, nodes };
}

test('the actual body portal gets the top-layer class', async () => {
  const { apps, document } = setup();
  await apps.createWinamp();
  assert(document.getElementById('webamp').classList.has('ax-top'));
});

test('closing and reopening reuses one instance and one portal', async () => {
  const { apps, nodes, windows, instances } = setup();
  await apps.createWinamp();
  const instance = apps.webampInstance;
  for (let i = 0; i < 3; i++) {
    instance.close();
    assert.equal(windows.size, 0);
    assert.equal(apps.webampWindowId, null);
    await apps.createWinamp();
    assert.equal(apps.webampInstance, instance);
    assert.equal(windows.size, 1);
    assert.equal(nodes.filter((node) => node.id === 'webamp').length, 1);
    assert.equal(instance.closed, false);
  }
  assert.equal(instances.length, 1);
  assert.equal(instance.reopenCount, 3);
});

test('closing through the shell also closes and reuses the player', async () => {
  const { apps, windows, manager, instances } = setup();
  await apps.createWinamp();
  const id = apps.webampWindowId;
  const win = windows.get(id);
  manager.closeWindow(id);
  win.onClose();
  assert.equal(apps.webampInstance.closed, true);
  assert.equal(apps.webampWindowId, null);
  await apps.createWinamp();
  assert.equal(instances.length, 1);
  assert.equal(apps.webampInstance.closed, false);
  assert.notEqual(apps.webampWindowId, id);
});

test('minimizing and restoring does not create another player', async () => {
  const { apps, windows, instances } = setup();
  await apps.createWinamp();
  const id = apps.webampWindowId;
  windows.get(id).onMinimize();
  assert.equal(apps.webampInstance.root.style.display, 'none');
  await apps.createWinamp();
  assert.equal(apps.webampWindowId, id);
  assert.equal(instances.length, 1);
  assert.equal(apps.webampInstance.root.style.display, '');
});
