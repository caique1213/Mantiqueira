import { z } from 'zod';
import { imageToWebp } from '../../lib/media';
import { requireSupabaseClient } from '../../lib/supabase';

const feedbackSchema = z.object({
  id: z.string().uuid(),
  site_id: z.string().uuid(),
  created_by: z.string().uuid(),
  type: z.string(),
  page: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.string(),
  status: z.string(),
  user_agent: z.string().nullable(),
  app_context: z.record(z.string(), z.unknown()),
  admin_response: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  profiles: z
    .object({
      display_name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

const mediaSchema = z.object({
  id: z.string().uuid(),
  feedback_id: z.string().uuid(),
  file_path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size: z.coerce.number(),
});

export type FeedbackItem = z.infer<typeof feedbackSchema> & {
  media: Array<z.infer<typeof mediaSchema> & { signedUrl: string | null }>;
};

export async function createFeedback(input: {
  siteId: string;
  type: string;
  page: string;
  title: string;
  description: string;
  priority: string;
  file: File | null;
}) {
  const client = requireSupabaseClient();
  const user = await client.auth.getUser();
  const profileId = user.data.user?.id;
  if (!profileId) throw new Error('Sessão expirada. Entre novamente.');

  const { data, error } = await client
    .from('feedback_items')
    .insert({
      site_id: input.siteId,
      created_by: profileId,
      type: input.type,
      page: input.page,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      user_agent: navigator.userAgent,
      app_context: { path: window.location.pathname, width: window.innerWidth, height: window.innerHeight },
    })
    .select('*')
    .single();
  if (error) throw error;
  const feedback = feedbackSchema.parse(data);

  if (input.file) {
    const isImage = input.file.type.startsWith('image/');
    const prepared = isImage
      ? { ...(await imageToWebp(input.file, 1600, 0.82)), mimeType: 'image/webp' }
      : { blob: input.file, mimeType: input.file.type || 'application/octet-stream' };
    const extension = isImage ? 'webp' : input.file.name.split('.').pop() || 'bin';
    const path = `${profileId}/${feedback.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await client.storage.from('feedback-media').upload(path, prepared.blob, {
      contentType: prepared.mimeType,
      upsert: false,
    });
    if (upload.error) throw upload.error;
    const media = await client.from('feedback_media').insert({
      feedback_id: feedback.id,
      file_path: path,
      file_name: input.file.name,
      mime_type: prepared.mimeType,
      file_size: prepared.blob.size,
    });
    if (media.error) {
      await client.storage.from('feedback-media').remove([path]);
      throw media.error;
    }
  }

  return feedback;
}

export async function fetchFeedbackItems(canManage: boolean): Promise<FeedbackItem[]> {
  const client = requireSupabaseClient();
  const query = client
    .from('feedback_items')
    .select('*,profiles:created_by(display_name)')
    .order('created_at', { ascending: false })
    .limit(canManage ? 200 : 80);
  const { data, error } = await query;
  if (error) throw error;
  const items = z.array(feedbackSchema).parse(data ?? []);
  const ids = items.map((item) => item.id);
  const mediaRows =
    ids.length > 0
      ? await client
          .from('feedback_media')
          .select('id,feedback_id,file_path,file_name,mime_type,file_size')
          .in('feedback_id', ids)
      : { data: [], error: null };
  if (mediaRows.error) throw mediaRows.error;
  const media = z.array(mediaSchema).parse(mediaRows.data ?? []);
  const signed = await Promise.all(
    media.map(async (entry) => {
      const { data: signedData } = await client.storage
        .from('feedback-media')
        .createSignedUrl(entry.file_path, 60 * 10);
      return { ...entry, signedUrl: signedData?.signedUrl ?? null };
    }),
  );
  return items.map((item) => ({
    ...item,
    media: signed.filter((entry) => entry.feedback_id === item.id),
  }));
}

export async function updateFeedbackStatus(input: {
  id: string;
  status: string;
  adminResponse: string;
}) {
  const { data, error } = await requireSupabaseClient()
    .from('feedback_items')
    .update({ status: input.status, admin_response: input.adminResponse })
    .eq('id', input.id)
    .select('*')
    .single();
  if (error) throw error;
  return feedbackSchema.parse(data);
}
