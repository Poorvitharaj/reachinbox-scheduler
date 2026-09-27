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

/**
 * Creates a Redis key representing the current UTC hour.
 *
 * Example:
 * email-rate-limit:2026-09-27-08
 */
function getHourlyRateLimitKey() {
  const now = new Date();

  const year = now.getUTCFullYear();

  const month = String(
    now.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getUTCDate()
  ).padStart(2, "0");

  const hour = String(
    now.getUTCHours()
  ).padStart(2, "0");

  return `email-rate-limit:${year}-${month}-${day}-${hour}`;
}

/**
 * Creates a Redis key used to make sure we don't
 * repeatedly send the same Slack rate-limit notification
 * during the same hour.
 */
function getSlackNotificationKey(
  userId: string
) {
  const now = new Date();

  const year = now.getUTCFullYear();

  const month = String(
    now.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getUTCDate()
  ).padStart(2, "0");

  const hour = String(
    now.getUTCHours()
  ).padStart(2, "0");

  return `slack-rate-limit-notified:${userId}:${year}-${month}-${day}-${hour}`;
}

/**
 * Checks whether another email can be sent
 * within the configured hourly limit.
 */
async function checkHourlyLimit(
  hourlyLimit: number
) {
  const key =
    getHourlyRateLimitKey();

  const count =
    await redisConnection.incr(key);

  if (count === 1) {
    await redisConnection.expire(
      key,
      3700
    );
  }

  if (count > hourlyLimit) {
    await redisConnection.decr(
      key
    );

    return false;
  }

  return true;
}

/**
 * Calculates the delay until the beginning
 * of the next UTC hour.
 */
function getDelayUntilNextHour() {
  const now = new Date();

  const nextHour =
    new Date(now);

  nextHour.setUTCMinutes(
    0,
    0,
    0
  );

  nextHour.setUTCHours(
    nextHour.getUTCHours() + 1
  );

  return Math.max(
    1000,
    nextHour.getTime() -
      now.getTime()
  );
}

/**
 * Sends a Slack notification when the hourly
 * email rate limit has been reached.
 *
 * Only one notification is sent per user
 * per UTC hour.
 */
async function notifySlackRateLimit(
  userId: string,
  hourlyLimit: number
) {
  try {
    const notificationKey =
      getSlackNotificationKey(
        userId
      );

    const notificationCreated =
      await redisConnection.set(
        notificationKey,
        "1",
        "EX",
        3700,
        "NX"
      );

    if (
      notificationCreated !==
      "OK"
    ) {
      return;
    }

    const message =
      `🚦 ReachInbox rate limit reached.\n\n` +
      `Hourly limit: ${hourlyLimit} emails/hour\n` +
      `Additional emails have been rescheduled for the next hour.\n\n` +
      `Time: ${new Date().toISOString()}`;

    await sendSlackNotification(
      userId,
      message
    );
  } catch (error) {
    console.error(
      "❌ Slack rate-limit notification failed:",
      error
    );
  }
}

/**
 * Processes one email job from BullMQ.
 */
async function processEmail(
  job: Job
) {
  console.log(
    "📨 Processing email job:",
    job.id
  );

  console.log(
    "Email data:",
    job.data
  );

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

  /**
   * Only use the default hourly limit when
   * the job did not provide one.
   */
  const configuredHourlyLimit =
    hourlyLimit === undefined ||
    hourlyLimit === null
      ? DEFAULT_HOURLY_LIMIT
      : Number(hourlyLimit);

  /**
   * IMPORTANT:
   *
   * Do NOT use:
   *
   * Number(delayBetweenEmails) || DEFAULT_DELAY_MS
   *
   * because 0 is a valid delay value and
   * JavaScript treats 0 as false.
   *
   * With this implementation:
   *
   * undefined/null → default 2000ms
   * 0              → 0ms
   * 1000           → 1000ms
   * 5000           → 5000ms
   */
  const configuredDelay =
    delayBetweenEmails === undefined ||
    delayBetweenEmails === null
      ? DEFAULT_DELAY_MS
      : Number(delayBetweenEmails);

  try {
    /**
     * Check that the email still exists
     * in PostgreSQL.
     */
    const existingEmail =
      await pool.query(
        `
        SELECT status
        FROM emails
        WHERE id = $1
        `,
        [emailId]
      );

    if (
      existingEmail.rows.length ===
      0
    ) {
      console.log(
        "⚠️ Email record not found:",
        emailId
      );

      return;
    }

    /**
     * Idempotency protection.
     *
     * If the email was already sent,
     * don't send it again.
     */
    if (
      existingEmail.rows[0]
        .status === "SENT"
    ) {
      console.log(
        "♻️ Email already sent. Skipping duplicate:",
        emailId
      );

      return;
    }

    /**
     * Check the hourly rate limit
     * before sending.
     */
    const allowed =
      await checkHourlyLimit(
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
          Math.ceil(
            delayUntilNextHour /
              1000
          )
        } seconds later.`
      );

      /**
       * Notify Slack once per user
       * during the current hour.
       */
      if (userId) {
        await notifySlackRateLimit(
          userId,
          configuredHourlyLimit
        );
      }

      /**
       * Re-add the email to BullMQ
       * for the next hour.
       */
      await emailQueue.add(
        "send-email",
        job.data,
        {
          jobId: `${emailId}-retry-${Date.now()}`,
          delay:
            delayUntilNextHour,
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      /**
       * Keep the email in the
       * scheduled state.
       */
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

    /**
     * Mark email as currently being sent.
     */
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

    /**
     * Apply the configured delay.
     *
     * A delay of 0 means:
     *
     * configuredDelay = 0
     *
     * and therefore no artificial wait.
     */
    if (
      configuredDelay > 0
    ) {
      console.log(
        `⏱️ Waiting ${configuredDelay}ms before sending ${emailId}`
      );

      await new Promise<void>(
        (resolve) =>
          setTimeout(
            resolve,
            configuredDelay
          )
      );
    } else {
      console.log(
        `⚡ No delay configured for ${emailId}`
      );
    }

    /**
     * Send the actual email through
     * Ethereal SMTP.
     */
    const result =
      await sendEmail(
        senderEmail,
        recipient,
        subject,
        body
      );

    const sentAt =
      new Date();

    /**
     * Persist SENT status in PostgreSQL.
     */
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
      [
        emailId,
        sentAt,
      ]
    );

    /**
     * Synchronize the status with
     * Elasticsearch.
     */
    await updateEmailStatus(
      emailId,
      "SENT",
      sentAt
    );

    console.log(
      "✅ Email marked as SENT:",
      emailId
    );

    /**
     * Display the Ethereal preview URL
     * when available.
     */
    if (
      result.previewUrl
    ) {
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

    /**
     * Persist FAILED status in PostgreSQL.
     */
    await pool.query(
      `
      UPDATE emails
      SET
        status = 'FAILED',
        failure_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [
        emailId,
        errorMessage,
      ]
    );

    /**
     * Synchronize FAILED status
     * with Elasticsearch.
     */
    await updateEmailStatus(
      emailId,
      "FAILED"
    );

    /**
     * Re-throw the error so BullMQ
     * records the job as failed.
     */
    throw error;
  }
}

/**
 * BullMQ email worker.
 */
const worker =
  new Worker(
    "emailQueue",
    processEmail,
    {
      connection:
        redisConnection,

      concurrency:
        WORKER_CONCURRENCY,
    }
  );

/**
 * Worker completed event.
 */
worker.on(
  "completed",
  (job) => {
    console.log(
      `✅ Job ${job.id} completed`
    );
  }
);

/**
 * Worker failed event.
 */
worker.on(
  "failed",
  (job, error) => {
    console.error(
      `❌ Job ${job?.id} failed:`,
      error
    );
  }
);

console.log(
  `👷 Email worker started with concurrency ${WORKER_CONCURRENCY}`
);

console.log(
  `🚦 Default hourly limit: ${DEFAULT_HOURLY_LIMIT}`
);

console.log(
  `⏱️ Default delay: ${DEFAULT_DELAY_MS}ms`
);