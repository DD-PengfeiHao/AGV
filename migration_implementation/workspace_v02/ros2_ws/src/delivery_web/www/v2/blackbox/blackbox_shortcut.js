/**
 * Ctrl+S → BlackBox trigger (skip editable fields)
 */
(function (global) {
  'use strict';

  let busy = false;

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return !!el.closest('[contenteditable="true"]');
  }

  function notify(msg, kind) {
    if (typeof global.showToast === 'function') {
      global.showToast(msg, kind || 'info', 5000);
    }
    if (global.eventStore) {
      const fn = kind === 'err' ? 'error' : (kind === 'warn' ? 'warn' : 'info');
      global.eventStore[fn]('BLACKBOX', msg);
    }
  }

  async function triggerBlackBox(source) {
    if (!global.Auth || !global.Auth.isLoggedIn()) {
      notify('请先登录后再触发 Black Box', 'warn');
      return;
    }
    if (busy) return;
    busy = true;
    notify('Black Box 已触发，正在采集事件后 20 秒…', 'info');
    try {
      const out = await global.BlackBoxClient.trigger({ source: source || 'keyboard', key: 'CTRL+S' });
      if (!out.success && !out.duplicate) {
        notify(out.message || 'Black Box 触发失败', 'err');
        return;
      }
      if (out.duplicate) {
        notify(out.message || '已有进行中的采集', 'warn');
        return;
      }
      const final = await global.BlackBoxClient.pollUntilDone((st) => {
        if (st.remaining_post_seconds > 0 && typeof global.showToast === 'function') {
          // quiet polling — initial toast is enough
        }
      });
      if (final.state === 'COMPLETE' && final.last_record) {
        notify(`Black Box 保存完成：${final.last_record.record_id}`, 'ok');
      } else if (final.state === 'FAILED') {
        notify(`Black Box 保存失败：${final.last_error || 'UNKNOWN'}`, 'err');
      }
    } catch (e) {
      notify(`Black Box 错误：${e.message || e}`, 'err');
    } finally {
      busy = false;
    }
  }

  function initBlackBoxShortcut() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl || String(e.key).toLowerCase() !== 's') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      triggerBlackBox('keyboard');
    }, true);
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.initBlackBoxShortcut = initBlackBoxShortcut;
  global.triggerBlackBox = triggerBlackBox;
})(window);
