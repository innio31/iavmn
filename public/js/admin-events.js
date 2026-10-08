// public/js/admin-events.js
// Polling-based admin notifications.
//
// Replaces the SSE implementation because HostAfrica's LiteSpeed proxy
// buffers SSE responses and prevents streaming.
//
// Every POLL_INTERVAL seconds we call /admin/events/poll and:
//   1. Show toasts for any item newer than the last batch we saw
//   2. Increment sidebar badge counts for new items
//
// First poll uses a "quiet" mode — it records the current state as the
// baseline and does NOT fire toasts for the initial batch. This prevents
// a burst of stale notifications when you first open the admin.

(function () {
  'use strict';

  if (!document.body || !document.body.classList.contains('admin-body')) {
    return;
  }

  // ─── Configuration ──────────────────────────────────────
  var ENDPOINT = '/admin/events/poll';
  var POLL_INTERVAL = 15000; // 15 seconds
  var TOAST_DURATION = 8000;
  var TOAST_MAX_STACK = 4;
  var DEBUG = false;

  // ─── State ──────────────────────────────────────────────
  var lastPollAt = new Date(Date.now() - 60 * 1000).toISOString(); // start 1 min ago
  var seenMessageIds = new Set();
  var seenApplicationIds = new Set();
  var seenPaymentIds = new Set();
  var hasDoneFirstPoll = false;
  var pollTimer = null;
  var isPolling = false;
  var consecutiveFailures = 0;

  // ─── Event handlers by category ─────────────────────────
  function handleMessage(m) {
    showToast({
      icon: '✉',
      color: '#25573f',
      title: 'New Contact Message',
      message: m.name + (m.subject ? ' — ' + m.subject : ''),
      href: '/admin/messages/' + m.id,
    });
    incrementBadge('messages');
  }

  function handleApplication(a) {
    showToast({
      icon: '✔',
      color: '#25573f',
      title: 'New Membership Application',
      message: a.full_name + ' applied for ' + (a.tier_name || 'a tier'),
      href: '/admin/applications/' + a.id,
    });
    incrementBadge('applications');
  }

  function handlePayment(p) {
    var amount = p.amount
      ? ' ' + (p.currency || 'NGN') + ' ' + Number(p.amount).toLocaleString()
      : '';
    showToast({
      icon: '₦',
      color: '#155724',
      title: 'Payment Received',
      message: p.full_name + ' —' + amount,
      href: '/admin/applications/' + p.id,
    });
  }

  // ─── Toast container ────────────────────────────────────
  function ensureToastContainer() {
    var existing = document.getElementById('admin-toast-container');
    if (existing) return existing;
    var el = document.createElement('div');
    el.id = 'admin-toast-container';
    el.className = 'admin-toast-container';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Notifications');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }

  // ─── Toast rendering ────────────────────────────────────
  function showToast(opts) {
    var container = ensureToastContainer();
    var existing = container.querySelectorAll('.admin-toast');
    if (existing.length >= TOAST_MAX_STACK) {
      removeToast(existing[0]);
    }

    var toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.style.setProperty('--toast-accent', opts.color || '#25573f');

    toast.innerHTML =
      '<div class="admin-toast-icon">' + (opts.icon || '•') + '</div>' +
      '<div class="admin-toast-body">' +
        '<div class="admin-toast-title">' + escapeHtml(opts.title) + '</div>' +
        '<div class="admin-toast-message">' + escapeHtml(opts.message) + '</div>' +
        (opts.href ? '<a class="admin-toast-link" href="' + escapeAttr(opts.href) + '">View →</a>' : '') +
      '</div>' +
      '<button type="button" class="admin-toast-close" aria-label="Dismiss">×</button>';

    toast.querySelector('.admin-toast-close').addEventListener('click', function (ev) {
      ev.stopPropagation();
      removeToast(toast);
    });

    toast.addEventListener('click', function (ev) {
      if (ev.target.tagName === 'A') return;
      removeToast(toast);
    });

    container.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('admin-toast-visible');
    });

    setTimeout(function () {
      removeToast(toast);
    }, TOAST_DURATION);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('admin-toast-visible');
    toast.classList.add('admin-toast-leaving');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }

  // ─── Utilities ──────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // ─── Badge counts ───────────────────────────────────────
  var BADGE_TARGETS = {
    messages:    '/admin/messages',
    applications:'/admin/applications',
    members:     '/admin/members',
    subscribers: '/admin/subscribers',
  };

  function findSidebarLink(href) {
    var links = document.querySelectorAll('.admin-nav-item');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('href') === href) return links[i];
    }
    return null;
  }

  function incrementBadge(badgeKey) {
    if (!badgeKey) return;
    var href = BADGE_TARGETS[badgeKey];
    if (!href) return;
    var link = findSidebarLink(href);
    if (!link) return;
    var badge = link.querySelector('.admin-nav-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'admin-nav-badge';
      badge.textContent = '0';
      link.appendChild(badge);
    }
    var current = parseInt(badge.textContent, 10) || 0;
    badge.textContent = String(current + 1);
    link.classList.add('admin-nav-flash');
    setTimeout(function () { link.classList.remove('admin-nav-flash'); }, 1500);
  }

  // ─── Connection status pill ─────────────────────────────
  function ensureStatusPill() {
    var existing = document.getElementById('admin-conn-pill');
    if (existing) return existing;
    var topbar = document.querySelector('.admin-topbar');
    if (!topbar) return null;
    var pill = document.createElement('div');
    pill.id = 'admin-conn-pill';
    pill.className = 'admin-conn-pill admin-conn-connecting';
    pill.innerHTML =
      '<span class="admin-conn-dot"></span>' +
      '<span class="admin-conn-label">Connecting…</span>';
    pill.title = 'Real-time notifications';
    topbar.appendChild(pill);
    return pill;
  }

  function setStatus(state) {
    var pill = ensureStatusPill();
    if (!pill) return;
    pill.classList.remove('admin-conn-live', 'admin-conn-connecting', 'admin-conn-offline');
    pill.classList.add('admin-conn-' + state);
    var label = pill.querySelector('.admin-conn-label');
    if (label) {
      if (state === 'live') label.textContent = 'Live';
      else if (state === 'connecting') label.textContent = 'Connecting…';
      else label.textContent = 'Offline';
    }
    pill.title =
      state === 'live' ? 'Real-time notifications active (checking every 15s)' :
      state === 'connecting' ? 'Connecting to notification service…' :
      'Notification service offline — will retry automatically';
  }

  // ─── Poll loop ──────────────────────────────────────────
  function poll() {
    if (isPolling) return;
    isPolling = true;

    var url = ENDPOINT + '?since=' + encodeURIComponent(lastPollAt);

    fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        isPolling = false;
        consecutiveFailures = 0;

        // Mark live on first successful poll
        if (!hasDoneFirstPoll) {
          setStatus('live');
          if (DEBUG) console.log('[admin-events] first poll OK');
        }

        processEvents(payload);

        // Move the since cursor forward
        if (payload.now) {
          lastPollAt = payload.now;
        } else {
          lastPollAt = new Date().toISOString();
        }

        hasDoneFirstPoll = true;
      })
      .catch(function (err) {
        isPolling = false;
        consecutiveFailures += 1;
        if (DEBUG) console.warn('[admin-events] poll failed:', err.message);

        // Mark offline after 2 consecutive failures
        if (consecutiveFailures >= 2) {
          setStatus('offline');
        }
      });
  }

  function processEvents(payload) {
    var ev = payload.events || {};
    var messages = ev.messages || [];
    var applications = ev.applications || [];
    var payments = ev.payments || [];

    // ——— Messages ———
    messages.forEach(function (m) {
      if (seenMessageIds.has(m.id)) return;
      seenMessageIds.add(m.id);
      if (hasDoneFirstPoll) handleMessage(m);
    });

    // ——— Applications ———
    applications.forEach(function (a) {
      if (seenApplicationIds.has(a.id)) return;
      seenApplicationIds.add(a.id);
      if (hasDoneFirstPoll) handleApplication(a);
    });

    // ——— Payments ———
    payments.forEach(function (p) {
      if (seenPaymentIds.has(p.id)) return;
      seenPaymentIds.add(p.id);
      if (hasDoneFirstPoll) handlePayment(p);
    });
  }

  // ─── Boot ───────────────────────────────────────────────
  ensureStatusPill();
  setStatus('connecting');

  // Small delay before first poll so the page can finish rendering
  setTimeout(function () {
    poll();
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }, 800);

  // Poll immediately when the tab becomes visible again
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      poll();
    }
  });

  // Manual controls for the browser console
  window.adminEvents = {
    pollNow: poll,
    debug: function (on) { DEBUG = !!on; console.log('[admin-events] debug =', DEBUG); },
    status: function () {
      return {
        lastPollAt: lastPollAt,
        seenMessages: seenMessageIds.size,
        seenApplications: seenApplicationIds.size,
        seenPayments: seenPaymentIds.size,
        hasDoneFirstPoll: hasDoneFirstPoll,
        consecutiveFailures: consecutiveFailures,
      };
    },
  };
})();