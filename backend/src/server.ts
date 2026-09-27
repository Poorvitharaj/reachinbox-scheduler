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

/* =========================
   CORS
========================= */

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
    credentials: true,
  })
);

/* =========================
   JSON
========================= */

app.use(express.json());

/* =========================
   TRUST PROXY
========================= */

app.set("trust proxy", 1);

/* =========================
   SESSION
========================= */

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "reachinbox-development-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      maxAge:
        24 * 60 * 60 * 1000,
    },
  })
);

/* =========================
   PASSPORT
========================= */

app.use(passport.initialize());
app.use(passport.session());

/* =========================
   HEALTH CHECK
========================= */

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

/* =========================
   ROUTES
========================= */

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

/* =========================
   BULL BOARD
========================= */

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

/* =========================
   PORT
========================= */

const PORT = Number(process.env.PORT) || 4000;

/* =========================
   START SERVER
========================= */

async function startServer() {
  try {
    await initializeDatabase();

    await initializeElasticsearch();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `🚀 Server running on port ${PORT}`
        );

        console.log(
          `📊 Bull Board available at /admin/queues`
        );

        console.log(
          `🔐 Google Login available at /api/auth/google`
        );

        console.log(
          `💬 Slack Connect available at /api/slack/connect`
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