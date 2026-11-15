import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionWizardPublishStep from './SessionWizardPublishStep.jsx';

describe('SessionWizardPublishStep actions', () => {
  it('keeps publish and translate actions disabled when there is no content', () => {
    render(<SessionWizardPublishStep />);

    expect(screen.getByRole('button', { name: 'Перевести сессию' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '✓ Опубликовать сессию' }).disabled).toBe(true);
  });

  it('calls the existing step, translate, and publish callbacks when content exists', () => {
    const onGoToStep = vi.fn();
    const onTranslateSession = vi.fn();
    const onPublish = vi.fn();

    render(
      <SessionWizardPublishStep
        session={{ name: 'Тестовый город' }}
        cityDrafts={[{ id: 'draft-1' }]}
        onGoToStep={onGoToStep}
        onTranslateSession={onTranslateSession}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
    fireEvent.click(screen.getByRole('button', { name: 'Перевести сессию' }));
    fireEvent.click(screen.getByRole('button', { name: '✓ Опубликовать сессию' }));

    expect(onGoToStep).toHaveBeenCalledWith(4);
    expect(onTranslateSession).toHaveBeenCalledOnce();
    expect(onPublish).toHaveBeenCalledOnce();
  });
});
