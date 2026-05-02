import { Router } from "express";
import { db, waitlistTable } from "@workspace/db";
import { eq, count, ilike, or, desc } from "drizzle-orm";
import { JoinWaitlistBody, ListWaitlistEntriesQueryParams } from "@workspace/api-zod";

const router = Router();

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
