# FilaZero

Solução para trabalhadores com ~1h de almoço descobrirem o tempo de espera e a lotação de restaurantes self-service próximos **antes** de sair do escritório.

Projeto de Empreendedorismo — IFSP.

## Estrutura

```
fila_zero/
├── frontend/          # React + Vite (landing, login, app)
└── backend/           # Express + MySQL + login Google
```

| Rota | Descrição |
|------|-----------|
| `/` | Landing page |
| `/login` | Entrar com Google |
| `/app` | Área logada (próximo: Maps + filtros) |

## Pré-requisitos

- Node.js 20+ (no WSL: `nvm` já pode estar em `~/.nvm`)
- MySQL 8 no Windows (serviço **MySQL80** — você já tem)
- Conta Google Cloud (OAuth)

No WSL, carregue o Node:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
```

## 1) Banco MySQL (Windows)

Abra o **MySQL Workbench** ou o cliente no PowerShell:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

Cole:

```sql
CREATE DATABASE IF NOT EXISTS filazero
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'filazero'@'%' IDENTIFIED BY 'filazero123';
CREATE USER IF NOT EXISTS 'filazero'@'localhost' IDENTIFIED BY 'filazero123';
GRANT ALL PRIVILEGES ON filazero.* TO 'filazero'@'%';
GRANT ALL PRIVILEGES ON filazero.* TO 'filazero'@'localhost';
FLUSH PRIVILEGES;

USE filazero;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  google_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  avatar_url VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_google_id (google_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;
```

### Backend no WSL → MySQL no Windows

O MySQL roda no Windows; o Node no WSL **não** usa `127.0.0.1` do Windows por padrão.

1. No WSL, descubra o IP do host:

```bash
grep nameserver /etc/resolv.conf | awk '{print $2}'
```

2. No MySQL (como root), permita conexão remota (usuário `%` já cobre isso).

3. Em `MySQL Server 8.0` → `my.ini`, confira `bind-address=0.0.0.0` (ou comente a linha) e reinicie o serviço **MySQL80**.

4. No Firewall do Windows, libere a porta **3306** para a rede WSL (ou temporariamente para testes).

5. No `backend/.env`, use esse IP em `DB_HOST`.

Teste a conexão a partir do WSL:

```bash
# se tiver o cliente mysql no WSL; senão use o script npm run db:init
mysql -h SEU_IP_HOST -u filazero -pfilazero123 filazero -e "SHOW TABLES;"
```

Ou, com o backend configurado:

```bash
cd backend
cp .env.example .env
# edite DB_HOST, DB_PASSWORD, etc.
npm run db:init
```

Health check da API (depois de subir o server):

```bash
curl http://localhost:3001/api/health
# esperado: {"ok":true,"db":true}
```

## 2) Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → criar projeto (ou usar um existente).
2. **APIs e serviços → Tela de consentimento OAuth** → External → preencher app.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
4. URIs de redirecionamento autorizados:
   - `http://localhost:3001/auth/google/callback`
5. Origens JavaScript autorizadas (opcional nesta fase):
   - `http://localhost:5173`
   - `http://localhost:3001`
6. Copie **Client ID** e **Client Secret** para `backend/.env`.

Em modo de teste, adicione seu e-mail em **Usuários de teste** na tela de consentimento.

## 3) Rodar o projeto

Terminal 1 — backend:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/fila_zero/backend
cp .env.example .env   # se ainda não criou
npm install
npm run dev
```

Terminal 2 — frontend:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/fila_zero/frontend
npm install
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173) → **Entrar** → **Entrar com Google**.

O Vite faz proxy de `/auth` e `/api` para `http://localhost:3001`.

## Variáveis `.env` (backend)

Veja `backend/.env.example`. Mínimo:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET` (string longa aleatória)
- `FRONTEND_URL=http://localhost:5173`

## App logado (`/app`)

Após login, o app pede **geolocalização**, mostra o **endereço/bairro** (Nominatim), um **mapa Leaflet + OpenStreetMap** (grátis) e busca restaurantes no **Overpass** — sem chave — com filtros:

- self-service / buffet
- distância máxima
- espera máxima estimada

Se o Overpass estiver fora ou a área não tiver POIs, cai em **modo demo**.

O tempo de espera ainda é **estimativa do FilaZero**; depois os restaurantes parceiros poderão atualizar em tempo real.

## Próximos passos

- Painel do restaurante (lotação / tempo de espera real)
- Persistência de preferências do usuário logado
- Mapa embutido (além do link Google Maps)
