const XPContextMenu = {
  element: null,
  trigger: null,
  resolveIcon: null,
  onSelect: null,
  onClose: null,
  initialized: false,

  init() {
    if (this.initialized) return this.element;
    this.initialized = true;
    this.element = document.createElement('div');
    this.element.className = 'xp-context-menu ax-top';
    this.element.setAttribute('role', 'menu');
    this.element.hidden = true;
    this.element.addEventListener('click', event => event.stopPropagation());
    this.element.addEventListener('keydown', event => this.handleKeydown(event));
    document.body.appendChild(this.element);
    document.addEventListener('pointerdown', event => {
      if (!this.element.hidden && !this.element.contains(event.target)) this.close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !this.element.hidden) {
        event.preventDefault();
        this.close(true);
      }
    });
    window.addEventListener('blur', () => this.close());
    this.syncShield();
    return this.element;
  },

  open({ x, y, items = [], trigger = null, resolveIcon = null, onSelect = null, onClose = null }) {
    const element = this.init();
    this.close();
    this.trigger = trigger;
    this.resolveIcon = resolveIcon;
    this.onSelect = onSelect;
    this.onClose = onClose;
    element.replaceChildren();
    this.renderItems(items, element);
    element.hidden = false;
    const pointX = Math.round(Number(x) || 0);
    const pointY = Math.round(Number(y) || 0);
    element.style.left = `${pointX}px`;
    element.style.top = `${pointY}px`;
    const rect = element.getBoundingClientRect();
    element.style.left = `${Math.max(4, Math.min(pointX, window.innerWidth - rect.width - 4))}px`;
    element.style.top = `${Math.max(4, Math.min(pointY, window.innerHeight - rect.height - 4))}px`;
    this.syncShield();
    element.querySelector('.xp-context-menu__item:not(:disabled)')?.focus();
    return element;
  },

  syncShield() {
    const shield = document.getElementById('menu-shield');
    if (!shield) return;
    const startMenu = document.getElementById('start-menu');
    const startMenuOpen = Boolean(startMenu && startMenu.style.display !== 'none');
    const contextMenuOpen = Boolean(this.element && !this.element.hidden);
    shield.style.display = startMenuOpen || contextMenuOpen ? 'block' : 'none';
  },

  renderItems(items, container) {
    for (const item of items) {
      if (String(item?.type || '').toLowerCase() === 'separator') {
        const separator = document.createElement('div');
        separator.className = 'xp-context-menu__separator';
        separator.setAttribute('role', 'separator');
        container.appendChild(separator);
        continue;
      }

      const entry = document.createElement('div');
      entry.className = 'xp-context-menu__entry';
      const button = document.createElement('button');
      button.className = 'xp-context-menu__item';
      button.type = 'button';
      button.disabled = item.enabled === false;
      if (item.bold === true) button.classList.add('is-bold');
      const children = Array.isArray(item.children) ? item.children : [];
      const toggleType = String(item.toggleType || '').toLowerCase();
      button.setAttribute(
        'role',
        toggleType === 'checkmark'
          ? 'menuitemcheckbox'
          : toggleType === 'radio'
            ? 'menuitemradio'
            : 'menuitem',
      );
      if (toggleType === 'checkmark' || toggleType === 'radio') {
        button.setAttribute('aria-checked', String(Number(item.toggleState) > 0));
      }

      const icon = document.createElement('span');
      icon.className = 'xp-context-menu__icon';
      if (Number(item.toggleState) > 0 && toggleType) {
        icon.classList.add('is-check');
        icon.textContent = toggleType === 'radio' ? '●' : '✓';
      } else if (item.iconData || item.iconName) {
        const image = document.createElement('img');
        image.alt = '';
        if (String(item.iconData || '').startsWith('data:image/')) {
          image.src = item.iconData;
        } else if (item.iconName && this.resolveIcon) {
          this.resolveIcon(item.iconName).then(source => {
            if (image.isConnected && source) image.src = source;
          }).catch(() => {});
        }
        icon.appendChild(image);
      }
      const label = document.createElement('span');
      label.className = 'xp-context-menu__label';
      label.textContent = String(item.label || '');
      button.append(icon, label);

      let submenu = null;
      if (children.length) {
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        const arrow = document.createElement('span');
        arrow.className = 'xp-context-menu__arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '▶';
        button.appendChild(arrow);
        submenu = document.createElement('div');
        submenu.className = 'xp-context-menu__submenu';
        submenu.setAttribute('role', 'menu');
        submenu.hidden = true;
        this.renderItems(children, submenu);
      }

      button.addEventListener('mouseenter', () => {
        this.closeSiblingSubmenus(entry);
        if (submenu) this.openSubmenu(button, submenu);
      });
      button.addEventListener('focus', () => this.closeSiblingSubmenus(entry));
      button.addEventListener('click', event => {
        event.preventDefault();
        if (children.length) {
          if (submenu.hidden) this.openSubmenu(button, submenu);
          else this.closeSubmenu(button, submenu);
          return;
        }
        const onSelect = this.onSelect;
        this.close();
        onSelect?.(item);
      });

      entry.appendChild(button);
      if (submenu) entry.appendChild(submenu);
      container.appendChild(entry);
    }
  },

  closeSiblingSubmenus(entry) {
    const parent = entry.parentElement;
    for (const sibling of parent?.querySelectorAll(':scope > .xp-context-menu__entry') || []) {
      if (sibling === entry) continue;
      const button = sibling.querySelector(':scope > .xp-context-menu__item');
      const submenu = sibling.querySelector(':scope > .xp-context-menu__submenu');
      if (button && submenu) this.closeSubmenu(button, submenu);
    }
  },

  openSubmenu(button, submenu) {
    submenu.hidden = false;
    button.classList.add('is-submenu-open');
    button.setAttribute('aria-expanded', 'true');
    submenu.classList.remove('opens-left', 'opens-up');
    const rect = submenu.getBoundingClientRect();
    const parentRect = button.getBoundingClientRect();
    if (rect.right > window.innerWidth - 4 && parentRect.left - rect.width >= 4) {
      submenu.classList.add('opens-left');
    }
    if (rect.bottom > window.innerHeight - 4 && parentRect.bottom - rect.height >= 4) {
      submenu.classList.add('opens-up');
    }
  },

  closeSubmenu(button, submenu) {
    submenu.hidden = true;
    button.classList.remove('is-submenu-open');
    button.setAttribute('aria-expanded', 'false');
    for (const childButton of submenu.querySelectorAll(
      '.xp-context-menu__item[aria-expanded="true"]',
    )) {
      childButton.setAttribute('aria-expanded', 'false');
      childButton.classList.remove('is-submenu-open');
    }
    for (const childMenu of submenu.querySelectorAll('.xp-context-menu__submenu')) {
      childMenu.hidden = true;
    }
  },

  handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      return;
    }
    const menu = event.target.closest?.('[role="menu"]');
    if (!menu) return;
    const buttons = Array.from(menu.children)
      .map(entry => entry.querySelector?.(':scope > .xp-context-menu__item'))
      .filter(button => button && !button.disabled);
    const index = buttons.indexOf(event.target.closest('.xp-context-menu__item'));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!buttons.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + direction + buttons.length) % buttons.length].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? buttons[0] : buttons.at(-1))?.focus();
    } else if (event.key === 'ArrowRight') {
      const button = event.target.closest('.xp-context-menu__item');
      const submenu = button?.parentElement?.querySelector(
        ':scope > .xp-context-menu__submenu',
      );
      if (!submenu) return;
      event.preventDefault();
      this.openSubmenu(button, submenu);
      submenu.querySelector('.xp-context-menu__item:not(:disabled)')?.focus();
    } else if (event.key === 'ArrowLeft' && menu !== this.element) {
      event.preventDefault();
      const entry = menu.parentElement;
      const button = entry?.querySelector(':scope > .xp-context-menu__item');
      const submenu = entry?.querySelector(':scope > .xp-context-menu__submenu');
      if (button && submenu) {
        this.closeSubmenu(button, submenu);
        button.focus();
      }
    }
  },

  close(restoreFocus = false) {
    if (!this.element) return;
    this.element.hidden = true;
    this.element.replaceChildren();
    this.syncShield();
    const trigger = this.trigger;
    const onClose = this.onClose;
    this.trigger = null;
    this.resolveIcon = null;
    this.onSelect = null;
    this.onClose = null;
    if (restoreFocus && trigger?.isConnected) trigger.focus();
    onClose?.();
  },
};

window.XPContextMenu = XPContextMenu;
