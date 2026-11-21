const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

class FakeClassList {
  constructor(classes = []) {
    this.classes = new Set(classes);
  }

  contains(className) {
    return this.classes.has(className);
  }
}

class FakeElement {
  constructor({ classes = [], parent = null, dataset = {}, id = '', top = 0, height = 30 } = {}) {
    this.classList = new FakeClassList(classes);
    this.parentElement = parent;
    this.dataset = dataset;
    this.id = id;
    this.attributes = {};
    this.top = top;
    this.height = height;
    this.focused = false;
    this.clicks = 0;
    this.hidden = false;
  }

  closest(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    for (let element = this; element; element = element.parentElement) {
      for (const part of selectors) {
        if (part === '.menu-left' && element.classList.contains('menu-left')) return element;
        if (part === '.menu-right' && element.classList.contains('menu-right')) return element;
        if (part === 'footer' && element.classList.contains('footer')) return element;
        if (part === '.footer-item' && element.classList.contains('footer-item')) return element;
        if (
          part === '.menu-item[data-app]' &&
          element.classList.contains('menu-item') &&
          element.dataset.app
        ) {
          return element;
        }
        if (part === '.programs-menu' && element.classList.contains('programs-menu')) return element;
        if (part === '.program-submenu' && element.classList.contains('program-submenu')) return element;
        if (part === '[hidden]' && element.hidden) return element;
      }
    }
    return null;
  }

  matches(selector) {
    return selector.split(',').some(part => {
      const value = part.trim();
      if (value === '.menu-item[data-app]') {
        return this.classList.contains('menu-item') && Boolean(this.dataset.app);
      }
      if (value === '.footer-item') return this.classList.contains('footer-item');
      if (value === '#all-programs-trigger') return this.id === 'all-programs-trigger';
      if (value === '[data-start-menu-flyout-trigger]') return this.flyoutTrigger;
      return false;
    });
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  focus() {
    this.focused = true;
  }

  click() {
    this.clicks += 1;
  }

  getBoundingClientRect() {
    return { top: this.top, height: this.height };
  }
}

class FakeMenu extends FakeElement {
  constructor(items, actions, left, right) {
    super();
    this.items = items;
    this.actions = actions;
    this.left = left;
    this.right = right;
  }

  querySelectorAll(selector) {
    if (selector === '.menu-item[data-app], .footer-item') return this.actions;
    return this.items;
  }

  querySelector(selector) {
    if (selector === '.menu-left') return this.left;
    if (selector === '.menu-right') return this.right;
    return null;
  }
}

function loadKeyboard() {
  const window = {};
  const context = vm.createContext({ window });
  vm.runInContext(
    readFileSync(require.resolve('../js/start-menu-keyboard.js'), 'utf8'),
    context,
  );
  return window.XPStartMenuKeyboard;
}

function keydown(target, key) {
  return {
    target,
    key,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
}

test('ArrowDown enters the first start-menu program and navigates within its column', () => {
  const left = new FakeElement({ classes: ['menu-left'] });
  const right = new FakeElement({ classes: ['menu-right'] });
  const first = new FakeElement({ classes: ['menu-item'], parent: left, dataset: { app: 'internet' } });
  const second = new FakeElement({ classes: ['menu-item'], parent: left, dataset: { app: 'email' }, top: 40 });
  const allPrograms = new FakeElement({ parent: left, top: 400 });
  const rightItem = new FakeElement({ classes: ['menu-item'], parent: right, dataset: { app: 'mydocs' }, top: 42 });
  const startMenu = new FakeMenu(
    [first, second, allPrograms, rightItem],
    [first, second, rightItem],
    left,
    right,
  );
  const keyboard = loadKeyboard();
  keyboard.init(startMenu, true);

  const enterMenu = keydown(startMenu, 'ArrowDown');
  assert.equal(keyboard.handleKeydown(enterMenu), true);
  assert.equal(first.focused, true);

  const nextItem = keydown(first, 'ArrowDown');
  assert.equal(keyboard.handleKeydown(nextItem), true);
  assert.equal(second.focused, true);
  assert.equal(nextItem.prevented, true);
});

test('horizontal arrows move between menu columns and Enter activates the focused app', () => {
  const left = new FakeElement({ classes: ['menu-left'] });
  const right = new FakeElement({ classes: ['menu-right'] });
  const leftItem = new FakeElement({ classes: ['menu-item'], parent: left, dataset: { app: 'email' }, top: 40 });
  const rightItem = new FakeElement({ classes: ['menu-item'], parent: right, dataset: { app: 'mydocs' }, top: 42 });
  const farRightItem = new FakeElement({ classes: ['menu-item'], parent: right, dataset: { app: 'run' }, top: 140 });
  const startMenu = new FakeMenu(
    [leftItem, rightItem, farRightItem],
    [leftItem, rightItem, farRightItem],
    left,
    right,
  );
  const keyboard = loadKeyboard();
  keyboard.init(startMenu, true);

  assert.equal(keyboard.handleKeydown(keydown(leftItem, 'ArrowRight')), true);
  assert.equal(rightItem.focused, true);
  assert.equal(keyboard.handleKeydown(keydown(rightItem, 'Enter')), true);
  assert.equal(rightItem.clicks, 1);
});

test('non-AXTML menus do not gain keyboard navigation behavior', () => {
  const left = new FakeElement({ classes: ['menu-left'] });
  const app = new FakeElement({ classes: ['menu-item'], parent: left, dataset: { app: 'internet' } });
  const startMenu = new FakeMenu([app], [app], left, new FakeElement({ classes: ['menu-right'] }));
  const keyboard = loadKeyboard();
  keyboard.init(startMenu, false);

  assert.equal(app.tabIndex, undefined);
  assert.equal(keyboard.handleKeydown(keydown(startMenu, 'ArrowDown')), false);
  assert.equal(app.focused, false);
});
