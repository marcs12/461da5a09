import { useRef, useState } from 'react';
import { connect, disconnect, syncNow, useSyncStatus } from '../lib/gistSync';
import { getData, merge, migrate, recs, replaceData, resetDays } from '../lib/store';
import { today } from '../lib/dates';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Quarter%20sync';

/** Sync, backup and start-over controls. Lives in Settings. */
export function SyncPanel() {
  const st = useSyncStatus();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [armed, setArmed] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doConnect = async () => {
    setBusy(true); setErr('');
    try { await connect(token); setToken(''); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quarter-private-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File) => {
    try {
      const o = migrate(JSON.parse(await f.text()));
      if (!o) throw new Error();
      replaceData(merge(getData(), o));
      const n = Object.keys({ ...o.cols, ...o.priv }).reduce((a, c) => a + recs(o, c).length, 0);
      setMsg(`Imported ${Object.keys(o.days).length} days${n ? ` and ${n} other entries` : ''}.`);
      syncNow();
    } catch { setMsg('That file isn’t a Quarter backup.'); }
  };

  const connected = st.state !== 'off';
  const dayCount = Object.keys(getData().days).length;
  const last = st.last ? new Date(st.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <>
      {connected ? (
        <section className="stack-sm">
          <p className="lead">Syncing to a secret gist on <b>@{st.login}</b>. Your MacBook and phone share this log.</p>
          <p className="fine">Check-ins, mood and money never sync. They stay on the device you logged them on.</p>
          <dl className="kv">
            <div><dt>Status</dt><dd>{label(st.state)}{last && st.state === 'synced' ? ` · ${last}` : ''}</dd></div>
            <div><dt>Gist</dt><dd><a href={`https://gist.github.com/${st.login}/${st.gistId}`} target="_blank" rel="noreferrer">View on GitHub</a></dd></div>
          </dl>
          {st.message && <p className={`msg ${st.state === 'error' ? 'bad' : ''}`}>{st.message}</p>}
          <div className="actions">
            <button className="btn primary" onClick={() => syncNow()} disabled={st.state === 'syncing'}>Sync now</button>
            <button className="btn" onClick={disconnect}>Disconnect this device</button>
          </div>
        </section>
      ) : (
        <section className="stack-sm">
          <p className="lead">Right now your log lives only in this browser. Connect GitHub to share it between your MacBook and your Z Fold.</p>
          <ol className="steps">
            <li><a href={TOKEN_URL} target="_blank" rel="noreferrer">Create a GitHub token</a> with only the <b>gist</b> scope. Pick an expiration you’re comfortable with (Jan 2027 covers the program).</li>
            <li>Paste it below. The first device creates a secret gist; the other device finds it with its own token.</li>
          </ol>
          <div className="field">
            <label htmlFor="gh-token">GitHub token</label>
            <input className="inp" id="gh-token" type="password" autoComplete="off" spellCheck={false} placeholder="ghp_…"
              value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && token.trim()) doConnect(); }} />
          </div>
          {err && <p className="msg bad">{err}</p>}
          <div className="actions"><button className="btn primary" disabled={!token.trim() || busy} onClick={doConnect}>{busy ? 'Connecting…' : 'Connect'}</button></div>
          <p className="fine">The token stays in this browser’s storage and is only sent to api.github.com.</p>
        </section>
      )}

      <hr />
      <section className="stack-sm">
        <h3>Backup</h3>
        <p className="fine">Download everything as JSON, or merge a backup in (newer edits win). The file holds your weight, mood and money data, so keep it private.</p>
        <div className="actions">
          <button className="btn" onClick={exportJson}>Export JSON</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
        {msg && <p className="msg">{msg}</p>}
      </section>

      <hr />
      <section className="stack-sm">
        <h3>Start over</h3>
        <p className="fine">
          Erases every logged day — weigh-ins, sessions, sets, meals, notes — and puts you back on Day 1.
          Your calorie and protein targets stay. {connected && 'The empty log syncs to your other device too. '}
          Export a backup first if you might want it.
        </p>
        <div className="actions">
          {armed ? (
            <>
              <button className="btn danger" onClick={() => { resetDays(); setArmed(false); setResetMsg(`Erased ${dayCount} day${dayCount === 1 ? '' : 's'}. Back to Day 1.`); }}>
                Erase {dayCount} day{dayCount === 1 ? '' : 's'} — tap to confirm
              </button>
              <button className="btn ghost" onClick={() => setArmed(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn" disabled={!dayCount} onClick={() => { setArmed(true); setResetMsg(''); }}>
              {dayCount ? 'Erase all logged days' : 'Nothing logged yet'}
            </button>
          )}
        </div>
        {resetMsg && <p className="msg">{resetMsg}</p>}
      </section>
    </>
  );
}

export function label(s: string) {
  return ({ off: 'This device only', syncing: 'Syncing…', synced: 'Synced', pending: 'Saving…', offline: 'Offline', error: 'Sync problem' } as Record<string, string>)[s] ?? s;
}
