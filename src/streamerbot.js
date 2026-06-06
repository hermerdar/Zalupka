import { StreamerbotClient } from '@streamerbot/client';
import { config } from './config.js';
import { hub } from './hub.js';
import { upsertUser } from './db.js';
import { dispatchAlert } from './alerts.js';
import { rewardForEvent } from './currency.js';

// ---- field extraction helpers (Streamer.bot payload shapes vary by version) ----

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function extractUser(d) {
  const display = pick(d, ['display_name', 'displayName', 'user_name', 'userName', 'user', 'fromUserName', 'from_broadcaster_user_name']);
  const login = pick(d, ['user_login', 'userLogin', 'login', 'username', 'fromUserLogin']);
  const username = login || display;
  return { username, displayName: display || username };
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Map a raw Streamer.bot Twitch event to a canonical alert + currency action.
function normalizeEvent(source, type, d) {
  if (source !== 'Twitch') return null;
  const { username, displayName } = extractUser(d);

  switch (type) {
    case 'Follow':
      return { alert: 'follow', fields: { user: displayName }, reward: { type: 'follow', username, displayName } };

    case 'Cheer':
    case 'CoinCheer': {
      const bits = num(pick(d, ['bits', 'amount', 'bitsUsed']));
      return {
        alert: 'cheer',
        fields: { user: displayName, amount: bits, message: pick(d, ['message']) || '' },
        reward: { type: 'cheer', username, displayName, multiplier: bits },
      };
    }

    case 'Sub': {
      const tier = pick(d, ['sub_tier', 'subTier', 'tier']) || '';
      return { alert: 'sub', fields: { user: displayName, tier }, reward: { type: 'sub', username, displayName } };
    }

    case 'ReSub': {
      const tier = pick(d, ['sub_tier', 'subTier', 'tier']) || '';
      const months = num(pick(d, ['cumulativeMonths', 'cumulative_months', 'months', 'monthsStreak', 'totalMonths']));
      return { alert: 'resub', fields: { user: displayName, tier, months }, reward: { type: 'resub', username, displayName } };
    }

    case 'GiftSub': {
      const recipient = pick(d, ['recipientDisplayName', 'recipient_user_name', 'recipientUserName']) || '';
      return {
        alert: 'giftsub',
        fields: { user: displayName, amount: 1, recipient },
        reward: { type: 'giftsub', username, displayName, multiplier: 1 },
      };
    }

    case 'GiftBomb': {
      const gifts = num(pick(d, ['gifts', 'totalSubsGifted', 'count', 'amount']), 1);
      return {
        alert: 'giftsub',
        fields: { user: displayName, amount: gifts },
        reward: { type: 'giftsub', username, displayName, multiplier: gifts },
      };
    }

    case 'Raid': {
      const viewers = num(pick(d, ['viewers', 'viewerCount', 'viewer_count', 'count']));
      const raider = pick(d, ['from_broadcaster_user_name', 'fromUserName', 'display_name', 'user_name']) || displayName;
      return {
        alert: 'raid',
        fields: { user: raider, amount: viewers },
        reward: { type: 'raid', username: pick(d, ['from_broadcaster_user_login', 'fromUserLogin']) || username, displayName: raider },
      };
    }

    case 'RewardRedemption':
    case 'AutomaticRewardRedemption': {
      const reward = pick(d, ['rewardName']) || pick(d.reward || {}, ['title', 'name']) || 'награду';
      return {
        alert: 'redeem',
        fields: { user: displayName, reward, message: pick(d, ['message', 'userInput']) || '' },
        reward: { type: 'redeem', username, displayName },
      };
    }

    default:
      return null;
  }
}

function handleTwitchEvent(type, payload) {
  const d = payload?.data ?? payload ?? {};
  const norm = normalizeEvent('Twitch', type, d);

  // Track presence/activity for any identifiable user (drives watch-time payout).
  const { username, displayName } = extractUser(d);
  if (username) upsertUser({ username, displayName });

  if (!norm) return;

  // Currency reward for the event.
  if (norm.reward) {
    rewardForEvent(norm.reward.type, { username: norm.reward.username, displayName: norm.reward.displayName }, norm.reward.multiplier ?? 1);
  }

  // Overlay alert (respects per-type enabled flag).
  const dispatched = dispatchAlert(norm.alert, norm.fields);

  hub.pushEvent({
    source: 'Twitch',
    type,
    alert: norm.alert,
    fields: norm.fields,
    shown: Boolean(dispatched),
    ts: Date.now(),
  });
}

function handleChatMessage(payload) {
  const d = payload?.data ?? payload ?? {};
  const message = d.message || {};
  const username = pick(message, ['username', 'login']) || pick(d, ['user_login', 'userLogin']);
  const displayName = pick(message, ['displayName', 'display_name']) || pick(d, ['display_name']) || username;
  if (!username) return;
  upsertUser({ username, displayName });
  rewardForEvent('chatMessage', { username, displayName });
}

let client = null;

const TWITCH_ALERT_EVENTS = [
  'Follow', 'Cheer', 'CoinCheer', 'Sub', 'ReSub', 'GiftSub', 'GiftBomb',
  'Raid', 'RewardRedemption', 'AutomaticRewardRedemption',
];

export function startStreamerbot() {
  client = new StreamerbotClient({
    host: config.streamerbot.host,
    port: config.streamerbot.port,
    endpoint: config.streamerbot.endpoint,
    password: config.streamerbot.password,
    autoReconnect: true,
    retries: -1,
    logLevel: 'none',
    onConnect: () => hub.setStatus('connected'),
    onDisconnect: () => hub.setStatus('disconnected'),
    onError: () => hub.setStatus('error'),
  });

  for (const type of TWITCH_ALERT_EVENTS) {
    client.on(`Twitch.${type}`, (payload) => {
      try {
        handleTwitchEvent(type, payload);
      } catch (err) {
        console.error(`[streamerbot] error handling Twitch.${type}:`, err.message);
      }
    });
  }

  client.on('Twitch.ChatMessage', (payload) => {
    try {
      handleChatMessage(payload);
    } catch (err) {
      console.error('[streamerbot] error handling chat message:', err.message);
    }
  });

  return client;
}

export function getStreamerbotClient() {
  return client;
}
