import { APP_NAME, ACCENT_HEX } from '../config/constants';

type LogoProps = {
  className?: string;
  /** Render only the play glyph (for tight spaces or as an icon). */
  glyphOnly?: boolean;
  size?: number;
};

/**
 * The GabesVideos wordmark: a rounded play glyph in the accent color plus the
 * app name. Rename by changing APP_NAME in constants.ts. The same glyph is the
 * PWA icon and favicon, so keep it simple and scalable.
 */
export function Logo({ className = '', glyphOnly = false, size = 28 }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={APP_NAME}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        role="img"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="1" y="3" width="26" height="22" rx="7" fill={ACCENT_HEX} />
        <path d="M11 9.5 L19.5 14 L11 18.5 Z" fill="#ffffff" />
      </svg>
      {!glyphOnly && (
        <span className="text-lg font-semibold tracking-tight text-fg">{APP_NAME}</span>
      )}
    </span>
  );
}
