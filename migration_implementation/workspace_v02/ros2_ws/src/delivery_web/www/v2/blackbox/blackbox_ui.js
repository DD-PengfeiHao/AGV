/**
 * BlackBox status UI component (system/debug)
 */
(function (global) {
  'use strict';

  function registerBlackBoxUi(registry) {
    if (registry.get('blackbox.status')) return;

    registry.register('blackbox.status', {
      group: 'system',
      mount(host) {
        const el = document.createElement('article');
        el.className = 'v2-card v2-card-blackbox';
        el.innerHTML = `
          <div class="v2-card-head"><h4>Black Box</h4></div>
          <div class="v2-card-body">
            <div class="v2-mono" id="bbState">ARMED</div>
            <div class="v2-mono" id="bbLast">Last: —</div>
            <div class="v2-mono" id="bbDisk">Disk: —</div>
            <div class="v2-mono" id="bbBuf">Buffer: —</div>
            <div class="v2-mono" id="bbRemain"></div>
            <button type="button" class="btn btn-sm" id="bbCaptureBtn" style="margin-top:8px">Capture Black Box</button>
            <div class="st-meta" style="margin-top:6px">快捷键 Ctrl+S</div>
          </div>`;
        host.appendChild(el);
        el.querySelector('#bbCaptureBtn')?.addEventListener('click', () => {
          if (global.triggerBlackBox) global.triggerBlackBox('button');
        });
        return {
          update() {
            global.BlackBoxClient?.status().then((st) => {
              if (!st || !st.available) {
                el.querySelector('#bbState').textContent = 'UNAVAILABLE';
                return;
              }
              el.querySelector('#bbState').textContent = `State: ${st.state || '—'}`;
              const last = st.last_record;
              el.querySelector('#bbLast').textContent = last ? `Last: ${last.record_id}` : 'Last: —';
              el.querySelector('#bbDisk').textContent = st.disk_free_mb != null
                ? `Disk: ${(st.disk_free_mb / 1024).toFixed(1)} GB free`
                : 'Disk: —';
              const bh = st.buffer_health || {};
              el.querySelector('#bbBuf').textContent = `Buffer: state=${bh.state?.count || 0} cam=${JSON.stringify(bh.camera || {})}`;
              el.querySelector('#bbRemain').textContent = st.remaining_post_seconds > 0
                ? `Capturing… ${st.remaining_post_seconds}s`
                : '';
            }).catch(() => {});
          },
        };
      },
    });
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.registerBlackBoxUi = registerBlackBoxUi;
})(window);
