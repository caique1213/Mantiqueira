# Estado da implementação

Data da entrega: 11 de julho de 2026.

## Entregue

### Fundação e identidade

- React 19, TypeScript, Vite e rotas protegidas.
- Supabase Auth com login por e-mail/senha, logout, recuperação e troca de senha.
- Perfis `galponista`, `eletricista`, `mecanico` e `administrador`.
- Permissões granulares, associação à unidade e setor principal.
- Proteção contra auto-desativação e contra remoção do último administrador ativo.
- Convite administrativo por Edge Function.

### Experiência visual

- Shell profissional responsivo para desktop e celular.
- Navegação e módulos carregados do banco.
- Dashboard com imagem industrial otimizada.
- Estados distintos de carregamento, vazio, configuração ausente, sem permissão e erro remoto.
- Lazy loading das rotas funcionais.
- Cabeçalhos de segurança e fallback SPA preparados para Cloudflare Pages.

### Aparência administrável

- Mantiqueira Clássico.
- Mantiqueira Industrial.
- Mantiqueira Premium.
- Mantiqueira Light.
- Mantiqueira Contrast.
- Personalizado.
- 104 tokens de design cobrindo cores, status, prioridade, tipografia, densidade, espaçamento, raio, sombra, blur e transparência.
- Pré-visualização, rascunho, histórico de versões, aplicação, desfazer e restauração.

### Estrutura física

- Matriz física exata das 48 posturas.
- Vazios físicos preservados.
- Posturas 1–44 com B1–B4, postura 45 com B1–B5 e posturas 46–48 com B1–B6.
- 199 baterias e 1.784 posições técnicas padrão geradas no banco.
- Mapa com camadas, filtros e indicadores.
- Página da postura e visão lateral interativa da bateria.
- Representação de motores, redutores, elevador, esteiras de nylon, esteiras brancas, gaiolas, carrinho de ração e ativos gerais.

### Inventário técnico

- Catálogo de fabricantes, tipos de ativo e modelos técnicos.
- Cadastro de ativo físico separado do modelo reutilizável.
- Dados de placa prevalecem sobre sugestões da biblioteca.
- Ficha de modelo técnico com especificações de referência e ativos instalados associados.
- Ficha de motor e redutor, criticidade, completude e campos faltantes.
- Fotos privadas de ativo e placa com compressão no navegador.
- Instalação, remoção, substituição e relacionamento motor–redutor.
- Linha do tempo que preserva ativos e instalações antigas.
- Busca e filtros com paginação no servidor.

### Ordens de Serviço

- Abertura geral ou contextual a partir de postura, bateria, posição e ativo.
- Setor, tipo de problema, prioridade, descrição e foto inicial.
- Lista com filtros, paginação e visões pessoais.
- Atribuir, iniciar, aguardar peça, resolver, cancelar e reabrir administrativamente.
- Confirmações reforçadas para ações terminais.
- Diagnóstico, causa, solução, comentários públicos/internos, itens necessários e anexos privados.
- Marcação de item necessário como atendido.
- Linha do tempo auditável.
- Bloqueio operacional de OS resolvida/cancelada até reabertura explícita.

### Análises e operação

- Indicadores de OS, SLA, criticidade, ativos, completude e substituições.
- Tendência temporal e distribuições por status, prioridade, setor, tipo e postura.
- Comparação de falhas por fabricante.
- Detecção de reincidência configurável.
- Exportação CSV e PDF.
- Pesquisa global.
- Central de notificações, leitura e preferências sonoras.
- Cinco alertas sonoros configuráveis.

### Administração

- Dados gerais e textos da Home.
- Usuários, papéis e setor principal.
- Status, prioridades, setores, tipos de problema, fabricantes, modelos, tipos de ativo e módulos.
- Proteção da identidade dos catálogos essenciais.
- Logs de auditoria consultáveis.
- Configurações operacionais e visuais persistidas no banco.

### Segurança e banco

- 12 migrations versionadas.
- RLS em tabelas sensíveis.
- RPCs transacionais para mutações críticas.
- Grants mínimos; escrita direta sensível revogada.
- Buckets privados e políticas por unidade/entidade.
- URLs assinadas temporárias.
- Auditoria de alterações críticas.
- Validações contra associação cruzada entre unidades, ativos, posições e OS.
- Realtime apenas nos eventos operacionais necessários.
- Testes de contrato pgTAP incluídos.

## Limites intencionais desta entrega

- Não há almoxarifado/WMS de peças; “inventário” significa ativos instalados.
- Não há QR Code.
- Não há PWA ou modo offline.
- Não há leitura automática de placa por IA.
- Não há integração com ERP, WhatsApp ou compra de peças.
- Não há dados reais de motores ou OS; eles devem ser cadastrados depois do deploy.
- Não há envio push nativo do sistema operacional; os alertas funcionam dentro da aplicação aberta.

Esses itens não são falhas: foram mantidos fora do escopo para preservar o conceito aprovado e evitar transformar o produto em outro sistema.

## Validação já executada

- Lint do frontend.
- Compilação TypeScript.
- Testes unitários.
- Build de produção.
- Testes Playwright em desktop e viewport móvel.
- Validação alternativa de todas as migrations em PostgreSQL embutido, simulando recursos do Supabase indisponíveis localmente.
- Auditoria estática de RLS, RPCs, Storage e contratos de histórico.

O passo que só pode ocorrer no projeto do usuário é aplicar as migrations em um Supabase real e executar o checklist integrado descrito em `TESTING_GUIDE.md`. O `supabase db reset` local não foi executado nesta máquina porque o Docker Desktop não estava disponível.
