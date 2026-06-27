import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import { useDailyStats } from '../hooks/useDailyStats';
import { useWatchState } from '../hooks/useWatchState';
import { TimeSavedCard } from '../components/TimeSavedCard';
import {
  buildSeries,
  computeStreak,
  totalWatchSeconds,
  totalCompleted,
  categoryMinutes,
  channelMinutes,
  formatMinutes,
  secondsToHours,
} from '../lib/stats/compute';
import { ACCENT_HEX } from '../config/constants';

const CATEGORY_LABELS: Record<string, string> = {
  entertainment: 'Entertainment',
  health: 'Health',
  language: 'Language',
  faith: 'Faith',
  sports: 'Sports',
  other: 'Other',
};

export function Stats() {
  const stats = useDailyStats();
  const { records } = useWatchState();

  const series = useMemo(() => buildSeries(stats, 30), [stats]);
  const totalSeconds = totalWatchSeconds(stats);
  const completed = totalCompleted(stats);
  const streak = computeStreak(stats);
  const cats = useMemo(() => categoryMinutes(records), [records]);
  const channels = useMemo(() => channelMinutes(records), [records]);
  const hasData = totalSeconds > 0 || cats.length > 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Your learning time</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Time spent on the channels you chose, framed as intentional, learned time.
        </p>
      </header>

      <TimeSavedCard />

      {!hasData && (
        <p className="mb-6 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg-muted">
          Start watching (or mark videos as seen) to see your stats grow. Everything here is computed
          in your local timezone.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total watch time" value={formatMinutes(totalSeconds / 60)} />
        <StatCard label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
        <StatCard label="Videos completed" value={String(completed)} />
        <StatCard
          label="Time reclaimed"
          value={`${secondsToHours(totalSeconds)}h`}
          hint="Cumulative intentional hours on your channels."
        />
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Watch time (last 30 days)</h2>
        <p className="mb-3 text-xs text-fg-muted">Real minutes watched per day, in your local time.</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="watchFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_HEX} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT_HEX} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'rgb(var(--fg-muted))' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'rgb(var(--fg-muted))' }}
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip content={<MinutesTooltip />} />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke={ACCENT_HEX}
                strokeWidth={2}
                fill="url(#watchFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Time by channel</h2>
        <p className="mb-3 text-xs text-fg-muted">How much of each channel you have actually watched.</p>
        {channels.length === 0 ? (
          <p className="text-sm text-fg-muted">No channel data yet.</p>
        ) : (
          <BarList
            items={channels.map((c) => ({ key: c.channelKey, label: c.channelLabel, minutes: c.minutes }))}
          />
        )}
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Time by category</h2>
        <p className="mb-3 text-xs text-fg-muted">Based on how far you watched each video.</p>
        {cats.length === 0 ? (
          <p className="text-sm text-fg-muted">No category data yet.</p>
        ) : (
          <BarList
            items={cats.map((c) => ({
              key: c.category,
              label: CATEGORY_LABELS[c.category] ?? c.category,
              minutes: c.minutes,
            }))}
          />
        )}
      </section>
    </div>
  );
}

/** A descending list of labeled bars, scaled to the largest value. */
function BarList({ items }: { items: { key: string; label: string; minutes: number }[] }) {
  const max = items[0]?.minutes ?? 0;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => (
        <li key={it.key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">{it.label}</span>
            <span className="text-fg-muted">{formatMinutes(it.minutes)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${max > 0 ? Math.max(4, (it.minutes / max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-fg-muted">{hint}</p>}
    </div>
  );
}

function MinutesTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const minutes = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-fg">{label}</p>
      <p className="text-fg-muted">{minutes} min watched</p>
    </div>
  );
}
