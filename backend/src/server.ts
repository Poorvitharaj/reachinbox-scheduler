import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";

import { initializeDatabase } from "./database";

import {
  initializeElasticsearch,
} from "./services/elasticsearchService";

import emailRoutes from "./routes/emailRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import authRoutes from "./routes/authRoutes";
import slackRoutes from "./routes/slackRoutes";

import {
  createBullBoard,
} from "@bull-board/api";

import {
  ExpressAdapter,
} from "@bull-board/express";

import {
  BullMQAdapter,
} from "@bull-board/api/bullMQAdapter";

import {
  emailQueue,
} from "./services/emailQueue";

import passport from "./config/passport";

dotenv.config();

const app = express();

app.use(
  cors({
    origin:
      "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "reachinbox-development-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      maxAge:
        24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get(
  "/api/health",
  (_req, res) => {
    res.json({
      success: true,
      message:
        "ReachInbox Scheduler API is running",
    });
  }
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/emails",
  emailRoutes
);

app.use(
  "/api/upload",
  uploadRoutes
);

app.use(
  "/api/slack",
  slackRoutes
);

const serverAdapter =
  new ExpressAdapter();

serverAdapter.setBasePath(
  "/admin/queues"
);

createBullBoard({
  queues: [
    new BullMQAdapter(
      emailQueue
    ),
  ],
  serverAdapter,
});

app.use(
  "/admin/queues",
  serverAdapter.getRouter()
);

const PORT =
  process.env.PORT || 4000;

async function startServer() {
  try {
    await initializeDatabase();

    await initializeElasticsearch();

    app.listen(
      PORT,
      () => {
        console.log(
          `🚀 Server running on http://localhost:${PORT}`
        );

        console.log(
          `📊 Bull Board: http://localhost:${PORT}/admin/queues`
        );

        console.log(
          `🔐 Google Login: http://localhost:4000/api/auth/google`
        );

        console.log(
          `💬 Slack Connect: http://localhost:4000/api/slack/connect`
        );
      }
    );
  } catch (error) {
    console.error(
      "❌ Failed to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();