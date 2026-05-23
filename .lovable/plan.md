
## Visão geral

Construir uma aplicação web moderna em React + TanStack Start + Lovable Cloud (Postgres + Storage + Auth) com layout de menu lateral, atendendo ao fluxo: foto tirada → operador mostra ao cliente → cliente escolhe → operador vende → cliente faz login (telefone + data nascimento) e baixa.

## Papéis e autenticação

Dois tipos de usuário, ambos em Lovable Cloud Auth:

1. **Operador** — login por e-mail/senha tradicional. Primeiro operador é cadastrado pelo próprio app (signup público); operadores adicionais podem ser criados depois pelo painel.
2. **Cliente** — criado pelo operador no momento da venda. Internamente, salvo no Auth como `{telefone-só-dígitos}@parque.local` e senha = data de nascimento no formato `DDMMAAAA` (8 caracteres, atende o mínimo de 6 do Auth). Na tela de login o cliente digita telefone + data de nascimento e o frontend monta o e-mail + senha por trás.

Papéis ficam em tabela separada `user_roles` (`operator` / `customer`) com função `has_role()` SECURITY DEFINER, conforme boas práticas (evita escalada de privilégio).

## Modelo de dados

- `user_roles(user_id, role)` — papéis.
- `customer_profiles(user_id, phone, full_name, birthdate)` — perfil do cliente; telefone único.
- `photos(id, storage_path, taken_at, sequence_number, price, status)` — `status` ∈ `available | sold | deleted`. `sequence_number` é serial usado para a regra "30 fotos depois".
- `sales(id, customer_id, operator_id, total, created_at)` — uma venda.
- `sale_items(sale_id, photo_id)` — fotos da venda; ao inserir, a foto vira `status='sold'` e fica liberada para download daquele cliente.
- Bucket de Storage `photos` **privado**; download via URL assinada gerada por server function (somente para o cliente dono ou para operador).

## Regras automáticas

- **Limpeza automática "30 depois"**: trigger `AFTER INSERT` em `photos` marca como `deleted` (e apaga o arquivo via server fn quando rodar a limpeza) toda foto `available` cujo `sequence_number <= NEW.sequence_number - 30`. Fotos `sold` nunca são apagadas pela regra.
- **Expiração de 30 dias**: job `pg_cron` diário chama uma server route `/api/public/hooks/cleanup-photos` que apaga arquivos do Storage e marca `deleted` para fotos com `taken_at < now() - 30 days` (vale também para `sold` — descrição do cliente é "guardada por 30 dias").
- **Últimas 30 fotos**: server fn pública lê as últimas 30 com `status != 'deleted'` ordenadas por `taken_at desc`, devolvendo URLs assinadas de baixa duração.

## Server functions (TanStack `createServerFn`)

- `uploadPhoto({file, price})` — operador only; salva no bucket, insere em `photos`, dispara trigger de cleanup.
- `listGalleryPhotos()` — operador only; todas as `available` com URL assinada.
- `listLatestPhotos()` — pública; últimas 30.
- `createCustomerAndSale({phone, fullName, birthdate, photoIds})` — operador only; cria/atualiza cliente no Auth (idempotente por telefone), cria `sales` + `sale_items`, marca fotos `sold`.
- `listMyPhotos()` — cliente autenticado; retorna fotos compradas com URLs assinadas para download.
- `cleanupExpiredPhotos()` — chamada interna pela rota do cron.

## Rotas e UI

Layout único com **sidebar shadcn** que se adapta ao papel:

**Públicas**
- `/` — Hero + carrossel "Últimas 30 fotos" (auto-scroll). CTAs: "Entrar como cliente" / "Sou operador".
- `/login-cliente` — telefone + data de nascimento.
- `/login-operador` — e-mail + senha (+ signup inicial).

**Operador (`/_authenticated/operador/*`)**
- `/operador` — dashboard com totais.
- `/operador/galeria` — grid das fotos disponíveis com seleção múltipla, contador, preço total, botão **"Vender imagens"** → modal com dados do cliente.
- `/operador/upload` — simula a captura, faz upload de uma ou várias fotos com preço.
- `/operador/vendas` — histórico de vendas.

**Cliente (`/_authenticated/cliente/*`)**
- `/cliente` — grade das fotos adquiridas, botão **Baixar** por foto e **Baixar todas** (zip do lado do cliente via JSZip).

## Design

- Estilo moderno e divertido, paleta "Sunset Blaze" (laranja → magenta → roxo) que combina com parque temático, fundo claro, cantos arredondados, sombras suaves.
- Tipografia: Outfit (títulos) + Figtree (corpo) via fontes do Google.
- Tokens semânticos em `oklch` no `src/styles.css` — sem cores hardcoded em componentes.
- Sidebar fixa colapsável (ícones quando colapsada).

## Detalhes técnicos

- RLS habilitado em todas as tabelas. Políticas: operador (via `has_role`) lê tudo; cliente lê só os próprios `sale_items`/`photos` via join.
- Storage bucket `photos` privado; acesso só por server functions usando `supabaseAdmin` com URLs assinadas (60s para visualização, 5min para download).
- Validação Zod em todos os inputs de server fn.
- `attachSupabaseAuth` já registrado pelo template em `start.ts` — verificar antes de finalizar.

## Limitações conhecidas

- "Câmera real" não é integrada — a captura é simulada por upload manual no painel do operador (o sistema é compatível com qualquer câmera que faça upload HTTP depois).
- Cliente precisa ter sido cadastrado pelo operador (não há auto-cadastro), como o requisito pede.
