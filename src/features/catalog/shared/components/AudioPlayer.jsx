import { useEffect, useRef, useState } from 'react';
import { Button, Glyph } from '@aspectum/admin-ui-web';
import { audioAPI } from '../../../../api/generation';

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

  if (error) return <span className="text-xs text-aspectum-danger-subtle">{error}</span>;
  if (!blobUrl) {
    return (
      <Button
        type="button"
        onClick={load}
        disabled={loading}
        variant="soft"
        size="sm"
      >
        {loading ? <Glyph name="⏳" /> : <><Glyph name="▶" /> Слушать</>}
      </Button>
    );
  }
  return <audio controls src={blobUrl} className="h-8 flex-1 min-w-0" />;
}
