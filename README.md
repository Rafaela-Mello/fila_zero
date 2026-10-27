# FilaZero

Veja o tempo de espera estimado e a lotação de restaurantes próximos **antes** de sair para almoçar.

Projeto de Empreendedorismo — IFSP.

## Deploy (produção)

| Parte | URL |
|------|-----|
| Frontend | https://filazero-sandy.vercel.app |
| Backend (API) | https://fila-zero-one.vercel.app |
| Health check | https://fila-zero-one.vercel.app/api/health |

- **Frontend** na Vercel (preset Vite, root `frontend`) — `vercel.json` faz proxy de `/api`, `/auth` e `/uploads` para o backend.
- **Backend** na Vercel (root `backend`) — Express em serverless (`api/index.js`).
- **Banco** no **Supabase** (Postgres). Fotos do cardápio no **Supabase Storage** (bucket público `menu`).

## O que tem

| Rota | O que é |
|------|---------|
| `/` | Landing |
| `/login` | Entrar / cadastrar (e-mail e senha) — escolha **Cliente** ou **Restaurante** no cadastro |
| `/app` | App do cliente: Explorar, favoritos, histórico, assistente e Minha conta |
| `/parceiro` | Painel do restaurante |
| `/parceiro/cadastro` | Redireciona para `/login?mode=register&tipo=restaurante` |

### Cliente (`/app`)

- **Explorar** — mapa + lista com distância, espera, filtros e “Vou agora”
- **Rota do Almoço Rápido** — estimativa ida + fila + refeição + volta
- **Favoritos** e **Histórico**
- **Assistente** — sugestões por chat (Ollama local, se configurado)
- **Feedback** — nota, espera sentida e comentário no lugar
- **Cardápio do dia** — pratos publicados pelo parceiro (com foto, quando houver)
- **Minha conta** — dados, senha, sobre o app e exclusão

### Restaurante (`/parceiro`)

- **Espera e lotação** — níveis / minutos, aberto/fechado, mesas/capacidade e lembrete se a espera ficar velha
- **Ao vivo** — quem tocou em “Vou agora” (contagem anônima)
- **Cardápio do dia** — itens com foto, publicação para o cliente
- **Horários** — funcionamento por dia da semana
- **Feedbacks** — avaliações reais + exemplos
- **Relatório semanal** — cliques, notas e snapshot da casa
- **Minha conta** — mesmos dados do cliente + dados do restaurante (CEP/endereço)

Mapa e locais: **OpenStreetMap** (Overpass / Nominatim — grátis).  
Parceiros publicados entram no Explorar com espera e status reais.

## Como rodar (local)

Precisa de **Node 20+** e um banco **Postgres** (Supabase).

No WSL:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm use 20
```

**1. Backend**

```bash
cd backend
cp .env.example .env   # preencha DATABASE_URL e chaves Supabase
npm install
npm run db:init        # cria tabelas (ou sobe com npm run dev)
npm run dev
```

Na primeira subida o backend cria as tabelas sozinho (`ensureSchema`).  
Fotos do cardápio: com Supabase configurado vão para o Storage; sem isso, em local podem ir para `backend/uploads/`.

**2. Frontend** (outro terminal)

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173  
O Vite faz proxy de `/api`, `/auth` e `/uploads` para o backend (`:3001`).

## Variáveis de ambiente (backend)

Detalhes e exemplos: `backend/.env.example`.

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | URI Postgres do Supabase (preferir pooler **Transaction**, porta 6543) |
| `SUPABASE_URL` | URL do projeto (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (Settings → API) — só no servidor |
| `SUPABASE_MENU_BUCKET` | Bucket de fotos (padrão `menu`) |
| `SESSION_SECRET` | Segredo da sessão |
| `FRONTEND_URL` | Origem liberada no CORS (local: `http://localhost:5173`; prod: `https://filazero-sandy.vercel.app`) |

Na Vercel do **backend**, configure as mesmas variáveis e use `FRONTEND_URL=https://filazero-sandy.vercel.app`.

## Assistente (opcional)

Se tiver **Ollama** rodando localmente, o chat do app pode usar o modelo configurado no backend.  
Sem Ollama, o assistente cai em respostas mock.
