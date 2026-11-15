import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionWizardCityStepSection from './SessionWizardCityStepSection.jsx';

const captured = vi.hoisted(() => ({ cityStepProps: null }));

vi.mock('./SessionWizardGenerateCityFull.jsx', () => ({
  default: () => <div data-testid="city-generator" />,
}));
vi.mock('./SessionWizardCityStep.jsx', () => ({
  default: (props) => {
    captured.cityStepProps = props;
    return <div data-testid="city-form" />;
  },
}));
vi.mock('./SessionWizardCityTagsPicker.jsx', () => ({
  default: () => <div data-testid="city-tags" />,
}));
vi.mock('./SessionWizardCityInfoStep.jsx', () => ({
  default: () => <div data-testid="city-info" />,
}));

describe('SessionWizardCityStepSection', () => {
  it('composes the existing city sections and preserves their callbacks', () => {
    const setLat = vi.fn();
    const setLon = vi.fn();
    const onCityFormBlur = vi.fn();
    const controller = {
      activeCityDraftId: 'draft-1',
      defaultLocale: 'ru',
      savedLat: 55.75,
      savedLon: 37.61,
      setLat,
      setLon,
      onCityFormBlur,
      loadSession: vi.fn(),
    };

    render(
      <SessionWizardCityStepSection
        controller={controller}
        sessionId="session-1"
        currentLocale={{ lang: 'ru' }}
        scopedCityDraftId="draft-1"
        scopedDatabaseCityId="city-1"
        visibleCityInfos={[]}
        openCityCommonsModal={vi.fn()}
      />,
    );

    expect(screen.getByTestId('city-generator')).toBeTruthy();
    expect(screen.getByTestId('city-form')).toBeTruthy();
    expect(screen.getByTestId('city-tags')).toBeTruthy();
    expect(screen.getByTestId('city-info')).toBeTruthy();
    expect(captured.cityStepProps.activeCityDraftId).toBe('draft-1');
    expect(captured.cityStepProps.defaultLocale).toBe('ru');

    fireEvent.blur(screen.getByTestId('city-form'));
    captured.cityStepProps.onRestoreSavedCoords();

    expect(onCityFormBlur).toHaveBeenCalledOnce();
    expect(setLat).toHaveBeenCalledWith('55.75');
    expect(setLon).toHaveBeenCalledWith('37.61');
  });
});
