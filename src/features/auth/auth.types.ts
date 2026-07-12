import { z } from 'zod';

const accessProfileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().default('Usuário'),
  active: z.boolean(),
});

export const myAccessSchema = z.object({
  profile: accessProfileSchema,
  roles: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  site_ids: z.array(z.string().uuid()).default([]),
});

export type MyAccess = z.infer<typeof myAccessSchema>;
