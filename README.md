# CirrusHub AI Assistant 🤖

A standalone chat assistant that helps employees understand CirrusHub, explore opportunities, and learn how contributions and rewards work.

**Current status:** with the backend running and an API key set, the assistant answers using an AI model and remembers the conversation. Without it, the frontend falls back to predefined demo responses. Document retrieval (RAG) and live CirrusHub data are not connected yet.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173/).

## Enable AI answers

```bash
cd backend
npm install
npm run dev
```

Before `npm run dev`, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The backend serves `GET /api/health` and `POST /api/chat` on port 5001, and the frontend dev server proxies `/api` to it. The badge in the header shows "AI connected" or "Demo mode". Keep the key in `backend/.env` (git-ignored), never in frontend code.

## Try these questions

What is CirrusHub? · Find AI opportunities. · How do rewards work? · How do I apply for a project? · How are contributions tracked?

## Planned

AI responses, knowledge-base search, RAG over approved documents, opportunity discovery, authentication and role-based access.
