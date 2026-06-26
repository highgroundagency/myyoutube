/**
 * Curated learning playlists. Each one gets a dedicated, gamified "course" page
 * that tracks progress as you watch. Kept as plain data so both the client and
 * the /api functions can import it. The /api/playlist endpoint only serves ids
 * listed here, so it is not an open proxy for arbitrary playlists.
 */
export type LearningPlaylist = {
  /** Stable internal key, used in the route (/learn/:key). */
  key: string;
  /** Display name. */
  label: string;
  /** The YouTube playlist id. */
  playlistId: string;
  /** Short tagline shown on the course header. */
  description?: string;
};

export const LEARNING_PLAYLISTS: LearningPlaylist[] = [
  {
    key: 'mandarim',
    label: 'Mandarim',
    playlistId: 'PLLD-rQdLK4I36gBOf-eWmXc4Is5DRUA2W',
    description: 'Seu curso de mandarim, uma licao de cada vez.',
  },
];

export const LEARNING_PLAYLISTS_BY_KEY: Record<string, LearningPlaylist> = Object.fromEntries(
  LEARNING_PLAYLISTS.map((p) => [p.key, p]),
);

export const LEARNING_PLAYLIST_IDS = new Set(LEARNING_PLAYLISTS.map((p) => p.playlistId));
