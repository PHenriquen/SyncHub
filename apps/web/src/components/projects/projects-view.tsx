'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import type { ApiProject, ProjectSummary, WorkspaceSummary } from '@/lib/domain';
import { ErrorPanel, LoadingPanel } from '../common/load-state';
import { ProjectHealth } from '../dashboard/project-health';

export function ProjectsView() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary>();
  const [projects, setProjects] = useState<ApiProject[]>();
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const primary = await getPrimaryWorkspace();
      setWorkspace(primary);
      setProjects(await apiJson<ApiProject[]>(`/projects?workspaceId=${primary.id}`));
    } catch (loadError) {
      if (requireLogin(loadError)) return;
      setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    setSaving(true);
    setError(undefined);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await apiJson<ApiProject>('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: form.get('name'),
          key: form.get('key'),
          description: form.get('description') || undefined,
          visibility: 'WORKSPACE',
        }),
      });
      formElement.reset();
      setShowForm(false);
      await load();
    } catch (createError) {
      if (!requireLogin(createError)) {
        setError(createError instanceof Error ? createError.message : 'Project creation failed');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!projects && !error) return <LoadingPanel message="Loading projects..." />;
  if (error && !projects) return <ErrorPanel message={error} />;

  const summaries = (projects ?? []).map(toProjectSummary);
  return (
    <>
      <div className="section-toolbar">
        <span>{workspace?.name ?? 'Workspace'} · {projects?.length ?? 0} active projects</span>
        <button className="primary-action" type="button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </div>
      {showForm && (
        <form className="panel inline-form" onSubmit={createProject}>
          <label>Project name<input name="name" minLength={2} maxLength={100} required /></label>
          <label>Key<input name="key" minLength={2} maxLength={10} placeholder="SYNC" required /></label>
          <label className="form-wide">Description<textarea name="description" maxLength={500} rows={3} /></label>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? 'Creating...' : 'Create project'}
          </button>
        </form>
      )}
      {error && <p className="form-message">{error}</p>}
      <ProjectHealth projects={summaries} />
      {summaries.length === 0 && (
        <section className="panel state-panel">
          <strong>Create the first project</strong>
          <p>A project groups tasks, repositories and delivery history.</p>
        </section>
      )}
    </>
  );
}

function toProjectSummary(project: ApiProject): ProjectSummary {
  const tasks = project.tasks ?? [];
  const openTasks = tasks.filter((task) => !['DONE', 'CANCELED'].includes(task.status)).length;
  const blocked = tasks.filter((task) => task.status === 'BLOCKED').length;
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    repository: project.repositories?.[0]?.fullName ?? 'Repository not connected',
    openTasks,
    health: Math.max(20, 100 - blocked * 20 - openTasks * 2),
  };
}
