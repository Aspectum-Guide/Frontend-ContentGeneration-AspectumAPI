import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import AISettings from './pages/AISettings';
import SessionsList from './pages/generation/SessionsList';
import NewSession from './pages/generation/NewSession';
import SessionWizard from './pages/generation/SessionWizard';

// TODO: Включить маршрут входа когда будет готов
const ENABLE_LOGIN = false;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {ENABLE_LOGIN && <Route path="/login" element={<Login />} />}
        <Route path="/ai-settings" element={<AISettings />} />
        <Route path="/generation" element={<SessionsList />} />
        <Route path="/generation/new" element={<NewSession />} />
        <Route path="/generation/:sessionId" element={<SessionWizard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
