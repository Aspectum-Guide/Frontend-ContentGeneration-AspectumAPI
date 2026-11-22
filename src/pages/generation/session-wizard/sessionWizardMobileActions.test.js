import { describe, expect, it, vi } from 'vitest';
import { buildSessionWizardMobileActions } from './sessionWizardMobileActions';

const makeActions = (overrides = {}) => {
  const callbacks = {
    saveCityForStep1: vi.fn(),
    handlePublish: vi.fn(),
    setCloseMode: vi.fn(),
    setCloseOpen: vi.fn(),
  };
  const actions = buildSessionWizardMobileActions({
    session: { status: 'draft', closed_with_save: false },
    citySaving: false,
    publishing: false,
    ...callbacks,
    ...overrides,
  });
  return { actions, callbacks };
};

describe('Session Wizard mobile actions', () => {
  it('exposes working save, publish, and close actions for a draft', () => {
    const { actions, callbacks } = makeActions();
    expect(actions.map(({ id }) => id)).toEqual([
      'save-city-data',
      'publish-session',
      'close-session',
    ]);

    actions.forEach((action) => action.onClick());
    expect(callbacks.saveCityForStep1).toHaveBeenCalledOnce();
    expect(callbacks.handlePublish).toHaveBeenCalledOnce();
    expect(callbacks.setCloseMode).toHaveBeenCalledWith('save');
    expect(callbacks.setCloseOpen).toHaveBeenCalledWith(true);
  });

  it('disables in-flight actions and hides unavailable actions for a closed session', () => {
    const { actions, callbacks } = makeActions({
      session: { status: 'completed', closed_with_save: true },
      citySaving: true,
      publishing: true,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ id: 'save-city-data', disabled: true, label: 'Сохранение...' });
    actions[0].onClick();
    expect(callbacks.saveCityForStep1).not.toHaveBeenCalled();
  });
});
