import { pool } from "./config/database";

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id VARCHAR(255) UNIQUE,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE NOT NULL,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      sender_email VARCHAR(255),
      recipient_email VARCHAR(255) NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TIMESTAMP NOT NULL,
      status VARCHAR(50) DEFAULT 'SCHEDULED',
      sent_at TIMESTAMP,
      failure_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_emails_user_id
      ON emails(user_id);

    CREATE INDEX IF NOT EXISTS idx_emails_status
      ON emails(status);

    CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at
      ON emails(scheduled_at);

    CREATE TABLE IF NOT EXISTS slack_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      slack_team_id VARCHAR(255) NOT NULL,
      slack_team_name VARCHAR(255),
      slack_user_id VARCHAR(255),
      access_token TEXT NOT NULL,
      channel_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ Database tables initialized");
}