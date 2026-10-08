// public/js/pwa-install.js
// Manages the PWA install button.
//
// How it works:
//   1. Browsers fire a `beforeinstallprompt` event when a site is installable
//   2. We intercept it, stash the event, and reveal the Install button
//   3. When the user clicks the button, we call the stashed event's prompt()
//   4. After the user responds, we hide the button and clean up
//
// On browsers that don't support PWA installation (e.g. older iOS Safari),
// the button simply never appears — no errors.

(function () {
  'use strict';

  var INSTALL_BTN_ID = 'pwaInstallBtn';
  var DISMISS_KEY = 'iavmn_install_dismissed';
  var deferredPrompt = null;

  function getButton() {
    return document.getElementById(INSTALL_BTN_ID);
  }

  function showButton() {
    var btn = getButton();
    if (!btn) return;
    btn.hidden = false;
  }

  function hideButton() {
    var btn = getButton();
    if (!btn) return;
    btn.hidden = true;
  }

  // ─── Capture the prompt event ───────────────────────────
  window.addEventListener('beforeinstallprompt', function (ev) {
    // Prevent the mini-infobar that Chrome shows on mobile
    ev.preventDefault();

    // Stash the event so we can trigger it later
    deferredPrompt = ev;

    // If the user previously dismissed, don't nag
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        return;
      }
    } catch (e) {
      // localStorage unavailable — proceed anyway
    }

    showButton();
  });

  // ─── Handle the click ───────────────────────────────────
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('#' + INSTALL_BTN_ID);
    if (!btn) return;

    if (!deferredPrompt) {
      // No prompt available (already installed, unsupported browser, etc.)
      hideButton();
      return;
    }

    btn.disabled = true;

    deferredPrompt.prompt();

    deferredPrompt.userChoice
      .then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          console.log('[pwa] user accepted install');
        } else {
          console.log('[pwa] user dismissed install');
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch (e) { /* ignore */ }
        }
      })
      .catch(function (err) {
        console.warn('[pwa] userChoice error:', err);
      })
      .finally(function () {
        deferredPrompt = null;
        hideButton();
      });
  });

  // ─── Hide the button if the app is already installed ────
  window.addEventListener('appinstalled', function () {
    console.log('[pwa] app installed');
    deferredPrompt = null;
    hideButton();
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch (e) { /* ignore */ }
  });

  // ─── Also hide if running in standalone mode ────────────
  // (means the user already installed the app)
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      hideButton();
    } else if (window.navigator.standalone === true) {
      // iOS Safari has a separate flag
      hideButton();
    }
  } catch (e) {
    // ignore
  }
})();