import { useState, useEffect } from "react";
import axios from "axios";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
);

const PURPOSE_COLORS = {
  personal: "#4a90e2",
  home: "#7048e8",
  car: "#e74c3c",
  education: "#f39c12",
  business: "#16a085",
  medical: "#e91e63",
  gold: "#daa520"
};

const PURPOSE_LABELS = {
  personal: "Personal", home: "Home", car: "Car",
  education: "Education", business: "Business", medical: "Medical", gold: "Gold"
};

export default function AnalystCharts() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get("http://127.0.0.1:8000/analyst/dashboard-stats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!data.error) setStats(data);
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{padding: 40, textAlign: "center", color: "#8892a4"}}>Loading charts...</div>;
  }
  if (!stats) return null;

  // Doughnut: by purpose
  const purposeData = {
    labels: stats.by_purpose.map(p => PURPOSE_LABELS[p.purpose] || p.purpose),
    datasets: [{
      data: stats.by_purpose.map(p => p.total_amount),
      backgroundColor: stats.by_purpose.map(p => PURPOSE_COLORS[p.purpose] || "#8892a4"),
      borderColor: "#fff",
      borderWidth: 2
    }]
  };
  const purposeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { padding: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = stats.by_purpose[ctx.dataIndex];
            return ` ${PURPOSE_LABELS[item.purpose]}: ${item.count} loans, ₹${(item.total_amount/100000).toFixed(1)}L`;
          }
        }
      }
    },
    cutout: "65%"
  };

  // Bar: risk distribution
  const riskData = {
    labels: ["Low Risk", "Medium Risk", "High Risk"],
    datasets: [{
      label: "Number of loans",
      data: [stats.risk_distribution.LOW, stats.risk_distribution.MEDIUM, stats.risk_distribution.HIGH],
      backgroundColor: ["#1a7a3c", "#daa520", "#c0392b"],
      borderRadius: 6
    }]
  };
  const riskOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: "#f0f2f7" } },
      x: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  };

  // Line: monthly disbursement
  const monthlyData = {
    labels: stats.monthly_disbursement.map(m => m.month),
    datasets: [{
      label: "Amount disbursed (₹ Lakhs)",
      data: stats.monthly_disbursement.map(m => (m.amount / 100000).toFixed(1)),
      borderColor: "#4a90e2",
      backgroundColor: "rgba(74, 144, 226, 0.15)",
      tension: 0.35,
      fill: true,
      pointBackgroundColor: "#4a90e2",
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  };
  const monthlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = stats.monthly_disbursement[ctx.dataIndex];
            return ` ${item.count} loans, ₹${(item.amount/100000).toFixed(1)} Lakhs`;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: "#f0f2f7" } },
      x: { ticks: { font: { size: 11 } }, grid: { display: false } }
    }
  };

  return (
    <div style={{marginBottom: 24}}>
      {/* Top stat cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12, marginBottom: 20
      }}>
        <StatPill label="Total Disbursed" value={`₹${(stats.totals.total_disbursed/100000).toFixed(1)}L`} color="#1a1a2e" />
        <StatPill label="EMIs Collected" value={`₹${(stats.totals.total_collected/1000).toFixed(1)}K`} color="#1a7a3c" />
        <StatPill label="Pending Applications" value={stats.totals.pending_applications} color="#daa520" />
        <StatPill label="Pending Deferrals" value={stats.totals.pending_deferrals} color="#e74c3c" />
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16
      }}>
        <ChartCard title="📊 Portfolio by Loan Type">
          {stats.by_purpose.length === 0 ? (
            <Empty msg="No active loans yet" />
          ) : (
            <div style={{height: 260}}>
              <Doughnut data={purposeData} options={purposeOptions} />
            </div>
          )}
        </ChartCard>

        <ChartCard title="⚠ Risk Distribution">
          <div style={{height: 260}}>
            <Bar data={riskData} options={riskOptions} />
          </div>
        </ChartCard>
      </div>

      <ChartCard title="📈 Disbursement Trend (Last 6 months)">
        <div style={{height: 240}}>
          <Line data={monthlyData} options={monthlyOptions} />
        </div>
      </ChartCard>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #eaedf3", borderRadius: 12,
      padding: "14px 16px"
    }}>
      <div style={{fontSize: 11, color: "#8892a4", textTransform: "uppercase",
                   letterSpacing: 0.5, fontWeight: 600, marginBottom: 6}}>{label}</div>
      <div style={{fontSize: 22, fontWeight: 700, color, fontFamily: "DM Mono, monospace"}}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #eaedf3", borderRadius: 14,
      padding: 18
    }}>
      <div style={{fontSize: 13, fontWeight: 600, color: "#1a1a2e",
                   marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f7f8fc"}}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }) {
  return <div style={{padding: "40px 20px", textAlign: "center", color: "#8892a4", fontSize: 13}}>{msg}</div>;
}