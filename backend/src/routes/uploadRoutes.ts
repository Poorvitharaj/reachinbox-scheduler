import { Router, Request, Response } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";

import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

type CsvRecord = {
  email?: string;
  Email?: string;
  EMAIL?: string;
  recipient?: string;
  Recipient?: string;
  recipient_email?: string;
};

router.post(
  "/recipients",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "CSV file is required",
        });
      }

      const csvText = req.file.buffer.toString("utf-8");

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvRecord[];

      const recipients: string[] = [];

      for (const record of records) {
        const email =
          record.email ||
          record.Email ||
          record.EMAIL ||
          record.recipient ||
          record.Recipient ||
          record.recipient_email;

        if (
          typeof email === "string" &&
          email.trim()
        ) {
          recipients.push(email.trim());
        }
      }

      const uniqueRecipients = [
        ...new Set(recipients),
      ];

      if (uniqueRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No valid email addresses found in the CSV file",
        });
      }

      return res.json({
        success: true,
        count: uniqueRecipients.length,
        recipients: uniqueRecipients,
      });
    } catch (error) {
      console.error(
        "❌ CSV processing failed:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid CSV file. Please provide a CSV with an email column.",
      });
    }
  }
);

export default router;