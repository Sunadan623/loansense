import { useState, useEffect } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from "chart.js";
import AppShell from "./AppShell";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const styles = `
  .mm-intro { font-size: 13px; color: #5a6378; margin-bottom: 22px; line-height: 1.5; max-width: 620px; }
  .mm-section-title { font-size: 15px; font-weight: 700; color: #1a1a2e; margin: 4px 0 14px; }
  .mm-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
  .mm-stat { background: #fff; border: 1px solid #eaedf3; border-radius: 12px; padding: 16px 18px; }
  .mm-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8892a4; font-weight: 600; }
  .mm-stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-top: 6px; font-family: 'DM Mono', monospace; }
  .mm-card { background: #fff; border: 1px solid #eaedf3; border-radius: 14px; padding: 20px 22px; margin-bottom: 16px; }
  .mm-card-title { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 14px; }
  .mm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .mm-info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f4f6fa; font-size: 13px; }
  .mm-info-row:last-child { border-bottom: none; }
  .mm-info-label { color: #5a6378; }
  .mm-info-val { font-weight: 600; color: #1a1a2e; font-family: 'DM Mono', monospace; }
  .mm-cm { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mm-cm-cell { padding: 14px; border-radius: 10px; text-align: center; }
  .mm-cm-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; opacity: 0.7; }
  .mm-cm-val { font-size: 22px; font-weight: 700; font-family: 'DM Mono', monospace; margin-top: 4px; }
  .mm-cm-tp { background: #e8f6ed; color: #1a7a3c; }
  .mm-cm-tn { background: #e7f3ff; color: #2c5282; }
  .mm-cm-fp { background: #fff3cd; color: #856404; }
  .mm-cm-fn { background: #fde8e8; color: #c0392b; }
  .mm-insight { background: #f4f2ff; border: 1px solid #e0d9ff; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #5a4a9c; line-height: 1.5; margin-top: 12px; }
  .mm-loading { color: #8892a4; padding: 40px; text-align: center; }
  @media (max-width: 880px) { .mm-grid { grid-template-columns: 1fr; } .mm-stats { grid-template-columns: repeat(2,1fr); } }
`;

const pct = (v) => (v * 100).toFixed(1) + "%";

export default function ModelMonitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const { data } = await axios.get(`${API}/analyst/model-monitoring`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(data);
      } catch (e) {
        console.error("Failed to load model monitoring", e);
        setData({ error: true });
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <AppShell title="Model Monitoring"><style>{styles}</style><div className="mm-loading">Loading model metrics…</div></AppShell>;
  if (!data || data.error) return <AppShell title="Model Monitoring"><style>{styles}</style><div className="mm-loading">Could not load model metrics.</div></AppShell>;

  const mi = data.model_info || {};
  const val = data.validation || {};
  const cm = val.confusion_matrix || {};
  const dist = data.prediction_distribution || [];
  const svb = data.score_vs_behavior || [];
  const live = data.live_stats || {};

  const distChart = {
    labels: dist.map(d => d.range),
    datasets: [{
      label: "Loans",
      data: dist.map(d => d.count),
      backgroundColor: ["#1a7a3c", "#7cb342", "#daa520", "#e67e22", "#c0392b"],
      borderRadius: 6,
    }]
  };

  const svbChart = {
    labels: svb.map(s => s.band),
    datasets: [{
      label: "Partial payment rate",
      data: svb.map(s => s.partial_rate * 100),
      backgroundColor: ["#1a7a3c", "#daa520", "#c0392b"],
      borderRadius: 6,
    }]
  };

  const barOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
  const pctOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } } } };

  // Is score-vs-behavior monotonic? (validates the model)
  const rates = svb.map(s => s.partial_rate);
  const monotonic = rates.length === 3 && rates[0] <= rates[1] && rates[1] <= rates[2];

  return (
    <AppShell title="Model Monitoring">
      <style>{styles}</style>
      <div className="mm-intro">
        Live health metrics for the default-prediction model. Validation performance is measured on a held-out test set; prediction distribution and behavioural validation use live portfolio data.
      </div>

      <div className="mm-section-title">🎯 Validation Performance (held-out test set)</div>
      <div className="mm-stats">
        <div className="mm-stat">
          <div className="mm-stat-label">AUC-ROC</div>
          <div className="mm-stat-value">{val.auc ?? "—"}</div>
        </div>
        <div className="mm-stat">
          <div className="mm-stat-label">Precision</div>
          <div className="mm-stat-value">{val.precision != null ? pct(val.precision) : "—"}</div>
        </div>
        <div className="mm-stat">
          <div className="mm-stat-label">Recall</div>
          <div className="mm-stat-value">{val.recall != null ? pct(val.recall) : "—"}</div>
        </div>
        <div className="mm-stat">
          <div className="mm-stat-label">Accuracy</div>
          <div className="mm-stat-value">{val.accuracy != null ? pct(val.accuracy) : "—"}</div>
        </div>
      </div>

      <div className="mm-grid">
        <div className="mm-card">
          <div className="mm-card-title">Confusion Matrix (test n={val.test_size?.toLocaleString?.() ?? "—"})</div>
          <div className="mm-cm">
            <div className="mm-cm-cell mm-cm-tp"><div className="mm-cm-label">True Positive</div><div className="mm-cm-val">{cm.tp ?? "—"}</div></div>
            <div className="mm-cm-cell mm-cm-fp"><div className="mm-cm-label">False Positive</div><div className="mm-cm-val">{cm.fp ?? "—"}</div></div>
            <div className="mm-cm-cell mm-cm-fn"><div className="mm-cm-label">False Negative</div><div className="mm-cm-val">{cm.fn ?? "—"}</div></div>
            <div className="mm-cm-cell mm-cm-tn"><div className="mm-cm-label">True Negative</div><div className="mm-cm-val">{cm.tn ?? "—"}</div></div>
          </div>
          <div className="mm-insight">
            F1 score {val.f1 ?? "—"}. The model is precision-oriented — when it flags a loan as high-risk it's usually right ({val.precision != null ? pct(val.precision) : "—"}), but it misses some defaulters (recall {val.recall != null ? pct(val.recall) : "—"}), a common trade-off in conservative credit models.
          </div>
        </div>

        <div className="mm-card">
          <div className="mm-card-title">Model Configuration</div>
          <div className="mm-info-row"><span className="mm-info-label">Architecture</span><span className="mm-info-val">Ensemble</span></div>
          <div className="mm-info-row"><span className="mm-info-label">XGBoost AUC</span><span className="mm-info-val">{mi.xgb_auc ?? "—"}</span></div>
          <div className="mm-info-row"><span className="mm-info-label">LSTM AUC</span><span className="mm-info-val">{mi.lstm_auc ?? "—"}</span></div>
          <div className="mm-info-row"><span className="mm-info-label">Ensemble AUC</span><span className="mm-info-val">{mi.ensemble_auc ?? "—"}</span></div>
          <div className="mm-info-row"><span className="mm-info-label">Ensemble weights</span><span className="mm-info-val">{mi.xgb_weight}·XGB / {mi.lstm_weight}·LSTM</span></div>
          <div className="mm-info-row"><span className="mm-info-label">Features</span><span className="mm-info-val">{mi.feature_count}</span></div>
          <div className="mm-info-row"><span className="mm-info-label">Test default rate</span><span className="mm-info-val">{val.default_rate_test != null ? pct(val.default_rate_test) : "—"}</span></div>
        </div>
      </div>

      <div className="mm-section-title">📊 Live Portfolio Predictions</div>
      <div className="mm-grid">
        <div className="mm-card">
          <div className="mm-card-title">Risk Score Distribution ({live.total_predictions} loans · mean {live.mean_risk != null ? pct(live.mean_risk) : "—"})</div>
          <div style={{ height: 240 }}><Bar data={distChart} options={barOpts} /></div>
        </div>
        <div className="mm-card">
          <div className="mm-card-title">Score vs. Actual Behaviour</div>
          <div style={{ height: 240 }}><Bar data={svbChart} options={pctOpts} /></div>
          <div className="mm-insight">
            {monotonic
              ? "✓ Model validated: partial-payment rate rises monotonically with predicted risk (LOW → MEDIUM → HIGH). Loans the model rates riskier do repay worse in production."
              : "Partial-payment rate by predicted risk band. More data will sharpen this signal."}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
