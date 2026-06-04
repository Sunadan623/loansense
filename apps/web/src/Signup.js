import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f7f8fc; }
  .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .auth-card { background: #fff; border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; border: 1px solid #eaedf3; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
  .auth-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .auth-logo-icon { width: 36px; height: 36px; background: #1a1a2e; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .auth-logo-icon svg { width: 18px; height: 18px; fill: none; stroke: #fff; stroke-width: 2; }
  .auth-logo-text { font-size: 18px; font-weight: 600; color: #1a1a2e; }
  .auth-title { font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
  .auth-sub { font-size: 13px; color: #8892a4; margin-bottom: 24px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 12px; font-weight: 500; color: #5a6378; margin-bottom: 6px; }
  .field input { width: 100%; padding: 11px 14px; border: 1px solid #e0e4ec; border-radius: 8px; font-size: 14px; font-family: inherit; transition: border 0.15s; }
  .field input:focus { outline: none; border-color: #1a1a2e; }
  .field-hint { font-size: 11px; color: #8892a4; margin-top: 4px; }
  .btn { width: 100%; padding: 12px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .btn:hover { background: #2d3561; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-error { background: #fde8e8; color: #c0392b; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: #8892a4; }
  .auth-footer a { color: #1a1a2e; font-weight: 600; text-decoration: none; }
  .auth-footer a:hover { text-decoration: underline; }
`;

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/signup`, { name, email, password });
      if (data.error) {
        setError(data.error);
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/portal");
      }
    } catch (err) {
      setError("Signup failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div className="auth-logo-text">LoanSense</div>
          </div>
          <div className="auth-title">Create your account</div>
          <div className="auth-sub">Start managing your loans with AI</div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSignup}>
            <div className="field">
              <label>Full name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Rahul Sharma" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              <div className="field-hint">At least 6 characters</div>
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </>
  );
}