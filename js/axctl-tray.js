const XPAxctlTray = {
  layoutKey: 'xp.axctl.tray.layout',
  adapter: null,
  initialized: false,
  taskbarRight: null,
  expandButton: null,
  overflow: null,
  overflowIcons: null,
  visibleIcons: null,
  fixedIcons: null,
  menuTrigger: null,
  items: new Map(),
  visibleOrder: [],
  hiddenOrder: [],
  imageCache: new Map(),
  draggingId: '',
  pointerDrag: null,
  dragPreview: null,
  dropTarget: null,
  dropIndicator: null,
  refreshPending: false,
  suppressButtonClick: false,
  suppressedIconId: '',
  menuGeneration: 0,

  init(adapter) {
    if (this.initialized) return;
    this.taskbarRight = document.querySelector('.taskbar-right');
    this.expandButton = document.getElementById('tray-expand-button');
    this.overflow = document.getElementById('tray-overflow');
    this.overflowIcons = document.getElementById('tray-overflow-icons');
    this.visibleIcons = document.getElementById('tray-visible-icons');
    this.fixedIcons = this.taskbarRight?.querySelector('.tray-icons');
    if (
      !this.taskbarRight ||
      !this.expandButton ||
      !this.overflow ||
      !this.overflowIcons ||
      !this.visibleIcons ||
      !this.fixedIcons
    ) {
      return;
    }

    this.adapter = adapter;
    this.initialized = true;
    this.readLayout();
    this.taskbarRight.classList.add('axctl-tray-mode');
    this.overflowIcons.replaceChildren();
    window.XPContextMenu?.init();
    document.addEventListener('pointermove', event => this.handlePointerMove(event), true);
    document.addEventListener('pointerup', event => this.handlePointerUp(event), true);
    document.addEventListener('pointercancel', event => this.handlePointerCancel(event), true);
    this.expandButton.addEventListener(
      'click',
      event => this.handleExpandButtonClick(event),
      true,
    );
    this.updateOverflowWidth();
  },

  handleExpandButtonClick(event) {
    const isAxctlTray = this.taskbarRight?.classList.contains('axctl-tray-mode');
    if (
      !this.suppressButtonClick &&
      (!isAxctlTray || this.zoneItems('hidden').length > 0)
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.suppressButtonClick = false;
  },

  readLayout() {
    let saved;
    try {
      saved = JSON.parse(window.localStorage.getItem(this.layoutKey) || '{}');
    } catch {
      saved = {};
    }
    const hidden = Array.isArray(saved?.hidden)
      ? saved.hidden.filter(id => typeof id === 'string')
      : [];
    const hiddenSet = new Set(hidden);
    this.hiddenOrder = [...hiddenSet];
    this.visibleOrder = Array.isArray(saved?.visible)
      ? [...new Set(saved.visible.filter(id => typeof id === 'string'))].filter(
          id => !hiddenSet.has(id),
        )
      : [];
  },

  saveLayout() {
    try {
      window.localStorage.setItem(
        this.layoutKey,
        JSON.stringify({ visible: this.visibleOrder, hidden: this.hiddenOrder }),
      );
    } catch {}
  },

  setItems(items) {
    if (!Array.isArray(items)) return;
    const nextItems = new Map();
    for (const item of items) {
      const id = String(item?.id || '');
      if (!id || nextItems.has(id)) continue;
      const normalized = { ...item, id };
      nextItems.set(id, normalized);
      if (!this.visibleOrder.includes(id) && !this.hiddenOrder.includes(id)) {
        this.visibleOrder.push(id);
      }
    }
    this.items = nextItems;
    this.saveLayout();
    if (this.draggingId) {
      this.refreshPending = true;
      return;
    }
    this.render();
  },

  removeItem(id) {
    const key = String(id || '');
    if (!key) return;
    this.items.delete(key);
    if (this.menuTrigger?.dataset.trayId === key) this.closeMenu();
    this.updateOverflowWidth();
    if (this.draggingId) {
      this.refreshPending = true;
      return;
    }
    this.render();
  },

  bindItemEvents(button, item) {
    button.addEventListener('click', event => {
      if (this.suppressedIconId === item.id) {
        this.suppressedIconId = '';
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (item.itemIsMenu) {
        this.openItemMenu(item, event.clientX, event.clientY);
      } else {
        this.adapter.request('Tray.Activate', {
          id: item.id,
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        }).catch(() => {});
      }
    });
    button.addEventListener('auxclick', event => {
      if (event.button !== 1) return;
      event.preventDefault();
      this.adapter.request('Tray.SecondaryActivate', {
        id: item.id,
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      }).catch(() => {});
    });
    button.addEventListener('contextmenu', event => this.handleContextMenu(event, item.id));
    button.addEventListener('wheel', event => {
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = Math.sign(horizontal ? event.deltaX : event.deltaY);
      if (!delta) return;
      event.preventDefault();
      this.adapter.request('Tray.Scroll', {
        id: item.id,
        delta,
        orientation: horizontal ? 'horizontal' : 'vertical',
      }).catch(() => {});
    });
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.pointerDrag) return;
      const point = this.localPointerPoint(event);
      this.pointerDrag = {
        id: item.id,
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        button,
        started: false,
      };
    });
  },

  localPointerPoint(event) {
    const rawY = event.clientY;
    const wrapper = this.taskbarRight?.closest?.('ax-wrapper');
    const bandOffset = Number(wrapper?.offsetTop) || 0;
    const bandHeight = Number(window.innerHeight) || 0;
    const y = bandOffset > 0 && bandHeight > 0 && rawY >= bandHeight
      ? rawY - bandOffset
      : rawY;
    return { x: event.clientX, y };
  },

  handlePointerMove(event) {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = this.localPointerPoint(event);
    if (!drag.started) {
      const distance = Math.hypot(point.x - drag.startX, point.y - drag.startY);
      if (distance < 5) return;
      drag.started = true;
      this.draggingId = drag.id;
      drag.button.classList.add('is-dragging');
      this.taskbarRight?.classList.add('tray-dragging');
      this.createDragPreview(drag, point);
    }
    event.preventDefault();
    this.moveDragPreview(point);
    this.updatePointerDropTarget(event);
  },

  createDragPreview(drag, event) {
    this.dragPreview = drag.button.cloneNode(true);
    this.dragPreview.className = 'tray-real-icon tray-drag-preview ax-top';
    this.dragPreview.setAttribute('aria-hidden', 'true');
    this.dragPreview.removeAttribute('aria-label');
    this.dragPreview.removeAttribute('title');
    document.body.appendChild(this.dragPreview);
    this.moveDragPreview(event);
  },

  moveDragPreview(event) {
    if (!this.dragPreview) return;
    this.dragPreview.style.left = `${event.x}px`;
    this.dragPreview.style.top = `${event.y}px`;
  },

  removeDragPreview() {
    this.dragPreview?.remove();
    this.dragPreview = null;
  },

  updatePointerDropTarget(event, preserveTarget = false) {
    const point = this.localPointerPoint(event);
    const { x, y } = point;
    const containsPoint = element => {
      const rect = element.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };
    if (containsPoint(this.expandButton)) {
      this.setDropTarget(
        'hidden',
        this.zoneItems('hidden').filter(id => id !== this.draggingId).length,
        true,
      );
      return;
    }
    if (!this.overflow.inert && containsPoint(this.overflow)) {
      this.setDropTarget(
        'hidden',
        this.insertionIndex(this.overflowIcons, event.clientX),
      );
      return;
    }
    if (containsPoint(this.visibleIcons)) {
      this.setDropTarget(
        'visible',
        this.insertionIndex(this.visibleIcons, event.clientX),
      );
      return;
    }
    if (containsPoint(this.fixedIcons)) {
      this.setDropTarget(
        'visible',
        this.zoneItems('visible').filter(id => id !== this.draggingId).length,
      );
      return;
    }
    const fixedRect = this.fixedIcons.getBoundingClientRect();
    const taskbarRect = this.taskbarRight.getBoundingClientRect();
    if (
      x >= taskbarRect.left &&
      x <= fixedRect.left &&
      y >= taskbarRect.top &&
      y <= taskbarRect.bottom
    ) {
      this.setDropTarget(
        'visible',
        this.zoneItems('visible').filter(id => id !== this.draggingId).length,
      );
      return;
    }
    if (!preserveTarget) this.clearDropIndicator();
  },

  handlePointerUp(event) {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = this.localPointerPoint(event);
    if (
      !drag.started &&
      Math.hypot(point.x - drag.startX, point.y - drag.startY) >= 5
    ) {
      this.handlePointerMove(event);
    }
    if (!drag.started) {
      this.pointerDrag = null;
      return;
    }
    this.updatePointerDropTarget(event, true);
    const target = this.dropTarget;
    drag.button.classList.remove('is-dragging');
    this.removeDragPreview();
    this.pointerDrag = null;
    this.draggingId = '';
    this.suppressedIconId = drag.id;
    setTimeout(() => {
      if (this.suppressedIconId === drag.id) this.suppressedIconId = '';
    }, 0);
    if (target && this.items.has(drag.id)) {
      this.moveItem(drag.id, target.zone, target.index);
      if (target.buttonTarget) {
        this.suppressButtonClick = true;
        setTimeout(() => {
          this.suppressButtonClick = false;
        }, 0);
      }
    }
    this.finishDrag();
  },

  handlePointerCancel(event) {
    const drag = this.pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.button.classList.remove('is-dragging');
    this.removeDragPreview();
    this.pointerDrag = null;
    this.finishDrag();
  },

  handleContextMenu(event, id) {
    event.preventDefault();
    event.stopPropagation();
    const item = this.items.get(String(id));
    if (item) this.openItemMenu(item, event.clientX, event.clientY);
  },

  render() {
    if (!this.initialized) return;
    this.visibleIcons.replaceChildren();
    this.overflowIcons.replaceChildren();
    for (const id of this.zoneItems('visible')) {
      this.visibleIcons.appendChild(this.createIconButton(this.items.get(id)));
    }
    for (const id of this.zoneItems('hidden')) {
      this.overflowIcons.appendChild(this.createIconButton(this.items.get(id)));
    }
    this.updateOverflowWidth();
  },

  createIconButton(item) {
    const button = document.createElement('button');
    button.className = 'tray-real-icon';
    button.type = 'button';
    button.dataset.trayId = item.id;
    const title = [item.toolTipTitle, item.toolTip, item.title]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join('\n');
    button.title = title;
    button.setAttribute('aria-label', title.split('\n').join(', ') || 'Notification icon');
    const image = document.createElement('img');
    image.alt = '';
    image.src = this.adapter.fallbackIcon;
    button.appendChild(image);
    if (item.overlayIcon) {
      const overlay = document.createElement('img');
      overlay.className = 'tray-real-icon-overlay';
      overlay.alt = '';
      button.appendChild(overlay);
      this.loadItemImage(item, true).then(src => {
        if (overlay.isConnected) overlay.src = src;
      });
    }
    this.bindItemEvents(button, item);
    this.loadItemImage(item, false).then(src => {
      if (image.isConnected) image.src = src;
    });
    return button;
  },

  loadItemImage(item, overlay) {
    const name = overlay ? item.overlayIcon : item.iconName;
    const path = overlay ? '' : item.iconPath;
    const key = `${path || ''}\n${name || ''}`;
    if (!this.imageCache.has(key)) {
      const source = path
        ? this.readIconPath(path)
        : name
          ? this.adapter.resolveIcon(name)
          : Promise.resolve(this.adapter.fallbackIcon);
      this.imageCache.set(
        key,
        Promise.resolve(source).catch(() => this.adapter.fallbackIcon),
      );
    }
    return this.imageCache.get(key);
  },

  async readIconPath(path) {
    const normalizedPath = String(path || '').trim();
    const extension = normalizedPath.split(/[?#]/)[0].split('.').pop().toLowerCase();
    const mime = {
      png: 'image/png',
      svg: 'image/svg+xml',
      xpm: 'image/x-xpixmap',
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    }[extension];
    if (!normalizedPath || !mime) return this.adapter.fallbackIcon;
    const result = await window.axtml.call('execRun', {
      cmd: ['cat', normalizedPath],
      timeoutMs: 3000,
      maxBytes: 1 << 20,
      binary: true,
    });
    if (
      result?.code !== 0 ||
      result?.base64 !== true ||
      result?.stdoutTruncated ||
      !result?.stdout
    ) {
      return this.adapter.fallbackIcon;
    }
    return `data:${mime};base64,${result.stdout}`;
  },

  zoneItems(zone) {
    const order = zone === 'hidden' ? this.hiddenOrder : this.visibleOrder;
    return order.filter(id => this.items.has(id));
  },

  insertionIndex(element, x, movingId = this.draggingId) {
    const buttons = Array.from(element.querySelectorAll('.tray-real-icon')).filter(
      button => button.dataset.trayId !== movingId,
    );
    for (let index = 0; index < buttons.length; index += 1) {
      const rect = buttons[index].getBoundingClientRect();
      if (x < rect.left + rect.width / 2) return index;
    }
    return buttons.length;
  },

  setDropTarget(zone, index, buttonTarget = false) {
    if (
      this.dropTarget?.zone === zone &&
      this.dropTarget?.index === index &&
      this.dropTarget?.buttonTarget === buttonTarget
    ) {
      return;
    }
    this.clearDropIndicator();
    this.dropTarget = { zone, index, buttonTarget };
    if (buttonTarget) {
      this.expandButton.classList.add('tray-drop-target');
      return;
    }
    const container = zone === 'hidden' ? this.overflowIcons : this.visibleIcons;
    const buttons = Array.from(container.querySelectorAll('.tray-real-icon')).filter(
      button => button.dataset.trayId !== this.draggingId,
    );
    this.dropIndicator = document.createElement('span');
    this.dropIndicator.className = 'tray-drop-indicator';
    this.dropIndicator.setAttribute('aria-hidden', 'true');
    container.insertBefore(this.dropIndicator, buttons[index] || null);
    container.classList.add('tray-drop-active');
  },

  clearDropIndicator() {
    this.dropIndicator?.remove();
    this.dropIndicator = null;
    this.visibleIcons?.classList.remove('tray-drop-active');
    this.overflowIcons?.classList.remove('tray-drop-active');
    this.expandButton?.classList.remove('tray-drop-target');
    this.dropTarget = null;
  },

  moveItem(id, zone, index) {
    const key = String(id || '');
    if (!this.items.has(key)) return;
    this.visibleOrder = this.visibleOrder.filter(itemId => itemId !== key);
    this.hiddenOrder = this.hiddenOrder.filter(itemId => itemId !== key);
    const target = zone === 'hidden' ? this.hiddenOrder : this.visibleOrder;
    const available = target.filter(itemId => this.items.has(itemId));
    const targetIndex = Math.max(0, Math.min(Number(index) || 0, available.length));
    if (targetIndex < available.length) {
      const beforeIndex = target.indexOf(available[targetIndex]);
      target.splice(beforeIndex, 0, key);
    } else {
      target.push(key);
    }
    this.saveLayout();
    this.render();
  },

  finishDrag() {
    this.clearDropIndicator();
    this.removeDragPreview();
    this.draggingId = '';
    this.taskbarRight?.classList.remove('tray-dragging');
    if (!this.refreshPending) return;
    this.refreshPending = false;
    this.render();
  },

  updateOverflowWidth() {
    if (!this.taskbarRight) return;
    const count = this.zoneItems('hidden').length;
    const width = count * 18 + (count > 0 ? 6 : 0);
    this.taskbarRight.style.setProperty('--tray-overflow-width', `${width}px`);
    if (!count && this.taskbarRight.classList.contains('tray-expanded')) {
      this.taskbarRight.classList.remove('tray-expanded');
      this.overflow.setAttribute('aria-hidden', 'true');
      this.overflow.inert = true;
      this.expandButton.setAttribute('aria-expanded', 'false');
      this.expandButton.setAttribute('aria-label', 'Show hidden notification icons');
      this.expandButton.title = 'Show hidden notification icons';
    }
  },

  async openItemMenu(item, x, y) {
    this.closeMenu();
    const generation = this.menuGeneration;
    let menu;
    if (item.menu) {
      try {
        menu = await this.adapter.request('Tray.Menu', { id: item.id });
      } catch {}
    }
    if (generation !== this.menuGeneration || !this.items.has(item.id)) return;
    if (!Array.isArray(menu?.items) || !menu.items.length) {
      this.adapter.request('Tray.ContextMenu', {
        id: item.id,
        x: Math.round(x),
        y: Math.round(y),
      }).catch(() => {});
      return;
    }
    this.menuTrigger = Array.from(
      this.taskbarRight.querySelectorAll('.tray-real-icon'),
    ).find(button => button.dataset.trayId === item.id);
    window.XPContextMenu?.open({
      x,
      y,
      trigger: this.menuTrigger,
      items: menu.items,
      resolveIcon: name => this.adapter.resolveIcon(name),
      onSelect: selectedItem => {
        this.adapter
          .request('Tray.MenuEvent', {
            id: item.id,
            menuId: Number(selectedItem.id),
            event: 'clicked',
          })
          .catch(() => {});
      },
      onClose: () => {
        this.menuTrigger = null;
      },
    });
  },

  closeMenu(restoreFocus = false) {
    this.menuGeneration += 1;
    window.XPContextMenu?.close(restoreFocus);
    this.menuTrigger = null;
  },
};

window.XPAxctlTray = XPAxctlTray;
