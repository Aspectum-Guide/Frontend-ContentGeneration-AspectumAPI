/* eslint-disable react-refresh/only-export-components -- route config is exported for Router smoke tests */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import ErrorBoundary, { SessionWizardErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { LayoutActionsProvider } from './context/LayoutActionsContext';
import NotFound from './pages/NotFound';
import Home from './pages/Home';
import TokenAuth from './pages/TokenAuth';
import { registerAuthNavigate } from './utils/authRedirect';
import { EmptyState, Spinner, UiProvider } from '@aspectum/ui';

const AISettings = lazy(() => import('./pages/ai/AISettings'));
const PromptSettings = lazy(() => import('./pages/ai/PromptSettings'));
const TTSSettings = lazy(() => import('./pages/ai/TTSSettings'));
const CityGeneration = lazy(() => import('./pages/ai/CityGeneration'));
const ImageGeneration = lazy(() => import('./pages/ai/ImageGeneration'));
const Playground = lazy(() => import('./pages/ai/Playground'));
const CatalogHome = lazy(() => import('./pages/catalog/CatalogHome'));
const BookingCatalogHome = lazy(() => import('./pages/catalog/BookingCatalogHome'));
const CitiesCatalog = lazy(() => import('./pages/catalog/CitiesCatalog'));
const EventsCatalog = lazy(() => import('./pages/catalog/EventsCatalog'));
const OrphanEvents = lazy(() => import('./pages/catalog/OrphanEvents'));
const PhotosCatalog = lazy(() => import('./pages/catalog/PhotosCatalog'));
const TagsFilters = lazy(() => import('./pages/catalog/TagsFilters'));
const TicketTypesCatalog = lazy(() => import('./pages/catalog/TicketTypesCatalog'));
const SlotAvailabilitiesCatalog = lazy(() => import('./pages/catalog/SlotAvailabilitiesCatalog'));
const TicketPricesCatalog = lazy(() => import('./pages/catalog/TicketPricesCatalog'));
const BookingSetupWorkbench = lazy(() => import('./pages/catalog/BookingSetupWorkbench'));
const CityPricingWorkbench = lazy(() => import('./pages/catalog/CityPricingWorkbench'));
const SubscriptionTypesCatalog = lazy(() => import('./pages/catalog/SubscriptionTypesCatalog'));
const ActivationCodesCatalog = lazy(() => import('./pages/catalog/ActivationCodesCatalog'));
const UserSubscriptionsWorkbench = lazy(() => import('./pages/catalog/UserSubscriptionsWorkbench'));
const CodeUsageLogsCatalog = lazy(() => import('./pages/catalog/CodeUsageLogsCatalog'));
const CitySubscriptionsCatalog = lazy(() => import('./pages/catalog/CitySubscriptionsCatalog'));
const IAPPurchasesCatalog = lazy(() => import('./pages/catalog/IAPPurchasesCatalog'));
const BookingReservationsCatalog = lazy(() => import('./pages/catalog/BookingReservationsCatalog'));
const BasePricesCatalog = lazy(() => import('./pages/catalog/BasePricesCatalog'));
const PricingRulesCatalog = lazy(() => import('./pages/catalog/PricingRulesCatalog'));
const BookingAnalytics = lazy(() => import('./pages/catalog/BookingAnalytics'));
const ExternalProductsCatalog = lazy(() => import('./pages/catalog/ExternalProductsCatalog'));
const ExternalProductsLinking = lazy(() => import('./pages/catalog/ExternalProductsLinking'));
const ProductAnalytics = lazy(() => import('./pages/catalog/ProductAnalytics'));
const AudioGuidesCatalog = lazy(() => import('./pages/catalog/AudioGuidesCatalog'));
const InteractiveLocationsCatalog = lazy(() => import('./pages/catalog/InteractiveLocationsCatalog'));
const LLMKeysCatalog = lazy(() => import('./pages/catalog/LLMKeysCatalog'));
const LLMUsageCatalog = lazy(() => import('./pages/catalog/LLMUsageCatalog'));
const ContentAuthorsCatalog = lazy(() => import('./pages/catalog/ContentAuthorsCatalog'));
const ExportCities = lazy(() => import('./pages/export/ExportCities'));
const ExportEvents = lazy(() => import('./pages/export/ExportEvents'));
const ExportZip = lazy(() => import('./pages/export/ExportZip'));
const GenerationList = lazy(() => import('./pages/generation/GenerationList'));
const NewSession = lazy(() => import('./pages/generation/NewSession'));
const SessionsList = lazy(() => import('./pages/generation/SessionsList'));
const SessionWizard = lazy(() => import('./pages/generation/SessionWizard'));
const UploadFile = lazy(() => import('./pages/generation/UploadFile'));
const ImportGoogleSheet = lazy(() => import('./pages/import/ImportGoogleSheet'));
const MyTasks = lazy(() => import('./pages/tasks/MyTasks'));
const MediaRecovery = lazy(() => import('./pages/tasks/MediaRecovery'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));

export const routes = [
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
    element: <ProtectedRoute><ErrorBoundary><SessionsList /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/generation/list',
    element: <ProtectedRoute><ErrorBoundary><GenerationList /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/generation/upload',
    element: <ProtectedRoute><ErrorBoundary><UploadFile /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/generation/new',
    element: <ProtectedRoute><ErrorBoundary><NewSession /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/generation/:sessionId',
    element: (
      <ProtectedRoute>
        <SessionWizardErrorBoundary>
          <Suspense fallback={<EmptyState icon={<Spinner size="md" />} title="Загрузка сессии…" spacing="md" />}>
            <SessionWizard />
          </Suspense>
        </SessionWizardErrorBoundary>
      </ProtectedRoute>
    ),
  },
  {
    path: '/ai/settings',
    element: <ProtectedRoute><ErrorBoundary><AISettings /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/prompts',
    element: <ProtectedRoute><ErrorBoundary><PromptSettings /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/tts',
    element: <ProtectedRoute><ErrorBoundary><TTSSettings /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/playground',
    element: <ProtectedRoute><ErrorBoundary><Playground /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/images',
    element: <ProtectedRoute><ErrorBoundary><ImageGeneration /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/cities',
    element: <ProtectedRoute><ErrorBoundary><CityGeneration /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/events',
    element: <Navigate to="/generation" replace />,
  },
  {
    path: '/tasks',
    element: <ProtectedRoute><ErrorBoundary><MyTasks /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/tasks/media-recovery',
    element: <ProtectedRoute><ErrorBoundary><MediaRecovery /></ErrorBoundary></ProtectedRoute>,
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
    element: <ProtectedRoute><ErrorBoundary><ExternalProductsLinking /></ErrorBoundary></ProtectedRoute>,
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
    element: <ProtectedRoute><ErrorBoundary><CitiesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/events',
    element: <ProtectedRoute><ErrorBoundary><EventsCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/events/orphans',
    element: <ProtectedRoute><ErrorBoundary><OrphanEvents /></ErrorBoundary></ProtectedRoute>,
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
    element: <ProtectedRoute><ErrorBoundary><AudioGuidesCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/interactive-locations',
    element: <ProtectedRoute><ErrorBoundary><InteractiveLocationsCatalog /></ErrorBoundary></ProtectedRoute>,
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
    element: <ProtectedRoute><ErrorBoundary><PhotosCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/tags',
    element: <ProtectedRoute><ErrorBoundary><TagsFilters /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/export/zip',
    element: <ProtectedRoute><ErrorBoundary><ExportZip /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/export/cities',
    element: <ProtectedRoute><ErrorBoundary><ExportCities /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/export/events',
    element: <ProtectedRoute><ErrorBoundary><ExportEvents /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/import/google-sheet',
    element: <ProtectedRoute><ErrorBoundary><ImportGoogleSheet /></ErrorBoundary></ProtectedRoute>,
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
    <UiProvider>
      <ErrorBoundary>
        <LayoutActionsProvider>
          <Suspense fallback={<EmptyState icon={<Spinner size="md" />} title="Загрузка…" spacing="md" />}>
            <RouterProvider router={router} />
          </Suspense>
        </LayoutActionsProvider>
      </ErrorBoundary>
    </UiProvider>
  );
}

export default App;
