/**
 * Generate a SELF-CONTAINED PowerShell script that downloads a list of YouTube
 * videos into a chosen folder. Paste it into PowerShell and run: it fetches
 * yt-dlp (and, for 1080p, ffmpeg) by itself the first time, with no install and
 * nothing to run beforehand. Pure and testable; no app state in here.
 */

export type ScriptFormat = 'video' | 'audio';

export type ScriptOptions = {
  /** 11-char video ids (already parsed/de-duped). */
  ids: string[];
  /** Destination folder, e.g. "$HOME\\Videos\\GabesVideos\\Curso". */
  folderPath: string;
  format?: ScriptFormat;
  /** Bootstrap ffmpeg so video merges to 1080p (default true). */
  highQuality?: boolean;
  /** Add --cookies-from-browser to get past a bot check / unlock 1080p. */
  useCookies?: boolean;
  cookiesBrowser?: string;
};

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_URL =
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

/** The PowerShell that picks a yt-dlp format based on whether ffmpeg is around. */
function formatBlock(format: ScriptFormat): string[] {
  if (format === 'audio') {
    return [
      'if ($hasFf) {',
      '  $fmt = "ba/b"',
      '  $extra = @("-x", "--audio-format", "mp3", "--audio-quality", "0")',
      '} else {',
      '  $fmt = "ba[ext=m4a]/ba/b"',
      '  $extra = @()',
      '}',
    ];
  }
  return [
    'if ($hasFf) {',
    '  $fmt = "bv*[height<=1080][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=1080][vcodec^=avc1]/b[height<=1080]"',
    '  $extra = @("--merge-output-format", "mp4")',
    '} else {',
    '  $fmt = "b[ext=mp4][vcodec^=avc1]/b[ext=mp4]/b"',
    '  $extra = @()',
    '}',
  ];
}

function ffmpegBootstrap(): string[] {
  return [
    '$ffmpeg = Join-Path $tools "ffmpeg.exe"',
    'if (-not (Test-Path $ffmpeg) -and -not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {',
    '  try {',
    '    Write-Host "Baixando o ffmpeg para 1080p (so na primeira vez, ~80MB)..."',
    '    $zip = Join-Path $tools "ffmpeg.zip"',
    `    Invoke-WebRequest -UseBasicParsing -Uri "${FFMPEG_URL}" -OutFile $zip`,
    '    Expand-Archive -Path $zip -DestinationPath $tools -Force',
    '    $bin = Get-ChildItem -Path $tools -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1',
    '    if ($bin) { Copy-Item $bin.FullName $ffmpeg -Force }',
    '    Remove-Item $zip -Force -ErrorAction SilentlyContinue',
    '  } catch { Write-Host "Nao consegui baixar o ffmpeg; sigo na melhor qualidade sem ele." }',
    '}',
  ];
}

export function generatePowerShell(opts: ScriptOptions): string {
  const { ids, folderPath, format = 'video', highQuality = true, useCookies, cookiesBrowser } = opts;
  const count = ids.length;
  const safePath = folderPath.replace(/"/g, '`"');
  const urls = ids.map((id) => `  "https://www.youtube.com/watch?v=${id}"`).join('\n');
  const cookie = useCookies ? `--cookies-from-browser ${cookiesBrowser || 'chrome'} ` : '';

  const lines: string[] = [
    `# GabesVideos: baixar ${count} ${count === 1 ? 'video' : 'videos'}. Cole no PowerShell e rode.`,
    '# Baixa as ferramentas sozinho na primeira vez. Nao precisa instalar nada.',
    '[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12',
    '',
    `$dest = "${safePath}"`,
    'New-Item -ItemType Directory -Force -Path $dest | Out-Null',
    '$tools = Join-Path $env:LOCALAPPDATA "GabesVideos\\tools"',
    'New-Item -ItemType Directory -Force -Path $tools | Out-Null',
    '',
    '$ytdlp = Join-Path $tools "yt-dlp.exe"',
    'if (-not (Test-Path $ytdlp)) {',
    '  Write-Host "Baixando o yt-dlp (so na primeira vez)..."',
    `  Invoke-WebRequest -UseBasicParsing -Uri "${YTDLP_URL}" -OutFile $ytdlp`,
    '}',
    '',
  ];

  if (highQuality) lines.push(...ffmpegBootstrap(), '');

  lines.push(
    '$hasFf = (Test-Path (Join-Path $tools "ffmpeg.exe")) -or [bool](Get-Command ffmpeg -ErrorAction SilentlyContinue)',
    '$ffLoc = if (Test-Path (Join-Path $tools "ffmpeg.exe")) { @("--ffmpeg-location", $tools) } else { @() }',
    ...formatBlock(format),
    '',
    '$links = @(',
    urls,
    ')',
    '',
    'foreach ($url in $links) {',
    `  & $ytdlp -f $fmt @ffLoc @extra --no-playlist ${cookie}--download-archive (Join-Path $dest ".gv-archive.txt") -o (Join-Path $dest "%(title)s [%(id)s].%(ext)s") $url`,
    '}',
    '',
    'Write-Host ""',
    'Write-Host "Pronto! Arquivos em: $dest"',
    'Invoke-Item $dest',
  );

  return lines.join('\n');
}
