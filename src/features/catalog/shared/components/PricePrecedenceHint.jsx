import { Link } from 'react-router-dom';
import { Panel } from '@aspectum/admin-ui-web';

/**
 * Цена билета резолвится из трёх разных таблиц с приоритетом:
 * TicketPrice (точная цена на слот) > PricingRule (правило по дате/дню) >
 * EventTicketTypePrice (базовая цена). Эта страница редактирует только одну
 * из трёх — здесь нет способа увидеть, какая цена реально победит.
 * См. `BookingSetupPricingPanels.jsx` → `PricePreviewPanel` в Workbench,
 * которая это показывает.
 */
export default function PricePrecedenceHint() {
  return (
    <Panel tone="info" className="mb-4 px-3 py-2 text-xs">
      <div className="font-medium text-aspectum-text-emphasis">Приоритет цены билета</div>
      <div className="mt-1">
        Цена на слоте (эта таблица, если это «Цены на слотах») побеждает над правилом,
        правило — над базовой ценой. Здесь редактируется только один из трёх уровней —
        итоговую резолвленную цену с указанием источника показывает{' '}
        <Link to="/catalog/booking-setup" className="text-aspectum-primary hover:underline">
          Workbench
        </Link>
        .
      </div>
    </Panel>
  );
}
