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
  { id: "gold", name: "Gold Loan", icon: "🪙", desc: "Loan against gold jewelry" },
];

const COLLATERAL_TYPES = {
  property: { name: "Property", icon: "🏘", placeholder: "E.g., 2BHK flat in Mumbai, market value ₹80 lakhs" },
  gold: { name: "Gold", icon: "🪙", placeholder: "E.g., 200 grams of 22K gold jewelry" },
  vehicle: { name: "Vehicle", icon: "🚗", placeholder: "Vehicle make, model, year" },
  fd: { name: "Fixed Deposit", icon: "💰", placeholder: "FD certificate number, bank name" },
};

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
  .field input, .field select, .field textarea { width: 100%; padding: 11px 14px; border: 1px solid #e0e4ec; border-radius: 8px; font-size: 14px; font-family: inherit; background: #fff; }
  .field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #1a1a2e; }
  .field-hint { font-size: 11px; color: #8892a4; margin-top: 4px; }
  .field-help { background: #f0f7ff; border-left: 3px solid #4a90e2; padding: 10px 12px; border-radius: 6px; font-size: 12px; color: #2c5282; line-height: 1.5; margin-top: 6px; }
  .field-label-wrap { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .info-tip { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #e0e4ec; color: #5a6378; font-size: 10px; font-weight: 700; cursor: help; }
  .info-tooltip { position: relative; display: inline-block; }
  .info-tooltip:hover .tooltip-content { visibility: visible; opacity: 1; }
  .tooltip-content { visibility: hidden; opacity: 0; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: 400; width: 240px; line-height: 1.5; transition: opacity 0.2s; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .tooltip-content::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -6px; border: 6px solid transparent; border-top-color: #1a1a2e; }
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
  .rate-card { background: #f0fff4; border: 1px solid #c3e6cb; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .rate-card-title { font-size: 12px; font-weight: 600; color: #1a7a3c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .rate-card-value { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
  .rate-breakdown-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #5a6378; }
  .rate-breakdown-row b { color: #1a1a2e; font-weight: 600; }
  .negotiable-note { background: #fff3cd; border-left: 3px solid #ffc107; padding: 10px 12px; border-radius: 6px; font-size: 12px; color: #856404; margin-top: 10px; }
  .success-card { background: #f0fff4; border: 1px solid #c3e6cb; padding: 32px; border-radius: 16px; text-align: center; }
  .success-icon { font-size: 48px; margin-bottom: 12px; }
  .success-title { font-size: 20px; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; }
  .success-sub { font-size: 14px; color: #5a6378; margin-bottom: 20px; }
  .pending-badge { display: inline-block; background: #fff3cd; color: #856404; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .error-box { background: #fde8e8; color: #c0392b; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  .profile-warning { background: #fff3cd; border: 1px solid #ffc107; padding: 14px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; color: #856404; }
  .profile-warning a { color: #1a1a2e; font-weight: 600; text-decoration: underline; cursor: pointer; }
`;

export default function ApplyLoan() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loanTypes, setLoanTypes] = useState({});
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    purpose: "",
    loan_amnt: "",
    term: 36,
    cibil_score: 720,
    annual_inc: "",
    monthly_debts: "",
    dti: 0,
    emp_length: 1,
    collateral_type: "none",
    collateral_value: "",
    collateral_description: "",
    gender: "",
    date_of_birth: ""
  });
  const [ratePreview, setRatePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitial = async () => {
      const token = localStorage.getItem("token");
      try {
        const [typesRes, profileRes] = await Promise.all([
          axios.get("http://127.0.0.1:8000/loan-types"),
          axios.get("http://127.0.0.1:8000/my-profile", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setLoanTypes(typesRes.data);
        setProfile(profileRes.data);
        if (profileRes.data.gender) setForm(f => ({...f, gender: profileRes.data.gender}));
        if (profileRes.data.date_of_birth) setForm(f => ({...f, date_of_birth: profileRes.data.date_of_birth}));
      } catch (e) { console.log("Init failed"); }
    };
    fetchInitial();
  }, []);

  const cfg = loanTypes[form.purpose];

  const selectLoan = (id) => {
    setForm({ ...form, purpose: id, loan_amnt: loanTypes[id]?.min || "" });
    setError("");
    setRatePreview(null);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const fetchRatePreview = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post("http://127.0.0.1:8000/calculate-rate", {
        purpose: form.purpose,
        cibil_score: parseInt(form.cibil_score),
        has_collateral: form.collateral_type && form.collateral_type !== "none"
      }, { headers: { Authorization: `Bearer ${token}` } });
      setRatePreview(data);
    } catch (e) { console.log("Rate preview failed"); }
  };

  const calcEMI = (rate) => {
    const p = parseFloat(form.loan_amnt) || 0;
    const r = (parseFloat(rate || ratePreview?.final_rate || 12)) / 100 / 12;
    const n = parseInt(form.term) || 1;
    if (r === 0) return p / n;
    return (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const next = async () => {
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
      if (cfg.collateral_required && (!form.collateral_type || form.collateral_type === "none")) {
        setError(`${form.purpose} loans require collateral. Please add details.`);
        return;
      }
    }
    if (step === 3) {
      if (!form.annual_inc) { setError("Please enter your annual income"); return; }
      if (form.monthly_debts === "" || form.monthly_debts === undefined) {
        setError("Enter your existing monthly debts (0 if none)"); return;
      }
      if (!form.cibil_score || form.cibil_score < 300 || form.cibil_score > 900) {
        setError("CIBIL score must be between 300 and 900"); return;
      }
      // Save profile if user provided gender/DOB
      if (form.gender || form.date_of_birth) {
        try {
          const token = localStorage.getItem("token");
          await axios.post("http://127.0.0.1:8000/update-profile",
            { gender: form.gender, date_of_birth: form.date_of_birth },
            { headers: { Authorization: `Bearer ${token}` } });
        } catch {}
      }
      // Fetch rate preview before going to review
      await fetchRatePreview();
    }
    setStep(step + 1);
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post("http://127.0.0.1:8000/apply-loan", {
        ...form,
        cibil_score: parseInt(form.cibil_score)
      }, {
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
              <div className="success-sub">{result.message}</div>
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

                {cfg.rate_type === "negotiable" && (
                  <div className="negotiable-note">
                    ⓘ Interest rate for {form.purpose} loans is finalized by the bank after reviewing your application and collateral.
                  </div>
                )}

                <div className="form-grid">
                  <div className="field full">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>Loan amount (₹)</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">Total money you want to borrow. You'll repay this with interest over time.</span>
                      </span>
                    </div>
                    <input type="number" name="loan_amnt" value={form.loan_amnt} onChange={handleChange}
                           min={cfg.min} max={cfg.max} />
                    <div className="field-hint">Between ₹{cfg.min.toLocaleString()} and ₹{cfg.max.toLocaleString()}</div>
                  </div>
                  <div className="field full">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>Tenure</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">How long you'll take to repay. Longer = lower EMI but more total interest paid.</span>
                      </span>
                    </div>
                    <select name="term" value={form.term} onChange={handleChange}>
                      {[12, 24, 36, 48, 60, 84, 120, 180, 240, 300, 360].filter(t => t <= cfg.max_tenure).map(t =>
                        <option key={t} value={t}>{t} months ({Math.round(t/12)} {Math.round(t/12) === 1 ? "year" : "years"})</option>
                      )}
                    </select>
                  </div>
                </div>

                {cfg.collateral_required && (
                  <>
                    <div style={{marginTop: 20, marginBottom: 12, fontSize: 14, fontWeight: 600}}>Collateral details</div>
                    <div className="field-help" style={{marginBottom: 12}}>
                      <b>This loan requires collateral.</b> The bank needs an asset as security. If you can't repay, the bank can sell this asset.
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Collateral type</label>
                        <select name="collateral_type" value={form.collateral_type} onChange={handleChange}>
                          <option value="none">Select...</option>
                          {form.purpose === "home" && <option value="property">🏘 Property (the home itself)</option>}
                          {form.purpose === "car" && <option value="vehicle">🚗 Vehicle (the car itself)</option>}
                          {form.purpose === "gold" && <option value="gold">🪙 Gold</option>}
                          {form.purpose === "business" && (
                            <>
                              <option value="property">🏘 Property</option>
                              <option value="gold">🪙 Gold</option>
                              <option value="fd">💰 Fixed Deposit</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div className="field">
                        <label>Collateral value (₹)</label>
                        <input type="number" name="collateral_value" value={form.collateral_value}
                               onChange={handleChange} placeholder="500000" />
                        <div className="field-hint">Market value of the asset</div>
                      </div>
                      <div className="field full">
                        <label>Description</label>
                        <textarea name="collateral_description" value={form.collateral_description}
                          onChange={handleChange} rows="2"
                          placeholder={COLLATERAL_TYPES[form.collateral_type]?.placeholder || "Describe the asset"} />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="title">About yourself</div>
                <div className="sub">We use this to calculate your eligibility and best rate</div>
                <div className="form-grid">
                  <div className="field">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>Gender</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">Women borrowers get a 0.05% interest concession on home and car loans.</span>
                      </span>
                    </div>
                    <select name="gender" value={form.gender} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>Date of birth</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">Senior citizens (60+) get a 0.25% concession on most loans.</span>
                      </span>
                    </div>
                    <input type="date" name="date_of_birth" value={form.date_of_birth}
                           onChange={handleChange} max={new Date().toISOString().split("T")[0]} />
                    {form.date_of_birth && (
                      <div className="field-hint">Age: {calculateAge(form.date_of_birth)} years</div>
                    )}
                  </div>

                  <div className="field">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>Annual income (₹)</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">Your total earnings in a year — salary, business, rental, everything before tax.</span>
                      </span>
                    </div>
                    <input type="number" name="annual_inc" value={form.annual_inc}
                           onChange={handleChange} placeholder="600000" />
                  </div>

                  <div className="field">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>Existing monthly debts (₹)</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">All EMIs you currently pay (other loans, credit cards). Don't include rent or utilities. Enter 0 if none.</span>
                      </span>
                    </div>
                    <input type="number" value={form.monthly_debts} onChange={(e) => {
                      const debts = parseFloat(e.target.value) || 0;
                      const annualInc = parseFloat(form.annual_inc) || 1;
                      const monthlyInc = annualInc / 12;
                      const dti = monthlyInc > 0 ? ((debts / monthlyInc) * 100).toFixed(1) : 0;
                      setForm({...form, monthly_debts: e.target.value, dti});
                    }} placeholder="5000" />
                    {form.dti > 0 && (
                      <div className="field-help">
                        Your DTI is <b>{form.dti}%</b> — {form.dti < 20 ? "excellent!" : form.dti < 36 ? "good" : form.dti < 43 ? "okay but higher risk" : "high — may affect approval"}
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <div className="field-label-wrap">
                      <label style={{margin: 0}}>CIBIL score</label>
                      <span className="info-tooltip">
                        <span className="info-tip">?</span>
                        <span className="tooltip-content">Your credit reputation (300-900). Check free on CIBIL.com, Paisabazaar, or your bank app.</span>
                      </span>
                    </div>
                    <input type="number" name="cibil_score" value={form.cibil_score}
                           onChange={handleChange} min="300" max="900" />
                    <div className="field-help">
                      {form.cibil_score >= 800 ? "Excellent — you'll get the best rates!" :
                       form.cibil_score >= 750 ? "Very Good — most loans approve easily" :
                       form.cibil_score >= 700 ? "Good — fair rates" :
                       form.cibil_score >= 650 ? "Fair — higher rates expected" :
                       "Below 650 — collateral may be required"}
                    </div>
                  </div>

                  <div className="field">
                    <label>Employment length (years)</label>
                    <input type="number" name="emp_length" value={form.emp_length}
                           onChange={handleChange} min="0" max="50" />
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="title">Review your application</div>
                <div className="sub">Here's your auto-calculated rate based on your profile</div>

                {ratePreview && (
                  <div className="rate-card">
                    <div className="rate-card-title">
                      {cfg?.rate_type === "negotiable" ? "Indicative interest rate" : "Your interest rate"}
                    </div>
                    <div className="rate-card-value">{ratePreview.final_rate}% p.a.</div>
                    <div style={{borderTop: "1px solid #c3e6cb", paddingTop: 12}}>
                      <div className="rate-breakdown-row">
                        <span>Base rate</span><b>{ratePreview.base_rate}%</b>
                      </div>
                      {ratePreview.adjustments?.map((adj, i) => (
                        <div className="rate-breakdown-row" key={i}>
                          <span>{adj.factor}</span>
                          <b style={{color: adj.value < 0 ? "#1a7a3c" : adj.value > 0 ? "#c0392b" : "#5a6378"}}>
                            {adj.value > 0 ? "+" : ""}{adj.value}%
                          </b>
                        </div>
                      ))}
                      <div className="rate-breakdown-row" style={{borderTop:"1px solid #c3e6cb", marginTop: 6, paddingTop: 8}}>
                        <span><b>Final rate</b></span><b style={{fontSize: 14}}>{ratePreview.final_rate}%</b>
                      </div>
                    </div>
                    {cfg?.rate_type === "negotiable" && (
                      <div className="negotiable-note" style={{marginTop: 12}}>
                        ⚠ This is an indicative rate. Final rate confirmed by bank after collateral assessment.
                      </div>
                    )}
                  </div>
                )}

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
                  <div className="review-label">CIBIL score</div>
                  <div className="review-value">{form.cibil_score}</div>
                </div>
                {form.collateral_type !== "none" && (
                  <div className="review-row">
                    <div className="review-label">Collateral</div>
                    <div className="review-value">{form.collateral_type} (₹{parseFloat(form.collateral_value || 0).toLocaleString()})</div>
                  </div>
                )}

                <div className="emi-box">
                  <div className="emi-label">Monthly EMI</div>
                  <div className="emi-value">₹{Math.round(calcEMI()).toLocaleString()}</div>
                  <div className="emi-sub">For {form.term} months at {ratePreview?.final_rate}% p.a.</div>
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