/**
 * AGV Observe components — PoC group
 */
(function (global) {
  'use strict';

  const F = global.AGV_V2 && global.AGV_V2.format;

  function card(title) {
    const el = document.createElement('article');
    el.className = 'v2-card';
    el.innerHTML = `<div class="v2-card-head"><h4>${title}</h4></div><div class="v2-card-body"></div>`;
    return { el, body: el.querySelector('.v2-card-body') };
  }

  function row(label, valueEl) {
    const r = document.createElement('div');
    r.className = 'v2-kv';
    r.innerHTML = `<span class="v2-k">${label}</span>`;
    r.appendChild(valueEl);
    return r;
  }

  function mono(text) {
    const s = document.createElement('span');
    s.className = 'v2-mono';
    s.textContent = text;
    return s;
  }

  function registerAgvObserve(registry) {
    if (registry.get('agv.state')) return;
    registry.register('agv.state', {
      group: 'agv',
      mount(host) {
        const { el, body } = card('AGV State');
        host.appendChild(el);
        const connected = mono('—');
        const task = mono('—');
        const station = mono('—');
        body.appendChild(row('Connected', connected));
        body.appendChild(row('Task', task));
        body.appendChild(row('Station', station));
        return {
          update(ctx) {
            const agv = ctx.state && ctx.state.agv;
            const link = ctx.state && ctx.state.agv_link;
            const online = !!(agv && (agv.connected || link && link.connected));
            connected.textContent = online ? 'CONNECTED' : 'OFFLINE';
            connected.className = 'v2-mono ' + (online ? 'ok' : 'bad');
            task.textContent = agv ? (agv.task_status || '—') : '—';
            station.textContent = agv ? (agv.current_station || agv.target_id || '—') : '—';
          },
        };
      },
    });

    registry.register('agv.pose', {
      group: 'agv',
      mount(host) {
        const { el, body } = card('AGV Pose');
        host.appendChild(el);
        const xy = mono('—');
        const ang = mono('—');
        body.appendChild(row('X / Y', xy));
        body.appendChild(row('Heading', ang));
        return {
          update(ctx) {
            const a = ctx.state && ctx.state.agv;
            if (!a) { xy.textContent = '—'; ang.textContent = '—'; return; }
            xy.textContent = `${Number(a.x || 0).toFixed(3)} / ${Number(a.y || 0).toFixed(3)} m`;
            ang.textContent = `${(Number(a.angle || 0) * 180 / Math.PI).toFixed(1)}°`;
          },
        };
      },
    });

    registry.register('agv.velocity', {
      group: 'agv',
      mount(host) {
        const { el, body } = card('AGV Velocity');
        host.appendChild(el);
        const spd = mono('—');
        const vec = mono('—');
        body.appendChild(row('Speed', spd));
        body.appendChild(row('Vx / Vy', vec));
        return {
          update(ctx) {
            const a = ctx.state && ctx.state.agv;
            if (!a) { spd.textContent = '—'; vec.textContent = '—'; return; }
            const vx = Number(a.vx || 0);
            const vy = Number(a.vy || 0);
            spd.textContent = `${Math.hypot(vx, vy).toFixed(3)} m/s`;
            vec.textContent = `${vx.toFixed(3)} / ${vy.toFixed(3)} m/s`;
          },
        };
      },
    });

    registry.register('agv.safety', {
      group: 'agv',
      mount(host) {
        const { el, body } = card('AGV Safety');
        host.appendChild(el);
        const manual = mono('—');
        const blocked = mono('—');
        const batt = mono('—');
        body.appendChild(row('Manual Block', manual));
        body.appendChild(row('Blocked', blocked));
        body.appendChild(row('Battery', batt));
        return {
          update(ctx) {
            const a = ctx.state && ctx.state.agv;
            if (!a) {
              manual.textContent = blocked.textContent = batt.textContent = '—';
              return;
            }
            manual.textContent = a.manual_block ? 'ON' : 'OFF';
            manual.className = 'v2-mono ' + (a.manual_block ? 'warn' : 'ok');
            blocked.textContent = a.blocked ? 'YES' : 'NO';
            blocked.className = 'v2-mono ' + (a.blocked ? 'warn' : 'ok');
            const b = a.battery_level;
            batt.textContent = b != null ? `${Number(b).toFixed(0)}%` : '—';
          },
        };
      },
    });
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.registerAgvObserve = registerAgvObserve;
})(window);
