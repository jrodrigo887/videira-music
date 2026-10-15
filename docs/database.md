# Banco de dados (Postgres)

O Videira Music persiste dados em PostgreSQL via Prisma. O host previsto na Vercel é a Neon (Marketplace). Qualquer URL de Postgres funciona: o código não depende de um recurso exclusivo da Neon.

Não há arquivo SQLite. `DATABASE_URL` é a conexão pooled da aplicação. `DIRECT_URL` é a conexão direta, usada só pelas migrations do Prisma.

## Variáveis

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | URL pooled da Neon. O host contém `-pooler`. A query inclui `pgbouncer=true&connection_limit=1`. |
| `DIRECT_URL` | Opcional. URL direta da Neon (host sem `-pooler`), usada pelo Prisma Migrate. Se o host só tiver uma URL, omita ou repita `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | Segredo do Better Auth, com pelo menos 32 caracteres. |
| `BETTER_AUTH_URL` | Origem HTTPS do app, sem path. Exemplo: `https://example.com`. |
| `GOOGLE_CLIENT_ID` | Cliente OAuth Web no Google Cloud. |
| `GOOGLE_CLIENT_SECRET` | Segredo desse cliente. |
| `VIDEIRA_BOOTSTRAP_ADMIN_EMAIL` | E-mail Google do primeiro admin em produção. |

`DEV_LOCALHOST` é só local e é ignorado em produção. Não entra na Vercel. `VIDEIRA_SIMULATED_USER_ID` também é ignorado em produção.

## Desenvolvimento local

1. Copie `.env.example` para `.env`.
2. Aponte `DATABASE_URL` e `DIRECT_URL` para um Postgres (Neon ou outro). O exemplo local está na seção abaixo.
3. Aplique as migrations:

   ```bash
   npm run db:migrate
   ```

4. Se quiser a organização inicial no banco local:

   ```bash
   npm run db:seed
   ```

O seed cria apenas a organização com `slug=default`. Não insere músicas a partir de JSON. O catálogo começa vazio até alguém importar.

### Postgres local com Docker

`npm test` precisa deste Postgres no ar. Na raiz do repositório:

```bash
docker compose up -d
```

O `docker-compose.yml` sobe Postgres 16. A porta publicada no host é **5433** (encaminhada para a 5432 do container). Usuário, senha e database: `videira`, `videira` e `videira`.

Para o app local, `DATABASE_URL` e `DIRECT_URL` apontam para esse database:

```text
DATABASE_URL="postgresql://videira:videira@127.0.0.1:5433/videira"
DIRECT_URL="postgresql://videira:videira@127.0.0.1:5433/videira"
```

Cada suite de teste cria um database próprio nesse servidor e apaga esse database ao terminar.

## Produção (Vercel)

O build roda `prisma generate`, `prisma migrate deploy` e `next build`. Cada comando do Prisma recebe `DIRECT_URL`, e quando essa variável não está definida o build usa `DATABASE_URL` no lugar. Cada deploy aplica as migrations pendentes. O seed não faz parte do deploy.

O seed de produção roda uma vez, manualmente. O Prisma Client lê `DATABASE_URL`. Quando existe uma URL direta separada, o seed aponta para ela:

```bash
DATABASE_URL="$DIRECT_URL" npm run db:seed
```

Quando a Vercel só tem `DATABASE_URL`, rode `npm run db:seed` com essa variável. Isso cria só a organização `default`. Não repita o seed a cada deploy.

### Variáveis na Vercel (Production)

Obrigatória para o banco:

- `DATABASE_URL`

Opcional para o banco:

- `DIRECT_URL` — só quando o host tem uma URL direta separada da pooled. Se a Vercel tiver uma única URL de Postgres, deixe `DIRECT_URL` de fora; o build usa o valor de `DATABASE_URL`. Se as duas existirem e forem a mesma conexão, os valores podem ser iguais.

Demais variáveis:

- `BETTER_AUTH_SECRET` (pelo menos 32 caracteres)
- `BETTER_AUTH_URL` (origem HTTPS do domínio)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VIDEIRA_BOOTSTRAP_ADMIN_EMAIL`

`DEV_LOCALHOST` fica de fora.

### Google OAuth

No cliente OAuth Web, o redirect autorizado é:

```text
https://<domínio>/api/auth/callback/google
```

Esse redirect fica só no domínio de produção. Cada preview da Vercel tem uma URL diferente, e o login Google não completa nessas URLs.

## Scripts

| Script | Uso |
| --- | --- |
| `npm run build` | `prisma generate`, `prisma migrate deploy` e `next build`. `DIRECT_URL` cai para `DATABASE_URL` quando não está definida |
| `npm run db:migrate` | `prisma migrate deploy` (usa `DIRECT_URL`) |
| `npm run db:migrate:dev` | Cria e aplica migrations em desenvolvimento |
| `npm run db:seed` | Só a organização `slug=default`. Em produção, uma vez, contra `DIRECT_URL` |
| `npm run db:studio` | Prisma Studio |
