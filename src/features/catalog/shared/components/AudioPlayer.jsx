import { useEffect, useRef, useState } from 'react';
import { audioAPI } from '../../../../api/generation';
import Button from '../../../../components/ui/Button';

export default function AudioPlayer({ audioId }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const blobRef = useRef(null);

  const load = async () => {
    if (blobUrl || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await audioAPI.getBlobByAudioId(audioId);
      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      blobRef.current = url;
      setBlobUrl(url);
    } catch {
      setError('Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
  }, []);

  if (error) return <span className="text-xs text-red-500">{error}</span>;
  if (!blobUrl) {
    return (
      <Button
        type="button"
        onClick={load}
        disabled={loading}
        variant="outline"
        className="min-h-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600"
      >
        {loading ? '⏳' : '▶ Слушать'}
      </Button>
    );
  }
  return <audio controls src={blobUrl} className="h-8 flex-1 min-w-0" />;
}
