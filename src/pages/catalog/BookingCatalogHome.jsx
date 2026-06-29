import Layout from '../../components/Layout';
import { CatalogHubPage } from '../../features/catalog/shared/CatalogHub';
import { BOOKING_CATALOG_SECTIONS } from '../../features/catalog/shared/catalogSections';

export default function BookingCatalogHome() {
  return (
    <Layout>
      <CatalogHubPage
        title="Справочники букинга"
        subtitle="Типы билетов, слоты, цены и правила — прямой CRUD по BookingAPI, как справочники контента."
        sections={BOOKING_CATALOG_SECTIONS}
      />
    </Layout>
  );
}
