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

Test the NOVA Telegram bot connection:

```bash
npm run telegram:nova:test
```

Start the unified NOVA Telegram listener:

```bash
npm run telegram:nova
```

Local Telegram scripts load `.env` with Node's `--env-file=.env` flag.

Start only the web development server:

```bash
npm run dev
```

Open http://localhost:3000.

Start the web app and local Telegram workers together:

```bash
npm run dev:all
```

This runs the web app, NOVA Telegram listener, and habit scheduler with log prefixes:

- `web`
- `nova`
- `scheduler`

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
- `confirm password`

Password accounts require email verification before the `User` record is created. NOVA stores a one-time hashed verification token with the pending name and hashed password, emails the user a verification link, and creates the account only after the link is opened. Tokens expire after 24 hours and are deleted after use.

Passwords are hashed with `bcryptjs` and stored in `User.passwordHash` only after email verification succeeds. Plain text passwords are never stored.

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
RESEND_API_KEY="your_resend_api_key"
EMAIL_FROM="NOVA <hello@your-domain.com>"
```

### Email Verification Setup

NOVA uses Resend for password-account verification emails.

1. Create a Resend account.
2. Add and verify your sending domain, or use Resend's onboarding sender for local testing.
3. Create an API key.
4. Add these variables to `.env` locally and to Coolify runtime environment variables:

```bash
RESEND_API_KEY="your_resend_api_key"
EMAIL_FROM="NOVA <hello@your-domain.com>"
```

The verification link uses `NEXTAUTH_URL`, so set it correctly:

```bash
NEXTAUTH_URL="http://localhost:3000"
```

In production:

```bash
NEXTAUTH_URL="https://nova.vicstack.uk"
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

The NOVA Telegram listener, reminder scheduler, `/dashboard`, and `/habits` all read from the database habit records. New active habits work without changing code.

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
RESEND_API_KEY="your_resend_api_key"
EMAIL_FROM="NOVA <hello@your-domain.com>"
TELEGRAM_BOT_TOKEN="your_botfather_token"
TELEGRAM_BOT_USERNAME="mynovaassistant_bot"
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

## Telegram Account Linking

Every authenticated NOVA user can connect the unified NOVA Telegram assistant from `/settings`.

Flow:

1. Open Settings.
2. In the Connect NOVA Assistant card, click `Connect Telegram`.
3. Click `Connect with Telegram`.
4. Telegram opens automatically. Press `START` to finish connecting.

Connection codes:

- expire after 10 minutes
- are one-time use
- are stored hashed in the database
- never delete existing habit, expense, or weight data

The Settings Telegram card also supports:

- `Disconnect Telegram`
- `Send test message`

Disconnected Telegram chats cannot log habits or expenses until they are linked again.

### Local Telegram Test Flow

Add the unified bot token to `.env`:

```bash
TELEGRAM_BOT_TOKEN="your_botfather_token"
TELEGRAM_BOT_USERNAME="mynovaassistant_bot"
```

Then run the web app and local Telegram workers together:

```bash
npm run dev:all
```

Test the assistant:

1. Open `http://localhost:3000/settings`.
2. Click `Connect Telegram`.
3. Click `Connect with Telegram` and press `START`.
4. Send `Study` and expect `✅ Study logged for today.`
5. Send `15.48 aldi` and expect an expense confirmation.
6. Send `/help` to see examples.

The old `TELEGRAM_HABIT_BOT_TOKEN` and `TELEGRAM_EXPENSE_BOT_TOKEN` variables are still supported as temporary fallbacks for older scripts.

## NOVA Telegram Bot

The unified Telegram bot supports account linking, habit reply logging, expense logging, and help messages. It uses polling for development.

### BotFather Setup

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`.
3. Follow the prompts to choose a display name and bot username.
4. Copy the bot token.
5. Add it to `.env`:

```bash
TELEGRAM_BOT_TOKEN="your_botfather_token"
TELEGRAM_BOT_USERNAME="mynovaassistant_bot"
```

### Test Bot Connection

```bash
npm run telegram:nova:test
```

This calls Telegram `getMe` and prints the connected bot name.

### Delete Existing Webhook

Polling cannot receive updates while a webhook is configured for the same bot. If Telegram polling does not receive messages, clear the habit bot webhook:

```bash
npm run telegram:habit:delete-webhook
```

This loads `.env` and calls Telegram `deleteWebhook` using `TELEGRAM_BOT_TOKEN` or the deprecated habit token fallback.

### Start Reply Listener

```bash
npm run telegram:nova
```

The listener uses Telegram polling via `getUpdates`.

Standalone Telegram scripts load `.env` through Node's `--env-file=.env` flag.

Habit and expense replies only work after the user connects Telegram from Settings.

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

### Test Scheduler Without Waiting

You can run one scheduler pass with a fake UK time and day:

```bash
npm run telegram:habit:scheduler -- --once --time 15:00 --day MON
```

That tests the Study reminder path immediately. To test duplicate prevention, run the same command twice and check that the second run logs that the reminder was already sent.

### Test Replies

Send these messages to the NOVA bot in Telegram:

```text
study
Study
15.48 aldi
5 coffee
-100 salary
/help
```

`study` or `Study` logs the Study habit. Replies are matched case-insensitively.

The original seeded habits share `done`, `skip`, and `missed`, so those replies are currently ambiguous without scheduled reminder context. The listener warns in the terminal and does not log ambiguous replies.

If the same habit is logged more than once on the same local day, NOVA updates the existing `HabitLog` row instead of creating a duplicate.

## Deprecated Separate Telegram Bot Scripts

The older habit-only and expense-only listeners still exist for fallback/local debugging, but production should run `npm run telegram:nova:prod`.

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

Amount: £15.48
Description: aldi
Category: GROCERIES
Date: 12/05/2026
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

For local Telegram testing, use:

```bash
npm run dev:all
```

In production, do not run all processes in one command. Run the web app and each Telegram worker as separate services/processes:

- web app: `npm run start`
- NOVA Telegram listener: `npm run telegram:nova:prod`
- habit scheduler: `npm run telegram:scheduler:prod`

Production scripts do not read a `.env` file. Coolify should inject `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, Auth.js secrets, and other environment variables at runtime.

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
TELEGRAM_BOT_TOKEN="your_botfather_token"
TELEGRAM_BOT_USERNAME="mynovaassistant_bot"
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
npm run dev:all
npm run build
npm run lint
npm run db:validate
npm run db:migrate -- --name describe_the_change
npm run db:generate
npm run db:seed
npm run db:studio
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
