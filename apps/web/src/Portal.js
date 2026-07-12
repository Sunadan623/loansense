import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import AppShell from "./AppShell";
import SupportChat from "./SupportChat";
const PURPOSE_ICONS = {
  personal: "👤", home: "🏠", car: "🚗",
  education: "🎓", business: "💼", medical: "🏥"
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f7f8fc; font-family: 'DM Sans', sans-serif; color: #1a1a2e; }
  .portal { min-height: 100vh; }
  .nav { background: #fff; border-bottom: 1px solid #eaedf3; padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; }
  .nav-logo { display: flex; align-items: center; gap: 10px; }
  .nav-logo-icon { width: 32px; height: 32px; background: #1a1a2e; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .nav-logo-icon svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 2; }
  .nav-logo-text { font-size: 16px; font-weight: 600; color: #1a1a2e; }
  .nav-user { display: flex; align-items: center; gap: 12px; }
  .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a1a2e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
  .nav-name { font-size: 13px; font-weight: 500; color: #1a1a2e; }
  .nav-role { font-size: 11px; color: #8892a4; }
  .logout-btn { background: none; border: 1px solid #e0e4ec; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; color: #5a6378; font-family: inherit; }
  .logout-btn:hover { background: #f9fafc; border-color: #d0d5e0; }
  .portal-body { max-width: 1000px; margin: 32px auto; padding: 0 24px; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .welcome { font-size: 24px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
  .welcome-sub { font-size: 14px; color: #8892a4; }
  .apply-btn { background: #1a1a2e; color: #fff; border: none; padding: 11px 20px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .apply-btn:hover { background: #2d3561; }
  .empty-state { background: #fff; border-radius: 16px; padding: 60px 40px; border: 1px solid #eaedf3; text-align: center; }
  .empty-icon { width: 64px; height: 64px; background: #f0f2f7; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
  .empty-title { font-size: 17px; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; }
  .empty-sub { font-size: 14px; color: #8892a4; margin-bottom: 24px; max-width: 380px; margin-left: auto; margin-right: auto; }
  .btn-primary { background: #1a1a2e; color: #fff; border: none; padding: 12px 22px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .btn-primary:hover { background: #2d3561; }
  .loan-card { background: #fff; border-radius: 16px; border: 1px solid #eaedf3; padding: 28px; margin-bottom: 16px; }
  .loan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .loan-purpose { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600; }
  .loan-purpose-icon { font-size: 18px; }
  .loan-amount { font-size: 28px; font-weight: 600; color: #1a1a2e; letter-spacing: -1px; }
  .loan-status { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
  .loan-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 20px 0; border-top: 1px solid #f0f2f7; border-bottom: 1px solid #f0f2f7; margin-bottom: 20px; }
  .loan-stat-label { font-size: 11px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .loan-stat-value { font-size: 16px; font-weight: 600; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .loan-actions { display: flex; gap: 10px; }
  .btn-secondary { flex: 1; background: #fff; color: #1a1a2e; border: 1px solid #e0e4ec; padding: 11px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-secondary:hover { background: #f9fafc; border-color: #1a1a2e; }
  .btn-pay { flex: 1; background: #1a7a3c; color: #fff; border: none; padding: 11px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .btn-pay:hover { background: #226a37; }
  .status-msg { flex: 1; text-align: center; padding: 11px; border-radius: 8px; font-size: 13px; font-weight: 600; }
`;

export default function Portal() {
  const [user, setUser] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [smartModal, setSmartModal] = useState(null); // {loan, status} when open
  const [partialAmount, setPartialAmount] = useState("");
  const navigate = useNavigate();
  const handlePayEMI = async (loan) => {
    setPaying(loan.id);
    try {
      const token = localStorage.getItem("token");
      const { data: status } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/emi-status/${loan.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSmartModal({ loan, status });
      setPartialAmount(String(Math.round(status.min_partial_amount)));
      setPaying(null);
    } catch (e) {
      alert("Could not load payment info");
      setPaying(null);
    }
  };

  const processPayment = async (paymentType, customAmount = null) => {
    const loan = smartModal.loan;
    setSmartModal(null);
    setPaying(loan.id);
    try {
      const token = localStorage.getItem("token");
      const { data: orderData } = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/create-payment-order/${loan.id}`,
        { payment_type: paymentType, amount: customAmount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (orderData.error) {
        alert("Payment failed: " + orderData.error);
        setPaying(null);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "LoanSense",
        description: `${paymentType === "partial" ? "Partial EMI" : "EMI"} for ${orderData.loan_purpose} loan${orderData.late_fee > 0 ? ` (incl. ₹${orderData.late_fee} late fee)` : ""}`,
        order_id: orderData.order_id,
        handler: async (response) => {
          try {
            const { data: verifyData } = await axios.post(
              `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/verify-payment`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log("verify-payment response:", verifyData);
            if (verifyData && verifyData.success) {
              const note = verifyData.carryover_note
                ? `\n\n${verifyData.carryover_note}`
                : "";
              alert(`✓ ₹${Math.round(orderData.emi_amount).toLocaleString()} paid successfully!${note}`);
              window.location.reload();
            } else {
              alert(verifyData?.error || "Payment verification failed");
            }
          } catch (e) {
            console.error("verify-payment error:", e);
            // The payment may have actually succeeded on the backend even if the
            // response failed to reach us. Tell the user to refresh and check.
            alert("Payment was submitted. If it doesn't appear, please refresh the page in a moment.");
          }
          setPaying(null);
        },
        prefill: { name: user.name, email: user.email },
        theme: { color: "#1a1a2e" },
        modal: { ondismiss: () => setPaying(null) }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      alert("Payment failed: " + e.message);
      setPaying(null);
    }
  };
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (!token || !storedUser) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(storedUser));

    const fetchLoans = async () => {
      try {
        const { data } = await axios.get(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/my-loans`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(data)) setLoans(data);
      } catch (err) {
        if (err.response?.status === 401) navigate("/login");
      }
      setLoading(false);
    };
    fetchLoans();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null;

  const initials = (user?.name || "").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase() || "U";

  const getStatusColors = (status) => {
    switch (status) {
      case "pending": return { bg: "#fff3cd", text: "#856404" };
      case "approved": return { bg: "#d4f5e2", text: "#1a7a3c" };
      case "active": return { bg: "#dcfce7", text: "#15803d" };
      case "rejected": return { bg: "#fde8e8", text: "#c0392b" };
      case "paid": return { bg: "#e0f2fe", text: "#0369a1" };
      default: return { bg: "#f0f2f7", text: "#5a6378" };
    }
  };

  return (
    <AppShell title="Home">
      <style>{styles}</style>
        <div className="portal-body">
          <div className="header-row">
            <div>
              <div className="welcome">Hello, {(user?.name || "there").split(" ")[0]} 👋</div>
              <div className="welcome-sub">Here's your loan overview</div>
            </div>
            {loans.length > 0 && (
              <div style={{display: "flex", gap: 10, flexWrap: "wrap"}}>
                <button className="apply-btn" onClick={() => navigate("/faq")}
                  style={{background: "#fff", color: "#1a1a2e", border: "1px solid #e0e4ec"}}>
                  ❓ Help
                </button>
                <button className="apply-btn" onClick={() => navigate("/affordability")}
                  style={{background: "linear-gradient(135deg, #4c6ef5 0%, #7048e8 100%)"}}>
                  💡 Check affordability
                </button>
                <button className="apply-btn" onClick={() => navigate("/apply")}>+ Apply for new loan</button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-title">Loading your loans...</div>
            </div>
          ) : loans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💰</div>
              <div className="empty-title">No loans yet</div>
              <div className="empty-sub">You don't have any active loans. Apply for one to get started.</div>
              <button className="btn-primary" onClick={() => navigate("/apply")}>Apply for a loan</button>
            </div>
          ) : (
            loans.map(l => {
              const statusColors = getStatusColors(l.status);
              const purposeLabel = l.purpose ? l.purpose.charAt(0).toUpperCase() + l.purpose.slice(1) : "Loan";
              return (
                <div className="loan-card" key={l.id}>
                  <div className="loan-header">
                    <div>
                      <div className="loan-purpose">
                        <span className="loan-purpose-icon">{PURPOSE_ICONS[l.purpose] || "💰"}</span>
                        {purposeLabel} Loan
                      </div>
                      <div className="loan-amount">₹{l.loan_amnt.toLocaleString()}</div>
                    </div>
                    <span className="loan-status" style={{ background: statusColors.bg, color: statusColors.text }}>
                      {l.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="loan-grid">
                    <div>
                      <div className="loan-stat-label">EMI</div>
                      <div className="loan-stat-value">₹{l.installment ? Math.round(l.installment).toLocaleString() : "--"}</div>
                    </div>
                    <div>
                      <div className="loan-stat-label">Interest</div>
                      <div className="loan-stat-value">{l.int_rate}%</div>
                    </div>
                    <div>
                      <div className="loan-stat-label">Tenure</div>
                      <div className="loan-stat-value">{l.term} mo</div>
                    </div>
                    <div>
                      <div className="loan-stat-label">Risk Score</div>
                      <div className="loan-stat-value">{Math.round((l.risk_score || 0) * 100)}%</div>
                    </div>
                  </div>
                  <div className="loan-actions">
                    {l.status === "pending" && (
                      <div className="status-msg" style={{ background: "#fff3cd", color: "#856404" }}>
                        ⏳ Awaiting bank approval
                      </div>
                    )}
                    {l.status === "approved" && (
                      <div className="status-msg" style={{ background: "#d4f5e2", color: "#1a7a3c" }}>
                        ✓ Approved — awaiting disbursement
                      </div>
                    )}
                    {l.status === "rejected" && (
                      <div className="status-msg" style={{ background: "#fde8e8", color: "#c0392b" }}>
                        ✗ Rejected: {l.rejection_reason || "Did not meet criteria"}
                      </div>
                    )}
                    <button className="btn-secondary" onClick={() => navigate(`/loan/${l.id}`)}>View details</button>
                    {l.status === "active" && (
  <>
    <button className="btn-secondary" onClick={() => navigate(`/loan/${l.id}`)}>Request deferral</button>
    <button className="btn-pay" onClick={() => handlePayEMI(l)} disabled={paying === l.id}>
      {paying === l.id ? "Processing..." : "Pay EMI"}
    </button>
  </>
)}
                    {l.status === "closed" && (
                      <button className="btn-pay" style={{background: "#1a7a3c"}} onClick={() => navigate(`/loan/${l.id}`)}>
                        📄 Get NOC
                      </button>
                    )}
                    {l.status === "paid" && (
                      <div className="status-msg" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                        ✓ Loan fully paid
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {smartModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20
          }} onClick={() => setSmartModal(null)}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: 32,
              maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto"
            }} onClick={e => e.stopPropagation()}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20}}>
                <div style={{fontSize: 18, fontWeight: 600}}>💳 EMI Payment</div>
                <button onClick={() => setSmartModal(null)} style={{
                  background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#8892a4"
                }}>×</button>
              </div>

              <div style={{
                padding: 16, borderRadius: 12, marginBottom: 20,
                background: smartModal.status.suggestion.primary === "urgent" ? "#fde8e8"
                          : smartModal.status.suggestion.primary === "late" ? "#fff3cd"
                          : smartModal.status.suggestion.primary === "grace" ? "#e7f3ff"
                          : smartModal.status.suggestion.primary === "due_soon" ? "#fff3cd"
                          : "#d4f5e2",
                border: "1px solid " + (smartModal.status.suggestion.primary === "urgent" ? "#f5c6cb"
                          : smartModal.status.suggestion.primary === "late" ? "#ffeaa7"
                          : smartModal.status.suggestion.primary === "grace" ? "#b3d4ff"
                          : smartModal.status.suggestion.primary === "due_soon" ? "#ffeaa7"
                          : "#c3e6cb")
              }}>
                <div style={{fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#1a1a2e"}}>
                  {smartModal.status.suggestion.title}
                </div>
                <div style={{fontSize: 13, color: "#5a6378", lineHeight: 1.5}}>
                  {smartModal.status.suggestion.description}
                </div>
                {smartModal.status.in_grace_period && (
                  <div style={{
                    marginTop: 12, padding: "10px 12px",
                    background: "#fff", border: "1px dashed #b3d4ff",
                    borderRadius: 8, fontSize: 12, color: "#2c5282", lineHeight: 1.5
                  }}>
                    💡 <b>Grace period:</b> RBI allows banks a {smartModal.status.grace_days}-day buffer after each EMI due date. Pay within this window with no late fee. {smartModal.status.grace_days_left} day{smartModal.status.grace_days_left !== 1 ? 's' : ''} remaining.
                  </div>
                )}
              </div>

              <div style={{padding: "12px 0", borderTop: "1px solid #f0f2f7", borderBottom: "1px solid #f0f2f7", marginBottom: 16}}>
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6}}>
                  <span style={{color: "#8892a4"}}>Expected EMI</span>
                  <span style={{fontWeight: 600, fontFamily: "DM Mono"}}>₹{smartModal.status.expected_emi.toLocaleString()}</span>
                </div>
                {smartModal.status.emi_adjustment > 0 && (
                  <div style={{
                    background: "#fff8e6", border: "1px solid #ffe0a3", borderRadius: 8,
                    padding: "8px 10px", fontSize: 11, color: "#8a6d3b", marginBottom: 8, lineHeight: 1.4
                  }}>
                    ⓘ This includes +₹{smartModal.status.emi_adjustment.toLocaleString()}/month from your earlier partial payment
                    (₹{smartModal.status.carryover_balance.toLocaleString()} spread across remaining EMIs).
                    Base EMI was ₹{smartModal.status.base_emi.toLocaleString()}.
                  </div>
                )}
                {smartModal.status.late_fee > 0 && (
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#c0392b"}}>
                    <span>Late fee ({smartModal.status.days_late} days late)</span>
                    <span style={{fontWeight: 600, fontFamily: "DM Mono"}}>+ ₹{smartModal.status.late_fee.toLocaleString()}</span>
                  </div>
                )}
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, paddingTop: 6, borderTop: "1px solid #f0f2f7"}}>
                  <span>Total due today</span>
                  <span style={{fontFamily: "DM Mono"}}>₹{smartModal.status.total_due_today.toLocaleString()}</span>
                </div>
              </div>

              <button onClick={() => processPayment("full")} style={{
                width: "100%", padding: 14, background: "#1a7a3c", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", marginBottom: 10, fontFamily: "inherit"
              }}>
                Pay Full ₹{smartModal.status.total_due_today.toLocaleString()}
              </button>

              <div style={{
                background: "#fafbfc", padding: 14, borderRadius: 10, marginBottom: 10,
                border: "1px solid #eaedf3"
              }}>
                <div style={{fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#1a1a2e"}}>
                  Can't pay full? Pay partial amount:
                </div>
                <div style={{fontSize: 11, color: "#8892a4", marginBottom: 8}}>
                  Minimum: ₹{smartModal.status.min_partial_amount.toLocaleString()} (30% of EMI). Remaining balance carries over.
                </div>
                <div style={{display: "flex", gap: 8}}>
                  <input type="number" value={partialAmount}
                    onChange={e => setPartialAmount(e.target.value)}
                    min={smartModal.status.min_partial_amount}
                    max={smartModal.status.expected_emi}
                    style={{
                      flex: 1, padding: "10px 12px", border: "1px solid #e0e4ec",
                      borderRadius: 8, fontSize: 14, fontFamily: "inherit"
                    }} />
                  <button onClick={() => processPayment("partial", parseFloat(partialAmount))}
                    style={{
                      padding: "10px 18px", background: "#1a1a2e", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit"
                    }}>
                    Pay Partial
                  </button>
                </div>
              </div>

              {smartModal.status.suggestion.options?.includes("request_deferral") && (
                <button onClick={() => {
                  setSmartModal(null);
                  navigate(`/loan/${smartModal.loan.id}`);
                }} style={{
                  width: "100%", padding: 12, background: "#fff", color: "#1a1a2e",
                  border: "1px solid #e0e4ec", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit"
                }}>
                  Can't pay anything? Request deferral instead
                </button>
              )}
           </div>
          </div>
        )}
        <SupportChat />
    </AppShell>
  );
}