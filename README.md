# NOVA

NOVA is a personal assistant app foundation built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and PostgreSQL.


This repository currently contains the project foundation, Auth.js email/password authentication, Telegram habit reminders/reply logging, dynamic habit management, a Telegram expense logging foundation, and the mobile dashboard. AI categorisation and broader business logic are intentionally not implemented yet.

## Tech Stack

- Next.js App Router
- Auth.js / NextAuth credentials authentication
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma ORM
- PostgreSQL
- Docker Compose for the local database

## Requirements

- Node.js 22.12.0 or newer
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

Optionally seed the database with development demo data:

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

Dashboard routes require login. `src/server/dashboard/user.ts` reads the logged-in Auth.js session user and no longer depends on a seeded Victor user.

Available pages:

- `/login`
- `/register`
- `/logout`
- `/dashboard`
- `/today`
- `/habits`
- `/expenses`
- `/weight`
- `/settings`
- `/habits/manage`

## Authentication

NOVA uses Auth.js / NextAuth with email/password credentials and Google sign-in.

Register at:

```bash
http://localhost:3000/register
```

Sign in at:

```bash
http://localhost:3000/login
```

Registration requires:

- `name`
- `email`
- `password`

Passwords are hashed with `bcryptjs` and stored in `User.passwordHash`. Plain text passwords are never stored.

Google sign-in creates a `User` on first login when the Google account email is new. The Google user's name and email are saved, `currency` defaults to `GBP`, and `passwordHash` stays empty.

Protected routes redirect unauthenticated users to `/login`:

- `/dashboard`
- `/today`
- `/habits`
- `/expenses`
- `/weight`
- `/settings`

Set an auth secret in `.env`:

```bash
AUTH_SECRET="generate_a_long_random_secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
GOOGLE_CLIENT_SECRET="your_google_oauth_client_secret"
```

### Google OAuth Setup

Create OAuth credentials in Google Cloud Console:

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID.
5. Choose `Web application`.
6. Add authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://nova.vicstack.uk/api/auth/callback/google
```

7. Copy the client ID and client secret into `.env` locally and into Coolify runtime environment variables in production.

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
Delete blocked because history exists
```

Habit fields:

- `name`
- `code`
- `reminderMessage`
- `icon`
- `colour`
- `reminderTime`
- `retryTimes`
- `validReplies`
- `scheduleDays`
- `active`

Validation rules:

- `name` is required
- `code` is required and unique per user
- `reminderMessage` is required
- `icon` must be one of the configured habit icons
- `colour` must be one of the configured habit colours
- `reminderTime` is required
- `validReplies` must contain at least one reply
- `validReplies` cannot overlap with another habit for the same user
- `scheduleDays` must contain at least one day

The Telegram habit listener, reminder scheduler, `/dashboard`, and `/habits` all read from the database habit records. New active habits work without changing code.

## Database

Local PostgreSQL is configured in `docker-compose.yml`.

The Prisma schema is in `prisma/schema.prisma`.

Environment variables are read by `prisma.config.ts` from `.env`.

Required local environment variables:

```bash
DATABASE_URL="postgresql://nova:nova_password@localhost:5432/nova?schema=public"
AUTH_SECRET="generate_a_long_random_secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
GOOGLE_CLIENT_SECRET="your_google_oauth_client_secret"
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

The seed script is optional for local demo data. It creates a development user and the initial habit definitions:

- Dutasteride
- Walk
- Training
- Magnesium
- Study

Run it with:

```bash
npm run db:seed
```

Demo login after seeding:

```text
victor@example.com
password123
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

When the first valid reply arrives, NOVA saves the Telegram chat ID to the first unclaimed user if `telegramHabitChatId` is empty. A proper Telegram connect flow will be added later.

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

When the first valid expense arrives, NOVA saves the Telegram chat ID to the first unclaimed user if `telegramExpenseChatId` is empty. A proper Telegram connect flow will be added later.

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
- `/today`
- `/habits`
- `/expenses`
- `/weight`
- `/settings`

The dashboard uses the logged-in Auth.js user.

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

## Coolify Deployment With Dockerfile

NOVA uses a Dockerfile-based deployment so Coolify does not need to infer the Node version with Nixpacks.

The production image uses `node:22.13.1-alpine`, installs dependencies with `npm ci`, runs `npx prisma generate`, builds with `npm run build`, exposes port `3000`, and starts with:

```bash
npm run start
```

Build the image locally:

```bash
docker build -t nova-assistant .
```

In Coolify:

1. Set the build pack to `Dockerfile`.
2. Use the repository `Dockerfile`.
3. Set the app port to `3000`.
4. Add runtime environment variables in Coolify, not in the image:

```bash
DATABASE_URL="postgresql://..."
TELEGRAM_HABIT_BOT_TOKEN="your_botfather_token"
TELEGRAM_EXPENSE_BOT_TOKEN="your_expense_botfather_token"
```

Do not commit `.env` or paste secrets into the Dockerfile. `.dockerignore` excludes local environment files from the build context.

The Docker build uses a non-secret placeholder `DATABASE_URL` only while running `next build`, because the Prisma config requires the variable to exist. Coolify must still provide the real `DATABASE_URL` at runtime.

Run production migrations against the Coolify PostgreSQL database from a controlled shell before starting the app after schema changes:

```bash
npx prisma migrate deploy
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
