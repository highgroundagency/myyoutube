import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 15 };

/**
 * Cross-device sync backend. Stores ONE KEY PER DEVICE in a Redis-compatible
 * KV (Vercel Marketplace / Upstash REST API): each device only ever writes its
 * own slice, so there is nothing to merge server-side and no write races.
 * All merging happens on the devices (src/lib/sync/merge.ts).
 *
 *   GET  /api/sync           -> { configured, devices: { [deviceId]: slice } }
 *   POST /api/sync           -> { configured, ok }  body: { deviceId, slice }
 *
 * Without the KV env vars this stays a graceful no-op ({ configured: false })
 * and the app remains local-only, exactly as before.
 */

const PREFIX = 'gv-sync:device:';
const MAX_SLICE_BYTES = 900_000; // Upstash free-tier request cap is ~1MB
const DEVICE_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

type Kv = { url: string; token: string };

function kvConfig(): Kv | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url.trim() || !token.trim()) return null;
  return { url: url.trim().replace(/\/+$/, ''), token: token.trim() };
}

/** One Redis command over the Upstash REST API. Returns the `result` field. */
async function kvCommand(kv: Kv, command: (string | number)[]): Promise<unknown> {
  const res = await fetch(kv.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV command failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => null)) as { result?: unknown } | null;
  return json?.result;
}

async function readDevices(kv: Kv): Promise<Record<string, unknown>> {
  const keys = (await kvCommand(kv, ['KEYS', `${PREFIX}*`])) as unknown;
  const list = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [];
  if (list.length === 0) return {};

  const values = (await kvCommand(kv, ['MGET', ...list])) as unknown;
  const devices: Record<string, unknown> = {};
  if (Array.isArray(values)) {
    for (let i = 0; i < list.length; i += 1) {
      const raw = values[i];
      if (typeof raw !== 'string') continue;
      try {
        devices[list[i].slice(PREFIX.length)] = JSON.parse(raw);
      } catch {
        // A corrupt slice is skipped, never fatal.
      }
    }
  }
  return devices;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const kv = kvConfig();
  if (!kv) {
    res.status(200).json({ configured: false });
    return;
  }

  try {
    if (req.method === 'GET') {
      const devices = await readDevices(kv);
      res.status(200).json({ configured: true, devices });
      return;
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { deviceId?: unknown; slice?: unknown };
      const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
      if (!DEVICE_ID_RE.test(deviceId) || body.slice == null || typeof body.slice !== 'object') {
        res.status(400).json({ error: 'bad_request', message: 'deviceId and slice are required.' });
        return;
      }
      const json = JSON.stringify(body.slice);
      if (json.length > MAX_SLICE_BYTES) {
        res.status(413).json({ error: 'too_large', message: 'Slice too large.' });
        return;
      }
      await kvCommand(kv, ['SET', `${PREFIX}${deviceId}`, json]);
      res.status(200).json({ configured: true, ok: true });
      return;
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    console.error('[api/sync] error:', error);
    res.status(502).json({ error: 'sync_failed', message: 'Sync backend unavailable.' });
  }
}
