/**
 * Phase 2 — GroupRegistry
 * Collapsible layout groups for Real Web V2. Replaces vertical widget-column stacking.
 *
 * RULE: New UI surfaces mount into groups — NOT #widgetLayer / widgets.js column.
 */
(function (global) {
  'use strict';

  class GroupRegistry {
    constructor(rootEl) {
      this._root = rootEl || null;
      this._groups = new Map();
      this._collapsed = new Set();
    }

    setRoot(el) {
      this._root = el;
    }

    register(groupId, meta) {
      if (!groupId) throw new Error('GroupRegistry.register: groupId required');
      const def = Object.assign(
        {
          id: groupId,
          title: groupId,
          order: 100,
          components: [],
        },
        meta || {},
      );
      this._groups.set(groupId, def);
      return def;
    }

    list() {
      return Array.from(this._groups.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    addComponent(groupId, componentId) {
      const g = this._groups.get(groupId);
      if (!g) throw new Error(`Group not found: ${groupId}`);
      if (!g.components.includes(componentId)) g.components.push(componentId);
    }

    isCollapsed(groupId) {
      return this._collapsed.has(groupId);
    }

    toggle(groupId) {
      if (this._collapsed.has(groupId)) this._collapsed.delete(groupId);
      else this._collapsed.add(groupId);
      this._syncGroupDom(groupId);
    }

    mountAll() {
      if (!this._root) throw new Error('GroupRegistry: root element not set');
      this._root.innerHTML = '';
      const cr = global.componentRegistry;
      if (!cr) throw new Error('GroupRegistry: componentRegistry missing');

      this.list().forEach((g) => {
        const section = document.createElement('section');
        section.className = 'v2-group';
        section.dataset.groupId = g.id;

        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'v2-group-head';
        head.textContent = g.title;
        head.addEventListener('click', () => this.toggle(g.id));

        const body = document.createElement('div');
        body.className = 'v2-group-body';

        section.appendChild(head);
        section.appendChild(body);
        this._root.appendChild(section);

        g._dom = { section, body };
        if (this._collapsed.has(g.id)) section.classList.add('collapsed');

        g.components.forEach((cid) => {
          try {
            cr.mount(cid, body, { groupId: g.id, stateStore: global.stateStore });
          } catch (err) {
            console.error(`[GroupRegistry] component mount: ${cid}`, err);
          }
        });
      });

      if (global.stateStore) {
        global.stateStore.subscribe((state) => {
          this.list().forEach((g) => {
            g.components.forEach((cid) => cr.update(cid, { state, groupId: g.id }));
          });
        });
      }
    }

    _syncGroupDom(groupId) {
      const g = this._groups.get(groupId);
      if (!g || !g._dom) return;
      g._dom.section.classList.toggle('collapsed', this._collapsed.has(groupId));
    }
  }

  global.GroupRegistry = GroupRegistry;
})(window);
