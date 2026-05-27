
# Multi-tenant: Admin → Empresas → Operadores → Clientes

## Hierarquia de papéis

```
super_admin  → cria empresas e o operador-dono de cada uma; vê tudo
   └── tenant (empresa)
        ├── operator (dono)  → cria mais operadores DA empresa dele, personaliza
        ├── operator         → opera galeria/vendas
        └── customer         → cliente final, escopado à empresa onde comprou
```

- Admin global é único papel novo (`super_admin`) no enum `app_role`.
- Operador continua sendo `operator`, mas agora SEMPRE vinculado a 1 tenant.
- Cliente continua sendo `customer`, vinculado a 1 tenant (telefone único POR tenant — mesmo telefone pode comprar em parques diferentes).

## Modelo de dados (migração)

Nova tabela:
- `tenants(id, slug UNIQUE, name, status [active|suspended], created_at)` — uma linha por empresa cliente.

Coluna `tenant_id` (NOT NULL, FK → tenants) adicionada em:
- `user_roles` (para operadores e clientes — `super_admin` fica com `tenant_id NULL`)
- `photos`
- `sales`
- `sale_items`
- `customer_profiles` (UNIQUE composto `(tenant_id, phone)` em vez de `phone` global)
- `site_settings` (deixa de ser singleton — PK passa a ser `tenant_id`)

Função `has_role` ganha variante `has_role_in_tenant(_user_id, _role, _tenant_id)` SECURITY DEFINER. Função `is_super_admin(_user_id)` para o admin global.

RLS reescrita:
- `super_admin` enxerga tudo em todas as tabelas.
- `operator`/`customer` só enxergam linhas onde `tenant_id` bate com algum vínculo seu em `user_roles`.
- `site_settings`: leitura pública filtrada por `tenant_id` (necessário para a landing pública da empresa); escrita só por operador daquele tenant.

Bucket `photos` continua privado; o caminho passa a ser `{tenant_slug}/{photo_id}.jpg` para isolamento físico além do lógico.

## Roteamento (slug por empresa)

Mantemos slug em path (funciona sem DNS — ideal para o cenário de servidor local). Subdomínio fica como opção documentada via nginx.

Rotas públicas:
- `/` — landing institucional do produto + lista de empresas (opcional) OU redireciona para login admin
- `/e/$slug` — landing da empresa (hero, últimas 30 fotos daquela empresa, cores/textos dela)
- `/e/$slug/login-cliente` — login cliente (telefone + nascimento), escopo do tenant
- `/e/$slug/cliente` — galeria do cliente daquele tenant

Operador (tenant resolvido pelo vínculo do usuário, não pela URL):
- `/login-operador` — login único; após login, redireciona para `/operador` do tenant dele
- `/operador/*` — rotas atuais, automaticamente filtradas pelo `tenant_id` do operador logado
- `/operador/usuarios` — só lista operadores DO mesmo tenant; criação cria já com `tenant_id` igual
- `/operador/configuracoes` — edita `site_settings` do tenant dele

Admin global:
- `/login-admin` — login do super_admin
- `/admin` — dashboard global (nº de empresas, fotos, vendas)
- `/admin/empresas` — listar/criar/suspender empresas; criar empresa exige `{nome, slug, email do operador-dono, senha inicial}` e dispara: insert em `tenants` + criação do usuário no Auth + role `operator` + `tenant_id`
- `/admin/empresas/$id` — detalhes, troca de dono, métricas da empresa

## Server functions (ajustes)

Todas as fns existentes ganham resolução automática de `tenant_id`:
- Operador: `tenant_id` lido do `user_roles` do `context.userId` no middleware.
- Cliente: idem (cliente tem 1 vínculo de tenant ativo).
- Públicas (`listLatestPhotos`, `getSiteSettings`): passam a receber `slug` como input e resolver o `tenant_id` por ele.

Novas fns:
- `admin.createTenant({name, slug, ownerEmail, ownerPassword})` — só super_admin
- `admin.listTenants()`, `admin.suspendTenant({id})`, `admin.updateTenant(...)`
- `admin.getGlobalStats()`

Fns adaptadas:
- `createCustomerAndSale` → telefone procura cliente DENTRO do tenant; se não existir, cria com `tenant_id`
- `createOperator` → força mesmo `tenant_id` do operador logado
- `uploadPhoto` / inbox → grava com `tenant_id` do operador
- `getSiteSettings({slug})` / `updateSiteSettings` (escopo tenant do operador logado)

## Pasta `photos-inbox` (FTP)

Passa a ser organizada por tenant:
```
photos-inbox/
  parquex/        ← slug do tenant
  parquey/
```
O scanner lê o slug do nome da pasta e associa as fotos ao tenant correspondente. `LOCAL_SETUP.md` atualizado com:
- estrutura por slug
- configuração `vsftpd` com usuário virtual por empresa apontando para `photos-inbox/{slug}/`
- ou um único usuário FTP cujo diretório raiz é `photos-inbox/` (cada empresa entrega na sua pasta)

## UI/UX

- Sidebar do operador: mostra `tenant.name` no topo (não mais `site_settings.siteName` global).
- Sidebar nova para super_admin: Empresas, Métricas, Operadores globais.
- `SettingsProvider` passa a aceitar `slug` (rotas `/e/$slug/*` carregam settings do tenant; rotas `/operador/*` carregam settings do tenant do operador; `/admin/*` usa tema neutro padrão).
- Landing raiz `/` mostra apresentação do produto + CTAs "Sou admin" / "Sou operador" / "Sou cliente — qual seu parque?" (com busca por slug).

## Migração dos dados existentes

A migração cria um tenant padrão `default` e:
- atribui todos os operadores, fotos, vendas e clientes atuais a esse tenant
- migra a linha singleton de `site_settings` para `tenant_id = default`
- não há perda de dados

## Documentação

`LOCAL_SETUP.md` ganha seção nova:
- como o admin cria a primeira empresa
- como configurar FTP multi-empresa
- como (opcionalmente) ativar subdomínio por empresa via wildcard DNS + nginx (`*.parksnap.local`)

## Detalhes técnicos

- Enum `app_role` ganha valor `super_admin` (`ALTER TYPE ... ADD VALUE`).
- Para evitar recursão em RLS, `has_role_in_tenant` e `is_super_admin` são SECURITY DEFINER com `search_path=public`.
- Índices: `(tenant_id)` em todas as tabelas com a coluna; `(tenant_id, sequence_number)` em `photos` para a regra das "30 fotos depois" rodar por tenant.
- Trigger `auto_delete_old_available_photos` reescrito para escopar por `tenant_id` (apaga só fotos do mesmo tenant da que acabou de entrar).
- Job `cleanup-photos` percorre todos os tenants.
- Bucket único `photos`, prefixo por slug, URLs assinadas continuam geradas pelas server fns.
- `customer_profiles` PK passa a ser `(tenant_id, user_id)`; o e-mail sintético do cliente vira `{phone}@{slug}.parque.local` para permitir mesmo telefone em parques diferentes no Auth.

## Escopo NÃO incluído

- Domínio próprio por empresa (`fotos.parquex.com.br`) — fica para depois.
- Planos/limites por tenant (nº de fotos, GB) — fica para depois.
- Billing.

---

Posso prosseguir com a implementação?
