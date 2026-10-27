import type { DayLog, FoodEntry } from './schema';

/** The repeat day at 1,450 kcal. Label estimates, cooked weights. */
export const DAY: { meal: string; short: string; what: string; kcal: number; pro: number }[] = [
  { meal: 'Breakfast', short: 'Scramble', what: 'Scramble: 2 eggs, 1 cup egg whites, spinach, peppers, 1 tbsp parmesan, salsa', kcal: 310, pro: 43 },
  { meal: 'Lunch', short: 'Bulgogi bowl', what: 'Bulgogi beef bowl: 150 g extra-lean ground beef, ½ cup rice, vegetables, cucumber, green onion', kcal: 475, pro: 47 },
  { meal: 'Snack', short: 'Yogurt bowl', what: '250 g 0% Greek yogurt, 1 scoop whey isolate, a handful of berries', kcal: 295, pro: 52 },
  { meal: 'Dinner', short: 'Pork adobo', what: 'Pork adobo: 200 g tenderloin with vegetables', kcal: 380, pro: 56 },
];

/** Swaps that keep the day on target. */
export const SWAP_MEALS: { name: string; short: string; what: string; kcal: number; pro: number }[] = [
  { name: 'Rotisserie chicken night', short: 'Rotisserie chicken', what: '180 g meat, skin off', kcal: 315, pro: 50 },
  { name: 'Steak night', short: 'Steak', what: '200 g cooked top sirloin', kcal: 380, pro: 58 },
  { name: 'Post-run shake', short: 'Shake', what: '1 scoop isolate in water, instead of the yogurt bowl', kcal: 120, pro: 27 },
];

/** One-tap meals on Today. */
export const QUICK: { name: string; kcal: number; pro: number }[] = [
  ...DAY.map(m => ({ name: m.short, kcal: m.kcal, pro: m.pro })),
  ...SWAP_MEALS.map(m => ({ name: m.short, kcal: m.kcal, pro: m.pro })),
];

/*
 * The day's calories and protein stay as two totals (what targets, stats and
 * sync already read). Food entries are the list of what made them up: adding
 * one adds to the totals, removing one takes it back off.
 */
const tidy = (d: DayLog) => {
  if (d.cal != null && d.cal <= 0) delete d.cal;
  if (d.pro != null && d.pro <= 0) delete d.pro;
  if (d.food && !d.food.length) delete d.food;
};

export function addFood(d: DayLog, e: Omit<FoodEntry, 'at'>, at = Date.now()) {
  d.food = [...(d.food ?? []), { ...e, at }];
  d.cal = (d.cal ?? 0) + e.cal;
  d.pro = (d.pro ?? 0) + e.pro;
  tidy(d);
}

export function removeFood(d: DayLog, i: number) {
  const e = d.food?.[i];
  if (!e) return;
  d.food = d.food!.filter((_, k) => k !== i);
  d.cal = Math.max(0, (d.cal ?? 0) - e.cal);
  d.pro = Math.max(0, (d.pro ?? 0) - e.pro);
  tidy(d);
}

/** Copy another day's meals onto this one. */
export function repeatFood(d: DayLog, from: DayLog | undefined, at = Date.now()) {
  for (const e of from?.food ?? []) addFood(d, { name: e.name, cal: e.cal, pro: e.pro }, at);
}
