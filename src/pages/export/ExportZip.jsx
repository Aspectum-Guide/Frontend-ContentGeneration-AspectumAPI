import { useState } from 'react';
import Layout from '../../components/Layout';
import { exportAPI } from '../../api/generation';
import { Button, Alert, PageContainer, PageHeader, Panel, SectionHeader, Spinner } from '@aspectum/admin-ui-web';

export default function ExportZip() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await exportAPI.zip();
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aspectum-export-${new Date().toISOString().slice(0, 10)}.zip`;
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
          title="Экспорт ZIP (всё)"
          description="Скачать полный архив данных: города, события, изображения"
        />

        <Panel className="p-6">
          <SectionHeader
            title="Полный архив данных"
            description="ZIP-архив содержит все данные системы: города со всеми языками, события, изображения и метаданные."
            icon={<span className="text-4xl" aria-hidden="true">📦</span>}
            level={3}
            size="sm"
            className="mb-6"
          />

          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          {success && (
            <Alert tone="success" className="mb-4">Архив успешно скачан</Alert>
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
                Подготовка архива...
              </span>
            ) : (
              '⬇ Скачать ZIP-архив'
            )}
          </Button>
        </Panel>
      </PageContainer>
    </Layout>
  );
}
