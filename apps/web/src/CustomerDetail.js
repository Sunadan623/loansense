import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from "chart.js";
import AppShell from "./AppShell";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const PURPOSE_COLORS = {
  personal: "#4a90e2", home: "#7048e8", car: "#e74c3c",
  education: "#f39c12", business: "#16a085", medical: "#e91e63", gold: "#daa520"
};

const styles = `
  .cd-back { background: none; border: none; color: #5a6378; font-size: 13px; font-weight: 500; cursor: pointer; padding: 0; margin-bottom: 18px; font-family: inherit; }
  .cd-back:hover { color: #1a1a2e; }
  .cd-header { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 22px 24px; margin-bottom: 16px; display: flex; align-items: center; gap: 18px; }
  .cd-avatar { width: 56px; height: 56px; border-radius: 50%; background: #1a1a2e; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; flex-shrink: 0; }
  .cd-name { font-size: 20px; font-weight: 700; color: #1a1a2e; }
  .cd-meta { font-size: 13px; color: #8892a4; margin-top: 3px; }
  .cd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
  .cd-stat { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 16px 18px; }
  .cd-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8892a4; font-weight: 600; }
  .cd-stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-top: 6px; font-family: 'DM Mono', monospace; }
  .cd-section { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 20px 22px; margin-bottom: 16px; }
  .cd-section-title { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 14px; }
  .cd-loan { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f4f6fa; align-items: center; font-size: 13px; }
  .cd-loan:last-child { border-bottom: none; }
  .cd-loan-purpose { font-weight: 600; color: #1a1a2e; text-transform: capitalize; }
  .cd-loan-sub { font-size: 11px; color: #8892a4; font-family: 'DM Mono', monospace; }
  .cd-cell { color: #5a6378; font-family: 'DM Mono', monospace; }
  .risk-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 7px; display: inline-block; }
  .risk-LOW { background: #e8f6ed; color: #1a7a3c; }
  .risk-MEDIUM { background: #fff3cd; color: #856404; }
  .risk-HIGH { background: #fde8e8; color: #c0392b; }
  .cd-ticket { padding: 10px 0; border-bottom: 1px solid #f4f6fa; display: flex; justify-content: space-between; align-items: center; }
  .cd-ticket:last-child { border-bottom: none; }
  .cd-ticket-subj { font-size: 13px; color: #1a1a2e; font-weight: 500; }
  .cd-ticket-row { padding: 12px 0; border-bottom: 1px solid #f4f6fa; }
  .cd-ticket-row:last-child { border-bottom: none; }
  .cd-ticket-head { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
  .cd-thread { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .cd-bubble { max-width: 80%; padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.45; }
  .cd-bubble-borrower { align-self: flex-start; background: #f0f2f7; color: #1a1a2e; border-bottom-left-radius: 4px; }
  .cd-bubble-analyst { align-self: flex-end; background: #1a7a3c; color: #fff; border-bottom-right-radius: 4px; }
  .cd-bubble-meta { font-size: 10px; opacity: 0.6; margin-top: 3px; }
  .cd-reply { margin-top: 12px; }
  .cd-reply textarea { width: 100%; box-sizing: border-box; border: 1px solid #e0e4ec; border-radius: 9px; padding: 10px 12px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 60px; }
  .cd-reply-actions { display: flex; gap: 8px; margin-top: 8px; }
  .cd-reply-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; }
  .cd-reply-resolve { background: #1a7a3c; color: #fff; }
  .cd-reply-open { background: #fff; color: #1a1a2e; border: 1px solid #e0e4ec; }
  .cd-ai { background: linear-gradient(135deg, #6a5af9, #7048e8); color: #fff; border-radius: 14px; padding: 22px 24px; margin-bottom: 16px; }
  .cd-ai-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .cd-ai-body { font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
  .cd-ai-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .cd-ai-btn:hover { background: rgba(255,255,255,0.3); }
  .cd-loading { color: #8892a4; padding: 40px; text-align: center; }
  @media (max-width: 880px) { .cd-stats { grid-template-columns: repeat(2,1fr); } }
`;

const fmtMoney = (n) => {
  if (n >= 10000000) return "₹" + (n/10000000).toFixed(2) + "Cr";
  if (n >= 100000) return "₹" + (n/100000).toFixed(2) + "L";
  if (n >= 1000) return "₹" + (n/1000).toFixed(1) + "K";
  return "₹" + Math.round(n);
};

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data } = await axios.get(`${API}/analyst/customer/${customerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(data);
      } catch (e) {
        console.error("Failed to load customer", e);
        setData({ error: true });
      }
      setLoading(false);
    };
    load();
  }, [customerId]);

  const runAiAnalysis = async () => {
    setAiLoading(true);
    const token = localStorage.getItem("token");
    try {
      const { data } = await axios.get(`${API}/analyst/customer/${customerId}/ai-analysis`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiText(data.analysis || data.error || "No analysis available.");
    } catch (e) {
      setAiText("Failed to generate analysis. Please try again.");
    }
    setAiLoading(false);
  };

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
      // Reload customer data to refresh the thread
      const { data: fresh } = await axios.get(`${API}/analyst/customer/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(fresh);
      setReplyText("");
      setExpandedTicket(null);
    } catch (e) {
      alert("Failed to send reply.");
    }
    setReplying(false);
  };

  if (loading) return <AppShell title="Customer"><style>{styles}</style><div className="cd-loading">Loading customer…</div></AppShell>;
  if (!data || data.error) return <AppShell title="Customer"><style>{styles}</style><div className="cd-loading">Customer not found.</div></AppShell>;

  const { customer, summary, loans, tickets } = data;
  const initials = (customer.name || "U").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

  // Risk distribution for THIS customer's loans
  const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  loans.forEach(l => { if (riskCounts[l.risk_level] !== undefined) riskCounts[l.risk_level]++; });
  const riskChart = {
    labels: ["Low", "Medium", "High"],
    datasets: [{
      label: "Loans",
      data: [riskCounts.LOW, riskCounts.MEDIUM, riskCounts.HIGH],
      backgroundColor: ["#1a7a3c", "#daa520", "#c0392b"],
      borderRadius: 6,
    }]
  };

  // Exposure by loan type for THIS customer
  const byPurpose = {};
  loans.forEach(l => { byPurpose[l.purpose] = (byPurpose[l.purpose] || 0) + l.loan_amnt; });
  const purposeKeys = Object.keys(byPurpose);
  const purposeChart = {
    labels: purposeKeys.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
    datasets: [{
      data: purposeKeys.map(p => byPurpose[p]),
      backgroundColor: purposeKeys.map(p => PURPOSE_COLORS[p] || "#8892a4"),
      borderWidth: 0,
    }]
  };
  const barOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
  const donutOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, padding: 12 } } } };

  return (
    <AppShell title="Customer Profile">
      <style>{styles}</style>
      <button className="cd-back" onClick={() => navigate("/customers")}>← Back to customers</button>

      <div className="cd-header">
        <div className="cd-avatar">{initials}</div>
        <div>
          <div className="cd-name">{customer.name}</div>
          <div className="cd-meta">
            {customer.email}
            {customer.age ? ` · ${customer.age}y` : ""}
            {customer.gender ? ` · ${customer.gender}` : ""}
            {customer.employment_type ? ` · ${customer.employment_type}` : ""}
          </div>
        </div>
      </div>

      <div className="cd-stats">
        <div className="cd-stat">
          <div className="cd-stat-label">Total Exposure</div>
          <div className="cd-stat-value">{fmtMoney(summary.total_exposure)}</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-label">Active Loans</div>
          <div className="cd-stat-value">{summary.active_loans}</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-label">Total Paid</div>
          <div className="cd-stat-value">{fmtMoney(summary.total_paid)}</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-label">Partial Payments</div>
          <div className="cd-stat-value">{summary.partial_payments}/{summary.total_payments}</div>
        </div>
      </div>

      <div className="cd-ai">
        <div className="cd-ai-title">🤖 AI Risk Analysis</div>
        {aiText ? (
          <div className="cd-ai-body">{aiText}</div>
        ) : (
          <>
            <div className="cd-ai-body" style={{marginBottom: 14, opacity: 0.9}}>
              Generate an AI-driven assessment of this customer's risk profile, payment behavior, and recommended actions.
            </div>
            <button className="cd-ai-btn" onClick={runAiAnalysis} disabled={aiLoading}>
              {aiLoading ? "Analyzing…" : "Generate Analysis"}
            </button>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="cd-section" style={{ marginBottom: 0 }}>
          <div className="cd-section-title">⚠ Risk Distribution</div>
          <div style={{ height: 240 }}><Bar data={riskChart} options={barOpts} /></div>
        </div>
        <div className="cd-section" style={{ marginBottom: 0 }}>
          <div className="cd-section-title">📊 Exposure by Loan Type</div>
          {purposeKeys.length ? <div style={{ height: 240 }}><Doughnut data={purposeChart} options={donutOpts} /></div> :
            <div style={{color:"#8892a4",fontSize:13,padding:20}}>No loans</div>}
        </div>
      </div>

      <div className="cd-section">
        <div className="cd-section-title">Loans ({loans.length})</div>
        {loans.map(l => (
          <div key={l.id} className="cd-loan">
            <div>
              <div className="cd-loan-purpose">{l.purpose} Loan</div>
              <div className="cd-loan-sub">#{l.id} · {l.term}mo @ {l.int_rate}%</div>
            </div>
            <div className="cd-cell">{fmtMoney(l.loan_amnt)}</div>
            <div className="cd-cell">EMI {fmtMoney(l.installment)}</div>
            <div><span className={`risk-pill risk-${l.risk_level}`}>{l.risk_level}</span></div>
            <div className="cd-cell">{l.carryover_balance > 0 ? `⚠ ${fmtMoney(l.carryover_balance)}` : l.status}</div>
          </div>
        ))}
      </div>

      <div className="cd-section">
        <div className="cd-section-title">Support Tickets ({tickets.length})</div>
        {tickets.length === 0 ? (
          <div style={{color: "#8892a4", fontSize: 13}}>No support tickets.</div>
        ) : tickets.map(t => (
          <div key={t.id} className="cd-ticket-row">
            <div className="cd-ticket-head" onClick={() => setExpandedTicket(expandedTicket === t.id ? null : t.id)}>
              <div className="cd-ticket-subj">{t.subject}</div>
              <span className={`risk-pill risk-MEDIUM`}>{t.status} {expandedTicket === t.id ? "▴" : "▾"}</span>
            </div>
            {expandedTicket === t.id && (
              <>
                <div className="cd-thread">
                  {(t.thread || []).map(m => (
                    <div key={m.id} className={`cd-bubble ${m.sender_role === "analyst" ? "cd-bubble-analyst" : "cd-bubble-borrower"}`}>
                      <div>{m.message}</div>
                      <div className="cd-bubble-meta">
                        {m.sender_role === "analyst" ? "You" : "Customer"}
                        {m.created_at ? " · " + new Date(m.created_at).toLocaleDateString("en-IN", {day:"2-digit",month:"short"}) : ""}
                      </div>
                    </div>
                  ))}
                </div>
                {t.status !== "closed" && (
                  <div className="cd-reply">
                    <textarea
                      placeholder="Type your reply to the customer…"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                    />
                    <div className="cd-reply-actions">
                      <button className="cd-reply-btn cd-reply-resolve" disabled={replying} onClick={() => submitReply(t.id, "resolved")}>
                        {replying ? "Sending…" : "Send & Resolve"}
                      </button>
                      <button className="cd-reply-btn cd-reply-open" disabled={replying} onClick={() => submitReply(t.id, "in_progress")}>
                        Send & Keep Open
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
