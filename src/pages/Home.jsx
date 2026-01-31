import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/ui/Button';

export default function Home() {
  return (
    <Layout>
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Aspectum Admin
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Платформа генерации контента для городов и достопримечательностей
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/generation">
            <Button variant="primary" className="text-lg px-8 py-3">
              Управление сессиями
            </Button>
          </Link>
          <Link to="/ai-settings">
            <Button variant="secondary" className="text-lg px-8 py-3">
              Настройки AI
            </Button>
          </Link>
        </div>      </div>
    </Layout>
  );
}