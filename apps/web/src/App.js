import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import AnalystCharts from "./AnalystCharts";
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
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };
  const [results, setResults] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStats, setDbStats] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [pendingApps, setPendingApps] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [approvedApps, setApprovedApps] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState("all"); // all, high, medium, low
  const [filterPurpose, setFilterPurpose] = useState("all");
  const [activeLoans, setActiveLoans] = useState([]);
  const [pendingDeferrals, setPendingDeferrals] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketResponse, setTicketResponse] = useState({}); // {ticketId: "response text"}
  const [respondingTo, setRespondingTo] = useState(null);
  const [radar, setRadar] = useState([]);
  const [pendingDateChanges, setPendingDateChanges] = useState([]);
  const [dateChangeDecision, setDateChangeDecision] = useState({});  // {requestId: {decision_reason: ""}}
  const [decidingDateChange, setDecidingDateChange] = useState(null);
  const [restructureModal, setRestructureModal] = useState(null); // {loan}
  const [restructureSim, setRestructureSim] = useState(null);
  const [restructureForm, setRestructureForm] = useState({ extend_months: 6, rate_reduction: 1, reason: "" });
  const [simulating, setSimulating] = useState(false);
  useEffect(() => {
    const fetchAll = async () => {
      const res = {};
      try {
        const { data: statsData } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/stats`);
        setDbStats(statsData);
      } catch (e) { console.log("Stats fetch failed"); }

      try {
        const token = localStorage.getItem("token");
        const { data: pending } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/pending-applications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(pending)) setPendingApps(pending);
      } catch (e) { console.log("Pending fetch failed"); }

      try {
        const token = localStorage.getItem("token");
        const { data: approved } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/approved-applications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(approved)) setApprovedApps(approved);
      } catch (e) { console.log("Approved fetch failed"); }

      try {
        const token = localStorage.getItem("token");
        const { data: active } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/active-loans`, {
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
              const { data: pred } = await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/predict`, features);
              res[loan.id] = pred;
            } catch {
              res[loan.id] = { risk_score: loan.risk_score, risk_level: loan.risk_level, reasons: [] };
            }
          }
        }
      } catch (e) { console.log("Active loans fetch failed"); }
      try {
        const token = localStorage.getItem("token");
        const { data: deferrals } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/pending-deferrals`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(deferrals)) setPendingDeferrals(deferrals);
      } catch (e) {
        console.log("Pending deferrals fetch failed");
      }
      try {
        const token = localStorage.getItem("token");
        const { data: ticketsData } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/support/all-tickets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(ticketsData)) setTickets(ticketsData);
      } catch (e) {
        console.log("Tickets fetch failed");
      }
      try {
        const token = localStorage.getItem("token");
        const { data: radarData } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/analyst/default-radar`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (radarData && Array.isArray(radarData.loans)) setRadar(radarData.loans);
      } catch (e) {
        console.log("Radar fetch failed");
      }
      try {
        const token = localStorage.getItem("token");
        const { data: dcData } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/analyst/pending-date-changes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(dcData)) setPendingDateChanges(dcData);
      } catch (e) {
        console.log("Date changes fetch failed");
      }
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
        const { data } = await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/recommend`, {
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
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/approve-loan/${loanId}`, {}, {
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
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/reject-loan/${loanId}`,
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
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/disburse-loan/${loanId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const disbursed = approvedApps.find(p => p.id === loanId);
      setApprovedApps(approvedApps.filter(p => p.id !== loanId));
      if (disbursed) setActiveLoans([...activeLoans, disbursed]);
    } catch (e) { alert("Disbursement failed"); }
    setActionLoading(null);
  };
  const handleDeferralDecision = async (deferralId, decision) => {
    const note = prompt(`Note for ${decision === "approve" ? "approval" : "rejection"} (optional):`, "");
    setActionLoading(deferralId);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/review-deferral/${deferralId}`,
        { decision, note: note || "" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPendingDeferrals(pendingDeferrals.filter(d => d.id !== deferralId));
    } catch (e) {
      alert("Decision failed");
    }
    setActionLoading(null);
  };

  const handleTicketRespond = async (ticketId, status = "resolved") => {
    const response = ticketResponse[ticketId];
    if (!response || response.trim().length < 10) {
      alert("Response must be at least 10 characters");
      return;
    }
    setRespondingTo(ticketId);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/support/respond/${ticketId}`,
        { response: response.trim(), status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setTickets(tickets.map(t => t.id === ticketId
          ? { ...t, response: response.trim(), status, responded_at: new Date().toISOString() }
          : t));
        setTicketResponse({ ...ticketResponse, [ticketId]: "" });
      } else {
        alert(data.error || "Failed to respond");
      }
    } catch (e) {
      alert("Could not send response");
    }
    setRespondingTo(null);
  };

  const handleDateChangeDecision = async (requestId, decision) => {
    const reasonText = (dateChangeDecision[requestId]?.decision_reason || "").trim();
    if (decision === "reject" && reasonText.length < 10) {
      alert("Please provide a reason for rejection (at least 10 characters)");
      return;
    }
    if (decision === "approve" && !window.confirm("Approve this EMI date change? The loan's due date will shift permanently.")) {
      return;
    }
    setDecidingDateChange(requestId);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/analyst/decide-date-change/${requestId}`,
        { decision, decision_reason: reasonText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setPendingDateChanges(pendingDateChanges.filter(r => r.id !== requestId));
        setDateChangeDecision({ ...dateChangeDecision, [requestId]: { decision_reason: "" } });
        alert(`✓ Request ${decision}d`);
      } else {
        alert(data.error || "Failed");
      }
    } catch (e) {
      alert("Decision failed");
    }
    setDecidingDateChange(null);
  };

  const openRestructureModal = async (loanFromRadar) => {
    setRestructureModal({ loan: loanFromRadar });
    setRestructureForm({ extend_months: 6, rate_reduction: 1, reason: "" });
    runSimulation(loanFromRadar.loan_id, 6, 1);
  };

  const runSimulation = async (loanId, extendMonths, rateReduction) => {
    setSimulating(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/analyst/simulate-restructure`,
        { loan_id: loanId, extend_months: extendMonths, rate_reduction: rateReduction },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.error) setRestructureSim(data);
    } catch (e) { /* silent */ }
    setSimulating(false);
  };

  const applyRestructure = async () => {
    if (!restructureForm.reason || restructureForm.reason.trim().length < 10) {
      alert("Please provide a reason (at least 10 characters)");
      return;
    }
    if (!window.confirm(`Apply restructuring? New EMI will be ₹${Math.round(restructureSim.new_emi).toLocaleString()}/month over ${restructureSim.new_tenure} months. This cannot be easily undone.`)) {
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/analyst/apply-restructure/${restructureModal.loan.loan_id}`,
        {
          extend_months: parseInt(restructureForm.extend_months),
          rate_reduction: parseFloat(restructureForm.rate_reduction),
          reason: restructureForm.reason.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        alert(`✓ Restructured! New EMI: ₹${Math.round(data.new_emi).toLocaleString()}, ${data.new_tenure} months at ${data.new_rate}%`);
        setRestructureModal(null);
        setRestructureSim(null);
        window.location.reload();
      } else {
        alert(data.error || "Failed to apply");
      }
    } catch (e) { alert("Failed to apply restructure"); }
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
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <NotificationBell />
            <button onClick={handleLogout} style={{
              background: "none", border: "1px solid #e0e4ec", padding: "7px 14px",
              borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
              color: "#5a6378", fontFamily: "inherit"
            }}>Sign out</button>
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

        <AnalystCharts />

        {radar.filter(r => r.band_moved > 0 || r.current_band === "HIGH" || r.warnings.length > 0).length > 0 && (
          <div className="table-card" style={{marginBottom: 20}}>
            <div className="table-header">
              <span className="table-title">🎯 Default Radar · Loans Needing Attention</span>
              <span className="table-count" style={{background:"#fde8e8", color:"#c0392b"}}>
                {radar.filter(r => r.band_moved > 0).length} risk-up · {radar.filter(r => r.current_band === "HIGH").length} high
              </span>
            </div>
            <div style={{padding: 0}}>
              {radar.filter(r => r.band_moved > 0 || r.current_band === "HIGH" || r.warnings.length > 0).map(r => {
                const bandColor = r.current_band === "HIGH" ? {bg:"#fde8e8", color:"#c0392b", dot:"#c0392b"}
                              : r.current_band === "MEDIUM" ? {bg:"#fff3cd", color:"#856404", dot:"#f39c12"}
                              : {bg:"#d4f5e2", color:"#1a7a3c", dot:"#1a7a3c"};
                const deltaPct = Math.round(r.risk_delta * 100);
                return (
                  <div key={r.loan_id} style={{padding:"18px 24px", borderBottom:"1px solid #f0f2f7"}}>
                    <div style={{display:"flex", alignItems:"flex-start", gap:14, marginBottom: 10}}>
                      <div style={{fontSize: 26}}>{purposeIcons[r.purpose] || "💰"}</div>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: 15, fontWeight: 600, color:"#1a1a2e"}}>
                          {r.borrower_name}
                          <span style={{fontWeight: 400, color:"#8892a4"}}> · {r.borrower_email}</span>
                        </div>
                        <div style={{fontSize: 12, color:"#8892a4", marginTop: 2, fontFamily:"DM Mono, monospace"}}>
                          Loan #{r.loan_id} · {r.purpose?.toUpperCase()} · ₹{r.loan_amnt.toLocaleString()} · EMI ₹{Math.round(r.installment).toLocaleString()}
                        </div>
                      </div>
                      <div style={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6}}>
                        <span className="risk-badge" style={{background: bandColor.bg, color: bandColor.color}}>
                          <span className="risk-dot" style={{background: bandColor.dot}} />
                          {r.current_band} · {Math.round(r.current_risk * 100)}%
                        </span>
                        {r.band_moved > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "#c0392b",
                            background: "#fde8e8", padding: "2px 8px", borderRadius: 10
                          }}>
                            ↑ Up from {r.original_band} (+{deltaPct}%)
                          </span>
                        )}
                      </div>
                    </div>

                    {r.warnings.length > 0 && (
                      <div style={{
                        background: "#fff8e6", border: "1px solid #ffe0a3",
                        borderRadius: 8, padding: "10px 14px", marginBottom: 10
                      }}>
                        <div style={{fontSize: 11, fontWeight: 700, color: "#8a6d3b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4}}>
                          ⚠ Risk signals detected
                        </div>
                        <ul style={{margin: 0, paddingLeft: 20, fontSize: 12, color: "#5a6378", lineHeight: 1.6}}>
                          {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}

                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, fontSize: 11
                    }}>
                      <Stat label="Payments made" value={`${r.total_payments}`} />
                      <Stat label="Late / Partial" value={`${r.late_payments} / ${r.partial_payments}`} />
                      <Stat label="Last payment" value={r.days_since_last_payment != null ? `${r.days_since_last_payment}d ago` : "Never"} />
                      <Stat label="Carry-over" value={r.carryover_balance > 0 ? `₹${r.carryover_balance.toLocaleString()}` : "—"} />
                    </div>

                    <div style={{display: "flex", justifyContent: "flex-end", marginTop: 12, gap: 8}}>
                    <button onClick={() => handleSelect({id: r.loan_id, borrower_name: r.borrower_name, borrower_email: r.borrower_email})}
                        style={{padding: "7px 14px", background: "#fff", color: "#1a1a2e",
                          border: "1px solid #e0e4ec", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit"}}>
                        View borrower details
                      </button>
                      <button onClick={() => openRestructureModal(r)}
                        style={{padding: "7px 14px", background: "#1a7a3c", color: "#fff",
                          border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit"}}>
                        🔄 Restructure
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pendingDateChanges.length > 0 && (
          <div className="table-card" style={{marginBottom: 20}}>
            <div className="table-header">
              <span className="table-title">📅 EMI Date Change Requests</span>
              <span className="table-count" style={{background:"#cfe2ff", color:"#084298"}}>
                {pendingDateChanges.length} pending
              </span>
            </div>
            <div style={{padding: 0}}>
              {pendingDateChanges.map(r => (
                <div key={r.id} style={{padding:"18px 24px", borderBottom:"1px solid #f0f2f7"}}>
                  <div style={{display:"flex", alignItems:"flex-start", gap: 12, marginBottom: 10}}>
                    <div style={{flex: 1}}>
                      <div style={{fontSize: 14, fontWeight: 600, color:"#1a1a2e"}}>
                        {r.borrower_name}
                        <span style={{fontWeight: 400, color:"#8892a4"}}> · {r.borrower_email}</span>
                      </div>
                      <div style={{fontSize: 12, color:"#8892a4", marginTop: 2, fontFamily:"DM Mono, monospace"}}>
                        Loan #{r.loan_id} · {r.loan_purpose?.toUpperCase()} · ₹{r.loan_amnt.toLocaleString()} · EMI ₹{Math.round(r.installment).toLocaleString()}
                      </div>
                    </div>
                    <div style={{
                      background: "#fff3cd", color: "#856404", padding: "4px 10px",
                      borderRadius: 10, fontSize: 11, fontWeight: 700, textTransform: "uppercase"
                    }}>
                      Pending
                    </div>
                  </div>

                  <div style={{
                    background: "#f4f6ff", border: "1px solid #d6dffb", borderRadius: 10,
                    padding: "12px 16px", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 16, justifyContent: "center"
                  }}>
                    <div style={{textAlign: "center"}}>
                      <div style={{fontSize: 10, color: "#8892a4", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600}}>Current</div>
                      <div style={{fontSize: 22, fontWeight: 700, color: "#1a1a2e", fontFamily: "DM Mono, monospace"}}>Day {r.current_due_day}</div>
                    </div>
                    <div style={{fontSize: 22, color: "#8892a4"}}>→</div>
                    <div style={{textAlign: "center"}}>
                      <div style={{fontSize: 10, color: "#1a7a3c", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600}}>Requested</div>
                      <div style={{fontSize: 22, fontWeight: 700, color: "#1a7a3c", fontFamily: "DM Mono, monospace"}}>Day {r.requested_due_day}</div>
                    </div>
                  </div>

                  <div style={{
                    background: "#fafbfc", padding: "10px 14px", borderRadius: 8,
                    fontSize: 13, color: "#5a6378", marginBottom: 12, lineHeight: 1.5
                  }}>
                    <span style={{fontWeight: 600, color: "#1a1a2e"}}>Reason: </span>{r.reason}
                  </div>

                  <textarea
                    value={dateChangeDecision[r.id]?.decision_reason || ""}
                    onChange={e => setDateChangeDecision({
                      ...dateChangeDecision,
                      [r.id]: { decision_reason: e.target.value }
                    })}
                    placeholder="Decision note (required for rejection, optional for approval)..."
                    style={{
                      width: "100%", padding: "10px 12px", border: "1px solid #e0e4ec",
                      borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                      minHeight: 60, resize: "vertical", marginBottom: 8
                    }} />

                  <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
                    <button onClick={() => handleDateChangeDecision(r.id, "reject")}
                      disabled={decidingDateChange === r.id}
                      style={{padding: "8px 16px", background: "#fff", color: "#c0392b",
                        border: "1px solid #f5c6cb", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit"}}>
                      ✗ Reject
                    </button>
                    <button onClick={() => handleDateChangeDecision(r.id, "approve")}
                      disabled={decidingDateChange === r.id}
                      style={{padding: "8px 16px", background: "#1a7a3c", color: "#fff",
                        border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit"}}>
                      {decidingDateChange === r.id ? "..." : "✓ Approve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <div className="table-header" style={{flexDirection: "column", alignItems: "stretch", gap: 14}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
              <span className="table-title">Active Loans · Risk Monitoring</span>
              <span className="table-count">{activeLoans.length} total</span>
            </div>
            <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
              <input
                type="text"
                placeholder="🔍 Search by borrower name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: "1 1 240px", padding: "8px 12px", border: "1px solid #e0e4ec",
                  borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none"
                }}
              />
              <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{
                padding: "8px 12px", border: "1px solid #e0e4ec", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer"
              }}>
                <option value="all">All Risk Levels</option>
                <option value="HIGH">🔴 High Risk</option>
                <option value="MEDIUM">🟡 Medium Risk</option>
                <option value="LOW">🟢 Low Risk</option>
              </select>
              <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)} style={{
                padding: "8px 12px", border: "1px solid #e0e4ec", borderRadius: 8,
                fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer"
              }}>
                <option value="all">All Purposes</option>
                <option value="personal">👤 Personal</option>
                <option value="home">🏠 Home</option>
                <option value="car">🚗 Car</option>
                <option value="education">🎓 Education</option>
                <option value="business">💼 Business</option>
                <option value="medical">🏥 Medical</option>
                <option value="gold">🪙 Gold</option>
              </select>
              {(searchQuery || filterRisk !== "all" || filterPurpose !== "all") && (
                <button onClick={() => {setSearchQuery(""); setFilterRisk("all"); setFilterPurpose("all");}}
                  style={{
                    padding: "8px 14px", background: "#fde8e8", color: "#c0392b",
                    border: "1px solid #f5c6cb", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit"
                  }}>
                  ✕ Clear filters
                </button>
              )}
            </div>
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
                {(() => {
                  const filtered = activeLoans.filter(b => {
                    const r = results[b.id] || { risk_level: b.risk_level };
                    const matchSearch = !searchQuery ||
                      b.borrower_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      b.borrower_email?.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchRisk = filterRisk === "all" || r.risk_level === filterRisk;
                    const matchPurpose = filterPurpose === "all" || b.purpose === filterPurpose;
                    return matchSearch && matchRisk && matchPurpose;
                  });
                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan="8" style={{padding: "40px 24px", textAlign: "center", color: "#8892a4", fontSize: 13}}>
                          No loans match your filters
                        </td>
                      </tr>
                    );
                  }
                  return filtered.map(b => {
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
                });
              })()}
              </tbody>
            </table>
          )}
        </div>
        {pendingDeferrals.length > 0 && (
          <div className="table-card" style={{marginBottom: 20}}>
            <div className="table-header">
              <span className="table-title">⏸ Pending Deferral Requests</span>
              <span className="table-count" style={{background:"#fff3cd", color:"#856404"}}>{pendingDeferrals.length} awaiting review</span>
            </div>
            <div style={{padding: 0}}>
              {pendingDeferrals.map(d => (
                <div key={d.id} style={{
                  padding:"18px 24px",
                  borderBottom: "1px solid #f0f2f7"
                }}>
                  <div style={{display:"flex", alignItems:"center", gap:16, marginBottom: 10}}>
                    <div style={{fontSize: 28}}>{purposeIcons[d.purpose] || "💰"}</div>
                    <div style={{flex: 1}}>
                      <div style={{fontSize: 15, fontWeight: 600, color:"#1a1a2e"}}>
                        {d.borrower_name} <span style={{fontWeight: 400, color:"#8892a4"}}>· {d.borrower_email}</span>
                      </div>
                      <div style={{fontSize: 12, color:"#8892a4", marginTop: 2, fontFamily:"DM Mono, monospace"}}>
                        {d.purpose?.toUpperCase()} · ₹{d.loan_amnt.toLocaleString()} · EMI ₹{Math.round(d.installment).toLocaleString()}
                      </div>
                    </div>
                    <span className="risk-badge" style={{background:"#fff3cd", color:"#856404"}}>
                      Wants to defer {d.requested_months}mo
                    </span>
                  </div>
                  <div style={{
                    background: "#f9fafc", padding: "10px 14px", borderRadius: 8,
                    fontSize: 13, color: "#5a6378", marginBottom: 10, lineHeight: 1.5
                  }}>
                    💬 "{d.reason}"
                  </div>
                  <div style={{display:"flex", gap: 10, justifyContent:"flex-end"}}>
                    <button onClick={() => handleDeferralDecision(d.id, "reject")} disabled={actionLoading === d.id}
                      style={{padding:"8px 16px", background:"#fff", color:"#c0392b", border:"1px solid #f5c6cb",
                              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor:"pointer", fontFamily:"inherit"}}>
                      Reject
                    </button>
                    <button onClick={() => handleDeferralDecision(d.id, "approve")} disabled={actionLoading === d.id}
                      style={{padding:"8px 16px", background:"#1a7a3c", color:"#fff", border:"none",
                              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor:"pointer", fontFamily:"inherit"}}>
                      {actionLoading === d.id ? "..." : "Approve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tickets.filter(t => t.status !== "closed").length > 0 && (
          <div className="table-card" style={{marginBottom: 20}}>
            <div className="table-header">
              <span className="table-title">🎫 Support Tickets</span>
              <span className="table-count" style={{background:"#fde8e8", color:"#c0392b"}}>
                {tickets.filter(t => t.status === "open").length} open · {tickets.length} total
              </span>
            </div>
            <div style={{padding: 0}}>
            {tickets.filter(t => t.status !== "closed").map(t => {
                const priColor = t.priority === "urgent" ? {bg:"#fde8e8", color:"#c0392b"}
                              : t.priority === "high" ? {bg:"#fff3cd", color:"#856404"}
                              : {bg:"#cfe2ff", color:"#084298"};
                const statColor = t.status === "open" ? {bg:"#fff3cd", color:"#856404"}
                              : t.status === "in_progress" ? {bg:"#cfe2ff", color:"#084298"}
                              : t.status === "reopened" ? {bg:"#fff3cd", color:"#856404"}
                              : {bg:"#d4f5e2", color:"#1a7a3c"};
                const needsResponse = t.status === "open" || t.status === "in_progress" || t.status === "reopened";
                return (
                  <div key={t.id} style={{padding:"18px 24px", borderBottom:"1px solid #f0f2f7"}}>
                    <div style={{display:"flex", alignItems:"flex-start", gap:12, marginBottom: 12}}>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: 14, fontWeight: 600, color:"#1a1a2e", marginBottom: 3}}>
                          {t.subject}
                        </div>
                        <div style={{fontSize: 12, color:"#8892a4"}}>
                          #{t.id} · {t.borrower_name} ({t.borrower_email}) · {t.category} · {new Date(t.created_at).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div style={{display:"flex", gap: 6, flexShrink: 0}}>
                        <span className="risk-badge" style={{background: priColor.bg, color: priColor.color, fontSize: 10}}>
                          {t.priority.toUpperCase()}
                        </span>
                        <span className="risk-badge" style={{background: statColor.bg, color: statColor.color, fontSize: 10}}>
                          {t.status.replace("_", " ").toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Conversation thread */}
                    <div style={{
                      background:"#fafbfc", border:"1px solid #f0f2f7", borderRadius: 10,
                      padding: 12, marginBottom: needsResponse ? 12 : 0
                    }}>
                      {(t.thread || []).map(m => (
                        <div key={m.id} style={{
                          display: "flex",
                          justifyContent: m.sender_role === "analyst" ? "flex-end" : "flex-start",
                          marginBottom: 8
                        }}>
                          <div style={{
                            maxWidth: "78%",
                            padding: "9px 13px",
                            borderRadius: 12,
                            fontSize: 13,
                            lineHeight: 1.5,
                            background: m.sender_role === "analyst" ? "#1a1a2e" : "#fff",
                            color: m.sender_role === "analyst" ? "#fff" : "#1a1a2e",
                            border: m.sender_role === "borrower" ? "1px solid #e0e4ec" : "none"
                          }}>
                            {m.message}
                            <div style={{fontSize: 10, opacity: 0.7, marginTop: 4}}>
                              {m.sender_role === "analyst" ? "You" : t.borrower_name.split(" ")[0]} · {new Date(m.created_at).toLocaleString("en-IN", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {needsResponse && (
                      <div>
                        <textarea
                          value={ticketResponse[t.id] || ""}
                          onChange={e => setTicketResponse({...ticketResponse, [t.id]: e.target.value})}
                          placeholder={t.status === "reopened" ? "Borrower replied — type your follow-up..." : "Type your response (minimum 10 characters)..."}
                          style={{
                            width: "100%", padding: "10px 12px", border: "1px solid #e0e4ec",
                            borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                            minHeight: 60, resize: "vertical", marginBottom: 8
                          }} />
                        <div style={{display:"flex", gap: 10, justifyContent:"flex-end"}}>
                          <button onClick={() => handleTicketRespond(t.id, "in_progress")}
                            disabled={respondingTo === t.id}
                            style={{padding:"8px 16px", background:"#fff", color:"#084298",
                              border:"1px solid #cfe2ff", borderRadius: 8, fontSize: 13, fontWeight: 600,
                              cursor:"pointer", fontFamily:"inherit"}}>
                            Send & Keep Open
                          </button>
                          <button onClick={() => handleTicketRespond(t.id, "resolved")}
                            disabled={respondingTo === t.id}
                            style={{padding:"8px 16px", background:"#1a7a3c", color:"#fff",
                              border:"none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                              cursor:"pointer", fontFamily:"inherit"}}>
                            {respondingTo === t.id ? "..." : "Send & Resolve"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {restructureModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20
          }} onClick={() => { setRestructureModal(null); setRestructureSim(null); }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: 28,
              maxWidth: 580, width: "100%", maxHeight: "92vh", overflowY: "auto",
              fontFamily: "DM Sans, sans-serif"
            }} onClick={e => e.stopPropagation()}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18}}>
                <div>
                  <div style={{fontSize: 18, fontWeight: 700, color: "#1a1a2e"}}>🔄 Restructure Loan</div>
                  <div style={{fontSize: 12, color: "#8892a4", marginTop: 4}}>
                    {restructureModal.loan.borrower_name} · Loan #{restructureModal.loan.loan_id} ({restructureModal.loan.purpose})
                  </div>
                </div>
                <button onClick={() => { setRestructureModal(null); setRestructureSim(null); }}
                  style={{background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#8892a4"}}>×</button>
              </div>

              <div style={{background: "#f0f7ff", border: "1px solid #b3d4ff", borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 12, color: "#2c5282", lineHeight: 1.5}}>
                💡 Help a struggling borrower by extending tenure or lowering interest. EMI drops, but they pay slightly more total interest. Better than default.
              </div>

              {/* Tenure slider */}
              <div style={{marginBottom: 18}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                  <label style={{fontSize: 13, fontWeight: 600, color: "#1a1a2e"}}>Extend tenure by</label>
                  <span style={{fontSize: 14, fontWeight: 700, color: "#1a7a3c", fontFamily: "DM Mono, monospace"}}>
                    +{restructureForm.extend_months} months
                  </span>
                </div>
                <input type="range" min="0" max="36" step="3"
                  value={restructureForm.extend_months}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    setRestructureForm({...restructureForm, extend_months: v});
                    runSimulation(restructureModal.loan.loan_id, v, restructureForm.rate_reduction);
                  }}
                  style={{width: "100%"}} />
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8892a4", marginTop: 4}}>
                  <span>No change</span><span>+18 mo</span><span>+36 mo</span>
                </div>
              </div>

              {/* Rate slider */}
              <div style={{marginBottom: 18}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                  <label style={{fontSize: 13, fontWeight: 600, color: "#1a1a2e"}}>Reduce interest rate by</label>
                  <span style={{fontSize: 14, fontWeight: 700, color: "#1a7a3c", fontFamily: "DM Mono, monospace"}}>
                    -{restructureForm.rate_reduction}%
                  </span>
                </div>
                <input type="range" min="0" max="5" step="0.25"
                  value={restructureForm.rate_reduction}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setRestructureForm({...restructureForm, rate_reduction: v});
                    runSimulation(restructureModal.loan.loan_id, restructureForm.extend_months, v);
                  }}
                  style={{width: "100%"}} />
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8892a4", marginTop: 4}}>
                  <span>No change</span><span>-2.5%</span><span>-5%</span>
                </div>
              </div>

              {/* Live simulation result */}
              {restructureSim && (
                <div style={{
                  background: "linear-gradient(135deg, #f0fff4 0%, #d4f5e2 100%)",
                  border: "1px solid #c3e6cb", borderRadius: 12,
                  padding: 18, marginBottom: 16
                }}>
                  <div style={{fontSize: 11, fontWeight: 700, color: "#1a7a3c", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12}}>
                    📊 Simulation Result
                  </div>
                  <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14}}>
                    <div>
                      <div style={{fontSize: 11, color: "#8892a4", marginBottom: 4}}>BEFORE</div>
                      <div style={{fontSize: 11, color: "#5a6378"}}>EMI: <b>₹{Math.round(restructureSim.current_emi).toLocaleString()}</b></div>
                      <div style={{fontSize: 11, color: "#5a6378"}}>Months: <b>{restructureSim.current_remaining_months}</b></div>
                      <div style={{fontSize: 11, color: "#5a6378"}}>Rate: <b>{restructureSim.current_rate}%</b></div>
                    </div>
                    <div>
                      <div style={{fontSize: 11, color: "#1a7a3c", fontWeight: 700, marginBottom: 4}}>AFTER</div>
                      <div style={{fontSize: 11, color: "#1a7a3c"}}>EMI: <b>₹{Math.round(restructureSim.new_emi).toLocaleString()}</b></div>
                      <div style={{fontSize: 11, color: "#1a7a3c"}}>Months: <b>{restructureSim.new_tenure}</b></div>
                      <div style={{fontSize: 11, color: "#1a7a3c"}}>Rate: <b>{restructureSim.new_rate}%</b></div>
                    </div>
                  </div>
                  <div style={{borderTop: "1px solid #c3e6cb", paddingTop: 12}}>
                    <div style={{fontSize: 22, fontWeight: 700, color: "#1a7a3c", fontFamily: "DM Mono, monospace"}}>
                      ↓ ₹{Math.round(restructureSim.emi_drop).toLocaleString()} ({restructureSim.emi_drop_pct}% EMI reduction)
                    </div>
                    {restructureSim.extra_interest_cost > 0 && (
                      <div style={{fontSize: 11, color: "#8a6d3b", marginTop: 6}}>
                        ⓘ Borrower pays ₹{Math.round(restructureSim.extra_interest_cost).toLocaleString()} more total interest over life of loan
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div style={{marginBottom: 16}}>
                <label style={{display: "block", fontSize: 12, fontWeight: 600, color: "#5a6378", marginBottom: 6}}>
                  Reason for restructuring
                </label>
                <textarea value={restructureForm.reason}
                  onChange={e => setRestructureForm({...restructureForm, reason: e.target.value})}
                  placeholder="e.g. Borrower showed cash flow stress with 2 partial payments. Restructuring to prevent default."
                  style={{
                    width: "100%", padding: "10px 12px", border: "1px solid #e0e4ec",
                    borderRadius: 8, fontSize: 13, fontFamily: "inherit", minHeight: 70, resize: "vertical"
                  }} />
              </div>

              <div style={{display: "flex", gap: 10, justifyContent: "flex-end"}}>
                <button onClick={() => { setRestructureModal(null); setRestructureSim(null); }}
                  style={{padding: "10px 18px", background: "#fff", color: "#1a1a2e",
                    border: "1px solid #e0e4ec", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit"}}>
                  Cancel
                </button>
                <button onClick={applyRestructure}
                  disabled={restructureForm.extend_months === 0 && restructureForm.rate_reduction === 0}
                  style={{padding: "10px 18px", background: "#1a7a3c", color: "#fff",
                    border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    opacity: (restructureForm.extend_months === 0 && restructureForm.rate_reduction === 0) ? 0.5 : 1}}>
                  Apply Restructuring
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
function Stat({ label, value }) {
  return (
    <div style={{
      background: "#fafbfc", border: "1px solid #f0f2f7", borderRadius: 8,
      padding: "8px 10px"
    }}>
      <div style={{fontSize: 10, color: "#8892a4", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600, marginBottom: 2}}>{label}</div>
      <div style={{fontSize: 13, fontWeight: 600, color: "#1a1a2e", fontFamily: "DM Mono, monospace"}}>{value}</div>
    </div>
  );
}