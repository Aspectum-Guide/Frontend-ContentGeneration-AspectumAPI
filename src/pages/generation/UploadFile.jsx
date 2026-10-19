import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import { Alert, Button, FileDropzone, PageContainer, PageHeader, Panel, Spinner } from '@aspectum/ui';

export default function UploadFile() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const text = await file.text();
      const response = await apiClient.post('/generation/sessions/upload/', text, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = response?.data;

      setSuccess(data?.message || 'Файл успешно загружен');
      const sessionId = data?.session?.id || data?.session?.uuid || data?.session_id;
      if (sessionId) {
        setTimeout(() => navigate(`/generation/${sessionId}`), 1000);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка загрузки файла');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageContainer maxWidth="narrow">
        <PageHeader
          title="Загрузить из файла"
          description="Загрузка данных сессии генерации из JSON-файла"
        />

        <Panel className="p-6">
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Drop zone */}
            <FileDropzone
              onFiles={(files) => setFile(files[0] || null)}
              accept=".json"
              className="border-2 border-dashed border-aspectum-border-strong rounded-aspectum-card p-10 text-center cursor-pointer hover:border-aspectum-primary-light hover:bg-aspectum-primary-soft transition-colors"
            >
              <div className="text-4xl mb-3">{file ? '📄' : '📂'}</div>
              {file ? (
                <div>
                  <p className="font-medium text-aspectum-text">{file.name}</p>
                  <p className="text-sm text-aspectum-text-disabled mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-aspectum-text-strong font-medium">Нажмите или перетащите файл</p>
                  <p className="text-sm text-aspectum-text-disabled mt-1">JSON-файл с данными города</p>
                </div>
              )}
            </FileDropzone>

            {file && (
              <Button
                type="button"
                onClick={() => setFile(null)}
                variant="ghost"
                size="sm"
              >
                Убрать файл
              </Button>
            )}

            {error && (
              <Alert tone="error">{error}</Alert>
            )}

            {success && (
              <Alert tone="success">{success}</Alert>
            )}

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={!file || loading}
                variant="primary"
                size="lg"
                className="flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" className="border-aspectum-on-accent" />
                    Загрузка...
                  </span>
                ) : (
                  '⬆ Загрузить'
                )}
              </Button>
              <Button
                type="button"
                onClick={() => navigate('/generation')}
                variant="secondary"
                size="lg"
              >
                Отмена
              </Button>
            </div>
          </form>
        </Panel>
      </PageContainer>
    </Layout>
  );
}
