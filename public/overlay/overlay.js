(() => {
  const stage = document.getElementById('stage');
  const el = document.getElementById('alert');
  const emojiEl = document.getElementById('alert-emoji');
  const labelEl = document.getElementById('alert-label');
  const textEl = document.getElementById('alert-text');
  const audio = document.getElementById('alert-audio');

  const EMOJI = {
    follow: '💜',
    sub: '⭐',
    resub: '🌟',
    giftsub: '🎁',
    raid: '🚀',
    cheer: '💎',
    redeem: '🎯',
  };

  const queue = [];
  let busy = false;

  function show(alert) {
    el.style.setProperty('--accent', alert.accent || '#a970ff');
    emojiEl.textContent = EMOJI[alert.type] || '🎉';
    labelEl.textContent = alert.label || alert.type || '';
    textEl.innerHTML = highlight(alert.text || '', alert.fields);

    el.classList.remove('hide');
    void el.offsetWidth; // restart animation
    el.classList.add('show');

    if (alert.sound) {
      try { audio.src = alert.sound; audio.currentTime = 0; audio.play().catch(() => {}); } catch (_) {}
    }
    confetti(alert.accent || '#a970ff');

    const duration = Math.max(2000, Number(alert.duration) || 6000);
    setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => { busy = false; next(); }, 450);
    }, duration);
  }

  function highlight(text, fields = {}) {
    const safe = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const targets = [fields.user, fields.amount, fields.reward, fields.recipient]
      .filter((v) => v !== undefined && v !== null && String(v).length)
      .map((v) => String(v));
    let out = safe;
    for (const t of targets) {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`(${esc})`, 'g'), '<span class="hl">$1</span>');
    }
    return out;
  }

  function confetti(color) {
    const colors = [color, '#ffffff', '#ffd166', '#06d6a0', '#ef476f'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * 0.4 + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }

  function next() {
    if (busy || queue.length === 0) return;
    busy = true;
    show(queue.shift());
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/overlay`);
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'alert' && data.alert) {
          queue.push(data.alert);
          next();
        }
      } catch (_) {}
    };
    ws.onclose = () => setTimeout(connect, 2000);
    ws.onerror = () => ws.close();
  }

  connect();
})();
