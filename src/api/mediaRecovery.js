import apiClient from './client';

export const mediaRecoveryAPI = {
  listBrokenAudioTracks: (kind) =>
    apiClient.get('/media/recovery/broken-audio-tracks/', { params: kind ? { kind } : {} }),
  attachAudio: (kind, trackId, audioId, force = false) =>
    apiClient.post(`/media/recovery/attach-audio/${kind}/${trackId}/`, {
      audio_id: audioId,
      force,
    }),
};
