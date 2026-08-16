import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IlPhotoPanel } from './SessionWizardInteractiveLocationsStep.jsx';

const renderPanel = (currentIl, overrides = {}) => {
  const props = {
    currentIl,
    photoUploading: false,
    photoFileRef: createRef(),
    iconUploading: false,
    iconFileRef: createRef(),
    onOpenCommonsModal: vi.fn(),
    onPhotoFileChange: vi.fn(),
    onIconFileChange: vi.fn(),
    onRemoveIcon: vi.fn(),
    onUpdateIlPatch: vi.fn(),
    ...overrides,
  };

  render(<IlPhotoPanel {...props} />);
  return props;
};

describe('IlPhotoPanel map icon controls', () => {
  it('shows replace and remove actions for an existing map icon', () => {
    const currentIl = {
      id: 'location-1',
      icon_id: 'icon-1',
      icon_url: '/media/icon.svg',
    };
    const { onRemoveIcon } = renderPanel(currentIl);

    expect(screen.getByRole('button', { name: 'Заменить' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(onRemoveIcon).toHaveBeenCalledWith(currentIl);
  });

  it('shows only the add action when there is no map icon', () => {
    renderPanel({ id: 'location-1', icon_id: null, icon_url: null });

    expect(screen.getByRole('button', { name: '+ Добавить' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Удалить' })).toBeNull();
  });
});
