'use client';

import { useEffect, useState } from 'react';
import { getPrimaryWorkspace, requireLogin } from '@/lib/api';
import type { WorkspaceSummary } from '@/lib/domain';
import { ErrorPanel, LoadingPanel } from '../common/load-state';

export function SettingsView() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    getPrimaryWorkspace()
      .then(setWorkspace)
      .catch((loadError) => {
        if (requireLogin(loadError)) return;
        setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
      });
  }, []);

  if (!workspace && !error) return <LoadingPanel message="Loading workspace settings..." />;
  if (error) return <ErrorPanel message={error} />;
  if (!workspace) return null;

  return (
    <section className="panel settings-form">
      <label>Workspace name<input value={workspace.name} readOnly /></label>
      <label>Workspace slug<input value={workspace.slug} readOnly /></label>
      <label>Your role<input value={workspace.memberships[0]?.role ?? 'MEMBER'} readOnly /></label>
      <p className="settings-note">Workspace identity is read-only here. Repository connections and synchronization health are managed in Sync center.</p>
    </section>
  );
}
