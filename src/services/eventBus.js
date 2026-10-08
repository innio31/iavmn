// src/services/eventBus.js
// Simple in-memory pub/sub for server-side events.
//
// Each connected SSE client is registered here. When a controller calls emit(),
// every registered client receives the payload.
//
// Single-process only — fine for HostAfrica's shared hosting, which runs one
// Node process per app. If we ever scale to multiple processes or servers,
// we'd swap this for Redis pub/sub, but that's premature for now.

import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Allow many listeners (each connected admin browser adds one).
bus.setMaxListeners(200);

// Track current client count for logging.
let clientCount = 0;

/**
 * Register an SSE client's send function.
 * Returns an unsubscribe function.
 *
 * @param {(event: string, data: object) => void} sendFn  Callback that writes an SSE frame to the client
 * @returns {() => void} unsubscribe
 */
export const registerClient = (sendFn) => {
  const handler = ({ event, data }) => {
    try {
      sendFn(event, data);
    } catch (err) {
      // Client went away — silently ignore
    }
  };

  bus.on('event', handler);
  clientCount += 1;
  console.log(`[eventBus] client connected (${clientCount} total)`);

  return () => {
    bus.off('event', handler);
    clientCount -= 1;
    console.log(`[eventBus] client disconnected (${clientCount} remaining)`);
  };
};

/**
 * Emit an event to all connected clients.
 *
 * @param {string} event  Event name (e.g., 'message:new')
 * @param {object} data   JSON-serializable payload
 */
export const emit = (event, data = {}) => {
  bus.emit('event', {
    event,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Return the number of currently connected clients.
 */
export const getClientCount = () => clientCount;