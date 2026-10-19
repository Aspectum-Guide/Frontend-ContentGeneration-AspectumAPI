import { describe, expect, it, vi } from 'vitest';
import { persistBeforeStepChange } from './sessionWizardNavigation';

const createActions = () => ({
  saveCity: vi.fn().mockResolvedValue(undefined),
  saveInteractiveLocation: vi.fn().mockResolvedValue(undefined),
  flushEditors: vi.fn().mockResolvedValue(undefined),
  reloadSession: vi.fn().mockResolvedValue(undefined),
});

describe('persistBeforeStepChange', () => {
  it('flushes the city and dirty editors before leaving the city step', async () => {
    const actions = createActions();

    await persistBeforeStepChange({
      ...actions,
      fromStep: 1,
      targetStep: 2,
      publishStep: 5,
      activeCityDraftId: 'city-1',
    });

    expect(actions.saveCity).toHaveBeenCalledOnce();
    expect(actions.flushEditors).toHaveBeenCalledOnce();
    expect(actions.reloadSession).not.toHaveBeenCalled();
  });

  it('saves an interactive location before leaving its step', async () => {
    const actions = createActions();

    await persistBeforeStepChange({
      ...actions,
      fromStep: 4,
      targetStep: 3,
      publishStep: 5,
      activeCityDraftId: 'city-1',
    });

    expect(actions.saveInteractiveLocation).toHaveBeenCalledWith({ silent: true });
    expect(actions.flushEditors).toHaveBeenCalledOnce();
  });

  it('forces a fresh server snapshot before opening publish', async () => {
    const actions = createActions();

    await persistBeforeStepChange({
      ...actions,
      fromStep: 3,
      targetStep: 5,
      publishStep: 5,
      activeCityDraftId: 'city-1',
    });

    expect(actions.saveCity).toHaveBeenCalledOnce();
    expect(actions.flushEditors).toHaveBeenCalledTimes(2);
    expect(actions.reloadSession).toHaveBeenCalledWith('city-1', {
      silent: true,
      force: true,
      preserveCurrentEditors: true,
    });
  });

  it('stops the transition when persistence fails', async () => {
    const actions = createActions();
    actions.flushEditors.mockRejectedValue(new Error('save failed'));

    await expect(persistBeforeStepChange({
      ...actions,
      fromStep: 3,
      targetStep: 4,
      publishStep: 5,
      activeCityDraftId: 'city-1',
    })).rejects.toThrow('save failed');
    expect(actions.reloadSession).not.toHaveBeenCalled();
  });
});
