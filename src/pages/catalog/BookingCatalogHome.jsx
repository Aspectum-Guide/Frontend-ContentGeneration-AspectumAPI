import Layout from '../../components/Layout';
import { CatalogHubPage } from '../../features/catalog/shared/CatalogHub';
import { BOOKING_CATALOG_SECTIONS } from '../../features/catalog/shared/catalogSections';
import { filterCatalogSections } from '../../mode/appMode';
import { useAppMode } from '../../mode/AppModeContext';

export default function BookingCatalogHome() {
  const mode = useAppMode();
  return (
    <Layout>
      <CatalogHubPage
        title="Справочники букинга"
        subtitle="Типы билетов, слоты, цены и правила — прямой CRUD по BookingAPI, как справочники контента."
        sections={filterCatalogSections(BOOKING_CATALOG_SECTIONS, mode)}
      />
    </Layout>
  );
}
