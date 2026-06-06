// Central pub/sub hub for WebSocket clients (overlay + manager) and a small
// in-memory ring buffer of recent events for the manager live feed.

import { WebSocketServer } from 'ws';

const RECENT_LIMIT = 200;

export class Hub {
  constructor() {
    this.overlayClients = new Set();
    this.managerClients = new Set();
    this.recentEvents = [];
    this.status = { streamerbot: 'disconnected', since: null };
  }

  attach(server) {
    this.overlayWss = new WebSocketServer({ noServer: true });
    this.managerWss = new WebSocketServer({ noServer: true });

    this.overlayWss.on('connection', (ws) => {
      this.overlayClients.add(ws);
      ws.on('close', () => this.overlayClients.delete(ws));
      ws.on('error', () => this.overlayClients.delete(ws));
    });

    this.managerWss.on('connection', (ws) => {
      this.managerClients.add(ws);
      ws.send(JSON.stringify({ type: 'hello', status: this.status, events: this.recentEvents }));
      ws.on('close', () => this.managerClients.delete(ws));
      ws.on('error', () => this.managerClients.delete(ws));
    });

    server.on('upgrade', (req, socket, head) => {
      const { url } = req;
      if (url.startsWith('/ws/overlay')) {
        this.overlayWss.handleUpgrade(req, socket, head, (ws) =>
          this.overlayWss.emit('connection', ws, req)
        );
      } else if (url.startsWith('/ws/manager')) {
        this.managerWss.handleUpgrade(req, socket, head, (ws) =>
          this.managerWss.emit('connection', ws, req)
        );
      } else {
        socket.destroy();
      }
    });
  }

  static #send(clients, payload) {
    const data = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  }

  /** Push an animated alert to every connected overlay. */
  sendAlert(alert) {
    Hub.#send(this.overlayClients, { type: 'alert', alert });
  }

  /** Push an arbitrary message to manager dashboards. */
  toManager(payload) {
    Hub.#send(this.managerClients, payload);
  }

  /** Record an event in the live feed and forward it to managers. */
  pushEvent(evt) {
    const record = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...evt };
    this.recentEvents.unshift(record);
    if (this.recentEvents.length > RECENT_LIMIT) this.recentEvents.pop();
    this.toManager({ type: 'event', event: record });
    return record;
  }

  setStatus(streamerbot) {
    this.status = { streamerbot, since: Date.now() };
    this.toManager({ type: 'status', status: this.status });
  }

  notifyUserUpdate(user) {
    this.toManager({ type: 'user', user });
  }
}

export const hub = new Hub();
