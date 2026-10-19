import { useState, useRef, useEffect } from 'react';
import Layout from '../../components/Layout';
import { importAPI } from '../../api/generation';
import { Alert, Button, Field, FileButton, PageContainer, PageHeader, Panel, SectionHeader, Spinner, TextInput, Glyph } from '@aspectum/admin-ui-web';

export default function ImportGoogleSheet() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  const pollStatus = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await importAPI.fromSheetsStatus({ job_id: id });
        const data = r?.data;
        setStatus(data);
        if (data?.status === 'done' || data?.status === 'completed' || data?.status === 'error' || data?.status === 'failed') {
          clearInterval(pollRef.current);
          setLoading(false);
        }
      } catch {
        clearInterval(pollRef.current);
        setLoading(false);
      }
    }, 3000);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      setJobId(null);

      const r = await importAPI.fromSheets({ sheet_url: sheetUrl.trim() });
      const data = r?.data;

      if (data?.job_id) {
        setJobId(data.job_id);
        setStatus({ status: 'running', message: 'Импорт запущен...' });
        pollStatus(data.job_id);
      } else {
        setStatus({ status: 'done', message: data?.message || 'Импорт завершён' });
        setLoading(false);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка импорта');
      setLoading(false);
    }
  };

  const isRunning = loading && jobId;
  const isDone = status?.status === 'done' || status?.status === 'completed';
  const isFailed = status?.status === 'error' || status?.status === 'failed';

  return (
    <Layout>
      <PageContainer maxWidth="narrow">
        <PageHeader
          title="Импорт из Google Таблицы"
          description="Импорт городов и событий из Google Sheets"
        />

        <Panel className="p-6 space-y-5">
          <SectionHeader
            title="Google Sheets → База данных"
            description="Введите ссылку на таблицу Google Sheets с данными для импорта. Таблица должна быть открыта для просмотра."
            icon={<span className="text-4xl" aria-hidden="true">📊</span>}
            level={3}
            size="sm"
          />

          <form onSubmit={handleImport} className="space-y-4">
            <Field label="Ссылка на таблицу">
              <TextInput
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={isRunning}
              />
            </Field>

            {error && (
              <Alert tone="error">{error}</Alert>
            )}

            {status && (
              <Alert tone={isDone ? 'success' : isFailed ? 'error' : 'info'} className="p-3 text-sm">
                <div className="flex items-center gap-2">
                  {isRunning && (
                    <Spinner size="xs" className="w-3.5 h-3.5 border-2 border-current" />
                  )}
                  {isDone ? <Glyph name="✅" /> : isFailed ? <Glyph name="❌" /> : ''}
                  <span>
                    {status.message || status.status}
                    {status.imported_count != null && ` — загружено: ${status.imported_count}`}
                  </span>
                </div>
                {status.errors?.length > 0 && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-xs opacity-80">
                    {status.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading || !sheetUrl.trim()}
              variant="primary"
              size="md"
              className="w-full"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" className="border-aspectum-on-accent" />
                  Импорт выполняется...
                </span>
              ) : (
                '📊 Начать импорт'
              )}
            </Button>
          </form>
        </Panel>

        {/* Import ZIP */}
        <Panel className="mt-4 p-6">
          <SectionHeader
            title="Импорт из ZIP-архива"
            description="Загрузите ZIP-архив с данными городов или событий, экспортированный ранее."
            level={3}
            size="sm"
            className="mb-4"
          />
          <ImportZip />
        </Panel>
      </PageContainer>
    </Layout>
  );
}

function ImportZip() {
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
      const formData = new FormData();
      formData.append('file', file);
      const r = await importAPI.fromZip(formData);
      setSuccess(r?.data?.message || 'Импорт завершён');
      setFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      <FileButton
        accept=".zip"
        onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); setSuccess(null); }}
      >
        <Glyph name="📦" /> Выбрать ZIP
      </FileButton>
      {file && <p className="text-xs text-aspectum-text-muted">Выбран: {file.name}</p>}
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      <Button
        type="submit"
        disabled={!file || loading}
        variant="dark"
        size="md"
        className="w-full"
      >
        {loading ? 'Загрузка...' : <><Glyph name="📁" /> Загрузить ZIP</>}
      </Button>
    </form>
  );
}
