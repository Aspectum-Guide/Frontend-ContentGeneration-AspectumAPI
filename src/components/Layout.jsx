import { Link, useLocation } from 'react-router-dom';
import Button from './ui/Button';

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Aspectum Admin
              </Link>
              <span className="ml-4 text-sm text-gray-500">
                Content Generation
              </span>
            </div>
            <nav className="flex gap-4">
              <Link
                to="/generation"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname.startsWith('/generation')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Сессии
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
