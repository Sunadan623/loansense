import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f7f8fc; color: #1a1a2e; }
  .wrap { min-height: 100vh; padding: 32px 20px; }
  .container { max-width: 880px; margin: 0 auto; }
  .back-btn { background: none; border: none; color: #5a6378; font-size: 13px; font-weight: 500; cursor: pointer; padding: 6px 0; margin-bottom: 20px; font-family: inherit; }
  .hero { background: linear-gradient(135deg, #4c6ef5 0%, #7048e8 100%); border-radius: 20px; padding: 36px; color: #fff; margin-bottom: 24px; }
  .hero h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .hero p { font-size: 14px; opacity: 0.9; line-height: 1.5; max-width: 580px; }
  .card { background: #fff; border-radius: 16px; padding: 32px; border: 1px solid #eaedf3; margin-bottom: 20px; }
  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 18px; color: #1a1a2e; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field { margin-bottom: 14px; }
  .field.full { grid-column: 1 / -1; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: #5a6378; margin-bottom: 6px; }
  .field input, .field select { width: 100%; padding: 11px 14px; border: 1px solid #e0e4ec; border-radius: 8px; font-size: 14px; font-family: inherit; }
  .field input:focus, .field select:focus { outline: none; border-color: #4c6ef5; }
  .field-hint { font-size: 11px; color: #8892a4; margin-top: 4px; }
  .btn { padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; }
  .btn-primary { background: #1a1a2e; color: #fff; width: 100%; margin-top: 10px; }
  .btn-primary:hover { background: #2d3561; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .results { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .zone { padding: 18px; border-radius: 12px; text-align: center; }
  .zone.safe { background: #d4f5e2; border: 1px solid #a3d9b1; }
  .zone.caution { background: #fff3cd; border: 1px solid #ffd966; }
  .zone.risky { background: #fde8e8; border: 1px solid #f5b7b1; }
  .zone-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .zone.safe .zone-label { color: #1a7a3c; }
  .zone.caution .zone-label { color: #856404; }
  .zone.risky .zone-label { color: #c0392b; }
  .zone-value { font-size: 22px; font-weight: 700; font-family: 'DM Mono', monospace; color: #1a1a2e; }
  .zone-sub { font-size: 11px; color: #5a6378; margin-top: 4px; }
  .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f7f8fc; font-size: 13px; }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { color: #8892a4; }
  .stat-value { font-weight: 600; font-family: 'DM Mono', monospace; }
  .verdict-card { padding: 24px; border-radius: 14px; margin-bottom: 16px; }
  .verdict-card.safe { background: linear-gradient(135deg, #d4f5e2 0%, #b8eccb 100%); border: 1px solid #a3d9b1; }
  .verdict-card.caution { background: linear-gradient(135deg, #fff3cd 0%, #ffe082 100%); border: 1px solid #ffd966; }
  .verdict-card.risky { background: linear-gradient(135deg, #fde8e8 0%, #fab8b8 100%); border: 1px solid #f5b7b1; }
  .verdict-card.unaffordable { background: linear-gradient(135deg, #fde8e8 0%, #f5a5a5 100%); border: 1px solid #e88080; }
  .verdict-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
  .verdict-msg { font-size: 13px; color: #1a1a2e; line-height: 1.6; }
  .alternative { background: #f0f8ff; border: 1px solid #b3d4ff; border-radius: 12px; padding: 18px; margin-top: 12px; }
  .alt-title { font-size: 12px; font-weight: 600; color: #2c5282; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .alt-amount { font-size: 24px; font-weight: 700; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .alt-sub { font-size: 12px; color: #5a6378; margin-top: 4px; }
  .check-toggle { background: #f7f8fc; padding: 14px; border-radius: 10px; margin: 16px 0; display: flex; gap: 10px; align-items: center; cursor: pointer; }
  .check-toggle input { margin: 0; }
  .error-box { background: #fde8e8; color: #c0392b; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
`;

export default function AffordabilityCoach() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    annual_income: "",
    monthly_essentials: "",
    existing_emis: "0",
    dependents: 0,
    check_loan: false,
    planned_loan_amount: "",
    planned_tenure: 36,
    planned_rate: 12
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const submit = async () => {
    setError("");
    if (!form.annual_income) { setError("Please enter your annual income"); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        annual_income: parseFloat(form.annual_income),
        monthly_essentials: parseFloat(form.monthly_essentials || 0),
        existing_emis: parseFloat(form.existing_emis || 0),
        dependents: parseInt(form.dependents || 0)
      };
      if (form.check_loan && form.planned_loan_amount) {
        payload.planned_loan_amount = parseFloat(form.planned_loan_amount);
        payload.planned_tenure = parseInt(form.planned_tenure);
        payload.planned_rate = parseFloat(form.planned_rate);
      }
      const { data } = await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/affordability-check`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError("Could not calculate. Try again.");
    }
    setLoading(false);
  };

  return (
    <AppShell title="Affordability Coach">
      <style>{styles}</style>
      <div className="wrap">
        <div className="container">

          <div className="hero">
            <h1>💡 Affordability Coach</h1>
            <p>Before you take a loan, let's check if it's actually safe for your finances. We'll calculate the maximum EMI you can afford based on RBI guidelines, so you don't end up with payments you can't handle.</p>
          </div>

          <div className="card">
            <div className="section-title">Your financial snapshot</div>
            {error && <div className="error-box">{error}</div>}
            <div className="form-grid">
              <div className="field">
                <label>Annual income (₹)</label>
                <input type="number" name="annual_income" value={form.annual_income}
                       onChange={handleChange} placeholder="600000" />
                <div className="field-hint">Total yearly earnings (salary + other income)</div>
              </div>
              <div className="field">
                <label>Monthly essential expenses (₹)</label>
                <input type="number" name="monthly_essentials" value={form.monthly_essentials}
                       onChange={handleChange} placeholder="25000" />
                <div className="field-hint">Rent, food, utilities, transport</div>
              </div>
              <div className="field">
                <label>Existing monthly EMIs (₹)</label>
                <input type="number" name="existing_emis" value={form.existing_emis}
                       onChange={handleChange} placeholder="0" />
                <div className="field-hint">All current loan EMIs combined</div>
              </div>
              <div className="field">
                <label>Number of dependents</label>
                <select name="dependents" value={form.dependents} onChange={handleChange}>
                  <option value="0">0 (just me)</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4 or more</option>
                </select>
                <div className="field-hint">Adds ₹3,000/dependent to essentials</div>
              </div>
            </div>

            <label className="check-toggle">
              <input type="checkbox" name="check_loan" checked={form.check_loan} onChange={handleChange} />
              <span style={{fontSize: 13, fontWeight: 500}}>I want to check a specific loan</span>
            </label>

            {form.check_loan && (
              <div className="form-grid" style={{marginTop: 10}}>
                <div className="field">
                  <label>Loan amount (₹)</label>
                  <input type="number" name="planned_loan_amount" value={form.planned_loan_amount}
                         onChange={handleChange} placeholder="500000" />
                </div>
                <div className="field">
                  <label>Tenure (months)</label>
                  <input type="number" name="planned_tenure" value={form.planned_tenure}
                         onChange={handleChange} min="6" max="360" />
                </div>
                <div className="field">
                  <label>Interest rate (%)</label>
                  <input type="number" name="planned_rate" value={form.planned_rate}
                         onChange={handleChange} step="0.5" min="5" max="25" />
                </div>
              </div>
            )}

            <button className="btn btn-primary" onClick={submit} disabled={loading}>
              {loading ? "Analyzing..." : "Check my affordability"}
            </button>
          </div>

          {result && (
            <>
              {result.planned_check && (
                <div className="card">
                  <div className={`verdict-card ${result.planned_check.verdict}`}>
                    <div className="verdict-title">{result.planned_check.verdict_title}</div>
                    <div className="verdict-msg">{result.planned_check.verdict_msg}</div>
                  </div>
                  {result.planned_check.verdict !== "safe" && result.planned_check.safer_loan_amount > 0 && (
                    <div className="alternative">
                      <div className="alt-title">💡 Safer alternative we suggest</div>
                      <div className="alt-amount">₹{result.planned_check.safer_loan_amount.toLocaleString()}</div>
                      <div className="alt-sub">
                        At similar terms, this would give you a ₹{result.planned_check.safer_emi.toLocaleString()}/month EMI — comfortably in the safe zone.
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="card">
                <div className="section-title">Your EMI zones</div>
                <div className="results">
                  <div className="zone safe">
                    <div className="zone-label">✅ Safe</div>
                    <div className="zone-value">₹{result.safe_new_emi.toLocaleString()}</div>
                    <div className="zone-sub">Comfortable EMI</div>
                  </div>
                  <div className="zone caution">
                    <div className="zone-label">⚠ Caution</div>
                    <div className="zone-value">₹{result.caution_new_emi.toLocaleString()}</div>
                    <div className="zone-sub">Borderline — be careful</div>
                  </div>
                  <div className="zone risky">
                    <div className="zone-label">🚫 Risky</div>
                    <div className="zone-value">₹{result.max_new_emi.toLocaleString()}</div>
                    <div className="zone-sub">Bank ceiling — avoid</div>
                  </div>
                </div>

                <div className="section-title" style={{marginTop: 16}}>The numbers</div>
                <div className="stat-row">
                  <span className="stat-label">Monthly income</span>
                  <span className="stat-value">₹{result.monthly_income.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Essential expenses</span>
                  <span className="stat-value">₹{result.total_essentials.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Existing EMIs</span>
                  <span className="stat-value">₹{result.existing_emis.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Current FOAIR</span>
                  <span className="stat-value">{result.current_foair_pct}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Free income</span>
                  <span className="stat-value" style={{color: "#1a7a3c"}}>₹{result.free_income.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}