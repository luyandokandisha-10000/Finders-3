import { Router } from "express";
import { db, waitlistTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { JoinWaitlistBody } from "@workspace/api-zod";

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

export default router;
