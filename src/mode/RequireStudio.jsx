import { Navigate } from 'react-router-dom';
import { ADMIN, landingPath } from './appMode';
import { useAppMode } from './AppModeContext';

/** На админке студийный адрес уводит в каталог, а не в 404 генерации. */
export default function RequireStudio({ children }) {
  const mode = useAppMode();
  if (mode === ADMIN) {
    return <Navigate to={landingPath(ADMIN)} replace />;
  }
  return children;
}
