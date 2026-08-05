'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import type { ApiTask } from '@/lib/domain';
import { EmptyState, ErrorPanel, LoadingPanel } from '../common/load-state';

export function MyWorkView() {
  const [tasks, setTasks] = useState<ApiTask[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const workspace = await getPrimaryWorkspace();
        setTasks(await apiJson<ApiTask[]>(`/tasks/assigned?workspaceId=${workspace.id}`));
      } catch (loadError) {
        if (requireLogin(loadError)) return;
        setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
      }
    }
    void load();
  }, []);

  if (!tasks && !error) return <LoadingPanel message="Loading assigned work..." />;
  if (error) return <ErrorPanel message={error} />;
  if (!tasks?.length) {
    return <EmptyState title="No assigned tasks" description="Tasks assigned to you will appear here." />;
  }

  return (
    <section className="panel task-table">
      <header className="panel-header"><h2>Assigned tasks</h2><span>{tasks.length} items</span></header>
      {tasks.map((task) => (
        <Link className="task-row task-row-link" href={`/projects/${task.project?.id}`} key={task.id}>
          <span className="task-key">{task.project?.key}-{task.number}</span>
          <div><strong>{task.title}</strong><small>{task.project?.name} · updated {new Date(task.updatedAt).toLocaleDateString('pt-BR')}</small></div>
          <span className={`priority priority-${task.priority.toLowerCase()}`}>{titleCase(task.priority)}</span>
          <span className="status-pill">{readableStatus(task.status)}</span>
        </Link>
      ))}
    </section>
  );
}

function titleCase(value: string) {
  return `${value.charAt(0)}${value.slice(1).toLowerCase()}`;
}

function readableStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}
