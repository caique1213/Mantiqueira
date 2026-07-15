-- Ajusta o alarme padrao para sirene longa e mantem a escolha global consistente.

insert into public.app_settings (key, value, description, public_read)
values (
  'notification.default_sound_preset_key',
  '"long_siren"'::jsonb,
  'Som padrao global dos alarmes de OS',
  false
)
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  updated_at = now(),
  updated_by = auth.uid();
