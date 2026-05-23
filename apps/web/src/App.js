import { useState, useEffect } from "react";
import axios from "axios";

const RISK = {
  HIGH:   { bg: "#fff0f0", text: "#c0392b", bar: "#e74c3c", dot: "#e74c3c", avatarBg: "#fde8e8", avatarText: "#c0392b" },
  MEDIUM: { bg: "#fffbf0", text: "#b7770d", bar: "#f39c12", dot: "#f39c12", avatarBg: "#fef3d0", avatarText: "#b7770d" },
  LOW:    { bg: "#f0fff4", text: "#1a7a3c", bar: "#27ae60", dot: "#27ae60", avatarBg: "#d4f5e2", avatarText: "#1a7a3c" },
  UNKNOWN:{ bg: "#f5f5f5", text: "#888",    bar: "#ccc",    dot: "#ccc",    avatarBg: "#eee",    avatarText: "#888" },
};

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
  .ai-card { padding: 14px; margin-bottom: 10px; border-radius: 10px; background: #fafbfc; border: 1px solid #eaedf3; transition: all 0.2s; }
  .ai-card:hover { border-color: #d0d5e0; }
  .ai-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .ai-card-title { font-weight: 600; font-size: 14px; color: #1a1a2e; display: flex; align-items: center; gap: 8px; }
  .ai-card-details { font-size: 13px; color: #5a6378; line-height: 1.5; }
  .priority-badge { padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
`;

export default function App() {
  const [results, setResults] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [pendingApps, setPendingApps] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [approvedApps, setApprovedApps] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      const res = {};
      try {
        const { data: statsData } = await axios.get("http://127.0.0.1:8000/stats");
        setDbStats(statsData);
      } catch (e) { console.log("Stats fetch failed"); }

      try {
        const token = localStorage.getItem("token");
        const { data: pending } = await axios.get("http://127.0.0.1:8000/pending-applications", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(pending)) setPendingApps(pending);
      } catch (e) { console.log("Pending fetch failed"); }

      try {
        const token = localStorage.getItem("token");
        const { data: approved } = await axios.get("http://127.0.0.1:8000/approved-applications", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(approved)) setApprovedApps(approved);
      } catch (e) { console.log("Approved fetch failed"); }

      try {
        const token = localStorage.getItem("token");
        const { data: active } = await axios.get("http://127.0.0.1:8000/active-loans", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(active)) {
          setActiveLoans(active);
          for (const loan of active) {
            try {
              const features = {
                name: loan.borrower_name,
                loan_amnt: loan.loan_amnt,
                term: loan.term,
                int_rate: loan.int_rate,
                installment: loan.installment,
                grade: loan.grade,
                emp_length: loan.emp_length,
                annual_inc: loan.annual_inc,
                dti: loan.dti,
                fico_range_low: loan.fico_avg - 2,
                fico_range_high: loan.fico_avg + 2,
                fico_avg: loan.fico_avg
              };
              const { data: pred } = await axios.post("http://127.0.0.1:8000/predict", features);
              res[loan.id] = pred;
            } catch {
              res[loan.id] = { risk_score: loan.risk_score, risk_level: loan.risk_level, reasons: [] };
            }
          }
        }
      } catch (e) { console.log("Active loans fetch failed"); }

      setResults(res);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleSelect = async (b) => {
    const newSel = selected === b.id ? null : b.id;
    setSelected(newSel);
    setRecommendations(null);
    if (newSel) {
      setLoadingRec(true);
      try {
        const { data } = await axios.post("http://127.0.0.1:8000/recommend", {
          name: b.borrower_name || b.name,
          risk_score: results[b.id]?.risk_score || 0,
          risk_level: results[b.id]?.risk_level || "UNKNOWN",
          int_rate: b.int_rate,
          dti: b.dti,
          loan_amnt: b.loan_amnt,
          days_to_default: results[b.id]?.survival?.days_to_default
        });
        setRecommendations(data);
      } catch (e) {
        setRecommendations({ error: "Failed to load recommendations" });
      }
      setLoadingRec(false);
    }
  };

  const handleApprove = async (loanId) => {
    setActionLoading(loanId);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://127.0.0.1:8000/approve-loan/${loanId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const approvedItem = pendingApps.find(p => p.id === loanId);
      setPendingApps(pendingApps.filter(p => p.id !== loanId));
      if (approvedItem) setApprovedApps([...approvedApps, approvedItem]);
    } catch (e) { alert("Approval failed"); }
    setActionLoading(null);
  };

  const handleReject = async (loanId) => {
    const reason = prompt("Reason for rejection:", "Application did not meet criteria");
    if (!reason) return;
    setActionLoading(loanId);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://127.0.0.1:8000/reject-loan/${loanId}`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPendingApps(pendingApps.filter(p => p.id !== loanId));
    } catch (e) { alert("Rejection failed"); }
    setActionLoading(null);
  };

  const handleDisburse = async (loanId) => {
    setActionLoading(loanId);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://127.0.0.1:8000/disburse-loan/${loanId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const disbursed = approvedApps.find(p => p.id === loanId);
      setApprovedApps(approvedApps.filter(p => p.id !== loanId));
      if (disbursed) setActiveLoans([...activeLoans, disbursed]);
    } catch (e) { alert("Disbursement failed"); }
    setActionLoading(null);
  };

  const highCount = Object.values(results).filter(r => r.risk_level === "HIGH").length;
  const medCount = Object.values(results).filter(r => r.risk_level === "MEDIUM").length;
  const avgScore = Object.values(results).length
    ? (Object.values(results).reduce((s, r) => s + r.risk_score, 0) / Object.values(results).length * 100).toFixed(0)
    : "--";

  const selectedBorrower = activeLoans.find(b => b.id === selected);
  const selectedResult = selected ? results[selected] : null;
  const maxShap = selectedResult && selectedResult.reasons?.length
    ? Math.max(...selectedResult.reasons.map(r => Math.abs(r.shap_value)))
    : 1;

  const purposeIcons = {personal:"👤", home:"🏠", car:"🚗", education:"🎓", business:"💼", medical:"🏥"};

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
            <div className="stat-label">Active Loans</div>
            <div className="stat-value">{activeLoans.length}</div>
            <div className="stat-sub">Currently disbursed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">High Risk</div>
            <div className="stat-value" style={{ color: "#e74c3c" }}>{highCount}</div>
            <div className="stat-sub">Needs attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Medium Risk</div>
            <div className="stat-value" style={{ color: "#f39c12" }}>{loading ? "--" : medCount}</div>
            <div className="stat-sub">Monitor closely</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Risk Score</div>
            <div className="stat-value">{loading || avgScore === "--" ? "--" : avgScore + "%"}</div>
            <div className="stat-sub">Portfolio average</div>
          </div>
        </div>

        {pendingApps.length > 0 && (
          <div className="table-card" style={{marginBottom: 20}}>
            <div className="table-header">
              <span className="table-title">⏳ Pending Loan Applications</span>
              <span className="table-count" style={{background:"#fff3cd", color:"#856404"}}>{pendingApps.length} awaiting review</span>
            </div>
            <div style={{padding: 0}}>
              {pendingApps.map(p => {
                const colors = p.risk_level === "HIGH" ? {bg:"#fff0f0", text:"#c0392b", dot:"#e74c3c"}
                             : p.risk_level === "MEDIUM" ? {bg:"#fffbf0", text:"#b7770d", dot:"#f39c12"}
                             : {bg:"#f0fff4", text:"#1a7a3c", dot:"#27ae60"};
                return (
                  <div key={p.id} style={{
                    display:"flex", alignItems:"center", padding:"18px 24px",
                    borderBottom: "1px solid #f0f2f7", gap: 16
                  }}>
                    <div style={{fontSize: 28}}>{purposeIcons[p.purpose] || "💰"}</div>
                    <div style={{flex: 1}}>
                      <div style={{fontSize: 15, fontWeight: 600, color:"#1a1a2e"}}>
                        {p.borrower_name} <span style={{fontWeight: 400, color:"#8892a4"}}>· {p.borrower_email}</span>
                      </div>
                      <div style={{fontSize: 12, color:"#8892a4", marginTop: 2, fontFamily:"DM Mono, monospace"}}>
                        {p.purpose?.toUpperCase()} · ₹{p.loan_amnt.toLocaleString()} · {p.term}mo · {p.int_rate}% · DTI {p.dti}
                      </div>
                    </div>
                    <span className="risk-badge" style={{background: colors.bg, color: colors.text}}>
                      <span className="risk-dot" style={{background: colors.dot}} />
                      {p.risk_level} · {Math.round(p.risk_score * 100)}%
                    </span>
                    <button onClick={() => handleReject(p.id)} disabled={actionLoading === p.id}
                      style={{padding:"8px 16px", background:"#fff", color:"#c0392b", border:"1px solid #f5c6cb",
                              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor:"pointer", fontFamily:"inherit"}}>
                      Reject
                    </button>
                    <button onClick={() => handleApprove(p.id)} disabled={actionLoading === p.id}
                      style={{padding:"8px 16px", background:"#1a7a3c", color:"#fff", border:"none",
                              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor:"pointer", fontFamily:"inherit"}}>
                      {actionLoading === p.id ? "..." : "Approve"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {approvedApps.length > 0 && (
          <div className="table-card" style={{marginBottom: 20}}>
            <div className="table-header">
              <span className="table-title">✓ Approved — Ready for Disbursement</span>
              <span className="table-count" style={{background:"#d4f5e2", color:"#1a7a3c"}}>{approvedApps.length} ready</span>
            </div>
            <div style={{padding: 0}}>
              {approvedApps.map(p => (
                <div key={p.id} style={{
                  display:"flex", alignItems:"center", padding:"18px 24px",
                  borderBottom: "1px solid #f0f2f7", gap: 16
                }}>
                  <div style={{fontSize: 28}}>{purposeIcons[p.purpose] || "💰"}</div>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 15, fontWeight: 600, color:"#1a1a2e"}}>
                      {p.borrower_name} <span style={{fontWeight: 400, color:"#8892a4"}}>· {p.borrower_email}</span>
                    </div>
                    <div style={{fontSize: 12, color:"#8892a4", marginTop: 2, fontFamily:"DM Mono, monospace"}}>
                      {p.purpose?.toUpperCase()} · ₹{p.loan_amnt.toLocaleString()} · EMI ₹{Math.round(p.installment).toLocaleString()} · {p.term}mo · {p.int_rate}%
                    </div>
                  </div>
                  <span className="risk-badge" style={{background:"#d4f5e2", color:"#1a7a3c"}}>
                    ✓ APPROVED
                  </span>
                  <button onClick={() => handleDisburse(p.id)} disabled={actionLoading === p.id}
                    style={{padding:"8px 18px", background:"#1a1a2e", color:"#fff", border:"none",
                            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor:"pointer", fontFamily:"inherit"}}>
                    {actionLoading === p.id ? "Disbursing..." : "💰 Disburse Funds"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="table-card">
          <div className="table-header">
            <span className="table-title">Active Loans · Risk Monitoring</span>
            <span className="table-count">{activeLoans.length} active</span>
          </div>
          {activeLoans.length === 0 ? (
            <div style={{padding: "60px 24px", textAlign:"center", color:"#8892a4", fontSize: 14}}>
              No active loans yet. Approve and disburse loans to see them here.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th>Purpose</th>
                  <th>Loan Amount</th>
                  <th>Interest</th>
                  <th>DTI</th>
                  <th>FICO</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map(b => {
                  const r = results[b.id] || { risk_score: b.risk_score, risk_level: b.risk_level, reasons: [] };
                  const colors = RISK[r?.risk_level || "UNKNOWN"];
                  const score = Math.round((r.risk_score || 0) * 100);
                  const initials = b.borrower_name.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase();
                  return (
                    <tr key={b.id} className={selected === b.id ? "active" : ""}
                      onClick={() => handleSelect(b)}>
                      <td>
                        <div className="borrower-cell">
                          <div className="avatar" style={{ background: colors.avatarBg, color: colors.avatarText }}>
                            {initials}
                          </div>
                          <div>
                            <div className="borrower-name">{b.borrower_name}</div>
                            <div className="borrower-grade">{b.borrower_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{purposeIcons[b.purpose]} <span style={{textTransform:"capitalize", fontSize:13}}>{b.purpose}</span></td>
                      <td className="mono">₹{b.loan_amnt.toLocaleString()}</td>
                      <td className="mono">{b.int_rate}%</td>
                      <td className="mono">{b.dti}</td>
                      <td className="mono">{b.fico_avg}</td>
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
          )}
        </div>

        {selectedBorrower && selectedResult && (
          <div className="detail-panel">
            <div className="detail-header">
              <div className="detail-avatar"
                style={{ background: RISK[selectedResult.risk_level || "UNKNOWN"].avatarBg, color: RISK[selectedResult.risk_level || "UNKNOWN"].avatarText }}>
                {selectedBorrower.borrower_name.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{flex: 1}}>
                <div className="detail-name">Why is {selectedBorrower.borrower_name} flagged?</div>
                <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:6}}>
                  {selectedResult.survival?.days_to_default && (
                    <div style={{
                      display:"inline-flex", alignItems:"center", gap:6,
                      background:"#fff3cd", color:"#856404",
                      padding:"4px 10px", borderRadius:20,
                      fontSize:12, fontWeight:600
                    }}>
                      ⏱ Default in ~{Math.round(selectedResult.survival.days_to_default / 30)} months
                    </div>
                  )}
                  {selectedResult.survival?.risk_at_36mo && (
                    <div style={{
                      display:"inline-flex", alignItems:"center", gap:6,
                      background:"#fde8e8", color:"#c0392b",
                      padding:"4px 10px", borderRadius:20,
                      fontSize:12, fontWeight:600
                    }}>
                      📊 36mo risk: {(selectedResult.survival.risk_at_36mo * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="detail-meta" style={{marginTop: 8}}>
                  Risk score: {Math.round((selectedResult.risk_score || 0) * 100)}% ·
                  Loan ₹{selectedBorrower.loan_amnt.toLocaleString()} ·
                  {selectedResult.risk_level} RISK
                </div>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-section-title">Top risk factors (SHAP explanation)</div>
              {selectedResult.reasons?.map((r, i) => {
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

              {(loadingRec || recommendations) && (
                <div style={{marginTop: 24, paddingTop: 20, borderTop: "1px solid #f0f2f7"}}>
                  <div className="detail-section-title">🤖 AI Recovery Recommendations</div>
                  {loadingRec && (
                    <p style={{color: "#8892a4", fontSize: 13}} className="pulse">Generating AI recommendations...</p>
                  )}
                  {recommendations?.actions?.map((a, i) => {
                    const colors = a.priority === "HIGH" ? {bg:"#fde8e8", text:"#c0392b"}
                                 : a.priority === "MEDIUM" ? {bg:"#fef3d0", text:"#b7770d"}
                                 : {bg:"#d4f5e2", text:"#1a7a3c"};
                    return (
                      <div key={i} className="ai-card">
                        <div className="ai-card-header">
                          <div className="ai-card-title">{a.action}</div>
                          <span className="priority-badge" style={{background: colors.bg, color: colors.text}}>
                            {a.priority}
                          </span>
                        </div>
                        <div className="ai-card-details">{a.details}</div>
                      </div>
                    );
                  })}
                  {recommendations?.error && (
                    <p style={{color: "#c0392b", fontSize: 13}}>{recommendations.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}