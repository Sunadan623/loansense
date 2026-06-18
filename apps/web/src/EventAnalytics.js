import { useState, useEffect } from "react";
import axios from "axios";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from "chart.js";
import AppShell from "./AppShell";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const fmtMoney = (n) => {
  n = n || 0;
  if (n >= 10000000) return "₹" + (n/10000000).toFixed(2) + "Cr";
  if (n >= 100000) return "₹" + (n/100000).toFixed(2) + "L";
  if (n >= 1000) return "₹" + (n/1000).toFixed(1) + "K";
  return "₹" + Math.round(n);
};

const EVENT_LABELS = {
  login: "Logins",
  affordability_check: "Affordability Checks",
  loan_application_submitted: "Applications",
  payment_succeeded: "Payments",
  deferral_requested: "Deferrals",
};
const EVENT_COLORS = {
  login: "#4a90e2",
  affordability_check: "#f39c12",
  loan_application_submitted: "#7048e8",
  payment_succeeded: "#16a085",
  deferral_requested: "#e74c3c",
};

const styles = `
  .ea-intro { font-size: 13px; color: #5a6378; margin-bottom: 22px; line-height: 1.5; max-width: 600px; }
  .ea-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
  .ea-stat { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 16px 18px; }
  .ea-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8892a4; font-weight: 600; }
  .ea-stat-value { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-top: 6px; font-family: 'DM Mono', monospace; }
  .ea-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .ea-funnel { display: flex; gap: 0; align-items: stretch; margin-top: 8px; }
  .ea-funnel-step { flex: 1; text-align: center; padding: 14px 8px; position: relative; }
  .ea-funnel-num { font-size: 26px; font-weight: 700; font-family: 'DM Mono', monospace; }
  .ea-funnel-label { font-size: 11px; color: #8892a4; margin-top: 4px; }
  .ea-funnel-arrow { display: flex; align-items: center; color: #d0d5e0; font-size: 18px; }
  .ea-stream { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
  .ea-event { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #fff; border: 1px solid #eaedf3; border-radius: 10px; }
  .ea-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .ea-event-main { flex: 1; }
  .ea-event-title { font-size: 13px; font-weight: 600; color: #1a1a2e; }
  .ea-event-sub { font-size: 11px; color: #8892a4; margin-top: 2px; }
  .ea-event-time { font-size: 11px; color: #b0b6c5; font-family: 'DM Mono', monospace; }
  .ea-loading { color: #8892a4; padding: 40px; text-align: center; }
  @media (max-width: 880px) { .ea-grid { grid-template-columns: 1fr; } .ea-stats { grid-template-columns: repeat(2,1fr); } }
`;

function ChartCard({ title, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eaedf3", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f7f8fc" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function EventAnalytics() {
  const [data, setData] = useState(null);
  const [pi, setPi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data } = await axios.get(`${API}/analyst/event-analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(data);
        const piRes = await axios.get(`${API}/analyst/portfolio-intelligence`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPi(piRes.data);
      } catch (e) {
        console.error("Failed to load analytics", e);
        setData({ error: true });
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <AppShell title="Analytics"><style>{styles}</style><div className="ea-loading">Loading analytics…</div></AppShell>;
  }

  const vol = data?.event_volume || [];
  const daily = data?.daily_activity || [];
  const funnel = data?.funnel || {};
  const deferral = data?.deferral_trend || [];
  const recent = data?.recent_activity || [];

  const volChart = {
    labels: vol.map(v => EVENT_LABELS[v.type] || v.type),
    datasets: [{
      label: "Events",
      data: vol.map(v => v.count),
      backgroundColor: vol.map(v => EVENT_COLORS[v.type] || "#8892a4"),
      borderRadius: 6,
    }]
  };

  const dailyChart = {
    labels: daily.map(d => d.day),
    datasets: [{
      label: "Events per day",
      data: daily.map(d => d.count),
      borderColor: "#7048e8",
      backgroundColor: "rgba(112,72,232,0.1)",
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }]
  };

  const deferralChart = {
    labels: deferral.map(d => d.day),
    datasets: [{
      label: "Deferral requests",
      data: deferral.map(d => d.count),
      borderColor: "#e74c3c",
      backgroundColor: "rgba(231,76,60,0.1)",
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }]
  };

  const chartOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
  };

  const fmtTime = (s) => {
    const dt = new Date(s);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " +
           dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <AppShell title="Analytics">
      <style>{styles}</style>
      <div className="ea-intro">
        Behavioral analytics from the live event stream. Every login, application, payment, and deferral is captured and analyzed here in real time.
      </div>

      {pi && !pi.error && (
        <>
          <div style={{fontSize: 15, fontWeight: 700, color: "#1a1a2e", margin: "4px 0 14px"}}>📊 Portfolio Intelligence</div>
          <div className="ea-stats">
            <div className="ea-stat">
              <div className="ea-stat-label">Total Exposure</div>
              <div className="ea-stat-value">{fmtMoney(pi.total_exposure)}</div>
            </div>
            <div className="ea-stat">
              <div className="ea-stat-label">Collection Rate</div>
              <div className="ea-stat-value" style={{color: pi.collection.rate >= 80 ? "#1a7a3c" : pi.collection.rate >= 60 ? "#856404" : "#c0392b"}}>{pi.collection.rate}%</div>
            </div>
            <div className="ea-stat">
              <div className="ea-stat-label">EMI Backlog</div>
              <div className="ea-stat-value" style={{color: pi.backlog.total > 0 ? "#c0392b" : "#1a1a2e"}}>{fmtMoney(pi.backlog.total)}</div>
            </div>
            <div className="ea-stat">
              <div className="ea-stat-label">Partial Payments</div>
              <div className="ea-stat-value">{pi.payment_health.partial}/{pi.payment_health.total}</div>
            </div>
          </div>

          <div className="ea-grid">
            <ChartCard title="💰 Risk-Weighted Exposure">
              <div style={{height: 240}}>
                <Bar
                  data={{
                    labels: ["Low", "Medium", "High"],
                    datasets: [{
                      label: "Exposure",
                      data: [pi.risk_exposure.LOW, pi.risk_exposure.MEDIUM, pi.risk_exposure.HIGH],
                      backgroundColor: ["#1a7a3c", "#daa520", "#c0392b"],
                      borderRadius: 6,
                    }]
                  }}
                  options={{responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {y: {beginAtZero: true, ticks: {callback: v => "₹" + (v/100000) + "L"}}}}}
                />
              </div>
            </ChartCard>
            <ChartCard title="✅ Payment Health">
              <div style={{height: 240}}>
                <Bar
                  data={{
                    labels: ["Full", "Partial"],
                    datasets: [{
                      label: "Payments",
                      data: [pi.payment_health.full, pi.payment_health.partial],
                      backgroundColor: ["#16a085", "#e67e22"],
                      borderRadius: 6,
                    }]
                  }}
                  options={{responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {y: {beginAtZero: true, ticks: {precision: 0}}}}}
                />
              </div>
            </ChartCard>
          </div>

          <ChartCard title="🏆 Top Borrowers by Exposure">
            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
              {pi.top_borrowers.map((b, i) => (
                <div key={b.user_id} style={{display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < pi.top_borrowers.length-1 ? "1px solid #f4f6fa" : "none"}}>
                  <div style={{width: 24, fontWeight: 700, color: "#8892a4", fontFamily: "DM Mono, monospace"}}>{i+1}</div>
                  <div style={{flex: 1, fontWeight: 600, color: "#1a1a2e"}}>{b.name}</div>
                  <div style={{fontFamily: "DM Mono, monospace", fontWeight: 700, color: "#1a1a2e"}}>{fmtMoney(b.exposure)}</div>
                </div>
              ))}
            </div>
          </ChartCard>

          <div style={{fontSize: 15, fontWeight: 700, color: "#1a1a2e", margin: "24px 0 14px"}}>📡 Behavioral Event Stream</div>
        </>
      )}

      <div className="ea-stats">
        <div className="ea-stat">
          <div className="ea-stat-label">Total Events</div>
          <div className="ea-stat-value">{data?.total_events ?? 0}</div>
        </div>
        <div className="ea-stat">
          <div className="ea-stat-label">Affordability Checks</div>
          <div className="ea-stat-value">{funnel.affordability_checks ?? 0}</div>
        </div>
        <div className="ea-stat">
          <div className="ea-stat-label">Applications</div>
          <div className="ea-stat-value">{funnel.applications ?? 0}</div>
        </div>
        <div className="ea-stat">
          <div className="ea-stat-label">Payments</div>
          <div className="ea-stat-value">{funnel.payments ?? 0}</div>
        </div>
      </div>

      <div className="ea-grid">
        <ChartCard title="📊 Event Volume by Type">
          {vol.length ? <Bar data={volChart} options={chartOpts} /> :
            <div className="ea-loading">No events yet</div>}
        </ChartCard>
        <ChartCard title="📈 Activity (Last 14 Days)">
          <Line data={dailyChart} options={chartOpts} />
        </ChartCard>
      </div>

      <div className="ea-grid">
        <ChartCard title="🎯 Conversion Funnel">
          <div className="ea-funnel">
            <div className="ea-funnel-step">
              <div className="ea-funnel-num" style={{color: "#f39c12"}}>{funnel.affordability_checks ?? 0}</div>
              <div className="ea-funnel-label">Affordability Checks</div>
            </div>
            <div className="ea-funnel-arrow">→</div>
            <div className="ea-funnel-step">
              <div className="ea-funnel-num" style={{color: "#7048e8"}}>{funnel.applications ?? 0}</div>
              <div className="ea-funnel-label">Applications</div>
            </div>
            <div className="ea-funnel-arrow">→</div>
            <div className="ea-funnel-step">
              <div className="ea-funnel-num" style={{color: "#16a085"}}>{funnel.payments ?? 0}</div>
              <div className="ea-funnel-label">Payments</div>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="🚨 Deferral Requests (Distress Signal)">
          <Line data={deferralChart} options={chartOpts} />
        </ChartCard>
      </div>

      <ChartCard title="🔴 Live Activity Stream">
        <div className="ea-stream">
          {recent.length === 0 ? (
            <div className="ea-loading">No activity yet</div>
          ) : recent.map(ev => (
            <div key={ev.id} className="ea-event">
              <div className="ea-dot" style={{background: EVENT_COLORS[ev.event_type] || "#8892a4"}}></div>
              <div className="ea-event-main">
                <div className="ea-event-title">
                  {ev.user_name} — {EVENT_LABELS[ev.event_type] || ev.event_type}
                </div>
                <div className="ea-event-sub">
                  {ev.event_category}{ev.loan_id ? ` · loan #${ev.loan_id}` : ""}
                  {ev.metadata && ev.metadata.amount ? ` · ₹${Math.round(ev.metadata.amount).toLocaleString("en-IN")}` : ""}
                  {ev.metadata && ev.metadata.purpose ? ` · ${ev.metadata.purpose}` : ""}
                </div>
              </div>
              <div className="ea-event-time">{fmtTime(ev.created_at)}</div>
            </div>
          ))}
        </div>
      </ChartCard>
    </AppShell>
  );
}
