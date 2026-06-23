/**
 * Standalone channel resolution report (section 6).
 *
 * Run with the API key in env:
 *   YOUTUBE_API_KEY=... npm run resolve-channels
 * or put YOUTUBE_API_KEY in a local .env (loaded below).
 *
 * Prints a table of handle -> resolved channel id, uploads playlist id, and the
 * resolution method (handle, handle-no-at, search, or failed). Use this to catch
 * wrong handles before building on top of them. Channels resolved by SEARCH or
 * marked FAILED are highlighted so they can be verified or fixed.
 */
import 'dotenv/config';
import { CHANNELS } from '../src/config/channels';
import { resolveChannel } from '../api/_youtube';
import type { ResolvedChannel } from '../src/lib/youtube/types';

function pad(value: string, width: number): string {
  const v = value.length > width ? value.slice(0, width - 1) + '…' : value;
  return v.padEnd(width, ' ');
}

function printTable(rows: ResolvedChannel[]): void {
  const header = `${pad('key', 14)}${pad('handle', 18)}${pad('method', 14)}${pad('channelId', 26)}${pad('uploads', 26)}title`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of rows) {
    console.log(
      `${pad(r.key, 14)}${pad(r.handle, 18)}${pad(r.resolvedBy, 14)}${pad(r.channelId ?? '(none)', 26)}${pad(
        r.uploadsPlaylistId ?? '(none)',
        26,
      )}${r.title ?? '(none)'}`,
    );
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is not set. Add it to .env or your shell, then re-run.');
    console.error('Until then the app runs fully in MOCK_MODE (VITE_MOCK_MODE=true).');
    process.exit(1);
  }

  console.log(`Resolving ${CHANNELS.length} channels...\n`);

  const settled = await Promise.allSettled(CHANNELS.map((c) => resolveChannel(c, apiKey)));
  const rows: ResolvedChannel[] = settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    const config = CHANNELS[i];
    console.error(`Error resolving ${config.key}:`, result.reason?.message ?? result.reason);
    return {
      key: config.key,
      handle: config.handle,
      label: config.label,
      channelId: null,
      uploadsPlaylistId: null,
      title: null,
      thumbnailUrl: null,
      resolvedBy: 'failed',
    };
  });

  console.log('');
  printTable(rows);

  const bySearch = rows.filter((r) => r.resolvedBy === 'search');
  const failed = rows.filter((r) => r.resolvedBy === 'failed');

  if (bySearch.length > 0) {
    console.log('\nResolved by SEARCH (verify these are the right channels):');
    for (const r of bySearch) console.log(`  - ${r.key} (${r.handle}) -> ${r.title} [${r.channelId}]`);
  }
  if (failed.length > 0) {
    console.log('\nFAILED to resolve (fix the handle in src/config/channels.ts):');
    for (const r of failed) console.log(`  - ${r.key} (${r.handle})`);
  }

  console.log(
    `\nDone. ${rows.length - failed.length}/${rows.length} resolved` +
      (failed.length ? `, ${failed.length} failed.` : '.'),
  );
}

main().catch((err) => {
  console.error('Resolution script crashed:', err);
  process.exit(1);
});
