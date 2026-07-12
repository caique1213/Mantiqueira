-- Mantiqueira Maintenance Hub
-- Foundation shared by every domain migration.

create schema if not exists extensions;
create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.prevent_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '42501',
    message = format('%s is append-only', tg_table_name);
end;
$$;

create or replace function private.slugify(value text)
returns text
language sql
stable
strict
set search_path = pg_catalog, extensions
as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(value)),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

create or replace function private.normalized_search(value text)
returns text
language sql
stable
set search_path = pg_catalog, extensions
as $$
  select lower(extensions.unaccent(coalesce(value, '')));
$$;

comment on schema private is
  'Internal helpers. This schema is not exposed by PostgREST.';

revoke all on all functions in schema private from public, anon, authenticated;

