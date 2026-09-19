import { useEffect, useRef, useState } from 'react';
import { connect, disconnect, syncNow, useSyncStatus } from '../lib/gistSync';
import { getData, isData, merge, replaceData } from '../lib/store';
import { today } from '../lib/dates';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Twenty-One%20Weeks%20sync';

export function SyncSheet({ onClose }: { onClose: () => void }) {
  const st = useSyncStatus();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doConnect = async () => {
    setBusy(true); setErr('');
    try { await connect(token); setToken(''); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `twenty-one-weeks-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f: File) => {
    try {
      const o = JSON.parse(await f.text());
      if (!isData(o)) throw new Error();
      replaceData(merge(getData(), o));
      setMsg(`Imported ${Object.keys(o.days).length} days.`);
      syncNow();
    } catch { setMsg('That file isn’t a Twenty-One Weeks export.'); }
  };

  const connected = st.state !== 'off';
  const last = st.last ? new Date(st.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <div className="sheet-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-head">
          <h2 id="sheet-title">Sync & backup</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {connected ? (
          <section className="stack-sm">
            <p className="lead">Syncing to a secret gist on <b>@{st.login}</b>. Your MacBook and phone share this log.</p>
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
              <li><a href={TOKEN_URL} target="_blank" rel="noreferrer">Create a GitHub token</a> with only the <b>gist</b> scope. Pick an expiration you’re comfortable with (Feb 2027 covers the program).</li>
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
          <p className="fine">Download everything as JSON, or merge a backup in (newer edits win per day).</p>
          <div className="actions">
            <button className="btn" onClick={exportJson}>Export JSON</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          </div>
          {msg && <p className="msg">{msg}</p>}
        </section>
      </div>
    </div>
  );
}

export function label(s: string) {
  return ({ off: 'This device only', syncing: 'Syncing…', synced: 'Synced', pending: 'Saving…', offline: 'Offline', error: 'Sync problem' } as Record<string, string>)[s] ?? s;
}
