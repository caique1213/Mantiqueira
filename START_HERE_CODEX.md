# Comece aqui

O projeto já foi implementado. Para colocar o sistema no ar, siga [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) desde a criação do novo projeto Supabase até o checklist final no Cloudflare.

Para futuras alterações no Codex:

1. Abra esta pasta inteira como projeto.
2. Leia `AGENTS.md` e os documentos de domínio relevantes em `docs/`.
3. Preserve as migrations já aplicadas; crie uma nova migration para mudanças de banco.
4. Rode `pnpm verify` antes de entregar qualquer alteração.
5. Para alterações visuais ou responsivas, rode também `pnpm test:e2e` e confira celular e desktop.
6. Nunca grave segredos no repositório.

Arquivos de operação:

- `DEPLOYMENT_GUIDE.md`
- `TESTING_GUIDE.md`
- `SECURITY.md`
- `IMPLEMENTATION_STATUS.md`
