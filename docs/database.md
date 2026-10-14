# Banco de dados (SQLite)

O Videira Music persiste músicas e cifras em SQLite no servidor via Prisma. A URL do banco vem **somente** de `DATABASE_URL`.

## Desenvolvimento local

1. Copie `.env.example` para `.env` e ajuste se necessário:

   ```bash
   DATABASE_URL="file:./prisma/dev.db"
   ```

2. Aplique migrations e popule o catálogo seed:

   ```bash
   npm run db:migrate:dev   # ou db:migrate em CI/produção
   npm run db:seed
   ```

3. Inicie o app (`npm run dev`). A biblioteca lê `/api/songs`; o seed garante as 63 músicas de `data/musicas.json` na organização `default`.

Rodar o seed de novo **não sobrescreve** músicas já editadas — só insere IDs ausentes.

## Deploy

- Use **volume persistente** para o arquivo SQLite (container/VPS) ou **Turso/libSQL** com adapter Prisma.
- **Serverless com filesystem efêmero não é suportado** — cada cold start perderia o banco.
- Antes de deploy público, entregue também a feature `import-access` (gate nas escritas de cifras com `origin`).

## Scripts

| Script | Uso |
| --- | --- |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:migrate:dev` | Cria/aplica migrations em dev |
| `npm run db:seed` | Organização Videira + catálogo |
| `npm run db:studio` | Prisma Studio |

## Migração do IndexedDB

Na primeira carga da biblioteca, dados locais antigos são enviados em lotes para `POST /api/migrations/local-data`. O marcador `videira-music:indexeddb-migration` no `localStorage` evita repetir a leitura do IndexedDB.
