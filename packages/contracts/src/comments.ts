import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
