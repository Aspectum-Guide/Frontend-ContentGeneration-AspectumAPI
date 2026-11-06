import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/ui/Button';
import { ADMIN } from '../mode/appMode';
import { useAppMode } from '../mode/AppModeContext';

export default function Home() {
  const mode = useAppMode();
  const isAdmin = mode === ADMIN;

  return (
    <Layout>
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isAdmin ? 'Админка Aspectum' : 'Студия Aspectum'}
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          {isAdmin
            ? 'Каталог, продажи и подписки. Генерация контента на этой ноде не выполняется.'
            : 'Платформа генерации контента для городов и достопримечательностей'}
        </p>
        <div className="flex gap-4 justify-center">
          {isAdmin ? (
            <>
              <Link to="/catalog">
                <Button variant="primary" className="text-lg px-8 py-3">
                  Справочники
                </Button>
              </Link>
              <Link to="/catalog/booking-setup">
                <Button variant="secondary" className="text-lg px-8 py-3">
                  Настройка продаж
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/generation">
                <Button variant="primary" className="text-lg px-8 py-3">
                  Управление сессиями
                </Button>
              </Link>
              <Link to="/ai/settings">
                <Button variant="secondary" className="text-lg px-8 py-3">
                  Настройки AI
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}