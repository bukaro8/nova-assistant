# NOVA

NOVA is a personal assistant app foundation built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL.

This repository currently contains the project foundation, Telegram habit reminders/reply logging, dynamic habit management, a Telegram expense logging foundation, and the first mobile dashboard. Authentication, AI categorisation, and broader business logic are intentionally not implemented yet.

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

Test the Telegram expense bot connection:

```bash
npm run telegram:expense:test
```

Start the Telegram expense listener:

```bash
npm run telegram:expense
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Dashboard

The app currently runs in Victor-only mode. `src/server/dashboard/user.ts` returns the development user from the database; this is the boundary Auth.js can replace later.

Available pages:

- `/dashboard`
- `/habits`
- `/expenses`
- `/weight`
- `/settings`
- `/habits/manage`

## Habit Management

Habits are managed from the Habits tab:

```bash
http://localhost:3000/habits/manage
```

From this page you can:

- Add a habit
- Edit a habit
- Enable or disable a habit with `active`
- Delete a habit only when it has no `HabitLog` or `ReminderLog` history

If a habit already has history, NOVA keeps the data and shows:

```text
This habit has history. Disable it instead.
```

Habit fields:

- `name`
- `code`
- `reminderMessage`
- `reminderTime`
- `retryTimes`
- `validReplies`
- `scheduleDays`
- `active`

Validation rules:

- `name` is required
- `code` is required and unique per user
- `reminderMessage` is required
- `reminderTime` is required
- `validReplies` must contain at least one reply
- `scheduleDays` must contain at least one day

The Telegram habit listener, reminder scheduler, `/dashboard`, and `/habits` all read from the database habit records. New active habits work without changing code.

## Database

Local PostgreSQL is configured in `docker-compose.yml`.

The Prisma schema is in `prisma/schema.prisma`.

Environment variables are read by `prisma.config.ts` from `.env`.

Required local environment variables:

```bash
DATABASE_URL="postgresql://nova:nova_password@localhost:5432/nova?schema=public"
TELEGRAM_HABIT_BOT_TOKEN="your_botfather_token"
TELEGRAM_EXPENSE_BOT_TOKEN="your_expense_botfather_token"
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

## Telegram Expense Bot

The expense bot supports Telegram polling and rule-based expense parsing. It does not use AI categorisation yet.

### BotFather Setup

Create a second Telegram bot with `@BotFather`, then add its token to `.env`:

```bash
TELEGRAM_EXPENSE_BOT_TOKEN="your_expense_botfather_token"
```

### Test Bot Connection

```bash
npm run telegram:expense:test
```

This calls Telegram `getMe` for `TELEGRAM_EXPENSE_BOT_TOKEN`.

### Start Expense Listener

```bash
npm run telegram:expense
```

When the first valid expense arrives, NOVA saves the Telegram chat ID to the seeded user if `telegramExpenseChatId` is empty.

### Expense Message Formats

```text
15.48 aldi
15.48 aldi 01/05/2026
5 coffee
20 tesco
-100 salary
```

Rules:

- The first value is the amount.
- The last value can be an optional `DD/MM/YYYY` date.
- If no date is provided, NOVA uses today's UK date.
- The original message is stored in `rawText`.
- Negative amounts are categorised as `INCOME`.

### Rule Categories

- Groceries: `aldi`, `tesco`, `sainsbury`, `lidl`, `asda`, `morrisons`
- Food: `coffee`, `restaurant`, `takeaway`, `mcdonalds`, `subway`, `kfc`
- Transport: `uber`, `train`, `bus`, `petrol`, `fuel`
- Shopping: `amazon`, `ebay`, `paypal`
- Sands: `totalenergies`
- Default: `OTHER`

After saving, the bot replies with a confirmation like:

```text
✅ Expense saved

£15.48
Aldi
Category: Groceries
Date: 11/05/2026
```

Invalid messages receive:

```text
❌ Invalid format

Try:
15.48 aldi
15.48 aldi 01/05/2026
```

## Dashboard

The first mobile-first dashboard lives in the App Router and uses server-rendered database reads.

Routes:

- `/dashboard`
- `/habits`
- `/expenses`
- `/weight`
- `/settings`

The dashboard uses the first seeded user until authentication is added.

Run locally:

```bash
npm run dev
```

Then open http://localhost:3000/dashboard.

Current dashboard scope:

- Real habit completion count for today
- Real weekly expense total
- Current week spending chart
- Latest expenses list
- Today's habits with a `Mark Done` action
- Simple weight log form
- Settings placeholder

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
npm run dev
npm run telegram:expense:test
npm run telegram:expense
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
