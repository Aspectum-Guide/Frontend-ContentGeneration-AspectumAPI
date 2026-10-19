import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button, HeroHeader } from '@aspectum/admin-ui-web';

export default function Home() {
  return (
    <Layout>
      <HeroHeader
        title="Aspectum Admin"
        description="Платформа генерации контента для городов и достопримечательностей"
        actions={(
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
