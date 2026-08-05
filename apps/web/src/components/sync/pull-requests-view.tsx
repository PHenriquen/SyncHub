'use client';

import { ExternalLink, GitPullRequest, GitPullRequestClosed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import { EmptyState, ErrorPanel, LoadingPanel } from '../common/load-state';
import { SectionPage } from '../layout/section-page';

interface PullRequestLink {
  id: string;
  number?: number | null;
  url: string;
  state?: string | null;
  updatedAt: string;
  repository: { fullName: string };
  task: { id: string; number: number; title: string; project: { id: string; key: string; name: string } };
}

export function PullRequestsView() {
  const [items, setItems] = useState<PullRequestLink[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const workspace = await getPrimaryWorkspace();
        setItems(await apiJson<PullRequestLink[]>(`/sync/pull-requests?workspaceId=${workspace.id}`));
      } catch (loadError) {
        if (requireLogin(loadError)) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load synchronized pull requests');
      }
    }
    void load();
  }, []);

  return (
    <SectionPage eyebrow="GitHub delivery / synchronized" title="Pull requests" description="Code review automatically connected to the task it delivers.">
      {!items && !error && <LoadingPanel message="Loading synchronized pull requests..." />}
      {error && <ErrorPanel message={error} />}
      {items && !items.length && <div className="integration-empty"><GitPullRequest size={28} /><EmptyState title="No linked pull request yet" description="Include a task key such as SYNC-12 in a pull request title. The GitHub webhook will connect it automatically." /></div>}
      {items && items.length > 0 && <div className="panel pull-request-list">{items.map((item) => {
        const merged = item.state === 'merged';
        const Icon = merged ? GitPullRequestClosed : GitPullRequest;
        return <a className="pull-request-row" href={item.url} key={item.id} rel="noreferrer" target="_blank"><Icon size={17} /><div><strong>#{item.number ?? '?'} · {item.task.title}</strong><span>{item.repository.fullName} → {item.task.project.key}-{item.task.number}</span></div><span className={`status-pill ${merged ? 'merged' : ''}`}>{item.state ?? 'open'}</span><ExternalLink size={13} /></a>;
      })}</div>}
    </SectionPage>
  );
}
