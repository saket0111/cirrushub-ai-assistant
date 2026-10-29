require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

if (!process.env.GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY. Add it to backend/.env");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "AI assistant backend is running."
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please provide a message."
      });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (item) =>
              item &&
              ["user", "assistant"].includes(item.role) &&
              typeof item.content === "string"
          )
          .slice(-10)
          .map((item) => ({
            role: item.role,
            content: item.content.slice(0, 4000)
          }))
      : [];

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant for a standalone CirrusHub helper project. Answer clearly and accurately. You are not connected to actual CirrusHub systems, databases, or internal documents. Never claim to have accessed company information unless it has been provided in the conversation."
        },
        ...safeHistory,
        {
          role: "user",
          content: message.trim().slice(0, 4000)
        }
      ],
      max_completion_tokens: 1024
    });

    const reply = completion.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again."
      });
    }

    res.json({ reply });
  } catch (error) {
    console.error("Groq API error:", error.status || error.message);

    if (error.status === 401) {
      return res.status(502).json({
        error: "Groq rejected the API key. Check backend/.env."
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        error: "Groq usage limit reached. Please try again later."
      });
    }

    res.status(500).json({
      error: "Unable to get an AI response. Check the backend terminal."
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI assistant backend running at http://localhost:${PORT}`);
});
