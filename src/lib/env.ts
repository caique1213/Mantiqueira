import { z } from 'zod';

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  VITE_ENABLE_ADMIN_INVITES: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export type RuntimeConfig =
  { configured: true; env: PublicEnv } | { configured: false; missing: string[] };

export function getRuntimeConfig(source: Record<string, string | undefined> = import.meta.env) {
  const parsed = publicEnvSchema.safeParse(source);

  if (parsed.success) {
    return { configured: true, env: parsed.data } satisfies RuntimeConfig;
  }

  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean);
  return { configured: false, missing } satisfies RuntimeConfig;
}

export const runtimeConfig = getRuntimeConfig();
