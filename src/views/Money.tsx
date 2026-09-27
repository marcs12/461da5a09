import { tripActive } from '../lib/money';
import type { Data } from '../lib/store';
import { TripCard } from './money/Trip';
import { OrderCard, PaydayCard, RunwayCard, SpendingCard } from './money/Cards';
import { SEED } from '../data/seed';

/** Build runway. Nothing here syncs: it stays on this device. */
export function Money({ data, today, now }: { data: Data; today: string; now: Date }) {
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Money</h1><p>Build runway. Stays on this device.</p></div></div>
      <div className="areagrid">
        <div className="stack">
          {tripActive(data, today) && <TripCard data={data} today={today} />}
          <RunwayCard data={data} />
          <PaydayCard data={data} today={today} />
        </div>
        <div className="stack">
          <OrderCard data={data} />
          <SpendingCard data={data} today={today} now={now} />
        </div>
      </div>
      <p className="fine disclaimer">{SEED.money.disclaimer}</p>
    </section>
  );
}
