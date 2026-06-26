import { useQuery } from '@tanstack/react-query';
import { fetchPlaylist } from '../lib/api/youtube';
import type { Video } from '../lib/youtube/types';

/** Videos of a learning playlist, in lesson order. */
export function usePlaylist(playlistId: string) {
  return useQuery<Video[]>({
    queryKey: ['playlist', playlistId],
    queryFn: ({ signal }) => fetchPlaylist(playlistId, signal),
    enabled: Boolean(playlistId),
    staleTime: 30 * 60 * 1000,
  });
}
