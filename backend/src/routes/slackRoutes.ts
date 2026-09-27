import {
  Router,
  Request,
  Response,
} from "express";

import { pool } from "../config/database";

import {
  exchangeSlackCode,
} from "../services/slackService";

import {
  requireAuth,
} from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/connect",
  requireAuth,
  (req: Request, res: Response) => {
    const clientId =
      process.env.SLACK_CLIENT_ID;

    const redirectUri =
      process.env.SLACK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).send(
        "Slack OAuth is not configured"
      );
    }

    const state =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}`;

    (req.session as any).slackOAuthState =
      state;

    const params = new URLSearchParams({
      client_id: clientId,
      scope:
        "chat:write chat:write.public",
      redirect_uri: redirectUri,
      state,
    });

    return res.redirect(
      `https://slack.com/oauth/v2/authorize?${params.toString()}`
    );
  }
);

router.get(
  "/callback",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const code =
        String(req.query.code || "");

      const state =
        String(req.query.state || "");

      const expectedState =
        (req.session as any)
          .slackOAuthState;

      if (
        !state ||
        !expectedState ||
        state !== expectedState
      ) {
        return res.status(400).send(
          "Invalid Slack OAuth state"
        );
      }

      delete (req.session as any)
        .slackOAuthState;

      if (!code) {
        return res.status(400).send(
          "Slack authorization code is missing"
        );
      }

      if (!req.isAuthenticated()) {
        return res.status(401).send(
          "Please sign in with Google before connecting Slack"
        );
      }

      const user =
        req.user as {
          id: string;
        };

      const slack =
        await exchangeSlackCode(code);

      const defaultChannelId =
        process.env.SLACK_CHANNEL_ID || null;

      await pool.query(
        `
        INSERT INTO slack_connections
        (
          user_id,
          slack_team_id,
          slack_team_name,
          slack_user_id,
          access_token,
          channel_id
        )
        VALUES
        ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id)
        DO UPDATE SET
          slack_team_id = EXCLUDED.slack_team_id,
          slack_team_name = EXCLUDED.slack_team_name,
          slack_user_id = EXCLUDED.slack_user_id,
          access_token = EXCLUDED.access_token,
          channel_id = EXCLUDED.channel_id,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          user.id,
          slack.teamId,
          slack.teamName,
          slack.slackUserId,
          slack.accessToken,
          defaultChannelId,
        ]
      );

      return res.redirect(
        "http://localhost:5173?slack=connected"
      );
    } catch (error) {
      console.error(
        "❌ Slack OAuth callback failed:",
        error
      );

      return res.status(500).send(
        "Slack connection failed"
      );
    }
  }
);

router.get(
  "/status",
  requireAuth,
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const user =
        req.user as {
          id: string;
        };

      const result =
        await pool.query(
          `
          SELECT
            slack_team_name,
            channel_id,
            created_at,
            updated_at
          FROM slack_connections
          WHERE user_id = $1
          LIMIT 1
          `,
          [user.id]
        );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          connected: false,
        });
      }

      return res.json({
        success: true,
        connected: true,
        slack: {
          teamName:
            result.rows[0]
              .slack_team_name,
          channelId:
            result.rows[0].channel_id,
          connectedAt:
            result.rows[0].created_at,
          updatedAt:
            result.rows[0].updated_at,
        },
      });
    } catch (error) {
      console.error(
        "❌ Slack status check failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to check Slack connection",
      });
    }
  }
);

export default router;