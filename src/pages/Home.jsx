import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button, HeroHeader } from '@aspectum/admin-ui-web';
import { ADMIN } from '../mode/appMode';
import { useAppMode } from '../mode/AppModeContext';

export default function Home() {
  const mode = useAppMode();
  const isAdmin = mode === ADMIN;

  return (
    <Layout>
      <HeroHeader
        title={isAdmin ? 'Админка Aspectum' : 'Студия Aspectum'}
        description={isAdmin
          ? 'Каталог, продажи и подписки. Генерация контента на этой ноде не выполняется.'
          : 'Платформа генерации контента для городов и достопримечательностей'}
        actions={isAdmin ? (
          <>
            <Link to="/catalog">
              <Button variant="primary" size="xl">
                Справочники
              </Button>
            </Link>
            <Link to="/catalog/booking-setup">
              <Button variant="secondary" size="xl">
                Настройка продаж
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link to="/generation">
              <Button variant="primary" size="xl">
                Управление сессиями
              </Button>
            </Link>
            <Link to="/ai/settings">
              <Button variant="secondary" size="xl">
                Настройки AI
              </Button>
            </Link>
          </>
        )}
      />
    </Layout>
  );
}
