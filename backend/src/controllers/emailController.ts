import { Request, Response } from "express";
import { pool } from "../config/database";
import { emailQueue } from "../services/emailQueue";
import {
  indexEmail,
} from "../services/elasticsearchService";

export async function scheduleEmails(
  req: Request,
  res: Response
) {
  try {
    const {
      senderEmail,
      recipients,
      subject,
      body,
      startTime,
      delayBetweenEmails = 2000,
      hourlyLimit = 200,
    } = req.body;

    const user = req.user as {
      id: string;
      email: string;
      name: string;
    };

    if (
      !recipients ||
      !Array.isArray(recipients) ||
      recipients.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one recipient is required",
      });
    }

    if (
      !subject ||
      !body ||
      !startTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "subject, body and startTime are required",
      });
    }

    const scheduledTime =
      new Date(startTime);

    if (
      isNaN(
        scheduledTime.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid startTime",
      });
    }

    const results = [];

    for (
      let index = 0;
      index < recipients.length;
      index++
    ) {
      const recipient =
        recipients[index];

      const emailResult =
        await pool.query(
          `
          INSERT INTO emails
          (
            user_id,
            sender_email,
            recipient_email,
            subject,
            body,
            scheduled_at,
            status
          )
          VALUES
          ($1, $2, $3, $4, $5, $6, 'SCHEDULED')
          RETURNING
            id,
            user_id,
            sender_email,
            recipient_email,
            subject,
            body,
            scheduled_at,
            status,
            created_at
          `,
          [
            user.id,
            senderEmail ||
              user.email,
            recipient,
            subject,
            body,
            scheduledTime,
          ]
        );

      const email =
        emailResult.rows[0];

      await indexEmail({
        emailId: email.id,

        userId: user.id,

        senderEmail:
          senderEmail ||
          user.email,

        recipientEmail:
          recipient,

        subject,

        body,

        status: "SCHEDULED",

        scheduledAt:
          scheduledTime,

        createdAt:
          email.created_at,
      });

      const delay =
        Math.max(
          0,
          scheduledTime.getTime() -
            Date.now()
        ) +
        index *
          Number(
            delayBetweenEmails
          );

      await emailQueue.add(
        "send-email",
        {
          emailId:
            email.id,

          userId:
            user.id,

          senderEmail:
            senderEmail ||
            user.email,

          recipient,

          subject,

          body,

          hourlyLimit:
            Number(
              hourlyLimit
            ),

          delayBetweenEmails:
            Number(
              delayBetweenEmails
            ),
        },
        {
          jobId:
            email.id,

          delay,

          removeOnComplete:
            false,

          removeOnFail:
            false,
        }
      );

      results.push(email);
    }

    return res.status(201).json({
      success: true,

      message:
        `${results.length} email(s) scheduled successfully`,

      emails: results,
    });
  } catch (error) {
    console.error(
      "❌ Error scheduling emails:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to schedule emails",
    });
  }
}

export async function getScheduledEmails(
  req: Request,
  res: Response
) {
  try {
    const user =
      req.user as {
        id: string;
      };

    const result =
      await pool.query(
        `
        SELECT
          id,
          sender_email,
          recipient_email,
          subject,
          body,
          scheduled_at,
          status,
          created_at
        FROM emails
        WHERE user_id = $1
          AND status IN (
            'SCHEDULED',
            'SENDING'
          )
        ORDER BY scheduled_at ASC
        `,
        [user.id]
      );

    return res.json({
      success: true,
      emails:
        result.rows,
    });
  } catch (error) {
    console.error(
      "❌ Error fetching scheduled emails:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch scheduled emails",
    });
  }
}

export async function getSentEmails(
  req: Request,
  res: Response
) {
  try {
    const user =
      req.user as {
        id: string;
      };

    const result =
      await pool.query(
        `
        SELECT
          id,
          sender_email,
          recipient_email,
          subject,
          body,
          scheduled_at,
          sent_at,
          status,
          created_at
        FROM emails
        WHERE user_id = $1
          AND status = 'SENT'
        ORDER BY sent_at DESC
        `,
        [user.id]
      );

    return res.json({
      success: true,
      emails:
        result.rows,
    });
  } catch (error) {
    console.error(
      "❌ Error fetching sent emails:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch sent emails",
    });
  }
}

export async function getFailedEmails(
  req: Request,
  res: Response
) {
  try {
    const user =
      req.user as {
        id: string;
      };

    const result =
      await pool.query(
        `
        SELECT
          id,
          sender_email,
          recipient_email,
          subject,
          failure_reason,
          scheduled_at,
          updated_at,
          status
        FROM emails
        WHERE user_id = $1
          AND status = 'FAILED'
        ORDER BY updated_at DESC
        `,
        [user.id]
      );

    return res.json({
      success: true,
      emails:
        result.rows,
    });
  } catch (error) {
    console.error(
      "❌ Error fetching failed emails:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch failed emails",
    });
  }
}