/**
 * Generate a copy-paste PowerShell script that downloads a list of YouTube
 * videos with yt-dlp into a chosen folder. This is the "no server" path: the
 * viewer pastes links, picks a folder, copies the script, and runs it. Pure and
 * testable; no app state in here.
 */

export type ScriptFormat = 'video' | 'audio';

export type ScriptOptions = {
  /** 11-char video ids (already parsed/de-duped). */
  ids: string[];
  /** Destination folder, e.g. "$HOME\\Videos\\GabesVideos\\Curso". */
  folderPath: string;
  format?: ScriptFormat;
  /** Add --cookies-from-browser to get past a bot check / unlock 1080p. */
  useCookies?: boolean;
  cookiesBrowser?: string;
};

// 1080p H.264 + AAC in mp4: plays everywhere (Windows and, once saved, iOS).
const VIDEO_FORMAT =
  'bv*[height<=1080][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=1080][vcodec^=avc1]/b[height<=1080]';

function ytdlpCommand(opts: ScriptOptions): string {
  const parts = ['  yt-dlp'];
  if (opts.format === 'audio') {
    parts.push('-x', '--audio-format mp3', '--audio-quality 0');
  } else {
    parts.push(`-f "${VIDEO_FORMAT}"`, '--merge-output-format mp4');
  }
  parts.push('--no-playlist');
  // Skip anything already in this folder, so re-running to add new links is safe.
  parts.push('--download-archive "$dest\\.gv-archive.txt"');
  parts.push('-o "$dest\\%(title)s [%(id)s].%(ext)s"');
  if (opts.useCookies) parts.push(`--cookies-from-browser ${opts.cookiesBrowser || 'chrome'}`);
  parts.push('$url');
  return parts.join(' ');
}

export function generatePowerShell(opts: ScriptOptions): string {
  const count = opts.ids.length;
  const urls = opts.ids.map((id) => `  "https://www.youtube.com/watch?v=${id}"`).join('\n');
  // Defend the double-quoted path against stray quotes (PowerShell escape is `").
  const safePath = opts.folderPath.replace(/"/g, '`"');

  return [
    `# GabesVideos: baixar ${count} ${count === 1 ? 'video' : 'videos'}`,
    '# Precisa do yt-dlp e do ffmpeg (winget install yt-dlp.yt-dlp ; winget install Gyan.FFmpeg)',
    '',
    `$dest = "${safePath}"`,
    'New-Item -ItemType Directory -Force -Path $dest | Out-Null',
    '',
    '$links = @(',
    urls,
    ')',
    '',
    'foreach ($url in $links) {',
    ytdlpCommand(opts),
    '}',
    '',
    'Write-Host "Pronto! Arquivos em: $dest"',
  ].join('\n');
}
