import { z } from 'zod';

export const projectVisibilitySchema = z.enum(['PRIVATE', 'WORKSPACE']);

export const createProjectSchema = z.object({
  workspaceId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  key: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z][A-Z0-9]*$/)),
  description: z.string().trim().max(500).optional(),
  visibility: projectVisibilitySchema.default('WORKSPACE'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
