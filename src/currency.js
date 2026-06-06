import { getSetting, setSetting, award, getActiveUsers } from './db.js';
import { DEFAULT_CURRENCY } from './defaults.js';
import { hub } from './hub.js';

const SETTING_KEY = 'currency';

export function getCurrencySettings() {
  const stored = getSetting(SETTING_KEY, {});
  return {
    ...DEFAULT_CURRENCY,
    ...stored,
    rewards: { ...DEFAULT_CURRENCY.rewards, ...(stored.rewards || {}) },
  };
}

export function updateCurrencySettings(patch) {
  const current = getCurrencySettings();
  const next = {
    ...current,
    ...patch,
    rewards: { ...current.rewards, ...(patch.rewards || {}) },
  };
  setSetting(SETTING_KEY, next);
  return next;
}

/** Grant the configured reward for an event type to a user. */
export function rewardForEvent(type, { username, displayName }, multiplier = 1) {
  if (!username) return null;
  const settings = getCurrencySettings();
  const per = Number(settings.rewards?.[type] || 0);
  const amount = Math.round(per * multiplier);
  if (!amount) return null;
  const user = award({ username, displayName, amount, reason: `event:${type}` });
  if (user) hub.notifyUserUpdate(user);
  return user;
}

let timer = null;

/** Periodically pay active chatters the per-minute accrual. Runs every 60s. */
export function startCurrencyAccrual() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    const settings = getCurrencySettings();
    const perMinute = Number(settings.perMinute || 0);
    if (perMinute <= 0) return;
    const windowMs = Number(settings.activeWindowMinutes || 10) * 60_000;
    const since = Date.now() - windowMs;
    const active = getActiveUsers(since);
    for (const u of active) {
      const updated = award({ username: u.username, displayName: u.display_name, amount: perMinute, reason: 'watchtime' });
      if (updated) hub.notifyUserUpdate(updated);
    }
    if (active.length) {
      hub.toManager({ type: 'accrual', count: active.length, perMinute });
    }
  }, 60_000);
  return timer;
}

export function stopCurrencyAccrual() {
  if (timer) clearInterval(timer);
  timer = null;
}
