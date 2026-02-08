import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import { citiesAPI } from '../../../api/generation';

export default function Step4Commit({ session, onComplete }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [publishedData, setPublishedData] = useState(null);

  const handlePublish = async () => {
    if (!confirm('Вы уверены, что хотите опубликовать город в основную систему? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await citiesAPI.publish(session.id);
      
      if (response.data.status === 'success') {
        setSuccess(response.data.message);
        setPublishedData(response.data);
        
        // Обновляем сессию
        if (onComplete) {
          onComplete();
        }
        
        // Показываем информацию о публикации
        setTimeout(() => {
          alert(`Город успешно опубликован!\n\nГород: ${response.data.city.name}\nДостопримечательностей: ${response.data.attractions_count}`);
        }, 100);
      } else {
        setError(response.data.message || 'Ошибка при публикации');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка при публикации';
      setError(errorMessage);
      console.error('Ошибка публикации:', err);
    } finally {
      setLoading(false);
    }
  };

  const isPublished = session.is_published || publishedData;

  return (
    <div className="bg-white shadow rounded-lg p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">
        Шаг 4: Публикация в основную систему
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800 text-sm font-medium">{success}</p>
          {publishedData && (
            <div className="mt-3 text-sm text-green-700">
              <p><strong>Город ID:</strong> {publishedData.city?.id}</p>
              <p><strong>Название:</strong> {publishedData.city?.name}</p>
              <p><strong>Страна:</strong> {publishedData.city?.country}</p>
              <p><strong>Достопримечательностей:</strong> {publishedData.attractions_count}</p>
            </div>
          )}
        </div>
      )}

      {isPublished ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800 text-sm">
              ✅ Этот город уже опубликован в основную систему.
            </p>
            {session.published_city_id && (
              <p className="text-blue-700 text-sm mt-2">
                ID города: {session.published_city_id}
              </p>
            )}
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/generation')}
            >
              Вернуться к списку сессий
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Внимание!</h3>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>После публикации город будет доступен в основной системе</li>
              <li>Все достопримечательности будут созданы как события (Event)</li>
              <li>Это действие нельзя отменить</li>
              <li>Убедитесь, что все данные заполнены корректно</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-md p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Что будет опубликовано:</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-center">
                {session.city_data ? (
                  <span className="text-green-600 mr-2">✓</span>
                ) : (
                  <span className="text-red-600 mr-2">✗</span>
                )}
                Данные города
              </li>
              <li className="flex items-center">
                {session.attractions && session.attractions.length > 0 ? (
                  <span className="text-green-600 mr-2">✓</span>
                ) : (
                  <span className="text-red-600 mr-2">✗</span>
                )}
                Достопримечательности ({session.attractions?.length || 0})
              </li>
              <li className="flex items-center">
                {session.city_data?.main_image ? (
                  <span className="text-green-600 mr-2">✓</span>
                ) : (
                  <span className="text-yellow-600 mr-2">⚠</span>
                )}
                Главное изображение города
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={loading || !session.city_data || !session.attractions?.length}
              className="w-full sm:w-auto"
            >
              {loading ? 'Публикация...' : '🚀 Опубликовать город'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/generation')}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Отмена
            </Button>
          </div>

          {(!session.city_data || !session.attractions?.length) && (
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Нельзя опубликовать:</p>
              <ul className="list-disc list-inside space-y-1">
                {!session.city_data && <li>Нет данных города</li>}
                {!session.attractions?.length && <li>Нет достопримечательностей</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
