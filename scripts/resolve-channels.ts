/**
 * Standalone channel resolution report (section 6).
 *
 * Run with the API key in env:
 *   YOUTUBE_API_KEY=... npm run resolve-channels
 * or put YOUTUBE_API_KEY in a local .env (loaded below).
 *
 * Prints a table for every channel: input (handle or id), resolved channel id,
 * uploads playlist id, resolution method (id, handle, handle-no-at, search, or
 * failed), and the resolved title so you can eyeball that each one resolved to
 * the correct channel (not a wrong same-named or "- Topic" channel).
 */
import 'dotenv/config';
import { CHANNELS, type ChannelConfig } from '../src/config/channels';
import { resolveChannel } from '../api/_youtube';
import type { ResolvedChannel } from '../src/lib/youtube/types';

function pad(value: string, width: number): string {
  const v = value.length > width ? value.slice(0, width - 1) + '…' : value;
  return v.padEnd(width, ' ');
}

/** What was given in config for this channel (handle or id or search name). */
function inputOf(config: ChannelConfig): string {
  if (config.channelId) return `id:${config.channelId}`;
  if (config.handle) return config.handle;
  if (config.searchName) return `search:"${config.searchName}"`;
  return '(none)';
}

const W = { key: 14, input: 30, method: 13, id: 26, uploads: 26 };

function printTable(rows: Array<{ config: ChannelConfig; resolved: ResolvedChannel }>): void {
  const header =
    pad('key', W.key) +
    pad('input', W.input) +
    pad('method', W.method) +
    pad('resolved id', W.id) +
    pad('uploads', W.uploads) +
    'resolved title';
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const { config, resolved } of rows) {
    console.log(
      pad(config.key, W.key) +
        pad(inputOf(config), W.input) +
        pad(resolved.resolvedBy, W.method) +
        pad(resolved.channelId ?? '(none)', W.id) +
        pad(resolved.uploadsPlaylistId ?? '(none)', W.uploads) +
        (resolved.title ?? '(none)'),
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
  const rows = settled.map((result, i) => {
    const config = CHANNELS[i];
    if (result.status === 'fulfilled') return { config, resolved: result.value };
    console.error(`Error resolving ${config.key}:`, result.reason?.message ?? result.reason);
    return {
      config,
      resolved: {
        key: config.key,
        handle: config.handle ?? '',
        label: config.label,
        channelId: null,
        uploadsPlaylistId: null,
        title: null,
        thumbnailUrl: null,
        resolvedBy: 'failed',
      } satisfies ResolvedChannel,
    };
  });

  console.log('');
  printTable(rows);

  const bySearch = rows.filter((r) => r.resolved.resolvedBy === 'search');
  const failed = rows.filter((r) => r.resolved.resolvedBy === 'failed');

  if (bySearch.length > 0) {
    console.log('\nResolved by SEARCH (verify these titles are correct):');
    for (const { resolved } of bySearch) {
      console.log(`  - ${resolved.key}: "${resolved.title}" [${resolved.channelId}]`);
    }
  }
  if (failed.length > 0) {
    console.log('\nFAILED to resolve (fix the config in src/config/channels.ts):');
    for (const { config } of failed) console.log(`  - ${config.key} (${inputOf(config)})`);
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
