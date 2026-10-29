import "dotenv/config";
import express from "express";
import cors from "cors";
import Groq from "groq-sdk";

const API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are the CirrusHub AI Assistant.
Help with general questions, explanations, coding, writing, and CirrusHub-related topics.
For CirrusHub-specific facts, you do not have access to live CirrusHub data, employee records, or the user's account. Never invent specific opportunities, reward amounts, employee information, or company policies. State uncertainty clearly and suggest where to verify.
Be helpful, clear, and accurate. Use Markdown when useful: headings, bullets, numbered steps, and code blocks. Adapt the level of detail to the user's question.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
    ],
  }),
);
app.use(express.json({ limit: "100kb" }));

const health = (_req: express.Request, res: express.Response) =>
  res.json({ status: "ok", ai: Boolean(API_KEY), provider: "groq", model: MODEL });

app.get("/health", health);
app.get("/api/health", health);

app.post("/api/chat", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      error: "Groq is not configured. Add GROQ_API_KEY to backend/.env and restart the backend.",
    });
  }

  // Accept both the frontend's current { message, history } payload and a { messages } payload.
  const body = req.body ?? {};
  const raw: unknown = Array.isArray(body.messages)
    ? body.messages
    : [
        ...(Array.isArray(body.history) ? body.history : []),
        ...(typeof body.message === "string" ? [{ role: "user", content: body.message }] : []),
      ];

  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ error: "Send a non-empty message or messages array." });
  }

  const messages: ChatMessage[] = raw
    .filter(
      (m: any) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        (typeof m.content === "string" || typeof m.text === "string") &&
        String(m.content ?? m.text).trim().length > 0,
    )
    .map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content ?? m.text).trim().slice(0, 12000),
    }))
    .slice(-30);

  while (messages.length && messages[0].role !== "user") messages.shift();

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from the user." });
  }

  // Merge adjacent messages with the same role to meet chat-completions role sequencing expectations.
  const normalized: ChatMessage[] = [];
  for (const message of messages) {
    const previous = normalized[normalized.length - 1];
    if (previous && previous.role === message.role) {
      previous.content += "\n\n" + message.content;
    } else {
      normalized.push({ ...message });
    }
  }

  try {
    const groq = new Groq({ apiKey: API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...normalized,
      ],
      max_tokens: 1800,
      temperature: 0.5,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    return res.json({ reply: reply || "I couldn't generate a response. Please try again." });
  } catch (err: any) {
    console.error("Groq request failed:", err?.status ?? "", err?.message ?? err);
    const status = Number(err?.status);
    if (status === 401) {
      return res.status(502).json({ error: "Groq rejected the API key. Check GROQ_API_KEY in backend/.env." });
    }
    if (status === 429) {
      return res.status(502).json({ error: "Groq rate limit or quota reached. Check your Groq account limits." });
    }
    return res.status(502).json({ error: "Could not get a response from Groq. Check the backend terminal for details." });
  }
});

const port = Number(process.env.PORT ?? 5001);
app.listen(port, () => {
  console.log(`CirrusHub AI backend listening on http://localhost:${port}`);
  console.log(`AI provider: Groq | Model: ${MODEL} | API key configured: ${Boolean(API_KEY)}`);
});
