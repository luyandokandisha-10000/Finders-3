import { Router } from "express";
import crypto from "crypto";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD environment variable must be set.");
}

const tokens = new Set<string>();

router.post("/admin/login", (req, res) => {
  const { password } = req.body as { password?: string };

  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  tokens.add(token);

  res.json({ token });
});

router.post("/admin/logout", (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "");
  if (token) tokens.delete(token);
  res.json({ success: true });
});

router.get("/admin/verify", (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "");
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ ok: true });
});

export { tokens };
export default router;
