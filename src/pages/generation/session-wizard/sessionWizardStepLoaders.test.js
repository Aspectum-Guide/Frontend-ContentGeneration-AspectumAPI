import { describe, expect, it } from 'vitest';
import { sessionWizardStepLoaders } from './sessionWizardStepLoaders';

describe('Session Wizard lazy step loaders', () => {
  it('loads every step as a default React component', async () => {
    const entries = Object.entries(sessionWizardStepLoaders);
    const modules = await Promise.all(entries.map(([, load]) => load()));

    expect(entries).toHaveLength(11);
    modules.forEach((module) => {
      expect(module.default).toBeTypeOf('function');
    });
  });
});
