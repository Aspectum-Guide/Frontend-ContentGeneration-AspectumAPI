import { Component } from 'react';
import { Button, ErrorState } from '@aspectum/admin-ui-web';
import { reportError } from '../utils/errorReporting';
import { isLazyChunkLoadError } from '../utils/lazyChunkRecovery';

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
        <ErrorState
          title="Что-то пошло не так"
          description="Произошла непредвиденная ошибка. Попробуйте обновить страницу."
          details={this.state.error?.message}
          actions={(
            <Button type="button"
              onClick={() => window.location.reload()}
              variant="primary"
              size="md"
            >
              Обновить страницу
            </Button>
          )}
        />
      );
    }

    return this.props.children;
  }
}

function SessionWizardFallback({ error, reset }) {
  const chunkLoadFailed = isLazyChunkLoadError(error);
  const retry = () => {
    if (chunkLoadFailed) {
      window.location.reload();
      return;
    }
    reset();
  };

  return (
    <ErrorState
      title="Ошибка в редакторе сессии"
      description="Данные не потеряны — они сохранены на сервере. Вернитесь к списку сессий."
      details={error?.message}
      detailsLabel="Подробности"
      actions={(
        <>
          <Button type="button"
            onClick={retry}
            variant="outline"
            size="md"
          >
            {chunkLoadFailed ? 'Повторить загрузку' : 'Попробовать снова'}
          </Button>
          <a href="/generation"><Button size="md">К списку сессий</Button></a>
        </>
      )}
    />
  );
}

export function SessionWizardErrorBoundary({ children }) {
  return (
    <ErrorBoundary fallback={SessionWizardFallback}>
      {children}
    </ErrorBoundary>
  );
}
