import { useSyncExternalStore } from 'react';
import { syncManager } from '../lib/sync/manager';
import { relativeAge } from '../lib/format';

/**
 * One quiet line about cross-device sync, shown on the Stats page. Explains
 * itself when the backend is not configured yet.
 */
export function SyncStatusLine() {
  const state = useSyncExternalStore(
    syncManager.subscribe,
    syncManager.getSnapshot,
    syncManager.getSnapshot,
  );

  const dot =
    state.status === 'ok'
      ? 'bg-emerald-500'
      : state.status === 'error'
        ? 'bg-red-500'
        : state.status === 'off'
          ? 'bg-fg-muted/40'
          : 'bg-amber-400';

  const label =
    state.status === 'ok'
      ? `Sincronizado entre seus aparelhos${state.lastSyncAt ? ` · ${relativeAge(state.lastSyncAt)}` : ''}`
      : state.status === 'error'
        ? 'Sync com problema agora (os dados locais estão seguros; ele tenta de novo sozinho)'
        : state.status === 'off'
          ? 'Sync entre aparelhos desligado (falta configurar o banco KV na Vercel)'
          : 'Sincronizando...';

  return (
    <p className="mt-6 flex items-center gap-2 text-xs text-fg-muted">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {label}
    </p>
  );
}
