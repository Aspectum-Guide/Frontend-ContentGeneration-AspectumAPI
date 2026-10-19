import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SidebarGroup from './SidebarGroup';
import SidebarLink from './SidebarLink';

const Dot = (props) => <svg data-testid="icon" {...props} />;

describe('SidebarGroup', () => {
  it('renders an accessible toggle that reflects and reports its state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SidebarGroup title="Контент" icon={Dot} open onToggle={onToggle}>
        <span>child</span>
      </SidebarGroup>
    );

    const toggle = screen.getByRole('button', { name: /Контент/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('child')).toBeTruthy();
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <SidebarGroup title="Контент" icon={Dot} open={false} onToggle={onToggle}>
        <span>child</span>
      </SidebarGroup>
    );
    expect(screen.getByRole('button', { name: /Контент/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('child')).toBeNull();
  });

  it('drops the header in the collapsed rail but keeps the children', () => {
    render(
      <SidebarGroup title="Контент" collapsed>
        <span>child</span>
      </SidebarGroup>
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('child')).toBeTruthy();
  });
});

describe('SidebarLink', () => {
  it('shows icon, label and badge, and marks the current page', () => {
    render(<SidebarLink href="/x" icon={Dot} label="Города" badge="AI" active />);
    const link = screen.getByRole('link', { name: /Города/ });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('collapses to an icon with the label as accessible name and tooltip', () => {
    render(<SidebarLink href="/x" icon={Dot} label="Города" badge="AI" collapsed />);
    const link = screen.getByRole('link', { name: 'Города' });
    expect(link.getAttribute('title')).toBe('Города');
    expect(screen.queryByText('Города')).toBeNull();
    expect(screen.queryByText('AI')).toBeNull();
  });

  it('renders through the supplied link component', () => {
    const Custom = ({ to, children, ...rest }) => <a data-custom href={to} {...rest}>{children}</a>;
    render(<SidebarLink as={Custom} to="/cities" label="Города" />);
    expect(screen.getByRole('link', { name: 'Города' }).getAttribute('href')).toBe('/cities');
  });
});
