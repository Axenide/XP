const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function setup(savedLayout) {
  const storage = new Map();
  const contextMenuCalls = [];
  if (savedLayout) storage.set('xp.axctl.tray.layout', JSON.stringify(savedLayout));
  const window = {
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
    XPContextMenu: {
      init() { return {}; },
      open(options) {
        contextMenuCalls.push(options);
        return {};
      },
      close() {},
    },
  };
  const context = vm.createContext({ document: {}, window, Map, Set, setTimeout });
  vm.runInContext(readFileSync(require.resolve('../js/axctl-tray.js'), 'utf8'), context);
  const tray = window.XPAxctlTray;
  tray.render = () => {};
  return { tray, storage, window, contextMenuCalls };
}

test('saved hidden icons stay hidden while newly discovered items start visible', () => {
  const { tray, storage } = setup({ visible: ['shown'], hidden: ['hidden'] });
  tray.readLayout();
  tray.setItems([{ id: 'shown' }, { id: 'hidden' }, { id: 'new' }]);

  assert.deepEqual(JSON.parse(JSON.stringify(tray.zoneItems('visible'))), ['shown', 'new']);
  assert.deepEqual(JSON.parse(JSON.stringify(tray.zoneItems('hidden'))), ['hidden']);
  assert.deepEqual(
    JSON.parse(storage.get('xp.axctl.tray.layout')),
    { visible: ['shown', 'new'], hidden: ['hidden'] },
  );
});

test('dragging an icon between zones and within a zone persists its order', () => {
  const { tray, storage } = setup();
  tray.items = new Map([['first', {}], ['second', {}], ['third', {}]]);
  tray.visibleOrder = ['first', 'second', 'third'];

  tray.moveItem('third', 'visible', 0);
  tray.moveItem('second', 'hidden', 0);

  assert.deepEqual(JSON.parse(JSON.stringify(tray.visibleOrder)), ['third', 'first']);
  assert.deepEqual(JSON.parse(JSON.stringify(tray.hiddenOrder)), ['second']);
  assert.deepEqual(
    JSON.parse(storage.get('xp.axctl.tray.layout')),
    { visible: ['third', 'first'], hidden: ['second'] },
  );
});

test('overflow width fits the hidden icon count without an empty minimum', () => {
  const { tray } = setup();
  const widths = new Map();
  const classes = new Set(['tray-expanded']);
  const overflowAttributes = new Map();
  const buttonAttributes = new Map();
  tray.taskbarRight = {
    classList: {
      contains(name) { return classes.has(name); },
      remove(name) { classes.delete(name); },
    },
    style: {
      setProperty(name, value) { widths.set(name, value); },
    },
  };
  tray.overflow = {
    inert: false,
    setAttribute(name, value) { overflowAttributes.set(name, value); },
  };
  tray.expandButton = {
    title: '',
    setAttribute(name, value) { buttonAttributes.set(name, value); },
  };
  tray.items = new Map([['visible', {}], ['hidden-a', {}], ['hidden-b', {}]]);
  tray.visibleOrder = ['visible'];
  tray.hiddenOrder = [];

  tray.updateOverflowWidth();
  assert.equal(widths.get('--tray-overflow-width'), '0px');
  assert.equal(classes.has('tray-expanded'), false);
  assert.equal(overflowAttributes.get('aria-hidden'), 'true');
  assert.equal(tray.overflow.inert, true);
  assert.equal(buttonAttributes.get('aria-expanded'), 'false');

  tray.hiddenOrder = ['hidden-a'];
  tray.updateOverflowWidth();
  assert.equal(widths.get('--tray-overflow-width'), '24px');

  tray.hiddenOrder = ['hidden-a', 'hidden-b'];
  tray.updateOverflowWidth();
  assert.equal(widths.get('--tray-overflow-width'), '42px');
});

test('expand button does not open an empty axctl overflow but remains a drag target', () => {
  const { tray } = setup();
  tray.taskbarRight = { classList: { contains: name => name === 'axctl-tray-mode' } };
  tray.items = new Map([['visible', {}]]);
  tray.visibleOrder = ['visible'];
  tray.hiddenOrder = [];
  let prevented = false;
  let stopped = false;
  const event = {
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; },
  };

  tray.handleExpandButtonClick(event);

  assert.equal(prevented, true);
  assert.equal(stopped, true);

  prevented = false;
  stopped = false;
  tray.hiddenOrder = ['hidden'];
  tray.items.set('hidden', {});
  tray.handleExpandButtonClick(event);

  assert.equal(prevented, false);
  assert.equal(stopped, false);
});

test('tray right-click keeps the native context menu entries', async () => {
  const { tray, contextMenuCalls } = setup();
  const requests = [];
  const trigger = { dataset: { trayId: 'example' } };
  const item = { id: 'example', menu: true };
  tray.items = new Map([[item.id, item]]);
  tray.taskbarRight = { querySelectorAll: () => [trigger] };
  tray.adapter = {
    resolveIcon: () => Promise.resolve('icon.png'),
    request(method, params) {
      requests.push([method, params]);
      if (method === 'Tray.Menu') {
        return Promise.resolve({
          items: [
            { id: 7, label: 'Open' },
            { id: 8, label: 'Preferences' },
          ],
        });
      }
      return Promise.resolve();
    },
  };
  let prevented = false;
  let stopped = false;

  tray.handleContextMenu(
    {
      clientX: 120,
      clientY: 80,
      preventDefault() { prevented = true; },
      stopPropagation() { stopped = true; },
    },
    item.id,
  );
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(contextMenuCalls.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(contextMenuCalls[0].items)),
    [
      { id: 7, label: 'Open' },
      { id: 8, label: 'Preferences' },
    ],
  );
  contextMenuCalls[0].onSelect(contextMenuCalls[0].items[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(requests)), [
    ['Tray.Menu', { id: 'example' }],
    ['Tray.MenuEvent', { id: 'example', menuId: 7, event: 'clicked' }],
  ]);
});

test('native tray menus also render through the reusable context menu', async () => {
  const { tray, contextMenuCalls } = setup();
  const requests = [];
  const item = { id: 'example', menu: true };
  tray.items = new Map([[item.id, item]]);
  tray.taskbarRight = {
    querySelectorAll: () => [{ dataset: { trayId: item.id } }],
  };
  tray.adapter = {
    fallbackIcon: 'fallback.png',
    resolveIcon: () => Promise.resolve('icon.png'),
    request(method, params) {
      requests.push([method, params]);
      if (method === 'Tray.Menu') {
        return Promise.resolve({ items: [{ id: 7, label: 'Open' }] });
      }
      return Promise.resolve();
    },
  };

  await tray.openItemMenu(item, 44, 55);

  assert.equal(contextMenuCalls.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(contextMenuCalls[0].items)),
    [{ id: 7, label: 'Open' }],
  );
  contextMenuCalls[0].onSelect(contextMenuCalls[0].items[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(requests)), [
    ['Tray.Menu', { id: 'example' }],
    ['Tray.MenuEvent', { id: 'example', menuId: 7, event: 'clicked' }],
  ]);
});

test('pointer movement starts a drag and commits its drop target without native drag events', () => {
  const { tray } = setup();
  const classes = new Set();
  const button = {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
    },
  };
  const taskbarClasses = new Set();
  tray.taskbarRight = {
    classList: {
      add(name) { taskbarClasses.add(name); },
      remove(name) { taskbarClasses.delete(name); },
    },
  };
  tray.items = new Map([['icon', {}]]);
  tray.visibleOrder = ['icon'];
  tray.createDragPreview = () => {};
  tray.moveDragPreview = () => {};
  tray.removeDragPreview = () => {};
  tray.pointerDrag = {
    id: 'icon',
    pointerId: 7,
    startX: 10,
    startY: 10,
    button,
    started: false,
  };
  tray.updatePointerDropTarget = () => {
    tray.dropTarget = { zone: 'hidden', index: 0, buttonTarget: false };
  };

  tray.handlePointerMove({
    pointerId: 7,
    clientX: 20,
    clientY: 10,
    preventDefault() {},
  });
  assert.equal(taskbarClasses.has('tray-dragging'), true);
  tray.handlePointerUp({ pointerId: 7, clientX: 20, clientY: 10 });

  assert.equal(tray.draggingId, '');
  assert.equal(taskbarClasses.has('tray-dragging'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(tray.visibleOrder)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(tray.hiddenOrder)), ['icon']);
  assert.equal(classes.has('is-dragging'), false);
});

test('pointer coordinates resolve the chevron, overflow, and visible tray regions', () => {
  const { tray } = setup();
  const box = (left, right) => ({
    getBoundingClientRect() { return { left, right, top: 0, bottom: 30 }; },
  });
  tray.expandButton = box(0, 10);
  tray.overflow = { ...box(10, 40), inert: false };
  tray.overflowIcons = box(10, 40);
  tray.visibleIcons = box(40, 55);
  tray.fixedIcons = box(60, 90);
  tray.taskbarRight = box(0, 100);
  tray.zoneItems = zone => (zone === 'hidden' ? ['hidden'] : []);
  tray.insertionIndex = () => 1;
  tray.clearDropIndicator = () => { tray.dropTarget = null; };
  tray.setDropTarget = (zone, index, buttonTarget = false) => {
    tray.clearDropIndicator();
    tray.dropTarget = { zone, index, buttonTarget };
  };

  tray.updatePointerDropTarget({ clientX: 5, clientY: 15 });
  assert.deepEqual(tray.dropTarget, { zone: 'hidden', index: 1, buttonTarget: true });
  tray.updatePointerDropTarget({ clientX: 25, clientY: 15 });
  assert.deepEqual(tray.dropTarget, { zone: 'hidden', index: 1, buttonTarget: false });
  tray.updatePointerDropTarget({ clientX: 70, clientY: 15 });
  assert.deepEqual(tray.dropTarget, { zone: 'visible', index: 0, buttonTarget: false });
  tray.updatePointerDropTarget({ clientX: 57, clientY: 15 });
  assert.deepEqual(tray.dropTarget, { zone: 'visible', index: 0, buttonTarget: false });
});

test('canvas-space pointer Y is converted to the tray wrapper local coordinate', () => {
  const { tray, window } = setup();
  window.innerHeight = 1080;
  tray.taskbarRight = { closest: () => ({ offsetTop: 2160 }) };

  assert.deepEqual(
    JSON.parse(JSON.stringify(tray.localPointerPoint({ clientX: 40, clientY: 3223 }))),
    { x: 40, y: 1063 },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tray.localPointerPoint({ clientX: 40, clientY: 1063 }))),
    { x: 40, y: 1063 },
  );
});
