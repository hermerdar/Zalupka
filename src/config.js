import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function resolveFromRoot(p) {
  return path.isAbsolute(p) ? p : path.resolve(rootDir, p);
}

export const config = {
  rootDir,
  port: Number(process.env.PORT || 4848),
  streamerbot: {
    host: process.env.STREAMERBOT_HOST || '127.0.0.1',
    port: Number(process.env.STREAMERBOT_PORT || 8080),
    endpoint: process.env.STREAMERBOT_ENDPOINT || '/',
    password: process.env.STREAMERBOT_PASSWORD || undefined,
  },
  dbPath: resolveFromRoot(process.env.DB_PATH || './data/app.sqlite'),
};
