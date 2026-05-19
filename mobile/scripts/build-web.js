#!/usr/bin/env node
/**
 * Copy /views into mobile/www, then inject a small bootstrap script into every HTML page so that:
 *  - All relative API/fetch calls are forwarded to the live Aite backend with credentials.
 *  - Server-style routes ("/profile/:id", "/chat", ...) are rewritten to the bundled local files.
 *  - window.location.pathname / search are made to look like the server route so existing page
 *    code (e.g. profile.html reading /profile/:id) keeps working unchanged.
 */
const fs = require('fs');
const path = require('path');

const VIEWS = path.resolve(__dirname, '..', '..', 'views');
const OUT = path.resolve(__dirname, '..', 'www');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    const full = path.join(p, f);
    const stat = fs.lstatSync(full);
    if (stat.isDirectory()) rmrf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(p);
}

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function injectBootstrap(html, bootstrapTag) {
  // Insert bootstrap script as early as possible: after <head> or at top of <html> if no <head>.
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${bootstrapTag}\n`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>${bootstrapTag}</head>`);
  }
  return bootstrapTag + html;
}

console.log('[build-web] cleaning', OUT);
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

const bootstrapTag = '<script src="/aite-bridge.js"></script>';

const entries = fs.readdirSync(VIEWS);
let htmlCount = 0;
let copied = 0;
for (const name of entries) {
  const srcFull = path.join(VIEWS, name);
  const destFull = path.join(OUT, name);
  if (!fs.statSync(srcFull).isFile()) continue;
  if (name.toLowerCase().endsWith('.html')) {
    const html = fs.readFileSync(srcFull, 'utf8');
    fs.writeFileSync(destFull, injectBootstrap(html, bootstrapTag), 'utf8');
    htmlCount++;
  } else {
    copy(srcFull, destFull);
  }
  copied++;
}

// Copy bridge runtime as a top-level asset
const bridgeSrc = path.resolve(__dirname, 'aite-bridge.js');
fs.copyFileSync(bridgeSrc, path.join(OUT, 'aite-bridge.js'));

// Generate a top-level index.html that bootstraps the app. This file is also
// served by Capacitor as a fallback for unknown server-style paths (e.g.
// "/check-status", "/logout"), so the redirect to splash.html is gated to
// only run when we actually landed on "/" / "/index.html". The bridge handles
// every other server-style route itself.
const indexHtml = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Aite</title>
<script src="/aite-bridge.js"></script>
<script>
  (function () {
    var p = location.pathname || '/';
    // The bridge already handles server-style routes (server-only ones like
    // /check-status, and routes that map to a bundled HTML file). Only do the
    // default splash redirect when we're on the real root.
    if (p === '/' || p === '/index.html' || p === '') {
      window.location.replace('splash.html');
    }
  })();
</script>
</head>
<body style="background:#000"></body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml, 'utf8');

console.log('[build-web] copied', copied, 'files (', htmlCount, 'HTML rewritten )');
