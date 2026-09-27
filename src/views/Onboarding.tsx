import { useState } from 'react';
import { fmtDay } from '../lib/dates';
import { PHASE_NAME, phaseRanges, planEnd } from '../lib/life';
import { DEFAULT_SETTINGS, editSettings, type Settings } from '../lib/store';
import { SEED } from '../data/seed';
import { DateField, PayFields, ShiftFields, TimeField, Toggle, Workdays } from '../components/fields';

const STEPS = ['Dates', 'Sleep', 'Work and pay', 'Extras'];

/** First run after the life-guide upgrade: confirm the four groups of settings. */
export function Onboarding({ settings }: { settings: Settings }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Settings>(settings);
  const set = (p: Partial<Settings>) => setD(x => ({ ...x, ...p }));
  const last = step === STEPS.length - 1;
  const finish = () => {
    const { planStart, departDate, returnDate, wakeTime, lightsOut, workdays, shift, paySchedule, gamification } = d;
    editSettings({ planStart, departDate, returnDate, wakeTime, lightsOut, workdays, shift, paySchedule, gamification, onboarded: true, seedVersion: SEED.version });
  };

  return (
    <div className="sheet-back onboard">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ob-title">
        <header className="sheet-head">
          <div>
            <div className="eyebrow">Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
            <h2 id="ob-title">{step === 0 ? SEED.plan.name : STEPS[step]}</h2>
          </div>
        </header>
        <div className="ob-dots" aria-hidden="true">{STEPS.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>

        {step === 0 && (
          <section className="stack-sm">
            <p className="lead">16. now covers four areas: Income, Body, Mind and Money. Your training program and every log you’ve made are under Body, unchanged.</p>
            <div className="fields">
              <DateField id="ob-start" label="Plan starts" value={d.planStart} onChange={v => v && set({ planStart: v })} />
              <DateField id="ob-depart" label="Fly out" value={d.departDate} onChange={v => v && set({ departDate: v })} />
              <DateField id="ob-return" label="Home again" value={d.returnDate} onChange={v => set({ returnDate: v })} hint="Your first day back home." />
            </div>
            <ul className="ob-phases">
              {phaseRanges(d).map(p => (
                <li key={p.id}><b>{PHASE_NAME[p.id]}</b> {fmtDay(p.from)}{p.to && p.to !== p.from ? ` – ${fmtDay(p.to)}` : ''}</li>
              ))}
            </ul>
            <p className="fine">{d.planDays} days, ending {fmtDay(planEnd(d))}.</p>
          </section>
        )}

        {step === 1 && (
          <section className="stack-sm">
            <p className="lead">Same wake time every day, days off included (within an hour).</p>
            <div className="fields">
              <TimeField id="ob-wake" label="Wake up" value={d.wakeTime} onChange={v => set({ wakeTime: v })} />
              <TimeField id="ob-lights" label="Lights out" value={d.lightsOut} onChange={v => set({ lightsOut: v })} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="stack-sm">
            <Workdays value={d.workdays} onChange={v => set({ workdays: v })} />
            <ShiftFields value={d.shift ?? DEFAULT_SETTINGS.shift!} onChange={v => set({ shift: v })} />
            <PayFields value={d.paySchedule ?? DEFAULT_SETTINGS.paySchedule!} onChange={v => set({ paySchedule: v })} />
          </section>
        )}

        {step === 3 && (
          <section className="stack-sm">
            <dl className="kv">
              <div><dt>Weight</dt><dd>lb</dd></div>
              <div><dt>Distance</dt><dd>km</dd></div>
              <div><dt>Height</dt><dd>ft and in</dd></div>
            </dl>
            <Toggle id="ob-gam" label="Points and badges" checked={d.gamification} onChange={v => set({ gamification: v })} />
            <p className="fine">You can change any of this later in Settings.</p>
          </section>
        )}

        <div className="actions ob-nav">
          {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn primary" onClick={() => (last ? finish() : setStep(step + 1))}>{last ? 'Start' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
