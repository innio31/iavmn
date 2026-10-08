// src/controllers/paymentController.js
// Handles the Paystack payment flow for membership applications.

import crypto from 'node:crypto';
import {
  findApplicationByReference,
  findApplicationById,
  updateApplicationPayment,
} from '../models/applicationModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import {
  initializeTransaction,
  verifyTransaction,
  paystackIsConfigured,
  toSmallestUnit,
} from '../services/paystack.js';
import { sendMail } from '../services/mailer.js';
import { emit } from '../services/eventBus.js';
import { clearCountsCache } from '../middleware/notificationCounts.js';

// ─── Public: initiate payment for an application ────────

export const showPayPage = async (req, res, next) => {
  const application = await findApplicationByReference(req.params.reference);
  if (!application) return next();

  if (application.payment_status === 'paid') {
    return res.redirect(`/membership/apply/${application.reference}/success`);
  }

  const feeAmount = Number(application.tier_fee || 0);
  if (feeAmount <= 0) {
    return res.redirect(`/membership/apply/${application.reference}/success`);
  }

  const settings = await getAllSettings();
  const appUrl = (settings && settings.app_url) || process.env.APP_URL || 'http://localhost:3000';

  const callback_url = `${appUrl.replace(/\/$/, '')}/membership/apply/${application.reference}/callback`;

  const init = await initializeTransaction({
    email: application.email,
    amount: toSmallestUnit(feeAmount, application.tier_currency || 'NGN'),
    reference: application.reference,
    callback_url,
    metadata: {
      application_id: application.id,
      tier_name: application.tier_name,
      applicant_name: application.full_name,
    },
  });

  if (!init.ok) {
    console.error('[payment] initialize failed:', init.error);
    req.flash('error', 'We could not start the payment. Please try again or contact us.');
    return res.redirect(`/membership/apply/${application.reference}/success`);
  }

  res.render('membership/pay', {
    title: 'Complete Payment',
    application,
    authorization_url: init.data.authorization_url,
    isMock: Boolean(init.data._mock),
    paystackConfigured: paystackIsConfigured(),
  });
};

// ─── Public: Paystack redirects here after payment ──────

export const handlePaymentCallback = async (req, res) => {
  const reference = req.params.reference;
  const application = await findApplicationByReference(reference);

  if (!application) {
    req.flash('error', 'Application not found.');
    return res.redirect('/');
  }

  const paystackRef = req.query.reference || reference;

  const verify = await verifyTransaction(paystackRef);

  if (!verify.ok) {
    console.error('[payment callback] verify failed:', verify.error);
    req.flash('error', 'We could not verify your payment. Please try again or contact us.');
    return res.redirect(`/membership/apply/${application.reference}/success`);
  }

  const tx = verify.data || {};
  const status = tx.status || 'unknown';

  if (status !== 'success') {
    try {
      await updateApplicationPayment(application.id, {
        payment_status: 'failed',
        payment_reference: tx.reference || reference,
        payment_amount: tx.amount ? tx.amount / 100 : null,
        payment_currency: tx.currency || null,
        payment_paid_at: null,
      });
      clearCountsCache();
    } catch (e) {
      console.error('[payment callback] update failed:', e.message);
    }
    req.flash('error', 'Payment was not successful. You can try again.');
    return res.redirect(`/membership/apply/${application.reference}/success`);
  }

  // Success
  await updateApplicationPayment(application.id, {
    payment_status: 'paid',
    payment_reference: tx.reference || reference,
    payment_amount: tx.amount ? tx.amount / 100 : null,
    payment_currency: tx.currency || 'NGN',
    payment_paid_at: tx.paid_at ? new Date(tx.paid_at) : new Date(),
  });

  clearCountsCache();

  // Real-time event for admin dashboards
  try {
    const updated = await findApplicationById(application.id);
    emit('application:payment', {
      id: updated.id,
      reference: updated.reference,
      full_name: updated.full_name,
      email: updated.email,
      amount: updated.payment_amount,
      currency: updated.payment_currency,
      tier_name: updated.tier_name,
      paid_at: updated.payment_paid_at,
    });
  } catch (err) {
    console.error('[payment callback] emit failed:', err.message);
  }

  // Emails (best effort)
  try {
    const updated = await findApplicationById(application.id);
    const settings = await getAllSettings();

    await sendMail({
      to: updated.email,
      subject: `Payment confirmed — ${updated.reference}`,
      template: 'payment-confirmed',
      data: {
        application: updated,
        appName: process.env.APP_NAME || 'IAVMN',
        settings,
      },
    });

    const adminRecipient =
      (settings.mail_admin_recipient && settings.mail_admin_recipient.trim()) ||
      (settings.contact_email && settings.contact_email.trim()) ||
      null;

    if (adminRecipient) {
      await sendMail({
        to: adminRecipient,
        subject: `Payment received — ${updated.reference}`,
        template: 'payment-admin-notification',
        data: {
          application: updated,
          appName: process.env.APP_NAME || 'IAVMN',
          settings,
        },
      });
    }
  } catch (err) {
    console.error('[payment callback] email failed:', err.message);
  }

  req.flash('success', 'Payment received — thank you!');
  return res.redirect(`/membership/apply/${application.reference}/success`);
};

// ─── Public (dev only): mock checkout page ──────────────

export const showMockCheckout = async (req, res, next) => {
  if (paystackIsConfigured()) {
    return next();
  }

  const application = await findApplicationByReference(req.params.reference);
  if (!application) return next();

  res.render('membership/mock-checkout', {
    title: 'Test Checkout',
    application,
  });
};

// ─── Public: Paystack webhook (server-to-server) ────────

export const handlePaystackWebhook = async (req, res) => {
  const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const signature = req.get('x-paystack-signature') || '';

  if (!secret || secret.includes('xxxxxxxxxxxx')) {
    return res.status(200).send('ignored');
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  if (expected !== signature) {
    console.warn('[paystack webhook] invalid signature');
    return res.status(401).send('invalid signature');
  }

  const event = req.body;

  try {
    if (event && event.event === 'charge.success') {
      const data = event.data || {};
      const reference = data.reference;
      if (reference) {
        const application = await findApplicationByReference(reference);
        if (application && application.payment_status !== 'paid') {
          await updateApplicationPayment(application.id, {
            payment_status: 'paid',
            payment_reference: reference,
            payment_amount: data.amount ? data.amount / 100 : null,
            payment_currency: data.currency || 'NGN',
            payment_paid_at: data.paid_at ? new Date(data.paid_at) : new Date(),
          });
          clearCountsCache();

          // Real-time event
          try {
            const updated = await findApplicationById(application.id);
            emit('application:payment', {
              id: updated.id,
              reference: updated.reference,
              full_name: updated.full_name,
              email: updated.email,
              amount: updated.payment_amount,
              currency: updated.payment_currency,
              tier_name: updated.tier_name,
              paid_at: updated.payment_paid_at,
              source: 'webhook',
            });
          } catch (emitErr) {
            console.error('[paystack webhook] emit failed:', emitErr.message);
          }

          console.log('[paystack webhook] application', reference, 'marked paid');
        }
      }
    }
  } catch (err) {
    console.error('[paystack webhook] handler error:', err.message);
  }

  res.status(200).send('ok');
};

// ─── Admin (optional): verify Paystack configuration ────

export const showPaystackTest = async (req, res) => {
  const result = {
    configured: paystackIsConfigured(),
    publicKeySet: Boolean((process.env.PAYSTACK_PUBLIC_KEY || '').trim()),
    secretKeySet: Boolean((process.env.PAYSTACK_SECRET_KEY || '').trim()),
    secretKeyPrefix: (process.env.PAYSTACK_SECRET_KEY || '').slice(0, 3),
  };
  res.render('admin/paystack-test', {
    title: 'Paystack Test',
    layout: 'layouts/admin',
    result,
  });
};