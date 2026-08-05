'use client';

import { useEffect, useState } from 'react';
import { apiJson, getPrimaryWorkspace, requireLogin } from '@/lib/api';
import type { ActivityItem } from '@/lib/domain';
import { EmptyState, ErrorPanel, LoadingPanel } from '../common/load-state';
import { ActivityFeed } from '../dashboard/activity-feed';

interface ApiActivity {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  actor?: { name: string } | null;
}

export function ActivityView() {
  const [items, setItems] = useState<ActivityItem[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const workspace = await getPrimaryWorkspace();
        const activity = await apiJson<ApiActivity[]>(`/activity?workspaceId=${workspace.id}&limit=50`);
        setItems(activity.map(mapActivity));
      } catch (loadError) {
        if (requireLogin(loadError)) return;
        setError(loadError instanceof Error ? loadError.message : 'Unknown API error');
      }
    }
    void load();
  }, []);

  if (!items && !error) return <LoadingPanel message="Loading activity history..." />;
  if (error) return <ErrorPanel message={error} />;
  if (!items?.length) return <EmptyState title="No activity yet" description="Project and task events will be recorded here." />;
  return <div className="narrow-panel"><ActivityFeed items={items} /></div>;
}

function mapActivity(item: ApiActivity): ActivityItem {
  return {
    id: item.id,
    actor: item.actor?.name ?? 'Synchub',
    summary: item.summary,
    time: new Date(item.createdAt).toLocaleString('pt-BR'),
    type: item.type.includes('PULL_REQUEST')
      ? item.type.includes('MERGED') ? 'merge' : 'pullRequest'
      : item.type.includes('COMMIT') ? 'commit' : 'workflow',
  };
}
