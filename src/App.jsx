import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import TokenAuth from './pages/TokenAuth';
import ProtectedRoute from './components/ProtectedRoute';
import SessionsList from './pages/generation/SessionsList';
import GenerationList from './pages/generation/GenerationList';
import UploadFile from './pages/generation/UploadFile';
import NewSession from './pages/generation/NewSession';
import SessionWizard from './pages/generation/SessionWizard';
import AISettings from './pages/ai/AISettings';
import Playground from './pages/ai/Playground';
import ImageGeneration from './pages/ai/ImageGeneration';
import CityGeneration from './pages/ai/CityGeneration';
import EventGeneration from './pages/ai/EventGeneration';
import MyTasks from './pages/tasks/MyTasks';
import CitiesCatalog from './pages/catalog/CitiesCatalog';
import EventsCatalog from './pages/catalog/EventsCatalog';
import PhotosCatalog from './pages/catalog/PhotosCatalog';
import TagsFilters from './pages/catalog/TagsFilters';
import ExportZip from './pages/export/ExportZip';
import ExportCities from './pages/export/ExportCities';
import ExportEvents from './pages/export/ExportEvents';
import ImportGoogleSheet from './pages/import/ImportGoogleSheet';
import { LayoutActionsProvider } from './context/LayoutActionsContext';

// TODO: Включить маршрут входа когда будет готов
const ENABLE_LOGIN = false;

function App() {
  return (
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
        <Route path="/generation/:sessionId" element={<ProtectedRoute><SessionWizard /></ProtectedRoute>} />
        
        {/* Работа с ИИ */}
        <Route path="/ai/settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
        <Route path="/ai/playground" element={<ProtectedRoute><Playground /></ProtectedRoute>} />
        <Route path="/ai/images" element={<ProtectedRoute><ImageGeneration /></ProtectedRoute>} />
        <Route path="/ai/cities" element={<ProtectedRoute><CityGeneration /></ProtectedRoute>} />
        <Route path="/ai/events" element={<ProtectedRoute><EventGeneration /></ProtectedRoute>} />
        
        {/* Задачи генерации */}
        <Route path="/tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        
        {/* Справочники */}
        <Route path="/catalog/cities" element={<ProtectedRoute><CitiesCatalog /></ProtectedRoute>} />
        <Route path="/catalog/events" element={<ProtectedRoute><EventsCatalog /></ProtectedRoute>} />
        <Route path="/catalog/photos" element={<ProtectedRoute><PhotosCatalog /></ProtectedRoute>} />
        <Route path="/catalog/tags" element={<ProtectedRoute><TagsFilters /></ProtectedRoute>} />
        
        {/* Экспорт / Импорт */}
        <Route path="/export/zip" element={<ProtectedRoute><ExportZip /></ProtectedRoute>} />
        <Route path="/export/cities" element={<ProtectedRoute><ExportCities /></ProtectedRoute>} />
        <Route path="/export/events" element={<ProtectedRoute><ExportEvents /></ProtectedRoute>} />
        <Route path="/import/google-sheet" element={<ProtectedRoute><ImportGoogleSheet /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </LayoutActionsProvider>
  );
}

export default App;
