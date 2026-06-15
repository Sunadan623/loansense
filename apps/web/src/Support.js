import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f7f8fc; color: #1a1a2e; }
  .wrap { min-height: 100vh; padding: 32px 20px; }
  .container { max-width: 880px; margin: 0 auto; }
  .back-btn { background: none; border: none; color: #5a6378; font-size: 13px; font-weight: 500; cursor: pointer; padding: 6px 0; margin-bottom: 20px; font-family: inherit; }
  .hero { background: linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%); border-radius: 20px; padding: 36px; color: #fff; margin-bottom: 24px; }
  .hero h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .hero p { font-size: 14px; opacity: 0.85; line-height: 1.5; max-width: 580px; }
  .new-ticket-btn { background: #fff; color: #1a1a2e; border: none; padding: 11px 22px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 16px; font-family: inherit; }
  .card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid #eaedf3; margin-bottom: 16px; }
  .card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: #5a6378; margin-bottom: 6px; }
  .field input, .field select, .field textarea { width: 100%; padding: 11px 14px; border: 1px solid #e0e4ec; border-radius: 8px; font-size: 14px; font-family: inherit; }
  .field textarea { min-height: 100px; resize: vertical; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .btn { padding: 12px 24px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; }
  .btn-primary { background: #1a1a2e; color: #fff; }
  .btn-secondary { background: #fff; color: #1a1a2e; border: 1px solid #e0e4ec; }
  .ticket { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 20px; margin-bottom: 14px; }
  .t-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px; flex-wrap: wrap; }
  .t-subj { font-size: 15px; font-weight: 600; color: #1a1a2e; }
  .t-meta { font-size: 11px; color: #8892a4; margin-top: 4px; }
  .thread { padding-top: 14px; border-top: 1px dashed #eaedf3; }
  .msg { display: flex; margin-bottom: 12px; gap: 10px; }
  .msg.borrower { justify-content: flex-end; }
  .msg-bubble { max-width: 78%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; }
  .msg.borrower .msg-bubble { background: #1a1a2e; color: #fff; border-bottom-right-radius: 4px; }
  .msg.analyst .msg-bubble { background: #f0fff4; color: #1a1a2e; border: 1px solid #c3e6cb; border-bottom-left-radius: 4px; }
  .msg-meta { font-size: 10px; margin-top: 4px; opacity: 0.7; }
  .pill { display: inline-block; padding: 3px 9px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  .empty { padding: 50px; text-align: center; color: #8892a4; font-size: 13px; background: #fff; border-radius: 12px; }
  .error-box { background: #fde8e8; color: #c0392b; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
  .success-box { background: #d4f5e2; color: #1a7a3c; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
  .reply-section { margin-top: 14px; padding-top: 14px; border-top: 1px dashed #eaedf3; }
  .reply-toggle { background: none; border: 1px solid #1a1a2e; color: #1a1a2e; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .reply-toggle:hover { background: #1a1a2e; color: #fff; }
`;

const STATUS_PILLS = {
  open: { bg: "#fff3cd", color: "#856404", label: "Open" },
  in_progress: { bg: "#cfe2ff", color: "#084298", label: "In Progress" },
  resolved: { bg: "#d4f5e2", color: "#1a7a3c", label: "Resolved" },
  reopened: { bg: "#fff3cd", color: "#856404", label: "Reopened" },
  closed: { bg: "#e0e4ec", color: "#5a6378", label: "Closed" }
};
const PRI_PILLS = {
  low: { bg: "#e0e4ec", color: "#5a6378", label: "Low" },
  normal: { bg: "#cfe2ff", color: "#084298", label: "Normal" },
  high: { bg: "#fff3cd", color: "#856404", label: "High" },
  urgent: { bg: "#fde8e8", color: "#c0392b", label: "Urgent" }
};

export default function Support() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "", category: "general", priority: "normal" });
  const [replyText, setReplyText] = useState({});  // {ticketId: "..."}
  const [replyOpen, setReplyOpen] = useState({});  // {ticketId: true/false}
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/support/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(data)) setTickets(data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchTickets(); }, []);

  const submit = async () => {
    setError(""); setSuccess("");
    if (!form.subject || form.subject.length < 5) { setError("Subject must be at least 5 characters"); return; }
    if (!form.message || form.message.length < 20) { setError("Please describe your issue (at least 20 characters)"); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/support/create-ticket`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.error) setError(data.error);
      else {
        setSuccess("Ticket created. We'll respond within 24 hours.");
        setForm({ subject: "", message: "", category: "general", priority: "normal" });
        setShowForm(false);
        fetchTickets();
      }
    } catch { setError("Could not submit ticket"); }
    setLoading(false);
  };

  const sendReply = async (ticketId) => {
    const text = (replyText[ticketId] || "").trim();
    if (text.length < 10) { alert("Reply must be at least 10 characters"); return; }
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/support/reply/${ticketId}`,
        { message: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setReplyText({ ...replyText, [ticketId]: "" });
        setReplyOpen({ ...replyOpen, [ticketId]: false });
        fetchTickets();
      } else {
        alert(data.error || "Could not send reply");
      }
    } catch { alert("Failed to send"); }
  };

  return (
    <AppShell title="Support">
      <style>{styles}</style>
      <div className="wrap">
        <div className="container">

          <div className="hero">
            <h1>🎫 Support Center</h1>
            <p>Need help? Raise a ticket and a real human will get back to you within 24 hours. For instant answers, use the chat assistant on your portal.</p>
            {!showForm && (
              <button className="new-ticket-btn" onClick={() => setShowForm(true)}>+ Raise a new ticket</button>
            )}
          </div>

          {success && <div className="success-box">{success}</div>}

          {showForm && (
            <div className="card">
              <div className="card-title">New Support Ticket</div>
              {error && <div className="error-box">{error}</div>}
              <div className="field">
                <label>Subject</label>
                <input type="text" value={form.subject}
                  onChange={e => setForm({...form, subject: e.target.value})}
                  placeholder="Brief summary of your issue" />
              </div>
              <div className="row2">
                <div className="field">
                  <label>Category</label>
                  <select value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="general">General Question</option>
                    <option value="payment">Payment Issue</option>
                    <option value="technical">Technical Problem</option>
                    <option value="account">Account / Login</option>
                    <option value="complaint">Complaint</option>
                  </select>
                </div>
                <div className="field">
                  <label>Priority</label>
                  <select value={form.priority}
                    onChange={e => setForm({...form, priority: e.target.value})}>
                    <option value="low">Low (no rush)</option>
                    <option value="normal">Normal</option>
                    <option value="high">High (affects my loan)</option>
                    <option value="urgent">Urgent (cannot proceed)</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Describe your issue</label>
                <textarea value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  placeholder="Please explain what's happening, what you expected, and any steps you've tried..."></textarea>
              </div>
              <div style={{display: "flex", gap: 10, marginTop: 8}}>
                <button className="btn btn-primary" onClick={submit} disabled={loading}>
                  {loading ? "Submitting..." : "Submit ticket"}
                </button>
                <button className="btn btn-secondary"
                  onClick={() => { setShowForm(false); setError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{fontSize: 14, fontWeight: 600, margin: "24px 0 14px"}}>
            Your tickets ({tickets.length})
          </div>

          {tickets.length === 0 ? (
            <div className="empty">No tickets yet. Raise one above when you need help!</div>
          ) : (
            tickets.map(t => {
              const s = STATUS_PILLS[t.status] || STATUS_PILLS.open;
              const p = PRI_PILLS[t.priority] || PRI_PILLS.normal;
              const canReply = t.status !== "closed";
              return (
                <div key={t.id} className="ticket">
                  <div className="t-head">
                    <div style={{flex: 1, minWidth: 200}}>
                      <div className="t-subj">{t.subject}</div>
                      <div className="t-meta">
                        Ticket #{t.id} · {t.category} · Raised on {new Date(t.created_at).toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"})}
                      </div>
                    </div>
                    <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
                      <span className="pill" style={{background: p.bg, color: p.color}}>{p.label}</span>
                      <span className="pill" style={{background: s.bg, color: s.color}}>{s.label}</span>
                    </div>
                  </div>

                  <div className="thread">
                    {(t.thread || []).map(m => (
                      <div key={m.id} className={`msg ${m.sender_role}`}>
                        <div className="msg-bubble">
                          {m.message}
                          <div className="msg-meta">
                            {m.sender_role === "borrower" ? "You" : "Support"} · {new Date(m.created_at).toLocaleString("en-IN", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canReply && (
                    <div className="reply-section">
                      {!replyOpen[t.id] ? (
                        <button className="reply-toggle" onClick={() => setReplyOpen({...replyOpen, [t.id]: true})}>
                          {t.status === "resolved" ? "↩ Reply / Follow up" : "💬 Add reply"}
                        </button>
                      ) : (
                        <>
                          <textarea
                            value={replyText[t.id] || ""}
                            onChange={e => setReplyText({...replyText, [t.id]: e.target.value})}
                            placeholder="Type your follow-up message..."
                            style={{
                              width: "100%", padding: "10px 12px", border: "1px solid #e0e4ec",
                              borderRadius: 8, fontSize: 13, fontFamily: "inherit", minHeight: 70, resize: "vertical", marginBottom: 8
                            }} />
                          <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                            <button className="btn btn-secondary"
                              style={{padding: "8px 14px", fontSize: 12}}
                              onClick={() => setReplyOpen({...replyOpen, [t.id]: false})}>
                              Cancel
                            </button>
                            <button className="btn btn-primary"
                              style={{padding: "8px 14px", fontSize: 12}}
                              onClick={() => sendReply(t.id)}>
                              Send reply
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}