import { useState } from 'react';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import Button from '../../components/ui/Button';

export default function Playground() {
  const [message, setMessage] = useState('Привет');
  const [useSearch, setUseSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
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
      setReply(aiReply);
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
    setReply('');
    setMessage('Привет');
    setError(null);
  };

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
        {/* Header */}
        <div className="border-b p-6">
          <h1 className="text-2xl font-bold mb-2">Тестовый стенд ИИ</h1>
          <p className="text-gray-600">Протестируйте ответы ИИ перед использованием</p>
        </div>

        {/* Settings */}
        <div className="border-b p-6 bg-gray-50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSearch}
              onChange={(e) => setUseSearch(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Использовать поиск в интернете
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            {useSearch
              ? 'ИИ будет использовать результаты поиска для более свежих ответов'
              : 'ИИ использует только свои знания'}
          </p>
        </div>

        {/* Messages History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
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
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
                <p className="text-sm text-gray-600">Ожидание ответа...</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="border-t p-6 bg-gray-50">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Введите вопрос..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
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
      </div>
    </Layout>
  );
}
