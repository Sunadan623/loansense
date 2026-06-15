import { useState, useEffect } from "react";
import axios from "axios";
import AppShell from "./AppShell";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const styles = `
  .tx-intro { font-size: 13px; color: #5a6378; margin-bottom: 22px; line-height: 1.5; max-width: 580px; }
  .tx-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 26px; }
  .tx-stat { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 16px 18px; }
  .tx-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8892a4; font-weight: 600; }
  .tx-stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-top: 6px; font-family: 'DM Mono', monospace; }
  .tx-stat-value.green { color: #1a7a3c; }
  .tx-filters { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
  .tx-select { padding: 9px 14px; border: 1px solid #e0e4ec; border-radius: 9px; font-size: 13px; font-family: inherit; color: #1a1a2e; background: #fff; cursor: pointer; }
  .tx-count { font-size: 12px; color: #8892a4; margin-left: auto; }
  .tx-list { display: flex; flex-direction: column; gap: 10px; }
  .tx-row { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 18px; }
  .tx-date { flex-shrink: 0; width: 70px; }
  .tx-date-d { font-size: 15px; font-weight: 700; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .tx-date-t { font-size: 11px; color: #8892a4; margin-top: 2px; }
  .tx-mid { flex: 1; }
  .tx-purpose { font-size: 14px; font-weight: 600; color: #1a1a2e; text-transform: capitalize; }
  .tx-desc { font-size: 12px; color: #8892a4; margin-top: 2px; }
  .tx-breakdown { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; }
  .tx-chip { font-size: 11px; font-family: 'DM Mono', monospace; padding: 3px 9px; border-radius: 8px; background: #f4f6fa; color: #5a6378; }
  .tx-chip b { color: #1a1a2e; font-weight: 600; }
  .tx-chip.carry-pos { background: #fde8e8; color: #c0392b; }
  .tx-chip.carry-neg { background: #e8f6ed; color: #1a7a3c; }
  .tx-right { flex-shrink: 0; text-align: right; }
  .tx-amount { font-size: 18px; font-weight: 700; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .tx-type { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; padding: 3px 8px; border-radius: 7px; display: inline-block; margin-top: 5px; background: #eef0f5; color: #5a6378; }
  .tx-ref { font-size: 10px; color: #b0b6c5; margin-top: 5px; font-family: 'DM Mono', monospace; }
  .tx-empty { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 48px; text-align: center; color: #8892a4; font-size: 14px; }
  .tx-loading { color: #8892a4; font-size: 14px; padding: 40px; text-align: center; }
  @media (max-width: 760px) { .tx-summary { grid-template-columns: repeat(2, 1fr); } }
`;

const fmt = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Transactions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loanFilter, setLoanFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data } = await axios.get(`${API}/my-transactions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(data);
      } catch (e) {
        console.error("Failed to load transactions", e);
        setData({ transactions: [], summary: {} });
      }
      setLoading(false);
    };
    load();
  }, []);

  const txns = data?.transactions || [];
  const categories = [...new Set(txns.map(t => t.loan_purpose))].sort();
  const filtered = loanFilter === "all" ? txns : txns.filter(t => t.loan_purpose === loanFilter);

  return (
    <AppShell title="Transactions">
      <style>{styles}</style>
      <div className="tx-intro">
        Every payment you've made, with the exact breakdown of how much went to principal, interest, and fees. This is your complete payment ledger.
      </div>

      {loading ? (
        <div className="tx-loading">Loading your transactions…</div>
      ) : txns.length === 0 ? (
        <div className="tx-empty">No transactions yet. Once you make a payment, it'll appear here with a full breakdown.</div>
      ) : (
        <>
          <div className="tx-summary">
            <div className="tx-stat">
              <div className="tx-stat-label">Total Paid</div>
              <div className="tx-stat-value green">{fmt(data.summary.total_paid)}</div>
            </div>
            <div className="tx-stat">
              <div className="tx-stat-label">Toward Principal</div>
              <div className="tx-stat-value">{fmt(data.summary.total_principal)}</div>
            </div>
            <div className="tx-stat">
              <div className="tx-stat-label">Toward Interest</div>
              <div className="tx-stat-value">{fmt(data.summary.total_interest)}</div>
            </div>
            <div className="tx-stat">
              <div className="tx-stat-label">Fees Paid</div>
              <div className="tx-stat-value">{fmt(data.summary.total_fees)}</div>
            </div>
          </div>

          <div className="tx-filters">
            <select className="tx-select" value={loanFilter} onChange={e => setLoanFilter(e.target.value)}>
              <option value="all">All loans</option>
              {categories.map(cat => (
                <option key={cat} value={cat} style={{textTransform: "capitalize"}}>{cat} loans</option>
              ))}
            </select>
            <div className="tx-count">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</div>
          </div>

          <div className="tx-list">
            {filtered.map(t => {
              const dt = new Date(t.created_at);
              const carryClass = t.carryover > 0 ? "carry-pos" : t.carryover < 0 ? "carry-neg" : "";
              return (
                <div key={t.id} className="tx-row">
                  <div className="tx-date">
                    <div className="tx-date-d">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                    <div className="tx-date-t">{dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className="tx-mid">
                    <div className="tx-purpose">{t.loan_purpose} Loan #{t.loan_id}</div>
                    <div className="tx-desc">{t.description}</div>
                    <div className="tx-breakdown">
                      <span className="tx-chip">Principal <b>{fmt(t.principal)}</b></span>
                      <span className="tx-chip">Interest <b>{fmt(t.interest)}</b></span>
                      {t.fee > 0 && <span className="tx-chip">Fee <b>{fmt(t.fee)}</b></span>}
                      {t.carryover !== 0 && (
                        <span className={`tx-chip ${carryClass}`}>
                          Carryover <b>{t.carryover > 0 ? "+" : ""}{fmt(t.carryover)}</b>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="tx-right">
                    <div className="tx-amount">{fmt(t.amount)}</div>
                    <div className="tx-type">{(t.entry_type || "").replace("_", " ")}</div>
                    {t.reference && <div className="tx-ref">{t.reference}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
