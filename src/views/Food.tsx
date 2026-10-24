import { useState } from 'react';
import { TIERS } from '../lib/targets';

/** The repeat day at 1,450 kcal. Label estimates, cooked weights. */
const DAY: { meal: string; what: string; kcal: number; pro: number }[] = [
  { meal: 'Breakfast', what: 'Scramble: 2 eggs, 1 cup egg whites, spinach, peppers, 1 tbsp parmesan, salsa', kcal: 310, pro: 43 },
  { meal: 'Lunch', what: 'Bulgogi beef bowl: 150 g extra-lean ground beef, ½ cup rice, vegetables, cucumber, green onion', kcal: 475, pro: 47 },
  { meal: 'Snack', what: '250 g 0% Greek yogurt, 1 scoop whey isolate, a handful of berries', kcal: 295, pro: 52 },
  { meal: 'Dinner', what: 'Pork adobo: 200 g tenderloin with vegetables', kcal: 380, pro: 56 },
];
const total = (k: 'kcal' | 'pro') => DAY.reduce((a, m) => a + m[k], 0);

const SWAPS = [
  ['Rotisserie chicken night', '180 g meat, skin off', '315 kcal · 50 g'],
  ['Steak night', '200 g cooked top sirloin', '380 kcal · 58 g'],
  ['Post-run shake', '1 scoop isolate in water, instead of the yogurt bowl', '120 kcal · 27 g'],
];

const RECIPES: { name: string; makes: string; steps: string[] }[] = [
  { name: 'Bulgogi beef', makes: 'Seven 150 g lunches from 1.4 kg raw', steps: [
    'Brown 1.4 kg extra-lean ground beef in a big pan and drain it',
    'Add ¼ cup low-sodium soy, 6 garlic cloves, 1 tbsp grated ginger, 2 tbsp honey, 1 tsp sesame oil and chili flakes',
    'Cook it down until sticky. About 30 kcal of sauce per portion',
  ]},
  { name: 'Pork adobo', makes: 'Four 200 g dinners from 1.1 kg raw', steps: [
    'Cut the tenderloin into chunks',
    'Simmer gently with ½ cup low-sodium soy, ½ cup vinegar, a whole head of garlic, 3 bay leaves and 1 tbsp peppercorns for 20 to 25 minutes',
    'Lift the pork out and boil the sauce down by half, then pour it back over',
  ]},
  { name: 'Breakfast scramble', makes: 'One breakfast, 5 minutes', steps: [
    'Cooking spray, then spinach and chopped peppers until soft',
    'Add 2 eggs and 1 cup egg whites and stir until just set',
    'Finish with 1 tbsp parmesan and salsa',
  ]},
];

type Item = [id: string, name: string, qty: string, why: string, every?: string];
const ZONES: { id: string; name: string; where: string; items: Item[] }[] = [
  { id: 'meat', name: 'Meat', where: 'back wall', items: [
    ['beef', 'Extra-lean ground beef', 'about 2.8 kg', 'Lunches: 150 g cooked a day. Freeze half when you get home'],
    ['pork', 'Pork tenderloin', 'about 2.2 kg', 'Adobo dinners, 8 nights. Usually one multi-pack. Freeze half'],
    ['rotisserie', 'Rotisserie chicken', '1', 'Dinners Saturday to Monday, skin off'],
    ['steak', 'Top sirloin steak', 'optional', 'Swap for one adobo night', 'when you want it'],
  ]},
  { id: 'cooler', name: 'Dairy and eggs', where: 'walk-in cooler', items: [
    ['eggs', 'Large eggs', '28 to 30', 'Breakfast: 2 a day'],
    ['whites', 'Liquid egg whites', 'about 3.5 L', 'Breakfast: 1 cup a day'],
    ['yogurt', 'Plain 0% Greek yogurt', 'about 3.5 kg', 'Snack: 250 g a day'],
    ['parm', 'Grated parmesan', '1 tub', 'A tablespoon on the eggs', 'every 4 weeks'],
  ]},
  { id: 'produce', name: 'Produce', where: 'produce cooler', items: [
    ['garlic', 'Peeled garlic', '1 bag or jar', 'Bulgogi and adobo'],
    ['ginger', 'Fresh ginger', '1 piece', 'Bulgogi'],
    ['greenonion', 'Green onions', '1 bunch', 'On the beef bowls'],
    ['cucumber', 'English cucumbers', '1 pack', 'On the beef bowls'],
    ['spinach', 'Baby spinach', '1 large clamshell', 'Scramble, first week'],
    ['peppers', 'Mini sweet peppers', '1 bag', 'Scramble. Keeps two weeks'],
  ]},
  { id: 'frozen', name: 'Frozen', where: 'freezer aisle', items: [
    ['veg', 'Frozen mixed vegetables or broccoli', '2 large bags', 'Lunch bowls and dinners'],
    ['berries', 'Frozen berries', '1 bag', 'Snack', 'every 4 weeks'],
  ]},
  { id: 'pantry', name: 'Pantry and sauces', where: 'center aisles', items: [
    ['soy', 'Low-sodium soy sauce', '1 bottle', 'Bulgogi and adobo', 'when low'],
    ['vinegar', 'Cane or white vinegar', '1 bottle', 'Adobo', 'when low'],
    ['salsa', 'Salsa', '1 jar', 'On the eggs', 'when out'],
    ['honey', 'Honey and sesame oil', 'as needed', 'Bulgogi', 'when out'],
    ['spices', 'Bay leaves, peppercorns, chili flakes', 'as needed', 'Adobo and bulgogi', 'when out'],
    ['rice', 'Jasmine rice', '1 bag', 'About 450 g dry every two weeks', 'when out'],
    ['isolate', 'Whey isolate', 'check the tub', 'One scoop a day', 'when low'],
  ]},
];
const ALL = ZONES.flatMap(z => z.items.map(i => i[0]));

const SHOP_PREP = [
  ['Split the meat', 'Keep half the beef (about 1.4 kg) and half the pork for this week. Freeze the rest flat in bags for next Saturday.'],
  ['Make the bulgogi beef and pork adobo', 'Both recipes are above. The beef is seven lunches; the adobo is four dinners for Tuesday to Friday.'],
  ['Cook the rice', '1 cup dry makes about 3½ cups cooked: seven ½-cup portions.'],
  ['Pack seven lunches', '150 g beef, ½ cup rice and frozen vegetables each. Three in the fridge for Sun to Tue, four in the freezer.'],
  ['Pull the rotisserie chicken', 'Skin off, meat into a container: dinners for Saturday to Monday.'],
  ['Each night', 'Move tomorrow’s lunch from the freezer to the fridge.'],
];
const OFF_PREP = [
  ['Thursday night', 'Move the frozen beef and pork to the fridge to thaw.'],
  ['Top up at any grocery store', 'A rotisserie chicken and a bag of spinach.'],
  ['Cook and pack', 'Same as shopping Saturday: bulgogi, adobo, rice, seven lunches.'],
  ['Check the slow-moving stuff', 'Berries, rice, sauces and protein powder. Anything low goes on next week’s Costco list.'],
];

const KEY = 'winterarc-costco-checks';
function loadChecks(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

/** Meals, recipes, the two-week Costco list and Saturday prep. */
export function Food() {
  const [checks, setChecks] = useState(loadChecks);
  const [armed, setArmed] = useState(false);
  const [prep, setPrep] = useState<'shop' | 'off'>('shop');
  const save = (next: Record<string, boolean>) => {
    setChecks(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const toggle = (id: string) => {
    const next = { ...checks };
    if (next[id]) delete next[id]; else next[id] = true;
    save(next);
  };
  const done = ALL.filter(id => checks[id]).length;

  return (
    <section>
      <div className="pagehead"><div><h1>Food</h1><p>The repeat day, the Costco run every other payday, Saturday prep and the recipes.</p></div></div>
      <div className="areagrid food">
        <div className="stack">
          <article className="card f-day">
            <header><h3>A repeat day</h3><span className="aside">{total('kcal').toLocaleString()} kcal · {total('pro')} g protein</span></header>
            <ul className="meals">
              {DAY.map(m => <li key={m.meal}><div><b>{m.meal}</b><span>{m.what}</span></div><small>{m.kcal} kcal<br />{m.pro} g</small></li>)}
            </ul>
            <p className="fine">Weigh meat cooked for the first two weeks. Eyeballed portions are the most common way 190 g of protein turns into 150.</p>
          </article>
          <article className="card">
            <header><h3>Swaps</h3><span className="aside">same protein, different meal</span></header>
            <dl className="kv swaps">{SWAPS.map(([a, b, c]) => <div key={a}><dt><b>{a}</b><span>{b}</span></dt><dd>{c}</dd></div>)}</dl>
          </article>
          <article className="card">
            <header><h3>By week</h3></header>
            <ul className="focus">
              <li><b>Weeks 1–8, {TIERS[0].cal.toLocaleString()} kcal.</b> The day above</li>
              <li><b>Weeks 9–14, {TIERS[1].cal.toLocaleString()} kcal.</b> Add ½ cup rice at dinner</li>
              <li><b>Weeks 15–24, {TIERS[2].cal.toLocaleString()} kcal.</b> The day above, rice at lunch only on run days, plus a piece of fruit</li>
              <li><b>Maintenance days.</b> About 2,600 to 2,700 kcal: add rice, potatoes or bread to each meal and keep the protein the same</li>
              <li><b>Race week, {TIERS[4].cal.toLocaleString()} kcal.</b> Double the rice at both meals, extra carbs on Friday and Saturday</li>
            </ul>
          </article>
          {RECIPES.map(r => (
            <article className="card" key={r.name}>
              <header><h3>{r.name}</h3><span className="aside">{r.makes}</span></header>
              <ol className="recipe">{r.steps.map(s => <li key={s}>{s}</li>)}</ol>
            </article>
          ))}
          <p className="fine">Soy sauce and rotisserie chicken are salty. Use low-sodium soy, and expect the scale 1 to 2 lb higher the morning after a salty dinner. That’s water.</p>
        </div>

        <div className="stack f-shop">
          <div className="cartbar" role="status">
            <b>{done} / {ALL.length}</b><span>{done === ALL.length ? 'everything’s in the cart' : 'in the cart'}</span>
            <button type="button" className={armed ? 'armed' : ''}
              onClick={() => { if (armed) { save({}); setArmed(false); } else { setArmed(true); setTimeout(() => setArmed(false), 3000); } }}>
              {armed ? 'Tap again to clear' : 'Clear checks'}
            </button>
          </div>
          <p className="fine">The Costco list covers 14 days. Shop on payday Saturday; the Saturday after is prep only.</p>
          {ZONES.map(z => (
            <section key={z.id} className="zone" aria-labelledby={`z-${z.id}`}>
              <div className="zone-head"><h3 id={`z-${z.id}`}>{z.name}</h3><small>{z.where}</small></div>
              <ul className="items">
                {z.items.map(([id, name, qty, why, every]) => (
                  <li key={id}>
                    <label className="item" htmlFor={`g-${id}`}>
                      <input type="checkbox" id={`g-${id}`} checked={!!checks[id]} onChange={() => toggle(id)} />
                      <span className="name">{name}{every && <span className="every">{every}</span>}</span>
                      <span className="qty">{qty}</span>
                      <span className="why">{why}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <article className="card f-prep">
            <header><h3>Saturday prep</h3></header>
            <nav className="subtabs" aria-label="Which Saturday">
              <button onClick={() => setPrep('shop')} aria-current={prep === 'shop' ? 'page' : undefined}>Shopping Saturday</button>
              <button onClick={() => setPrep('off')} aria-current={prep === 'off' ? 'page' : undefined}>Off-week Saturday</button>
            </nav>
            <ol className="prep-steps">
              {(prep === 'shop' ? SHOP_PREP : OFF_PREP).map(([a, b]) => <li key={a}><b>{a}</b><span>{b}</span></li>)}
            </ol>
            <p className="fine">Cooked meat keeps 3 to 4 days in the fridge, which is why Wednesday to Saturday’s lunches go in the freezer.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
