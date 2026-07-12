import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedRoles = new Set(['galponista', 'eletricista', 'mecanico', 'civil', 'administrador']);

function json(body: unknown, status = 200, origin = '*') {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  });
}

Deno.serve(async (request) => {
  const configuredOrigin = (Deno.env.get('ALLOWED_ORIGIN') ?? '*').replace(/\/$/, '');
  const requestOrigin = request.headers.get('Origin')?.replace(/\/$/, '');
  if (configuredOrigin !== '*' && requestOrigin && requestOrigin !== configuredOrigin) {
    return json({ error: 'Origem não autorizada.' }, 403, configuredOrigin);
  }
  if (request.method === 'OPTIONS') return json(null, 204, configuredOrigin);
  if (request.method !== 'POST')
    return json({ error: 'Método não permitido.' }, 405, configuredOrigin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: 'Função não configurada.' }, 500, configuredOrigin);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer '))
    return json({ error: 'Autenticação obrigatória.' }, 401, configuredOrigin);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: access, error: accessError } = await userClient.rpc('get_my_access');
  const permissions = Array.isArray(access?.permissions) ? access.permissions : [];
  if (
    accessError ||
    !permissions.includes('users.manage') ||
    !permissions.includes('roles.manage')
  ) {
    return json({ error: 'Permissão administrativa insuficiente.' }, 403, configuredOrigin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Corpo JSON inválido.' }, 400, configuredOrigin);
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const roleCode = typeof payload.roleCode === 'string' ? payload.roleCode : 'galponista';
  const primarySectorId =
    typeof payload.primarySectorId === 'string' && payload.primarySectorId
      ? payload.primarySectorId
      : null;

  if (!/^\S+@\S+\.\S+$/.test(email))
    return json({ error: 'E-mail inválido.' }, 400, configuredOrigin);
  if (displayName.length < 2 || displayName.length > 120)
    return json({ error: 'Nome inválido.' }, 400, configuredOrigin);
  if (password.length < 6 || password.length > 128)
    return json({ error: 'A senha temporária deve ter entre 6 e 128 caracteres.' }, 400, configuredOrigin);
  if (!allowedRoles.has(roleCode))
    return json({ error: 'Perfil inválido.' }, 400, configuredOrigin);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName, display_name: displayName },
  });

  if (createError || !createdUser.user) {
    return json(
      { error: createError?.message ?? 'Não foi possível criar o usuário.' },
      400,
      configuredOrigin,
    );
  }

  const { error: manageError } = await userClient.rpc('admin_manage_user', {
    p_target_user_id: createdUser.user.id,
    p_active: true,
    p_role_codes: [roleCode],
    p_primary_sector_id: primarySectorId,
    p_confirmation: 'CONFIRMAR',
  });

  if (manageError) {
    return json(
      {
        error: 'O usuário foi criado, mas o perfil precisa ser ajustado manualmente.',
        details: manageError.message,
        userId: createdUser.user.id,
      },
      202,
      configuredOrigin,
    );
  }

  return json({ userId: createdUser.user.id, email, created: true }, 201, configuredOrigin);
});
