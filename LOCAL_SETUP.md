# ParkSnap — Guia de instalação local (servidor próprio)

Este guia explica como rodar o ParkSnap em um servidor local (mini-PC,
Raspberry Pi, NUC, VM Linux/Windows) e como configurar uma **pasta de
inbox** que recebe as fotos enviadas via FTP pelas câmeras do parque.

> ⚠️ A versão hospedada na Lovable roda em ambiente serverless
> (Cloudflare Workers), que **não permite** servidor FTP nem acesso ao
> sistema de arquivos. Esta documentação cobre o cenário em que você
> baixa o projeto e roda você mesmo num servidor com Node.js.

---

## Sumário

1. [Requisitos](#1-requisitos)
2. [Instalação passo a passo no Debian 13 (Trixie)](#2-instalação-passo-a-passo-no-debian-13-trixie) ← **comece por aqui se for Debian**
3. [Instalação genérica (clonar e instalar)](#3-clonar-e-instalar)
4. [Variáveis de ambiente](#4-variáveis-de-ambiente)
5. [Rodar o app](#5-rodar-o-app)
6. [Pasta de inbox (FTP → ParkSnap)](#6-pasta-de-inbox-ftp--parksnap)
7. [Importação automática](#7-importação-automática-sem-clicar-em-botão)
8. [Configurar o servidor FTP](#8-configurar-o-servidor-ftp)
9. [Backup e retenção](#9-backup-e-retenção)
10. [Solução de problemas](#10-solução-de-problemas)
11. [Checklist de produção](#11-checklist-de-produção)

---

## 1. Requisitos

| Componente | Versão recomendada |
|------------|--------------------|
| Sistema    | Debian 13 (Trixie), Ubuntu 22.04+, ou Windows 10+ |
| Node.js    | 20 LTS ou superior |
| Bun *(opcional, mais rápido)* | 1.1+ |
| Servidor FTP local | vsftpd (Linux), FileZilla Server (Windows) |
| Banco/Auth/Storage | Projeto Supabase (self-hosted ou cloud) |
| Reverse proxy *(produção)* | nginx ou Caddy |
| Gerenciador de processo | systemd (recomendado) ou pm2 |

> O projeto usa Supabase como backend (Postgres + Auth + Storage). Em
> ambiente local você pode:
> - manter o projeto Supabase atual já provisionado pela Lovable Cloud, ou
> - rodar Supabase localmente com `supabase start` (CLI).

---

## 2. Instalação passo a passo no Debian 13 (Trixie)

Este é o caminho recomendado e testado. Os comandos assumem que você
está logado como um usuário com `sudo` (não root).

### 2.1. Atualizar o sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ca-certificates ufw unzip
```

### 2.2. Instalar Node.js 20 LTS (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve mostrar v20.x
npm -v
```

> Alternativa: `sudo apt install -y nodejs npm` instala uma versão
> mais antiga do repositório Debian. Funciona, mas prefira NodeSource
> para ter o Node 20 LTS.

### 2.3. Instalar Bun (opcional, mais rápido)

```bash
curl -fsSL https://bun.sh/install | bash
# adicione ao PATH (o instalador faz isso no ~/.bashrc):
exec $SHELL
bun --version
```

### 2.4. Criar usuário dedicado para a aplicação

```bash
sudo adduser --system --group --home /opt/parksnap parksnap
sudo mkdir -p /opt/parksnap
sudo chown parksnap:parksnap /opt/parksnap
```

### 2.5. Clonar o projeto

```bash
sudo -u parksnap -H bash -lc '
  cd /opt/parksnap
  git clone <URL_DO_SEU_REPO> app
  cd app
  bun install   # ou: npm install
'
```

### 2.6. Configurar variáveis de ambiente

```bash
sudo -u parksnap nano /opt/parksnap/app/.env
```

Conteúdo (substitua pelos seus valores — veja [seção 4](#4-variáveis-de-ambiente)):

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
VITE_SUPABASE_PROJECT_ID=SEU-PROJETO

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

PHOTOS_INBOX_DIR=/var/parksnap/inbox
PHOTOS_DEFAULT_PRICE=15
PORT=8080
```

```bash
sudo chmod 600 /opt/parksnap/app/.env
sudo chown parksnap:parksnap /opt/parksnap/app/.env
```

### 2.7. Ajustar o target do build para Node

Edite `/opt/parksnap/app/vite.config.ts` e troque o target para
`node-server` (em vez de `cloudflare`):

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    target: "node-server",
    server: { entry: "server" },
  },
});
```

Pode apagar (ou ignorar) o `wrangler.jsonc` — ele só é usado pela Cloudflare.

### 2.8. Criar a pasta de inbox

```bash
sudo mkdir -p /var/parksnap/inbox/{processed,failed}
sudo chown -R parksnap:parksnap /var/parksnap
sudo chmod -R 775 /var/parksnap
```

### 2.9. Build da aplicação

```bash
sudo -u parksnap -H bash -lc 'cd /opt/parksnap/app && bun run build'
```

O artefato fica em `/opt/parksnap/app/.output/server/index.mjs` (caminho
típico do TanStack Start; confirme o caminho real após o build).

### 2.10. Criar serviço systemd

```bash
sudo nano /etc/systemd/system/parksnap.service
```

```ini
[Unit]
Description=ParkSnap (TanStack Start)
After=network.target

[Service]
Type=simple
User=parksnap
Group=parksnap
WorkingDirectory=/opt/parksnap/app
EnvironmentFile=/opt/parksnap/app/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/parksnap /opt/parksnap/app

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now parksnap
sudo systemctl status parksnap
journalctl -u parksnap -f          # acompanhar logs em tempo real
```

A app já está respondendo em `http://localhost:8080`.

### 2.11. Reverse proxy + HTTPS (nginx + Let's Encrypt)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/parksnap
```

```nginx
server {
    listen 80;
    server_name parksnap.seudominio.com;

    client_max_body_size 50M;   # fotos grandes via upload manual

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/parksnap /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Emitir certificado HTTPS
sudo certbot --nginx -d parksnap.seudominio.com
```

### 2.12. Firewall (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw allow 20/tcp          # FTP control
sudo ufw allow 21/tcp          # FTP
sudo ufw allow 40000:50000/tcp # FTP passive (ajustar conforme vsftpd)
sudo ufw enable
sudo ufw status
```

### 2.13. Testar

1. Acesse `https://parksnap.seudominio.com` — deve carregar a home.
2. Crie um usuário operador (ou promova um existente via banco).
3. Faça login, jogue uma foto `.jpg` em `/var/parksnap/inbox/`.
4. Na tela **Galeria**, clique em **"Importar pasta FTP"** — a foto
   aparece e o arquivo é movido para `/var/parksnap/inbox/processed/`.

Pronto. Para o servidor FTP siga a [seção 8](#8-configurar-o-servidor-ftp).
Para automação sem clicar em botão, [seção 7](#7-importação-automática-sem-clicar-em-botão).

### 2.14. Atualizar a aplicação (deploys futuros)

```bash
sudo -u parksnap -H bash -lc '
  cd /opt/parksnap/app
  git pull
  bun install
  bun run build
'
sudo systemctl restart parksnap
```

---

## 3. Clonar e instalar

Caso não esteja no Debian 13, o fluxo geral é:

```bash
git clone <URL_DO_SEU_REPO> parksnap
cd parksnap

# Com bun (recomendado)
bun install

# ou com npm
npm install
```

---

## 4. Variáveis de ambiente

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

# --- App ---
PORT=8080
```

Onde encontrar as chaves no Supabase: **Project Settings → API**.

---

## 5. Rodar o app

### Desenvolvimento

```bash
bun run dev
# acessa em http://localhost:8080
```

### Produção (Node)

No `vite.config.ts`, use `target: "node-server"`:

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    target: "node-server",
    server: { entry: "server" },
  },
});
```

Depois:

```bash
bun run build
node .output/server/index.mjs
```

> **Persistência**: a pasta `PHOTOS_INBOX_DIR` precisa ser leitura/escrita
> pelo usuário que roda o processo Node.

---

## 6. Pasta de inbox (FTP → ParkSnap)

O sistema já vem com uma pasta `photos-inbox/` no projeto. Ela é o ponto
de entrada das fotos das câmeras.

### Como funciona

1. As câmeras (ou um agente FTP) **gravam arquivos** `.jpg`, `.jpeg`,
   `.png` ou `.webp` dentro de `PHOTOS_INBOX_DIR`.
2. O operador, na tela **Galeria**, clica em **"Importar pasta FTP"**.
3. O servidor lê todos os arquivos novos, faz upload para o storage,
   cria a entrada no banco, e **move os arquivos** para:
   - `<inbox>/processed/` — quando importado com sucesso
   - `<inbox>/failed/` — quando deu erro (para você inspecionar)

### Mudar o caminho da pasta

```env
PHOTOS_INBOX_DIR=/var/parksnap/inbox
```

### Preço padrão

```env
PHOTOS_DEFAULT_PRICE=20
```

---

## 7. Importação automática (sem clicar em botão)

### Opção A — endpoint público + cron (recomendado)

Crie um endpoint em `src/routes/api.public.hooks.ingest-photos.ts`
protegido por um secret e dispare via `systemd timer` ou cron:

```cron
* * * * * for i in 0 1 2 3 4 5; do curl -s -X POST \
  -H "x-ingest-secret: $FTP_INGEST_SECRET" \
  http://localhost:8080/api/public/hooks/ingest-photos; sleep 10; done
```

### Opção B — script local com fetch

`scripts/poll-inbox.mjs`:

```js
const URL = "http://localhost:8080/_serverFn/ingestLocalPhotos";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

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

Rode em segundo plano com systemd:

```ini
# /etc/systemd/system/parksnap-poller.service
[Unit]
Description=ParkSnap inbox poller
After=parksnap.service

[Service]
User=parksnap
EnvironmentFile=/opt/parksnap/app/.env
ExecStart=/usr/bin/node /opt/parksnap/app/scripts/poll-inbox.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now parksnap-poller
```

---

## 8. Configurar o servidor FTP

### Debian / Linux (vsftpd)

```bash
sudo apt install -y vsftpd
sudo cp /etc/vsftpd.conf /etc/vsftpd.conf.bak
sudo nano /etc/vsftpd.conf
```

Linhas-chave:

```ini
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
chroot_local_user=YES
allow_writeable_chroot=YES
user_sub_token=$USER
local_root=/var/parksnap/inbox
pasv_enable=YES
pasv_min_port=40000
pasv_max_port=50000
```

Criar usuário das câmeras:

```bash
sudo useradd -M -d /var/parksnap/inbox -s /usr/sbin/nologin camera
sudo passwd camera
sudo usermod -aG parksnap camera
sudo chown -R parksnap:parksnap /var/parksnap/inbox
sudo chmod -R 775 /var/parksnap/inbox
sudo systemctl restart vsftpd
sudo systemctl enable vsftpd
```

Testar de outra máquina:

```bash
curl -v -T foto.jpg ftp://IP_SERVIDOR/ --user camera:SENHA
```

Nas câmeras: configure FTP → IP do servidor, porta 21, usuário `camera`,
senha definida, pasta de destino `/`.

### Windows (FileZilla Server)

1. Instale o **FileZilla Server**.
2. Crie um usuário `camera` com senha.
3. Adicione um diretório compartilhado apontando para `PHOTOS_INBOX_DIR`.
4. Permita escrita/leitura para esse usuário.
5. Configure as câmeras para apontar para o IP do servidor.

---

## 9. Backup e retenção

- O banco roda regras automáticas (ver `.lovable/plan.md`):
  - fotos **não vendidas** são removidas após 30 fotos novas ou 30 dias;
  - fotos **vendidas** ficam disponíveis para o cliente por 30 dias.
- A pasta `<inbox>/processed/` cresce indefinidamente. Adicione
  um cron de limpeza:

```bash
sudo crontab -e
```

```cron
0 3 * * * find /var/parksnap/inbox/processed -type f -mtime +7 -delete
```

Backup do Postgres (se Supabase self-hosted):

```cron
0 4 * * * pg_dump -Fc "$DATABASE_URL" > /var/backups/parksnap-$(date +\%F).dump
```

---

## 10. Solução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Botão "Importar pasta FTP" mostra "Apenas operadores podem importar fotos" | Usuário logado não é operador | Logar com usuário operador |
| "Não foi possível acessar a pasta de inbox" | Permissão de escrita | `sudo chown -R parksnap:parksnap /var/parksnap/inbox` |
| Foto vai para `failed/` | Arquivo corrompido, formato inválido, ou erro do storage | `journalctl -u parksnap -n 200` |
| Importa, mas não aparece na galeria | Cache do React Query | Recarregar a página |
| `parksnap.service` não inicia | Caminho errado do `.output/server/index.mjs` | Confirmar caminho real após `bun run build` e ajustar `ExecStart` |
| FTP conecta mas dá timeout no upload | Portas passivas bloqueadas | Abrir 40000–50000/tcp no ufw |

---

## 11. Checklist de produção

- [ ] `.env` criado com `SUPABASE_SERVICE_ROLE_KEY` e modo 600
- [ ] `vite.config.ts` com `target: "node-server"`
- [ ] Build feita: `bun run build`
- [ ] Serviço `parksnap.service` ativo (`systemctl status parksnap`)
- [ ] Pasta `PHOTOS_INBOX_DIR` existe e é gravável pelo usuário `parksnap`
- [ ] nginx + HTTPS funcionando (`https://...`)
- [ ] Firewall ufw habilitado com portas certas
- [ ] vsftpd ativo e usuário `camera` testado
- [ ] Cron de limpeza de `processed/` configurado
- [ ] Backup periódico do bucket de fotos e do Postgres
- [ ] Câmera real testada de ponta a ponta

---

Dúvidas? Veja também `.lovable/plan.md` para a arquitetura completa do
sistema.
