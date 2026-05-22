import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

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
        const { data } = await axios.get("http://127.0.0.1:8000/my-loans", {
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
    <>
      <style>{styles}</style>
      <div className="portal">
        <div className="nav">
          <div className="nav-logo">
            <div className="nav-logo-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div className="nav-logo-text">LoanSense</div>
          </div>
          <div className="nav-user">
            <div className="nav-avatar">{initials}</div>
            <div>
              <div className="nav-name">{user.name}</div>
              <div className="nav-role">{user.role}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Sign out</button>
          </div>
        </div>

        <div className="portal-body">
          <div className="header-row">
            <div>
              <div className="welcome">Hello, {(user?.name || "there").split(" ")[0]} 👋</div>
              <div className="welcome-sub">Here's your loan overview</div>
            </div>
            {loans.length > 0 && (
              <button className="apply-btn" onClick={() => navigate("/apply")}>+ Apply for new loan</button>
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
                    {l.status === "active" && (
                      <>
                        <button className="btn-secondary">View details</button>
                        <button className="btn-secondary">Request deferral</button>
                        <button className="btn-pay">Pay EMI</button>
                      </>
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
      </div>
    </>
  );
}