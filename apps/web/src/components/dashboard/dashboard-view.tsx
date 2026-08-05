'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import type {
  ActivityItem,
  BoardColumn,
  ProjectSummary,
  TaskPriority,
} from '@/lib/domain';
import { ErrorPanel, LoadingPanel } from '../common/load-state';
import { Sidebar } from '../layout/sidebar';
import { Topbar } from '../layout/topbar';
import { ActivityFeed } from './activity-feed';
import { DeliveryBoard } from './delivery-board';
import { MetricCard } from './metric-card';
import { ProjectHealth } from './project-health';

interface ApiDashboard {
  metrics: { activeTasks: number; inReview: number; blocked: number; done: number };
  board: Array<{
    status: string;
    tasks: Array<{
      id: string;
      number: number;
      title: string;
      priority: TaskPriority;
      project: { key: string };
      assignee?: { name: string } | null;
    }>;
  }>;
  activities: Array<{
    id: string;
    type: string;
    summary: string;
    createdAt: string;
    actor?: { name: string } | null;
  }>;
  projects: ProjectSummary[];
}

const statusTitles: Record<string, string> = {
  READY: 'Ready',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  BLOCKED: 'Blocked',
};

export function DashboardView() {
  const [dashboard, setDashboard] = useState<ApiDashboard>();
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const workspace = await getPrimaryWorkspace();
        setWorkspaceName(workspace.name);
        setDashboard(await apiJson<ApiDashboard>(`/dashboard?workspaceId=${workspace.id}`));
      } catch (loadError) {
        if (requireLogin(loadError)) return;
        setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
      }
    }

    void load();
  }, []);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <Topbar />
        <div className="page-content">
          <header className="page-heading dashboard-heading">
            <div className="heading-copy">
              <span className="sync-kicker"><i /> Systems synchronized</span>
              <span className="eyebrow">{workspaceName} / Overview</span>
              <h1>Engineering pulse</h1>
              <p>Planning and delivery signals in one traceable workspace.</p>
            </div>
            <div className="heading-actions">
              <div className="hub-signal" aria-hidden="true">
                <span className="signal-orbit signal-orbit-one" />
                <span className="signal-orbit signal-orbit-two" />
                <span className="signal-core" />
                <i className="signal-node signal-node-one" />
                <i className="signal-node signal-node-two" />
                <i className="signal-node signal-node-three" />
              </div>
              <Link className="primary-action" href="/projects">Open projects</Link>
            </div>
          </header>

          {!dashboard && !error && <LoadingPanel />}
          {error && <ErrorPanel message={error} />}
          {dashboard && <DashboardContent dashboard={dashboard} />}
        </div>
      </section>
    </main>
  );
}

function DashboardContent({ dashboard }: { dashboard: ApiDashboard }) {
  const columns = mapBoard(dashboard);
  const activity = mapActivity(dashboard);

  return (
    <>
      <div className="connection-banner connection-live"><span />Live workspace data</div>
      <section className="metrics-grid" aria-label="Workspace metrics">
        <MetricCard label="Active tasks" value={String(dashboard.metrics.activeTasks)} trend="Current delivery queue" tone="violet" />
        <MetricCard label="In review" value={String(dashboard.metrics.inReview)} trend="Awaiting engineering review" tone="cyan" />
        <MetricCard label="Blocked" value={String(dashboard.metrics.blocked)} trend="Needs intervention" tone="amber" />
        <MetricCard label="Completed" value={String(dashboard.metrics.done)} trend="Delivered in this workspace" tone="green" />
      </section>
      <section className="dashboard-grid">
        <DeliveryBoard columns={columns} />
        <ActivityFeed items={activity} />
      </section>
      <ProjectHealth projects={dashboard.projects} />
    </>
  );
}

function mapBoard(dashboard: ApiDashboard): BoardColumn[] {
  return dashboard.board.map((column) => ({
    title: statusTitles[column.status] ?? column.status,
    tasks: column.tasks.map((task) => ({
      id: task.id,
      key: `${task.project.key}-${task.number}`,
      title: task.title,
      priority: titleCasePriority(task.priority),
      owner: initials(task.assignee?.name ?? 'Unassigned'),
    })),
  }));
}

function mapActivity(dashboard: ApiDashboard): ActivityItem[] {
  return dashboard.activities.map((item) => ({
    id: item.id,
    actor: item.actor?.name ?? 'Synchub',
    summary: item.summary,
    time: new Date(item.createdAt).toLocaleString('pt-BR'),
    type: activityIcon(item.type),
  }));
}

function titleCasePriority(priority: TaskPriority) {
  return `${priority.charAt(0)}${priority.slice(1).toLowerCase()}` as 'Low' | 'Medium' | 'High' | 'Urgent';
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function activityIcon(type: string): ActivityItem['type'] {
  if (type.includes('PULL_REQUEST')) return type.includes('MERGED') ? 'merge' : 'pullRequest';
  if (type.includes('COMMIT')) return 'commit';
  return 'workflow';
}
