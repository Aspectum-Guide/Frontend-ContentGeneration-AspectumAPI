import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionWizardStepFallback } from '../SessionWizard.jsx';

describe('SessionWizardStepFallback', () => {
  it('shows a loading state while a lazy step is being fetched', () => {
    render(<SessionWizardStepFallback />);

    expect(screen.getByText('Загрузка шага…')).toBeTruthy();
  });
});
