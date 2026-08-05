'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiJson, requireLogin } from '@/lib/api';
import type { ApiProject, ApiTask, TaskPriority, TaskStatus } from '@/lib/domain';
import { ErrorPanel, LoadingPanel } from '../common/load-state';

const statuses: TaskStatus[] = [
  'BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELED',
];
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function ProjectView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ApiProject>();
  const [tasks, setTasks] = useState<ApiTask[]>();
  const [error, setError] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [projectId]);

  async function load() {
    try {
      const [projectData, taskData] = await Promise.all([
        apiJson<ApiProject>(`/projects/${projectId}`),
        apiJson<ApiTask[]>(`/tasks?projectId=${projectId}`),
      ]);
      setProject(projectData);
      setTasks(taskData);
    } catch (loadError) {
      if (requireLogin(loadError)) return;
      setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await apiJson<ApiTask>('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: form.get('title'),
          description: form.get('description') || undefined,
          priority: form.get('priority'),
        }),
      });
      formElement.reset();
      setShowForm(false);
      await load();
    } catch (createError) {
      if (!requireLogin(createError)) {
        setError(createError instanceof Error ? createError.message : 'Task creation failed');
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(taskId: string, status: TaskStatus) {
    setError(undefined);
    try {
      await apiJson(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setTasks((current) => current?.map((task) => task.id === taskId ? { ...task, status } : task));
    } catch (statusError) {
      if (!requireLogin(statusError)) {
        setError(statusError instanceof Error ? statusError.message : 'Status update failed');
      }
    }
  }

  if ((!project || !tasks) && !error) return <LoadingPanel message="Loading project workspace..." />;
  if (error && (!project || !tasks)) return <ErrorPanel message={error} />;
  if (!project || !tasks) return null;

  return (
    <>
      <div className="project-detail-heading">
        <div>
          <span className="project-symbol large">{project.key.slice(0, 2)}</span>
          <div><strong>{project.name}</strong><p>{project.description || 'No project description yet.'}</p></div>
        </div>
        <button className="primary-action" type="button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Cancel' : 'Create task'}
        </button>
      </div>
      {showForm && (
        <form className="panel inline-form" onSubmit={createTask}>
          <label className="form-wide">Task title<input name="title" minLength={3} maxLength={160} required /></label>
          <label>Priority<select name="priority" defaultValue="MEDIUM">
            {priorities.map((priority) => <option key={priority}>{priority}</option>)}
          </select></label>
          <label className="form-wide">Description<textarea name="description" maxLength={10000} rows={4} /></label>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? 'Creating...' : 'Create task'}
          </button>
        </form>
      )}
      {error && <p className="form-message">{error}</p>}
      <section className="panel task-table">
        <header className="panel-header"><h2>Tasks</h2><span>{tasks.length} total</span></header>
        {tasks.length === 0 && <p className="inline-empty">No tasks created for this project.</p>}
        {tasks.map((task) => (
          <article className="task-row" key={task.id}>
            <span className="task-key">{project.key}-{task.number}</span>
            <div><strong>{task.title}</strong><small>{task._count?.comments ?? 0} comments · {task._count?.githubLinks ?? 0} GitHub links</small></div>
            <span className={`priority priority-${task.priority.toLowerCase()}`}>{titleCase(task.priority)}</span>
            <select
              aria-label={`Status for ${project.key}-${task.number}`}
              value={task.status}
              onChange={(event) => void changeStatus(task.id, event.target.value as TaskStatus)}
            >
              {statuses.map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}
            </select>
          </article>
        ))}
      </section>
    </>
  );
}

function titleCase(value: string) {
  return `${value.charAt(0)}${value.slice(1).toLowerCase()}`;
}

function readableStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}
