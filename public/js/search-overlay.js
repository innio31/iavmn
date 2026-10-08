// public/js/search-overlay.js
// Header search overlay with debounced as-you-type suggestions.
// Keyboard-navigable: ↑ ↓ to move, Enter to open, Esc to close.

(function () {
  'use strict';

  var overlay = document.getElementById('searchOverlay');
  if (!overlay) return;

  var input = document.getElementById('overlaySearchInput');
  var suggestionsPanel = document.getElementById('overlaySuggestions');
  var suggestionsList = document.getElementById('overlaySuggestionList');
  var seeAllLink = document.getElementById('overlaySeeAllLink');

  var DEBOUNCE_MS = 220;
  var MIN_QUERY = 2;

  var debounceTimer = null;
  var currentRequest = 0;
  var currentItems = [];
  var currentIndex = -1;

  // ─── Open / close ───────────────────────────────────────

  window.openSearchOverlay = function () {
    overlay.classList.add('search-overlay-open');
    document.body.classList.add('search-overlay-active');
    // Slight delay so the animation starts before focus
    setTimeout(function () {
      if (input) input.focus();
    }, 60);
  };

  window.closeSearchOverlay = function () {
    overlay.classList.remove('search-overlay-open');
    document.body.classList.remove('search-overlay-active');
    hideSuggestions();
    if (input) input.value = '';
    currentItems = [];
    currentIndex = -1;
  };

  // ─── Submit handling ────────────────────────────────────

  window.handleOverlaySubmit = function (ev) {
    // If a suggestion is highlighted, navigate to it instead of submitting
    if (currentIndex >= 0 && currentItems[currentIndex]) {
      ev.preventDefault();
      window.location.href = currentItems[currentIndex].url;
      return false;
    }
    var q = input ? input.value.trim() : '';
    if (!q) {
      ev.preventDefault();
      return false;
    }
    return true;
  };

  // ─── Suggestions ────────────────────────────────────────

  function hideSuggestions() {
    if (suggestionsPanel) suggestionsPanel.hidden = true;
    if (suggestionsList) suggestionsList.innerHTML = '';
    currentIndex = -1;
  }

  function showLoading() {
    if (!suggestionsPanel) return;
    suggestionsList.innerHTML = '<div class="search-suggestion-loading">Searching…</div>';
    suggestionsPanel.hidden = false;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function iconForType(type) {
    switch (type) {
      case 'post':    return '✎';
      case 'page':    return '▦';
      case 'council': return '☺';
      case 'faq':     return '?';
      case 'tier':    return '★';
      default:        return '•';
    }
  }

  function renderSuggestions(items, query, count) {
    if (!suggestionsList || !suggestionsPanel) return;

    if (!items.length) {
      suggestionsList.innerHTML =
        '<div class="search-suggestion-empty">' +
        'No matches for &ldquo;' + escapeHtml(query) + '&rdquo;' +
        '</div>';
      suggestionsPanel.hidden = false;
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html +=
        '<a href="' + escapeHtml(it.url) + '" ' +
        'class="search-suggestion" ' +
        'data-index="' + i + '">' +
          '<span class="search-suggestion-icon">' + iconForType(it.type) + '</span>' +
          '<span class="search-suggestion-body">' +
            '<span class="search-suggestion-label">' + escapeHtml(it.label) + '</span>' +
            (it.sub ? '<span class="search-suggestion-sub">' + escapeHtml(it.sub) + '</span>' : '') +
          '</span>' +
        '</a>';
    }
    suggestionsList.innerHTML = html;
    suggestionsPanel.hidden = false;

    // Set "see all" URL
    if (seeAllLink) {
      seeAllLink.setAttribute('href', '/search?q=' + encodeURIComponent(query));
    }
  }

  // ─── Fetch suggestions ──────────────────────────────────

  function fetchSuggestions(query) {
    currentRequest += 1;
    var reqId = currentRequest;

    showLoading();

    fetch('/search/suggest?q=' + encodeURIComponent(query), {
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        // Ignore responses from stale requests
        if (reqId !== currentRequest) return;
        currentItems = data.results || [];
        currentIndex = -1;
        renderSuggestions(currentItems, query, data.count || currentItems.length);
      })
      .catch(function (err) {
        if (reqId !== currentRequest) return;
        console.warn('[search-overlay] fetch failed:', err);
        hideSuggestions();
      });
  }

  // ─── Input events ───────────────────────────────────────

  if (input) {
    input.addEventListener('input', function () {
      var q = this.value.trim();
      clearTimeout(debounceTimer);

      if (q.length < MIN_QUERY) {
        hideSuggestions();
        return;
      }

      debounceTimer = setTimeout(function () {
        fetchSuggestions(q);
      }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        moveSelection(1);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        moveSelection(-1);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        closeSearchOverlay();
      }
    });
  }

  function moveSelection(delta) {
    if (!currentItems.length) return;
    currentIndex += delta;
    if (currentIndex < 0) currentIndex = currentItems.length - 1;
    if (currentIndex >= currentItems.length) currentIndex = 0;
    updateHighlight();
  }

  function updateHighlight() {
    if (!suggestionsList) return;
    var nodes = suggestionsList.querySelectorAll('.search-suggestion');
    for (var i = 0; i < nodes.length; i++) {
      if (i === currentIndex) {
        nodes[i].classList.add('search-suggestion-active');
        // Scroll into view within the panel
        var parent = suggestionsList;
        var nodeTop = nodes[i].offsetTop;
        var nodeBottom = nodeTop + nodes[i].offsetHeight;
        if (nodeTop < parent.scrollTop) {
          parent.scrollTop = nodeTop;
        } else if (nodeBottom > parent.scrollTop + parent.clientHeight) {
          parent.scrollTop = nodeBottom - parent.clientHeight;
        }
      } else {
        nodes[i].classList.remove('search-suggestion-active');
      }
    }
  }

  // ─── Global key handler (Escape anywhere in overlay) ────

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && overlay.classList.contains('search-overlay-open')) {
      closeSearchOverlay();
    }
  });

  // Click backdrop to close
  overlay.addEventListener('click', function (ev) {
    if (ev.target === overlay) closeSearchOverlay();
  });
})();