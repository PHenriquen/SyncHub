import Link from 'next/link';
import type { ProjectSummary } from '@/lib/domain';

export function ProjectHealth({ projects }: { projects: ProjectSummary[] }) {
  return (
    <section className="panel project-health">
      <header className="panel-header">
        <h2>Project health</h2>
        <span>Based on delivery signals</span>
      </header>
      <div className="project-list">
        {projects.length === 0 && <p className="inline-empty">No active projects yet.</p>}
        {projects.map((project) => {
          const content = (
            <>
              <div className="project-name">
                <span className="project-symbol">{project.key.slice(0, 2)}</span>
                <div><strong>{project.name}</strong><small>{project.repository}</small></div>
              </div>
              <div className="project-stat"><strong>{project.openTasks}</strong><span>open tasks</span></div>
              <div className="health-bar" aria-label={`${project.health}% project health`}>
                <div className="health-fill" style={{ width: `${project.health}%` }} />
              </div>
              <span className="health-value">{project.health}% healthy</span>
            </>
          );

          return project.id ? (
            <Link className="project-row" href={`/projects/${project.id}`} key={project.id}>{content}</Link>
          ) : (
            <article className="project-row" key={project.key}>{content}</article>
          );
        })}
      </div>
    </section>
  );
}
