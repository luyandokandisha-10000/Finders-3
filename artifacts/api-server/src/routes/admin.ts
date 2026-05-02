import { Router } from "express";
import crypto from "crypto";
import { db, waitlistTable } from "@workspace/db";
import { isNull, desc, eq } from "drizzle-orm";
import { createUnsubscribeToken } from "./waitlist";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD environment variable must be set.");
}

const tokens = new Set<string>();

function requireAdmin(
  req: Parameters<Parameters<typeof router.use>[0]>[0],
  res: Parameters<Parameters<typeof router.use>[0]>[1],
  next: Parameters<Parameters<typeof router.use>[0]>[2]
) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

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
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) tokens.delete(token);
  res.json({ success: true });
});

router.get("/admin/verify", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !tokens.has(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ ok: true });
});

router.get("/admin/notify-status", requireAdmin, async (req, res) => {
  try {
    const all = await db.select().from(waitlistTable).orderBy(desc(waitlistTable.createdAt));
    const unnotified = all.filter((e) => !e.notifiedAt).length;
    res.json({ total: all.length, unnotified, alreadyNotified: all.length - unnotified });
  } catch (err) {
    req.log.error({ err }, "Failed to get notify status");
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.post("/admin/notify", requireAdmin, async (req, res) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    res.status(500).json({ error: "Email service not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." });
    return;
  }

  const { subject, message, notifyAll } = req.body as {
    subject?: string;
    message?: string;
    notifyAll?: boolean;
  };

  const emailSubject = subject?.trim() || "Finders is almost here — you're on the list";
  const emailMessage = message?.trim() || "We're putting the final touches on Finders. Get ready to find your next gig, land your next client, and sell your best work. We'll be in touch very soon.";

  try {
    const entries = notifyAll
      ? await db.select().from(waitlistTable).orderBy(desc(waitlistTable.createdAt))
      : await db.select().from(waitlistTable).where(isNull(waitlistTable.notifiedAt)).orderBy(desc(waitlistTable.createdAt));

    if (entries.length === 0) {
      res.json({ sent: 0, failed: 0, message: "No new recipients to notify." });
      return;
    }

    let sent = 0;
    let failed = 0;
    const now = new Date();

    for (const entry of entries) {
      const firstName = entry.name ? entry.name.split(" ")[0] : "there";
      const unsubscribeToken = createUnsubscribeToken(entry.email);
      const unsubscribeUrl = buildUnsubscribeUrl(entry.email, unsubscribeToken);
      const html = buildEmailHtml(firstName, emailSubject, emailMessage, unsubscribeUrl);

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: entry.email,
            subject: emailSubject,
            html,
          }),
        });

        if (response.ok) {
          sent++;
          await db.update(waitlistTable).set({ notifiedAt: now }).where(eq(waitlistTable.id, entry.id));
        } else {
          const body = await response.text();
          failed++;
          req.log.error({ status: response.status, body, email: entry.email }, "Resend rejected email");
        }
      } catch (emailErr) {
        failed++;
        req.log.error({ emailErr, email: entry.email }, "Error sending email");
      }
    }

    res.json({
      sent,
      failed,
      message: `Sent ${sent} email${sent !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}.`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to notify waitlist");
    res.status(500).json({ error: "Something went wrong." });
  }
});

function buildUnsubscribeUrl(email: string, token: string): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  const base = domains ? `https://${domains}` : "http://localhost:80";
  return `${base}/api/waitlist/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function buildEmailHtml(firstName: string, subject: string, message: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#111111;border:1px solid rgba(139,105,20,0.4);border-radius:12px;padding:12px 28px;">
                    <span style="font-size:20px;font-weight:700;color:#C9A84C;letter-spacing:3px;text-transform:uppercase;">FINDERS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111111;border:1px solid rgba(139,105,20,0.2);border-radius:16px;padding:48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr><td style="height:2px;background-color:#8B6914;border-radius:2px;"></td></tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:13px;color:rgba(232,232,232,0.45);text-transform:uppercase;letter-spacing:1.5px;">Hey ${firstName},</p>
              <h1 style="margin:0 0 24px 0;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.35;">${subject}</h1>
              <p style="margin:0 0 32px 0;font-size:16px;color:rgba(232,232,232,0.72);line-height:1.75;">${message}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr><td style="height:1px;background-color:rgba(139,105,20,0.15);"></td></tr>
              </table>
              <p style="margin:0 0 16px 0;font-size:12px;color:rgba(232,232,232,0.35);text-transform:uppercase;letter-spacing:1.5px;">What Finders gives you</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:#C9A84C;font-weight:600;font-size:15px;">Find Jobs &amp; Gigs</span>
                  <span style="color:rgba(232,232,232,0.5);font-size:14px;"> — Land high-paying opportunities in your field</span>
                </td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:#C9A84C;font-weight:600;font-size:15px;">Sell Your Projects</span>
                  <span style="color:rgba(232,232,232,0.5);font-size:14px;"> — Apps, art, and digital work — all in one marketplace</span>
                </td></tr>
                <tr><td style="padding:10px 0;">
                  <span style="color:#C9A84C;font-weight:600;font-size:15px;">Connect with Clients</span>
                  <span style="color:rgba(232,232,232,0.5);font-size:14px;"> — Build relationships with people who pay well</span>
                </td></tr>
              </table>
              <p style="margin:0;font-size:14px;color:rgba(232,232,232,0.4);line-height:1.7;">Stay tuned — the wait is almost over.<br/><span style="color:#C9A84C;font-weight:600;">The Finders Team</span></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 6px 0;font-size:11px;color:rgba(232,232,232,0.2);">You received this because you joined the Finders waitlist.</p>
              <p style="margin:0;font-size:11px;color:rgba(232,232,232,0.2);">
                Don't want future emails?
                <a href="${unsubscribeUrl}" style="color:rgba(201,168,76,0.6);text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { tokens };
export default router;
