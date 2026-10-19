import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SidebarGroup, SidebarLink } from './ui';
import { SESSION_ITEM_ICON, findActiveGroupId, getNavGroups, isNavItemActive } from '../config/nav';

const STORAGE_KEY = 'navOpenGroups';

function readOpenGroups() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeOpenGroups(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable: the state then lasts for this page load only
  }
}

/**
 * Sidebar navigation built from config/nav.js: collapsible groups with icons, a
 * icon-only rail when collapsed. `extraItems` injects runtime entries into a group
 * (e.g. active sessions into "sessions") ahead of its static items.
 */
export default function AppNav({ pathname, collapsed = false, extraItems = {}, groups, onNavigate }) {
  const navGroups = useMemo(() => groups || getNavGroups(), [groups]);
  const [openGroups, setOpenGroups] = useState(readOpenGroups);
  const activeGroupId = findActiveGroupId(pathname, navGroups);

  // Always show the group the user is in, whatever was remembered.
  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((current) => {
      if (current[activeGroupId]) return current;
      const next = { ...current, [activeGroupId]: true };
      writeOpenGroups(next);
      return next;
    });
  }, [activeGroupId]);

  const toggle = useCallback((id) => {
    setOpenGroups((current) => {
      const next = { ...current, [id]: !current[id] };
      writeOpenGroups(next);
      return next;
    });
  }, []);

  return (
    <nav aria-label="Разделы" className={collapsed ? 'space-y-2' : 'space-y-1'}>
      {navGroups.map((group) => {
        const dynamic = extraItems[group.id] || [];
        const items = [
          ...dynamic.map((item) => ({ icon: SESSION_ITEM_ICON, ...item })),
          ...group.items,
        ];
        const open = collapsed || openGroups[group.id] === true || (openGroups[group.id] === undefined && group.id === activeGroupId);
        return (
          <SidebarGroup
            key={group.id}
            title={group.title}
            icon={group.icon}
            open={open}
            collapsed={collapsed}
            onToggle={() => toggle(group.id)}
          >
            {items.map((item) => (
              <SidebarLink
                key={`${group.id}-${item.to}`}
                as={Link}
                to={item.to}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                badgeClassName={item.badgeColor}
                active={isNavItemActive(pathname, item)}
                collapsed={collapsed}
                onClick={onNavigate}
              />
            ))}
          </SidebarGroup>
        );
      })}
    </nav>
  );
}
