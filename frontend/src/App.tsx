import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./App.css";

type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  text: string;
}

const API_URL = "http://localhost:5001";

const GREETING =
  "Hi! I'm your CirrusHub AI Assistant. I can help you understand opportunities, applications, contributions, and rewards.";

const QUICK_QUESTIONS = [
  {
    icon: "◈",
    title: "Explore opportunities",
    text: "What opportunities are available?",
  },
  {
    icon: "↗",
    title: "Apply for a project",
    text: "How do I apply for a project?",
  },
  {
    icon: "◎",
    title: "Track contributions",
    text: "How are contributions tracked?",
  },
  {
    icon: "✦",
    title: "Understand rewards",
    text: "How do rewards work?",
  },
];

let nextId = 1;

function createMessage(role: Role, text: string): Message {
  return { id: nextId++, role, text };
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    createMessage("assistant", GREETING),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        const response = await fetch(`${API_URL}/api/health`, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Health check failed (${response.status})`);
        }

        if (!cancelled) {
          setBackendOnline(true);
        }
      } catch {
        if (!cancelled) {
          setBackendOnline(false);
        }
      }
    }

    void checkBackend();

    const interval = window.setInterval(checkBackend, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();

    if (!trimmed || loading) return;

    setError("");

    const previousMessages = messages;
    const userMessage = createMessage("user", trimmed);

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const currentGeneration = generation.current;

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          // Keep both fields for compatibility with backend implementations.
          prompt: trimmed,
          history: previousMessages.map(({ role, text }) => ({
            role,
            content: text,
          })),
          messages: [
            ...previousMessages.map(({ role, text }) => ({
              role,
              content: text,
            })),
            { role: "user", content: trimmed },
          ],
        }),
      });

      const responseText = await response.text();

      let data: { reply?: string; error?: string };

      try {
        data = JSON.parse(responseText) as {
          reply?: string;
          error?: string;
        };
      } catch {
        throw new Error(
          `The server returned an unreadable response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed (HTTP ${response.status}).`
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The server responded, but no reply was returned.");
      }

      if (currentGeneration !== generation.current) return;

      setBackendOnline(true);

      setMessages((current) => [
        ...current,
        createMessage("assistant", data.reply as string),
      ]);
    } catch (err) {
      if (currentGeneration !== generation.current) return;

      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";

      setError(
        errorMessage.includes("Failed to fetch")
          ? "Could not connect to the assistant. Check that the backend is running on port 5001, then try again."
          : errorMessage
      );

      setBackendOnline(false);
    } finally {
      if (currentGeneration === generation.current) {
        setLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function startNewChat() {
    generation.current += 1;

    setMessages([createMessage("assistant", GREETING)]);
    setInput("");
    setLoading(false);
    setError("");
    setSidebarOpen(false);

    inputRef.current?.focus();
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Unable to copy. Please select and copy the text manually.");
    }
  }

  function handleInputChange(value: string) {
    setInput(value);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        150
      )}px`;
    }
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path
                d="M11 25.5a8 8 0 0 1 1.3-15.5A10 10 0 0 1 31 14a6.5 6.5 0 0 1-1 13H11Z"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="20" r="2" fill="currentColor" />
              <circle cx="24" cy="20" r="2" fill="currentColor" />
              <path
                d="M18 20h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <div className="brand-name">CirrusHub</div>
            <div className="brand-subtitle">AI ASSISTANT</div>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <span className="plus-icon">＋</span>
          <span>New chat</span>
        </button>

        <div className="sidebar-label">YOUR ASSISTANT</div>

        <div className="sidebar-item active">
          <span className="sidebar-item-icon">✦</span>
          AI Assistant
          <span className="active-dot" />
        </div>

        <div className="sidebar-label recent-label">QUICK ACCESS</div>

        <button
          className="sidebar-item"
          onClick={() => void sendMessage("What opportunities are available?")}
        >
          <span className="sidebar-item-icon">◈</span>
          Opportunities
        </button>

        <button
          className="sidebar-item"
          onClick={() => void sendMessage("How do I apply for a project?")}
        >
          <span className="sidebar-item-icon">↗</span>
          Applications
        </button>

        <button
          className="sidebar-item"
          onClick={() => void sendMessage("How are contributions tracked?")}
        >
          <span className="sidebar-item-icon">◎</span>
          Contributions
        </button>

        <button
          className="sidebar-item"
          onClick={() => void sendMessage("How do rewards work?")}
        >
          <span className="sidebar-item-icon">◇</span>
          Rewards
        </button>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-card-icon">✦</div>
            <div>
              <div className="help-card-title">Need some help?</div>
              <div className="help-card-text">
                Ask the AI assistant anything.
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            <span className="footer-status" />
            <span>Prototype environment</span>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>

            <div>
              <div className="topbar-title">AI Assistant</div>
              <div className="topbar-subtitle">
                Your CirrusHub workspace companion
              </div>
            </div>
          </div>

          <div
            className={`connection-status ${
              backendOnline ? "connected" : "disconnected"
            }`}
          >
            <span className="connection-dot" />
            {backendOnline ? "AI Connected" : "AI Offline"}
          </div>
        </header>

        <section className="chat-area">
          <div className="chat-content">
            {messages.length === 1 && (
              <div className="welcome-section">
                <div className="welcome-logo">
                  <svg viewBox="0 0 40 40" fill="none">
                    <path
                      d="M11 25.5a8 8 0 0 1 1.3-15.5A10 10 0 0 1 31 14a6.5 6.5 0 0 1-1 13H11Z"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="16" cy="20" r="2" fill="currentColor" />
                    <circle cx="24" cy="20" r="2" fill="currentColor" />
                    <path
                      d="M18 20h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="welcome-eyebrow">YOUR AI WORKSPACE</div>

                <h1>
                  Work smarter with
                  <br />
                  <span>CirrusHub AI.</span>
                </h1>

                <p className="welcome-description">
                  Your assistant for opportunities, applications, contributions,
                  and rewards. What would you like to know?
                </p>

                <div className="suggestions-grid">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      className="suggestion-card"
                      key={question.title}
                      onClick={() => void sendMessage(question.text)}
                      disabled={loading}
                    >
                      <span className="suggestion-icon">
                        {question.icon}
                      </span>
                      <span className="suggestion-title">
                        {question.title}
                      </span>
                      <span className="suggestion-text">
                        {question.text}
                      </span>
                      <span className="suggestion-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="messages-list">
              {messages.length > 1 &&
                messages.slice(1).map((message) => (
                  <div
                    key={message.id}
                    className={`message-row ${message.role}`}
                  >
                    {message.role === "assistant" && (
                      <div className="message-avatar">
                        <span>✦</span>
                      </div>
                    )}

                    <div className="message-content">
                      {message.role === "assistant" && (
                        <div className="message-author">CirrusHub AI</div>
                      )}

                      <div className={`message-bubble ${message.role}`}>
                        {message.role === "assistant" ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ children, href }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {message.text}
                          </ReactMarkdown>
                        ) : (
                          message.text
                        )}
                      </div>

                      {message.role === "assistant" && (
                        <button
                          className="copy-button"
                          onClick={() => void copyMessage(message.text)}
                          title="Copy response"
                          type="button"
                        >
                          ▢ Copy
                        </button>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="user-avatar">Y</div>
                    )}
                  </div>
                ))}

              {loading && (
                <div className="message-row assistant">
                  <div className="message-avatar">
                    <span>✦</span>
                  </div>

                  <div className="message-content">
                    <div className="message-author">CirrusHub AI</div>

                    <div className="typing-bubble" aria-label="AI is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="error-message" role="alert">
                  <span>{error}</span>
                  <button
                    onClick={() => {
                      setError("");
                      inputRef.current?.focus();
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>
        </section>

        <footer className="composer-area">
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Message CirrusHub AI..."
              rows={1}
              aria-label="Write your message"
              disabled={loading}
            />

            <button
              className="send-button"
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              title="Send message"
            >
              {loading ? (
                <span className="send-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12 19 5l-4 14-3-6-7-1Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m12 13 7-8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </form>

          <div className="composer-note">
            AI-generated responses may not always be accurate.
          </div>
        </footer>
      </main>
    </div>
  );
}
