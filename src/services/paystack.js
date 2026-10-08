// src/services/paystack.js
// Thin wrapper around Paystack's REST API.
// Docs: https://paystack.com/docs/api/
//
// Behavior:
//   - If PAYSTACK_SECRET_KEY is not configured, initializeTransaction()
//     returns a "mock" response that lets the flow work in dev.
//   - All functions return { ok, data?, error? } so callers never throw.

import 'dotenv/config';

const BASE_URL = 'https://api.paystack.co';

const isConfigured = () => {
  const key = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!key) return false;
  if (!key.startsWith('sk_')) return false;
  // Placeholder-like test keys end with "xxxxxxxxxxxxxxxxxxxx"
  if (key.includes('xxxxxxxxxxxx')) return false;
  return true;
};

/**
 * Perform a JSON request to Paystack.
 */
const request = async (method, path, body = null) => {
  const key = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const url = BASE_URL + path;

  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === false) {
      return {
        ok: false,
        error: (json && json.message) || `HTTP ${res.status}`,
        data: json,
      };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

/**
 * Initialize a transaction.
 *
 * @param {object} opts
 * @param {string} opts.email       Customer email
 * @param {number} opts.amount      In the smallest currency unit (kobo for NGN). E.g. NGN 5000 = 500000.
 * @param {string} opts.reference   Unique reference (our application.reference)
 * @param {string} [opts.callback_url]
 * @param {object} [opts.metadata]
 *
 * @returns {Promise<{ ok: boolean, data?: { authorization_url, access_code, reference }, error?: string }>}
 */
export const initializeTransaction = async (opts) => {
  const { email, amount, reference, callback_url, metadata } = opts;

  if (!isConfigured()) {
    // Dev fallback: pretend Paystack initialized and send the user to
    // a local mock checkout page. This lets us test the full flow without keys.
    const mockUrl = `/membership/apply/${encodeURIComponent(reference)}/mock-checkout`;
    console.warn('[paystack] Not configured — using mock checkout at', mockUrl);
    return {
      ok: true,
      data: {
        authorization_url: mockUrl,
        access_code: 'mock_access_' + Date.now(),
        reference,
        _mock: true,
      },
    };
  }

  return request('POST', '/transaction/initialize', {
    email,
    amount, // smallest unit
    reference,
    callback_url,
    metadata,
  });
};

/**
 * Verify a transaction by reference.
 *
 * @param {string} reference
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export const verifyTransaction = async (reference) => {
  if (!isConfigured()) {
    // Dev fallback: treat as successful. Only used when running mock checkout.
    return {
      ok: true,
      data: {
        status: 'success',
        reference,
        amount: 0,
        currency: 'NGN',
        paid_at: new Date().toISOString(),
        _mock: true,
      },
    };
  }

  return request('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
};

/**
 * Return whether Paystack is configured for real transactions.
 */
export const paystackIsConfigured = () => isConfigured();

/**
 * Small helper to convert a fee in major units (e.g. NGN 5000) to
 * Paystack's smallest unit (kobo = 500000).
 */
export const toSmallestUnit = (amount, currency = 'NGN') => {
  // NGN, GHS, ZAR, USD, KES, etc. — Paystack treats NGN/GHS/ZAR as 2-decimal.
  return Math.round(Number(amount) * 100);
};