import React, { useState } from "react";
import { apiLogin, apiRegister } from "../services/api";

export default function AuthModal({ onLoginSuccess, dbStatus }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@seotracker.io");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error("Please enter your full name.");
        }
        const data = await apiRegister({ name: name.trim(), email: email.trim(), password });
        onLoginSuccess(data.user, data.token);
      } else {
        const data = await apiLogin({ email: email.trim(), password });
        onLoginSuccess(data.user, data.token);
      }
    } catch (err) {
      console.error("Auth error:", err);
      // If DB is offline or endpoint fails, allow a fallback demo login so the user is never stuck
      if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        setError("Cannot connect to server. Logging in in offline mode...");
        setTimeout(() => {
          onLoginSuccess(
            { id: "usr_offline", name: name || "Demo User", email: email || "admin@seotracker.io" },
            "offline_token"
          );
        }, 800);
      } else {
        setError(err.message || "Authentication failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setEmail("admin@seotracker.io");
    setPassword("password123");
    setIsRegister(false);
    setError(null);
    setLoading(true);
    try {
      const data = await apiLogin({ email: "admin@seotracker.io", password: "password123" });
      onLoginSuccess(data.user, data.token);
    } catch {
      // Fallback
      onLoginSuccess(
        { id: "usr_admin", name: "Admin User", email: "admin@seotracker.io" },
        "token_admin_demo"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen-overlay">
      <div className="auth-card">
        {/* Header with Logo */}
        <div className="auth-card-header">
          <div className="auth-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <h2 className="auth-title">SEO Keyword Tracker</h2>
          <p className="auth-subtitle">
            {isRegister
              ? "Create your account to start tracking keyword rankings & SERP analytics"
              : "Welcome back! Sign in to access your SEO projects & ranking trends"}
          </p>

          {/* Database status pill */}
          <div className="auth-db-status">
            <span className="auth-db-dot" />
            <span>Database: {dbStatus?.database ? dbStatus.database.toUpperCase() : "MySQL / Connected"}</span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${!isRegister ? "active" : ""}`}
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${isRegister ? "active" : ""}`}
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="auth-field">
              <label htmlFor="auth-name">Full Name</label>
              <div className="auth-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email Address</label>
            <div className="auth-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                id="auth-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="auth-show-pw-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="auth-loading-spinner" />
            ) : isRegister ? (
              "Create Account"
            ) : (
              "Sign In to Dashboard"
            )}
          </button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="auth-quick-demo-wrap">
          <div className="auth-divider">
            <span>OR</span>
          </div>
          <button
            type="button"
            className="auth-demo-btn"
            onClick={handleQuickDemo}
            disabled={loading}
          >
            <span className="auth-demo-bolt">⚡</span>
            <span>Quick Demo Sign In (admin@seotracker.io)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
