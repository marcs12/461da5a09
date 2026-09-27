import { isTravelMode } from '../lib/life';
import type { Data } from '../lib/store';
import { Pipeline } from './income/Pipeline';
import { BragFile, Checklist, Credential, FreelanceCard, OutreachCard, Stats, Targets, TimeZones } from './income/Cards';

/** Get paid more: weekly targets, the pipeline, outreach and the career checklist. */
export function Income({ data, today }: { data: Data; today: string }) {
  const travel = isTravelMode(data.settings, today);
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Income</h1><p>Get paid more, from anywhere.</p></div></div>
      <div className="areagrid">
        <div className="stack">
          {travel && <TimeZones today={today} />}
          <Targets data={data} today={today} />
          <Pipeline data={data} today={today} />
          <OutreachCard data={data} today={today} />
          <Stats data={data} />
        </div>
        <div className="stack">
          <Checklist data={data} today={today} />
          <Credential data={data} />
          <FreelanceCard data={data} />
          <BragFile data={data} today={today} />
        </div>
      </div>
    </section>
  );
}
