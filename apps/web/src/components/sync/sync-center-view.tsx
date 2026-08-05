'use client';

import {
  Activity,
  Check,
  GitBranch,
  Code2,
  Link2,
  RefreshCcw,
  Radio,
  TriangleAlert,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import type { ApiProject, SyncOverview } from '@/lib/domain';
import { EmptyState, ErrorPanel, LoadingPanel } from '../common/load-state';
import { SectionPage } from '../layout/section-page';

export function SyncCenterView() {
  const [overview, setOverview] = useState<SyncOverview>();
  const [workspaceId, setWorkspaceId] = useState('');
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [showConnect, setShowConnect] = useState(false);

  const load = useCallback(async () => {
    try {
      const workspace = await getPrimaryWorkspace();
      setWorkspaceId(workspace.id);
      const [syncData, projectData] = await Promise.all([
        apiJson<SyncOverview>(`/sync/overview?workspaceId=${workspace.id}`),
        apiJson<ApiProject[]>(`/projects?workspaceId=${workspace.id}`),
      ]);
      setOverview(syncData);
      setProjects(projectData);
      setError(undefined);
    } catch (loadError) {
      if (requireLogin(loadError)) return;
      setError(loadError instanceof Error ? loadError.message : 'Unknown synchronization error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function synchronize(repositoryId: string) {
    setBusy(repositoryId);
    try {
      await apiJson(`/sync/repositories/${repositoryId}/run`, { method: 'POST' });
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Synchronization failed');
    } finally {
      setBusy(undefined);
    }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('connect');
    try {
      await apiJson('/sync/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          projectId: form.get('projectId'),
          fullName: form.get('fullName'),
          repositoryId: form.get('repositoryId'),
          defaultBranch: form.get('defaultBranch'),
        }),
      });
      setShowConnect(false);
      await load();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Repository connection failed');
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <SectionPage
      eyebrow="Synchub Network / GitHub"
      title="Synchronization center"
      description="Connect code to execution and keep every delivery signal traceable."
      action={<button className="primary-action" onClick={() => setShowConnect((value) => !value)} type="button"><Link2 size={14} /> Connect repository</button>}
    >
      {!overview && !error && <LoadingPanel message="Reading synchronization network..." />}
      {error && <ErrorPanel message={error} />}
      {overview && (
        <>
          <SyncPulse overview={overview} />
          {showConnect && <ConnectForm busy={busy === 'connect'} onSubmit={connect} projects={projects} />}
          <section className="sync-layout">
            <div className="sync-main">
              <div className="section-toolbar"><div><strong>Connected nodes</strong><span>Repositories feeding project activity</span></div><span className={`sync-health ${overview.status}`}>{overview.status === 'healthy' ? <Check size={12} /> : <TriangleAlert size={12} />}{overview.status}</span></div>
              {overview.repositories.length ? overview.repositories.map((repository) => (
                <article className="panel sync-repository" key={repository.id}>
                  <div className="integration-symbol"><Code2 size={19} /></div>
                  <div className="sync-repository-copy">
                    <strong>{repository.fullName}</strong>
                    <span><GitBranch size={11} /> {repository.defaultBranch} · {repository.project ? `${repository.project.key} / ${repository.project.name}` : 'Project not assigned'}</span>
                    <small>{repository.lastError ?? `${repository._count.links} delivery links · ${repository._count.syncRuns} sync runs`}</small>
                  </div>
                  <div className="sync-repository-state"><i /><span>{repository.syncEnabled ? 'Listening' : 'Paused'}</span><small>{relativeTime(repository.lastSyncedAt)}</small></div>
                  <button className="secondary-action sync-button" disabled={Boolean(busy)} onClick={() => void synchronize(repository.id)} type="button"><RefreshCcw className={busy === repository.id ? 'spin' : ''} size={13} />{busy === repository.id ? 'Syncing' : 'Sync now'}</button>
                </article>
              )) : <EmptyState title="No connected repository" description="Connect the first GitHub repository to activate the synchronization network." />}
            </div>
            <aside className="panel sync-history">
              <div className="sync-history-heading"><Radio size={15} /><div><strong>Network stream</strong><span>Latest synchronization runs</span></div></div>
              {overview.recentRuns.length ? overview.recentRuns.map((run) => (
                <div className="sync-run" key={run.id}>
                  <i className={run.status.toLowerCase()} />
                  <div><strong>{run.repository.fullName}</strong><span>{run.message ?? `${run.eventName ?? run.trigger} synchronization`}</span><small>{run.linkedItems}/{run.receivedItems} linked · {relativeTime(run.completedAt ?? run.startedAt)}</small></div>
                </div>
              )) : <p className="inline-empty">Synchronization history will appear here.</p>}
            </aside>
          </section>
        </>
      )}
    </SectionPage>
  );
}

function SyncPulse({ overview }: { overview: SyncOverview }) {
  const metrics = [
    { icon: Link2, label: 'Connected nodes', value: overview.summary.connected },
    { icon: Activity, label: 'Synced events', value: overview.summary.synchronizedEvents },
    { icon: GitBranch, label: 'Task links', value: overview.summary.linkedItems },
    { icon: RefreshCcw, label: 'Last pulse', value: relativeTime(overview.summary.lastSyncAt) },
  ];
  return <section className="sync-pulse">{metrics.map(({ icon: Icon, label, value }) => <div key={label}><Icon size={15} /><span>{label}</span><strong>{value}</strong></div>)}</section>;
}

function ConnectForm({ busy, onSubmit, projects }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; projects: ApiProject[] }) {
  return (
    <form className="panel inline-form sync-connect-form" onSubmit={onSubmit}>
      <label>Repository<input name="fullName" placeholder="owner/repository" required /></label>
      <label>GitHub repository ID<input inputMode="numeric" name="repositoryId" placeholder="123456789" required /></label>
      <label>Project<select name="projectId" required><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.key} — {project.name}</option>)}</select></label>
      <label>Default branch<input defaultValue="main" name="defaultBranch" required /></label>
      <button className="primary-action" disabled={busy} type="submit">{busy ? 'Connecting...' : 'Activate synchronization'}</button>
      <p className="settings-note form-wide">After connecting, point the GitHub webhook to <code>/api/v1/github/webhooks</code>. Commits and pull requests containing a task key such as SYNC-12 are linked automatically.</p>
    </form>
  );
}

function relativeTime(value?: string | null) {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString('pt-BR');
}
