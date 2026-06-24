import fs from 'node:fs';

/** Strip filename-illegal characters, collapse whitespace, cap length. */
export function sanitizeFilename(name) {
  const cleaned = (name || 'video')
    // illegal on common filesystems
    .replace(/[/\\:*?"<>|]/g, ' ')
    // control characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .trim();
  return cleaned || 'video';
}

function contentDisposition(filename) {
  // ASCII fallback for old clients, plus RFC 5987 UTF-8 for the real name.
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Serve a file as a download with correct HTTP Range support (Accept-Ranges,
 * 206 Partial Content, Content-Range). iOS requires this for Save-to-Files and
 * for screen-locked playback in the Files app.
 */
export function serveFileAsDownload(req, res, filePath, downloadName, mimeType) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.status(404).json({ error: 'not_found', message: 'File missing on disk.' });
    return;
  }

  const total = stat.size;
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', contentDisposition(downloadName));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');

  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] !== '' ? parseInt(match[1], 10) : 0;
    let end = match && match[2] !== '' ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;
    if (start > end || start >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } else {
    res.status(200);
    res.setHeader('Content-Length', total);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
