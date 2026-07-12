# 16 — Proposta de Banco de Dados

Este documento é proposta inicial para auditoria do Codex.

## Identidade

### `profiles`

- id auth user
- name
- role
- department
- active
- created_at
- updated_at

### `permissions`

Opcional para granularidade futura.

## Estrutura física

### `postures`

- id
- number
- name
- battery_count
- active
- metadata

### `posture_layout_slots`

- row
- column
- posture_id nullable
- order

Seed exato da matriz oficial.

### `batteries`

- id
- posture_id
- code B1..B6
- order
- active

### `asset_positions`

Representa posições lógicas.

- id
- posture_id
- battery_id nullable
- code
- name
- domain
- asset_type_id
- active

## Modelos e ativos

### `manufacturers`

- id
- name
- normalized_name

### `asset_types`

- id
- name
- domain electrical/mechanical/etc
- schema_key

### `technical_models`

- id
- manufacturer_id
- asset_type_id
- model
- reference_specs jsonb
- source
- verified

### `assets`

Ativo físico.

- id
- asset_type_id
- manufacturer_id
- technical_model_id nullable
- internal_code
- serial_number
- status
- criticality
- specs jsonb
- notes
- created_at

### `asset_installations`

- id
- asset_id
- asset_position_id
- installed_at
- removed_at nullable
- install_reason
- removal_reason
- work_order_id nullable
- active

Constraint:

- uma instalação ativa por posição quando a posição aceita apenas um ativo.

### `asset_relationships`

Para conjunto motor/redutor.

- parent_asset_id
- child_asset_id
- relation_type

### `asset_media`

- id
- asset_id
- type general/nameplate/before/after
- storage_path
- metadata

## Ordens de Serviço

### `work_orders`

- id
- number
- posture_id
- battery_id nullable
- asset_id nullable
- asset_installation_id nullable
- department
- problem_type_id
- priority_id
- status_id
- description
- opened_by
- assigned_to
- opened_at
- started_at
- resolved_at
- cancelled_at
- diagnosis
- root_cause
- work_performed

### `work_order_history`

Append-only.

### `work_order_media`

### `work_order_needed_items`

Registro textual/sem saldo.

## Configuração

### `app_settings`

Chave/valor versionado.

### `ui_modules`

- slug
- label
- icon
- order
- visible
- permissions

### `theme_presets`

- key
- name
- tokens jsonb
- system_preset
- active

### `theme_versions`

Histórico.

### `status_definitions`

### `priority_definitions`

### `problem_types`

### `sound_presets`

### `notification_preferences`

## Auditoria

### `audit_logs`

- actor
- action
- entity
- entity_id
- before jsonb
- after jsonb
- created_at

## Favoritos

### `favorites`

- user
- entity_type
- entity_id

## Observação

O Codex deve revisar normalização, índices, constraints e RLS antes de criar migrations finais.
