/* eslint-disable react-refresh/only-export-components -- route config is exported for Router smoke tests */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import ErrorBoundary, { SessionWizardErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { LayoutActionsProvider } from './context/LayoutActionsContext';
import { AppModeProvider } from './mode/AppModeContext';
import RequireStudio from './mode/RequireStudio';
import { registerAuthNavigate } from './utils/authRedirect';
import { resolveNavScope } from './config/nav';
import { filterRoutesByScope } from './config/scope';
import { EmptyState, Spinner, UiProvider } from '@aspectum/admin-ui-web';

function PageLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8 text-sm text-aspectum-text-subtle">
      <div className="flex items-center gap-3 px-4 py-3 rounded-aspectum-card border border-aspectum-border bg-aspectum-surface shadow-sm">
        <div className="w-4 h-4 border-2 border-aspectum-primary border-t-transparent rounded-full animate-spin" />
        <span>Загрузка страницы…</span>
      </div>
    </div>
  );
}

function lazyPage(importFn) {
  const LazyComponent = lazy(importFn);
  return function SuspenseWrappedPage(props) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const TokenAuth = lazyPage(() => import('./pages/TokenAuth'));
const Home = lazyPage(() => import('./pages/Home'));
const AccountSettings = lazyPage(() => import('./pages/AccountSettings'));
const NotFound = lazyPage(() => import('./pages/NotFound'));

// Generation & Studio
const SessionsList = lazyPage(() => import('./pages/generation/SessionsList'));
const GenerationList = lazyPage(() => import('./pages/generation/GenerationList'));
const NewSession = lazyPage(() => import('./pages/generation/NewSession'));
const SessionWizard = lazyPage(() => import('./pages/generation/SessionWizard'));

// AI
const AISettings = lazyPage(() => import('./pages/ai/AISettings'));
const PromptSettings = lazyPage(() => import('./pages/ai/PromptSettings'));
const TTSSettings = lazyPage(() => import('./pages/ai/TTSSettings'));
const Playground = lazyPage(() => import('./pages/ai/Playground'));
const ImageGeneration = lazyPage(() => import('./pages/ai/ImageGeneration'));
const CityGeneration = lazyPage(() => import('./pages/ai/CityGeneration'));

// Catalog
const CatalogHome = lazyPage(() => import('./pages/catalog/CatalogHome'));
const BookingCatalogHome = lazyPage(() => import('./pages/catalog/BookingCatalogHome'));
const CitiesCatalog = lazyPage(() => import('./pages/catalog/CitiesCatalog'));
const EventsCatalog = lazyPage(() => import('./pages/catalog/EventsCatalog'));
const OrphanEvents = lazyPage(() => import('./pages/catalog/OrphanEvents'));
const PhotosCatalog = lazyPage(() => import('./pages/catalog/PhotosCatalog'));
const TagsFilters = lazyPage(() => import('./pages/catalog/TagsFilters'));
const TicketTypesCatalog = lazyPage(() => import('./pages/catalog/TicketTypesCatalog'));
const SlotAvailabilitiesCatalog = lazyPage(() => import('./pages/catalog/SlotAvailabilitiesCatalog'));
const TicketPricesCatalog = lazyPage(() => import('./pages/catalog/TicketPricesCatalog'));
const BookingSetupWorkbench = lazyPage(() => import('./pages/catalog/BookingSetupWorkbench'));
const CityPricingWorkbench = lazyPage(() => import('./pages/catalog/CityPricingWorkbench'));
const SubscriptionTypesCatalog = lazyPage(() => import('./pages/catalog/SubscriptionTypesCatalog'));
const ActivationCodesCatalog = lazyPage(() => import('./pages/catalog/ActivationCodesCatalog'));
const PartnersCatalog = lazyPage(() => import('./pages/catalog/PartnersCatalog'));
const PartnerDetail = lazyPage(() => import('./pages/catalog/PartnerDetail'));
const SuppliersCatalog = lazyPage(() => import('./pages/catalog/SuppliersCatalog'));
const SupplierTourReview = lazyPage(() => import('./pages/catalog/SupplierTourReview'));
const UserSubscriptionsWorkbench = lazyPage(() => import('./pages/catalog/UserSubscriptionsWorkbench'));
const CodeUsageLogsCatalog = lazyPage(() => import('./pages/catalog/CodeUsageLogsCatalog'));
const CitySubscriptionsCatalog = lazyPage(() => import('./pages/catalog/CitySubscriptionsCatalog'));
const IAPPurchasesCatalog = lazyPage(() => import('./pages/catalog/IAPPurchasesCatalog'));
const BookingReservationsCatalog = lazyPage(() => import('./pages/catalog/BookingReservationsCatalog'));
const BasePricesCatalog = lazyPage(() => import('./pages/catalog/BasePricesCatalog'));
const PricingRulesCatalog = lazyPage(() => import('./pages/catalog/PricingRulesCatalog'));
const BookingAnalytics = lazyPage(() => import('./pages/catalog/BookingAnalytics'));
const ExternalProductsCatalog = lazyPage(() => import('./pages/catalog/ExternalProductsCatalog'));
const ExternalProductsLinking = lazyPage(() => import('./pages/catalog/ExternalProductsLinking'));
const ProductAnalytics = lazyPage(() => import('./pages/catalog/ProductAnalytics'));
const AudioGuidesCatalog = lazyPage(() => import('./pages/catalog/AudioGuidesCatalog'));
const InteractiveLocationsCatalog = lazyPage(() => import('./pages/catalog/InteractiveLocationsCatalog'));
const LLMKeysCatalog = lazyPage(() => import('./pages/catalog/LLMKeysCatalog'));
const LLMUsageCatalog = lazyPage(() => import('./pages/catalog/LLMUsageCatalog'));
const ContentAuthorsCatalog = lazyPage(() => import('./pages/catalog/ContentAuthorsCatalog'));
const UsersCatalog = lazyPage(() => import('./pages/catalog/UsersCatalog'));

// Export & Import & Tasks
const ExportCities = lazyPage(() => import('./pages/export/ExportCities'));
const ExportEvents = lazyPage(() => import('./pages/export/ExportEvents'));
const ExportZip = lazyPage(() => import('./pages/export/ExportZip'));
const ImportGoogleSheet = lazyPage(() => import('./pages/import/ImportGoogleSheet'));
const MyTasks = lazyPage(() => import('./pages/tasks/MyTasks'));
const AudioQueue = lazyPage(() => import('./pages/tasks/AudioQueue'));
const MediaRecovery = lazyPage(() => import('./pages/tasks/MediaRecovery'));

const allRoutes = [
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
    path: '/catalog/users',
    element: <ProtectedRoute><ErrorBoundary><UsersCatalog /></ErrorBoundary></ProtectedRoute>,
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
    path: '/catalog/partners',
    element: <ProtectedRoute><ErrorBoundary><PartnersCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/partners/:partnerId',
    element: <ProtectedRoute><ErrorBoundary><PartnerDetail /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/suppliers',
    element: <ProtectedRoute><ErrorBoundary><SuppliersCatalog /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/suppliers/:draftId',
    element: <ProtectedRoute><ErrorBoundary><SupplierTourReview /></ErrorBoundary></ProtectedRoute>,
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

// VITE_NAV_SCOPE=studio|catalog builds only serve their own area (config/scope.js).
export const routes = filterRoutesByScope(allRoutes, resolveNavScope());

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
        <AppModeProvider>
          <LayoutActionsProvider>
            <Suspense fallback={<EmptyState icon={<Spinner size="md" />} title="Загрузка…" spacing="md" />}>
              <RouterProvider router={router} />
            </Suspense>
          </LayoutActionsProvider>
        </AppModeProvider>
      </ErrorBoundary>
    </UiProvider>
  );
}

export default App;
