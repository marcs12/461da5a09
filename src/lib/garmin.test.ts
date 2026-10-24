import { describe, expect, it } from 'vitest';
import { parseActivities, parseHrv, parseRestingHr, parseSleep, parseSteps, parseWeights, parseZones, lapsFromFit, shape } from './garminParse';
import { autoDone, bestEffort, matchActivity, recovery, repeats, stepsOn, tooHard, trialTime, type GActivity, type GDay } from './garmin';
import { addDays } from './dates';
import { sessionOf } from './program';
import { emptyData, type Data } from './schema';
import { isDone, weights } from './stats';

const act = (id: string, date: string, over: Partial<GActivity> = {}): GActivity =>
  ({ id, _u: 1, date, start: `${date}T06:30:00`, type: 'running', distM: 5000, durS: 1800, avgHR: 140, speed: 2.78, ...over });
function withGarmin(acts: GActivity[], days: GDay[] = [], zones = { z2: 120, z3: 140, z4: 155, z5: 170 }): Data {
  const d = emptyData();
  d.cols = {
    garminActs: Object.fromEntries(acts.map(a => [a.id, a])),
    garminDays: Object.fromEntries(days.map(x => [x.id, x])),
    garminSync: { status: { id: 'status', _u: 1, at: 1, ok: true, activities: acts.length, runsWithLaps: 0, days: days.length, changed: 0, errors: [], shapes: {}, zones } as never },
  };
  return d;
}

describe('parsing Garmin responses', () => {
  it('reads the activity search list', () => {
    const json = [{ activityId: 101, activityName: 'Aldergrove Running', startTimeLocal: '2026-10-27 06:12:03', activityType: { typeKey: 'running' }, distance: 4321.7, duration: 2280.4, movingDuration: 2200, averageHR: 141.2, maxHR: 162, averageSpeed: 1.9, calories: 380, aerobicTrainingEffect: 2.4 }];
    expect(parseActivities(json, 5)).toEqual([{ id: '101', _u: 5, date: '2026-10-27', start: '2026-10-27T06:12:03', type: 'running', name: 'Aldergrove Running', distM: 4322, durS: 2280, movS: 2200, avgHR: 141, maxHR: 162, speed: 1.9, cal: 380, aerobicTE: 2.4 }]);
  });
  it('finds steps in either daily layout', () => {
    expect(parseSteps([{ calendarDate: '2026-10-27', values: { totalSteps: 12345 } }])).toEqual({ '2026-10-27': 12345 });
    expect(parseSteps({ data: [{ calendarDate: '2026-10-28', movement: { steps: 9000 } }] })).toEqual({ '2026-10-28': 9000 });
  });
  it('reads HRV, sleep, resting heart rate, weight and zones', () => {
    expect(parseHrv({ hrvSummaries: [{ calendarDate: '2026-10-27', lastNightAvg: 41, weeklyAvg: 44, status: 'balanced' }] }))
      .toEqual({ '2026-10-27': { hrv: 41, hrvWeek: 44, hrvStatus: 'BALANCED' } });
    expect(parseSleep({ dailySleepDTO: { sleepTimeSeconds: 25200, sleepScores: { overall: { value: 78 } } } })).toEqual({ sleepH: 7, sleepScore: 78 });
    expect(parseRestingHr({ calendarDate: '2026-10-27', restingHeartRate: 58 })).toBe(58);
    expect(parseWeights({ dateWeightList: [{ calendarDate: '2026-10-25', weight: 107955 }] })).toEqual({ '2026-10-25': 238 });
    expect(parseZones([{ sport: 'DEFAULT', zone1Floor: 100, zone2Floor: 120, zone3Floor: 140, zone4Floor: 155, zone5Floor: 170 },
      { sport: 'RUNNING', zone1Floor: 101, zone2Floor: 121, zone3Floor: 141, zone4Floor: 156, zone5Floor: 171 }])).toEqual({ z2: 121, z3: 141, z4: 156, z5: 171 });
  });
  it('turns FIT lap messages into laps', () => {
    expect(lapsFromFit([{ totalDistance: 1000.4, totalTimerTime: 355.6, avgHeartRate: 160, enhancedAvgSpeed: 2.81 }, { totalDistance: 0, totalTimerTime: 0 }]))
      .toEqual([{ distM: 1000, durS: 356, avgHR: 160, speed: 2.81 }]);
  });
  it('logs key names only, never values', () => {
    expect(shape({ hrvSummaries: [{ lastNightAvg: 41 }], userProfilePk: 123 })).toBe('{hrvSummaries,userProfilePk}');
    expect(shape([{ calendarDate: 'x', totalSteps: 1 }])).toBe('array(1) of {calendarDate,totalSteps}');
  });
});

describe('matching the watch to the plan', () => {
  const tue = '2026-10-27'; // 6 × 3 min run/walk, 38 min
  it('counts a run that covers most of the session as done', () => {
    const d = withGarmin([act('1', tue, { durS: 36 * 60 })]);
    expect(matchActivity(d, tue)!.id).toBe('1');
    expect(autoDone(d, tue)).toBe(true);
    expect(isDone(d, tue)).toBe(true);
  });
  it('does not count a short walk as the run', () => {
    const d = withGarmin([act('1', tue, { type: 'walking', durS: 40 * 60 }), act('2', tue, { durS: 10 * 60 })]);
    expect(autoDone(d, tue)).toBe(false);
  });
  it('matches strength sessions and low-impact days by type and length', () => {
    const d = withGarmin([act('s', '2026-10-26', { type: 'strength_training', distM: undefined, durS: 2400 }), act('w', '2026-10-28', { type: 'walking', durS: 1800 })]);
    expect(autoDone(d, '2026-10-26')).toBe(true);
    expect(autoDone(d, '2026-10-28')).toBe(true);
  });
  it('lets an unticked box overrule the watch', () => {
    const d = withGarmin([act('1', tue, { durS: 36 * 60 })]);
    d.days[tue] = { done: false };
    expect(isDone(d, tue)).toBe(false);
  });
  it('prefers typed steps and weight over the watch', () => {
    const d = withGarmin([], [{ id: tue, _u: 1, steps: 11000, weightLb: 236.4 }, { id: '2026-10-28', _u: 1, weightLb: 235.9 }]);
    d.days[tue] = { steps: 9000, weight: 236.8 };
    expect(stepsOn(d, tue)).toBe(9000);
    expect(weights(d)).toEqual([{ date: tue, w: 236.8 }, { date: '2026-10-28', w: 235.9 }]);
  });
});

describe('time trials and repeats', () => {
  const km = (s: number, n = 1) => ({ distM: 1000 * n, durS: s * n });
  it('finds the fastest 10 km inside a run with a warm-up', () => {
    const laps = [km(420, 2), ...Array.from({ length: 10 }, () => km(355)), km(400)];
    expect(bestEffort(laps, 10)).toEqual({ sec: 3550, laps: 10 });
  });
  it('uses the whole activity when it is the right length', () => {
    expect(trialTime(act('t', '2027-01-31', { distM: 10050, durS: 3580 }), 10)).toEqual({ sec: 3562, how: 'activity' });
  });
  it('counts repeats run at the target pace', () => {
    const s = sessionOf('2026-12-10')!; // 4 × 1 km at 6:20
    const a = act('i', '2026-12-10', { laps: [km(600, 2), km(375), { distM: 200, durS: 120 }, km(379), { distM: 200, durS: 120 }, km(390), { distM: 200, durS: 120 }, km(380), km(430)] });
    const r = repeats(a, s)!;
    expect(r.work.length).toBe(4);
    expect(r.onPace).toBe(3);
  });
  it('flags an easy run in zone 3', () => {
    const d = withGarmin([]);
    expect(tooHard(d, act('e', '2026-12-08', { avgHR: 148 }), sessionOf('2026-12-08'))).toBe(true);
    expect(tooHard(d, act('e', '2026-12-08', { avgHR: 132 }), sessionOf('2026-12-08'))).toBe(false);
    expect(tooHard(d, act('i', '2026-12-10', { avgHR: 160 }), sessionOf('2026-12-10'))).toBe(false);
  });
});

describe('recovery', () => {
  const today = '2026-12-20';
  const days = (f: (i: number) => Partial<GDay>) => Array.from({ length: 35 }, (_, i) => ({ id: addDays(today, -i), _u: 1, ...f(i) }));
  it('is fine when everything holds steady', () => {
    const r = recovery(withGarmin([], days(() => ({ hrv: 45, rhr: 58, sleepH: 7.4 }))), today)!;
    expect(r.level).toBe('ok');
    expect(r).toMatchObject({ hrv7: 45, hrvBase: 45, rhr7: 58, sleep7: 7.4 });
  });
  it('says ease off when HRV drops and resting heart rate climbs together', () => {
    const r = recovery(withGarmin([], days(i => (i < 7 ? { hrv: 38, rhr: 64, sleepH: 7 } : { hrv: 46, rhr: 58, sleepH: 7 }))), today)!;
    expect(r.flags.map(f => f.key)).toEqual(['hrv', 'rhr']);
    expect(r.level).toBe('ease');
  });
  it('watches a single short-sleep week', () => {
    const r = recovery(withGarmin([], days(i => ({ hrv: 45, rhr: 58, sleepH: i < 8 ? 5.8 : 7.5 }))), today)!;
    expect(r.flags.map(f => f.key)).toEqual(['sleep']);
    expect(r.level).toBe('watch');
  });
  it('has nothing to say without watch data', () => {
    expect(recovery(withGarmin([]), today)).toBeUndefined();
  });
});
