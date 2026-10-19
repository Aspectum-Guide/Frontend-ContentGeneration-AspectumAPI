import { useState } from 'react';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import { FormLabel, Alert, Button, Checkbox, PageHeader, Panel, TextInput } from '@aspectum/ui';

export default function Playground() {
  const [message, setMessage] = useState('Привет');
  const [useSearch, setUseSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Добавляем message в историю
      setMessages((prev) => [...prev, { role: 'user', content: message }]);

      const response = await apiClient.post('/generation/ai/test/', {
        message: message.trim(),
        search: useSearch,
      });

      const aiReply = response.data.reply || '—';
      setMessages((prev) => [...prev, { role: 'assistant', content: aiReply }]);
      setMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Ошибка при отправке сообщения ИИ');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setMessage('Привет');
    setError(null);
  };

  return (
    <Layout>
      <Panel as="div" className="shadow-aspectum-card h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b p-6">
          <PageHeader
            title="Тестовый стенд ИИ"
            description="Протестируйте ответы ИИ перед использованием"
            spacing="none"
          />
        </div>

        {/* Settings */}
        <div className="border-b p-6 bg-aspectum-surface-muted">
          <FormLabel  layout="row" interactive>
            <Checkbox
              checked={useSearch}
              onChange={(e) => setUseSearch(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-aspectum-text-strong">
              Использовать поиск в интернете
            </span>
          </FormLabel>
          <p className="text-xs text-aspectum-text-muted mt-2">
            {useSearch
              ? 'ИИ будет использовать результаты поиска для более свежих ответов'
              : 'ИИ использует только свои знания'}
          </p>
        </div>

        {/* Messages History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-aspectum-text-disabled">
              <p>Начните диалог, отправив сообщение</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-aspectum-control ${
                    msg.role === 'user'
                      ? 'bg-aspectum-focus text-aspectum-on-accent'
                      : 'bg-aspectum-surface-subtle text-aspectum-text'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}

          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-aspectum-surface-subtle px-4 py-2 rounded-aspectum-control">
                <p className="text-sm text-aspectum-text-subtle">Ожидание ответа...</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="border-t p-6 bg-aspectum-surface-muted">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <TextInput
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Введите вопрос..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !message.trim()}
            >
              {loading ? '...' : 'Отправить'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClear}
            >
              Очистить
            </Button>
          </form>
        </div>
      </Panel>
    </Layout>
  );
}
