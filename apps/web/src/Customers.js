import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const styles = `
  .cust-intro { font-size: 13px; color: #5a6378; margin-bottom: 22px; line-height: 1.5; max-width: 600px; }
  .cust-table { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; overflow: hidden; }
  .cust-head { display: grid; grid-template-columns: 2fr 1fr 1fr 1.2fr 1fr; gap: 12px; padding: 14px 20px; background: #fafbfc; border-bottom: 1px solid #eaedf3; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8892a4; font-weight: 600; }
  .cust-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1.2fr 1fr; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #f4f6fa; cursor: pointer; transition: background 0.12s; align-items: center; }
  .cust-row:hover { background: #fafbff; }
  .cust-row:last-child { border-bottom: none; }
  .cust-name { font-size: 14px; font-weight: 600; color: #1a1a2e; }
  .cust-email { font-size: 12px; color: #8892a4; margin-top: 2px; }
  .cust-cell { font-size: 13px; color: #5a6378; font-family: 'DM Mono', monospace; }
  .cust-exposure { font-size: 14px; font-weight: 700; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .risk-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 8px; display: inline-block; }
  .risk-LOW { background: #e8f6ed; color: #1a7a3c; }
  .risk-MEDIUM { background: #fff3cd; color: #856404; }
  .risk-HIGH { background: #fde8e8; color: #c0392b; }
  .cust-loading { color: #8892a4; padding: 40px; text-align: center; }
  .cust-arrow { color: #c0c6d4; font-size: 16px; text-align: right; }
`;

const fmtMoney = (n) => {
  if (n >= 10000000) return "₹" + (n/10000000).toFixed(2) + "Cr";
  if (n >= 100000) return "₹" + (n/100000).toFixed(2) + "L";
  if (n >= 1000) return "₹" + (n/1000).toFixed(1) + "K";
  return "₹" + Math.round(n);
};

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data } = await axios.get(`${API}/analyst/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomers(data.customers || []);
      } catch (e) {
        console.error("Failed to load customers", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <AppShell title="Customers">
      <style>{styles}</style>
      <div className="cust-intro">
        All borrowers, sorted by total exposure. Click any customer to see their full profile, loans, payment behavior, and AI-driven risk analysis.
      </div>

      {loading ? (
        <div className="cust-loading">Loading customers…</div>
      ) : customers.length === 0 ? (
        <div className="cust-loading">No customers yet.</div>
      ) : (
        <div className="cust-table">
          <div className="cust-head">
            <div>Customer</div>
            <div>Loans</div>
            <div>Avg Risk</div>
            <div>Exposure</div>
            <div>Top Risk</div>
          </div>
          {customers.map(c => (
            <div key={c.id} className="cust-row" onClick={() => navigate(`/customer/${c.id}`)}>
              <div>
                <div className="cust-name">{c.name}</div>
                <div className="cust-email">{c.email}</div>
              </div>
              <div className="cust-cell">{c.active_loans} active / {c.total_loans} total</div>
              <div className="cust-cell">{(c.avg_risk_score * 100).toFixed(0)}%</div>
              <div className="cust-exposure">{fmtMoney(c.total_exposure)}</div>
              <div>
                <span className={`risk-pill risk-${c.top_risk}`}>{c.top_risk}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
