import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary, { SessionWizardErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { LayoutActionsProvider } from './context/LayoutActionsContext';
import NotFound from './pages/NotFound';
import AISettings from './pages/ai/AISettings';
import TTSSettings from './pages/ai/TTSSettings';
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
          <Route path="/token-auth" element={<ErrorBoundary><TokenAuth /></ErrorBoundary>} />

          {/* Открытые маршруты */}
          <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
          {ENABLE_LOGIN && <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />}

          {/* Защищённые маршруты - требуют токена */}

          {/* Сессии */}
          <Route path="/generation" element={<ProtectedRoute><ErrorBoundary><SessionsList /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/generation/list" element={<ProtectedRoute><ErrorBoundary><GenerationList /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/generation/upload" element={<ProtectedRoute><ErrorBoundary><UploadFile /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/generation/new" element={<ProtectedRoute><ErrorBoundary><NewSession /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/generation/:sessionId" element={<ProtectedRoute><SessionWizardErrorBoundary><SessionWizard /></SessionWizardErrorBoundary></ProtectedRoute>} />

          {/* Работа с ИИ */}
          <Route path="/ai/settings" element={<ProtectedRoute><ErrorBoundary><AISettings /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/ai/tts" element={<ProtectedRoute><ErrorBoundary><TTSSettings /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/ai/playground" element={<ProtectedRoute><ErrorBoundary><Playground /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/ai/images" element={<ProtectedRoute><ErrorBoundary><ImageGeneration /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/ai/cities" element={<ProtectedRoute><ErrorBoundary><CityGeneration /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/ai/events" element={<Navigate to="/generation" replace />} />

          {/* Задачи генерации */}
          <Route path="/tasks" element={<ProtectedRoute><ErrorBoundary><MyTasks /></ErrorBoundary></ProtectedRoute>} />

          {/* Справочники */}
          <Route path="/catalog" element={<ProtectedRoute><ErrorBoundary><CatalogHome /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/cities" element={<ProtectedRoute><ErrorBoundary><CitiesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/events" element={<ProtectedRoute><ErrorBoundary><EventsCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/ticket-types" element={<ProtectedRoute><ErrorBoundary><TicketTypesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/slot-availabilities" element={<ProtectedRoute><ErrorBoundary><SlotAvailabilitiesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/ticket-prices" element={<ProtectedRoute><ErrorBoundary><TicketPricesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/booking-setup" element={<ProtectedRoute><ErrorBoundary><BookingSetupWorkbench /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/reservations" element={<ProtectedRoute><ErrorBoundary><BookingReservationsCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/base-prices" element={<ProtectedRoute><ErrorBoundary><BasePricesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/pricing-rules" element={<ProtectedRoute><ErrorBoundary><PricingRulesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/analytics" element={<ProtectedRoute><ErrorBoundary><BookingAnalytics /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/audio-guides" element={<ProtectedRoute><ErrorBoundary><AudioGuidesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/interactive-locations" element={<ProtectedRoute><ErrorBoundary><InteractiveLocationsCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/subscription-types" element={<ProtectedRoute><ErrorBoundary><SubscriptionTypesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/activation-codes" element={<ProtectedRoute><ErrorBoundary><ActivationCodesCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/photos" element={<ProtectedRoute><ErrorBoundary><PhotosCatalog /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/catalog/tags" element={<ProtectedRoute><ErrorBoundary><TagsFilters /></ErrorBoundary></ProtectedRoute>} />

          {/* Экспорт / Импорт */}
          <Route path="/export/zip" element={<ProtectedRoute><ErrorBoundary><ExportZip /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/export/cities" element={<ProtectedRoute><ErrorBoundary><ExportCities /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/export/events" element={<ProtectedRoute><ErrorBoundary><ExportEvents /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/import/google-sheet" element={<ProtectedRoute><ErrorBoundary><ImportGoogleSheet /></ErrorBoundary></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </LayoutActionsProvider>
    </ErrorBoundary>
  );
}

export default App;
