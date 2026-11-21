const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...values) {
    values.forEach(value => this.values.add(value));
  }

  remove(...values) {
    values.forEach(value => this.values.delete(value));
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.document = document;
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.listeners = new Map();
    this.style = {};
    this.classList = new FakeClassList();
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.isConnected = false;
  }

  set className(value) {
    this._className = value;
    this.classList.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }

  get className() {
    return this._className;
  }

  append(...children) {
    children.forEach(child => this.appendChild(child));
  }

  appendChild(child) {
    child.parentElement = this;
    child.setConnected(this.isConnected);
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children.forEach(child => child.setConnected(false));
    this.children = [];
    children.forEach(child => this.appendChild(child));
  }

  setConnected(connected) {
    this.isConnected = connected;
    this.children.forEach(child => child.setConnected(connected));
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  contains(target) {
    return target === this || this.children.some(child => child.contains(target));
  }

  matches(selector) {
    if (selector === '[role="menu"]') return this.attributes.role === 'menu';
    if (selector.includes('.xp-context-menu__item')) {
      if (!this.classList.contains('xp-context-menu__item')) return false;
      if (selector.includes(':not(:disabled)') && this.disabled) return false;
      if (selector.includes('[aria-expanded="true"]')) {
        return this.attributes['aria-expanded'] === 'true';
      }
      return true;
    }
    if (selector === '.xp-context-menu__entry') {
      return this.classList.contains('xp-context-menu__entry');
    }
    if (selector === '.xp-context-menu__submenu') {
      return this.classList.contains('xp-context-menu__submenu');
    }
    return false;
  }

  querySelectorAll(selector) {
    const direct = selector.startsWith(':scope > ');
    const targetSelector = direct ? selector.slice(9) : selector;
    const roots = direct ? this.children : this.children.flatMap(child => [child, ...child.descendants()]);
    return roots.filter(element => element.matches(targetSelector));
  }

  descendants() {
    return this.children.flatMap(child => [child, ...child.descendants()]);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    for (let element = this; element; element = element.parentElement) {
      if (element.matches(selector)) return element;
    }
    return null;
  }

  focus() {
    this.document.activeElement = this;
  }

  getBoundingClientRect() {
    const width = this.classList.contains('xp-context-menu__submenu') ? 130 : 140;
    const height = Math.max(24, this.children.length * 24 + 4);
    return { left: 10, top: 10, right: 10 + width, bottom: 10 + height, width, height };
  }
}

function loadContextMenu() {
  const document = {
    listeners: new Map(),
    body: null,
    activeElement: null,
    elements: new Map(),
    createElement(tagName) {
      return new FakeElement(tagName, this);
    },
    getElementById(id) {
      return this.elements.get(id) || null;
    },
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
  };
  document.body = document.createElement('body');
  document.body.setConnected(true);
  const shield = document.createElement('div');
  shield.style.display = 'none';
  document.elements.set('menu-shield', shield);
  const startMenu = document.createElement('div');
  startMenu.style.display = 'none';
  document.elements.set('start-menu', startMenu);
  const window = {
    innerWidth: 640,
    innerHeight: 480,
    addEventListener() {},
  };
  const context = vm.createContext({ document, window });
  vm.runInContext(readFileSync(require.resolve('../js/context-menu.js'), 'utf8'), context);
  return { menu: window.XPContextMenu, document, shield, startMenu };
}

test('context menu supports bold actions, submenus and selection callbacks', () => {
  const { menu, document } = loadContextMenu();
  const trigger = document.createElement('button');
  trigger.setConnected(true);
  const selections = [];
  let closeCount = 0;

  const element = menu.open({
    x: 100,
    y: 80,
    trigger,
    items: [
      { label: 'Open', bold: true },
      { label: 'More', children: [{ label: 'Nested' }] },
    ],
    onSelect: item => selections.push(item.label),
    onClose: () => { closeCount += 1; },
  });

  const openButton = element.children[0].children[0];
  const moreButton = element.children[1].children[0];
  const submenu = element.children[1].children[1];
  assert.equal(element.hidden, false);
  assert.equal(openButton.classList.contains('is-bold'), true);
  assert.equal(document.activeElement, openButton);

  moreButton.listeners.get('mouseenter')();
  assert.equal(submenu.hidden, false);
  const nestedButton = submenu.children[0].children[0];
  nestedButton.listeners.get('click')({ preventDefault() {} });

  assert.equal(element.hidden, true);
  assert.deepEqual(selections, ['Nested']);
  assert.equal(closeCount, 1);
});

test('outside clicks dismiss the context menu and the shared shield respects Start Menu state', () => {
  const { menu, document, shield, startMenu } = loadContextMenu();
  const trigger = document.createElement('button');
  trigger.setConnected(true);
  const outside = document.createElement('div');
  document.body.appendChild(outside);

  const element = menu.open({ x: 100, y: 80, trigger, items: [{ label: 'Open' }] });
  assert.equal(shield.style.display, 'block');
  document.listeners.get('pointerdown')({ target: outside });
  assert.equal(element.hidden, true);
  assert.equal(shield.style.display, 'none');

  startMenu.style.display = 'flex';
  menu.open({ x: 100, y: 80, trigger, items: [{ label: 'Open' }] });
  menu.close();
  assert.equal(shield.style.display, 'block');
  startMenu.style.display = 'none';
  menu.syncShield();
  assert.equal(shield.style.display, 'none');
});
