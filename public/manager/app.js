(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const TAB_TITLES = { dashboard: 'Дашборд', alerts: 'Алерты', currency: 'Валюта', users: 'Пользователи' };
  const EMOJI = { follow: '💜', sub: '⭐', resub: '🌟', giftsub: '🎁', raid: '🚀', cheer: '💎', redeem: '🎯' };
  const REWARD_LABELS = {
    follow: 'Фолловер', sub: 'Подписка', resub: 'Ресаб', giftsub: 'Подарочная подписка (за шт.)',
    raid: 'Рейд', cheer: 'За 1 бит', redeem: 'Награда за баллы', chatMessage: 'За сообщение в чате',
  };

  let currency = null;
  let feedCount = 0;

  // ---------- helpers ----------
  async function api(path, opts) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 250);
    }, 2200);
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('ru-RU');
  }

  function ago(ts) {
    if (!ts) return '—';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + 'с';
    if (s < 3600) return Math.floor(s / 60) + 'м';
    if (s < 86400) return Math.floor(s / 3600) + 'ч';
    return Math.floor(s / 86400) + 'д';
  }

  // ---------- tabs ----------
  $$('.nav__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('.nav__item').forEach((b) => b.classList.toggle('active', b === btn));
      $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + tab));
      $('#tab-title').textContent = TAB_TITLES[tab];
      if (tab === 'users') loadUsers();
    });
  });

  // overlay link
  $('#overlay-link').href = location.origin + '/overlay';
  $('#overlay-link').textContent = location.origin + '/overlay';
  $('#copy-overlay').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.origin + '/overlay'); toast('Ссылка скопирована'); }
    catch { toast('Не удалось скопировать'); }
  });

  // ---------- status ----------
  function setStatus(s) {
    const el = $('#sb-status');
    const connected = s && s.streamerbot === 'connected';
    el.classList.toggle('ok', connected);
    el.classList.toggle('bad', s && s.streamerbot !== 'connected');
    el.querySelector('.status__text').textContent =
      'Streamer.bot: ' + (connected ? 'подключено' : s && s.streamerbot === 'error' ? 'ошибка' : 'нет связи');
    $('#stat-conn').textContent = connected ? 'OK' : '—';
  }

  function setStats(stats) {
    if (!stats) return;
    $('#stat-users').textContent = fmt(stats.users);
    $('#stat-circulating').textContent = fmt(stats.circulating);
    $('#stat-earned').textContent = fmt(stats.earned);
  }

  async function refreshStatus() {
    const data = await api('/status');
    setStatus(data.status);
    setStats(data.stats);
    currency = data.currency;
  }

  // ---------- feed ----------
  function addFeedItem(evt, prepend = true) {
    const feed = $('#feed');
    const empty = feed.querySelector('.feed__empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'feed-item' + (evt.shown ? '' : ' muted-event');
    const f = evt.fields || {};
    const detail = [f.user, f.amount ? '· ' + f.amount : '', f.reward ? '· ' + f.reward : '']
      .filter(Boolean).join(' ');
    item.innerHTML = `
      <div class="feed-item__badge">${EMOJI[evt.alert] || '⚡'}</div>
      <div class="feed-item__main">
        <div class="feed-item__title">${evt.source}.${evt.type}</div>
        <div class="feed-item__sub">${escapeHtml(detail || '—')}</div>
      </div>
      <div class="feed-item__time">${ago(evt.ts)}</div>
      <span class="pill ${evt.shown ? '' : 'off'}">${evt.shown ? 'показан' : 'скрыт'}</span>`;
    if (prepend) feed.prepend(item);
    else feed.append(item);

    feedCount++;
    $('#feed-count').textContent = feedCount + ' событий';
    while (feed.children.length > 100) feed.lastChild.remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  // ---------- alerts ----------
  async function loadAlerts() {
    const { types, alerts } = await api('/alerts');
    const grid = $('#alerts-grid');
    grid.innerHTML = '';
    types.forEach((type) => {
      const a = alerts[type];
      const card = document.createElement('div');
      card.className = 'alert-card';
      card.style.borderLeftColor = a.accent;
      card.innerHTML = `
        <div class="alert-card__head">
          <div class="alert-card__title">${EMOJI[type] || '⚡'} ${a.label}</div>
          <label class="switch"><input type="checkbox" ${a.enabled ? 'checked' : ''} data-k="enabled"><span class="switch__slider"></span></label>
        </div>
        <div class="alert-card__row">
          <label>Текст (доступно: {user} {amount} {tier} {months} {reward} {recipient})
            <input type="text" value="${escapeHtml(a.message)}" data-k="message">
          </label>
        </div>
        <div class="alert-card__row two" style="margin-top:12px">
          <label>Длительность (мс)
            <input type="number" min="1000" step="500" value="${a.duration}" data-k="duration">
          </label>
          <label>Цвет
            <input type="color" value="${a.accent}" data-k="accent">
          </label>
        </div>
        <div class="panel__actions" style="margin-top:14px">
          <button class="btn btn--primary btn--sm" data-act="save">Сохранить</button>
          <button class="btn btn--test btn--sm" data-act="test">Тест ▶</button>
        </div>`;

      const read = () => {
        const out = {};
        card.querySelectorAll('[data-k]').forEach((el) => {
          const k = el.dataset.k;
          out[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
        });
        return out;
      };

      card.querySelector('[data-k="accent"]').addEventListener('input', (e) => {
        card.style.borderLeftColor = e.target.value;
      });

      card.querySelector('[data-act="save"]').addEventListener('click', async () => {
        await api('/alerts/' + type, { method: 'PUT', body: JSON.stringify(read()) });
        toast('Алерт «' + a.label + '» сохранён');
      });
      card.querySelector('[data-act="test"]').addEventListener('click', async () => {
        await api('/alerts/' + type, { method: 'PUT', body: JSON.stringify(read()) });
        await api('/alerts/' + type + '/test', { method: 'POST', body: JSON.stringify({}) });
        toast('Тест отправлен на оверлей');
      });

      grid.append(card);
    });
  }

  // ---------- currency ----------
  async function loadCurrency() {
    const { currency: c } = await api('/currency');
    currency = c;
    $('#cur-name').value = c.currencyName;
    $('#cur-symbol').value = c.currencySymbol;
    $('#cur-perminute').value = c.perMinute;
    $('#cur-window').value = c.activeWindowMinutes;

    const grid = $('#reward-grid');
    grid.innerHTML = '';
    Object.keys(REWARD_LABELS).forEach((key) => {
      const wrap = document.createElement('label');
      wrap.innerHTML = `${REWARD_LABELS[key]}<input type="number" min="0" data-reward="${key}" value="${c.rewards[key] ?? 0}">`;
      grid.append(wrap);
    });
  }

  $('#save-currency').addEventListener('click', async () => {
    const rewards = {};
    $$('[data-reward]').forEach((el) => (rewards[el.dataset.reward] = Number(el.value)));
    const body = {
      currencyName: $('#cur-name').value.trim() || 'Монеты',
      currencySymbol: $('#cur-symbol').value.trim() || '🪙',
      perMinute: Number($('#cur-perminute').value),
      activeWindowMinutes: Number($('#cur-window').value),
      rewards,
    };
    const { currency: c } = await api('/currency', { method: 'PUT', body: JSON.stringify(body) });
    currency = c;
    const hint = $('#currency-saved');
    hint.textContent = 'Сохранено ✓';
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 1800);
    toast('Настройки валюты сохранены');
  });

  // ---------- users ----------
  let userSort = { sort: 'balance', dir: 'desc' };

  async function loadUsers() {
    const search = $('#user-search').value.trim();
    const data = await api(`/users?search=${encodeURIComponent(search)}&sort=${userSort.sort}&dir=${userSort.dir}&limit=200`);
    const body = $('#users-body');
    body.innerHTML = '';
    $('#users-empty').hidden = data.rows.length > 0;
    const sym = (currency && currency.currencySymbol) || '🪙';

    data.rows.forEach((u) => {
      const tr = document.createElement('tr');
      const name = u.display_name || u.username;
      tr.innerHTML = `
        <td>
          <div class="user-cell">
            <div class="user-avatar">${escapeHtml((name[0] || '?').toUpperCase())}</div>
            <div><div class="user-name">${escapeHtml(name)}</div><div class="muted">@${escapeHtml(u.username)}</div></div>
          </div>
        </td>
        <td class="num"><span class="balance-val">${sym} ${fmt(u.balance)}</span></td>
        <td class="num">${fmt(u.total_earned)}</td>
        <td>${ago(u.last_active)}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn minus" title="Списать">−</button>
            <button class="icon-btn plus" title="Начислить">+</button>
          </div>
        </td>`;
      tr.querySelector('.plus').addEventListener('click', () => adjust(u, +1));
      tr.querySelector('.minus').addEventListener('click', () => adjust(u, -1));
      body.append(tr);
    });
  }

  async function adjust(user, sign) {
    const name = user.display_name || user.username;
    const raw = prompt(`${sign > 0 ? 'Начислить' : 'Списать'} валюту для ${name}:`, '100');
    if (raw === null) return;
    const amount = Math.abs(Math.round(Number(raw))) * sign;
    if (!amount) return toast('Введите число');
    await api(`/users/${user.id}/adjust`, { method: 'POST', body: JSON.stringify({ amount, reason: 'panel' }) });
    toast(`${sign > 0 ? '+' : ''}${amount} → ${name}`);
    loadUsers();
    refreshStatus();
  }

  $('#user-search').addEventListener('input', () => { clearTimeout(loadUsers._t); loadUsers._t = setTimeout(loadUsers, 250); });
  $('#user-refresh').addEventListener('click', loadUsers);
  $('#user-add').addEventListener('click', async () => {
    const username = prompt('Ник пользователя (Twitch login):');
    if (!username) return;
    await api('/users', { method: 'POST', body: JSON.stringify({ username }) });
    toast('Пользователь добавлен');
    loadUsers();
  });
  $$('.table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      userSort.dir = userSort.sort === col && userSort.dir === 'desc' ? 'asc' : 'desc';
      userSort.sort = col;
      loadUsers();
    });
  });

  // ---------- websocket ----------
  function connectWs() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/manager`);
    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch { return; }
      switch (data.type) {
        case 'hello':
          setStatus(data.status);
          (data.events || []).slice().reverse().forEach((e) => addFeedItem(e, true));
          break;
        case 'status':
          setStatus(data.status);
          break;
        case 'event':
          addFeedItem(data.event, true);
          break;
        case 'user':
        case 'accrual':
          refreshStatus();
          if (document.querySelector('#tab-users').classList.contains('active')) loadUsers();
          break;
      }
    };
    ws.onclose = () => setTimeout(connectWs, 2000);
    ws.onerror = () => ws.close();
  }

  // ---------- init ----------
  (async function init() {
    await refreshStatus();
    await loadAlerts();
    await loadCurrency();
    connectWs();
    setInterval(refreshStatus, 15000);
  })();
})();
