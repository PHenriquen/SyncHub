'use client';

import { useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import { EmptyState, ErrorPanel, LoadingPanel } from '../common/load-state';

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
}

export function TeamView() {
  const [members, setMembers] = useState<Member[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const workspace = await getPrimaryWorkspace();
        setMembers(await apiJson<Member[]>(`/workspaces/${workspace.id}/members`));
      } catch (loadError) {
        if (requireLogin(loadError)) return;
        setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
      }
    }
    void load();
  }, []);

  if (!members && !error) return <LoadingPanel message="Loading workspace members..." />;
  if (error) return <ErrorPanel message={error} />;
  if (!members?.length) return <EmptyState title="No members" description="The workspace has no active memberships." />;

  return (
    <section className="panel simple-list">
      {members.map((member) => (
        <article className="simple-list-row" key={member.id}>
          <span className="avatar">{initials(member.user.name)}</span>
          <div><strong>{member.user.name}</strong><small>{member.user.email}</small></div>
          <span className="status-pill">{titleCase(member.role)}</span>
        </article>
      ))}
    </section>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function titleCase(value: string) {
  return `${value.charAt(0)}${value.slice(1).toLowerCase()}`;
}
