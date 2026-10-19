import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button, HeroHeader } from '@aspectum/admin-ui-web';

export default function NotFound() {
  return (
    <Layout>
      <HeroHeader
        title="404"
        description="Страница не найдена"
        titleSize="display"
        titleTone="faint"
        className="flex min-h-[60vh] flex-col items-center justify-center"
        actions={<Link to="/"><Button variant="primary" size="lg">На главную</Button></Link>}
      />
    </Layout>
  );
}
