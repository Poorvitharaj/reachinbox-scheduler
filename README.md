# ReachInbox Email Scheduler

A full-stack email scheduling system built with React, TypeScript, Express, PostgreSQL, Redis, BullMQ, Elasticsearch, Google OAuth, Slack OAuth, and Ethereal SMTP.

## Features

- Google OAuth authentication
- Email campaign scheduling
- Multiple recipients
- CSV recipient upload
- Configurable campaign start time
- Configurable delay between emails
- Configurable hourly email rate limit
- Redis + BullMQ background processing
- Configurable worker concurrency
- Persistent email state in PostgreSQL
- Automatic rescheduling when the hourly rate limit is reached
- Slack notification when the hourly rate limit is reached
- Elasticsearch-powered email search
- Scheduled, sent, and failed email history
- Bull Board queue monitoring
- Ethereal SMTP email delivery
- Job persistence across worker restarts
- Idempotency protection to prevent an already-sent email from being sent again

## Architecture

```text
                         ┌─────────────────────────┐
                         │    React + TypeScript    │
                         │        Frontend         │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   Express + TypeScript  │
                         │          API            │
                         └──────┬─────────┬────────┘
                                │         │
                    ┌───────────┘         └────────────┐
                    ▼                                  ▼
          ┌──────────────────┐              ┌──────────────────┐
          │   PostgreSQL     │              │  Redis + BullMQ  │
          │  Source of Truth │              │    Email Queue   │
          └──────────────────┘              └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │   Email Worker   │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  Ethereal SMTP   │
                                            └──────────────────┘

          ┌──────────────────┐
          │  Elasticsearch   │
          │ Email indexing & │
          │     search       │
          └──────────────────┘

          ┌──────────────────┐
          │      Slack       │
          │ Rate-limit alert │
          └──────────────────┘

          ┌──────────────────┐
          │   Google OAuth   │
          │  Authentication  │
          └──────────────────┘
          ## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Node.js
- Express
- TypeScript
- Passport.js
- Google OAuth
- Express Session

### Data & Infrastructure

- PostgreSQL
- Redis
- BullMQ
- Elasticsearch
- Docker / Docker Compose

### Email & Notifications

- Ethereal SMTP
- Slack OAuth
- Slack Web API

### Monitoring

- Bull Board

## Project Structure

```text
reachinbox-scheduler/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── workers/
│   │   ├── database.ts
│   │   └── server.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Docker Desktop
- Git

## Services

The project uses Docker Compose for the following services:

| Service | Port | Purpose |
|---|---:|---|
| PostgreSQL | 5432 | Persistent application data |
| Redis | 6379 | BullMQ queue and rate limiting |
| Elasticsearch | 9200 | Email indexing and search |

## Environment Configuration

Create the backend environment file:

```text
backend/.env
```

Use `backend/.env.example` as the template.

Example:

```env
PORT=4000

DATABASE_URL=postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox

REDIS_HOST=localhost
REDIS_PORT=6379

ELASTICSEARCH_URL=http://localhost:9200

WORKER_CONCURRENCY=5
DEFAULT_HOURLY_LIMIT=200
DEFAULT_DELAY_MS=2000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

SESSION_SECRET=your_session_secret

SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
SLACK_CHANNEL_ID=your_slack_channel_id
```

**Do not commit the real `.env` file or any OAuth/Slack secrets to GitHub.**

## Start Infrastructure

From the project root:

```bash
docker compose up -d
```

Verify that PostgreSQL, Redis, and Elasticsearch are running:

```bash
docker ps
```

## Backend Setup

Open a terminal and run:

```bash
cd backend
npm install
```

Start the backend:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

## Start the Email Worker

Open another terminal and run:

```bash
cd backend
npx ts-node-dev --respawn --transpile-only src/workers/emailWorker.ts
```

The worker processes scheduled emails from the BullMQ queue.

## Frontend Setup

Open another terminal and run:

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

## Bull Board

Bull Board provides queue monitoring for the email worker.

Open:

```text
http://localhost:4000/admin/queues
```

It can be used to inspect the `emailQueue` and its job states.

## Google OAuth Setup

Configure a Google OAuth application with the callback URL:

```text
http://localhost:4000/api/auth/google/callback
```

Set the following environment variables:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

After authentication, the user is redirected back to the frontend.

## Slack OAuth Setup

Configure the Slack application with the redirect URL:

```text
http://localhost:4000/api/slack/callback
```

Set the following environment variables:

```env
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback
SLACK_CHANNEL_ID=your_slack_channel_id
```

The application uses Slack notifications when the hourly email rate limit is reached.

## Email Scheduling Flow

1. Authenticate using Google OAuth.
2. Create an email campaign.
3. Add recipients manually or upload a CSV file.
4. Configure the campaign start time.
5. Configure the delay between emails.
6. Configure the hourly rate limit.
7. Schedule the campaign.
8. Email records are stored in PostgreSQL.
9. Jobs are added to BullMQ through Redis.
10. The email worker processes the jobs.
11. Emails are delivered through Ethereal SMTP.
12. Email status is updated in PostgreSQL.
13. Email information is indexed in Elasticsearch.
14. Scheduled, sent, and failed emails can be viewed from the dashboard.
15. Elasticsearch can be used to search email records.

## CSV Upload

The application supports recipient CSV uploads.

Example:

```csv
email
recipient1@example.com
recipient2@example.com
recipient3@example.com
```

## Rate Limiting

The email worker supports a configurable hourly email limit.

Example:

```env
DEFAULT_HOURLY_LIMIT=200
```

When the hourly limit is reached:

- The email is not sent immediately.
- The job is rescheduled for the next available hour.
- A Slack notification is sent for the rate-limit event.

## Configurable Delay

The delay between emails can be configured when scheduling a campaign.

Example:

```text
Delay = 2000 ms
```

A delay of `0` is also supported.

## Worker Concurrency

Worker concurrency is configurable using:

```env
WORKER_CONCURRENCY=5
```

This controls the number of BullMQ jobs processed concurrently.

## Persistence and Restart Handling

Email state is persisted in PostgreSQL and jobs are stored in Redis through BullMQ.

Pending jobs remain available when the worker process is restarted.

Before sending an email, the worker checks the persisted PostgreSQL status. If an email is already marked as `SENT`, it is skipped to prevent duplicate delivery.

## Email Statuses

### Scheduled

The email has been scheduled and is waiting to be processed.

### Sent

The email was successfully delivered through the configured SMTP service.

### Failed

The email could not be delivered. The failure reason is stored in PostgreSQL and displayed in the application.

## Elasticsearch Search

Email records are indexed in Elasticsearch.

Search supports:

- Sender
- Recipient
- Subject
- Body
- Status

Search results are scoped to the authenticated user.

## Testing

Backend production build:

```bash
cd backend
npm run build
```

Frontend production build:

```bash
cd frontend
npm run build
```

Both builds should complete successfully without TypeScript errors.

## Useful URLs

| Component | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Bull Board | http://localhost:4000/admin/queues |

## Security

- OAuth credentials are stored in environment variables.
- `.env` is excluded from Git using `.gitignore`.
- Authenticated API routes require an authenticated session.
- User email data is scoped to the authenticated user.
- Real credentials should never be committed to the repository.

## Demo Flow

A typical demonstration can follow this sequence:

1. Open the frontend.
2. Sign in with Google.
3. Upload a recipient CSV or add recipients manually.
4. Configure the email subject, body, start time, delay, and hourly limit.
5. Schedule the campaign.
6. Open the Scheduled section.
7. Observe the worker processing the queue.
8. Show the Sent section after successful delivery.
9. Show the Failed section using a failed delivery record.
10. Open Bull Board to show queue/job processing.
11. Use Search to demonstrate Elasticsearch-powered search.
12. Demonstrate the Slack notification when the hourly limit is reached.

## License

This project was developed as a take-home technical assignment.