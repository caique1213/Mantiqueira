import { z } from 'zod';
import { requireSupabaseClient } from '../../lib/supabase';

const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  active: z.boolean(),
  timezone: z.string(),
  locale: z.string(),
  avatar_path: z.string().nullable(),
  primary_sector_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UserProfile = z.infer<typeof profileSchema>;

export async function fetchMyProfile(profileId: string): Promise<UserProfile> {
  const { data, error } = await requireSupabaseClient()
    .from('profiles')
    .select(
      'id,display_name,active,timezone,locale,avatar_path,primary_sector_id,created_at,updated_at',
    )
    .eq('id', profileId)
    .single();
  if (error) throw error;
  return profileSchema.parse(data);
}

export async function updateMyProfile(
  displayName: string,
  timezone: string,
  avatarPath: string | null,
) {
  const { data, error } = await requireSupabaseClient().rpc('update_my_profile', {
    p_display_name: displayName,
    p_timezone: timezone,
    p_avatar_path: avatarPath,
  });
  if (error) throw error;
  return profileSchema.parse(data);
}
