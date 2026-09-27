import { Router } from "express";

import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getFailedEmails,
} from "../controllers/emailController";

import {
  searchEmails,
} from "../services/elasticsearchService";

import {
  requireAuth,
} from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/schedule",
  requireAuth,
  scheduleEmails
);

router.get(
  "/scheduled",
  requireAuth,
  getScheduledEmails
);

router.get(
  "/sent",
  requireAuth,
  getSentEmails
);

router.get(
  "/failed",
  requireAuth,
  getFailedEmails
);

router.get(
  "/search",
  requireAuth,
  async (req, res) => {
    try {
      const user =
        req.user as {
          id: string;
        };

      const query =
        String(
          req.query.q || ""
        ).trim();

      if (!query) {
        return res.status(400).json({
          success: false,

          message:
            "Search query is required",
        });
      }

      const emails =
        await searchEmails(
          user.id,
          query
        );

      return res.json({
        success: true,

        count:
          emails.length,

        emails,
      });
    } catch (error) {
      console.error(
        "❌ Email search failed:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to search emails",
      });
    }
  }
);

export default router;