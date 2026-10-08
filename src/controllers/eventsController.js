// src/controllers/eventsController.js
// Server-Sent Events (SSE) endpoint for the admin dashboard.
// Only authenticated admin users can connect.

import { registerClient, getClientCount } from '../services/eventBus.js';

const HEARTBEAT_INTERVAL_MS = 25 * 1000; // 25 seconds — keeps proxies from closing the connection

/**
 * GET /admin/events
 * Long-lived SSE stream. Sends heartbeats every 25s to keep the connection alive.
 */
export const streamEvents = (req, res) => {
  // SSE headers
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable buffering on nginx/Apache reverse proxies
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders && res.flushHeaders();

  // Send initial ready event
  const initialPayload = JSON.stringify({
    ok: true,
    clients: getClientCount() + 1,
    time: new Date().toISOString(),
  });
  res.write(`event: ready\ndata: ${initialPayload}\n\n`);

  // Send an SSE frame for each bus event
  const sendFn = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const unsubscribe = registerClient(sendFn);

  // Heartbeat — comment lines keep the connection alive without firing events
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (err) {
      // ignore — cleanup will run via close handler
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Cleanup on client disconnect
  const cleanup = () => {
    clearInterval(heartbeat);
    try { unsubscribe(); } catch (e) {}
    try { res.end(); } catch (e) {}
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  req.on('error', cleanup);
};