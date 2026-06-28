import { describe, it, expect } from 'vitest';
import { generatePowerShell } from './script';

describe('generatePowerShell', () => {
  const base = { ids: ['aaaaaaaaaaa', 'bbbbbbbbbbb'], folderPath: '$HOME\\Videos\\GV\\Curso' };

  it('sets the destination and creates it', () => {
    const s = generatePowerShell(base);
    expect(s).toContain('$dest = "$HOME\\Videos\\GV\\Curso"');
    expect(s).toContain('New-Item -ItemType Directory -Force -Path $dest');
  });

  it('lists each video as a clean watch URL', () => {
    const s = generatePowerShell(base);
    expect(s).toContain('"https://www.youtube.com/watch?v=aaaaaaaaaaa"');
    expect(s).toContain('"https://www.youtube.com/watch?v=bbbbbbbbbbb"');
  });

  it('defaults to a 1080p mp4 video download with a dedupe archive', () => {
    const s = generatePowerShell(base);
    expect(s).toContain('--merge-output-format mp4');
    expect(s).toContain('--download-archive "$dest\\.gv-archive.txt"');
    expect(s).not.toContain('--audio-format');
  });

  it('switches to mp3 audio when asked', () => {
    const s = generatePowerShell({ ...base, format: 'audio' });
    expect(s).toContain('--audio-format mp3');
    expect(s).not.toContain('--merge-output-format mp4');
  });

  it('adds browser cookies only when requested', () => {
    expect(generatePowerShell(base)).not.toContain('--cookies-from-browser');
    const withCookies = generatePowerShell({ ...base, useCookies: true, cookiesBrowser: 'brave' });
    expect(withCookies).toContain('--cookies-from-browser brave');
  });
});
