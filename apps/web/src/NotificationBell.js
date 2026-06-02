import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef();

  const fetchNotifs = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get("http://127.0.0.1:8000/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifs(data.notifications || []);
      setUnread(data.unread_count || 0);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleOpen = async () => {
    const newOpen = !open;
    setOpen(newOpen);
    if (newOpen && unread > 0) {
      try {
        const token = localStorage.getItem("token");
        await axios.post("http://127.0.0.1:8000/notifications/mark-read", {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnread(0);
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (e) { /* silent */ }
    }
  };

  const timeAgo = (iso) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const typeIcon = (type) => ({
    approval: "🎉", success: "💰", payment: "✓", warning: "⚠", info: "ℹ"
  }[type] || "ℹ");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={toggleOpen} style={{
        background: "none", border: "none", cursor: "pointer", fontSize: 20,
        position: "relative", padding: 8, display: "flex", alignItems: "center"
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2, background: "#e53e3e", color: "#fff",
            fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px"
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 44, right: 0, width: 340, maxHeight: 440,
          background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          border: "1px solid #eaedf3", zIndex: 1000, overflow: "hidden"
        }}>
          <div style={{
            padding: "14px 16px", borderBottom: "1px solid #f0f2f7",
            fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between"
          }}>
            <span>Notifications</span>
            <span style={{ color: "#8892a4", fontWeight: 400, fontSize: 12 }}>{notifs.length}</span>
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifs.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#8892a4", fontSize: 13 }}>
                No notifications yet
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id} onClick={() => { if (n.link) { navigate(n.link); setOpen(false); } }}
                style={{
                  padding: "12px 16px", borderBottom: "1px solid #f7f8fc",
                  cursor: n.link ? "pointer" : "default",
                  background: n.is_read ? "#fff" : "#f4f8ff",
                  display: "flex", gap: 10
                }}>
                <div style={{ fontSize: 18, flexShrink: 0 }}>{typeIcon(n.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "#5a6378", lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "#aab0bd", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4a90e2", flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}