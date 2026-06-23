import { get, set } from 'idb-keyval';
import type { WatchRecord } from '../watch/types';

/**
 * Offline write queue (section 13). If a Supabase write fails (offline), the op
 * is queued in IndexedDB and flushed on reconnect. Watch progress is never lost.
 * Falls back to an in-memory queue if IndexedDB is unavailable.
 */
export type QueueOp =
  | { kind: 'watch'; record: WatchRecord }
  | { kind: 'stats'; day: string; seconds: number; completed: number };

const KEY = 'gv-offline-queue';
let memory: QueueOp[] | null = null;

async function load(): Promise<QueueOp[]> {
  if (memory) return memory;
  try {
    memory = (await get<QueueOp[]>(KEY)) ?? [];
  } catch {
    memory = [];
  }
  return memory;
}

async function save(ops: QueueOp[]): Promise<void> {
  memory = ops;
  try {
    await set(KEY, ops);
  } catch {
    // IndexedDB unavailable: the in-memory copy still works for this session.
  }
}

export async function enqueue(op: QueueOp): Promise<void> {
  const ops = await load();
  ops.push(op);
  await save(ops);
}

export async function queueSize(): Promise<number> {
  return (await load()).length;
}

export type FlushHandlers = {
  sendWatch: (record: WatchRecord) => Promise<void>;
  sendStats: (day: string, seconds: number, completed: number) => Promise<void>;
};

/**
 * Try to send every queued op. Ops that fail again are kept for the next flush,
 * so nothing is dropped. Processed in order.
 */
export async function flushQueue(handlers: FlushHandlers): Promise<void> {
  const ops = await load();
  if (ops.length === 0) return;

  const remaining: QueueOp[] = [];
  for (const op of ops) {
    try {
      if (op.kind === 'watch') await handlers.sendWatch(op.record);
      else await handlers.sendStats(op.day, op.seconds, op.completed);
    } catch {
      remaining.push(op);
    }
  }
  await save(remaining);
}
