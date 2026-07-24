import { Component } from 'react';
import { reportError } from '../utils/errorReporting';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      const { fallback: Fallback, onReset } = this.props;

      if (Fallback) {
        return (
          <Fallback
            error={this.state.error}
            reset={() => {
              this.setState({ error: null });
              onReset?.();
            }}
          />
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Что-то пошло не так</h1>
            <p className="text-sm text-gray-500 mb-6">
              Произошла непредвиденная ошибка. Попробуйте обновить страницу.
            </p>
            <details className="text-left mb-6">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Подробности ошибки
              </summary>
              <pre className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                {this.state.error?.message}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function SessionWizardFallback({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Ошибка в редакторе сессии</h1>
        <p className="text-sm text-gray-500 mb-6">
          Данные не потеряны — они сохранены на сервере. Вернитесь к списку сессий.
        </p>
        <details className="text-left mb-6">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            Подробности
          </summary>
          <pre className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
            {error?.message}
          </pre>
        </details>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Попробовать снова
          </button>
          <a
            href="/generation"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            К списку сессий
          </a>
        </div>
      </div>
    </div>
  );
}

export function SessionWizardErrorBoundary({ children }) {
  return (
    <ErrorBoundary fallback={SessionWizardFallback}>
      {children}
    </ErrorBoundary>
  );
}
