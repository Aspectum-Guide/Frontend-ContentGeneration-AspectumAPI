import { afterEach, describe, expect, it } from 'vitest';
import { resolveNavScope } from './nav';
import { explicitAppMode } from '../mode/appMode';

describe('runtime app-config', () => {
  afterEach(() => {
    delete window.__APP_CONFIG__;
  });

  it('takes the nav scope from the container config', () => {
    window.__APP_CONFIG__ = { navScope: 'catalog' };
    expect(resolveNavScope()).toBe('catalog');
  });

  it('falls back to everything without a config', () => {
    expect(resolveNavScope()).toBe('all');
  });

  it('forces the app mode from the container config', () => {
    window.__APP_CONFIG__ = { appMode: 'admin' };
    expect(explicitAppMode()).toBe('admin');
  });

  it('an explicit env still wins over the container config', () => {
    window.__APP_CONFIG__ = { appMode: 'admin' };
    expect(explicitAppMode({ VITE_APP_MODE: 'studio' })).toBe('studio');
    expect(explicitAppMode({})).toBeNull();
  });
});
