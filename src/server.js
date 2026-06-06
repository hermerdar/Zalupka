import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { hub } from './hub.js';
import { api } from './routes.js';
import { startStreamerbot } from './streamerbot.js';
import { startCurrencyAccrual } from './currency.js';

const app = express();
app.use(express.json());
app.use('/api', api);

const publicDir = path.join(config.rootDir, 'public');
app.use('/overlay', express.static(path.join(publicDir, 'overlay')));
app.use('/', express.static(path.join(publicDir, 'manager')));

const server = http.createServer(app);
hub.attach(server);

server.listen(config.port, () => {
  console.log('');
  console.log('  Streamer.bot Overlay Manager');
  console.log('  ────────────────────────────');
  console.log(`  Manager:  http://localhost:${config.port}/`);
  console.log(`  Overlay:  http://localhost:${config.port}/overlay   <- add as OBS Browser Source`);
  console.log(`  Streamer.bot WS: ws://${config.streamerbot.host}:${config.streamerbot.port}${config.streamerbot.endpoint}`);
  console.log('');

  startStreamerbot();
  startCurrencyAccrual();
});
