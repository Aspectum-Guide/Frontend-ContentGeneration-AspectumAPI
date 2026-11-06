import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import ErrorBoundary, { SessionWizardErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { LayoutActionsProvider } from './context/LayoutActionsContext';
import NotFound from './pages/NotFound';
import AISettings from './pages/ai/AISettings';
import PromptSettings from './pages/ai/PromptSettings';
import TTSSettings from './pages/ai/TTSSettings';
import CityGeneration from './pages/ai/CityGeneration';
import ImageGeneration from './pages/ai/ImageGeneration';
import Playground from './pages/ai/Playground';
import CatalogHome from './pages/catalog/CatalogHome';
import BookingCatalogHome from './pages/catalog/BookingCatalogHome';
import CitiesCatalog from './pages/catalog/CitiesCatalog';
import EventsCatalog from './pages/catalog/EventsCatalog';
import OrphanEvents from './pages/catalog/OrphanEvents';
import PhotosCatalog from './pages/catalog/PhotosCatalog';
import TagsFilters from './pages/catalog/TagsFilters';
import TicketTypesCatalog from './pages/catalog/TicketTypesCatalog';
import SlotAvailabilitiesCatalog from './pages/catalog/SlotAvailabilitiesCatalog';
import TicketPricesCatalog from './pages/catalog/TicketPricesCatalog';
import BookingSetupWorkbench from './pages/catalog/BookingSetupWorkbench';
import CityPricingWorkbench from './pages/catalog/CityPricingWorkbench';
import SubscriptionTypesCatalog from './pages/catalog/SubscriptionTypesCatalog';
import ActivationCodesCatalog from './pages/catalog/ActivationCodesCatalog';
import UserSubscriptionsWorkbench from './pages/catalog/UserSubscriptionsWorkbench';
import CodeUsageLogsCatalog from './pages/catalog/CodeUsageLogsCatalog';
import CitySubscriptionsCatalog from './pages/catalog/CitySubscriptionsCatalog';
import IAPPurchasesCatalog from './pages/catalog/IAPPurchasesCatalog';
import BookingReservationsCatalog from './pages/catalog/BookingReservationsCatalog';
import BasePricesCatalog from './pages/catalog/BasePricesCatalog';
import PricingRulesCatalog from './pages/catalog/PricingRulesCatalog';
import BookingAnalytics from './pages/catalog/BookingAnalytics';
import ExternalProductsCatalog from './pages/catalog/ExternalProductsCatalog';
import ExternalProductsLinking from './pages/catalog/ExternalProductsLinking';
import ProductAnalytics from './pages/catalog/ProductAnalytics';
import AudioGuidesCatalog from './pages/catalog/AudioGuidesCatalog';
import InteractiveLocationsCatalog from './pages/catalog/InteractiveLocationsCatalog';
import LLMKeysCatalog from './pages/catalog/LLMKeysCatalog';
import LLMUsageCatalog from './pages/catalog/LLMUsageCatalog';
import ContentAuthorsCatalog from './pages/catalog/ContentAuthorsCatalog';
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
import MyTasks from './pages/tasks/MyTasks';
import AudioQueue from './pages/tasks/AudioQueue';
import MediaRecovery from './pages/tasks/MediaRecovery';
import TokenAuth from './pages/TokenAuth';
import AccountSettings from './pages/AccountSettings';
import { AppModeProvider } from './mode/AppModeContext';
import RequireStudio from './mode/RequireStudio';
import { registerAuthNavigate } from './utils/authRedirect';

const routes = [
  {
    path: '/token-auth',
    element: <ErrorBoundary><TokenAuth /></ErrorBoundary>,
  },
  {
    path: '/',
    element: <ErrorBoundary><Home /></ErrorBoundary>,
  },
  {
    path: '/account/settings',
    element: <ProtectedRoute><ErrorBoundary><AccountSettings /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/generation',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><SessionsList /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/generation/list',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><GenerationList /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/generation/upload',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><UploadFile /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/generation/new',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><NewSession /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/generation/:sessionId',
    element: <RequireStudio><ProtectedRoute><SessionWizardErrorBoundary><SessionWizard /></SessionWizardErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/settings',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><AISettings /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/prompts',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><PromptSettings /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/tts',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><TTSSettings /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/playground',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><Playground /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/images',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><ImageGeneration /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/cities',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><CityGeneration /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/ai/events',
    element: <RequireStudio><Navigate to="/generation" replace /></RequireStudio>,
  },
  {
    path: '/tasks',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><MyTasks /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/tasks/audio-queue',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><AudioQueue /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/tasks/media-recovery',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><MediaRecovery /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog',
    element: <ProtectedRoute><ErrorBoundary><CatalogHome /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/booking',
    element: <ProtectedRoute><ErrorBoundary><BookingCatalogHome /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/external-products',
    element: <ProtectedRoute><ErrorBoundary><ExternalProductsCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/external-products/linking',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><ExternalProductsLinking /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/llm/keys',
    element: <ProtectedRoute><ErrorBoundary><LLMKeysCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/llm/usage',
    element: <ProtectedRoute><ErrorBoundary><LLMUsageCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/cities',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><CitiesCatalog /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/events',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><EventsCatalog /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/events/orphans',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><OrphanEvents /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/authors',
    element: <ProtectedRoute><ErrorBoundary><ContentAuthorsCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/ticket-types',
    element: <ProtectedRoute><ErrorBoundary><TicketTypesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/slot-availabilities',
    element: <ProtectedRoute><ErrorBoundary><SlotAvailabilitiesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/ticket-prices',
    element: <ProtectedRoute><ErrorBoundary><TicketPricesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/booking-setup',
    element: <ProtectedRoute><ErrorBoundary><BookingSetupWorkbench /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/city-pricing',
    element: <ProtectedRoute><ErrorBoundary><CityPricingWorkbench /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/reservations',
    element: <ProtectedRoute><ErrorBoundary><BookingReservationsCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/base-prices',
    element: <ProtectedRoute><ErrorBoundary><BasePricesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/pricing-rules',
    element: <ProtectedRoute><ErrorBoundary><PricingRulesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/analytics',
    element: <ProtectedRoute><ErrorBoundary><BookingAnalytics /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/product-analytics',
    element: <ProtectedRoute><ErrorBoundary><ProductAnalytics /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/audio-guides',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><AudioGuidesCatalog /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/interactive-locations',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><InteractiveLocationsCatalog /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/subscription-types',
    element: <ProtectedRoute><ErrorBoundary><SubscriptionTypesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/activation-codes',
    element: <ProtectedRoute><ErrorBoundary><ActivationCodesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/user-subscriptions',
    element: <ProtectedRoute><ErrorBoundary><UserSubscriptionsWorkbench /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/city-subscriptions',
    element: <ProtectedRoute><ErrorBoundary><CitySubscriptionsCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/code-usage-logs',
    element: <ProtectedRoute><ErrorBoundary><CodeUsageLogsCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/iap-purchases',
    element: <ProtectedRoute><ErrorBoundary><IAPPurchasesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/photos',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><PhotosCatalog /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/catalog/tags',
    element: <ProtectedRoute><ErrorBoundary><TagsFilters /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/export/zip',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><ExportZip /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/export/cities',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><ExportCities /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/export/events',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><ExportEvents /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '/import/google-sheet',
    element: <RequireStudio><ProtectedRoute><ErrorBoundary><ImportGoogleSheet /></ErrorBoundary></ProtectedRoute></RequireStudio>,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

// Позволяет разлогинивать (redirectToAuth) через SPA-навигацию из кода вне
// дерева компонентов (axios-интерсепторы, TokenManager) без полной перезагрузки.
registerAuthNavigate((path, opts) => router.navigate(path, opts));

function App() {
  return (
    <ErrorBoundary>
      <AppModeProvider>
        <LayoutActionsProvider>
          <RouterProvider router={router} />
        </LayoutActionsProvider>
      </AppModeProvider>
    </ErrorBoundary>
  );
}

export default App;
