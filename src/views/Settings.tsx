import { fmtDay } from '../lib/dates';
import { END, START, programDay } from '../lib/program';
import { DEFAULT_START_WEIGHT, startWeight, tierOfWeek } from '../lib/targets';
import { editSettings, type Data } from '../lib/store';
import { NumField } from '../components/ui';
import { SyncPanel } from '../components/SyncPanel';

export function Settings({ data, today }: { data: Data; today: string }) {
  const S = data.settings;
  const pd = programDay(today);
  const tier = tierOfWeek(pd.status === 'in' ? pd.week : 1);
  const auto = startWeight({ ...data, settings: { ...S, startWeight: undefined } });
  const whole = (v?: number) => (v != null && v > 0 ? Math.round(v) : undefined);
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Settings</h1><p>Changes save as you make them.</p></div></div>
      <div className="setgrid">
        <article className="card stack-sm">
          <h2>The plan</h2>
          <dl className="kv">
            <div><dt>Day 1</dt><dd>{fmtDay(START)}, 2026</dd></div>
            <div><dt>Sun Run 10K</dt><dd>{fmtDay(END)}, 2027</dd></div>
          </dl>
          <div className="field">
            <label htmlFor="s-start">Starting weight (lb)</label>
            <NumField className="inp" id="s-start" inputMode="decimal" placeholder={String(auto)} value={S.startWeight}
              onCommit={v => editSettings({ startWeight: v != null && v > 0 ? v : undefined })} />
            <p className="fine">Leave it empty to use your weigh-in from Oct 25 or 26{auto === DEFAULT_START_WEIGHT ? ` (${DEFAULT_START_WEIGHT} until you log one)` : ''}. The target line on Progress starts here.</p>
          </div>
        </article>

        <article className="card stack-sm">
          <h2>Daily targets</h2>
          <p className="fine">Empty follows the plan, which steps the calories down by week. Fill one in to hold a number yourself, for example the previous tier for two weeks when you need to ease off.</p>
          <div className="fields">
            <div className="field"><label htmlFor="s-cal">Calories (kcal)</label>
              <NumField className="inp" id="s-cal" inputMode="numeric" placeholder={String(tier.cal)} value={S.calOverride} onCommit={v => editSettings({ calOverride: whole(v) })} /></div>
            <div className="field"><label htmlFor="s-pro">Protein (g)</label>
              <NumField className="inp" id="s-pro" inputMode="numeric" placeholder={String(tier.pro)} value={S.proOverride} onCommit={v => editSettings({ proOverride: whole(v) })} /></div>
          </div>
        </article>

        <article className="card stack-sm sync-card">
          <h2>Sync and backup</h2>
          <SyncPanel />
        </article>
      </div>
    </section>
  );
}
