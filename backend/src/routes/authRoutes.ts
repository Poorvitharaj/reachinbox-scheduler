import { Router, Request, Response } from "express";
import passport from "../config/passport";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/login-failed",
  }),
  (_req: Request, res: Response) => {
    res.redirect("http://localhost:5173");
  }
);

router.get("/me", (req, res) => {
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
});

router.get("/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      console.error("❌ Logout error:", error);

      return res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        console.error(
          "❌ Session destroy error:",
          sessionError
        );
      }

      res.redirect("http://localhost:5173");
    });
  });
});

router.get("/login-failed", (_req, res) => {
  res.status(401).json({
    success: false,
    message: "Google authentication failed",
  });
});

export default router;