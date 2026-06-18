import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const styles = `
  .tk-intro { font-size: 13px; color: #5a6378; margin-bottom: 22px; line-height: 1.5; max-width: 600px; }
  .tk-filters { display: flex; gap: 8px; margin-bottom: 16px; }
  .tk-filter { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #e0e4ec; background: #fff; color: #5a6378; font-family: inherit; }
  .tk-filter.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
  .tk-list { display: flex; flex-direction: column; gap: 10px; }
  .tk-card { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 16px 20px; }
  .tk-head { display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 12px; }
  .tk-subj { font-size: 14px; font-weight: 600; color: #1a1a2e; }
  .tk-who { font-size: 12px; color: #8892a4; margin-top: 3px; }
  .tk-status { font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
  .st-open { background: #fff3cd; color: #856404; }
  .st-reopened { background: #fde8e8; color: #c0392b; }
  .st-in_progress { background: #e7f3ff; color: #2c5282; }
  .st-resolved { background: #e8f6ed; color: #1a7a3c; }
  .st-closed { background: #eef0f5; color: #5a6378; }
  .tk-thread { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
  .tk-bubble { max-width: 78%; padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.45; }
  .tk-bubble-borrower { align-self: flex-start; background: #f0f2f7; color: #1a1a2e; border-bottom-left-radius: 4px; }
  .tk-bubble-analyst { align-self: flex-end; background: #1a7a3c; color: #fff; border-bottom-right-radius: 4px; }
  .tk-bubble-meta { font-size: 10px; opacity: 0.6; margin-top: 3px; }
  .tk-reply { margin-top: 12px; }
  .tk-reply textarea { width: 100%; box-sizing: border-box; border: 1px solid #e0e4ec; border-radius: 9px; padding: 10px 12px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 60px; }
  .tk-reply-actions { display: flex; gap: 8px; margin-top: 8px; }
  .tk-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; }
  .tk-btn-resolve { background: #1a7a3c; color: #fff; }
  .tk-btn-open { background: #fff; color: #1a1a2e; border: 1px solid #e0e4ec; }
  .tk-btn-view { background: none; border: none; color: #7048e8; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 8px; padding: 0; }
  .tk-loading { color: #8892a4; padding: 40px; text-align: center; }
  .tk-empty { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 48px; text-align: center; color: #8892a4; font-size: 14px; }
`;

export default function Tickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [expanded, setExpanded] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const load = async () => {
    const token = localStorage.getItem("token");
    try {
      const { data } = await axios.get(`${API}/support/all-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load tickets", e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitReply = async (ticketId, newStatus) => {
    if (replyText.trim().length < 10) {
      alert("Reply must be at least 10 characters.");
      return;
    }
    setReplying(true);
    const token = localStorage.getItem("token");
    try {
      await axios.post(`${API}/support/respond/${ticketId}`,
        { response: replyText, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyText("");
      setExpanded(null);
      await load();
    } catch (e) {
      alert("Failed to send reply.");
    }
    setReplying(false);
  };

  const ACTIVE_STATUSES = ["open", "reopened", "in_progress"];
  const filtered = tickets.filter(t => {
    if (filter === "all") return true;
    if (filter === "active") return ACTIVE_STATUSES.includes(t.status);
    if (filter === "resolved") return t.status === "resolved" || t.status === "closed";
    return true;
  });

  const activeCount = tickets.filter(t => ACTIVE_STATUSES.includes(t.status)).length;

  return (
    <AppShell title="Q&A / Support Tickets">
      <style>{styles}</style>
      <div className="tk-intro">
        All customer questions and support tickets in one place. Open tickets need your attention — click any ticket to read the thread and reply.
      </div>

      <div className="tk-filters">
        <button className={`tk-filter ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>
          Needs Attention ({activeCount})
        </button>
        <button className={`tk-filter ${filter === "resolved" ? "active" : ""}`} onClick={() => setFilter("resolved")}>Resolved</button>
        <button className={`tk-filter ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
      </div>

      {loading ? (
        <div className="tk-loading">Loading tickets…</div>
      ) : filtered.length === 0 ? (
        <div className="tk-empty">No tickets in this view.</div>
      ) : (
        <div className="tk-list">
          {filtered.map(t => (
            <div key={t.id} className="tk-card">
              <div className="tk-head" onClick={() => { setExpanded(expanded === t.id ? null : t.id); setReplyText(""); }}>
                <div>
                  <div className="tk-subj">{t.subject}</div>
                  <div className="tk-who">{t.borrower_name} · {t.borrower_email}</div>
                </div>
                <span className={`tk-status st-${t.status}`}>{t.status} {expanded === t.id ? "▴" : "▾"}</span>
              </div>

              {expanded === t.id && (
                <>
                  <div className="tk-thread">
                    {(t.thread || []).map(m => (
                      <div key={m.id} className={`tk-bubble ${m.sender_role === "analyst" ? "tk-bubble-analyst" : "tk-bubble-borrower"}`}>
                        <div>{m.message}</div>
                        <div className="tk-bubble-meta">
                          {m.sender_role === "analyst" ? "You" : t.borrower_name}
                          {m.created_at ? " · " + new Date(m.created_at).toLocaleDateString("en-IN", {day:"2-digit",month:"short"}) : ""}
                        </div>
                      </div>
                    ))}
                  </div>

                  {t.status !== "closed" && (
                    <div className="tk-reply">
                      <textarea
                        placeholder="Type your reply…"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                      />
                      <div className="tk-reply-actions">
                        <button className="tk-btn tk-btn-resolve" disabled={replying} onClick={() => submitReply(t.id, "resolved")}>
                          {replying ? "Sending…" : "Send & Resolve"}
                        </button>
                        <button className="tk-btn tk-btn-open" disabled={replying} onClick={() => submitReply(t.id, "in_progress")}>
                          Send & Keep Open
                        </button>
                      </div>
                    </div>
                  )}

                  <button className="tk-btn-view" onClick={() => navigate(`/customer/${t.user_id || ""}`)}>
                    View customer profile →
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
