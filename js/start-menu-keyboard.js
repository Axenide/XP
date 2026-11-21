const XPStartMenuKeyboard = {
  startMenu: null,
  enabled: false,

  init(startMenu, enabled) {
    if (!enabled || !startMenu) return;
    this.startMenu = startMenu;
    this.enabled = true;
    for (const item of startMenu.querySelectorAll('.menu-item[data-app], .footer-item')) {
      if (item.closest('.programs-menu, .program-submenu')) continue;
      item.tabIndex = 0;
      item.setAttribute(
        'role',
        item.classList.contains('footer-item') ? 'button' : 'menuitem',
      );
    }
  },

  navigationItems() {
    if (!this.enabled || !this.startMenu) return [];
    return Array.from(
      this.startMenu.querySelectorAll(
        '.menu-item[data-app], #all-programs-trigger, [data-start-menu-flyout-trigger], .footer-item',
      ),
    ).filter(item => !item.closest('.programs-menu, .program-submenu, [hidden]'));
  },

  itemsInColumn(column) {
    const selector =
      column?.classList.contains('menu-left') || column?.classList.contains('menu-right')
        ? '.menu-left, .menu-right'
        : 'footer';
    return this.navigationItems().filter(
      item => item.closest(selector) === column,
    );
  },

  focusItem(item) {
    item?.focus({ preventScroll: true });
    return Boolean(item);
  },

  moveVertically(item, key) {
    const column = item.closest('.menu-left, .menu-right') || item.closest('footer');
    if (!column) return false;
    const items = this.itemsInColumn(column);
    const index = items.indexOf(item);
    if (index < 0 || !items.length) return false;
    const step = key === 'ArrowDown' || key === 'End' ? 1 : -1;
    const nextIndex =
      key === 'Home'
        ? 0
        : key === 'End'
          ? items.length - 1
          : (index + step + items.length) % items.length;
    return this.focusItem(items[nextIndex]);
  },

  moveAcrossColumns(item, key) {
    const currentColumn = item.closest('.menu-left, .menu-right');
    if (!currentColumn) {
      const footer = item.closest('footer');
      if (!footer) return false;
      const items = this.itemsInColumn(footer);
      const index = items.indexOf(item);
      if (index < 0 || !items.length) return false;
      const step = key === 'ArrowRight' ? 1 : -1;
      return this.focusItem(items[(index + step + items.length) % items.length]);
    }
    const currentIsLeft = currentColumn.classList.contains('menu-left');
    if (
      (key === 'ArrowRight' && !currentIsLeft) ||
      (key === 'ArrowLeft' && currentIsLeft)
    ) {
      return false;
    }
    const targetColumn = this.startMenu.querySelector(
      currentIsLeft ? '.menu-right' : '.menu-left',
    );
    const items = this.itemsInColumn(targetColumn);
    if (!items.length) return false;
    const currentRect = item.getBoundingClientRect();
    const currentCenter = currentRect.top + currentRect.height / 2;
    const target = items.reduce((closest, candidate) => {
      const rect = candidate.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - currentCenter);
      return !closest || distance < closest.distance ? { item: candidate, distance } : closest;
    }, null);
    return this.focusItem(target?.item);
  },

  handleKeydown(event) {
    if (!this.enabled || !this.startMenu) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.target === this.startMenu) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        return this.focusItem(this.itemsInColumn(this.startMenu.querySelector('.menu-left'))[0]);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        return this.focusItem(this.navigationItems().at(-1));
      }
      return false;
    }

    const item = event.target.closest?.(
      '.menu-item[data-app], .footer-item, #all-programs-trigger, [data-start-menu-flyout-trigger]',
    );
    if (!item || item.closest('.programs-menu, .program-submenu')) return false;
    const isAction = item.matches('.menu-item[data-app], .footer-item');
    const isSubmenuTrigger = item.matches(
      '#all-programs-trigger, [data-start-menu-flyout-trigger]',
    );
    if (isAction && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      item.click();
      return true;
    }
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      event.preventDefault();
      return this.moveVertically(item, event.key);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (event.key === 'ArrowRight' && isSubmenuTrigger) return false;
      const moved = this.moveAcrossColumns(item, event.key);
      if (moved) event.preventDefault();
      return moved;
    }
    return false;
  },
};

window.XPStartMenuKeyboard = XPStartMenuKeyboard;
