import { z } from 'zod';

export const taskStatusSchema = z.enum([
  'BACKLOG',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'CANCELED',
]);

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(10_000).optional(),
  priority: taskPrioritySchema.default('MEDIUM'),
  assigneeId: z.uuid().optional(),
  dueAt: z.iso.datetime().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
