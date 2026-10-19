import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TreeNav from './TreeNav';

const items = [{ id: 'city-1', label: 'Москва', children: [{ id: 'attr-1', label: 'Кремль' }] }];

function renderItem(item, state) {
  return (
    <div>
      <button type="button" onClick={state.onSelect}>{item.label}</button>
      {state.children.length > 0 && (
        <button type="button" aria-label={`toggle-${item.id}`} onClick={state.onToggle}>
          {state.expanded ? 'Свернуть' : 'Развернуть'}
        </button>
      )}
    </div>
  );
}

describe('TreeNav UI primitive', () => {
  it('renders root nodes and keeps nested nodes collapsed by default', () => {
    render(<TreeNav items={items} renderItem={renderItem} />);

    expect(screen.getByRole('button', { name: 'Москва' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Кремль' })).toBeNull();
  });

  it('renders children when the controlled expanded state includes the parent', () => {
    render(<TreeNav items={items} expandedIds={new Set(['city-1'])} renderItem={renderItem} />);

    expect(screen.getByRole('button', { name: 'Кремль' })).toBeTruthy();
    expect(screen.getAllByRole('treeitem')[0].getAttribute('aria-selected')).toBe('false');
  });

  it('reports selection and toggle actions to the consumer', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    render(<TreeNav items={items} onSelect={onSelect} onToggle={onToggle} renderItem={renderItem} />);

    screen.getByRole('button', { name: 'Москва' }).click();
    screen.getByRole('button', { name: 'toggle-city-1' }).click();

    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(onToggle).toHaveBeenCalledWith(items[0], true);
  });
});
