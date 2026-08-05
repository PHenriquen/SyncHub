export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus =
  | 'BACKLOG'
  | 'READY'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'BLOCKED'
  | 'DONE'
  | 'CANCELED';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  memberships: Array<{ role: string }>;
  _count?: { projects: number; memberships: number };
}

export interface SessionProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  memberships: Array<{
    role: string;
    workspace: { id: string; name: string; slug: string };
  }>;
}

export interface BoardTask {
  id?: string;
  key: string;
  title: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  owner: string;
}

export interface BoardColumn {
  status?: TaskStatus;
  title: string;
  tasks: BoardTask[];
}

export interface ActivityItem {
  id: string;
  actor: string;
  summary: string;
  time: string;
  type: 'commit' | 'pullRequest' | 'merge' | 'workflow';
}

export interface ProjectSummary {
  id?: string;
  key: string;
  name: string;
  repository: string;
  openTasks: number;
  health: number;
}

export interface ApiTask {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  updatedAt: string;
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null;
  project?: { id: string; key: string; name: string };
  _count?: { comments: number; githubLinks: number };
}

export interface ApiProject {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description?: string | null;
  visibility: 'PRIVATE' | 'WORKSPACE';
  updatedAt: string;
  tasks?: Array<{ status: TaskStatus }>;
  repositories?: Array<{ id: string; fullName: string; defaultBranch: string }>;
  _count?: { tasks: number; repositories?: number };
}

export interface SyncRepository {
  id: string;
  fullName: string;
  repositoryId: string;
  defaultBranch: string;
  private: boolean;
  syncEnabled: boolean;
  connectedAt: string;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  project?: { id: string; key: string; name: string } | null;
  _count: { links: number; syncRuns: number };
}

export interface SyncRun {
  id: string;
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  trigger: string;
  eventName?: string | null;
  receivedItems: number;
  linkedItems: number;
  message?: string | null;
  startedAt: string;
  completedAt?: string | null;
  repository: { id: string; fullName: string };
}

export interface SyncOverview {
  status: 'healthy' | 'attention';
  summary: {
    connected: number;
    linkedItems: number;
    synchronizedEvents: number;
    lastSyncAt?: string | null;
  };
  repositories: SyncRepository[];
  recentRuns: SyncRun[];
}
