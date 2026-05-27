# Plano — Finalizar Multi-Tenant

Continuação do trabalho já iniciado (DB + RLS + server-side resolução de tenant já prontos).

## 1. Painel Super Admin

Novas server functions em `src/lib/admin.functions.ts`:
- `listTenants` — lista empresas com contagem de operadores/fotos/vendas
- `createTenantWithOperator` — cria empresa + operador principal num único fluxo (input: nome empresa, slug, email operador, senha, nome operador)
- `updateTenant` — editar nome/slug/status
- `suspendTenant` / `activateTenant`
- `getGlobalStats` — métricas agregadas

Todas validadas com `is_super_admin(context.userId)`.

Novas rotas:
- `src/routes/admin.tsx` — layout com sidebar própria (tema neutro)
- `src/routes/admin.index.tsx` — dashboard global
- `src/routes/admin.empresas.tsx` — CRUD de tenants + criar operador principal
- `src/routes/admin.empresas.$id.tsx` — detalhe/edição

Sidebar do admin: Dashboard, Empresas, Sair.

## 2. Operador escopado ao próprio tenant

- `createOperator` (já adaptado) — operador novo herda `tenant_id` do criador
- Página `/operador/usuarios` já lista; ajustar para mostrar apenas operadores do mesmo tenant (RLS já garante)
- Sidebar do operador mostra `tenant.name` no topo via novo hook `useCurrentTenant`

## 3. Rotas públicas por slug

- `src/routes/e.$slug.tsx` — layout que resolve tenant pelo slug e injeta no `SettingsProvider`
- `src/routes/e.$slug.index.tsx` — landing pública daquela empresa (atual `index.tsx`)
- `src/routes/e.$slug.login.tsx` — login do cliente final escopado
- `src/routes/e.$slug.galeria.tsx` — galeria do cliente

Server function nova `getTenantBySlug(slug)` (pública, leitura simples).

Login do cliente: e-mail sintético passa a ser `{phone}@{slug}.parque.local`. `loginCustomer` recebe `slug` agora.

## 4. Landing raiz `/`

Substituir o conteúdo atual (que era a landing de tenant único) por:
- Página institucional curta do ParkSnap
- CTAs: "Sou operador" → `/login` ; "Sou super admin" → `/admin` ; texto explicando que clientes acessam via link da empresa (`/e/{slug}`)

## 5. SettingsProvider por tenant

`SettingsProvider` aceita prop `tenantId` ou `slug`. Em `/operador/*` resolve do operador logado; em `/e/$slug/*` resolve do slug; em `/admin/*` usa tema padrão fixo (sem aplicar CSS variables custom).

## 6. Inbox de fotos por slug

`LOCAL_SETUP.md` atualizado com:
- Nova estrutura `photos-inbox/{tenant_slug}/`
- Exemplo de `vsftpd` com usuário virtual por empresa fazendo chroot em `photos-inbox/{slug}/`
- Nota sobre subdomínio wildcard (opcional, fora de escopo agora)

## 7. Roteamento de redirect por papel após login

`/login` (operador/admin): após auth, se `is_super_admin` → `/admin`; senão `/operador`. Cliente final só loga em `/e/$slug/login`.

## Fora de escopo
- Domínio próprio por empresa
- Planos / billing / limites
- Subdomínio real (DNS) — fica como opção documentada
- Migração de dados antigos: já feita na migração anterior (tudo no tenant `default`)

## Detalhes técnicos
- Todas as fns admin usam `supabaseAdmin` (service role) após checar `is_super_admin`
- `createTenantWithOperator` faz: insert em `tenants` → `auth.admin.createUser` → insert em `user_roles` (role=operator, tenant_id) → insert em `site_settings` (defaults)
- Sidebar de operador e admin são componentes separados
- Rotas `/e/$slug/*` NÃO exigem autenticação para a landing; apenas galeria exige login do cliente
