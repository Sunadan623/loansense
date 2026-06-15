import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f7f8fc; color: #1a1a2e; }
  .wrap { min-height: 100vh; padding: 32px 20px; }
  .container { max-width: 860px; margin: 0 auto; }
  .back-btn { background: none; border: none; color: #5a6378; font-size: 13px; font-weight: 500; cursor: pointer; padding: 6px 0; margin-bottom: 20px; font-family: inherit; }
  .hero { background: linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%); border-radius: 20px; padding: 36px; color: #fff; margin-bottom: 24px; }
  .hero h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .hero p { font-size: 14px; opacity: 0.85; line-height: 1.5; }
  .search-box { margin-top: 18px; }
  .search-box input { width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 14px; font-family: inherit; }
  .category-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .category-tab { padding: 8px 16px; background: #fff; border: 1px solid #eaedf3; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; color: #5a6378; font-family: inherit; transition: all 0.15s; }
  .category-tab.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
  .category-tab:hover:not(.active) { border-color: #1a1a2e; }
  .faq-item { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; margin-bottom: 10px; overflow: hidden; transition: all 0.15s; }
  .faq-item:hover { border-color: #d0d5e0; }
  .faq-q { padding: 16px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 600; color: #1a1a2e; }
  .faq-q:hover { background: #fafbfc; }
  .faq-arrow { font-size: 12px; color: #8892a4; transition: transform 0.2s; }
  .faq-arrow.open { transform: rotate(180deg); }
  .faq-a { padding: 0 20px 18px; font-size: 13px; color: #5a6378; line-height: 1.7; border-top: 1px solid #f7f8fc; padding-top: 14px; }
  .empty { padding: 40px; text-align: center; color: #8892a4; font-size: 13px; background: #fff; border-radius: 12px; }
  .help-banner { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 20px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
  .help-text { font-size: 13px; color: #5a6378; }
  .help-text b { color: #1a1a2e; font-weight: 600; }
  .help-btn { background: #1a1a2e; color: #fff; border: none; padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .help-btn:hover { background: #2d3561; }
`;

const FAQS = [
  { cat: "Applying", q: "How long does loan approval take?",
    a: "Most loan applications are reviewed within 24-48 hours. Once you submit, your application enters our analyst queue. You'll get an email and an in-app notification as soon as a decision is made. Complex cases (large amounts, secured loans, business loans) may take 3-5 business days." },
  { cat: "Applying", q: "What documents will I need?",
    a: "For unsecured loans: PAN card, Aadhaar, last 3 months' salary slips or ITR. For secured loans (home/car/business): add property/vehicle papers, last 6 months' bank statements, and an asset valuation report. You can upload these during the application." },
  { cat: "Applying", q: "What's a CIBIL score and why does it matter?",
    a: "CIBIL is your credit reputation score (300-900). Higher = lower interest rate. Above 750 gets you the best rates with most banks. Below 650 means rates go up by 1-3% or the bank may ask for collateral. You can check your CIBIL for free on cibil.com or via apps like Paisabazaar." },
  { cat: "Applying", q: "Why was my interest rate higher than expected?",
    a: "Your rate is calculated automatically based on your CIBIL score, loan type, gender (women get a 0.05% concession on home/car loans), age (senior citizens get 0.25% off), and whether you offered collateral. You can see the full breakdown on the review step of your application." },

  { cat: "Payments", q: "What if I can't pay my full EMI this month?",
    a: "You have three options: (1) Pay a partial amount — minimum 30% of EMI, the shortfall is automatically spread across your remaining months. (2) Request a deferral of 1-6 months — the bank will review. (3) Make a normal full payment. Use the smart payment dialog inside your loan view." },
  { cat: "Payments", q: "Is there a late fee?",
    a: "Yes. If you miss your EMI past the due date, a late fee of ₹500 + 2% of the EMI per week applies (capped at 10% of your EMI). The fee is auto-calculated and shown in your payment dialog before you confirm." },
  { cat: "Payments", q: "What happens to my EMI if I pay partial?",
    a: "The unpaid amount (the shortfall) is added to a 'carry-over balance' and spread equally across your remaining EMIs. Your tenure stays the same, but each future EMI goes up by a small amount until the carry-over is cleared." },
  { cat: "Payments", q: "Can I prepay my loan early?",
    a: "Foreclosure / prepayment is on our roadmap. For now, you can over-pay through the partial payment dialog by entering an amount up to your full EMI — anything over the regular EMI reduces your carry-over balance." },

  { cat: "Deferrals", q: "How do I request a deferral?",
    a: "Go to your loan's detail page, click 'Request deferral', explain why you need it (job loss, medical emergency, etc.) and how many months. Analysts review deferrals within 24-48 hours. Approved deferrals push your remaining EMIs forward — no late fee applies during the deferral period." },
  { cat: "Deferrals", q: "Will a deferral hurt my credit score?",
    a: "An approved deferral itself is not reported as default to CIBIL. However, repeated deferrals or extended ones may be flagged. We recommend deferrals only for genuine emergencies." },

  { cat: "Affordability", q: "What is FOAIR and why does it matter?",
    a: "FOAIR (Fixed Obligation to Income Ratio) is the share of your monthly income that goes toward EMIs. RBI guidance: keep total FOAIR under 40% for safety, under 50% as an absolute ceiling. The Affordability Coach calculates your safe EMI based on this." },
  { cat: "Affordability", q: "How is my safe EMI calculated?",
    a: "We take your monthly income (annual ÷ 12), subtract your existing essential expenses and existing EMIs, then cap your new EMI at 40% of income (safe), 45% (caution), or 50% (max). Visit the Affordability Coach from your portal to see your zones." },

  { cat: "Security", q: "Is my data safe?",
    a: "Yes. All sensitive data is encrypted, passwords are hashed using bcrypt, and JWT tokens authenticate every API request. Payments are processed through Razorpay's secure gateway — LoanSense never stores card or bank credentials." },
  { cat: "Security", q: "How do I change my password?",
    a: "Password change isn't in the UI yet but it's on our roadmap. If you need to reset, please raise a support ticket." },
];

const CATEGORIES = ["All", "Applying", "Payments", "Deferrals", "Affordability", "Security"];

export default function FAQ() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState({});

  const filtered = FAQS.filter(f => {
    const matchCat = category === "All" || f.cat === category;
    const matchSearch = !search ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppShell title="Help & FAQ">
      <style>{styles}</style>
      <div className="wrap">
        <div className="container">

          <div className="hero">
            <h1>❓ Help Center</h1>
            <p>Quick answers to the most common questions. Can't find what you need? Use the chat or raise a ticket below.</p>
            <div className="search-box">
              <input type="text" placeholder="🔍 Search questions..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="category-tabs">
            {CATEGORIES.map(c => (
              <div key={c} className={`category-tab ${category === c ? "active" : ""}`}
                onClick={() => setCategory(c)}>{c}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty">No questions match your search. Try a different keyword or category.</div>
          ) : (
            filtered.map((f, i) => (
              <div key={i} className="faq-item">
                <div className="faq-q" onClick={() => setOpen({...open, [i]: !open[i]})}>
                  <span>{f.q}</span>
                  <span className={`faq-arrow ${open[i] ? "open" : ""}`}>▼</span>
                </div>
                {open[i] && <div className="faq-a">{f.a}</div>}
              </div>
            ))
          )}

          <div className="help-banner">
            <div className="help-text">
              <b>Still need help?</b> Raise a support ticket and a real human will get back to you within 24 hours.
            </div>
            <button className="help-btn" onClick={() => navigate("/support")}>Contact support</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}