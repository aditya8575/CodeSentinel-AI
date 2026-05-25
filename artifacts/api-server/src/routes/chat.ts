import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, reviewsTable, findingsTable, chatMessagesTable } from "@workspace/db";
import { GetChatHistoryParams, SendChatMessageParams, SendChatMessageBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.get("/chat/:reviewId", async (req, res) => {
  const parsed = GetChatHistoryParams.safeParse({ reviewId: Number(req.params.reviewId) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid reviewId" });
    return;
  }

  const { reviewId } = parsed.data;

  try {
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.reviewId, reviewId))
      .orderBy(asc(chatMessagesTable.createdAt));
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to get chat history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/:reviewId", async (req, res) => {
  const paramsParsed = SendChatMessageParams.safeParse({ reviewId: Number(req.params.reviewId) });
  const bodyParsed = SendChatMessageBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { reviewId } = paramsParsed.data;
  const { content } = bodyParsed.data;

  try {
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, reviewId));
    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const findings = await db.select().from(findingsTable).where(eq(findingsTable.reviewId, reviewId));
    const history = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.reviewId, reviewId))
      .orderBy(asc(chatMessagesTable.createdAt));

    await db.insert(chatMessagesTable).values({ reviewId, role: "user", content });

    const systemPrompt = `You are CodeSentinel AI, a knowledgeable code review assistant. You are answering questions about a specific PR review.

Review title: "${review.title}"
${review.prUrl ? `PR URL: ${review.prUrl}` : ""}
${review.language ? `Language: ${review.language}` : ""}

Findings summary (${findings.length} total):
${findings.slice(0, 20).map((f) => `- [${f.severity.toUpperCase()}] ${f.category}: ${f.title}`).join("\n")}

${review.diffContent ? `Code diff context:\n\`\`\`diff\n${review.diffContent.slice(0, 3000)}\n\`\`\`` : ""}

Answer questions about the findings, explain issues clearly, suggest fixes, and help the developer understand and resolve the problems. Be concise, technical, and helpful.`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(chatMessagesTable).values({ reviewId, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Chat error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "An error occurred" })}\n\n`);
      res.end();
    }
  }
});

export default router;
