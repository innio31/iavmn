// src/controllers/eventsController.js
// Server-Sent Events (SSE) endpoint for the admin dashboard.
// Only authenticated admin users can connect.

import { registerClient, getClientCount } from '../services/eventBus.js';

// Heartbeat every 10s — fast enough to defeat nginx/LiteSpeed proxy buffering,
// slow enough to avoid wasted traffic.
const HEARTBEAT_INTERVAL_MS = 10 * 1000;

/**
 * GET /admin/events
 * Long-lived SSE stream.
 */
export const streamEvents = (req, res) => {
  // ─── SSE headers ───
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // Disable buffering on nginx
    'X-Accel-Buffering': 'no',
    // Disable buffering on LiteSpeed (HostAfrica often runs this)
    'X-LiteSpeed-Cache-Control': 'no-cache',
  });
  res.flushHeaders && res.flushHeaders();

  // ─── Padding to force proxies to commit to streaming ───
  // Some proxies wait for a minimum amount of data before flushing.
  // Sending 2 KB of comment immediately forces the connection open.
  res.write(':' + ' '.repeat(2048) + '\n\n');

  // ─── Initial ready event ───
  const initialPayload = JSON.stringify({
    ok: true,
    clients: getClientCount() + 1,
    time: new Date().toISOString(),
  });
  res.write(`event: ready\ndata: ${initialPayload}\n\n`);

  // ─── Register this client with the event bus ───
  const sendFn = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const unsubscribe = registerClient(sendFn);

  // ─── Heartbeat loop ───
  // Comment lines (starting with ":") are valid SSE and are ignored by
  // the browser but keep the connection alive through proxies.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (err) {
      // Client disconnected — cleanup will run below
    }
  }, HEARTBEAT_INTERVAL_MS);

  // ─── Cleanup on disconnect ───
  const cleanup = () => {
    clearInterval(heartbeat);
    try { unsubscribe(); } catch (e) { /* ignore */ }
    try { res.end(); } catch (e) { /* ignore */ }
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  req.on('error', cleanup);
};