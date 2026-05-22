import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const LOAN_OPTIONS = [
  { id: "personal", name: "Personal Loan", icon: "👤", desc: "For any personal need" },
  { id: "home", name: "Home Loan", icon: "🏠", desc: "Buy or build your home" },
  { id: "car", name: "Car Loan", icon: "🚗", desc: "Get your dream vehicle" },
  { id: "education", name: "Education Loan", icon: "🎓", desc: "Invest in your future" },
  { id: "business", name: "Business Loan", icon: "💼", desc: "Grow your business" },
  { id: "medical", name: "Medical Loan", icon: "🏥", desc: "Healthcare emergencies" },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f7f8fc; color: #1a1a2e; }
  .wrap { min-height: 100vh; padding: 32px 20px; }
  .container { max-width: 720px; margin: 0 auto; }
  .back-btn { background: none; border: none; color: #5a6378; font-size: 13px; font-weight: 500; cursor: pointer; padding: 6px 0; margin-bottom: 20px; font-family: inherit; }
  .back-btn:hover { color: #1a1a2e; }
  .steps { display: flex; align-items: center; gap: 8px; margin-bottom: 28px; }
  .step-dot { flex: 1; height: 4px; border-radius: 999px; background: #e0e4ec; transition: background 0.3s; }
  .step-dot.active { background: #1a1a2e; }
  .step-label { font-size: 12px; color: #8892a4; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .card { background: #fff; border-radius: 16px; padding: 36px; border: 1px solid #eaedf3; }
  .title { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .sub { font-size: 14px; color: #8892a4; margin-bottom: 28px; }
  .loan-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .loan-card { padding: 18px; border: 1px solid #e0e4ec; border-radius: 12px; cursor: pointer; transition: all 0.15s; background: #fff; }
  .loan-card:hover { border-color: #1a1a2e; background: #fafbfc; }
  .loan-card.selected { border-color: #1a1a2e; background: #f4f6ff; box-shadow: 0 0 0 3px rgba(26,26,46,0.08); }
  .loan-icon { font-size: 28px; margin-bottom: 8px; }
  .loan-name { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
  .loan-desc { font-size: 12px; color: #8892a4; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field { margin-bottom: 16px; }
  .field.full { grid-column: 1 / -1; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: #5a6378; margin-bottom: 6px; }
  .field input, .field select { width: 100%; padding: 11px 14px; border: 1px solid #e0e4ec; border-radius: 8px; font-size: 14px; font-family: inherit; background: #fff; }
  .field input:focus, .field select:focus { outline: none; border-color: #1a1a2e; }
  .field-hint { font-size: 11px; color: #8892a4; margin-top: 4px; }
  .actions { display: flex; gap: 12px; margin-top: 20px; }
  .btn { padding: 12px 24px; border-radius: 9px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; border: none; }
  .btn-primary { flex: 1; background: #1a1a2e; color: #fff; }
  .btn-primary:hover { background: #2d3561; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: #fff; color: #1a1a2e; border: 1px solid #e0e4ec; }
  .btn-secondary:hover { background: #f9fafc; }
  .review-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f2f7; }
  .review-row:last-child { border-bottom: none; }
  .review-label { font-size: 13px; color: #8892a4; }
  .review-value { font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .emi-box { background: linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%); color: #fff; padding: 24px; border-radius: 12px; margin: 20px 0; text-align: center; }
  .emi-label { font-size: 12px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .emi-value { font-size: 32px; font-weight: 600; letter-spacing: -1px; }
  .emi-sub { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .success-card { background: #f0fff4; border: 1px solid #c3e6cb; padding: 32px; border-radius: 16px; text-align: center; }
  .success-icon { font-size: 48px; margin-bottom: 12px; }
  .success-title { font-size: 20px; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; }
  .success-sub { font-size: 14px; color: #5a6378; margin-bottom: 20px; }
  .pending-badge { display: inline-block; background: #fff3cd; color: #856404; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .error-box { background: #fde8e8; color: #c0392b; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
`;

export default function ApplyLoan() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loanTypes, setLoanTypes] = useState({});
  const [form, setForm] = useState({
    purpose: "",
    loan_amnt: "",
    term: 36,
    int_rate: "",
    grade: 3,
    annual_inc: "",
    dti: "",
    fico_avg: 720,
    emp_length: 1
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/loan-types").then(r => setLoanTypes(r.data));
  }, []);

  const cfg = loanTypes[form.purpose];

  const selectLoan = (id) => {
    const c = loanTypes[id];
    setForm({
      ...form,
      purpose: id,
      loan_amnt: c.min,
      int_rate: (c.rate_range[0] + c.rate_range[1]) / 2
    });
    setError("");
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const calcEMI = () => {
    const p = parseFloat(form.loan_amnt) || 0;
    const r = (parseFloat(form.int_rate) || 0) / 100 / 12;
    const n = parseInt(form.term) || 1;
    if (r === 0) return p / n;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const next = () => {
    setError("");
    if (step === 1 && !form.purpose) { setError("Please select a loan type"); return; }
    if (step === 2) {
      const amt = parseFloat(form.loan_amnt);
      if (!amt || amt < cfg.min || amt > cfg.max) {
        setError(`Amount must be between ₹${cfg.min.toLocaleString()} and ₹${cfg.max.toLocaleString()}`);
        return;
      }
      if (form.term > cfg.max_tenure) {
        setError(`Max tenure for ${form.purpose} loans is ${cfg.max_tenure} months`);
        return;
      }
    }
    if (step === 3) {
      if (!form.annual_inc || !form.dti) { setError("Please fill all fields"); return; }
    }
    setStep(step + 1);
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post("http://127.0.0.1:8000/apply-loan", form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError("Submission failed. Try again.");
    }
    setLoading(false);
  };

  const selectedLoan = LOAN_OPTIONS.find(l => l.id === form.purpose);

  if (result) {
    return (
      <>
        <style>{styles}</style>
        <div className="wrap">
          <div className="container">
            <div className="success-card">
              <div className="success-icon">⏳</div>
              <div className="success-title">Application submitted!</div>
              <div className="success-sub">Your {selectedLoan?.name} for ₹{parseFloat(form.loan_amnt).toLocaleString()} is being reviewed by our team.</div>
              <div className="pending-badge">Pending Bank Approval</div>
              <div style={{marginTop: 24}}>
                <button className="btn btn-primary" style={{width: "auto"}} onClick={() => navigate("/portal")}>Go to portal</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="wrap">
        <div className="container">
          <button className="back-btn" onClick={() => navigate("/portal")}>← Back to portal</button>

          <div className="step-label">Step {step} of 4</div>
          <div className="steps">
            {[1,2,3,4].map(n => <div key={n} className={`step-dot ${n <= step ? "active" : ""}`} />)}
          </div>

          <div className="card">
            {error && <div className="error-box">{error}</div>}

            {step === 1 && (
              <>
                <div className="title">What type of loan?</div>
                <div className="sub">Choose the purpose that best fits your need</div>
                <div className="loan-grid">
                  {LOAN_OPTIONS.map(l => (
                    <div key={l.id} className={`loan-card ${form.purpose === l.id ? "selected" : ""}`}
                         onClick={() => selectLoan(l.id)}>
                      <div className="loan-icon">{l.icon}</div>
                      <div className="loan-name">{l.name}</div>
                      <div className="loan-desc">{l.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 2 && cfg && (
              <>
                <div className="title">Loan details</div>
                <div className="sub">How much do you need and for how long?</div>
                <div className="form-grid">
                  <div className="field full">
                    <label>Loan amount (₹)</label>
                    <input type="number" name="loan_amnt" value={form.loan_amnt} onChange={handleChange}
                           min={cfg.min} max={cfg.max} />
                    <div className="field-hint">Between ₹{cfg.min.toLocaleString()} and ₹{cfg.max.toLocaleString()}</div>
                  </div>
                  <div className="field">
                    <label>Tenure (months)</label>
                    <select name="term" value={form.term} onChange={handleChange}>
                      {[12, 24, 36, 48, 60, 84, 120, 180, 240].filter(t => t <= cfg.max_tenure).map(t =>
                        <option key={t} value={t}>{t} months</option>
                      )}
                    </select>
                  </div>
                  <div className="field">
                    <label>Interest rate (%)</label>
                    <input type="number" name="int_rate" value={form.int_rate} onChange={handleChange}
                           step="0.5" min={cfg.rate_range[0]} max={cfg.rate_range[1]} />
                    <div className="field-hint">{cfg.rate_range[0]}–{cfg.rate_range[1]}% for {form.purpose}</div>
                  </div>
                </div>

                {form.loan_amnt && form.int_rate && (
                  <div className="emi-box">
                    <div className="emi-label">Monthly EMI</div>
                    <div className="emi-value">₹{Math.round(calcEMI()).toLocaleString()}</div>
                    <div className="emi-sub">for {form.term} months</div>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="title">About your finances</div>
                <div className="sub">This helps the bank assess your eligibility</div>
                <div className="form-grid">
                  <div className="field">
                    <label>Annual income (₹)</label>
                    <input type="number" name="annual_inc" value={form.annual_inc} onChange={handleChange} placeholder="600000" />
                  </div>
                  <div className="field">
                    <label>Debt-to-income ratio</label>
                    <input type="number" name="dti" value={form.dti} onChange={handleChange} step="0.1" placeholder="15" />
                    <div className="field-hint">Monthly debts ÷ income × 100</div>
                  </div>
                  <div className="field">
                    <label>Credit score (FICO)</label>
                    <input type="number" name="fico_avg" value={form.fico_avg} onChange={handleChange} min="500" max="850" />
                  </div>
                  <div className="field">
                    <label>Employment length (years)</label>
                    <input type="number" name="emp_length" value={form.emp_length} onChange={handleChange} min="0" max="50" />
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="title">Review your application</div>
                <div className="sub">Confirm details before submission</div>
                <div className="review-row">
                  <div className="review-label">Loan type</div>
                  <div className="review-value">{selectedLoan?.icon} {selectedLoan?.name}</div>
                </div>
                <div className="review-row">
                  <div className="review-label">Loan amount</div>
                  <div className="review-value">₹{parseFloat(form.loan_amnt).toLocaleString()}</div>
                </div>
                <div className="review-row">
                  <div className="review-label">Tenure</div>
                  <div className="review-value">{form.term} months</div>
                </div>
                <div className="review-row">
                  <div className="review-label">Interest rate</div>
                  <div className="review-value">{form.int_rate}%</div>
                </div>
                <div className="review-row">
                  <div className="review-label">Annual income</div>
                  <div className="review-value">₹{parseFloat(form.annual_inc).toLocaleString()}</div>
                </div>
                <div className="emi-box">
                  <div className="emi-label">Monthly EMI</div>
                  <div className="emi-value">₹{Math.round(calcEMI()).toLocaleString()}</div>
                  <div className="emi-sub">After bank approval, this is what you'll pay each month</div>
                </div>
              </>
            )}

            <div className="actions">
              {step > 1 && <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>}
              {step < 4 && <button className="btn btn-primary" onClick={next}>Continue</button>}
              {step === 4 && <button className="btn btn-primary" onClick={submit} disabled={loading}>
                {loading ? "Submitting..." : "Submit application"}
              </button>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}