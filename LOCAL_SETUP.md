# ParkSnap — Guia de instalação local (servidor próprio)

Este guia explica como rodar o ParkSnap em um servidor local (mini-PC,
Raspberry Pi, NUC, VM Linux/Windows) e como configurar uma **pasta de
inbox** que recebe as fotos enviadas via FTP pelas câmeras do parque.

> ⚠️ A versão hospedada na Lovable roda em ambiente serverless
> (Cloudflare Workers), que **não permite** servidor FTP nem acesso ao
> sistema de arquivos. Esta documentação cobre o cenário em que você
> baixa o projeto e roda você mesmo num servidor com Node.js.

---

## 1. Requisitos

| Componente | Versão recomendada |
|------------|--------------------|
| Node.js    | 20 LTS ou superior |
| Bun *(opcional, mais rápido)* | 1.1+ |
| Servidor FTP local | vsftpd (Linux), FileZilla Server (Windows) |
| Banco/Auth/Storage | Projeto Supabase (self-hosted ou cloud) |

> O projeto usa Supabase como backend (Postgres + Auth + Storage). Em
> ambiente local você pode:
> - manter o projeto Supabase atual já provisionado pela Lovable Cloud, ou
> - rodar Supabase localmente com `supabase start` (CLI).

---

## 2. Clonar e instalar

```bash
git clone <URL_DO_SEU_REPO> parksnap
cd parksnap

# Com bun (recomendado)
bun install

# ou com npm
npm install
```

---

## 3. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# --- Supabase (obrigatório) ---
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...   # anon/publishable key
VITE_SUPABASE_PROJECT_ID=SEU-PROJETO

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...        # ⚠️ NUNCA expor no front

# --- Inbox de fotos (opcional, valores padrão abaixo) ---
PHOTOS_INBOX_DIR=./photos-inbox
PHOTOS_DEFAULT_PRICE=15
```

Onde encontrar as chaves no Supabase: **Project Settings → API**.

---

## 4. Rodar o app

### Desenvolvimento

```bash
bun run dev
# acessa em http://localhost:8080
```

### Produção (Node)

Como você vai rodar fora da Cloudflare, troque o adapter da Vite para o
adapter Node. No `vite.config.ts`:

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    target: "node-server",   // ← em vez de cloudflare
    server: { entry: "server" },
  },
});
```

E remova/ignore o `wrangler.jsonc` (só é usado pela Cloudflare).

Depois:

```bash
bun run build
node .output/server/index.mjs       # caminho típico do TanStack Start
```

> **Persistência**: a pasta `photos-inbox/` precisa ser leitura/escrita
> pelo usuário que roda o processo Node.

---

## 5. Pasta de inbox (FTP → ParkSnap)

O sistema já vem com uma pasta `photos-inbox/` no projeto. Ela é o ponto
de entrada das fotos das câmeras.

### Como funciona

1. As câmeras (ou um agente FTP) **gravam arquivos** `.jpg`, `.jpeg`,
   `.png` ou `.webp` dentro de `photos-inbox/`.
2. O operador, na tela **Galeria**, clica em **"Importar pasta FTP"**.
3. O servidor lê todos os arquivos novos, faz upload para o storage,
   cria a entrada no banco, e **move os arquivos** para:
   - `photos-inbox/processed/` — quando importado com sucesso
   - `photos-inbox/failed/` — quando deu erro (para você inspecionar)

### Mudar o caminho da pasta

Defina no `.env`:

```env
PHOTOS_INBOX_DIR=/var/parksnap/inbox
```

Útil para apontar diretamente para o diretório onde o servidor FTP
recebe os arquivos (ex: `/srv/ftp/cameras`).

### Preço padrão

Defina no `.env`:

```env
PHOTOS_DEFAULT_PRICE=20
```

(O operador pode ajustar depois se quiser; novas importações usam esse
valor.)

---

## 6. Importação automática (sem clicar em botão)

A importação manual pelo botão já funciona. Se quiser que rode sozinha
a cada N segundos, configure um **cron** no servidor que chama o
endpoint do app.

### Opção A — cURL + endpoint público (recomendado)

Crie um pequeno endpoint público com chave secreta no projeto (já
deixamos um exemplo em `src/routes/api.public.hooks.cleanup-photos.ts`
para você se inspirar) e dispare via cron:

```cron
# A cada 10 segundos não é possível em cron; rode um loop:
* * * * * for i in 0 1 2 3 4 5; do curl -s -X POST \
  -H "apikey: SUA_PUBLISHABLE_KEY" \
  http://localhost:8080/api/public/hooks/ingest-photos; sleep 10; done
```

### Opção B — script local que chama o server function

Crie `scripts/poll-inbox.mjs`:

```js
const URL = "http://localhost:8080/_serverFn/ingestLocalPhotos";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // sessão do operador

setInterval(async () => {
  try {
    const r = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const j = await r.json();
    if (j.imported) console.log(`[${new Date().toISOString()}] ${j.imported} fotos importadas`);
  } catch (e) {
    console.error(e.message);
  }
}, 10_000);
```

Rode em segundo plano com `pm2`/`systemd`/`forever`.

> Para evitar manter um token de sessão de operador rodando, recomenda-se
> a opção A com um endpoint público autenticado por `apikey`. Posso criar
> esse endpoint pra você se quiser.

---

## 7. Configurar o servidor FTP

### Linux (vsftpd)

```bash
sudo apt install vsftpd
sudo nano /etc/vsftpd.conf
# write_enable=YES
# local_root=/var/parksnap/inbox    # ou onde você apontou PHOTOS_INBOX_DIR
# chroot_local_user=YES

sudo useradd -m -d /var/parksnap/inbox camera
sudo passwd camera
sudo chown -R camera:camera /var/parksnap/inbox
sudo systemctl restart vsftpd
```

Nas câmeras: configure FTP → IP do servidor, porta 21, usuário `camera`,
senha definida, pasta de destino `/`.

### Windows (FileZilla Server)

1. Instale o **FileZilla Server**.
2. Crie um usuário `camera` com senha.
3. Adicione um diretório compartilhado apontando para a pasta
   `photos-inbox/` do projeto (ou o caminho em `PHOTOS_INBOX_DIR`).
4. Permita escrita/leitura para esse usuário.
5. Configure as câmeras para apontar para o IP do servidor.

---

## 8. Backup e retenção

- O banco roda regras automáticas (ver `.lovable/plan.md`):
  - fotos **não vendidas** são removidas após 30 fotos novas ou 30 dias;
  - fotos **vendidas** ficam disponíveis para o cliente por 30 dias.
- A pasta `photos-inbox/processed/` cresce indefinidamente. Adicione
  um cron de limpeza:
  ```bash
  # apaga fotos processadas com mais de 7 dias
  0 3 * * * find /var/parksnap/inbox/processed -type f -mtime +7 -delete
  ```

---

## 9. Solução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Botão "Importar pasta FTP" mostra "Apenas operadores podem importar fotos" | Usuário logado não é operador | Logar com usuário operador |
| "Não foi possível acessar a pasta de inbox" | Permissão de escrita | `chown -R nodeuser:nodeuser /caminho` |
| Foto vai para `failed/` | Arquivo corrompido, formato inválido, ou erro do storage | Ver logs do servidor (`bun run dev` no terminal) |
| Importa, mas não aparece na galeria | Cache do React Query | Recarregar a página ou aguardar refetch |

---

## 10. Checklist de produção

- [ ] `.env` criado com `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `vite.config.ts` apontado para `node-server`
- [ ] Build feita: `bun run build`
- [ ] Processo rodando sob `pm2`/`systemd` (reinicia em caso de crash)
- [ ] Pasta `PHOTOS_INBOX_DIR` existe e é gravável
- [ ] Servidor FTP testado de uma câmera real
- [ ] Cron de polling automático configurado (opcional)
- [ ] Cron de limpeza de `processed/` configurado
- [ ] Backup periódico do bucket de fotos e do Postgres
- [ ] HTTPS (com nginx/caddy na frente, ou Cloudflare Tunnel)

---

Dúvidas? Veja também `.lovable/plan.md` para a arquitetura completa do
sistema.
