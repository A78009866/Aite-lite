/*!
 * Aite mobile bridge
 * Runs inside the Capacitor WebView. Forwards relative network calls to the
 * live Aite backend, rewrites server-style routes to the bundled local files,
 * and preserves the original pathname/search so existing page code keeps
 * working unchanged.
 */
(function () {
  if (window.__AITE_BRIDGE_INSTALLED__) return;
  window.__AITE_BRIDGE_INSTALLED__ = true;

  var API_BASE = 'https://aite-lite.vercel.app';
  window.__AITE_API_BASE__ = API_BASE;

  // ----- route -> local file map -----
  var STATIC_ROUTES = {
    '/': 'splash.html',
    '/login': 'login.html',
    '/register': 'register.html',
    '/forgot-password': 'forgot-password.html',
    '/reset-password': 'reset-password.html',
    '/accounts': 'accounts.html',
    '/chat_list': 'chat_list.html',
    '/users_list': 'users_list.html',
    '/all_users': 'all_users.html',
    '/chat': 'chat.html',
    '/chat.html': 'chat.html',
    '/profile': 'profile.html',
    '/edit_profile': 'edit_profile.html',
    '/create-post': 'create_post.html',
    '/reels': 'reels.html',
    '/create-reel': 'create_reel.html',
    '/stories': 'stories.html',
    '/create-story': 'create_story.html',
    '/notifications': 'notifications.html',
    '/settings': 'settings.html',
    '/admin': 'admin.html',
    '/search': 'search.html',
    '/marketplace': 'marketplace.html',
    '/create_product': 'create_product.html',
    '/post': 'post.html',
    '/post.html': 'post.html',
    '/google-complete-profile': 'google-complete-profile.html'
  };

  var DYNAMIC_ROUTES = [
    { re: /^\/profile\/([^/?#]+)\/?$/, file: 'profile.html' },
    { re: /^\/product\/([^/?#]+)\/?$/, file: 'product_detail.html' },
    { re: /^\/edit_product\/([^/?#]+)\/?$/, file: 'edit_product.html' },
    { re: /^\/stories\/([^/?#]+)\/?$/, file: 'stories.html' },
    { re: /^\/reels\/([^/?#]+)\/?$/, file: 'reels.html' }
  ];

  function splitUrl(input) {
    var m = String(input).match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
    return { path: m[1] || '', search: m[2] || '', hash: m[3] || '' };
  }

  function resolveLocalTarget(serverPath) {
    var parts = splitUrl(serverPath);
    var pure = parts.path;
    if (STATIC_ROUTES[pure]) {
      return { file: STATIC_ROUTES[pure], search: parts.search, hash: parts.hash, fakePath: pure };
    }
    for (var i = 0; i < DYNAMIC_ROUTES.length; i++) {
      var r = DYNAMIC_ROUTES[i];
      if (r.re.test(pure)) {
        return { file: r.file, search: parts.search, hash: parts.hash, fakePath: pure };
      }
    }
    return null;
  }

  // ----- routes that are server-side decisions, not files -----
  //   /check-status -> if authed go to /chat_list, else /accounts
  //   /logout       -> POST /logout to backend, then go to /accounts
  function handleServerOnlyRoute(serverPath) {
    var parts = splitUrl(serverPath);
    var pure = parts.path;
    if (pure === '/check-status') {
      var goAccounts = function () { navigateLocal('/accounts', { replace: true }); };
      var goFeed = function () { navigateLocal('/chat_list', { replace: true }); };
      try {
        fetch(API_BASE + '/api/me', { credentials: 'include' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (data && data.ok && data.userId) goFeed();
            else goAccounts();
          })
          .catch(goAccounts);
      } catch (e) {
        goAccounts();
      }
      return true;
    }
    if (pure === '/logout') {
      try {
        fetch(API_BASE + '/logout', { credentials: 'include' })
          .catch(function () {})
          .then(function () { navigateLocal('/accounts', { replace: true }); });
      } catch (e) {
        navigateLocal('/accounts', { replace: true });
      }
      return true;
    }
    return false;
  }

  // ----- restore the "looks-like-server" pathname/search on page load -----
  try {
    var stored = sessionStorage.getItem('__AITE_FAKE_LOC__');
    if (stored) {
      var data = JSON.parse(stored);
      if (data && data.path) {
        try {
          history.replaceState(history.state, '', data.path + (data.search || '') + (data.hash || ''));
        } catch (e) { /* ignore */ }
      }
      sessionStorage.removeItem('__AITE_FAKE_LOC__');
    }
  } catch (e) { /* ignore */ }

  // ----- catch URL setter bypass for server-only synthetic routes -----
  // The Location.href setter is non-configurable in some Android WebViews, so
  // a direct `window.location.href = '/check-status'` slips past our setter
  // trap and the WebView ends up fetching that URL. Capacitor's local URL
  // handler resolves filename-style paths (e.g. /accounts -> accounts.html)
  // on its own, but it cannot resolve synthetic server-only paths like
  // /check-status or /logout. Detect those here and run the matching handler.
  // Note: do NOT re-navigate for paths that map to a real local file; the
  // WebView already served the right file, and re-navigating would cause an
  // infinite loop.
  (function () {
    try {
      var p = location.pathname || '';
      if (!p || p === '/' || p === '/index.html' || /\.html$/i.test(p)) return;
      handleServerOnlyRoute(p);
    } catch (e) { /* ignore */ }
  })();

  function navigateLocal(serverPath, opts) {
    if (handleServerOnlyRoute(serverPath)) return true;
    var target = resolveLocalTarget(serverPath);
    if (!target) return false;
    try {
      sessionStorage.setItem('__AITE_FAKE_LOC__', JSON.stringify({
        path: target.fakePath,
        search: target.search,
        hash: target.hash
      }));
    } catch (e) { /* ignore */ }
    var localUrl = target.file + (target.search || '') + (target.hash || '');
    if (opts && opts.replace) {
      window.location.replace(localUrl);
    } else {
      window.location.assign(localUrl);
    }
    return true;
  }
  window.__AITE_NAVIGATE__ = navigateLocal;

  // ----- absolutize URLs for network calls -----
  function absolutize(url) {
    if (url == null) return url;
    var s = String(url);
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // already absolute (http/https/data/blob/etc.)
    if (s.indexOf('//') === 0) return s; // protocol-relative
    if (s.charAt(0) === '/') return API_BASE + s;
    // Otherwise relative path inside our bundled views – leave as-is.
    return s;
  }

  // ----- fetch -----
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        if (typeof input === 'string') {
          var abs = absolutize(input);
          if (abs !== input) {
            init = init || {};
            if (!init.credentials) init.credentials = 'include';
            input = abs;
          }
        } else if (input && typeof input === 'object' && typeof input.url === 'string') {
          var abs2 = absolutize(input.url);
          if (abs2 !== input.url) {
            input = new Request(abs2, input);
            init = init || {};
            if (!init.credentials) init.credentials = 'include';
          }
        }
      } catch (e) { /* ignore */ }
      return origFetch(input, init);
    };
  }

  // ----- XMLHttpRequest -----
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      var abs = absolutize(url);
      if (abs !== url) {
        this.withCredentials = true;
        arguments[1] = abs;
      }
    } catch (e) { /* ignore */ }
    return origOpen.apply(this, arguments);
  };

  // ----- EventSource (SSE) -----
  if (typeof EventSource !== 'undefined') {
    var OrigES = EventSource;
    function PatchedES(url, init) {
      try { url = absolutize(url); } catch (e) {}
      init = init || {};
      if (typeof init.withCredentials === 'undefined') init.withCredentials = true;
      return new OrigES(url, init);
    }
    PatchedES.prototype = OrigES.prototype;
    PatchedES.CONNECTING = OrigES.CONNECTING;
    PatchedES.OPEN = OrigES.OPEN;
    PatchedES.CLOSED = OrigES.CLOSED;
    window.EventSource = PatchedES;
  }

  // ----- anchor clicks -----
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return; // mailto:, https:, tel:
    if (href.charAt(0) !== '/') return; // relative file links: let them through
    if (a.target && a.target !== '_self') return;
    var handled = navigateLocal(href);
    if (handled) e.preventDefault();
  }, true);

  // ----- window.location.* -----
  function tryRedirect(value, replace) {
    if (typeof value !== 'string') return false;
    if (!value || value.charAt(0) !== '/') return false;
    return navigateLocal(value, { replace: !!replace });
  }

  var origAssign = window.location.assign.bind(window.location);
  var origReplace = window.location.replace.bind(window.location);
  try {
    window.location.assign = function (url) {
      if (tryRedirect(url, false)) return;
      return origAssign(url);
    };
    window.location.replace = function (url) {
      if (tryRedirect(url, true)) return;
      return origReplace(url);
    };
  } catch (e) { /* some WebViews seal location – fall back to anchor interception */ }

  // location.href = '/x'  – we cannot redefine the descriptor on Location safely
  // in every WebView, so we install a setter trap on document.location via a Proxy
  // is also unreliable. Instead, intercept the most common JS pattern by also
  // watching for navigations triggered after a microtask via popstate / hashchange
  // and a periodic guard. This is a best-effort fallback; almost all in-app code
  // uses anchors or location.assign which we already covered.

  // Catch direct `window.location.href = "/x"` by polling shortly after page idle.
  // Most pages set location.href once per user action, so a single rAF check
  // right after the assignment is enough. We patch via a Proxy on a property
  // descriptor instead.
  try {
    var locProto = Object.getPrototypeOf(window.location);
    if (locProto) {
      var hrefDesc = Object.getOwnPropertyDescriptor(locProto, 'href');
      if (hrefDesc && hrefDesc.configurable && hrefDesc.set) {
        var origSet = hrefDesc.set;
        Object.defineProperty(window.location, 'href', {
          configurable: true,
          enumerable: true,
          get: function () { return location.toString(); },
          set: function (v) {
            if (tryRedirect(v, false)) return;
            origSet.call(window.location, v);
          }
        });
      }
    }
  } catch (e) { /* WebView doesn't allow patching location.href – anchor handler still works */ }

  // ----- splash auto-redirect helper -----
  // The original splash relies on /api/me to decide where to go. Make sure
  // the bridge has time to install before any inline scripts on the page run
  // by exposing a sync helper.
  window.__AITE_PATCH_OK__ = true;
})();
