import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    platform         TEXT    NOT NULL DEFAULT 'twitch',
    platform_user_id TEXT,
    username         TEXT    NOT NULL,
    display_name     TEXT,
    balance          INTEGER NOT NULL DEFAULT 0,
    total_earned     INTEGER NOT NULL DEFAULT 0,
    last_active      INTEGER,
    created_at       INTEGER NOT NULL,
    UNIQUE(platform, username)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    amount     INTEGER NOT NULL,
    reason     TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);
  CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
`);

const stmts = {
  getUserByUsername: db.prepare(
    `SELECT * FROM users WHERE platform = ? AND username = ?`
  ),
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  insertUser: db.prepare(
    `INSERT INTO users (platform, platform_user_id, username, display_name, balance, total_earned, last_active, created_at)
     VALUES (@platform, @platform_user_id, @username, @display_name, 0, 0, @last_active, @created_at)`
  ),
  touchUser: db.prepare(
    `UPDATE users SET display_name = COALESCE(@display_name, display_name),
       platform_user_id = COALESCE(@platform_user_id, platform_user_id),
       last_active = @last_active
     WHERE id = @id`
  ),
  addBalance: db.prepare(
    `UPDATE users SET balance = balance + @amount,
       total_earned = total_earned + CASE WHEN @amount > 0 THEN @amount ELSE 0 END
     WHERE id = @id`
  ),
  insertTx: db.prepare(
    `INSERT INTO transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, ?)`
  ),
  getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  upsertSetting: db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ),
};

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

export function upsertUser({ username, displayName, platform = 'twitch', platformUserId = null }) {
  const uname = normalizeName(username);
  if (!uname) return null;
  const now = Date.now();
  let user = stmts.getUserByUsername.get(platform, uname);
  if (!user) {
    stmts.insertUser.run({
      platform,
      platform_user_id: platformUserId,
      username: uname,
      display_name: displayName || username,
      last_active: now,
      created_at: now,
    });
    user = stmts.getUserByUsername.get(platform, uname);
  } else {
    stmts.touchUser.run({
      id: user.id,
      display_name: displayName || null,
      platform_user_id: platformUserId,
      last_active: now,
    });
    user = stmts.getUserById.get(user.id);
  }
  return user;
}

/** Add (or subtract) currency to a user and record a transaction. Returns updated user. */
export function adjustBalance(userId, amount, reason) {
  const tx = db.transaction(() => {
    stmts.addBalance.run({ id: userId, amount });
    stmts.insertTx.run(userId, amount, reason, Date.now());
    return stmts.getUserById.get(userId);
  });
  return tx();
}

/** Convenience: award currency by username, creating the user if needed. */
export function award({ username, displayName, amount, reason, platform = 'twitch' }) {
  const user = upsertUser({ username, displayName, platform });
  if (!user) return null;
  return adjustBalance(user.id, amount, reason);
}

export function getUserById(id) {
  return stmts.getUserById.get(id);
}

export function listUsers({ search = '', sort = 'balance', dir = 'desc', limit = 100, offset = 0 } = {}) {
  const sortCols = { balance: 'balance', total_earned: 'total_earned', last_active: 'last_active', username: 'username', created_at: 'created_at' };
  const col = sortCols[sort] || 'balance';
  const direction = dir === 'asc' ? 'ASC' : 'DESC';
  const where = search ? `WHERE username LIKE @like OR display_name LIKE @like` : '';
  const rows = db
    .prepare(`SELECT * FROM users ${where} ORDER BY ${col} ${direction} LIMIT @limit OFFSET @offset`)
    .all({ like: `%${normalizeName(search)}%`, limit, offset });
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM users ${where}`)
    .get({ like: `%${normalizeName(search)}%` }).c;
  return { rows, total };
}

export function getStats() {
  const row = db
    .prepare(`SELECT COUNT(*) AS users, COALESCE(SUM(balance), 0) AS circulating, COALESCE(SUM(total_earned), 0) AS earned FROM users`)
    .get();
  return row;
}

export function getActiveUsers(sinceMs) {
  return db.prepare(`SELECT * FROM users WHERE last_active >= ?`).all(sinceMs);
}

export function getSetting(key, fallback = null) {
  const row = stmts.getSetting.get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

export function setSetting(key, value) {
  stmts.upsertSetting.run(key, JSON.stringify(value));
  return value;
}
