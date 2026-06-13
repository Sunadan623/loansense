import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const styles = `
  .ue-intro { font-size: 13px; color: #5a6378; margin-bottom: 22px; line-height: 1.5; max-width: 560px; }
  .ue-grid { display: flex; flex-direction: column; gap: 14px; }
  .ue-card { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 20px 22px; display: flex; align-items: center; gap: 20px; }
  .ue-date-badge { flex-shrink: 0; width: 64px; text-align: center; }
  .ue-date-day { font-size: 26px; font-weight: 700; color: #1a1a2e; font-family: 'DM Mono', monospace; line-height: 1; }
  .ue-date-mon { font-size: 12px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
  .ue-info { flex: 1; }
  .ue-purpose { font-size: 15px; font-weight: 600; color: #1a1a2e; text-transform: capitalize; }
  .ue-meta { font-size: 12px; color: #8892a4; margin-top: 3px; font-family: 'DM Mono', monospace; }
  .ue-amount { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-top: 6px; }
  .ue-countdown { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 10px; display: inline-block; margin-top: 6px; }
  .ue-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
  .ue-btn { padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; white-space: nowrap; }
  .ue-btn-pay { background: #1a7a3c; color: #fff; }
  .ue-btn-cal { background: #fff; color: #1a1a2e; border: 1px solid #e0e4ec; }
  .ue-btn-cal:hover { background: #f9fafc; }
  .ue-empty { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 48px; text-align: center; color: #8892a4; font-size: 14px; }
  .ue-loading { color: #8892a4; font-size: 14px; padding: 40px; text-align: center; }
`;

function pad(n) { return String(n).padStart(2, "0"); }

// Build an .ics calendar file for an EMI reminder, with a 1-day-before alarm
function buildICS({ purpose, amount, dueDate, loanId }) {
  const dt = new Date(dueDate);
  const y = dt.getFullYear(), m = pad(dt.getMonth() + 1), d = pad(dt.getDate());
  const dateStr = `${y}${m}${d}`;
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;
  const uid = `loansense-emi-${loanId}-${dateStr}@loansense`;
  const title = `EMI Due: ${purpose} loan - Rs.${Math.round(amount)}`;
  const desc = `Your LoanSense ${purpose} loan EMI of Rs.${Math.round(amount)} is due today. Pay via the LoanSense app to avoid late fees.`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LoanSense//EMI Reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${title} due tomorrow`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function downloadICS(emi) {
  const ics = buildICS(emi);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `emi-reminder-loan-${emi.loanId}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function UpcomingEMIs() {
  const navigate = useNavigate();
  const [emis, setEmis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data: loans } = await axios.get(`${API}/my-loans`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const active = (loans || []).filter(l => l.status === "active");

        const statuses = await Promise.all(active.map(l =>
          axios.get(`${API}/emi-status/${l.id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => ({ loan: l, status: r.data }))
            .catch(() => null)
        ));

        const list = statuses.filter(Boolean).map(({ loan, status }) => ({
          loanId: loan.id,
          purpose: loan.purpose,
          amount: status.expected_emi || loan.installment,
          dueDate: status.next_due_date,
          daysUntilDue: status.days_until_due,
          daysLate: status.days_late,
          inGrace: status.in_grace_period,
        })).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        setEmis(list);
      } catch (e) {
        console.error("Failed to load upcoming EMIs", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const countdownStyle = (emi) => {
    if (emi.daysLate > 0 && !emi.inGrace) return { bg: "#fde8e8", color: "#c0392b", text: `${emi.daysLate} days overdue` };
    if (emi.inGrace) return { bg: "#e7f3ff", color: "#2c5282", text: `In grace period` };
    if (emi.daysUntilDue === 0) return { bg: "#fff3cd", color: "#856404", text: "Due today" };
    if (emi.daysUntilDue <= 7) return { bg: "#fff3cd", color: "#856404", text: `Due in ${emi.daysUntilDue} days` };
    return { bg: "#eef0f5", color: "#5a6378", text: `Due in ${emi.daysUntilDue} days` };
  };

  return (
    <AppShell title="Upcoming EMIs">
      <style>{styles}</style>
      <div className="ue-intro">
        All your EMIs across active loans, sorted by due date. Add reminders to your calendar so you never miss a payment.
      </div>

      {loading ? (
        <div className="ue-loading">Loading your EMI schedule…</div>
      ) : emis.length === 0 ? (
        <div className="ue-empty">No active loans with upcoming EMIs. Once you have an active loan, your payment schedule appears here.</div>
      ) : (
        <div className="ue-grid">
          {emis.map(emi => {
            const dt = new Date(emi.dueDate);
            const cd = countdownStyle(emi);
            return (
              <div key={emi.loanId} className="ue-card">
                <div className="ue-date-badge">
                  <div className="ue-date-day">{pad(dt.getDate())}</div>
                  <div className="ue-date-mon">{dt.toLocaleString("en-IN", { month: "short" })}</div>
                </div>
                <div className="ue-info">
                  <div className="ue-purpose">{emi.purpose} Loan</div>
                  <div className="ue-meta">Loan #{emi.loanId} · Due {dt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
                  <div className="ue-amount">₹{Math.round(emi.amount).toLocaleString("en-IN")}</div>
                  <span className="ue-countdown" style={{ background: cd.bg, color: cd.color }}>{cd.text}</span>
                </div>
                <div className="ue-actions">
                  <button className="ue-btn ue-btn-pay" onClick={() => navigate("/portal")}>Pay now</button>
                  <button className="ue-btn ue-btn-cal" onClick={() => downloadICS(emi)}>📅 Add to Calendar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
