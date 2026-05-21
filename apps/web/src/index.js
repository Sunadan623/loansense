import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Login from "./Login";
import Signup from "./Signup";
import Portal from "./Portal";

const isLoggedIn = () => !!localStorage.getItem("token");
const getRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}").role;
  } catch { return null; }
};

const ProtectedRoute = ({ children, requireRole }) => {
  if (!isLoggedIn()) return <Navigate to="/login" />;
  if (requireRole && getRole() !== requireRole) return <Navigate to="/portal" />;
  return children;
};

const PublicRoute = ({ children }) => {
  if (isLoggedIn()) {
    return <Navigate to={getRole() === "analyst" ? "/dashboard" : "/portal"} />;
  }
  return children;
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/portal" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute requireRole="analyst"><App /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  </BrowserRouter>
);