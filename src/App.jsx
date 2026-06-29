import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
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
import BookingCatalogHome from './pages/catalog/BookingCatalogHome';
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

const ENABLE_LOGIN = false;

const routes = [
  {
    path: '/token-auth',
    element: <ErrorBoundary><TokenAuth /></ErrorBoundary>,
  },
  {
    path: '/',
    element: <ErrorBoundary><Home /></ErrorBoundary>,
  },
  ...(ENABLE_LOGIN
    ? [{ path: '/login', element: <ErrorBoundary><Login /></ErrorBoundary> }]
    : []),
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
    element: <ProtectedRoute><SessionWizardErrorBoundary><SessionWizard /></SessionWizardErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/ai/settings',
    element: <ProtectedRoute><ErrorBoundary><AISettings /></ErrorBoundary></ProtectedRoute>,
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
    path: '/catalog',
    element: <ProtectedRoute><ErrorBoundary><CatalogHome /></ErrorBoundary></ProtectedRoute>,
  },
  {
    path: '/catalog/booking',
    element: <ProtectedRoute><ErrorBoundary><BookingCatalogHome /></ErrorBoundary></ProtectedRoute>,
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

function App() {
  return (
    <ErrorBoundary>
      <LayoutActionsProvider>
        <RouterProvider router={router} />
      </LayoutActionsProvider>
    </ErrorBoundary>
  );
}

export default App;
