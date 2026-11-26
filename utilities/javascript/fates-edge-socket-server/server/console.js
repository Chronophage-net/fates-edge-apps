/**
 * Fate's Edge server web console (GET /console).
 *
 * A single self-contained page: rooms, the selected room's clients,
 * adventure, characters and timers, and the live server log. The page
 * itself carries no data; it asks for the admin API key (kept in this
 * tab's sessionStorage only) and calls the same authenticated REST API
 * the CLI uses. A room that isn't open is reported as such, not as an
 * error: rooms exist only while someone is connected.
 *
 * Served with a strict CSP (nonce'd inline style/script, same-origin
 * fetches only, no framing).
 */

const crypto = require('crypto');

function consoleHeaders(nonce) {
    return {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': [
            "default-src 'none'",
            `script-src 'nonce-${nonce}'`,
            `style-src 'nonce-${nonce}'`,
            "connect-src 'self'",
            "img-src 'self' data:",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-ancestors 'none'",
        ].join('; '),
    };
}

function renderConsole(nonce, version) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fate's Edge Server Console</title>
<style nonce="${nonce}">
  :root { --bg:#0f1115; --panel:#161a22; --fg:#d8dee9; --dim:#a2abbc; --accent:#d4af37; --ok:#9ece6a; --warn:#e0af68; --err:#f7768e; --border:#262b36; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  header { padding:12px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; }
  header .stats { color:var(--dim); font-size:13px; display:flex; gap:14px; flex-wrap:wrap; }
  header .spacer { flex:1; }
  .dot { width:8px; height:8px; border-radius:50%; display:inline-block; background:var(--err); }
  .dot.on { background:var(--ok); }
  #notice { padding:6px 20px; color:var(--warn); font-size:13px; min-height:1.5em; }
  main { display:grid; grid-template-columns:minmax(280px,1fr) 2fr; gap:16px; padding:0 20px 20px; }
  @media (max-width:900px) { main { grid-template-columns:1fr; } }
  .panel { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px; min-width:0; }
  .panel h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); margin:0 0 10px; font-weight:600; }
  .stack { display:flex; flex-direction:column; gap:16px; min-width:0; }
  .empty { color:var(--dim); font-style:italic; }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--border); vertical-align:top; }
  th { color:var(--dim); font-weight:600; font-size:12px; }
  tr.room { cursor:pointer; }
  tr.room:hover td { background:#1b2030; }
  tr.room.selected td { background:#232a3b; }
  .table-wrap { overflow-x:auto; }
  .badge { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11.5px; border:1px solid var(--border); color:var(--dim); }
  .badge.gm { color:var(--accent); border-color:var(--accent); }
  button, select, input { font:inherit; font-size:13px; background:var(--bg); color:var(--fg); border:1px solid var(--border); border-radius:6px; padding:5px 10px; min-height:32px; }
  button { cursor:pointer; }
  button.primary { border-color:var(--accent); color:var(--accent); }
  button.danger { border-color:var(--err); color:var(--err); }
  button:disabled { opacity:.5; cursor:default; }
  button:focus-visible, select:focus-visible, input:focus-visible, tr.room:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .kv { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:13px; margin:0; }
  .kv dt { color:var(--dim); } .kv dd { margin:0; overflow-wrap:anywhere; }
  .clock { margin:6px 0; font-size:13px; }
  .clock .row { display:flex; justify-content:space-between; gap:8px; }
  .clock progress { width:100%; height:8px; margin-top:3px; accent-color:var(--warn); }
  h2.sub, .toolbar.sub { margin-top:16px; }
  .toolbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
  #log { height:340px; overflow-y:auto; font:12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; background:#0b0d12; border:1px solid var(--border); border-radius:8px; padding:8px 10px; }
  #log .line { white-space:pre-wrap; word-break:break-word; }
  #log .t { color:var(--dim); margin-right:8px; }
  #log .warn { color:var(--warn); } #log .error { color:var(--err); } #log .debug { color:var(--dim); }
  #log .f { color:var(--dim); }
  #login { max-width:420px; margin:60px auto; }
  #login p { color:var(--dim); }
  #login form { display:flex; gap:8px; }
  #login input { flex:1; }
  .muted { color:var(--dim); font-size:12px; }
</style>
</head>
<body>
<header>
  <span class="dot" id="conn-dot" aria-hidden="true"></span>
  <h1>🎯 Fate's Edge Server <span class="muted">v${version}</span></h1>
  <div class="stats" id="stats"></div>
  <span class="spacer"></span>
  <button id="sign-out" type="button" hidden>Forget key</button>
</header>
<div id="notice" role="status" aria-live="polite"></div>

<section id="login" class="panel" hidden>
  <h2>Admin API key</h2>
  <p>Enter the server's <code>API_KEY</code>. It is kept in this browser tab only and sent to this server with each request.</p>
  <form id="login-form"><input id="key" type="password" autocomplete="current-password" aria-label="Admin API key" required><button class="primary" type="submit">Open console</button></form>
</section>

<main id="app" hidden>
  <div class="stack">
    <section class="panel">
      <h2>Rooms</h2>
      <div class="table-wrap"><table><thead><tr><th>Room</th><th>Clients</th><th>GM</th><th>Adventure</th><th>Active</th></tr></thead><tbody id="rooms"></tbody></table></div>
      <p class="empty" id="rooms-empty" hidden>No rooms are open. A room opens when someone connects to it.</p>
    </section>
  </div>
  <div class="stack">
    <section class="panel" id="room-panel">
      <h2 id="room-title">Room</h2>
      <div id="room-body"><p class="empty">Select a room to see who is there and what they are playing.</p></div>
    </section>
    <section class="panel">
      <h2>Server log</h2>
      <div class="toolbar">
        <select id="log-level" aria-label="Show log level"><option value="all">Everything</option><option value="warn">Warnings and errors</option><option value="error">Errors only</option></select>
        <input id="log-search" type="search" placeholder="Filter text…" aria-label="Filter log text">
        <button id="log-pause" type="button" aria-pressed="false">Pause</button>
      </div>
      <div id="log" role="log" aria-live="off"></div>
    </section>
  </div>
</main>

<script nonce="${nonce}">
(function () {
  var KEY_STORE = 'fe-console-key';
  var key = '';
  try { key = sessionStorage.getItem(KEY_STORE) || ''; } catch (e) {}
  var selected = null, logSince = 0, logEntries = [], paused = false, level = 'all', search = '';
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function ago(ms) { if (!ms) return '—'; return dur(Date.now() - ms) + ' ago'; }
  function dur(ms) { var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m ? m + 'm' : s + 's'; }
  function notice(text) { $('notice').textContent = text || ''; }

  function NoRoom(code) { this.code = code; this.message = 'No room ' + code + ' is open right now. It opens again when someone connects to it.'; }

  function api(path, options) {
    options = options || {};
    var headers = { 'X-API-Key': key };
    if (options.body) headers['Content-Type'] = 'application/json';
    return fetch(path, { method: options.method || 'GET', headers: headers, body: options.body ? JSON.stringify(options.body) : undefined })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {}; try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { error: text }; }
          if (res.ok) return data;
          var message = data.error || ('HTTP ' + res.status);
          var missing = /^Room (\\S+) not found$/.exec(String(message).trim());
          if (missing) throw new NoRoom(missing[1].toUpperCase());
          if (res.status === 401 || res.status === 403) {
            var err = new Error(/managed/i.test(message) ? 'This server is a managed node: use the manager\\'s console.' : 'That API key was not accepted.');
            err.auth = true; throw err;
          }
          throw new Error(message);
        });
      });
  }

  function showLogin(message) {
    $('app').hidden = true; $('login').hidden = false; $('sign-out').hidden = true;
    notice(message || ''); $('key').focus();
  }
  function showApp() { $('login').hidden = true; $('app').hidden = false; $('sign-out').hidden = false; }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault(); key = $('key').value.trim();
    try { sessionStorage.setItem(KEY_STORE, key); } catch (err) {}
    $('key').value = ''; refresh(true);
  });
  $('sign-out').addEventListener('click', function () { key = ''; try { sessionStorage.removeItem(KEY_STORE); } catch (e) {} showLogin('Key forgotten.'); });

  function renderStats(health, rooms) {
    var stats = health.stats || {};
    $('stats').innerHTML = '<span>up ' + esc(dur((health.uptime || 0) * 1000)) + '</span><span>' + esc(rooms.length) + ' rooms</span><span>' +
      esc(stats.totalClients != null ? stats.totalClients : rooms.reduce(function (n, r) { return n + (r.clients || 0); }, 0)) + ' clients</span>';
  }

  function renderRooms(rooms) {
    rooms.sort(function (a, b) { return (b.lastActivity || 0) - (a.lastActivity || 0); });
    $('rooms-empty').hidden = rooms.length > 0;
    $('rooms').innerHTML = rooms.map(function (r) {
      return '<tr class="room' + (r.code === selected ? ' selected' : '') + '" tabindex="0" data-code="' + esc(r.code) + '">' +
        '<td><strong>' + esc(r.code) + '</strong>' + (r.hasPassword ? ' 🔒' : '') + '</td>' +
        '<td>' + esc(r.clients || 0) + (r.bots ? ' <span class="muted">(' + esc(r.bots) + ' bot)</span>' : '') + '</td>' +
        '<td>' + esc(r.gm || '—') + '</td>' +
        '<td>' + esc(r.adventure ? r.adventure.title : '—') + '</td>' +
        '<td>' + esc(ago(r.lastActivity)) + '</td></tr>';
    }).join('');
  }

  function choose(code) { selected = code; refresh(); }
  $('rooms').addEventListener('click', function (e) { var row = e.target.closest('tr.room'); if (row) choose(row.getAttribute('data-code')); });
  $('rooms').addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr.room')) { e.preventDefault(); choose(e.target.getAttribute('data-code')); } });

  var ROLES = ['gm', 'co-gm', 'assistant-gm', 'player', 'spectator'];
  function renderRoom(code, clients, adventure, characters, timers) {
    $('room-title').textContent = 'Room ' + code;
    var html = '';
    html += '<h2>People</h2>' + (clients.length ? '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Character</th><th></th></tr></thead><tbody>' +
      clients.map(function (c) {
        var chars = (c.selectedCharacters && c.selectedCharacters.length ? c.selectedCharacters.join(', ') : c.selectedCharacter) || '—';
        return '<tr><td>' + esc(c.name || '?') + (c.botMode ? ' <span class="badge">bot</span>' : '') + '</td>' +
          '<td><select data-role="' + esc(c.id) + '" aria-label="Role for ' + esc(c.name || 'client') + '">' + ROLES.map(function (r) { return '<option value="' + r + '"' + (r === (c.role || 'player') ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></td>' +
          '<td>' + esc(chars) + '</td><td><button class="danger" data-kick="' + esc(c.id) + '" data-name="' + esc(c.name || 'this client') + '">Kick</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty">No one is connected.</p>');

    html += '<h2 class="sub">Adventure</h2>';
    if (adventure && adventure.moduleId) {
      var scene = adventure.currentScene || {};
      var clocks = (scene.timers || []).map(function (t) { return { t: t, scope: 'scene' }; }).concat((adventure.campaignTimers || []).map(function (t) { return { t: t, scope: 'campaign' }; }));
      html += '<dl class="kv"><dt>Title</dt><dd>' + esc(adventure.title) + ' <span class="badge">' + esc(adventure.status || '') + '</span></dd>' +
        '<dt>Act</dt><dd>' + esc((adventure.currentAct || {}).title || '—') + '</dd><dt>Scene</dt><dd>' + esc(scene.title || '—') + '</dd>' +
        (adventure.activeEncounter ? '<dt>Encounter</dt><dd>' + esc(adventure.activeEncounter.name || '?') + '</dd>' : '') + '</dl>' +
        clocks.map(function (c) { var seg = Math.max(1, +c.t.segments || 1), cur = Math.min(seg, +c.t.current || 0);
          return '<div class="clock"><div class="row"><span>' + esc(c.t.name) + ' <span class="muted">' + c.scope + '</span></span><span>' + cur + ' / ' + seg + '</span></div><progress max="' + seg + '" value="' + cur + '" aria-label="' + esc(c.t.name) + '"></progress></div>'; }).join('') +
        (adventure.status !== 'completed' ? '<div class="toolbar sub"><button class="primary" data-next>Next scene →</button></div>' : '');
    } else {
      html += '<p class="empty">No adventure loaded on the server.</p>';
    }

    html += '<h2 class="sub">Characters</h2>' + (characters.length ? '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Harm</th><th>Fatigue</th><th>Boons</th><th>XP</th></tr></thead><tbody>' +
      characters.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td>' + (c.dead ? 'dead' : esc(c.harm || 0) + ((c.harm || 0) >= 3 ? ' (down)' : '')) + '</td><td>' + esc(c.fatigue || 0) + '</td><td>' + esc(c.boons || 0) + '</td><td>' + esc(c.xp || 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="empty">No characters synced.</p>');

    html += '<h2 class="sub">Timers</h2>' + (timers.length ? timers.map(function (t) { var seg = Math.max(1, +t.segments || 1), cur = Math.min(seg, +t.current || 0);
      return '<div class="clock"><div class="row"><span>' + esc(t.name) + '</span><span>' + cur + ' / ' + seg + '</span></div><progress max="' + seg + '" value="' + cur + '" aria-label="' + esc(t.name) + '"></progress></div>'; }).join('') : '<p class="empty">No ad-hoc timers.</p>');
    $('room-body').innerHTML = html;
  }

  $('room-body').addEventListener('click', function (e) {
    var kick = e.target.closest('[data-kick]'), next = e.target.closest('[data-next]');
    if (kick) {
      if (kick.getAttribute('data-confirm') !== '1') { kick.setAttribute('data-confirm', '1'); kick.textContent = 'Confirm kick'; return; }
      kick.disabled = true;
      api('/api/rooms/' + encodeURIComponent(selected) + '/clients/' + encodeURIComponent(kick.getAttribute('data-kick')) + '/kick', { method: 'POST', body: { reason: 'Kicked from the server console' } })
        .then(function () { notice(kick.getAttribute('data-name') + ' was kicked.'); refresh(); }).catch(handle);
    }
    if (next) {
      next.disabled = true;
      api('/api/rooms/' + encodeURIComponent(selected) + '/adventure/scene', { method: 'POST', body: {} })
        .then(function (s) { notice('Now at: ' + ((s.currentScene || {}).title || 'the end of the adventure')); refresh(); }).catch(handle);
    }
  });
  $('room-body').addEventListener('change', function (e) {
    var sel = e.target.closest('[data-role]'); if (!sel) return;
    api('/api/rooms/' + encodeURIComponent(selected) + '/clients/' + encodeURIComponent(sel.getAttribute('data-role')) + '/role', { method: 'POST', body: { role: sel.value } })
      .then(function (r) { notice('Role changed to ' + (r.role || sel.value) + '.'); refresh(); }).catch(handle);
  });

  function handle(err) {
    if (err instanceof NoRoom) { $('room-title').textContent = 'Room ' + err.code; $('room-body').innerHTML = '<p class="empty">' + esc(err.message) + '</p>'; return; }
    if (err.auth) { showLogin(err.message); return; }
    notice(err.message || 'Something went wrong.');
  }

  // Log feed
  function visible(e) {
    if (level === 'warn' && !(e.level === 'warn' || e.level === 'error')) return false;
    if (level === 'error' && e.level !== 'error') return false;
    if (!search) return true;
    return (e.msg + ' ' + JSON.stringify(e.fields || {})).toLowerCase().indexOf(search) !== -1;
  }
  function line(e) {
    var fields = e.fields ? Object.keys(e.fields).map(function (k) { return k + '=' + e.fields[k]; }).join(' ') : '';
    return '<div class="line ' + esc(e.level) + '"><span class="t">' + esc(new Date(e.time).toLocaleTimeString()) + '</span>' + esc(e.msg) + (fields ? ' <span class="f">' + esc(fields) + '</span>' : '') + '</div>';
  }
  function drawLog() {
    var el = $('log'), atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    var shown = logEntries.filter(visible).slice(-400);
    el.innerHTML = shown.length ? shown.map(line).join('') : '<div class="empty">' + (logEntries.length ? 'No log lines match.' : 'No log lines yet.') + '</div>';
    if (atBottom) el.scrollTop = el.scrollHeight;
  }
  $('log-level').addEventListener('change', function (e) { level = e.target.value; drawLog(); });
  $('log-search').addEventListener('input', function (e) { search = e.target.value.trim().toLowerCase(); drawLog(); });
  $('log-pause').addEventListener('click', function (e) { paused = !paused; e.target.textContent = paused ? 'Resume' : 'Pause'; e.target.setAttribute('aria-pressed', String(paused)); if (!paused) drawLog(); });

  var busy = false;
  function refresh(fromLogin) {
    if (!key) { showLogin(); return; }
    if (busy) return; busy = true;
    Promise.all([api('/api/health'), api('/api/rooms')]).then(function (res) {
      var health = res[0], rooms = res[1].rooms || [];
      showApp(); if (fromLogin) notice('');
      $('conn-dot').className = 'dot on';
      renderStats(health, rooms); renderRooms(rooms);
      var jobs = [api('/api/admin/log?since=' + logSince).then(function (data) {
        (data.entries || []).forEach(function (e) { logEntries.push(e); logSince = Math.max(logSince, e.id); });
        if (logEntries.length > 1000) logEntries.splice(0, logEntries.length - 1000);
        if (!paused) drawLog();
      })];
      if (selected) {
        var code = encodeURIComponent(selected);
        jobs.push(Promise.all([
          api('/api/rooms/' + code + '/clients'), api('/api/rooms/' + code + '/adventure'),
          api('/api/rooms/' + code + '/characters'), api('/api/rooms/' + code + '/timers'),
        ]).then(function (r) { renderRoom(selected, r[0].clients || [], r[1], r[2].characters || [], r[3].timers || []); }).catch(handle));
      }
      return Promise.all(jobs);
    }).catch(function (err) {
      $('conn-dot').className = 'dot';
      if (err.auth) showLogin(err.message);
      else notice(err instanceof NoRoom ? err.message : 'Cannot reach the server (' + (err.message || 'network error') + '). Retrying…');
    }).then(function () { busy = false; });
  }

  refresh(true);
  setInterval(function () { if (key && !document.hidden) refresh(); }, 3000);
})();
</script>
</body>
</html>`;
}

/** Express handler for GET /console. */
function consoleRoute(version) {
    return (req, res) => {
        const nonce = crypto.randomBytes(16).toString('base64');
        res.set(consoleHeaders(nonce));
        res.send(renderConsole(nonce, version));
    };
}

module.exports = { consoleRoute, renderConsole };
