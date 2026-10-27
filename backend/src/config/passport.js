import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { query } from "./db.js";

const USER_FIELDS =
  "id, google_id, email, name, avatar_url, COALESCE(role, 'diner') AS role, (password_hash IS NOT NULL AND password_hash <> '') AS has_password";

export function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const rows = await query(
        `SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
        [id]
      );
      done(null, rows[0] || false);
    } catch (err) {
      done(err);
    }
  });

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn(
      "[auth] Google opcional: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env para habilitar 'Entrar com Google'."
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL || "http://localhost:3001/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const name = profile.displayName || null;
          const avatarUrl = profile.photos?.[0]?.value || null;

          if (!email) {
            return done(new Error("Conta Google sem e-mail disponível"));
          }

          const existing = await query(
            `SELECT ${USER_FIELDS} FROM users WHERE google_id = ? OR email = ? LIMIT 1`,
            [googleId, email]
          );

          if (existing[0]) {
            await query(
              "UPDATE users SET google_id = ?, name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?",
              [googleId, name, avatarUrl, existing[0].id]
            );
            const updated = await query(
              `SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
              [existing[0].id]
            );
            return done(null, updated[0]);
          }

          const result = await query(
            "INSERT INTO users (google_id, email, name, avatar_url) VALUES (?, ?, ?, ?)",
            [googleId, email, name, avatarUrl]
          );

          const created = await query(
            `SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
            [result.insertId]
          );
          return done(null, created[0]);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}
