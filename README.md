# NOVA

NOVA is a personal assistant app foundation built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL.

This repository currently contains the project foundation and development-only Telegram habit reply logging. Scheduled reminders, retry logic, expenses bot, authentication, dashboard pages, AI categorisation, and broader business logic are intentionally not implemented yet.

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

Test the Telegram habit bot connection:

```bash
npm run telegram:habit:test
```

Start the Telegram habit reply listener:

```bash
npm run telegram:habit
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

Required local environment variables:

```bash
DATABASE_URL="postgresql://nova:nova_password@localhost:5432/nova?schema=public"
TELEGRAM_HABIT_BOT_TOKEN="your_botfather_token"
```

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
- Study

Run it with:

```bash
npm run db:seed
```

### Prisma Studio

Open the local database browser with:

```bash
npm run db:studio
```

## Telegram Habit Bot

The habit bot supports reply logging and scheduled reminder sending. It uses polling for development.

### BotFather Setup

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`.
3. Follow the prompts to choose a display name and bot username.
4. Copy the bot token.
5. Add it to `.env`:

```bash
TELEGRAM_HABIT_BOT_TOKEN="your_botfather_token"
```

### Test Bot Connection

```bash
npm run telegram:habit:test
```

This calls Telegram `getMe` and prints the connected bot name.

### Delete Existing Webhook

Polling cannot receive updates while a webhook is configured for the same bot. If Telegram polling does not receive messages, clear the habit bot webhook:

```bash
npm run telegram:habit:delete-webhook
```

This loads `.env` and calls Telegram `deleteWebhook` for `TELEGRAM_HABIT_BOT_TOKEN`.

### Start Reply Listener

```bash
npm run telegram:habit
```

The listener uses Telegram polling via `getUpdates`.

Standalone Telegram scripts load `.env` through Node's `--env-file=.env` flag.

When the first valid reply arrives, NOVA saves the Telegram chat ID to the seeded user if `telegramHabitChatId` is empty.

### Start Reminder Scheduler

```bash
npm run telegram:habit:scheduler
```

The scheduler checks UK local time once per minute. It sends reminders when the current `HH:mm` matches a habit `reminderTime` or one of its `retryTimes`, and only when the current UK day is in `scheduleDays`.

Retry reminders are skipped if the habit already has a `DONE` `HabitLog` for the current UK day.

Every send creates a `ReminderLog` with:

- `userId`
- `habitId`
- `sentAt`
- `scheduledTime`
- `type`

`ReminderLog` prevents the same reminder from being sent twice for the same user, habit, scheduled minute, and reminder type.

### Run Listener And Scheduler Together

```bash
npm run telegram:habit:dev
```

This starts the reply listener and reminder scheduler in the same Node process.

### Test Scheduler Without Waiting

You can run one scheduler pass with a fake UK time and day:

```bash
npm run telegram:habit:scheduler -- --once --time 15:00 --day MON
```

That tests the Study reminder path immediately. To test duplicate prevention, run the same command twice and check that the second run logs that the reminder was already sent.

### Test Replies

Send one of these messages to your habit bot in Telegram:

```text
study
Study
```

`study` or `Study` logs the Study habit. Replies are matched case-insensitively.

The original seeded habits share `done`, `skip`, and `missed`, so those replies are currently ambiguous without scheduled reminder context. The listener warns in the terminal and does not log ambiguous replies.

If the same habit is logged more than once on the same local day, NOVA updates the existing `HabitLog` row instead of creating a duplicate.

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
npm run telegram:habit:test
npm run telegram:habit:delete-webhook
npm run telegram:habit
npm run telegram:habit:scheduler
npm run telegram:habit:dev
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
    db/                 Prisma client setup
    telegram/           Telegram polling scripts
  types/                Shared TypeScript types
prisma/
  schema.prisma         Prisma data model
  seed.ts               Development seed data
docker-compose.yml      Local PostgreSQL service
```
