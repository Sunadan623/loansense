import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

const PURPOSE_ICONS = {
  personal: "👤", home: "🏠", car: "🚗",
  education: "🎓", business: "💼", medical: "🏥"
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f7f8fc; font-family: 'DM Sans', sans-serif; color: #1a1a2e; }
  .wrap { min-height: 100vh; padding: 32px 24px; }
  .container { max-width: 900px; margin: 0 auto; }
  .back-btn { background: none; border: none; color: #5a6378; font-size: 13px; font-weight: 500; cursor: pointer; padding: 6px 0; margin-bottom: 20px; font-family: inherit; }
  .back-btn:hover { color: #1a1a2e; }
  .summary-card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid #eaedf3; margin-bottom: 20px; }
  .summary-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .purpose-tag { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600; }
  .amount-big { font-size: 36px; font-weight: 600; letter-spacing: -1px; color: #1a1a2e; }
  .status-badge { padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 20px 0; border-top: 1px solid #f0f2f7; border-bottom: 1px solid #f0f2f7; margin-bottom: 24px; }
  .stat-label { font-size: 11px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .stat-value { font-size: 18px; font-weight: 600; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .section-card { background: #fff; border-radius: 16px; padding: 28px; border: 1px solid #eaedf3; margin-bottom: 20px; }
  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
  .payment-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f0f2f7; }
  .payment-row:last-child { border-bottom: none; }
  .payment-info { display: flex; align-items: center; gap: 12px; }
  .payment-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .payment-icon.paid { background: #d4f5e2; color: #1a7a3c; }
  .payment-icon.failed { background: #fde8e8; color: #c0392b; }
  .payment-icon.created { background: #fff3cd; color: #856404; }
  .payment-amount { font-size: 15px; font-weight: 600; font-family: 'DM Mono', monospace; }
  .payment-date { font-size: 12px; color: #8892a4; margin-top: 2px; }
  .payment-status { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .empty { padding: 40px; text-align: center; color: #8892a4; font-size: 14px; }
  .deferral-card { padding: 14px; border-radius: 10px; margin-bottom: 10px; background: #fafbfc; border: 1px solid #eaedf3; }
  .deferral-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .deferral-reason { font-size: 13px; color: #5a6378; line-height: 1.5; margin-top: 6px; }
  .deferral-note { font-size: 12px; color: #1a1a2e; background: #f4f6ff; padding: 8px 10px; border-radius: 6px; margin-top: 8px; }
  .btn-primary { background: #1a1a2e; color: #fff; border: none; padding: 12px 22px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .btn-primary:hover { background: #2d3561; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
  .modal { background: #fff; border-radius: 16px; padding: 28px; max-width: 480px; width: 100%; }
  .modal-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
  .modal-sub { font-size: 13px; color: #8892a4; margin-bottom: 20px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: #5a6378; margin-bottom: 6px; }
  .field input, .field textarea, .field select { width: 100%; padding: 11px 14px; border: 1px solid #e0e4ec; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; }
  .field input:focus, .field textarea:focus, .field select:focus { outline: none; border-color: #1a1a2e; }
  .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
  .btn-secondary { flex: 1; background: #fff; color: #5a6378; border: 1px solid #e0e4ec; padding: 11px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .error-box { background: #fde8e8; color: #c0392b; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
`;

export default function LoanDetails() {
  const navigate = useNavigate();
  const { loanId } = useParams();
  const [loan, setLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [deferrals, setDeferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeferralModal, setShowDeferralModal] = useState(false);
  const [reason, setReason] = useState("");
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const token = localStorage.getItem("token");
      try {
        const [loansRes, paymentsRes, deferralsRes] = await Promise.all([
          axios.get("http://127.0.0.1:8000/my-loans", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`http://127.0.0.1:8000/payment-history/${loanId}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`http://127.0.0.1:8000/my-deferrals/${loanId}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const myLoan = loansRes.data.find(l => l.id === parseInt(loanId));
        setLoan(myLoan);
        setPayments(paymentsRes.data || []);
        setDeferrals(deferralsRes.data || []);
      } catch (e) {
        console.log("Fetch failed", e);
      }
      setLoading(false);
    };
    fetch();
  }, [loanId]);

  const submitDeferral = async () => {
    setError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `http://127.0.0.1:8000/request-deferral/${loanId}`,
        { reason, months: parseInt(months) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.error) {
        setError(data.error);
      } else {
        setShowDeferralModal(false);
        setReason("");
        setMonths(1);
        // Reload deferrals
        const deferralsRes = await axios.get(`http://127.0.0.1:8000/my-deferrals/${loanId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDeferrals(deferralsRes.data || []);
        alert("✓ " + data.message);
      }
    } catch (e) {
      setError("Submission failed");
    }
    setSubmitting(false);
  };

  if (loading) return <div style={{padding: 60, textAlign: "center"}}>Loading...</div>;
  if (!loan) return <div style={{padding: 60, textAlign: "center"}}>Loan not found</div>;

  const paidCount = payments.filter(p => p.status === "paid").length;
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const remainingTerm = loan.term - paidCount;
  const hasPendingDeferral = deferrals.some(d => d.status === "pending");

  const statusColors = loan.status === "active" ? {bg:"#dcfce7", text:"#15803d"}
                     : {bg:"#f0f2f7", text:"#5a6378"};

  return (
    <>
      <style>{styles}</style>
      <div className="wrap">
        <div className="container">
          <button className="back-btn" onClick={() => navigate("/portal")}>← Back to portal</button>

          <div className="summary-card">
            <div className="summary-header">
              <div>
                <div className="purpose-tag">
                  {PURPOSE_ICONS[loan.purpose]} {loan.purpose ? loan.purpose.charAt(0).toUpperCase() + loan.purpose.slice(1) : "Loan"} Loan
                </div>
                <div className="amount-big">₹{loan.loan_amnt.toLocaleString()}</div>
              </div>
              <span className="status-badge" style={{background: statusColors.bg, color: statusColors.text}}>
                {loan.status.toUpperCase()}
              </span>
            </div>
            <div className="stats-grid">
              <div>
                <div className="stat-label">Monthly EMI</div>
                <div className="stat-value">₹{Math.round(loan.installment).toLocaleString()}</div>
              </div>
              <div>
                <div className="stat-label">Interest Rate</div>
                <div className="stat-value">{loan.int_rate}%</div>
              </div>
              <div>
                <div className="stat-label">Original Tenure</div>
                <div className="stat-value">{loan.term} mo</div>
              </div>
              <div>
                <div className="stat-label">Remaining</div>
                <div className="stat-value">{remainingTerm} mo</div>
              </div>
            </div>
            <div className="stats-grid" style={{borderBottom:"none", marginBottom: 0}}>
              <div>
                <div className="stat-label">EMIs Paid</div>
                <div className="stat-value">{paidCount} / {loan.term}</div>
              </div>
              <div>
                <div className="stat-label">Total Paid</div>
                <div className="stat-value">₹{Math.round(totalPaid).toLocaleString()}</div>
              </div>
              <div>
                <div className="stat-label">Remaining Balance</div>
                <div className="stat-value">₹{Math.round(loan.loan_amnt - totalPaid).toLocaleString()}</div>
              </div>
              <div>
                <div className="stat-label">Risk Level</div>
                <div className="stat-value">{loan.risk_level}</div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-title">💳 Payment History</div>
            {payments.length === 0 ? (
              <div className="empty">No payments yet. Click "Pay EMI" on your portal to make your first payment.</div>
            ) : (
              payments.map(p => (
                <div className="payment-row" key={p.id}>
                  <div className="payment-info">
                    <div className={`payment-icon ${p.status}`}>
                      {p.status === "paid" ? "✓" : p.status === "failed" ? "✗" : "⏳"}
                    </div>
                    <div>
                      <div className="payment-amount">₹{Math.round(p.amount).toLocaleString()}</div>
                      <div className="payment-date">
                        {p.paid_at ? `Paid on ${new Date(p.paid_at).toLocaleString()}` : `Created on ${new Date(p.created_at).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                  <span className="payment-status" style={{
                    background: p.status === "paid" ? "#d4f5e2" : p.status === "failed" ? "#fde8e8" : "#fff3cd",
                    color: p.status === "paid" ? "#1a7a3c" : p.status === "failed" ? "#c0392b" : "#856404"
                  }}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="section-card">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 18}}>
              <div className="section-title" style={{margin:0}}>⏸ Deferral Requests</div>
              {loan.status === "active" && !hasPendingDeferral && (
                <button className="btn-primary" style={{padding: "9px 16px", fontSize: 13}}
                  onClick={() => setShowDeferralModal(true)}>
                  + Request Deferral
                </button>
              )}
            </div>
            {deferrals.length === 0 ? (
              <div className="empty">No deferral requests. If you're facing temporary financial difficulty, you can request a deferral.</div>
            ) : (
              deferrals.map(d => {
                const colors = d.status === "pending" ? {bg:"#fff3cd", text:"#856404"}
                             : d.status === "approved" ? {bg:"#d4f5e2", text:"#1a7a3c"}
                             : {bg:"#fde8e8", text:"#c0392b"};
                return (
                  <div className="deferral-card" key={d.id}>
                    <div className="deferral-card-header">
                      <div style={{fontWeight: 600, fontSize: 14}}>
                        Defer {d.requested_months} {d.requested_months === 1 ? "month" : "months"}
                      </div>
                      <span className="payment-status" style={{background: colors.bg, color: colors.text}}>
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{fontSize: 11, color: "#8892a4"}}>Requested on {new Date(d.created_at).toLocaleString()}</div>
                    <div className="deferral-reason">"{d.reason}"</div>
                    {d.analyst_note && (
                      <div className="deferral-note">
                        <b>Bank note:</b> {d.analyst_note}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showDeferralModal && (
        <div className="modal-overlay" onClick={() => setShowDeferralModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Request EMI Deferral</div>
            <div className="modal-sub">Bank will review your request. Approval is not guaranteed.</div>

            {error && <div className="error-box">{error}</div>}

            <div className="field">
              <label>How many months do you need?</label>
              <select value={months} onChange={e => setMonths(e.target.value)}>
                <option value={1}>1 month</option>
                <option value={2}>2 months</option>
                <option value={3}>3 months</option>
                <option value={4}>4 months</option>
                <option value={5}>5 months</option>
                <option value={6}>6 months</option>
              </select>
            </div>

            <div className="field">
              <label>Reason for deferral</label>
              <textarea rows="4" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="E.g., Lost my job, medical emergency, family situation..." />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDeferralModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={submitDeferral} disabled={submitting} style={{flex: 1}}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}