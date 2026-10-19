import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useUnsavedChangesWarning from './useUnsavedChangesWarning';

describe('useUnsavedChangesWarning', () => {
  it('does not block leaving when there are no unsaved changes', () => {
    renderHook(() => useUnsavedChangesWarning({ current: false }));
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('blocks leaving while unsaved changes are present', () => {
    renderHook(() => useUnsavedChangesWarning({ current: true }));
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
