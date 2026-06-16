import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary, { SessionWizardErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { LayoutActionsProvider } from './context/LayoutActionsContext';
import NotFound from './pages/NotFound';
import AISettings from './pages/ai/AISettings';
import CityGeneration from './pages/ai/CityGeneration';
import ImageGeneration from './pages/ai/ImageGeneration';
import Playground from './pages/ai/Playground';
import CatalogHome from './pages/catalog/CatalogHome';
import CitiesCatalog from './pages/catalog/CitiesCatalog';
import EventsCatalog from './pages/catalog/EventsCatalog';
import PhotosCatalog from './pages/catalog/PhotosCatalog';
import TagsFilters from './pages/catalog/TagsFilters';
import TicketTypesCatalog from './pages/catalog/TicketTypesCatalog';
import SlotAvailabilitiesCatalog from './pages/catalog/SlotAvailabilitiesCatalog';
import TicketPricesCatalog from './pages/catalog/TicketPricesCatalog';
import BookingSetupWorkbench from './pages/catalog/BookingSetupWorkbench';
import SubscriptionTypesCatalog from './pages/catalog/SubscriptionTypesCatalog';
import ActivationCodesCatalog from './pages/catalog/ActivationCodesCatalog';
import BookingReservationsCatalog from './pages/catalog/BookingReservationsCatalog';
import BasePricesCatalog from './pages/catalog/BasePricesCatalog';
import PricingRulesCatalog from './pages/catalog/PricingRulesCatalog';
import BookingAnalytics from './pages/catalog/BookingAnalytics';
import AudioGuidesCatalog from './pages/catalog/AudioGuidesCatalog';
import InteractiveLocationsCatalog from './pages/catalog/InteractiveLocationsCatalog';
import ExportCities from './pages/export/ExportCities';
import ExportEvents from './pages/export/ExportEvents';
import ExportZip from './pages/export/ExportZip';
import GenerationList from './pages/generation/GenerationList';
import NewSession from './pages/generation/NewSession';
import SessionsList from './pages/generation/SessionsList';
import SessionWizard from './pages/generation/SessionWizard';
import UploadFile from './pages/generation/UploadFile';
import Home from './pages/Home';
import ImportGoogleSheet from './pages/import/ImportGoogleSheet';
import Login from './pages/Login';
import MyTasks from './pages/tasks/MyTasks';
import TokenAuth from './pages/TokenAuth';

// TODO: Включить маршрут входа когда будет готов
const ENABLE_LOGIN = false;

function App() {
  return (
    <ErrorBoundary>
    <LayoutActionsProvider>
      <BrowserRouter>
        <Routes>
          {/* Страница ввода токена */}
          <Route path="/token-auth" element={<TokenAuth />} />

          {/* Открытые маршруты */}
          <Route path="/" element={<Home />} />
          {ENABLE_LOGIN && <Route path="/login" element={<Login />} />}

          {/* Защищённые маршруты - требуют токена */}

          {/* Сессии */}
          <Route path="/generation" element={<ProtectedRoute><SessionsList /></ProtectedRoute>} />
          <Route path="/generation/list" element={<ProtectedRoute><GenerationList /></ProtectedRoute>} />
          <Route path="/generation/upload" element={<ProtectedRoute><UploadFile /></ProtectedRoute>} />
          <Route path="/generation/new" element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
          <Route path="/generation/:sessionId" element={<ProtectedRoute><SessionWizardErrorBoundary><SessionWizard /></SessionWizardErrorBoundary></ProtectedRoute>} />

          {/* Работа с ИИ */}
          <Route path="/ai/settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
          <Route path="/ai/playground" element={<ProtectedRoute><Playground /></ProtectedRoute>} />
          <Route path="/ai/images" element={<ProtectedRoute><ImageGeneration /></ProtectedRoute>} />
          <Route path="/ai/cities" element={<ProtectedRoute><CityGeneration /></ProtectedRoute>} />
          <Route path="/ai/events" element={<Navigate to="/generation" replace />} />

          {/* Задачи генерации */}
          <Route path="/tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />

          {/* Справочники */}
          <Route path="/catalog" element={<ProtectedRoute><CatalogHome /></ProtectedRoute>} />
          <Route path="/catalog/cities" element={<ProtectedRoute><CitiesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/events" element={<ProtectedRoute><EventsCatalog /></ProtectedRoute>} />
          <Route path="/catalog/ticket-types" element={<ProtectedRoute><TicketTypesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/slot-availabilities" element={<ProtectedRoute><SlotAvailabilitiesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/ticket-prices" element={<ProtectedRoute><TicketPricesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/booking-setup" element={<ProtectedRoute><BookingSetupWorkbench /></ProtectedRoute>} />
          <Route path="/catalog/reservations" element={<ProtectedRoute><BookingReservationsCatalog /></ProtectedRoute>} />
          <Route path="/catalog/base-prices" element={<ProtectedRoute><BasePricesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/pricing-rules" element={<ProtectedRoute><PricingRulesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/analytics" element={<ProtectedRoute><BookingAnalytics /></ProtectedRoute>} />
          <Route path="/catalog/audio-guides" element={<ProtectedRoute><AudioGuidesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/interactive-locations" element={<ProtectedRoute><InteractiveLocationsCatalog /></ProtectedRoute>} />
          <Route path="/catalog/subscription-types" element={<ProtectedRoute><SubscriptionTypesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/activation-codes" element={<ProtectedRoute><ActivationCodesCatalog /></ProtectedRoute>} />
          <Route path="/catalog/photos" element={<ProtectedRoute><PhotosCatalog /></ProtectedRoute>} />
          <Route path="/catalog/tags" element={<ProtectedRoute><TagsFilters /></ProtectedRoute>} />

          {/* Экспорт / Импорт */}
          <Route path="/export/zip" element={<ProtectedRoute><ExportZip /></ProtectedRoute>} />
          <Route path="/export/cities" element={<ProtectedRoute><ExportCities /></ProtectedRoute>} />
          <Route path="/export/events" element={<ProtectedRoute><ExportEvents /></ProtectedRoute>} />
          <Route path="/import/google-sheet" element={<ProtectedRoute><ImportGoogleSheet /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </LayoutActionsProvider>
    </ErrorBoundary>
  );
}

export default App;
