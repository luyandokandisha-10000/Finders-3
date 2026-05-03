import { Router } from "express";
import crypto from "crypto";
import { db, waitlistTable } from "@workspace/db";
import { eq, count, ilike, or, desc, asc, isNotNull } from "drizzle-orm";
import { JoinWaitlistBody, ListWaitlistEntriesQueryParams } from "@workspace/api-zod";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET ?? "fallback-dev-secret";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

function buildAppBaseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:80";
}

function buildWelcomeEmailHtml(
  firstName: string,
  position: number,
  referralCode: string,
  referralLink: string,
  unsubscribeUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>You're on the Finders waitlist!</title>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Logo -->
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
          <!-- Card -->
          <tr>
            <td style="background-color:#111111;border:1px solid rgba(139,105,20,0.2);border-radius:16px;padding:48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr><td style="height:2px;background-color:#8B6914;border-radius:2px;"></td></tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:13px;color:rgba(232,232,232,0.45);text-transform:uppercase;letter-spacing:1.5px;">Hey ${firstName},</p>
              <h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.35;">You're on the list. 🎉</h1>
              <p style="margin:0 0 28px 0;font-size:16px;color:rgba(232,232,232,0.7);line-height:1.75;">
                Welcome to the Finders early access waitlist. You're currently at position <strong style="color:#C9A84C;">#${position}</strong>. Move up by inviting friends with your personal referral link.
              </p>

              <!-- Position badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:rgba(139,105,20,0.08);border:1px solid rgba(139,105,20,0.25);border-radius:12px;padding:20px 24px;">
                    <p style="margin:0 0 4px 0;font-size:11px;color:rgba(232,232,232,0.4);text-transform:uppercase;letter-spacing:1.5px;">Your waitlist position</p>
                    <p style="margin:0;font-size:36px;font-weight:700;color:#C9A84C;">#${position}</p>
                  </td>
                </tr>
              </table>

              <!-- Referral section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td style="height:1px;background-color:rgba(139,105,20,0.15);"></td></tr>
              </table>
              <p style="margin:0 0 6px 0;font-size:12px;color:rgba(232,232,232,0.35);text-transform:uppercase;letter-spacing:1.5px;">Your referral link</p>
              <p style="margin:0 0 16px 0;font-size:14px;color:rgba(232,232,232,0.55);line-height:1.65;">
                Each friend who signs up through your link moves you one spot closer to the top — and the people at the top get early access first.
              </p>
              <!-- Referral link box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#0A0A0A;border:1px solid rgba(139,105,20,0.3);border-radius:8px;padding:14px 18px;">
                    <span style="font-family:monospace;font-size:13px;color:#C9A84C;word-break:break-all;">${referralLink}</span>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr>
                  <td style="background-color:#8B6914;border-radius:8px;">
                    <a href="${referralLink}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#000000;text-decoration:none;letter-spacing:0.5px;">
                      Share Your Link →
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr><td style="height:1px;background-color:rgba(139,105,20,0.15);"></td></tr>
              </table>

              <!-- What you get -->
              <p style="margin:0 0 12px 0;font-size:12px;color:rgba(232,232,232,0.35);text-transform:uppercase;letter-spacing:1.5px;">What Finders gives you</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
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
              <p style="margin:0;font-size:14px;color:rgba(232,232,232,0.4);line-height:1.7;">We'll be in touch soon.<br/><span style="color:#C9A84C;font-weight:600;">The Finders Team</span></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 4px 0;font-size:11px;color:rgba(232,232,232,0.2);">Your referral code: <span style="color:rgba(201,168,76,0.5);font-family:monospace;">${referralCode}</span></p>
              <p style="margin:0 0 6px 0;font-size:11px;color:rgba(232,232,232,0.2);">You received this because you joined the Finders waitlist.</p>
              <p style="margin:0;font-size:11px;color:rgba(232,232,232,0.2);">
                Don't want future emails? <a href="${unsubscribeUrl}" style="color:rgba(201,168,76,0.6);text-decoration:underline;">Unsubscribe</a>
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

async function sendWelcomeEmail(
  log: { error: (obj: object, msg: string) => void },
  entry: { email: string; name?: string | null; referralCode: string },
  position: number
): Promise<void> {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return;

  const firstName = entry.name ? entry.name.split(" ")[0] : "there";
  const base = buildAppBaseUrl();
  const referralLink = `${base}/?ref=${entry.referralCode}`;
  const unsubscribeToken = createUnsubscribeToken(entry.email);
  const unsubscribeUrl = `${base}/api/waitlist/unsubscribe?email=${encodeURIComponent(entry.email)}&token=${unsubscribeToken}`;
  const html = buildWelcomeEmailHtml(firstName, position, entry.referralCode, referralLink, unsubscribeUrl);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: entry.email,
        subject: "You're on the Finders waitlist — share your link to move up",
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.error({ status: res.status, body, email: entry.email }, "Welcome email rejected by Resend");
    }
  } catch (err) {
    log.error({ err, email: entry.email }, "Failed to send welcome email");
  }
}

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

    // Fire welcome email after responding so it never blocks the signup
    sendWelcomeEmail(req.log, { email, name, referralCode }, position).catch(() => {});
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

router.get("/waitlist/position", async (req, res) => {
  const email = (req.query.email as string)?.toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  try {
    const [entry] = await db
      .select({
        referralCode: waitlistTable.referralCode,
        name: waitlistTable.name,
      })
      .from(waitlistTable)
      .where(eq(waitlistTable.email, email))
      .limit(1);

    if (!entry) {
      res.status(404).json({ error: "This email is not on the waitlist." });
      return;
    }

    const [[{ value: totalSignups }], [{ value: referralCount }], position] = await Promise.all([
      db.select({ value: count() }).from(waitlistTable),
      db.select({ value: count() }).from(waitlistTable).where(eq(waitlistTable.referredBy, entry.referralCode)),
      computePosition(entry.referralCode),
    ]);

    res.json({
      position,
      referralCount: Number(referralCount),
      totalSignups: Number(totalSignups),
      referralCode: entry.referralCode,
      name: entry.name ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to check waitlist position");
    res.status(500).json({ error: "Something went wrong." });
  }
});

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

router.get("/waitlist/admin/referral-stats", async (req, res) => {
  try {
    const allReferredBy = await db
      .select({ referredBy: waitlistTable.referredBy })
      .from(waitlistTable)
      .where(isNotNull(waitlistTable.referredBy));

    const refCountMap = new Map<string, number>();
    for (const r of allReferredBy) {
      if (r.referredBy) {
        refCountMap.set(r.referredBy, (refCountMap.get(r.referredBy) ?? 0) + 1);
      }
    }

    const totalReferrals = allReferredBy.length;
    const totalReferrers = refCountMap.size;

    // Find the referral code with the most referrals
    let topCode: string | null = null;
    let topCount = 0;
    for (const [code, cnt] of refCountMap.entries()) {
      if (cnt > topCount) {
        topCount = cnt;
        topCode = code;
      }
    }

    let topReferrerName: string | null = null;
    if (topCode) {
      const [topEntry] = await db
        .select({ name: waitlistTable.name })
        .from(waitlistTable)
        .where(eq(waitlistTable.referralCode, topCode))
        .limit(1);
      topReferrerName = topEntry?.name ?? null;
    }

    res.json({
      totalReferrals,
      totalReferrers,
      topReferrerName,
      topReferrerCount: topCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin referral stats");
    res.status(500).json({ error: "Something went wrong." });
  }
});

export default router;
