import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { pool } from "./database";
import dotenv from "dotenv";

dotenv.config();

const googleClientId =
  process.env.GOOGLE_CLIENT_ID;

const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET;

const googleCallbackUrl =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:4000/api/auth/google/callback";

/**
 * Only configure Google OAuth when credentials
 * are available.
 *
 * This allows the backend to start while we are
 * setting up the Google Cloud credentials.
 */
if (
  googleClientId &&
  googleClientSecret
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
      },

      async (
        _accessToken,
        _refreshToken,
        profile,
        done
      ) => {
        try {
          const googleId = profile.id;

          const email =
            profile.emails?.[0]?.value;

          const name =
            profile.displayName ||
            "Google User";

          const avatar =
            profile.photos?.[0]?.value ||
            null;

          if (!email) {
            return done(
              new Error(
                "Google account does not provide an email address"
              )
            );
          }

          /**
           * Check whether the user already exists.
           */
          const existingUser =
            await pool.query(
              `
              SELECT
                id,
                google_id,
                name,
                email,
                avatar
              FROM users
              WHERE google_id = $1
                 OR email = $2
              LIMIT 1
              `,
              [
                googleId,
                email,
              ]
            );

          if (
            existingUser.rows.length > 0
          ) {
            const user =
              existingUser.rows[0];

            /**
             * Update Google profile information.
             */
            await pool.query(
              `
              UPDATE users
              SET
                google_id = $1,
                name = $2,
                avatar = $3
              WHERE id = $4
              `,
              [
                googleId,
                name,
                avatar,
                user.id,
              ]
            );

            return done(null, {
              id: user.id,
              googleId,
              name,
              email,
              avatar,
            });
          }

          /**
           * Create a new user.
           */
          const newUser =
            await pool.query(
              `
              INSERT INTO users
              (
                google_id,
                name,
                email,
                avatar
              )
              VALUES ($1, $2, $3, $4)
              RETURNING
                id,
                google_id,
                name,
                email,
                avatar
              `,
              [
                googleId,
                name,
                email,
                avatar,
              ]
            );

          const user =
            newUser.rows[0];

          return done(null, {
            id: user.id,
            googleId,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          });
        } catch (error) {
          console.error(
            "❌ Google authentication error:",
            error
          );

          return done(error);
        }
      }
    )
  );

  console.log(
    "🔐 Google OAuth strategy configured"
  );
} else {
  console.log(
    "⚠️ Google OAuth credentials not configured yet"
  );
}

/**
 * Store authenticated user's database ID
 * in the session.
 */
passport.serializeUser(
  (user: any, done) => {
    done(null, user.id);
  }
);

/**
 * Restore the authenticated user from PostgreSQL.
 */
passport.deserializeUser(
  async (
    id: string,
    done
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            google_id,
            name,
            email,
            avatar
          FROM users
          WHERE id = $1
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {
        return done(
          null,
          false
        );
      }

      return done(
        null,
        result.rows[0]
      );
    } catch (error) {
      return done(error);
    }
  }
);

export default passport;