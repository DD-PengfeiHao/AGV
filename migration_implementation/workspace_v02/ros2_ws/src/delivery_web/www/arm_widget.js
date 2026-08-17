/**
 * xArm7 control widget — status, progress, joints, pick_place API.
 */
(function (global) {
  'use strict';

  const BLOCKS = [
    { num: 1, desc: '→ A_UP（取货上方）' },
    { num: 2, desc: '夹爪张开' },
    { num: 3, desc: '→ A_DN（下降取货）' },
    { num: 4, desc: '夹爪闭合（抓取）' },
    { num: 6, desc: '→ A_UP（抬起）' },
    { num: 7, desc: '→ MID（过渡）' },
    { num: 8, desc: '→ B_UP（放货上方）' },
    { num: 9, desc: '夹爪张开（放下）' },
    { num: 11, desc: '→ B_DN（结束）' },
  ];

  const JOINT_LIMITS = [
    { min: -360, max: 360 },
    { min: -130, max: 130 },
    { min: -360, max: 360 },
    { min: -360, max: 360 },
    { min: -360, max: 360 },
    { min: -130, max: 130 },
    { min: -360, max: 360 },
  ];

  let pollTimer = null;
  let pollInterval = 1000;
  let lastLogMsg = '';
  let activeCard = null;
  let clientBusy = false;
  let lastOpResultKey = '';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  async function fetchTimeout(url, opts = {}, ms = 10000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      return res;
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  }

  function notify(level, code, message) {
    if (global.StatusBanner) {
      global.StatusBanner.push({ level, source: 'arm', code, message });
    }
    if (global.showToast) global.showToast(message, level === 'error' ? 'err' : (level === 'warn' ? 'warn' : 'info'), 6000);
  }

  function appendLog(card, type, msg) {
    const logEl = $('#armWidgetLog', card);
    if (!logEl) return;
    const time = new Date().toLocaleTimeString('zh-CN');
    const colors = {
      action: '#3B82F6',
      state: '#6B7280',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
    };
    const div = document.createElement('div');
    div.className = 'arm-log-line';
    div.style.color = colors[type] || '#8fa3b8';
    div.innerHTML = `<span class="log-time">${time}</span> <span>${msg}</span>`;
    logEl.prepend(div);
    while (logEl.children.length > 100) logEl.lastChild.remove();
  }

  function renderJointBars(card, jointsDeg) {
    const el = $('#armWidgetJoints', card);
    if (!el || !jointsDeg || jointsDeg.length < 7) return;
    el.innerHTML = jointsDeg.slice(0, 7).map((deg, i) => {
      const lim = JOINT_LIMITS[i] || { min: -360, max: 360 };
      const range = lim.max - lim.min;
      const pct = Math.max(0, Math.min(100, ((deg - lim.min) / range) * 100));
      return `<div class="arm-joint-bar">
        <span class="jl">J${i + 1}</span>
        <span class="jv">${Number(deg).toFixed(1)}°</span>
        <div class="jt"><div class="jf" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  function renderProgress(card, data) {
    const bar = $('#armWidgetProgressBar', card);
    const txt = $('#armWidgetBlockText', card);
    const block = data.current_block;
    if (!bar || !txt) return;

    if (block != null && block > 0 && block < 99) {
      const done = BLOCKS.filter((b) => b.num < block).length;
      bar.style.width = Math.round((done / BLOCKS.length) * 100) + '%';
      const cur = BLOCKS.find((b) => b.num === block);
      txt.textContent = `[B${String(block).padStart(2, '0')}] ${cur ? cur.desc : data.state_text || ''}`;
    } else if (block === 99) {
      bar.style.width = '100%';
      txt.textContent = '✅ 循环完成';
    } else {
      bar.style.width = (data.op_running || data.is_busy) ? '5%' : '0%';
      txt.textContent = data.state_text || (data.online ? '空闲' : '离线');
    }
  }

  function updateUI(card, data) {
    const onlineEl = $('#armWidgetOnline', card);
    const gripEl = $('#armWidgetGripper', card);
    const resultEl = $('#armWidgetLastResult', card);
    const motionEl = $('#armWidgetMotionGate', card);

    const online = data.online === true;
    const state = data.state || (online ? 'idle' : 'offline');
    const stateCn = { idle: '空闲', running: '执行中', error: '错误', offline: '离线' };
    const motionBlocked = data.motion_blocked === true;
    const realMotion = data.real_motion_enabled === true;
    const armMode = data.arm_mode || 'unknown';
    const opRunning = data.op_running === true;

    if (onlineEl) {
      const modeTag = armMode === 'real' ? '真机' : '仿真';
      const runTag = opRunning ? ` · ${data.op_kind || '执行中'}` : '';
      onlineEl.innerHTML = online
        ? `<span class="dot on"></span> 在线 · ${stateCn[state] || state} · ${modeTag}${runTag}`
        : '<span class="dot off"></span> 离线';
      onlineEl.className = 'arm-online ' + (online ? 'on' : 'off');
    }

    if (motionEl) {
      if (armMode !== 'real') {
        motionEl.textContent = '当前为仿真模式（ARM_MODE≠real）';
        motionEl.className = 'arm-motion-gate warn';
      } else if (!realMotion) {
        motionEl.textContent = '⚠️ 真实运动未启用 — 解锁/抓取/夹爪将被拦截';
        motionEl.className = 'arm-motion-gate blocked';
      } else if (motionBlocked) {
        motionEl.textContent = data.motion_block_reason || '运动被拦截';
        motionEl.className = 'arm-motion-gate blocked';
      } else if (opRunning) {
        motionEl.textContent = `⏳ 正在执行: ${data.op_kind || '动作'}…`;
        motionEl.className = 'arm-motion-gate ok';
      } else {
        motionEl.textContent = '✅ 真机运动已启用';
        motionEl.className = 'arm-motion-gate ok';
      }
    }

    renderProgress(card, data);
    renderJointBars(card, data.joints_deg);

    const gs = data.gripper_state || 'unknown';
    if (gripEl) {
      gripEl.textContent = gs === 'open' ? '🔓 张开' : gs === 'closed' ? '🔒 闭合' : '— 未知';
    }

    const lr = data.last_op_result || data.last_result;
    if (resultEl && lr) {
      const ok = lr.success ? '✅' : '❌';
      const via = lr.via ? ` [${lr.via}]` : '';
      resultEl.textContent = `${ok} ${lr.message || ''}${via}`;
    }

    const busy = clientBusy || opRunning;
    card.querySelectorAll('.arm-w-btn').forEach((btn) => {
      if (btn.dataset.always) return;
      const needsMotion = btn.dataset.motion === '1';
      btn.disabled = busy || !online || (needsMotion && motionBlocked);
    });

    const motionToggle = $('#armBtnMotionToggle', card);
    if (motionToggle) {
      motionToggle.textContent = realMotion ? '🔒 关闭真机运动' : '🔓 允许真机运动';
      motionToggle.classList.toggle('active', realMotion);
    }

    if (data.state_history && data.state_history.length) {
      const latest = data.state_history[data.state_history.length - 1];
      if (latest && latest.msg && latest.msg !== lastLogMsg) {
        lastLogMsg = latest.msg;
        appendLog(card, 'state', latest.msg);
      }
    }

    if (lr && lr.message) {
      const key = `${lr.success}:${lr.message}`;
      if (key !== lastOpResultKey) {
        lastOpResultKey = key;
        notify(lr.success ? 'info' : 'error', lr.success ? 'ARM_OK' : 'ARM_FAIL', lr.message);
      }
    }
  }

  async function pollOnce(card) {
    try {
      const res = await fetchTimeout('/api/arm/status', {}, 5000);
      const data = await res.json();
      updateUI(card, data);

      let next = 1000;
      if (!data.online) next = 3000;
      else if (data.op_running || data.is_busy || data.state === 'running') next = 500;
      else if (data.state === 'error') next = 1000;

      if (next !== pollInterval) {
        pollInterval = next;
        clearInterval(pollTimer);
        pollTimer = setInterval(() => pollOnce(card), pollInterval);
      }
      return data;
    } catch (e) {
      updateUI(card, { online: false, state: 'offline', joints_deg: [] });
      return null;
    }
  }

  async function waitForOp(card, kind, maxMs) {
    const limits = { unlock: 60000, pick_place: 180000, gripper: 20000 };
    const deadline = Date.now() + (maxMs || limits[kind] || 90000);
    while (Date.now() < deadline) {
      const data = await pollOnce(card);
      if (!data) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      if (!data.op_running) {
        const lr = data.last_op_result;
        if (lr) return lr;
        if (!data.op_kind) return { success: true, message: '已完成' };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return { success: false, message: `${kind} 等待超时`, code: 'ARM_TIMEOUT' };
  }

  async function runArmAction(card, kind, startFn) {
    if (clientBusy) {
      notify('warn', 'ARM_BUSY', '机械臂任务进行中，请稍候');
      return;
    }
    clientBusy = true;
    try {
      const out = await startFn();
      if (out && out.accepted) {
        notify('info', 'ARM_START', out.message || '已启动');
        const lr = await waitForOp(card, kind);
        appendLog(card, lr.success ? 'success' : 'error', `${kind}: ${lr.message || ''}`);
        if (global.StatusBanner) global.StatusBanner.notifyFromResult('arm', lr, 'info', 'error');
        return lr;
      }
      appendLog(card, out.success ? 'success' : 'error', out.message || '');
      if (global.StatusBanner) global.StatusBanner.notifyFromResult('arm', out, 'info', 'error');
      return out;
    } catch (e) {
      const msg = e && e.name === 'AbortError' ? '请求超时' : '请求失败';
      notify('error', 'ARM_HTTP_FAIL', msg);
      appendLog(card, 'error', msg);
      return { success: false, message: msg };
    } finally {
      clientBusy = false;
      pollOnce(card);
    }
  }

  function startPoll(card) {
    activeCard = card;
    pollInterval = 1000;
    clearInterval(pollTimer);
    pollTimer = setInterval(() => pollOnce(card), pollInterval);
    pollOnce(card);
  }

  function stopPoll() {
    clearInterval(pollTimer);
    pollTimer = null;
    activeCard = null;
  }

  function bindActions(card) {
    $('#armBtnUnlock', card)?.addEventListener('click', async () => {
      const btn = $('#armBtnUnlock', card);
      btn.textContent = '解锁中…';
      appendLog(card, 'action', '触发解锁归位');
      await runArmAction(card, 'unlock', async () => {
        const res = await fetchTimeout('/api/arm/unlock', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        }, 8000);
        return res.json();
      });
      btn.textContent = '🔓 解锁';
    });

    $('#armBtnPick', card)?.addEventListener('click', async () => {
      const btn = $('#armBtnPick', card);
      const cycles = parseInt($('#armCyclesSelect', card)?.value || '1', 10);
      btn.textContent = '执行中…';
      appendLog(card, 'action', `触发抓取 (cycles=${cycles})`);
      const lr = await runArmAction(card, 'pick_place', async () => {
        const res = await fetchTimeout('/api/arm/pick_place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cycles }),
        }, 8000);
        return res.json();
      });
      if (lr && lr.success && lr.warning) appendLog(card, 'warning', lr.warning);
      btn.textContent = '🤖 抓取';
    });

    $('#armBtnGripOpen', card)?.addEventListener('click', async () => {
      appendLog(card, 'action', '夹爪张开');
      await runArmAction(card, 'gripper', async () => {
        const res = await fetchTimeout('/api/arm/gripper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ open: true }),
        }, 8000);
        return res.json();
      });
    });

    $('#armBtnGripClose', card)?.addEventListener('click', async () => {
      appendLog(card, 'action', '夹爪闭合');
      await runArmAction(card, 'gripper', async () => {
        const res = await fetchTimeout('/api/arm/gripper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ open: false }),
        }, 8000);
        return res.json();
      });
    });

    $('#armBtnStop', card)?.addEventListener('click', async () => {
      appendLog(card, 'warning', '发送停止命令');
      try {
        const res = await fetchTimeout('/api/arm/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, 3000);
        const j = await res.json();
        appendLog(card, 'warning', j.message || '已发送');
        notify('warn', 'ARM_STOP', j.message || '停止命令已发送');
      } catch (e) {
        appendLog(card, 'error', '停止失败');
      }
    });

    $('#armBtnRefresh', card)?.addEventListener('click', () => pollOnce(card));

    $('#armBtnMotionToggle', card)?.addEventListener('click', async () => {
      const btn = $('#armBtnMotionToggle', card);
      const enable = !btn.classList.contains('active');
      appendLog(card, 'action', enable ? '启用真机运动' : '关闭真机运动');
      try {
        const res = await fetchTimeout('/api/arm/motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: enable }),
        }, 5000);
        const j = await res.json();
        appendLog(card, j.success ? 'success' : 'error', j.real_motion_enabled ? '真机运动已启用' : '真机运动已关闭');
        notify(j.success ? 'info' : 'error', 'ARM_MOTION', enable ? '真机运动已启用' : '真机运动已关闭');
      } catch (e) {
        appendLog(card, 'error', '切换真机运动失败');
        notify('error', 'ARM_MOTION', '切换真机运动失败');
      }
      pollOnce(card);
    });

    $('#armCyclesSelect', card)?.addEventListener('change', async (e) => {
      const cycles = parseInt(e.target.value, 10);
      try {
        await fetchTimeout('/api/arm/cycles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cycles }),
        }, 3000);
      } catch (err) {
        /* ignore */
      }
    });
  }

  const ARM_WIDGET_HTML = `
    <div class="arm-widget">
      <div id="armWidgetOnline" class="arm-online">检测中…</div>
      <div id="armWidgetMotionGate" class="arm-motion-gate">—</div>
      <div class="arm-progress-wrap">
        <div class="arm-progress-track"><div id="armWidgetProgressBar" class="arm-progress-bar"></div></div>
        <div id="armWidgetBlockText" class="arm-block-text">等待开始</div>
      </div>
      <div id="armWidgetJoints" class="arm-joints-compact"></div>
      <div class="arm-grip-row">夹爪: <span id="armWidgetGripper">—</span></div>
      <div id="armWidgetLastResult" class="arm-last-result">—</div>
      <div class="arm-btn-grid">
        <button type="button" class="btn arm-w-btn" id="armBtnUnlock" data-motion="1">🔓 解锁</button>
        <button type="button" class="btn arm-w-btn primary" id="armBtnPick" data-motion="1">🤖 抓取</button>
        <button type="button" class="btn arm-w-btn arm-btn-stop" id="armBtnStop" data-always="1">🛑 停止</button>
        <button type="button" class="btn arm-w-btn" id="armBtnGripOpen" data-motion="1">🔓 开</button>
        <button type="button" class="btn arm-w-btn" id="armBtnGripClose" data-motion="1">🔒 合</button>
        <button type="button" class="btn arm-w-btn" id="armBtnRefresh" data-always="1">🔄</button>
      </div>
      <div class="arm-cycles-row">
        <label>次数</label>
        <select id="armCyclesSelect" class="arm-cycles-sel">
          <option value="1">1</option><option value="3">3</option>
          <option value="5">5</option><option value="10">10</option>
        </select>
        <button type="button" class="btn arm-w-btn arm-motion-toggle" id="armBtnMotionToggle" data-always="1">🔓 允许真机运动</button>
      </div>
      <div id="armWidgetLog" class="arm-widget-log"></div>
    </div>
  `;

  global.initArmWidget = function initArmWidget(card) {
    const body = card.querySelector('.widget-body');
    if (body) body.innerHTML = ARM_WIDGET_HTML;
    lastLogMsg = '';
    lastOpResultKey = '';
    clientBusy = false;
    bindActions(card);
    startPoll(card);
  };

  global.destroyArmWidget = function destroyArmWidget() {
    stopPoll();
    lastLogMsg = '';
    clientBusy = false;
  };
})(window);
