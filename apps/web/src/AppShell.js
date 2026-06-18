import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";

const shellStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  .shell-root { display: flex; min-height: 100vh; background: #f7f8fc; font-family: 'DM Sans', sans-serif; }
  .shell-sidebar {
    width: 232px; background: #1a1a2e; color: #fff; display: flex; flex-direction: column;
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; padding: 22px 0;
    transition: width 0.2s ease;
  }
  .shell-sidebar.collapsed { width: 64px; }
  .shell-logo { display: flex; align-items: center; gap: 10px; padding: 0 22px 24px; white-space: nowrap; overflow: hidden; }
  .shell-sidebar.collapsed .shell-logo { padding: 0 0 24px; justify-content: center; }
  .shell-logo-icon { width: 32px; height: 32px; background: #fff; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .shell-logo-icon svg { width: 18px; height: 18px; fill: none; stroke: #1a1a2e; stroke-width: 2; }
  .shell-logo-text { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .shell-sidebar.collapsed .shell-logo-text { display: none; }
  .shell-nav { flex: 1; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
  .shell-sidebar.collapsed .shell-nav { padding: 8px 8px; }
  .shell-nav-item {
    display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 9px;
    font-size: 14px; font-weight: 500; color: #a9b0c5; cursor: pointer; border: none; background: none;
    font-family: inherit; text-align: left; width: 100%; transition: all 0.15s; white-space: nowrap; overflow: hidden;
  }
  .shell-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
  .shell-nav-item.active { background: rgba(255,255,255,0.12); color: #fff; font-weight: 600; }
  .shell-nav-icon { font-size: 17px; width: 20px; text-align: center; flex-shrink: 0; }
  .shell-sidebar.collapsed .shell-nav-item { justify-content: center; padding: 11px; }
  .shell-sidebar.collapsed .shell-nav-label { display: none; }
  .shell-main { flex: 1; margin-left: 232px; display: flex; flex-direction: column; min-height: 100vh; transition: margin-left 0.2s ease; }
  .shell-main.collapsed { margin-left: 64px; }
  .shell-topbar {
    height: 64px; background: #fff; border-bottom: 1px solid #eaedf3; display: flex;
    align-items: center; justify-content: space-between; padding: 0 28px; position: sticky; top: 0; z-index: 50;
  }
  .shell-topbar-left { display: flex; align-items: center; gap: 14px; }
  .shell-toggle {
    background: none; border: none; cursor: pointer; font-size: 20px; color: #5a6378;
    width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .shell-toggle:hover { background: #f0f2f7; color: #1a1a2e; }
  .shell-topbar-title { font-size: 16px; font-weight: 600; color: #1a1a2e; }
  .shell-topbar-right { display: flex; align-items: center; gap: 14px; }
  .shell-avatar { width: 36px; height: 36px; border-radius: 50%; background: #1a1a2e; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; }
  .shell-user-meta { line-height: 1.2; }
  .shell-user-name { font-size: 13px; font-weight: 600; color: #1a1a2e; }
  .shell-user-role { font-size: 11px; color: #8892a4; text-transform: capitalize; }
  .shell-logout { background: none; border: 1px solid #e0e4ec; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; color: #5a6378; font-family: inherit; }
  .shell-logout:hover { background: #f9fafc; border-color: #d0d5e0; }
  .shell-content { flex: 1; padding: 28px; }
  @media (max-width: 880px) {
    .shell-sidebar { width: 64px; }
    .shell-logo-text, .shell-nav-label { display: none; }
    .shell-main { margin-left: 64px; }
    .shell-nav-item { justify-content: center; padding: 11px; }
    .shell-logo { padding: 0 0 24px; justify-content: center; }
    .shell-user-meta { display: none; }
  }
`;

const BORROWER_NAV = [
  { label: "Home", icon: "🏠", path: "/portal" },
  { label: "My Loans", icon: "💳", path: "/portal#loans" },
  { label: "Upcoming EMIs", icon: "📅", path: "/upcoming" },
  { label: "Transactions", icon: "📒", path: "/transactions" },
  { label: "Affordability", icon: "💡", path: "/affordability" },
  { label: "Support", icon: "🎫", path: "/support" },
  { label: "FAQ", icon: "❓", path: "/faq" },
];

const ANALYST_NAV = [
  { label: "Dashboard", icon: "📊", path: "/dashboard" },
  { label: "Customers", icon: "👥", path: "/customers" },
  { label: "Q&A / Tickets", icon: "📨", path: "/tickets" },
  { label: "Analytics", icon: "📈", path: "/analytics" },
];

export default function AppShell({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("shellCollapsed") === "true";
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("shellCollapsed", String(next));
      return next;
    });
  };

  let user = {};
  try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch {}
  const role = user.role || "borrower";
  const nav = role === "analyst" ? ANALYST_NAV : BORROWER_NAV;
  const initials = (user.name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (path) => {
    const base = path.split("#")[0];
    return location.pathname === base;
  };

  return (
    <>
      <style>{shellStyles}</style>
      <div className="shell-root">
        <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""}`}>
          <div className="shell-logo">
            <div className="shell-logo-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div className="shell-logo-text">LoanSense</div>
          </div>
          <nav className="shell-nav">
            {nav.map(item => (
              <button
                key={item.path}
                className={`shell-nav-item ${isActive(item.path) ? "active" : ""}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span className="shell-nav-icon">{item.icon}</span>
                <span className="shell-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className={`shell-main ${collapsed ? "collapsed" : ""}`}>
          <header className="shell-topbar">
            <div className="shell-topbar-left">
              <button className="shell-toggle" onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>☰</button>
              <div className="shell-topbar-title">{title || ""}</div>
            </div>
            <div className="shell-topbar-right">
              <NotificationBell />
              <div className="shell-avatar">{initials}</div>
              <div className="shell-user-meta">
                <div className="shell-user-name">{user.name || "User"}</div>
                <div className="shell-user-role">{role}</div>
              </div>
              <button className="shell-logout" onClick={handleLogout}>Sign out</button>
            </div>
          </header>
          <main className="shell-content">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
