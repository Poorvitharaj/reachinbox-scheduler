# ReachInbox Email Scheduler



A full-stack email scheduling system built with React, TypeScript, Express, PostgreSQL, Redis, BullMQ, Elasticsearch, Google OAuth, Slack OAuth, and Ethereal SMTP.



## Features



\- Google OAuth authentication

\- Email campaign scheduling

\- Multiple recipients

\- CSV recipient upload

\- Configurable start time

\- Configurable delay between emails

\- Configurable hourly email rate limit

\- Redis + BullMQ background processing

\- Worker concurrency

\- Persistent email state in PostgreSQL

\- Automatic retry/rescheduling when the hourly limit is reached

\- Slack notification when the hourly rate limit is reached

\- Elasticsearch-powered email search

\- Scheduled, sent, and failed email history

\- Bull Board queue monitoring

\- Ethereal SMTP email delivery

\- Job persistence across worker restarts

\- Idempotency protection to avoid sending an already-sent email again



## Architecture



```text

&#x20;                   ┌─────────────────────┐

&#x20;                   │   React + TypeScript │

&#x20;                   │      Frontend       │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                   ┌─────────────────────┐

&#x20;                   │ Express + TypeScript│

&#x20;                   │       API           │

&#x20;                   └──────┬──────┬───────┘

&#x20;                          │      │

&#x20;               ┌──────────┘      └──────────┐

&#x20;               ▼                             ▼

&#x20;      ┌────────────────┐            ┌────────────────┐

&#x20;      │   PostgreSQL   │            │ Redis + BullMQ │

&#x20;      │ Source of Truth│            │ Email Queue    │

&#x20;      └────────────────┘            └───────┬────────┘

&#x20;                                            │

&#x20;                                            ▼

&#x20;                                   ┌────────────────┐

&#x20;                                   │ Email Worker   │

&#x20;                                   └───────┬────────┘

&#x20;                                           │

&#x20;                                           ▼

&#x20;                                   ┌────────────────┐

&#x20;                                   │ Ethereal SMTP  │

&#x20;                                   └────────────────┘



&#x20;      Elasticsearch

&#x20;             ▲

&#x20;             │

&#x20;      Email indexing/search



&#x20;      Slack

&#x20;         ▲

&#x20;         │

&#x20;   Rate-limit alerts



&#x20;      Google OAuth

&#x20;         │

&#x20;         ▼

&#x20;     Authentication


