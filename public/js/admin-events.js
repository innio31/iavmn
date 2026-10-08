// public/js/admin-events.js
// Real-time admin notifications via Server-Sent Events (SSE).

(function () {
  'use strict';

  if (!document.body || !document.body.classList.contains('admin-body')) {
    return;
  }

  // ─── Configuration ──────────────────────────────────────
  var ENDPOINT = '/admin/events';
  var TOAST_DURATION = 8000;
  var TOAST_MAX_STACK = 4;
  var DEBUG = false;

  var HANDLERS = {
    'message:new': {
      icon: '✉',
      color: '#25573f',
      title: 'New Contact Message',
      message: function (d) {
        var name = d.name || 'someone';
        var subject = d.subject ? ' — ' + d.subject : '';
        return name + subject;
      },
      href: function (d) { return '/admin/messages/' + d.id; },
      badge: 'messages',
    },
    'subscriber:new': {
      icon: '@',
      color: '#b9a446',
      title: function (d) { return d.reactivated ? 'Subscriber Returned' : 'New Subscriber'; },
      message: function (d) {
        return d.email + (d.reactivated ? ' (resubscribed)' : '');
      },
      href: function () { return '/admin/subscribers'; },
      badge: 'subscribers',
    },
    'application:new': {
      icon: '✔',
      color: '#25573f',
      title: 'New Membership Application',
      message: function (d) {
        return d.full_name + ' applied for ' + (d.tier_name || 'a tier');
      },
      href: function (d) { return '/admin/applications/' + d.id; },
      badge: 'applications',
    },
    'application:payment': {
      icon: '₦',
      color: '#155724',
      title: 'Payment Received',
      message: function (d) {
        var amount = d.amount ? ' ' + (d.currency || 'NGN') + ' ' + Number(d.amount).toLocaleString() : '';
        return d.full_name + ' —' + amount;
      },
      href: function (d) { return '/admin/applications/' + d.id; },
      badge: null,
    },
    'application:status': {
      icon: '◈',
      color: '#6c757d',
      title: 'Application Updated',
      message: function (d) {
        return d.full_name + ': ' + d.from_status + ' → ' + d.to_status;
      },
      href: function (d) { return '/admin/applications/' + d.id; },
      badge: null,
    },
    'member:new': {
      icon: '☰',
      color: '#25573f',
      title: 'New Member',
      message: function (d) {
        return d.full_name + ' (' + d.member_number + ')';
      },
      href: function (d) { return '/admin/members/' + d.id; },
      badge: 'members',
    },
    'member:updated': {
      icon: '◈',
      color: '#6c757d',
      title: 'Member Updated',
      message: function (d) {
        return d.full_name + ': ' + d.from_status + ' → ' + d.to_status;
      },
      href: function (d) { return '/admin/members/' + d.id; },
      badge: null,
    },
  };

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

    var titleText = typeof opts.title === 'function' ? opts.title(opts.data) : opts.title;

    toast.innerHTML =
      '<div class="admin-toast-icon">' + (opts.icon || '•') + '</div>' +
      '<div class="admin-toast-body">' +
        '<div class="admin-toast-title">' + escapeHtml(titleText) + '</div>' +
        '<div class="admin-toast-message">' + escapeHtml(opts.message) + '</div>' +
        (opts.href ? '<a class="admin-toast-link" href="' + escapeAttr(opts.href) + '">View →</a>' : '') +
      '</div>' +
      '<button type="button" class="admin-toast-close" aria-label="Dismiss">×</button>';

    toast.querySelector('.admin-toast-close').addEventListener('click', function () {
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
      state === 'live' ? 'Real-time notifications connected' :
      state === 'connecting' ? 'Connecting to notification stream…' :
      'Notification stream disconnected — will retry automatically';
  }

  // ─── SSE connection ─────────────────────────────────────
  var source = null;
  var reconnectAttempts = 0;

  function connect() {
    setStatus('connecting');

    try {
      source = new EventSource(ENDPOINT);
    } catch (err) {
      console.warn('[admin-events] failed to create EventSource:', err);
      setStatus('offline');
      scheduleReconnect();
      return;
    }

    source.addEventListener('open', function () {
      // The connection is established (headers received).
      // We mark "live" once we get the ready event below.
      if (DEBUG) console.log('[admin-events] connection opened');
    });

    source.addEventListener('ready', function (ev) {
      reconnectAttempts = 0;
      setStatus('live');
      if (DEBUG) console.log('[admin-events] ready:', ev.data);
    });

    function bind(eventName) {
      source.addEventListener(eventName, function (ev) {
        try {
          var data = JSON.parse(ev.data || '{}');
          if (DEBUG) console.log('[admin-events]', eventName, data);
          var handler = HANDLERS[eventName];
          if (!handler) return;

          showToast({
            icon: handler.icon,
            color: handler.color,
            title: handler.title,
            message: handler.message(data),
            href: handler.href ? handler.href(data) : null,
            data: data,
          });

          if (handler.badge) incrementBadge(handler.badge);
        } catch (err) {
          console.warn('[admin-events] failed to handle', eventName, err);
        }
      });
    }

    Object.keys(HANDLERS).forEach(bind);

    source.addEventListener('error', function () {
      if (source.readyState === EventSource.CLOSED) {
        setStatus('offline');
        scheduleReconnect();
      } else {
        setStatus('connecting');
      }
    });
  }

  function scheduleReconnect() {
    reconnectAttempts += 1;
    var delay = Math.min(30000, 1000 * Math.pow(2, Math.min(reconnectAttempts, 5)));
    if (DEBUG) console.log('[admin-events] reconnecting in', delay, 'ms');
    setTimeout(connect, delay);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && source && source.readyState === EventSource.CLOSED) {
      connect();
    }
  });

  // ─── Boot ───────────────────────────────────────────────
  if (window.EventSource) {
    setTimeout(connect, 500);
  } else {
    console.warn('[admin-events] EventSource not supported');
    setStatus('offline');
  }

  window.adminEvents = {
    reconnect: connect,
    close: function () { if (source) source.close(); setStatus('offline'); },
    debug: function (on) { DEBUG = !!on; console.log('[admin-events] debug =', DEBUG); },
  };
})();