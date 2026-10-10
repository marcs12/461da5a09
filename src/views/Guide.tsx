import { fmtDay } from '../lib/dates';
import { AFTER, CAL_FLOOR, CHECKPOINTS, GOAL_WEIGHT, STEPS, TIERS } from '../lib/targets';

/** A repeat day at the first calorie tier. Label estimates: weigh portions for the first two weeks. */
const MEALS: [string, string, number, number][] = [
  ['Breakfast', '250 g 0% Greek yogurt, berries, 1 scoop protein powder', 320, 49],
  ['Lunch', '180 g cooked chicken breast, bagged salad with light dressing, 1 cup cooked rice', 600, 60],
  ['Snack', 'Protein shake and a piece of fruit', 220, 25],
  ['Dinner', '180 g lean meat or fish, vegetables, a small carb portion', 530, 45],
];
const sum = (i: 2 | 3) => MEALS.reduce((a, m) => a + m[i], 0);

/** The food plan, the rules and what happens after the race. */
export function Guide() {
  return (
    <section>
      <div className="pagehead"><div><h1>Guide</h1><p>The food plan, the rules, and how to keep the weight off.</p></div></div>
      <div className="areagrid guide">
        <div className="stack">
          <article className="card">
            <header><h3>A repeat day</h3><span className="aside">{sum(2).toLocaleString()} kcal · {sum(3)} g protein</span></header>
            <ul className="meals">
              {MEALS.map(([name, what, kcal, pro]) => (
                <li key={name}><div><b>{name}</b><span>{what}</span></div><small>{kcal} kcal<br />{pro} g</small></li>
              ))}
            </ul>
            <p className="fine">Eat the same meals on repeat so you only work the numbers out once. Calories and protein here are label estimates: weigh portions for the first two weeks.</p>
          </article>
          <article className="card">
            <header><h3>Adjust it by tier</h3></header>
            <ul className="focus">
              <li><b>{TIERS[0].cal.toLocaleString()} kcal, weeks 1–8.</b> The day above. On non-run days, skip the rice at lunch (about 200 kcal) and spend it where you like</li>
              <li><b>{TIERS[1].cal.toLocaleString()} kcal, weeks 9–16.</b> Halve the rice at lunch</li>
              <li><b>{TIERS[2].cal.toLocaleString()} kcal, weeks 17–24.</b> Rice only on run days</li>
              <li><b>Race week.</b> {TIERS[3].cal.toLocaleString()} kcal, with extra carbs on Friday and Saturday</li>
            </ul>
          </article>
          <article className="card">
            <header><h3>Food rules</h3></header>
            <ul className="focus">
              <li>Protein at every meal, {TIERS[0].pro} g a day</li>
              <li>No liquid calories: water, black coffee and zero-sugar drinks only</li>
              <li>Carbs go around your runs, most of all the Sunday long run and the Thursday workout</li>
              <li>Never under {CAL_FLOOR.toLocaleString()} kcal while training</li>
              <li>{STEPS.toLocaleString()} steps a day does about half a pound a week and costs almost no recovery</li>
              <li>Dec 24 and 25 at maintenance, then straight back to plan</li>
            </ul>
          </article>
        </div>
        <div className="stack">
          <article className="card">
            <header><h3>Checkpoints</h3><span className="aside">weekly average</span></header>
            <dl className="kv">
              {CHECKPOINTS.map(c => <div key={c.week}><dt>Week {c.week} · {fmtDay(c.date)}</dt><dd>{c.target} lb · floor {c.floor}</dd></div>)}
            </dl>
            <p className="fine">Within about 3 lb of on-track and the runs still feel fine: keep pushing. Behind: you are still heading for the floor, which is a big result. Don’t starve the last month to catch up.</p>
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
              <li>Shin or knee pain (pain, not soreness): swap that run for a treadmill walk</li>
            </ul>
          </article>
          <article className="card">
            <header><h3>Keeping it off</h3><span className="aside">from Apr 19</span></header>
            <ul className="focus">
              <li>Don’t stop on April 19. Either keep cutting to {GOAL_WEIGHT - 5}–{GOAL_WEIGHT} lb, or add 150 kcal a week until your weight holds steady, around {AFTER.cal.toLocaleString()}</li>
              <li>Keep the weekly weigh-in average. Five pounds above your finish weight means two weeks back at {TIERS[0].cal.toLocaleString()}</li>
              <li>Book the next race before this one: a summer 10K or a fall half marathon</li>
              <li>Keep the protein and both strength days for good</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
