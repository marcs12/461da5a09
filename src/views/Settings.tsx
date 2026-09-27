import { useState } from 'react';
import { fmtDay } from '../lib/dates';
import { exportBackup } from '../lib/backup';
import { nextPlan } from '../lib/review';
import { planEnd } from '../lib/life';
import { DEFAULT_SETTINGS, editSettings, type Data } from '../lib/store';
import { DateField, PayFields, ShiftFields, TimeField, Toggle, TrainFields, Workdays } from '../components/fields';
import { SyncPanel } from '../components/SyncPanel';

export function Settings({ data, today }: { data: Data; today: string }) {
  const S = data.settings;
  const [armed, setArmed] = useState(false);
  const next = nextPlan(S, today);
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Settings</h1><p>Changes save as you make them.</p></div></div>
      <div className="setgrid">
        <article className="card stack-sm">
          <h2>Plan dates</h2>
          <div className="fields">
            <DateField id="s-start" label="Plan starts" value={S.planStart} onChange={v => v && editSettings({ planStart: v })} />
            <DateField id="s-depart" label="Fly out" value={S.departDate} onChange={v => editSettings({ departDate: v, ...(v ? {} : { returnDate: null }) })} hint="Clear it for a plan without a trip." />
            <DateField id="s-return" label="Home again" value={S.returnDate} onChange={v => editSettings({ returnDate: v })}
              hint="Your first day back home." />
          </div>
          <p className="fine">{S.planDays} days, ending {fmtDay(planEnd(S))}.</p>
          <div className="field">
            <label htmlFor="s-travel">Travel mode</label>
            <select className="inp" id="s-travel" value={String(S.travelModeOverride)}
              onChange={e => editSettings({ travelModeOverride: e.target.value === 'null' ? null : e.target.value === 'true' })}>
              <option value="null">Automatic, from the trip dates</option>
              <option value="true">Always on</option>
              <option value="false">Always off</option>
            </select>
          </div>
        </article>

        <article className="card stack-sm">
          <h2>Sleep, training and work</h2>
          <div className="fields">
            <TimeField id="s-wake" label="Wake up" value={S.wakeTime} onChange={v => editSettings({ wakeTime: v })} />
            <TimeField id="s-lights" label="Lights out" value={S.lightsOut} onChange={v => editSettings({ lightsOut: v })} />
          </div>
          <TrainFields at={S.trainAt} time={S.trainTime} onChange={editSettings} />
          {S.trainAt === 'morning' && S.trainTime < S.wakeTime && <p className="fine">Your morning session starts before you wake up.</p>}
          <p className="fine">Any day can move: use the Train block on Today.</p>
          <Workdays value={S.workdays} onChange={v => editSettings({ workdays: v })} />
          <ShiftFields value={S.shift ?? DEFAULT_SETTINGS.shift!} onChange={v => editSettings({ shift: v })} />
        </article>

        <article className="card stack-sm">
          <h2>Pay</h2>
          <PayFields value={S.paySchedule ?? DEFAULT_SETTINGS.paySchedule!} onChange={v => editSettings({ paySchedule: v })} />
        </article>

        <article className="card stack-sm">
          <h2>Extras</h2>
          <dl className="kv">
            <div><dt>Weight</dt><dd>lb</dd></div>
            <div><dt>Distance</dt><dd>km</dd></div>
            <div><dt>Height</dt><dd>ft and in</dd></div>
          </dl>
          <Toggle id="s-gam" label="Points and badges" checked={S.gamification} onChange={v => editSettings({ gamification: v })} />
          <div className="field">
            <label htmlFor="s-tg">TouchGrass Battlepass link</label>
            <input className="inp" id="s-tg" type="url" inputMode="url" placeholder="https://" value={S.touchGrassUrl ?? ''}
              onChange={e => editSettings({ touchGrassUrl: e.target.value || undefined })} />
          </div>
        </article>

        <article className="card stack-sm">
          <h2>The next 90 days</h2>
          <p className="fine">Keeps everything you’ve logged and the plan’s structure, with new dates: starts {fmtDay(next.planStart)}, no trip. It downloads a backup first, then asks you to confirm the dates.</p>
          <div className="actions">
            {armed ? (
              <>
                <button className="btn primary" onClick={() => { exportBackup(); editSettings({ ...next, onboarded: false }); setArmed(false); }}>Back up and start</button>
                <button className="btn ghost" onClick={() => setArmed(false)}>Cancel</button>
              </>
            ) : <button className="btn" onClick={() => setArmed(true)}>Start the next 90 days</button>}
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
