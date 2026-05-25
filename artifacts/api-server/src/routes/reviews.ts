import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, reviewsTable, findingsTable } from "@workspace/db";
import {
  CreateReviewBody,
  GetReviewParams,
  DeleteReviewParams,
  ReanalyzeReviewParams,
} from "@workspace/api-zod";
import { analyzeCode } from "../lib/ai-reviewer";

const router = Router();

router.get("/reviews/stats", async (req, res) => {
  try {
    const [reviews, findings] = await Promise.all([
      db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt)).limit(5),
      db.select().from(findingsTable),
    ]);

    const findingsByCategory: Record<string, number> = {};
    let criticalFindings = 0, highFindings = 0, mediumFindings = 0, lowFindings = 0;

    for (const f of findings) {
      findingsByCategory[f.category] = (findingsByCategory[f.category] ?? 0) + 1;
      if (f.severity === "critical") criticalFindings++;
      else if (f.severity === "high") highFindings++;
      else if (f.severity === "medium") mediumFindings++;
      else if (f.severity === "low") lowFindings++;
    }

    const allReviews = await db.select().from(reviewsTable);

    res.json({
      totalReviews: allReviews.length,
      totalFindings: findings.length,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      findingsByCategory,
      recentActivity: reviews,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reviews", async (req, res) => {
  try {
    const reviews = await db
      .select()
      .from(reviewsTable)
      .orderBy(desc(reviewsTable.createdAt));
    res.json(reviews);
  } catch (err) {
    req.log.error({ err }, "Failed to list reviews");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reviews", async (req, res) => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { title, prUrl, language } = parsed.data;
  let { diffContent } = parsed.data;

  if (!diffContent && prUrl) {
    const pr = parseGitHubPrUrl(prUrl);
    if (pr) {
      const fetched = await fetchGitHubDiff(pr);
      if (fetched) {
        diffContent = fetched;
        req.log.info({ prUrl, bytes: fetched.length }, "Auto-fetched diff from GitHub");
      } else {
        req.log.warn({ prUrl }, "Could not auto-fetch diff — PR may not exist, may be an issue, or has no diff");
      }
    }
  }

  try {
    const [review] = await db
      .insert(reviewsTable)
      .values({ title, prUrl: prUrl ?? null, diffContent: diffContent ?? null, language: language ?? null, status: "analyzing" })
      .returning();

    res.status(201).json(review);

    if (diffContent) {
      runAnalysis(review!.id, diffContent, language ?? null).catch((err) =>
        req.log.error({ err, reviewId: review!.id }, "Background analysis failed")
      );
    } else {
      await db.update(reviewsTable).set({ status: "failed" }).where(eq(reviewsTable.id, review!.id));
      req.log.warn({ reviewId: review!.id, prUrl }, "Review marked failed — no diff available");
    }
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/reviews/:id", async (req, res) => {
  const parsed = GetReviewParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const findings = await db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.reviewId, id))
      .orderBy(
        sql`CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`
      );

    res.json({ ...review, findings });
  } catch (err) {
    req.log.error({ err }, "Failed to get review");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/reviews/:id", async (req, res) => {
  const parsed = DeleteReviewParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    await db.delete(findingsTable).where(eq(findingsTable.reviewId, id));
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete review");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reviews/:id/reanalyze", async (req, res) => {
  const parsed = ReanalyzeReviewParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { id } = parsed.data;

  try {
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    await db.update(reviewsTable).set({ status: "analyzing" }).where(eq(reviewsTable.id, id));
    await db.delete(findingsTable).where(eq(findingsTable.reviewId, id));

    const updated = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    const findings = await db.select().from(findingsTable).where(eq(findingsTable.reviewId, id));
    res.json({ ...updated[0], findings });

    if (review.diffContent) {
      runAnalysis(id, review.diffContent, review.language).catch((err) =>
        req.log.error({ err, reviewId: id }, "Re-analysis failed")
      );
    } else {
      await db.update(reviewsTable).set({ status: "completed" }).where(eq(reviewsTable.id, id));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to reanalyze");
    res.status(500).json({ error: "Internal server error" });
  }
});

function parseGitHubPrUrl(url: string): { owner: string; repo: string; number: string } | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "github.com") return null;
    const match = u.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1]!, repo: match[2]!, number: match[3]! };
  } catch {
    return null;
  }
}

function isDiffContent(text: string, contentType: string): boolean {
  if (contentType.includes("text/html")) return false;
  return text.includes("diff --git") || (text.includes("---") && text.includes("+++") && text.includes("@@"));
}

async function fetchGitHubDiff(pr: { owner: string; repo: string; number: string }): Promise<string | null> {
  const UA = "CodeSentinel-AI/1.0";

  // Strategy 1: GitHub REST API (most reliable, works for all public repos)
  try {
    const apiUrl = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`;
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/vnd.github.diff", "User-Agent": UA },
    });
    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      if (isDiffContent(text, ct)) return text;
    }
  } catch {}

  // Strategy 2: patch-diff.githubusercontent.com (fast CDN cache for recent PRs)
  try {
    const rawUrl = `https://patch-diff.githubusercontent.com/raw/${pr.owner}/${pr.repo}/pull/${pr.number}.diff`;
    const res = await fetch(rawUrl, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      if (isDiffContent(text, ct)) return text;
    }
  } catch {}

  return null;
}

async function runAnalysis(reviewId: number, diffContent: string, language: string | null) {
  try {
    const result = await analyzeCode(diffContent, language);
    const findings = result.findings;

    if (findings.length > 0) {
      await db.insert(findingsTable).values(
        findings.map((f) => ({ ...f, reviewId }))
      );
    }

    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const highCount = findings.filter((f) => f.severity === "high").length;
    const mediumCount = findings.filter((f) => f.severity === "medium").length;
    const lowCount = findings.filter((f) => f.severity === "low").length;

    await db.update(reviewsTable).set({
      status: "completed",
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    }).where(eq(reviewsTable.id, reviewId));
  } catch (err) {
    await db.update(reviewsTable).set({ status: "failed" }).where(eq(reviewsTable.id, reviewId));
    throw err;
  }
}

export default router;
