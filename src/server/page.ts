/**
 * The control page served at `/`. Self-contained (inline CSS + JS, no
 * external assets) so it works inside Pantheon's embedded view and in a
 * plain browser alike.
 *
 * Theming: Light / Dark / System three-way toggle, default System, stored in
 * localStorage. Inside Pantheon (UA carries `Pantheon/<version>`) the toggle
 * is hidden and the page follows `prefers-color-scheme` live, per Pantheon's
 * embedding contract.
 */
export const CONTROL_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BUSY Bar</title>
<style>
  :root {
    --bg: #f8fafc;
    --panel: #ffffff;
    --text: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --accent: #2563eb;
    --accent-text: #ffffff;
    --on: #16a34a;
    --off: #94a3b8;
    --error: #dc2626;
  }
  :root[data-theme="dark"] {
    --bg: #0f172a;
    --panel: #1e293b;
    --text: #f1f5f9;
    --muted: #94a3b8;
    --border: #334155;
    --accent: #3b82f6;
    --on: #22c55e;
    --off: #475569;
    --error: #f87171;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    padding: 24px 16px;
  }
  main { max-width: 520px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 16px; }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px 20px;
    margin-bottom: 16px;
  }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
  .row + .row { border-top: 1px solid var(--border); }
  .label { font-size: 18px; font-weight: 600; }
  .kind { color: var(--muted); font-size: 13px; font-weight: 400; margin-left: 8px; }
  .note { color: var(--muted); font-size: 14px; margin: 0 0 16px; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button {
    font: inherit; font-size: 16px; padding: 8px 16px; border: 0; cursor: pointer;
    background: transparent; color: var(--text);
  }
  .seg button + button { border-left: 1px solid var(--border); }
  .seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); }
  .seg button:disabled { cursor: progress; opacity: .7; }
  .status { margin: 0 0 16px; font-size: 14px; min-height: 1.5em; }
  .status.busy { animation: busy-pulse 1.3s ease-in-out infinite; color: var(--muted); }
  .status.error { color: var(--error); }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--off); margin-right: 8px; vertical-align: middle; }
  .dot.on { background: var(--on); }
  .theme { display: flex; justify-content: flex-end; }
  .theme[hidden] { display: none !important; }
  .theme .seg button { font-size: 14px; padding: 6px 12px; }
  @keyframes busy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .status.busy { animation: none; } }
</style>
</head>
<body>
<main>
  <h1>BUSY Bar</h1>
  <p class="note">One app shows at a time. The bar can't report what it is showing, so this is the last command sent from here.</p>
  <div class="status" id="status" aria-live="polite"></div>

  <section class="card" id="apps"></section>

  <div class="theme" id="theme">
    <div class="seg" role="group" aria-label="Theme">
      <button type="button" data-theme="light">Light</button>
      <button type="button" data-theme="dark">Dark</button>
      <button type="button" data-theme="system">System</button>
    </div>
  </div>
</main>

<script>
(function () {
  var root = document.documentElement;
  var framed = /\\bPantheon\\//.test(navigator.userAgent);
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var KEY = 'busybar-theme';

  function stored() {
    if (framed) return 'system';
    try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; }
  }
  function apply(pref) {
    var dark = pref === 'dark' || (pref === 'system' && media.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    var buttons = document.querySelectorAll('#theme button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-theme') === pref));
    }
  }
  apply(stored());
  media.addEventListener('change', function () { if (stored() === 'system') apply('system'); });
  var themeEl = document.getElementById('theme');
  if (framed) {
    themeEl.hidden = true;
  } else {
    themeEl.addEventListener('click', function (e) {
      var pref = e.target && e.target.getAttribute && e.target.getAttribute('data-theme');
      if (!pref) return;
      try { localStorage.setItem(KEY, pref); } catch (err) {}
      apply(pref);
    });
  }

  var appsEl = document.getElementById('apps');
  var statusEl = document.getElementById('status');

  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    // America/Regina, not Edmonton: Alberta is permanent UTC-6 since
    // 2026-11-01 (tzdata 2026f) but Electron's bundled ICU still has
    // Edmonton falling back to UTC-7, which showed an hour early inside
    // Pantheon. Regina is fixed UTC-6, the same zone the bar itself runs on.
    return d.toLocaleString('en-CA', { timeZone: 'America/Regina', month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function render(data) {
    appsEl.textContent = '';
    var active = null;
    data.apps.forEach(function (app) {
      if (app.state === 'on') active = app;
      var row = document.createElement('div');
      row.className = 'row';
      var label = document.createElement('div');
      label.className = 'label';
      var dot = document.createElement('span');
      dot.className = 'dot' + (app.state === 'on' ? ' on' : '');
      label.appendChild(dot);
      label.appendChild(document.createTextNode(app.name));
      if (app.kind === 'js') {
        var kind = document.createElement('span');
        kind.className = 'kind';
        kind.textContent = 'JS app';
        label.appendChild(kind);
      }
      if (app.id === 'shuffle') {
        var note = document.createElement('span');
        note.className = 'kind';
        if (app.state === 'on' && data.showing) {
          var showingApp = null;
          data.apps.forEach(function (a) { if (a.id === data.showing) showingApp = a; });
          note.textContent = 'showing ' + (showingApp ? showingApp.name : data.showing) + (data.nextChangeAt ? ', next ' + fmt(data.nextChangeAt) : '');
        } else {
          note.textContent = 'a different animation every 2 hours';
        }
        label.appendChild(note);
      }
      var seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', app.name);
      ['On', 'Off'].forEach(function (text) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        var on = text === 'On';
        b.setAttribute('aria-pressed', String(app.state === (on ? 'on' : 'off')));
        b.setAttribute('data-app', app.id);
        b.setAttribute('data-on', String(on));
        b.addEventListener('click', function () { send(app, on); });
        seg.appendChild(b);
      });
      row.appendChild(label);
      row.appendChild(seg);
      appsEl.appendChild(row);
    });
    statusEl.className = 'status';
    if (!data.changedAt) statusEl.textContent = 'No command sent yet.';
    else if (active) statusEl.textContent = active.name + ' turned on ' + fmt(data.changedAt);
    else statusEl.textContent = 'Turned off ' + fmt(data.changedAt);
  }
  function setBusy(text) {
    var buttons = appsEl.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
    statusEl.className = 'status busy';
    statusEl.textContent = text;
  }
  function setError(text) {
    var buttons = appsEl.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = false;
    statusEl.className = 'status error';
    statusEl.textContent = text;
  }

  function send(app, on) {
    setBusy(on ? 'Starting ' + app.name + ' on the bar\\u2026' : 'Stopping ' + app.name + '\\u2026');
    fetch('/api/apps/' + encodeURIComponent(app.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: on }) })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.body && r.body.error ? r.body.error : 'Request failed');
        render(r.body);
      })
      .catch(function (err) { setError('Failed: ' + err.message); });
  }

  setBusy('Reading the bar\\u2019s app list\\u2026');
  fetch('/api/apps')
    .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
    .then(function (r) {
      if (!r.ok) throw new Error(r.body && r.body.error ? r.body.error : 'Request failed');
      render(r.body);
    })
    .catch(function (err) { setError('Could not read the bar: ' + err.message); });
})();
</script>
</body>
</html>
`;
