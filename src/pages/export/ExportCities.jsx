import { useState } from 'react';
import Layout from '../../components/Layout';
import { exportAPI } from '../../api/generation';
import { Button, Alert, PageContainer, PageHeader, Panel, SectionHeader, Spinner } from '@aspectum/ui';

export default function ExportCities() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await exportAPI.cities();
      const contentType = response.headers?.['content-type'] || '';
      const isJson = contentType.includes('json');
      const ext = isJson ? 'json' : 'zip';
      const mimeType = isJson ? 'application/json' : 'application/zip';

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cities-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ошибка экспорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageContainer maxWidth="narrow">
        <PageHeader
          title="Экспорт городов"
          description="Скачать данные всех городов в формате JSON"
        />

        <Panel className="p-6">
          <SectionHeader
            title="Экспорт городов (JSON)"
            description="Экспортирует все города с многоязычными названиями, описаниями, координатами и тегами."
            icon={<span className="text-4xl" aria-hidden="true">🏙️</span>}
            level={3}
            size="sm"
            className="mb-6"
          />

          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          {success && (
            <Alert tone="success" className="mb-4">Файл успешно скачан</Alert>
          )}

          <Button type="button"
            onClick={handleExport}
            disabled={loading}
            variant="primary"
            size="md"
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" className="border-aspectum-on-accent" />
                Подготовка...
              </span>
            ) : (
              '⬇ Скачать города (JSON)'
            )}
          </Button>
        </Panel>
      </PageContainer>
    </Layout>
  );
}
