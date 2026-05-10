# NOVA

NOVA is a personal assistant app foundation built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL.

This repository currently contains only the project foundation. Telegram bots, authentication, dashboard pages, AI categorisation, and business logic are intentionally not implemented yet.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma ORM
- PostgreSQL
- Docker Compose for the local database

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop or a compatible Docker runtime

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Start PostgreSQL:

```bash
docker compose up -d
```

Validate the Prisma schema:

```bash
npm run db:validate
```

Create and apply a database migration:

```bash
npm run db:migrate -- --name migration_name
```

Generate the Prisma client:

```bash
npm run db:generate
```

Seed the database with development data:

```bash
npm run db:seed
```

Open Prisma Studio:

```bash
npm run db:studio
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Database

Local PostgreSQL is configured in `docker-compose.yml`.

The Prisma schema is in `prisma/schema.prisma`.

Environment variables are read by `prisma.config.ts` from `.env`.

### Migrations

Use Prisma migrations for schema changes:

```bash
npm run db:migrate -- --name describe_the_change
```

This applies the migration locally and regenerates the Prisma client.

### Seed Data

The seed script is `prisma/seed.ts`. It creates a development user and the initial habit definitions:

- Dutasteride
- Walk
- Training
- Magnesium

Run it with:

```bash
npm run db:seed
```

### Prisma Studio

Open the local database browser with:

```bash
npm run db:studio
```

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:validate
npm run db:migrate -- --name describe_the_change
npm run db:generate
npm run db:seed
npm run db:studio
docker compose up -d
docker compose down
```

## Current Folder Structure

```text
src/
  app/                  Next.js App Router routes
  components/ui/        shadcn/ui components
  features/
    expenses/           Future expense tracking feature code
    habits/             Future habit reminder feature code
    weight/             Future weight logging feature code
  hooks/                Shared React hooks
  lib/                  Shared utilities
  server/               Future server-only helpers
  types/                Shared TypeScript types
prisma/
  schema.prisma         Prisma data model
  seed.ts               Development seed data
docker-compose.yml      Local PostgreSQL service
```
