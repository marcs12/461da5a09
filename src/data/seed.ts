import seed from './plan-seed.json';

/**
 * The 90-day plan's content. Everything the app says about the plan comes from
 * plan-seed.json, so it can change without code changes. Only progress is
 * stored; bumping `version` never overwrites it.
 *
 * Superseded by the existing 16-week program (Body keeps it): `body.workouts`,
 * `body.runWalk` and `body.trainingByPhase`.
 */
export const SEED = seed;
export type Seed = typeof seed;
