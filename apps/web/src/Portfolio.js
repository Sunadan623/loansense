import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const PURPOSE_COLORS = {
  personal: "#4a90e2", home: "#7048e8", car: "#e74c3c",
  education: "#f39c12", business: "#16a085", medical: "#e91e63", gold: "#daa520"
};
const PURPOSE_ICONS = {
  personal: "👤", home: "🏠", car: "🚗", education: "🎓",
  business: "💼", medical: "🏥", gold: "🥇"
};

const styles = `
  .pf-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .pf-card { background: #fff; border: 1px solid #eaedf3; border-radius: 16px; padding: 22px; }
  .pf-card-title { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px; }
  .pf-cibil-wrap { display: flex; align-items: center; gap: 22px; }
  .pf-gauge { position: relative; width: 130px; height: 130px; flex-shrink: 0; }
  .pf-gauge svg { transform: rotate(-90deg); }
  .pf-gauge-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .pf-gauge-score { font-size: 30px; font-weight: 700; color: #1a1a2e; font-family: 'DM Mono', monospace; line-height: 1; }
  .pf-gauge-max { font-size: 11px; color: #8892a4; margin-top: 2px; }
  .pf-cibil-info { flex: 1; }
  .pf-cibil-rating { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .pf-cibil-sub { font-size: 12px; color: #8892a4; line-height: 1.5; }
  .pf-stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pf-stat { padding: 12px 0; }
  .pf-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8892a4; font-weight: 600; }
  .pf-stat-value { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-top: 4px; font-family: 'DM Mono', monospace; }
  .pf-progress-track { height: 8px; background: #f0f2f7; border-radius: 4px; overflow: hidden; margin-top: 10px; }
  .pf-progress-fill { height: 100%; background: #1a7a3c; border-radius: 4px; }
  .pf-types { display: flex; flex-direction: column; gap: 8px; }
  .pf-type-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #eaedf3; border-radius: 10px; cursor: pointer; transition: all 0.12s; }
  .pf-type-row:hover { background: #fafbff; border-color: #d0d5e0; }
  .pf-type-icon { font-size: 20px; }
  .pf-type-name { flex: 1; font-size: 14px; font-weight: 600; color: #1a1a2e; text-transform: capitalize; }
  .pf-type-count { font-size: 12px; color: #8892a4; }
  .pf-type-amount { font-size: 14px; font-weight: 700; font-family: 'DM Mono', monospace; color: #1a1a2e; }
  .pf-headroom { background: linear-gradient(135deg, #1a7a3c, #16a085); color: #fff; border-radius: 16px; padding: 20px 22px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
  .pf-headroom-label { font-size: 13px; opacity: 0.9; }
  .pf-headroom-value { font-size: 26px; font-weight: 700; font-family: 'DM Mono', monospace; margin-top: 4px; }
  .pf-headroom-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .pf-headroom-btn:hover { background: rgba(255,255,255,0.3); }
  @media (max-width: 820px) { .pf-grid { grid-template-columns: 1fr; } }
`;

const fmtMoney = (n) => {
  n = n || 0;
  if (n >= 10000000) return "₹" + (n/10000000).toFixed(2) + "Cr";
  if (n >= 100000) return "₹" + (n/100000).toFixed(2) + "L";
  if (n >= 1000) return "₹" + (n/1000).toFixed(1) + "K";
  return "₹" + Math.round(n);
};

function cibilRating(score) {
  if (!score) return { label: "Not available", color: "#8892a4", desc: "Apply for a loan to establish your credit profile." };
  if (score >= 750) return { label: "Excellent", color: "#1a7a3c", desc: "You qualify for the best interest rates and highest loan amounts." };
  if (score >= 700) return { label: "Good", color: "#16a085", desc: "You get favorable rates on most loan types." };
  if (score >= 650) return { label: "Fair", color: "#daa520", desc: "You qualify for loans, but at higher rates. Improve by paying on time." };
  return { label: "Needs work", color: "#c0392b", desc: "Focus on timely repayments to rebuild your score." };
}

export default function Portfolio() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data } = await axios.get(`${API}/my-portfolio`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(data);
      } catch (e) {
        console.error("Failed to load portfolio", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={{color:"#8892a4", padding:"20px 0"}}>Loading your portfolio…</div>;
  if (!data || data.error) return null;

  const t = data.totals;
  const rating = cibilRating(data.cibil_score);

  // CIBIL gauge geometry (300-900 range)
  const score = data.cibil_score || 300;
  const pct = Math.max(0, Math.min(1, (score - 300) / 600));
  const R = 56, C = 2 * Math.PI * R;
  const dash = C * pct;

  const typeChart = {
    labels: data.type_breakdown.map(x => x.purpose.charAt(0).toUpperCase() + x.purpose.slice(1)),
    datasets: [{
      data: data.type_breakdown.map(x => x.amount),
      backgroundColor: data.type_breakdown.map(x => PURPOSE_COLORS[x.purpose] || "#8892a4"),
      borderWidth: 0,
    }]
  };

  return (
    <>
      <style>{styles}</style>

      {data.borrowing_headroom > 0 && (
        <div className="pf-headroom">
          <div>
            <div className="pf-headroom-label">💡 You can safely borrow up to</div>
            <div className="pf-headroom-value">{fmtMoney(data.borrowing_headroom)}</div>
          </div>
          <button className="pf-headroom-btn" onClick={() => navigate("/affordability")}>Check affordability</button>
        </div>
      )}

      <div className="pf-grid">
        <div className="pf-card">
          <div className="pf-card-title">Credit Standing</div>
          <div className="pf-cibil-wrap">
            <div className="pf-gauge">
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r={R} fill="none" stroke="#f0f2f7" strokeWidth="11" />
                <circle cx="65" cy="65" r={R} fill="none" stroke={rating.color} strokeWidth="11"
                        strokeDasharray={`${dash} ${C}`} strokeLinecap="round" />
              </svg>
              <div className="pf-gauge-label">
                <div className="pf-gauge-score">{data.cibil_score || "—"}</div>
                <div className="pf-gauge-max">/ 900 CIBIL</div>
              </div>
            </div>
            <div className="pf-cibil-info">
              <div className="pf-cibil-rating" style={{color: rating.color}}>{rating.label}</div>
              <div className="pf-cibil-sub">{rating.desc}</div>
            </div>
          </div>
        </div>

        <div className="pf-card">
          <div className="pf-card-title">Portfolio Summary</div>
          <div className="pf-stat-row">
            <div className="pf-stat">
              <div className="pf-stat-label">Total Borrowed</div>
              <div className="pf-stat-value">{fmtMoney(t.total_borrowed)}</div>
            </div>
            <div className="pf-stat">
              <div className="pf-stat-label">Outstanding</div>
              <div className="pf-stat-value">{fmtMoney(t.total_outstanding)}</div>
            </div>
            <div className="pf-stat">
              <div className="pf-stat-label">Total Paid</div>
              <div className="pf-stat-value" style={{color:"#1a7a3c"}}>{fmtMoney(t.total_paid)}</div>
            </div>
            <div className="pf-stat">
              <div className="pf-stat-label">Loans</div>
              <div className="pf-stat-value">{t.active_loans} active · {t.closed_loans} closed</div>
            </div>
          </div>
          <div style={{fontSize:11, color:"#8892a4", marginTop:8}}>Repayment progress · {data.repayment_progress_pct}%</div>
          <div className="pf-progress-track">
            <div className="pf-progress-fill" style={{width: `${Math.min(data.repayment_progress_pct, 100)}%`}}></div>
          </div>
        </div>
      </div>

      <div className="pf-grid">
        <div className="pf-card">
          <div className="pf-card-title">Loans by Type</div>
          <div className="pf-types">
            {data.type_breakdown.length === 0 ? (
              <div style={{color:"#8892a4", fontSize:13}}>No active loans.</div>
            ) : data.type_breakdown.map(x => (
              <div key={x.purpose} className="pf-type-row" onClick={() => navigate(`/active-loans?type=${x.purpose}`)}>
                <span className="pf-type-icon">{PURPOSE_ICONS[x.purpose] || "💰"}</span>
                <span className="pf-type-name">{x.purpose}</span>
                <span className="pf-type-count">{x.count} loan{x.count !== 1 ? "s" : ""}</span>
                <span className="pf-type-amount">{fmtMoney(x.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pf-card">
          <div className="pf-card-title">Exposure Mix</div>
          {data.type_breakdown.length ? (
            <div style={{height: 200}}>
              <Doughnut data={typeChart} options={{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:"bottom", labels:{font:{size:11}, padding:12}}}}} />
            </div>
          ) : <div style={{color:"#8892a4", fontSize:13}}>No data yet.</div>}
        </div>
      </div>
    </>
  );
}
