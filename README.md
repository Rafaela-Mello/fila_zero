# FilaZero

Veja o tempo de espera estimado e a lotação de restaurantes próximos **antes** de sair para almoçar.

Projeto de Empreendedorismo — IFSP.

## O que tem

| Rota | O que é |
|------|---------|
| `/` | Landing |
| `/login` | Cadastro, login e Google (opcional) |
| `/app` | App do cliente: Explorar, favoritos, histórico, assistente e Minha conta |
| `/parceiro/cadastro` | Cadastro do restaurante parceiro |
| `/parceiro` | Painel do restaurante |

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

## Como rodar

Precisa de **Node 20+** e **MySQL**.

No WSL:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm use 20
```

**1. Backend**

```bash
cd backend
cp .env.example .env   # ajuste DB_* se precisar
npm install
npm run dev
```

Na primeira subida o backend cria o banco/tabelas sozinho (`ensureSchema`).  
Uploads de foto do cardápio ficam em `backend/uploads/`.

**2. Frontend** (outro terminal)

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173  
O Vite faz proxy de `/api`, `/auth` e `/uploads` para o backend (`:3001`).

## MySQL (WSL + Windows)

Se o Node está no WSL e o MySQL no Windows, `DB_HOST` **não** é `localhost`.  
Use o IP do Windows visto pelo WSL (ex.: `172.23.128.1`) e um usuário com host `%` (ex.: `filazero`).

Detalhes das variáveis: `backend/.env.example`.

## Login com Google (opcional)

Só se quiser o botão “Entrar com Google”:

1. Google Cloud → credencial OAuth **Web**
2. Redirect: `http://localhost:3001/auth/google/callback`
3. Coloque `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`

Cadastro com e-mail/senha funciona sem isso.

## Assistente (opcional)

Se tiver **Ollama** rodando localmente, o chat do app pode usar o modelo configurado no backend.  
Sem Ollama, o assistente cai em respostas mock.
