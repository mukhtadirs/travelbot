"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    viewRef.current?.scrollTo({ top: viewRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const next = [...messages, { role: "user", content: trimmed } as const];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error("Network error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      setMessages((cur) => [...cur, { role: "assistant", content: "" } as const]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages((cur) => {
          const copy = [...cur];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }
    } catch (err) {
      setMessages((cur) => [...cur, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMessages([]);
    setInput("");
  }

  

  return (
    <main className="min-h-screen gradient-bg">
      <section className="mx-auto max-w-3xl px-4 py-12">
        <header className="mb-6">
          <h1 className="title-gradient text-3xl font-semibold tracking-tight">Velvet Compass</h1>
          <p className="text-sm text-neutral-300">Underground luxury travel — editorial concierge chat</p>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-neutral-400">Try one</p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "Milan — winter ateliers",
                  prompt: "Milan in winter — couple. Interests: ateliers & studios. Draft a first pass using A→I→C→R.",
                },
                {
                  label: "Paris — after-hours arc",
                  prompt: "Draft a 3‑day Paris trip featuring after‑hours experiences.",
                },
                {
                  label: "Waterfront evening (Lisbon)",
                  prompt: "Lisbon, 3 nights — couple. Interests: waterfront evening + wine. Draft a first pass.",
                },
                {
                  label: "Rooftop sunset (Barcelona)",
                  prompt: "Barcelona, 2 nights — couple. Interests: rooftop sunset + gastronomy. Draft a first pass.",
                },
              ].map(({ label, prompt }) => (
                <button
                  key={label}
                  title={prompt}
                  onClick={() => {
                    setInput(prompt);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="chip text-xs rounded-full px-3 py-1"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="mb-4 flex gap-2">
          <button
            onClick={resetChat}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
          >
            Reset chat
          </button>
        </div>

        <div
          ref={viewRef}
          className="scroll-area h-[62vh] w-full overflow-y-auto rounded-2xl glass p-4"
        >
          {messages.length === 0 ? (
            <div className="text-sm text-neutral-300">
              Ask for a first draft itinerary. Example: “Tokyo, 3 nights — couple, ateliers + after-hours.”
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m, i) => (
                <li key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="size-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/80">VC</div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm bubble ${m.role === "user" ? "bg-white text-black" : "bg-white/6 text-neutral-200"}`}>
                    {m.role === "assistant" ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: (p) => <h2 className="text-base font-semibold mt-2" {...p} />,
                          h2: (p) => <h3 className="text-sm font-semibold mt-2" {...p} />,
                          p: (p) => <p className="mb-2 leading-relaxed" {...p} />,
                          ul: (p) => <ul className="list-disc ml-5 mb-2" {...p} />,
                        }}
                      >
                        {m.content.replace(/^\[mode:[^\]]+\]\s*/i, "")}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="size-7 rounded-full bg-white text-black flex items-center justify-center text-[10px]">You</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type your request…"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none focus:border-white/20"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-60"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
        
      </section>
    </main>
  );
}
