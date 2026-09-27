import { Router, Request, Response } from "express";
import passport from "../config/passport";

const router = Router();

/**
 * Start Google OAuth login.
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
    ],
  })
);

/**
 * Google OAuth callback.
 */
router.get(
  "/google/callback",
  passport.authenticate(
    "google",
    {
      failureRedirect:
        "/api/auth/login-failed",
    }
  ),
  (_req: Request, res: Response) => {
    res.redirect(
      "http://localhost:5173"
    );
  }
);

/**
 * Get the currently authenticated user.
 */
router.get(
  "/me",
  (
    req: Request,
    res: Response
  ) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    return res.json({
      success: true,
      user: req.user,
    });
  }
);

/**
 * Logout.
 */
router.get(
  "/logout",
  (
    req: Request,
    res: Response
  ) => {
    req.logout((error) => {
      if (error) {
        console.error(
          "❌ Logout error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Logout failed",
        });
      }

      req.session.destroy(
        (sessionError) => {
          if (sessionError) {
            console.error(
              "❌ Session destroy error:",
              sessionError
            );
          }

          res.redirect(
            "http://localhost:5173"
          );
        }
      );
    });
  }
);

/**
 * OAuth failure endpoint.
 */
router.get(
  "/login-failed",
  (_req, res) => {
    res.status(401).json({
      success: false,
      message:
        "Google authentication failed",
    });
  }
);

export default router;