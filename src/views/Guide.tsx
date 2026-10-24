import { fmtDay } from '../lib/dates';
import { AFTER, CAL_FLOOR, CHECKPOINTS, GOAL_WEIGHT, TIERS } from '../lib/targets';

/** The rules, the checkpoints and what happens after the race. Meals and groceries are on the Food tab. */
export function Guide() {
  return (
    <section>
      <div className="pagehead"><div><h1>Guide</h1><p>The rules, the checkpoints, and how to keep the weight off. Meals and groceries are on the Food tab.</p></div></div>
      <div className="areagrid guide">
        <div className="stack">
          <article className="card">
            <header><h3>Food rules</h3></header>
            <ul className="focus">
              <li>Protein at every meal, {TIERS[0].pro} g a day</li>
              <li>No liquid calories: water, black coffee and zero-sugar drinks only</li>
              <li>Carbs go around your runs, most of all the Sunday long run and the Thursday workout</li>
              <li>Never under {CAL_FLOOR.toLocaleString()} kcal while training</li>
              <li>{TIERS[0].steps.toLocaleString()} steps a day to January, {TIERS[2].steps.toLocaleString()} from February. The extra steps, not less food, are where the faster loss comes from. The walking treadmill makes them easy</li>
              <li>Dec 24 and 25 at maintenance, and Jan 28 to 30 before the time trial, then straight back to plan</li>
            </ul>
          </article>
        </div>
        <div className="stack">
          <article className="card">
            <header><h3>Checkpoints</h3><span className="aside">weekly average</span></header>
            <dl className="kv">
              {CHECKPOINTS.map(c => <div key={c.week}><dt>Week {c.week} · {fmtDay(c.date)}</dt><dd>{c.target} lb · floor {c.floor}</dd></div>)}
            </dl>
            <p className="fine">Within about 3 lb of on-track and the runs still feel fine: keep pushing. Behind: the fallback still lands around 172 on race day, which is a big result. Don’t starve the last month to catch up, and never go under the calorie floor.</p>
          </article>
          <article className="card">
            <header><h3>Ease off when</h3></header>
            <p className="fine">Go back to the previous calorie tier for two weeks if, two weeks running:</p>
            <ul className="focus">
              <li>Easy runs get slower or feel harder</li>
              <li>Strength numbers drop</li>
              <li>Sleep goes bad</li>
              <li>A joint or shin pain lingers</li>
            </ul>
          </article>
          <article className="card">
            <header><h3>Running rules</h3></header>
            <ul className="focus">
              <li>Every run starts and ends with 5 minutes of walking. Before a workout or time trial, jog 10 minutes easy first</li>
              <li>Easy means a pace where you can talk in full sentences</li>
              <li>Strides are 20 seconds fast but relaxed, with a 1 minute walk between</li>
              <li>Time trials: start a few seconds slower than target for the first km, then settle in. Log the time in minutes</li>
              <li>Shin or knee pain (pain, not soreness): swap that run for a treadmill walk</li>
            </ul>
          </article>
          <article className="card">
            <header><h3>Keeping it off</h3><span className="aside">from Apr 19</span></header>
            <ul className="focus">
              <li>Don’t stop on April 19. Still above {GOAL_WEIGHT} lb: keep the last tier a few more weeks. At {GOAL_WEIGHT}: add 150 kcal a week until your weight holds steady, around {AFTER.cal.toLocaleString()}</li>
              <li>Keep the weekly weigh-in average. Five pounds above your finish weight means two weeks back at {TIERS[1].cal.toLocaleString()}</li>
              <li>Book the next race before this one: a summer 10K or a fall half marathon</li>
              <li>Keep the protein and both strength days for good</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
