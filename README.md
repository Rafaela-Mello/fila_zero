# FilaZero

Veja o tempo de espera estimado e a lotação de restaurantes próximos **antes** de sair para almoçar.

Projeto de Empreendedorismo — IFSP.

## O que tem

| Rota | O que é |
|------|---------|
| `/` | Landing |
| `/login` | Cadastro, login e Google (opcional) |
| `/app` | Mapa, restaurantes perto de você e filtros |

Mapa e locais: **OpenStreetMap** (grátis, sem chave).  
Espera: estimativa do FilaZero (depois os restaurantes poderão atualizar de verdade).

## Como rodar

Precisa de **Node 20+** e **MySQL**.

No WSL:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
```

**1. Backend**

```bash
cd backend
cp .env.example .env   # ajuste DB_* se precisar
npm install
npm run dev
```

Na primeira subida o backend cria o banco/tabelas sozinho.

**2. Frontend** (outro terminal)

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173

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
