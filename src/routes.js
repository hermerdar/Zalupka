import express from 'express';
import { config } from './config.js';
import { hub } from './hub.js';
import { ALERT_TYPES } from './defaults.js';
import { getAlerts, updateAlert, dispatchAlert } from './alerts.js';
import { getCurrencySettings, updateCurrencySettings } from './currency.js';
import { listUsers, getStats, getUserById, adjustBalance, upsertUser } from './db.js';

export const api = express.Router();

api.get('/status', (req, res) => {
  res.json({
    status: hub.status,
    stats: getStats(),
    currency: getCurrencySettings(),
    streamerbot: {
      host: config.streamerbot.host,
      port: config.streamerbot.port,
    },
  });
});

api.get('/events', (req, res) => {
  res.json({ events: hub.recentEvents });
});

// ---- alerts ----
api.get('/alerts', (req, res) => {
  res.json({ types: ALERT_TYPES, alerts: getAlerts() });
});

api.put('/alerts/:type', (req, res) => {
  if (!ALERT_TYPES.includes(req.params.type)) return res.status(404).json({ error: 'unknown alert type' });
  const patch = req.body || {};
  const allowed = ['enabled', 'message', 'duration', 'accent', 'sound', 'label'];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  res.json({ alert: updateAlert(req.params.type, clean) });
});

api.post('/alerts/:type/test', (req, res) => {
  if (!ALERT_TYPES.includes(req.params.type)) return res.status(404).json({ error: 'unknown alert type' });
  const fields = (req.body && req.body.fields) || {
    user: 'TestUser',
    amount: 100,
    tier: '1000',
    months: 12,
    reward: 'Тестовая награда',
    recipient: 'Friend',
  };
  const alert = dispatchAlert(req.params.type, fields, { force: true });
  res.json({ alert });
});

// ---- currency settings ----
api.get('/currency', (req, res) => {
  res.json({ currency: getCurrencySettings() });
});

api.put('/currency', (req, res) => {
  res.json({ currency: updateCurrencySettings(req.body || {}) });
});

// ---- users ----
api.get('/users', (req, res) => {
  const { search = '', sort = 'balance', dir = 'desc' } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  res.json(listUsers({ search, sort, dir, limit, offset }));
});

api.post('/users', (req, res) => {
  const { username, displayName } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });
  const user = upsertUser({ username, displayName });
  hub.notifyUserUpdate(user);
  res.json({ user });
});

api.post('/users/:id/adjust', (req, res) => {
  const id = Number(req.params.id);
  const amount = Math.round(Number(req.body?.amount));
  const reason = req.body?.reason || 'manual';
  if (!getUserById(id)) return res.status(404).json({ error: 'user not found' });
  if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'amount must be a non-zero number' });
  const user = adjustBalance(id, amount, `manual:${reason}`);
  hub.notifyUserUpdate(user);
  res.json({ user });
});
