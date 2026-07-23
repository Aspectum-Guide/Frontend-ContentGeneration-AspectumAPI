import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCatalogCrud } from './useCatalogCrud';

const createEmpty = () => ({ id: null });

describe('useCatalogCrud', () => {
  it('keeps stable openCreate/closeEdit when onAfterSave is stable', () => {
    const onAfterSave = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCatalogCrud({
        createEmpty,
        createRequest: vi.fn(),
        updateRequest: vi.fn(),
        onAfterSave,
      })
    );

    const { openCreate, closeEdit } = result.current;
    rerender();
    expect(result.current.openCreate).toBe(openCreate);
    expect(result.current.closeEdit).toBe(closeEdit);
  });

  it('does not put whole crud object in typical mobile-actions deps pattern', () => {
    const onAfterSave = vi.fn();
    const { result } = renderHook(() =>
      useCatalogCrud({
        createEmpty: () => ({ id: null }),
        createRequest: vi.fn(),
        onAfterSave,
      })
    );

    act(() => {
      result.current.openCreate();
    });

    expect(result.current.editingItem).toEqual({ id: null });
    expect(typeof result.current.openCreate).toBe('function');
    expect(typeof result.current.closeEdit).toBe('function');
  });
});
