import { Router } from "express";
import crypto from "crypto";
import { db, waitlistTable } from "@workspace/db";
import { eq, count, ilike, or, desc, asc, isNotNull } from "drizzle-orm";
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

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

router.post("/waitlist", async (req, res) => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, name, referredBy } = parsed.data as { email: string; name?: string; referredBy?: string };

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

    // Validate referral code if provided
    let validReferredBy: string | null = null;
    if (referredBy) {
      const refEntry = await db
        .select({ referralCode: waitlistTable.referralCode })
        .from(waitlistTable)
        .where(eq(waitlistTable.referralCode, referredBy.toUpperCase()))
        .limit(1);
      if (refEntry.length > 0) {
        validReferredBy = refEntry[0].referralCode;
      }
    }

    // Generate a unique referral code (retry on collision)
    let referralCode = generateReferralCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await db
        .select({ id: waitlistTable.id })
        .from(waitlistTable)
        .where(eq(waitlistTable.referralCode, referralCode))
        .limit(1);
      if (collision.length === 0) break;
      referralCode = generateReferralCode();
    }

    await db.insert(waitlistTable).values({
      email,
      name,
      referralCode,
      referredBy: validReferredBy ?? undefined,
    });

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(waitlistTable);

    // Compute effective position based on referral ranking
    const position = await computePosition(referralCode);

    res.status(201).json({
      success: true,
      message: "You're on the list! We'll notify you when Finders launches.",
      position,
      referralCode,
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

router.get("/waitlist/referral/:code", async (req, res) => {
  const code = req.params.code?.toUpperCase();
  if (!code) {
    res.status(400).json({ error: "Code is required." });
    return;
  }

  try {
    const entry = await db
      .select({ referralCode: waitlistTable.referralCode })
      .from(waitlistTable)
      .where(eq(waitlistTable.referralCode, code))
      .limit(1);

    if (entry.length === 0) {
      res.status(404).json({ error: "Referral code not found." });
      return;
    }

    const [{ value: totalSignups }] = await db.select({ value: count() }).from(waitlistTable);
    const [{ value: referralCount }] = await db
      .select({ value: count() })
      .from(waitlistTable)
      .where(eq(waitlistTable.referredBy, code));

    const position = await computePosition(code);

    res.json({
      referralCount: Number(referralCount),
      position,
      totalSignups: Number(totalSignups),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get referral stats");
    res.status(500).json({ error: "Something went wrong." });
  }
});

async function computePosition(referralCode: string): Promise<number> {
  // Get all entries sorted by oldest first for tie-breaking
  const allEntries = await db
    .select({ id: waitlistTable.id, referralCode: waitlistTable.referralCode, createdAt: waitlistTable.createdAt })
    .from(waitlistTable)
    .orderBy(asc(waitlistTable.createdAt));

  // Count referrals per referral code
  const allReferred = await db
    .select({ referredBy: waitlistTable.referredBy })
    .from(waitlistTable)
    .where(isNotNull(waitlistTable.referredBy));

  const refCounts = new Map<string, number>();
  for (const r of allReferred) {
    if (r.referredBy) {
      refCounts.set(r.referredBy, (refCounts.get(r.referredBy) ?? 0) + 1);
    }
  }

  // Sort by (referralCount DESC, createdAt ASC)
  const sorted = allEntries
    .map((e) => ({ referralCode: e.referralCode, count: refCounts.get(e.referralCode) ?? 0, createdAt: e.createdAt }))
    .sort((a, b) => b.count - a.count || a.createdAt.getTime() - b.createdAt.getTime());

  const idx = sorted.findIndex((e) => e.referralCode === referralCode);
  return idx === -1 ? sorted.length : idx + 1;
}

router.get("/waitlist/leaderboard", async (req, res) => {
  const limitParam = parseInt((req.query.limit as string) ?? "10", 10);
  const limit = Math.min(Math.max(limitParam || 10, 1), 50);

  try {
    // Get all entries
    const allEntries = await db
      .select({ name: waitlistTable.name, referralCode: waitlistTable.referralCode, createdAt: waitlistTable.createdAt })
      .from(waitlistTable)
      .orderBy(asc(waitlistTable.createdAt));

    // Count referrals per code
    const allReferred = await db
      .select({ referredBy: waitlistTable.referredBy })
      .from(waitlistTable)
      .where(isNotNull(waitlistTable.referredBy));

    const refCounts = new Map<string, number>();
    for (const r of allReferred) {
      if (r.referredBy) {
        refCounts.set(r.referredBy, (refCounts.get(r.referredBy) ?? 0) + 1);
      }
    }

    // Sort by referralCount DESC, then createdAt ASC
    const sorted = allEntries
      .map((e) => ({ name: e.name, referralCode: e.referralCode, count: refCounts.get(e.referralCode) ?? 0 }))
      .sort((a, b) => b.count - a.count || 0)
      .filter((e) => e.count > 0)
      .slice(0, limit);

    const entries = sorted.map((e, i) => ({
      rank: i + 1,
      displayName: maskName(e.name),
      referralCount: e.count,
    }));

    res.json({ entries, totalWithReferrals: refCounts.size });
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Something went wrong." });
  }
});

function maskName(name: string | null): string {
  if (!name?.trim()) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

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

    // Compute referral counts for the returned entries
    const referralCodes = entries.map((e) => e.referralCode);
    const referralRows = referralCodes.length > 0
      ? await db
          .select({ referredBy: waitlistTable.referredBy })
          .from(waitlistTable)
          .where(isNotNull(waitlistTable.referredBy))
      : [];

    const refCountMap = new Map<string, number>();
    for (const r of referralRows) {
      if (r.referredBy) {
        refCountMap.set(r.referredBy, (refCountMap.get(r.referredBy) ?? 0) + 1);
      }
    }

    res.json({
      entries: entries.map((e) => ({
        id: e.id,
        email: e.email,
        name: e.name ?? null,
        createdAt: e.createdAt.toISOString(),
        referralCode: e.referralCode,
        referredBy: e.referredBy ?? null,
        referralCount: refCountMap.get(e.referralCode) ?? 0,
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
      ["ID", "Name", "Email", "Joined At", "Referral Code", "Referred By", "Referrals Sent"],
      ...entries.map((e) => [
        String(e.id),
        e.name ?? "",
        e.email,
        e.createdAt.toISOString(),
        e.referralCode,
        e.referredBy ?? "",
        "",
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
