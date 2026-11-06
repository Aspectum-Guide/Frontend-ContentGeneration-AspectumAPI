import Layout from '../../components/Layout';
import { CatalogHubPage } from '../../features/catalog/shared/CatalogHub';
import { CATALOG_SECTIONS } from '../../features/catalog/shared/catalogSections';
import { filterCatalogSections } from '../../mode/appMode';
import { useAppMode } from '../../mode/AppModeContext';

export default function CatalogHome() {
  const mode = useAppMode();
  return (
    <Layout>
      <CatalogHubPage
        title="Каталог API-справочников"
        subtitle="Внешняя админ-панель: сущности сгруппированы по backend API-доменам."
        sections={filterCatalogSections(CATALOG_SECTIONS, mode)}
      />
    </Layout>
  );
}
