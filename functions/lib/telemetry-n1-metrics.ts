export interface TrackedMetricEvent {
  name: string;
  value?: number;
  subjectHash?: string | null;
}

export function calculateN1Metrics(events: TrackedMetricEvent[]) {
  const subjects = (name: string) => new Set(events
    .filter((event) => event.name === name && event.subjectHash)
    .map((event) => event.subjectHash as string));
  const trials = subjects("subscription.trial_started");
  const paid = subjects("subscription.paid_started");
  const cancelled = subjects("subscription.cancelled");
  const sum = (name: string) => events
    .filter((event) => event.name === name)
    .reduce((total, event) => total + (event.value ?? 1), 0);
  const converted = [...trials].filter((subject) => paid.has(subject)).length;
  return {
    trialUsers: trials.size,
    paidUsers: paid.size,
    trialToPaid: trials.size > 0 ? converted / trials.size : 0,
    churnedUsers: cancelled.size,
    churnRate: paid.size > 0 ? cancelled.size / paid.size : 0,
    recordsParsed: sum("records.parsed"),
    reportsGenerated: sum("reports.generated"),
  };
}

export function calculateActivityConversion(events: TrackedMetricEvent[], from: string, to: string) {
  const entrants = new Set(events.filter((event) => event.name === from && event.subjectHash).map((event) => event.subjectHash as string));
  const finishers = new Set(events.filter((event) => event.name === to && event.subjectHash).map((event) => event.subjectHash as string));
  if (entrants.size === 0) return 0;
  return [...entrants].filter((subject) => finishers.has(subject)).length / entrants.size;
}
