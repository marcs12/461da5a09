import { useCallback, useEffect, useState } from 'react';
import { useData, editDay, editSet } from './lib/store';
import { useSyncStatus } from './lib/gistSync';
import { sessionOf } from './lib/program';
import { iso, parse } from './lib/dates';
import { useNow } from './lib/useNow';
import { Icon, Mark } from './components/ui';
import { IntervalTimer } from './components/IntervalTimer';
import { label } from './components/SyncPanel';
import { initialDate } from './views/body/Session';
import { Body, type BodyView } from './views/Body';
import { Today } from './views/Today';
import { Mind } from './views/Areas';
import { Money } from './views/Money';
import { Income } from './views/Income';
import { PlanPage } from './views/PlanPage';
import { Review } from './views/Review';
import { Settings } from './views/Settings';
import { Onboarding } from './views/Onboarding';

type Tab = 'today' | 'income' | 'body' | 'mind' | 'money';
type Page = 'plan' | 'review' | 'settings';
const BODY_KEY = 'sixteen-body-view';
const TABS: { id: Tab; name: string; icon: () => React.ReactElement }[] = [
  { id: 'today', name: 'Today', icon: Icon.today },
  { id: 'income', name: 'Income', icon: Icon.income },
  { id: 'body', name: 'Body', icon: Icon.body },
  { id: 'mind', name: 'Mind', icon: Icon.mind },
  { id: 'money', name: 'Money', icon: Icon.money },
];

export default function App() {
  const data = useData();
  const sync = useSyncStatus();
  const [tab, setTabState] = useState<Tab>('today');
  const [page, setPage] = useState<Page | null>(null);
  const [sub, setSubState] = useState<BodyView>(() => {
    try { return (localStorage.getItem(BODY_KEY) as BodyView) || 'session'; } catch { return 'session'; }
  });
  const now = useNow();
  const today = iso(now);
  const [date, setDate] = useState(initialDate);
  const [timerDate, setTimerDate] = useState<string | null>(null);

  const go = useCallback((t: Tab, p: Page | null = null) => {
    setTabState(t);
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);
  const setSub = useCallback((v: BodyView) => {
    setSubState(v);
    try { localStorage.setItem(BODY_KEY, v); } catch { /* storage unavailable */ }
    window.scrollTo({ top: 0 });
  }, []);

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
  const isSunday = parse(today).getDay() === 0;
  const syncIssue = sync.state === 'error' || sync.state === 'offline';
  const headBtn = (p: Page, name: string, I: () => React.ReactElement, extra?: React.ReactNode) => (
    <button className="hbtn" onClick={() => (page === p ? setPage(null) : setPage(p))} aria-pressed={page === p} aria-label={name} title={name}>
      <I />{extra}
    </button>
  );

  return (
    <>
      <header className="top">
        <div className="top-in">
          <button className="brand" onClick={() => go('today')} aria-label="Today">
            <Mark />
            <div>
              <div className="brand-name">Quarter</div>
              <div className="brand-sub">90-day reset · Income, Body, Mind, Money</div>
            </div>
          </button>
          <nav className="hnav" aria-label="Plan, review and settings">
            {headBtn('plan', 'Plan', Icon.map)}
            {headBtn('review', isSunday ? 'Sunday review, about 20 minutes' : 'Review', Icon.review, isSunday && <i className="badge" />)}
            {headBtn('settings', syncIssue ? `Settings · ${label(sync.state)}` : 'Settings', Icon.settings, syncIssue && <i className="badge dim" />)}
          </nav>
        </div>
      </header>

      <div className="shell">
        <nav className="bnav" aria-label="Areas">
          {TABS.map(t => (
            <button key={t.id} className="tab" onClick={() => go(t.id)} aria-current={!page && tab === t.id ? 'page' : undefined}>
              <t.icon />{t.name}
            </button>
          ))}
        </nav>

        <main className="app">
          {page && (
            <button className="backbtn" onClick={() => setPage(null)}><Icon.back />{TABS.find(t => t.id === tab)!.name}</button>
          )}
          {page === 'plan' && <PlanPage data={data} today={today} />}
          {page === 'review' && <Review today={today} />}
          {page === 'settings' && <Settings data={data} />}
          {!page && tab === 'today' && (
            <Today data={data} today={today} now={now} openPlan={() => setPage('plan')} openReview={() => setPage('review')}
              openIncome={() => go('income')} openSession={() => { setDate(initialDate()); setSub('session'); go('body'); }} />
          )}
          {!page && tab === 'income' && <Income data={data} today={today} />}
          {!page && tab === 'body' && <Body data={data} sub={sub} setSub={setSub} date={date} setDate={setDate} onTimer={() => setTimerDate(date)} />}
          {!page && tab === 'mind' && <Mind />}
          {!page && tab === 'money' && <Money data={data} today={today} now={now} />}
        </main>
      </div>

      {timerDate && timerSession?.segments && (
        <IntervalTimer title={timerSession.title} date={timerDate} segments={timerSession.segments}
          counter={timerSession.amrap ? {
            value: data.days[timerDate]?.ex?.complex?.[0]?.r ?? 0,
            onChange: n => editSet(timerDate, 'complex', 0, 'r', n || undefined),
          } : undefined}
          onClose={() => setTimerDate(null)} onDone={() => editDay(timerDate, d => { d.done = true; })} />
      )}
      {!data.settings.onboarded && <Onboarding settings={data.settings} />}
    </>
  );
}
