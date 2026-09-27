import { fmtDay } from '../lib/dates';
import { planEnd } from '../lib/life';
import { DEFAULT_SETTINGS, editSettings, type Data } from '../lib/store';
import { DateField, PayFields, ShiftFields, TimeField, Toggle, Workdays } from '../components/fields';
import { SyncPanel } from '../components/SyncPanel';

export function Settings({ data }: { data: Data }) {
  const S = data.settings;
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Settings</h1><p>Changes save as you make them.</p></div></div>
      <div className="setgrid">
        <article className="card stack-sm">
          <h3>Plan dates</h3>
          <div className="fields">
            <DateField id="s-start" label="Plan starts" value={S.planStart} onChange={v => v && editSettings({ planStart: v })} />
            <DateField id="s-depart" label="Fly out" value={S.departDate} onChange={v => v && editSettings({ departDate: v })} />
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
          <h3>Sleep and work</h3>
          <div className="fields">
            <TimeField id="s-wake" label="Wake up" value={S.wakeTime} onChange={v => editSettings({ wakeTime: v })} />
            <TimeField id="s-lights" label="Lights out" value={S.lightsOut} onChange={v => editSettings({ lightsOut: v })} />
          </div>
          <Workdays value={S.workdays} onChange={v => editSettings({ workdays: v })} />
          <ShiftFields value={S.shift ?? DEFAULT_SETTINGS.shift!} onChange={v => editSettings({ shift: v })} />
        </article>

        <article className="card stack-sm">
          <h3>Pay</h3>
          <PayFields value={S.paySchedule ?? DEFAULT_SETTINGS.paySchedule!} onChange={v => editSettings({ paySchedule: v })} />
        </article>

        <article className="card stack-sm">
          <h3>Extras</h3>
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

        <article className="card stack-sm sync-card">
          <h3>Sync and backup</h3>
          <SyncPanel />
        </article>
      </div>
    </section>
  );
}
