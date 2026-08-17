/**
 * Phase 2 — GroupRegistry (CSS Grid layout + collapse)
 */
(function (global) {
  'use strict';

  class GroupRegistry {
    constructor() {
      this._root = null;
      this._groups = new Map();
      this._collapsed = new Set();
      this._unsub = null;
    }

    setRoot(el) { this._root = el; }

    register(groupId, meta) {
      const def = Object.assign({
        id: groupId,
        title: groupId,
        description: '',
        order: 100,
        components: [],
        requiredPermission: null,
        size: 'md',
      }, meta || {});
      this._groups.set(groupId, def);
      if (def.collapsed) this._collapsed.add(groupId);
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

    toggle(groupId) {
      if (this._collapsed.has(groupId)) this._collapsed.delete(groupId);
      else this._collapsed.add(groupId);
      this._syncDom(groupId);
    }

    _visible(g) {
      if (!g.requiredPermission) return true;
      if (g.requiredPermission === 'admin') {
        return global.Auth && global.Auth.isAdmin && global.Auth.isAdmin();
      }
      return true;
    }

    mountAll() {
      if (!this._root) throw new Error('GroupRegistry: root not set');
      const cr = global.componentRegistry;
      if (!cr) throw new Error('GroupRegistry: componentRegistry missing');
      this._root.innerHTML = '';

      this.list().forEach((g) => {
        if (!this._visible(g)) return;
        const section = document.createElement('section');
        section.className = `v2-group v2-group-${g.size || 'md'}`;
        section.dataset.groupId = g.id;

        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'v2-group-head';
        head.innerHTML = `<span class="v2-group-title">${g.title}</span><span class="v2-group-chevron">▼</span>`;
        if (g.description) head.title = g.description;
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
            console.error(`[GroupRegistry] mount ${cid}`, err);
          }
        });
      });

      if (this._unsub) this._unsub();
      if (global.stateStore) {
        this._unsub = global.stateStore.subscribe('*', (slice, full, err) => {
          const ctx = { state: full, slice, error: err, stateStore: global.stateStore };
          this.list().forEach((g) => {
            if (!g._dom) return;
            g.components.forEach((cid) => cr.update(cid, ctx));
          });
        });
      }
    }

    unmountAll() {
      if (this._unsub) { this._unsub(); this._unsub = null; }
      if (this._root) this._root.innerHTML = '';
      if (global.componentRegistry) global.componentRegistry.destroyAll();
      this._groups.forEach((g) => { g._dom = null; });
    }

    _syncDom(groupId) {
      const g = this._groups.get(groupId);
      if (!g || !g._dom) return;
      g._dom.section.classList.toggle('collapsed', this._collapsed.has(groupId));
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.GroupRegistry = GroupRegistry;
})(window);
