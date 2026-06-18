import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Login from "./Login";
import Signup from "./Signup";
import Portal from "./Portal";
import ApplyLoan from "./ApplyLoan";
import LoanDetails from "./LoanDetails";
import AffordabilityCoach from "./AffordabilityCoach";
import FAQ from "./FAQ";
import Support from "./Support";
import UpcomingEMIs from "./UpcomingEMIs";
import Transactions from "./Transactions";
import EventAnalytics from "./EventAnalytics";
import Customers from "./Customers";
import CustomerDetail from "./CustomerDetail";
import Tickets from "./Tickets";
const isLoggedIn = () => !!localStorage.getItem("token");
const getRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}").role;
  } catch { return null; }
};

function ProtectedRoute({ children, requireRole }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (requireRole && getRole() !== requireRole) return <Navigate to="/portal" replace />;
  return children;
}

function PublicRoute({ children }) {
  if (isLoggedIn()) {
    return <Navigate to={getRole() === "analyst" ? "/dashboard" : "/portal"} replace />;
  }
  return children;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/portal" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
      <Route path="/apply" element={<ProtectedRoute><ApplyLoan /></ProtectedRoute>} />
      <Route path="/loan/:loanId" element={<ProtectedRoute><LoanDetails /></ProtectedRoute>} />
      <Route path="/affordability" element={<ProtectedRoute><AffordabilityCoach /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute requireRole="analyst"><App /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/portal" replace />} />
      <Route path="*" element={<Navigate to="/portal" replace />} />
      <Route path="/faq" element={<ProtectedRoute><FAQ /></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
      <Route path="/upcoming" element={<ProtectedRoute><UpcomingEMIs /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute requireRole="analyst"><EventAnalytics /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute requireRole="analyst"><Customers /></ProtectedRoute>} />
      <Route path="/customer/:customerId" element={<ProtectedRoute requireRole="analyst"><CustomerDetail /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute requireRole="analyst"><Tickets /></ProtectedRoute>} />
    </Routes>
  </BrowserRouter>
);