import { useState, useEffect } from "react";
import axios from "axios";

const borrowers = [
  { id: 1, name: "Rahul Sharma", initials: "RS", loan_amnt: 15000, term: 60, int_rate: 22.5, installment: 420, grade: 5, emp_length: 2, annual_inc: 45000, dti: 28, fico_range_low: 650, fico_range_high: 654, fico_avg: 652 },
  { id: 2, name: "Priya Patel", initials: "PP", loan_amnt: 8000, term: 36, int_rate: 8.5, installment: 180, grade: 2, emp_length: 7, annual_inc: 85000, dti: 10, fico_range_low: 760, fico_range_high: 764, fico_avg: 762 },
  { id: 3, name: "Amit Singh", initials: "AS", loan_amnt: 20000, term: 60, int_rate: 18.0, installment: 500, grade: 4, emp_length: 3, annual_inc: 55000, dti: 22, fico_range_low: 690, fico_range_high: 694, fico_avg: 692 },
  { id: 4, name: "Neha Gupta", initials: "NG", loan_amnt: 5000, term: 36, int_rate: 6.5, installment: 110, grade: 1, emp_length: 10, annual_inc: 120000, dti: 7, fico_range_low: 800, fico_range_high: 804, fico_avg: 802 },
  { id: 5, name: "Vikram Joshi", initials: "VJ", loan_amnt: 25000, term: 60, int_rate: 24.0, installment: 650, grade: 6, emp_length: 1, annual_inc: 40000, dti: 35, fico_range_low: 630, fico_range_high: 634, fico_avg: 632 },
  { id: 6, name: "Ananya Mehta", initials: "AM", loan_amnt: 12000, term: 36, int_rate: 14.0, installment: 310, grade: 3, emp_length: 5, annual_inc: 70000, dti: 18, fico_range_low: 710, fico_range_high: 714, fico_avg: 712 },
];

const RISK = {
  HIGH:   { bg: "#fff0f0", text: "#c0392b", bar: "#e74c3c", dot: "#e74c3c", avatarBg: "#fde8e8", avatarText: "#c0392b" },
  MEDIUM: { bg: "#fffbf0", text: "#b7770d", bar: "#f39c12", dot: "#f39c12", avatarBg: "#fef3d0", avatarText: "#b7770d" },
  LOW:    { bg: "#f0fff4", text: "#1a7a3c", bar: "#27ae60", dot: "#27ae60", avatarBg: "#d4f5e2", avatarText: "#1a7a3c" },
  UNKNOWN:{ bg: "#f5f5f5", text: "#888",    bar: "#ccc",    dot: "#ccc",    avatarBg: "#eee",    avatarText: "#888" },
};

const gradeLabel = (g) => ["", "A", "B", "C", "D", "E", "F", "G"][g] || "?";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f7f8fc; font-family: 'DM Sans', sans-serif; color: #1a1a2e; }
  .app { min-height: 100vh; padding: 32px 24px; max-width: 1100px; margin: 0 auto; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 40px; height: 40px; background: #1a1a2e; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .logo-icon svg { width: 22px; height: 22px; fill: none; stroke: #fff; stroke-width: 2; }
  .logo-title { font-size: 22px; font-weight: 600; letter-spacing: -0.5px; color: #1a1a2e; }
  .logo-sub { font-size: 13px; color: #8892a4; margin-top: 2px; font-weight: 400; }
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat-card { background: #fff; border-radius: 14px; padding: 18px 20px; border: 1px solid #eaedf3; }
  .stat-label { font-size: 12px; color: #8892a4; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .stat-value { font-size: 26px; font-weight: 600; color: #1a1a2e; letter-spacing: -1px; }
  .stat-sub { font-size: 12px; color: #8892a4; margin-top: 4px; }
  .table-card { background: #fff; border-radius: 16px; border: 1px solid #eaedf3; overflow: hidden; }
  .table-header { padding: 20px 24px 16px; border-bottom: 1px solid #f0f2f7; display: flex; align-items: center; justify-content: space-between; }
  .table-title { font-size: 15px; font-weight: 600; color: #1a1a2e; }
  .table-count { font-size: 13px; color: #8892a4; background: #f0f2f7; padding: 4px 10px; border-radius: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { padding: 10px 16px; font-size: 11px; font-weight: 600; color: #8892a4; text-transform: uppercase; letter-spacing: 0.6px; text-align: left; background: #f9fafc; border-bottom: 1px solid #f0f2f7; }
  tbody tr { border-bottom: 1px solid #f7f8fc; cursor: pointer; transition: background 0.15s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: #f9fafc; }
  tbody tr.active { background: #f4f6ff; }
  td { padding: 14px 16px; font-size: 14px; color: #2d3561; vertical-align: middle; }
  .avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
  .borrower-cell { display: flex; align-items: center; gap: 10px; }
  .borrower-name { font-weight: 500; font-size: 14px; color: #1a1a2e; }
  .borrower-grade { font-size: 11px; color: #8892a4; font-family: 'DM Mono', monospace; margin-top: 1px; }
  .mono { font-family: 'DM Mono', monospace; font-size: 13px; }
  .risk-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .risk-dot { width: 6px; height: 6px; border-radius: 50%; }
  .score-bar-wrap { display: flex; align-items: center; gap: 8px; }
  .score-bar-bg { width: 60px; height: 5px; background: #eaedf3; border-radius: 99px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
  .score-text { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; min-width: 36px; }
  .detail-panel { background: #fff; border-radius: 16px; border: 1px solid #eaedf3; margin-top: 20px; overflow: hidden; animation: slideDown 0.2s ease; }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .detail-header { padding: 20px 24px; border-bottom: 1px solid #f0f2f7; display: flex; align-items: center; gap: 14px; }
  .detail-avatar { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; }
  .detail-name { font-size: 16px; font-weight: 600; color: #1a1a2e; }
  .detail-meta { font-size: 13px; color: #8892a4; margin-top: 2px; }
  .detail-body { padding: 20px 24px; }
  .detail-section-title { font-size: 11px; font-weight: 600; color: #8892a4; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px; }
  .reason-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f7f8fc; }
  .reason-row:last-child { border-bottom: none; }
  .reason-left { display: flex; align-items: center; gap: 10px; }
  .reason-icon { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .reason-feat { font-size: 13px; font-weight: 500; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .reason-val { font-size: 12px; color: #8892a4; margin-top: 1px; }
  .reason-right { text-align: right; }
  .reason-impact { font-size: 12px; font-weight: 600; }
  .reason-shap { font-size: 11px; color: #8892a4; font-family: 'DM Mono', monospace; margin-top: 2px; }
  .shap-bar-wrap { display: flex; align-items: center; gap: 6px; justify-content: flex-end; margin-top: 4px; }
  .shap-bar { height: 4px; border-radius: 99px; min-width: 4px; max-width: 80px; }
  .loading-row td { text-align: center; padding: 40px; color: #8892a4; font-size: 14px; }
  .pulse { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
`;

export default function App() {
  const [results, setResults] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
const [dbStats, setDbStats] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      const res = {};
      // Fetch live stats from PostgreSQL
      try {
        const { data: statsData } = await axios.get("http://127.0.0.1:8000/stats");
setDbStats(statsData);
      } catch (e) {
        console.log("Stats fetch failed");
      }
      for (const b of borrowers) {
        try {
          const { data } = await axios.post("http://127.0.0.1:8000/predict", b);
          res[b.id] = data;
        } catch {
          res[b.id] = { risk_score: 0, risk_level: "UNKNOWN", reasons: [] };
        }
      }
      setResults(res);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const highCount = Object.values(results).filter(r => r.risk_level === "HIGH").length;
  const medCount = Object.values(results).filter(r => r.risk_level === "MEDIUM").length;
  const avgScore = Object.values(results).length
    ? (Object.values(results).reduce((s, r) => s + r.risk_score, 0) / Object.values(results).length * 100).toFixed(0)
    : "--";

  const selectedBorrower = borrowers.find(b => b.id === selected);
  const selectedResult = selected ? results[selected] : null;
  const maxShap = selectedResult
    ? Math.max(...selectedResult.reasons.map(r => Math.abs(r.shap_value)))
    : 1;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div>
              <div className="logo-title">LoanSense</div>
              <div className="logo-sub">AI-powered default prediction · India NBFC</div>
            </div>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Borrowers</div>
            <div className="stat-value">{borrowers.length}</div>
            <div className="stat-sub">Active portfolio</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">High Risk</div>
            <div className="stat-value" style={{ color: "#e74c3c" }}>{dbStats ? dbStats.high : highCount}</div>
            <div className="stat-sub">Needs attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Medium Risk</div>
            <div className="stat-value" style={{ color: "#f39c12" }}>{loading ? "--" : medCount}</div>
            <div className="stat-sub">Monitor closely</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Risk Score</div>
            <div className="stat-value">{loading ? "--" : avgScore + "%"}</div>
            <div className="stat-sub">Portfolio average</div>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <span className="table-title">Borrower Risk Overview</span>
            <span className="table-count">{borrowers.length} borrowers</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Loan Amount</th>
                <th>Interest</th>
                <th>DTI</th>
                <th>FICO</th>
                <th>Term</th>
                <th>Risk Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="loading-row">
                  <td colSpan={8}>
                    <span className="pulse">Fetching predictions...</span>
                  </td>
                </tr>
              ) : borrowers.map(b => {
                const r = results[b.id];
                const colors = RISK[r?.risk_level || "UNKNOWN"];
                const score = r ? Math.round(r.risk_score * 100) : 0;
                return (
                  <tr key={b.id} className={selected === b.id ? "active" : ""}
                    onClick={() => setSelected(selected === b.id ? null : b.id)}>
                    <td>
                      <div className="borrower-cell">
                        <div className="avatar" style={{ background: colors.avatarBg, color: colors.avatarText }}>
                          {b.initials}
                        </div>
                        <div>
                          <div className="borrower-name">{b.name}</div>
                          <div className="borrower-grade">Grade {gradeLabel(b.grade)} · {b.emp_length}yr exp</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">₹{b.loan_amnt.toLocaleString()}</td>
                    <td className="mono">{b.int_rate}%</td>
                    <td className="mono">{b.dti}</td>
                    <td className="mono">{b.fico_avg}</td>
                    <td className="mono">{b.term}mo</td>
                    <td>
                      <div className="score-bar-wrap">
                        <div className="score-bar-bg">
                          <div className="score-bar-fill" style={{ width: score + "%", background: colors.bar }} />
                        </div>
                        <span className="score-text" style={{ color: colors.text }}>{score}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="risk-badge" style={{ background: colors.bg, color: colors.text }}>
                        <span className="risk-dot" style={{ background: colors.dot }} />
                        {r?.risk_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedBorrower && selectedResult && (
          <div className="detail-panel">
            <div className="detail-header">
              <div className="detail-avatar"
                style={{ background: RISK[selectedResult.risk_level].avatarBg, color: RISK[selectedResult.risk_level].avatarText }}>
                {selectedBorrower.initials}
              </div>
              <div>
                <div className="detail-name">Why is {selectedBorrower.name} flagged?</div>
                <div className="detail-meta">
                  Risk score: {Math.round(selectedResult.risk_score * 100)}% ·
                  Loan ₹{selectedBorrower.loan_amnt.toLocaleString()} ·
                  {selectedResult.risk_level} RISK
                </div>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-section-title">Top risk factors (SHAP explanation)</div>
              {selectedResult.reasons.map((r, i) => {
                const isIncrease = r.impact === "increases risk";
                const barWidth = Math.round((Math.abs(r.shap_value) / maxShap) * 80);
                return (
                  <div className="reason-row" key={i}>
                    <div className="reason-left">
                      <div className="reason-icon"
                        style={{ background: isIncrease ? "#fde8e8" : "#d4f5e2", color: isIncrease ? "#c0392b" : "#1a7a3c" }}>
                        {isIncrease ? "↑" : "↓"}
                      </div>
                      <div>
                        <div className="reason-feat">{r.feature}</div>
                        <div className="reason-val">value: {r.value.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="reason-right">
                      <div className="reason-impact" style={{ color: isIncrease ? "#c0392b" : "#1a7a3c" }}>
                        {isIncrease ? "Increases risk" : "Decreases risk"}
                      </div>
                      <div className="shap-bar-wrap">
                        <div className="shap-bar"
                          style={{ width: barWidth + "px", background: isIncrease ? "#e74c3c" : "#27ae60" }} />
                        <span className="reason-shap">{r.shap_value > 0 ? "+" : ""}{r.shap_value}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}