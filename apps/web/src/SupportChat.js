import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi 👋 I'm the LoanSense Assistant. Ask me anything about your loans, EMIs, deferrals, or how the platform works!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        "http://127.0.0.1:8000/chat-support",
        {
          message: msg,
          history: newMessages.slice(0, -1).slice(-6) // send recent context
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.reply) {
        setMessages(m => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setMessages(m => [...m, { role: "assistant", content: "Sorry, I couldn't process that. Try rephrasing?" }]);
      }
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
    }
    setLoading(false);
  };

  const quickQs = [
    "How does partial payment work?",
    "What is my CIBIL score doing?",
    "Can I defer my EMI?",
    "How is my interest calculated?"
  ];

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: "linear-gradient(135deg, #4c6ef5 0%, #7048e8 100%)",
          color: "#fff", border: "none", fontSize: 24, cursor: "pointer",
          boxShadow: "0 8px 24px rgba(76,110,245,0.4)", zIndex: 999
        }}>💬</button>
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, width: 380, height: 540,
          background: "#fff", borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          border: "1px solid #eaedf3", zIndex: 999, display: "flex", flexDirection: "column",
          overflow: "hidden", fontFamily: "DM Sans, sans-serif"
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #4c6ef5 0%, #7048e8 100%)", color: "#fff",
            padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{fontSize: 14, fontWeight: 600}}>💬 LoanSense Assistant</div>
              <div style={{fontSize: 11, opacity: 0.85, marginTop: 2}}>AI-powered · Usually replies instantly</div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
              width: 28, height: 28, borderRadius: "50%", fontSize: 14, cursor: "pointer"
            }}>×</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{
            flex: 1, overflowY: "auto", padding: "16px", background: "#fafbfc"
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10
              }}>
                <div style={{
                  maxWidth: "82%",
                  background: m.role === "user" ? "#1a1a2e" : "#fff",
                  color: m.role === "user" ? "#fff" : "#1a1a2e",
                  padding: "10px 14px", borderRadius: 14,
                  fontSize: 13, lineHeight: 1.5,
                  border: m.role === "assistant" ? "1px solid #eaedf3" : "none",
                  whiteSpace: "pre-wrap"
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{display: "flex", justifyContent: "flex-start", marginBottom: 10}}>
                <div style={{
                  background: "#fff", padding: "10px 14px", borderRadius: 14,
                  fontSize: 13, color: "#8892a4", border: "1px solid #eaedf3"
                }}>
                  Thinking…
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div style={{marginTop: 6}}>
                <div style={{fontSize: 11, color: "#8892a4", marginBottom: 8, fontWeight: 500}}>SUGGESTED QUESTIONS</div>
                {quickQs.map((q, i) => (
                  <div key={i} onClick={() => { setInput(q); setTimeout(send, 50); }}
                    style={{
                      background: "#fff", border: "1px solid #eaedf3", padding: "9px 12px",
                      borderRadius: 10, fontSize: 12, color: "#1a1a2e", marginBottom: 6,
                      cursor: "pointer"
                    }}>
                    {q}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            borderTop: "1px solid #eaedf3", padding: "12px 14px",
            background: "#fff", display: "flex", gap: 8
          }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask a question..." disabled={loading}
              style={{
                flex: 1, padding: "10px 14px", border: "1px solid #e0e4ec",
                borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none"
              }} />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              padding: "10px 16px", background: "#1a1a2e", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: loading || !input.trim() ? 0.5 : 1
            }}>↑</button>
          </div>
        </div>
      )}
    </>
  );
}