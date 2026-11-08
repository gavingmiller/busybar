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
    padding: 20px;
    margin-bottom: 16px;
  }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .label { font-size: 18px; font-weight: 600; }
  .note { color: var(--muted); font-size: 14px; margin: 12px 0 0; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .seg button {
    font: inherit; font-size: 16px; padding: 8px 16px; border: 0; cursor: pointer;
    background: transparent; color: var(--text);
  }
  .seg button + button { border-left: 1px solid var(--border); }
  .seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); }
  .seg button:disabled { cursor: progress; opacity: .7; }
  .status { margin-top: 12px; font-size: 14px; min-height: 1.5em; }
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

  <section class="card">
    <div class="row">
      <div class="label"><span class="dot" id="dot"></span>Nyan Cat</div>
      <div class="seg" role="group" aria-label="Nyan Cat">
        <button type="button" id="btn-on" aria-pressed="false">On</button>
        <button type="button" id="btn-off" aria-pressed="false">Off</button>
      </div>
    </div>
    <div class="status" id="status" aria-live="polite"></div>
    <p class="note" id="note">The bar can't report what it is showing, so this is the last command sent from here.</p>
  </section>

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

  var btnOn = document.getElementById('btn-on');
  var btnOff = document.getElementById('btn-off');
  var statusEl = document.getElementById('status');
  var dot = document.getElementById('dot');

  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    // America/Regina, not Edmonton: Alberta is permanent UTC-6 since
    // 2026-11-01 (tzdata 2026f) but Electron's bundled ICU still has
    // Edmonton falling back to UTC-7, which showed an hour early inside
    // Pantheon. Regina is fixed UTC-6, the same zone the bar itself runs on.
    return d.toLocaleString('en-CA', { timeZone: 'America/Regina', month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function render(s) {
    btnOn.setAttribute('aria-pressed', String(s.state === 'on'));
    btnOff.setAttribute('aria-pressed', String(s.state === 'off'));
    dot.className = 'dot' + (s.state === 'on' ? ' on' : '');
    statusEl.className = 'status';
    if (s.state === 'unknown') statusEl.textContent = 'No command sent yet.';
    else statusEl.textContent = (s.state === 'on' ? 'Turned on ' : 'Turned off ') + fmt(s.changedAt);
  }
  function setBusy(text) {
    btnOn.disabled = true; btnOff.disabled = true;
    statusEl.className = 'status busy';
    statusEl.textContent = text;
  }
  function setError(text) {
    btnOn.disabled = false; btnOff.disabled = false;
    statusEl.className = 'status error';
    statusEl.textContent = text;
  }
  function done(s) {
    btnOn.disabled = false; btnOff.disabled = false;
    render(s);
  }

  function send(on) {
    setBusy(on ? 'Drawing Nyan Cat on the bar\\u2026' : 'Clearing the bar\\u2026');
    fetch('/api/nyan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: on }) })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.body && r.body.error ? r.body.error : 'Request failed');
        done(r.body);
      })
      .catch(function (err) { setError('Failed: ' + err.message); });
  }
  btnOn.addEventListener('click', function () { send(true); });
  btnOff.addEventListener('click', function () { send(false); });

  fetch('/api/nyan').then(function (r) { return r.json(); }).then(render)
    .catch(function (err) { setError('Could not read state: ' + err.message); });
})();
</script>
</body>
</html>
`;
