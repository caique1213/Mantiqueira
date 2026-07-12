# 17 — Supabase, Segurança e Storage

## Auth

Usar Supabase Auth.

## RLS

Ativar em todas as tabelas de domínio.

## Frontend

Pode usar publishable/anon key.

Nunca:

- service role;
- senha do banco;
- segredo.

## Storage

Buckets privados.

Sugestão:

- `asset-images`
- `work-order-images`
- `branding`

## Paths

Exemplo:

```text
asset-images/{asset_id}/{uuid}.webp
work-order-images/{work_order_id}/{uuid}.webp
branding/{tenant_or_system}/{uuid}.webp
```

## Imagens

- comprimir no cliente;
- converter para WebP quando apropriado;
- preservar orientação;
- limitar tamanho;
- gerar thumbnail quando necessário.

## Acesso

RLS/policies de Storage devem considerar:

- usuário ativo;
- perfil;
- setor;
- entidade.

## Logs

Funções críticas podem gravar log no banco.

## Exclusões

Preferir soft delete onde histórico técnico importa.

Excluir fisicamente somente:

- arquivos substituídos sem valor histórico;
- dados administrativos realmente descartáveis.

## Backup

Prever exportações e estratégia de backup.

## Segurança de usuário

- impedir auto-desativação acidental;
- preservar último admin.
