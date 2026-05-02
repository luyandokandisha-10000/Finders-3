import { Router } from "express";
import crypto from "crypto";
import { db, waitlistTable } from "@workspace/db";
import { eq, count, ilike, or, desc } from "drizzle-orm";
import { JoinWaitlistBody, ListWaitlistEntriesQueryParams } from "@workspace/api-zod";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET ?? "fallback-dev-secret";

export function createUnsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(email.toLowerCase()).digest("hex");
}

function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = createUnsubscribeToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
}

router.post("/waitlist", async (req, res) => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, name } = parsed.data;

  try {
    const existing = await db
      .select()
      .from(waitlistTable)
      .where(eq(waitlistTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "This email is already on the waitlist" });
      return;
    }

    await db.insert(waitlistTable).values({ email, name });

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(waitlistTable);

    res.status(201).json({
      success: true,
      message: "You're on the list! We'll notify you when Finders launches.",
      position: Number(total),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to join waitlist");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.get("/waitlist", async (req, res) => {
  try {
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(waitlistTable);

    res.json({ count: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Failed to get waitlist count");
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.get("/waitlist/unsubscribe", async (req, res) => {
  const { email, token } = req.query as { email?: string; token?: string };

  const sendPage = (title: string, heading: string, body: string, isError = false) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title} — Finders</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0A0A0A;color:#E8E8E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#111111;border:1px solid ${isError ? "rgba(239,68,68,0.3)" : "rgba(139,105,20,0.3)"};border-radius:16px;padding:48px 40px;max-width:480px;width:100%;text-align:center}
    .icon{width:56px;height:56px;border-radius:50%;background:${isError ? "rgba(239,68,68,0.15)" : "rgba(139,105,20,0.15)"};display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:24px}
    .brand{font-size:13px;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:20px}
    h1{font-size:22px;font-weight:700;color:#fff;margin-bottom:12px;line-height:1.3}
    p{font-size:15px;color:rgba(232,232,232,0.6);line-height:1.7}
    .divider{height:1px;background:rgba(139,105,20,0.15);margin:28px 0}
    a{color:#C9A84C;text-decoration:none;font-weight:600}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">FINDERS</div>
    <div class="icon">${isError ? "⚠️" : "✓"}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    <div class="divider"></div>
    <p style="font-size:13px">Changed your mind? <a href="/">Rejoin the waitlist</a></p>
  </div>
</body>
</html>`);
  };

  if (!email || !token) {
    sendPage("Invalid Link", "Invalid unsubscribe link", "This link is missing required information. Please use the link from your email.", true);
    return;
  }

  if (!verifyUnsubscribeToken(email, token)) {
    sendPage("Invalid Link", "Invalid unsubscribe link", "This link is not valid or has been tampered with. Please use the original link from your email.", true);
    return;
  }

  try {
    const existing = await db.select().from(waitlistTable).where(eq(waitlistTable.email, email)).limit(1);

    if (existing.length === 0) {
      sendPage("Already Removed", "You're already off the list", "This email address is not on the Finders waitlist.");
      return;
    }

    await db.delete(waitlistTable).where(eq(waitlistTable.email, email));

    req.log.info({ email }, "Unsubscribed from waitlist");
    sendPage(
      "Unsubscribed",
      "You've been removed",
      `<strong style="color:#fff">${email}</strong> has been removed from the Finders waitlist. You won't receive any more emails from us.`
    );
  } catch (err) {
    req.log.error({ err }, "Failed to unsubscribe");
    sendPage("Error", "Something went wrong", "We couldn't process your request. Please try again later.", true);
  }
});

router.get("/waitlist/entries", async (req, res) => {
  const parsed = ListWaitlistEntriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { search, page = 1, limit = 50 } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const whereClause = search
      ? or(
          ilike(waitlistTable.email, `%${search}%`),
          ilike(waitlistTable.name, `%${search}%`)
        )
      : undefined;

    const [entries, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(waitlistTable)
        .where(whereClause)
        .orderBy(desc(waitlistTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(waitlistTable)
        .where(whereClause),
    ]);

    res.json({
      entries: entries.map((e) => ({
        id: e.id,
        email: e.email,
        name: e.name ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
      total: Number(total),
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list waitlist entries");
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.get("/waitlist/export", async (req, res) => {
  try {
    const entries = await db
      .select()
      .from(waitlistTable)
      .orderBy(desc(waitlistTable.createdAt));

    const rows = [
      ["ID", "Name", "Email", "Joined At"],
      ...entries.map((e) => [
        String(e.id),
        e.name ?? "",
        e.email,
        e.createdAt.toISOString(),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="finders-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Failed to export waitlist");
    res.status(500).json({ error: "Something went wrong." });
  }
});

export default router;
