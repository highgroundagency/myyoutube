type ChannelChip = { key: string; label: string };

type ChannelChipsProps = {
  channels: ChannelChip[];
  active: string | null;
  onSelect: (key: string | null) => void;
};

/** Horizontal channel filter chips. "All" plus one chip per channel. */
export function ChannelChips({ channels, active, onSelect }: ChannelChipsProps) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      role="group"
      aria-label="Filter by channel"
    >
      <Chip label="All" selected={active === null} onClick={() => onSelect(null)} />
      {channels.map((c) => (
        <Chip
          key={c.key}
          label={c.label}
          selected={active === c.key}
          onClick={() => onSelect(c.key)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'bg-fg text-bg'
          : 'bg-surface-2 text-fg-muted hover:bg-line hover:text-fg',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
