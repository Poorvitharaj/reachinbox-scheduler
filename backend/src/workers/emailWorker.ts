import { Worker, Job } from "bullmq";
import dotenv from "dotenv";

import { redisConnection } from "../config/redis";
import { sendEmail } from "../services/smtpService";
import { emailQueue } from "../services/emailQueue";
import { pool } from "../config/database";
import { sendSlackNotification } from "../services/slackService";
import { updateEmailStatus } from "../services/elasticsearchService";

dotenv.config();

const WORKER_CONCURRENCY =
  Number(process.env.WORKER_CONCURRENCY) || 5;

const DEFAULT_HOURLY_LIMIT =
  Number(process.env.DEFAULT_HOURLY_LIMIT) || 200;

const DEFAULT_DELAY_MS =
  Number(process.env.DEFAULT_DELAY_MS) || 2000;

function getHourlyRateLimitKey() {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");

  return `email-rate-limit:${year}-${month}-${day}-${hour}`;
}

function getSlackNotificationKey(userId: string) {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");

  return `slack-rate-limit-notified:${userId}:${year}-${month}-${day}-${hour}`;
}

async function checkHourlyLimit(hourlyLimit: number) {
  const key = getHourlyRateLimitKey();

  const count = await redisConnection.incr(key);

  if (count === 1) {
    await redisConnection.expire(key, 3700);
  }

  if (count > hourlyLimit) {
    await redisConnection.decr(key);
    return false;
  }

  return true;
}

function getDelayUntilNextHour() {
  const now = new Date();
  const nextHour = new Date(now);

  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  return Math.max(1000, nextHour.getTime() - now.getTime());
}

async function notifySlackRateLimit(
  userId: string,
  hourlyLimit: number
) {
  try {
    const notificationKey = getSlackNotificationKey(userId);

    const notificationCreated = await redisConnection.set(
      notificationKey,
      "1",
      "EX",
      3700,
      "NX"
    );

    if (notificationCreated !== "OK") {
      return;
    }

    const message =
      `🚦 ReachInbox rate limit reached.\n\n` +
      `Hourly limit: ${hourlyLimit} emails/hour\n` +
      `Additional emails have been rescheduled for the next hour.\n\n` +
      `Time: ${new Date().toISOString()}`;

    await sendSlackNotification(userId, message);
  } catch (error) {
    console.error(
      "❌ Slack rate-limit notification failed:",
      error
    );
  }
}

async function processEmail(job: Job) {
  console.log("📨 Processing email job:", job.id);
  console.log("Email data:", job.data);

  const {
    emailId,
    userId,
    senderEmail,
    recipient,
    subject,
    body,
    hourlyLimit,
    delayBetweenEmails,
  } = job.data;

  const configuredHourlyLimit =
    hourlyLimit === undefined || hourlyLimit === null
      ? DEFAULT_HOURLY_LIMIT
      : Number(hourlyLimit);

  const configuredDelay =
    delayBetweenEmails === undefined ||
    delayBetweenEmails === null
      ? DEFAULT_DELAY_MS
      : Number(delayBetweenEmails);

  try {
    const existingEmail = await pool.query(
      `
      SELECT status
      FROM emails
      WHERE id = $1
      `,
      [emailId]
    );

    if (existingEmail.rows.length === 0) {
      console.log(
        "⚠️ Email record not found:",
        emailId
      );
      return;
    }

    if (existingEmail.rows[0].status === "SENT") {
      console.log(
        "♻️ Email already sent. Skipping duplicate:",
        emailId
      );
      return;
    }

    const allowed = await checkHourlyLimit(
      configuredHourlyLimit
    );

    if (!allowed) {
      const delayUntilNextHour =
        getDelayUntilNextHour();

      console.log(
        `🚦 Hourly limit (${configuredHourlyLimit}) reached.`
      );

      console.log(
        `⏳ Rescheduling ${emailId} for approximately ${
          Math.ceil(delayUntilNextHour / 1000)
        } seconds later.`
      );

      if (userId) {
        await notifySlackRateLimit(
          userId,
          configuredHourlyLimit
        );
      }

      await emailQueue.add(
        "send-email",
        job.data,
        {
          jobId: `${emailId}-retry-${Date.now()}`,
          delay: delayUntilNextHour,
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      await pool.query(
        `
        UPDATE emails
        SET
          status = 'SCHEDULED',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [emailId]
      );

      return;
    }

    await pool.query(
      `
      UPDATE emails
      SET
        status = 'SENDING',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [emailId]
    );

    if (configuredDelay > 0) {
      console.log(
        `⏱️ Waiting ${configuredDelay}ms before sending ${emailId}`
      );

      await new Promise<void>((resolve) =>
        setTimeout(resolve, configuredDelay)
      );
    }

    const result = await sendEmail(
      senderEmail,
      recipient,
      subject,
      body
    );

    const sentAt = new Date();

    await pool.query(
      `
      UPDATE emails
      SET
        status = 'SENT',
        sent_at = $2,
        updated_at = CURRENT_TIMESTAMP,
        failure_reason = NULL
      WHERE id = $1
      `,
      [emailId, sentAt]
    );

    await updateEmailStatus(
      emailId,
      "SENT",
      sentAt
    );

    console.log(
      "✅ Email marked as SENT:",
      emailId
    );

    if (result.previewUrl) {
      console.log(
        "🔗 Preview URL:",
        result.previewUrl
      );
    }

    return result;
  } catch (error) {
    console.error(
      "❌ Email sending failed:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown email sending error";

    await pool.query(
      `
      UPDATE emails
      SET
        status = 'FAILED',
        failure_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [emailId, errorMessage]
    );

    await updateEmailStatus(
      emailId,
      "FAILED"
    );

    throw error;
  }
}

const worker = new Worker(
  "emailQueue",
  processEmail,
  {
    connection: redisConnection,
    concurrency: WORKER_CONCURRENCY,
  }
);

worker.on("completed", (job) => {
  console.log(
    `✅ Job ${job.id} completed`
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `❌ Job ${job?.id} failed:`,
    error
  );
});

console.log(
  `👷 Email worker started with concurrency ${WORKER_CONCURRENCY}`
);

console.log(
  `🚦 Default hourly limit: ${DEFAULT_HOURLY_LIMIT}`
);

console.log(
  `⏱️ Default delay: ${DEFAULT_DELAY_MS}ms`
);