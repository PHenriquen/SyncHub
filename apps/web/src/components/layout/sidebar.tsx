'use client';

import {
  Activity,
  Blocks,
  CircleDot,
  GitPullRequest,
  LayoutDashboard,
  LogOut,
  Settings,
  RefreshCcw,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import type { SessionProfile } from '@/lib/domain';
import { Brand } from './brand';

const navigation = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Blocks },
  { href: '/my-work', label: 'My work', icon: CircleDot },
  { href: '/pull-requests', label: 'Pull requests', icon: GitPullRequest },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/sync', label: 'Sync center', icon: RefreshCcw },
  { href: '/team', label: 'Team', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<SessionProfile>();

  useEffect(() => {
    apiJson<SessionProfile>('/auth/me').then(setProfile).catch(() => undefined);
  }, []);

  const membership = profile?.memberships[0];
  const name = profile?.name ?? 'Synchub user';
  const role = membership?.role ?? 'Member';

  async function logout() {
    try { await apiJson<void>('/auth/logout', { method: 'POST' }); } finally {
      window.location.assign('/login');
    }
  }

  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-switcher">
        <span className="workspace-pulse" aria-hidden="true"><i /></span>
        <div><span>{membership?.workspace.name ?? 'Workspace'}</span><small>Connected workspace</small></div>
      </div>
      <nav className="nav-group">
        <span className="nav-label">Workspace</span>
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link className={`nav-link ${isActive(pathname, href) ? 'active' : ''}`} href={href} key={href}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </Link>
        ))}
      </nav>
      <nav className="nav-group">
        <span className="nav-label">Manage</span>
        <Link className={`nav-link ${pathname === '/settings' ? 'active' : ''}`} href="/settings">
          <Settings size={16} strokeWidth={1.8} /><span>Settings</span>
        </Link>
      </nav>
      <footer className="sidebar-footer">
        <div className="user-chip">
          <span className="avatar">{initials(name)}</span>
          <div><strong>{name}</strong><small>{titleCase(role)}</small></div>
          <button className="logout-button" aria-label="Sign out" onClick={() => void logout()} type="button"><LogOut size={14} /></button>
        </div>
      </footer>
    </aside>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function titleCase(value: string) {
  return `${value.charAt(0)}${value.slice(1).toLowerCase()}`;
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}
