-- ============================================================
-- 015 — Módulo separado para abrir OS
-- ============================================================

insert into public.ui_modules
  (id, slug, label, description, icon, route, required_permission, visible, system, sort_order)
values (
  '70000000-0000-4000-8000-000000000007',
  'open-work-order',
  'Abrir OS',
  'Abrir uma nova ordem de serviço',
  'clipboard-plus',
  '/ordens/nova',
  'work_orders.create',
  true,
  true,
  18
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  route = excluded.route,
  required_permission = excluded.required_permission,
  visible = true,
  sort_order = excluded.sort_order;
