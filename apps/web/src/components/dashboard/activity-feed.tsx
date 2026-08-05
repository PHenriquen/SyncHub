import { GitCommit, GitMerge, GitPullRequest, Workflow } from 'lucide-react';
import type { ActivityItem } from '@/lib/domain';

const icons = {
  commit: GitCommit,
  pullRequest: GitPullRequest,
  merge: GitMerge,
  workflow: Workflow,
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <aside className="panel">
      <header className="panel-header">
        <h2>Live activity</h2>
        <span>Workspace events</span>
      </header>
      <div className="activity-list">
        {items.map((item) => {
          const Icon = icons[item.type];
          return (
            <article className="activity-item" key={item.id}>
              <span className="activity-icon">
                <Icon size={14} />
              </span>
              <div>
                <p>
                  <strong>{item.actor}</strong> {item.summary}
                </p>
                <time>{item.time}</time>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
