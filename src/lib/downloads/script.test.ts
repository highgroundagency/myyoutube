import { describe, it, expect } from 'vitest';
import { generatePowerShell } from './script';

describe('generatePowerShell', () => {
  const base = { ids: ['aaaaaaaaaaa', 'bbbbbbbbbbb'], folderPath: '$HOME\\Videos\\GV\\Curso' };

  it('is self-contained: TLS fix + bootstraps yt-dlp, into the chosen folder', () => {
    const s = generatePowerShell(base);
    expect(s).toContain('Tls12');
    expect(s).toContain('$dest = "$HOME\\Videos\\GV\\Curso"');
    expect(s).toContain('New-Item -ItemType Directory -Force -Path $dest');
    expect(s).toContain('yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe');
  });

  it('lists each video as a clean watch URL and de-dupes via an archive', () => {
    const s = generatePowerShell(base);
    expect(s).toContain('"https://www.youtube.com/watch?v=aaaaaaaaaaa"');
    expect(s).toContain('"https://www.youtube.com/watch?v=bbbbbbbbbbb"');
    expect(s).toContain('.gv-archive.txt');
  });

  it('bootstraps ffmpeg for 1080p by default, and skips it when high quality is off', () => {
    expect(generatePowerShell(base)).toContain('FFmpeg-Builds');
    expect(generatePowerShell(base)).toContain('--merge-output-format');
    expect(generatePowerShell({ ...base, highQuality: false })).not.toContain('FFmpeg-Builds');
  });

  it('switches to an mp3 audio branch when asked', () => {
    const s = generatePowerShell({ ...base, format: 'audio' });
    expect(s).toContain('--audio-format');
    expect(s).toContain('mp3');
    expect(s).not.toContain('--merge-output-format');
  });

  it('adds browser cookies only when requested', () => {
    expect(generatePowerShell(base)).not.toContain('--cookies-from-browser');
    const withCookies = generatePowerShell({ ...base, useCookies: true, cookiesBrowser: 'brave' });
    expect(withCookies).toContain('--cookies-from-browser brave');
  });
});
