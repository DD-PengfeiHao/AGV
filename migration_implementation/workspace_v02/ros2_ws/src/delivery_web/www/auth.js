/**
 * AGV Web session auth — admin (ubuntu) + registered users.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'agv_session_token';

  const Auth = {
    token: null,
    user: null,

    init() {
      this.token = sessionStorage.getItem(STORAGE_KEY) || '';
      return this.refreshSession();
    },

    headers(extra) {
      const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
      if (this.token) h.Authorization = `Bearer ${this.token}`;
      return h;
    },

    async refreshSession() {
      try {
        const r = await fetch('/api/auth/session', { headers: this.headers() });
        const j = await r.json();
        if (j.logged_in) {
          this.user = j;
          return true;
        }
      } catch (e) { /* ignore */ }
      this.user = null;
      return false;
    },

    async login(username, password) {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || '登录失败');
      this.token = j.token;
      sessionStorage.setItem(STORAGE_KEY, this.token);
      this.user = j;
      return j;
    },

    async logout() {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ token: this.token }),
        });
      } catch (e) { /* ignore */ }
      this.token = null;
      this.user = null;
      sessionStorage.removeItem(STORAGE_KEY);
    },

    async register(username, password) {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || '注册失败');
      return j;
    },

    async changePassword(oldPassword, newPassword) {
      const r = await fetch('/api/auth/change_password', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || '修改密码失败');
      if (this.user) this.user.must_change_password = false;
      return j;
    },

    mustChangePassword() {
      return !!(this.user && this.user.must_change_password);
    },

    isAdmin() {
      return !!(this.user && (this.user.is_admin || this.user.role === 'admin'));
    },

    isDev() {
      return !!(this.user && (this.user.role === 'dev' || this.isAdmin()));
    },

    isLoggedIn() {
      return !!this.user;
    },

    applyUi() {
      const loginModal = document.getElementById('loginModal');
      const mainEl = document.querySelector('main');
      const header = document.querySelector('header.header');
      // V2: overview visible without login; login panel via logo click
      loginModal?.classList.remove('show');
      if (loginModal) loginModal.style.display = 'none';
      if (mainEl) mainEl.style.visibility = '';
      if (header) header.style.visibility = '';

      const loggedIn = this.isLoggedIn();
      const userChip = document.getElementById('authUserChip');
      if (userChip) {
        if (loggedIn) {
          userChip.textContent = this.user.username || '—';
          userChip.title = this.isAdmin() ? '管理员' : (this.user.role === 'dev' ? '开发' : '用户');
          userChip.classList.remove('hidden');
        } else {
          userChip.classList.add('hidden');
        }
      }
      document.getElementById('btnAuthLogout')?.classList.toggle('hidden', !loggedIn);
      document.getElementById('btnAuthRegister')?.classList.toggle('hidden', !loggedIn || !this.isAdmin());
      document.getElementById('btnOpenDebug')?.classList.toggle('hidden', !this.isAdmin());
      document.getElementById('adminRegisterModal')?.classList.toggle('hidden', !this.isAdmin());
      document.getElementById('btnViewSwitch')?.classList.toggle('hidden', !this.isAdmin());
      document.getElementById('btnLoginSlideLogout')?.classList.toggle('hidden', !loggedIn);
      document.getElementById('btnLoginSlideSubmit')?.classList.toggle('hidden', loggedIn);
      const canRestart = this.isDev();
      document.getElementById('btnRestartComponent')?.classList.toggle('hidden', !canRestart);
      document.getElementById('btnRestartDocker')?.classList.toggle('hidden', !canRestart);

      const chPwd = document.getElementById('changePasswordModal');
      if (this.mustChangePassword()) {
        chPwd?.classList.remove('hidden');
        chPwd?.classList.add('show');
      } else {
        chPwd?.classList.remove('show');
      }

      if (!this.isAdmin() && global.widgetMgr?.isOpen?.('verbose_log')) {
        global.widgetMgr.removeWidget('verbose_log');
      }
    },

    filterWidgetRegistry(registry) {
      if (this.isAdmin()) return registry;
      const out = Object.assign({}, registry);
      delete out.verbose_log;
      return out;
    },
  };

  const _fetch = global.fetch.bind(global);
  global.fetch = function (url, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
    opts.headers = headers;
    return _fetch(url, opts).then((r) => {
      if (r.status === 401 && !String(url).includes('/api/auth/')) {
        Auth.user = null;
        Auth.applyUi();
      }
      return r;
    });
  };

  global.Auth = Auth;
})(window);
