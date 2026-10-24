import { useCallback, useEffect, useState } from 'react';
import { useData, editDay, editSet } from './lib/store';
import { useSyncStatus } from './lib/gistSync';
import { sessionFor } from './lib/program';
import { daysToRace } from './lib/targets';
import { iso, today as todayStr } from './lib/dates';
import { useNow } from './lib/useNow';
import { Icon, Mark } from './components/ui';
import { IntervalTimer } from './components/IntervalTimer';
import { label } from './components/SyncPanel';
import { SessionDay } from './views/Session';
import { Program } from './views/Program';
import { Progress } from './views/Progress';
import { Guide } from './views/Guide';
import { Food } from './views/Food';
import { Settings } from './views/Settings';
import { MilestoneToast, markJustDone } from './components/Motivate';

type Tab = 'today' | 'program' | 'progress' | 'food' | 'guide';
const TABS: { id: Tab; name: string; icon: () => React.ReactElement }[] = [
  { id: 'today', name: 'Today', icon: Icon.today },
  { id: 'program', name: 'Program', icon: Icon.plan },
  { id: 'progress', name: 'Progress', icon: Icon.progress },
  { id: 'food', name: 'Food', icon: Icon.food },
  { id: 'guide', name: 'Guide', icon: Icon.guide },
];

export default function App() {
  const data = useData();
  const sync = useSyncStatus();
  const [tab, setTab] = useState<Tab>('today');
  const [settings, setSettings] = useState(false);
  const today = iso(useNow());
  const [date, setDate] = useState(todayStr);
  const [timer, setTimer] = useState<string | null>(null);

  const go = useCallback((t: Tab) => {
    setTab(t);
    setSettings(false);
    window.scrollTo({ top: 0 });
  }, []);

  // Opening the app on a new day jumps to that day.
  useEffect(() => {
    let last = todayStr();
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = todayStr();
      if (now !== last) { last = now; setDate(now); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const timerSession = timer ? sessionFor(timer) : null;
  const syncIssue = sync.state === 'error' || sync.state === 'offline';
  const left = daysToRace(today);
  const settingsName = syncIssue ? `Settings · ${label(sync.state)}` : 'Settings';

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button className="brand" onClick={() => { setDate(today); go('today'); }} title="Today">
            <Mark />
            <div>
              <div className="brand-name">WinterArc</div>
              <div className="brand-sub">{left > 0 ? `${left} days to the Sun Run 10K` : left === 0 ? 'Sun Run 10K today' : 'Sun Run 10K · done'}</div>
            </div>
          </button>
          <nav className="hnav" aria-label="Settings">
            <button className="hbtn" onClick={() => { setSettings(!settings); window.scrollTo({ top: 0 }); }} aria-pressed={settings} aria-label={settingsName} title={settingsName}>
              <Icon.settings />{syncIssue && <i className="badge dim" />}
            </button>
          </nav>
        </div>
      </header>

      <div className="shell">
        <nav className="bnav" aria-label="Sections">
          {TABS.map(t => (
            <button key={t.id} className="tab" onClick={() => go(t.id)} aria-current={!settings && tab === t.id ? 'page' : undefined}>
              <t.icon />{t.name}
            </button>
          ))}
        </nav>

        <main className="app">
          {settings ? <Settings data={data} today={today} /> : (
            <>
              {tab === 'today' && <SessionDay data={data} date={date} setDate={setDate} onTimer={() => setTimer(date)} openGuide={() => go('guide')} />}
              {tab === 'program' && <Program data={data} date={date} onOpen={d => { setDate(d); go('today'); }} />}
              {tab === 'progress' && <Progress data={data} goToday={() => { setDate(today); go('today'); }} />}
              {tab === 'food' && <Food />}
              {tab === 'guide' && <Guide />}
            </>
          )}
        </main>
      </div>

      {timer && timerSession?.segments && (
        <IntervalTimer title={timerSession.title} date={timer} segments={timerSession.segments}
          counter={timerSession.moves && timerSession.logAs ? {
            value: data.days[timer]?.ex?.[timerSession.logAs]?.[0]?.r ?? 0,
            onChange: n => editSet(timer, timerSession.logAs!, 0, 'r', n || undefined),
            moves: timerSession.moves,
          } : undefined}
          onClose={() => setTimer(null)} onDone={() => { markJustDone(timer); editDay(timer, d => { d.done = true; }); }} />
      )}
      {!timer && <MilestoneToast data={data} today={today} onOpen={() => go('progress')} />}
    </>
  );
}
