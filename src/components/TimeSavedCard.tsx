import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTimeSaved } from '../hooks/useTimeSaved';
import { formatSavedHeadline, savedEquivalents } from '../lib/stats/timeSaved';
import { localDayKey } from '../lib/persistence/types';

/** "1.5" -> "1h30", "2" -> "2h", "0.5" -> "30min". */
function formatBaseline(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function formatDay(day: string): string {
  const d = parseISO(day);
  return Number.isNaN(d.getTime()) ? day : format(d, 'dd/MM/yyyy');
}

/**
 * Hero card: how much time the viewer has reclaimed by staying off the YouTube
 * feed. Grows every day; days and months only appear once the total reaches at
 * least one of them. The anchor date is editable.
 */
export function TimeSavedCard() {
  const { readout, quitDay, baselineHours, setQuitDay } = useTimeSaved();
  const [editing, setEditing] = useState(false);

  const equivalents = savedEquivalents(readout);
  const headline = formatSavedHeadline(readout.totalMinutes); // e.g. "37 horas"
  const today = localDayKey();

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-accent-500/30 bg-gradient-to-br from-accent-500/10 to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-accent-600">Tempo livre do YouTube</h2>
          <p className="mt-2 text-4xl font-bold leading-none text-fg sm:text-5xl">{headline}</p>
          {equivalents.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-muted">equivale a</span>
              {equivalents.map((eq) => (
                <span
                  key={eq}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg"
                >
                  {eq}
                </span>
              ))}
            </div>
          )}
        </div>
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-accent-500/70"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="mt-4 text-xs text-fg-muted">
        +{formatBaseline(baselineHours)} a cada dia que você passa fora do feed do YouTube.
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span>Contando desde {formatDay(quitDay)}.</span>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="font-medium text-accent-600 hover:underline"
        >
          {editing ? 'Fechar' : 'Ajustar data'}
        </button>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="quit-date" className="text-xs text-fg-muted">
            Quando você parou de usar o YouTube:
          </label>
          <input
            id="quit-date"
            type="date"
            value={quitDay}
            max={today}
            onChange={(e) => {
              if (e.target.value) setQuitDay(e.target.value);
            }}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-fg"
          />
        </div>
      )}
    </section>
  );
}
