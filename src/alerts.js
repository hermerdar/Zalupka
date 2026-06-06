import { getSetting, setSetting } from './db.js';
import { DEFAULT_ALERTS, ALERT_TYPES } from './defaults.js';
import { hub } from './hub.js';

const SETTING_KEY = 'alerts';

export function getAlerts() {
  const stored = getSetting(SETTING_KEY, {});
  // Merge defaults with any stored overrides so new alert types appear automatically.
  const merged = {};
  for (const type of ALERT_TYPES) {
    merged[type] = { ...DEFAULT_ALERTS[type], ...(stored[type] || {}) };
  }
  return merged;
}

export function getAlert(type) {
  return getAlerts()[type];
}

export function updateAlert(type, patch) {
  if (!ALERT_TYPES.includes(type)) throw new Error(`Unknown alert type: ${type}`);
  const stored = getSetting(SETTING_KEY, {});
  stored[type] = { ...DEFAULT_ALERTS[type], ...(stored[type] || {}), ...patch };
  setSetting(SETTING_KEY, stored);
  return { ...DEFAULT_ALERTS[type], ...stored[type] };
}

function render(template, fields) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, key) =>
    fields[key] !== undefined && fields[key] !== null ? String(fields[key]) : ''
  );
}

/**
 * Build and dispatch an alert to the overlay if the type is enabled.
 * `fields` provides values for the message template (user, amount, tier, ...).
 * Returns the dispatched alert payload, or null when disabled.
 */
export function dispatchAlert(type, fields = {}, { force = false } = {}) {
  const cfg = getAlert(type);
  if (!cfg) return null;
  if (!cfg.enabled && !force) return null;

  const payload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    label: cfg.label,
    text: render(cfg.message, fields),
    accent: cfg.accent,
    duration: cfg.duration,
    sound: cfg.sound || '',
    fields,
    ts: Date.now(),
  };
  hub.sendAlert(payload);
  return payload;
}
