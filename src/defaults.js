// Canonical alert types shown on the overlay. Streamer.bot/Twitch events are
// normalized into one of these types (see streamerbot.js -> normalizeEvent).

export const ALERT_TYPES = ['follow', 'sub', 'resub', 'giftsub', 'raid', 'cheer', 'redeem'];

export const DEFAULT_ALERTS = {
  follow: {
    label: 'Фолловер',
    enabled: true,
    message: '{user} зафолловил!',
    duration: 6000,
    accent: '#a970ff',
    sound: '',
  },
  sub: {
    label: 'Подписка',
    enabled: true,
    message: '{user} оформил подписку! ({tier})',
    duration: 8000,
    accent: '#ff4d8d',
    sound: '',
  },
  resub: {
    label: 'Ресаб',
    enabled: true,
    message: '{user} продлил подписку — {months} мес.!',
    duration: 8000,
    accent: '#ff6ad5',
    sound: '',
  },
  giftsub: {
    label: 'Подарочные подписки',
    enabled: true,
    message: '{user} подарил {amount} подписок!',
    duration: 9000,
    accent: '#ffb347',
    sound: '',
  },
  raid: {
    label: 'Рейд',
    enabled: true,
    message: '{user} приехал с рейдом ({amount} зрителей)!',
    duration: 9000,
    accent: '#4dd2ff',
    sound: '',
  },
  cheer: {
    label: 'Биты (Cheer)',
    enabled: true,
    message: '{user} закинул {amount} битов!',
    duration: 8000,
    accent: '#9147ff',
    sound: '',
  },
  redeem: {
    label: 'Баллы канала',
    enabled: true,
    message: '{user} активировал «{reward}»',
    duration: 7000,
    accent: '#00d18f',
    sound: '',
  },
};

export const DEFAULT_CURRENCY = {
  currencyName: 'Монеты',
  currencySymbol: '🪙',
  // Currency earned per minute for users who chatted within the active window.
  perMinute: 10,
  activeWindowMinutes: 10,
  // One-off rewards granted when an event fires.
  rewards: {
    follow: 100,
    sub: 500,
    resub: 500,
    giftsub: 200, // per gifted sub
    raid: 50, // flat per raid
    cheer: 1, // per bit
    redeem: 0,
    chatMessage: 0, // per chat message (besides per-minute accrual)
  },
};
