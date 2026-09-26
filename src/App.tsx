import { useCallback, useEffect, useState } from 'react';
import { useData, editDay, editSet } from './lib/store';
import { useSyncStatus } from './lib/gistSync';
import { sessionOf } from './lib/program';
import { Icon } from './components/ui';
import { IntervalTimer } from './components/IntervalTimer';
import { SyncSheet, label } from './components/SyncSheet';
import { Today, initialDate } from './views/Today';
import { Plan } from './views/Plan';
import { Progress } from './views/Progress';

type View = 'today' | 'plan' | 'progress';
const VIEW_KEY = 'twentyone-weeks-view';
const TABS: { id: View; name: string; icon: () => React.ReactElement }[] = [
  { id: 'today', name: 'Today', icon: Icon.today },
  { id: 'plan', name: 'Plan', icon: Icon.plan },
  { id: 'progress', name: 'Progress', icon: Icon.progress },
];

export default function App() {
  const data = useData();
  const sync = useSyncStatus();
  const [view, setViewState] = useState<View>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as View) || 'today'; } catch { return 'today'; }
  });
  const [date, setDate] = useState(initialDate);
  const [timerDate, setTimerDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  const setView = useCallback((v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable */ }
    window.scrollTo({ top: 0 });
  }, []);
  const closeSheet = useCallback(() => setSheet(false), []);

  // Opening the app on a new day jumps to that day.
  useEffect(() => {
    let last = initialDate();
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = initialDate();
      if (now !== last) { last = now; setDate(now); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const timerSession = timerDate ? sessionOf(timerDate) : null;
  const tabs = (cls: string) => TABS.map(t => (
    <button key={t.id} className={cls} onClick={() => setView(t.id)} aria-current={view === t.id ? 'page' : undefined}>
      <t.icon />{t.name}
    </button>
  ));

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <div className="mark" aria-hidden="true">16</div>
            <div>
              <div className="brand-name">Sixteen Weeks</div>
              <div className="brand-sub">Cut → base → 10K · Sep 27 – Jan 16</div>
            </div>
          </div>
          <nav className="tabs" aria-label="Sections">{tabs('tab')}</nav>
          <button className="sync" data-s={sync.state} onClick={() => setSheet(true)} title="Sync & backup">{label(sync.state)}</button>
        </div>
      </header>

      <main className="app">
        {view === 'today' && <Today data={data} date={date} setDate={setDate} onTimer={() => setTimerDate(date)} />}
        {view === 'plan' && <Plan data={data} date={date} onOpen={d => { setDate(d); setView('today'); }} />}
        {view === 'progress' && <Progress data={data} goToday={() => setView('today')} />}
      </main>

      <nav className="bnav" aria-label="Sections">{tabs('tab')}</nav>

      {timerDate && timerSession?.segments && (
        <IntervalTimer title={timerSession.title} date={timerDate} segments={timerSession.segments}
          counter={timerSession.amrap ? {
            value: data.days[timerDate]?.ex?.complex?.[0]?.r ?? 0,
            onChange: n => editSet(timerDate, 'complex', 0, 'r', n || undefined),
          } : undefined}
          onClose={() => setTimerDate(null)} onDone={() => editDay(timerDate, d => { d.done = true; })} />
      )}
      {sheet && <SyncSheet onClose={closeSheet} />}
    </>
  );
}
