import Layout from '../../components/Layout';
import { CatalogHubPage } from '../../features/catalog/shared/CatalogHub';
import { CATALOG_SECTIONS } from '../../features/catalog/shared/catalogSections';

export default function CatalogHome() {
  return (
    <Layout>
      <CatalogHubPage
        title="Каталог API-справочников"
        subtitle="Внешняя админ-панель: сущности сгруппированы по backend API-доменам."
        sections={CATALOG_SECTIONS}
      />
    </Layout>
  );
}
