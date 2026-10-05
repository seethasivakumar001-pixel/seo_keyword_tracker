import { useState, useRef, useEffect } from "react";
import { monthKeys, monthLabel, formatPosition } from "../data";

export default function AddKeywordView({
  onBack,
  onAdd,
  defaultDomain = "techsphere.io",
  availableCategories = ["Blog", "Guides", "Resources", "Core Product"],
}) {
  const months = monthKeys(6);
  const currentMonthKey = months.at(-1);

  const [form, setForm] = useState({
    keyword: "",
    url: "",
    position: "3",
    volume: "1400",
    difficulty: "35",
    group: availableCategories[0] || "",
    notRanking: false,
    hasPastRankings: false,
  });

  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const categoryWrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (categoryWrapperRef.current && !categoryWrapperRef.current.contains(e.target)) {
        setShowCategoryMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [pastMonthsData, setPastMonthsData] = useState(() => {
    return Object.fromEntries(months.map((m) => [m, ""]));
  });

  const handleMonthChange = (monthKey, val) => {
    setPastMonthsData((prev) => ({
      ...prev,
      [monthKey]: val,
    }));
  };

  const handleSubmit = (e, keepOpen = false) => {
    if (e) e.preventDefault();
    if (!form.keyword.trim()) return;

    const pos = form.notRanking ? 101 : Math.min(100, Math.max(1, parseInt(form.position, 10) || 50));
    const vol = Math.max(0, parseInt(form.volume, 10) || 1000);
    const diff = Math.min(100, Math.max(1, parseInt(form.difficulty, 10) || 35));

    // Construct 30-day history
    const history = Array(30).fill(pos);

    // Construct monthly data
    const monthly = {};
    months.forEach((m) => {
      if (m === currentMonthKey) {
        monthly[m] = pos;
      } else if (form.hasPastRankings && pastMonthsData[m]) {
        monthly[m] = Number(pastMonthsData[m]);
      }
    });

    const newKeyword = {
      id: Date.now(),
      keyword: form.keyword.trim(),
      group: form.group.trim() || availableCategories[0] || "General",
      url: form.url.trim() || `https://${defaultDomain}/`,
      volume: vol,
      difficulty: diff,
      history,
      monthly,
    };

    onAdd(newKeyword);

    if (keepOpen) {
      setForm((prev) => ({
        ...prev,
        keyword: "",
        url: "",
        position: "3",
        volume: "1400",
        notRanking: false,
      }));
      setPastMonthsData(Object.fromEntries(months.map((m) => [m, ""])));
    } else {
      onBack();
    }
  };

  return (
    <div className="add-keyword-page">
      <div className="add-keyword-topbar">
        <div>
          <button className="back-link" onClick={onBack}>
            ← Back to Keyword Intelligence
          </button>
          <h1 className="page-title">Add New Keyword</h1>
          <p className="page-subtitle">
            Track a target query and monitor its SERP rankings in real-time.
          </p>
        </div>

        <div className="domain-badge-card">
          <div className="domain-avatar">
            {defaultDomain.charAt(0).toUpperCase()}
          </div>
          <div className="domain-info">
            <span className="domain-name">{defaultDomain}</span>
            <span className="domain-target">Active Project</span>
          </div>
        </div>
      </div>

      <div className="config-card">
        <div className="config-header">
          <div>
            <h2 className="config-title">Keyword Configuration</h2>
            <p className="config-desc">
              Configure query parameters, target landing URL, category, and initial position.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="config-form">
          {/* Keyword Query */}
          <div className="form-group">
            <label className="form-label">
              Keyword Query <span className="req">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. distributed sql query engine"
              required
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            />
          </div>

          {/* Category / Group */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label">
                Category / Group <span className="req">*</span>
              </label>
              <span className="muted" style={{ fontSize: "0.76rem" }}>
                Select from {availableCategories.length} existing or type new
              </span>
            </div>

            <div ref={categoryWrapperRef} style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Select or type category (e.g. Blog, Guides, Resources)..."
                  required
                  value={form.group}
                  onFocus={() => setShowCategoryMenu(true)}
                  onChange={(e) => {
                    setForm({ ...form, group: e.target.value });
                    setShowCategoryMenu(true);
                  }}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowCategoryMenu((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 8,
                    background: "transparent",
                    border: "none",
                    color: "var(--mute)",
                    cursor: "pointer",
                    padding: "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Show all available categories"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{
                      transform: showCategoryMenu ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Dropdown Menu showing all available categories */}
              {showCategoryMenu && (
                <div
                  className="category-dropdown-popover"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "#111827",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    boxShadow: "0 14px 30px rgba(0, 0, 0, 0.7)",
                    zIndex: 50,
                    maxHeight: "220px",
                    overflowY: "auto",
                    padding: "6px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#64748b",
                      padding: "4px 8px 6px",
                      borderBottom: "1px solid #1e293b",
                      marginBottom: 4,
                    }}
                  >
                    All Available Categories ({availableCategories.length})
                  </div>
                  {availableCategories.length === 0 ? (
                    <div style={{ padding: "8px 10px", fontSize: "0.82rem", color: "var(--mute)" }}>
                      No categories found. Type any name above to create one.
                    </div>
                  ) : (
                    availableCategories.map((c) => {
                      const isSelected = form.group.toLowerCase().trim() === c.toLowerCase().trim();
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, group: c });
                            setShowCategoryMenu(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "8px 10px",
                            background: isSelected ? "rgba(99, 102, 241, 0.18)" : "transparent",
                            color: isSelected ? "#a5b4fc" : "var(--ink)",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "0.85rem",
                            fontWeight: isSelected ? 600 : 400,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: isSelected ? "var(--accent)" : "#64748b",
                              }}
                            />
                            {c}
                          </span>
                          {isSelected && <span style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700 }}>✓ Selected</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Quick-select chips */}
            {availableCategories.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: "0.75rem", marginRight: 2 }}>
                  Quick Select:
                </span>
                {availableCategories.map((c) => {
                  const isSelected = form.group.toLowerCase().trim() === c.toLowerCase().trim();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, group: c });
                        setShowCategoryMenu(false);
                      }}
                      style={{
                        background: isSelected ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.04)",
                        border: isSelected ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: isSelected ? "#c7d2fe" : "var(--mute)",
                        borderRadius: "14px",
                        padding: "3px 10px",
                        fontSize: "0.75rem",
                        fontWeight: isSelected ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target Landing Page URL (Optional) */}
          <div className="form-group">
            <label className="form-label">
              Target Landing Page URL <span className="muted" style={{ fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={`https://${defaultDomain}/`}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </div>

          {/* Position & Search Volume Grid */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                Current Position / Rank (1-100) <span className="req">*</span>
              </label>
              <div className="input-affix-wrapper">
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="form-input"
                  placeholder="e.g. 3"
                  disabled={form.notRanking}
                  value={form.notRanking ? "" : form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
                <span className="input-suffix">#Rank</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Monthly Search Volume <span className="req">*</span>
              </label>
              <div className="input-affix-wrapper">
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  placeholder="e.g. 1400"
                  required
                  value={form.volume}
                  onChange={(e) => setForm({ ...form, volume: e.target.value })}
                />
                <span className="input-suffix">vol/mo</span>
              </div>
            </div>
          </div>

          {/* Not ranking checkbox */}
          <div className="form-checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.notRanking}
                onChange={(e) => setForm({ ...form, notRanking: e.target.checked })}
              />
              <span>Not ranking yet (outside top 100)</span>
            </label>
          </div>

          {/* Monthly Position History Section */}
          <div className="monthly-history-box">
            <div className="monthly-history-header">
              <div className="monthly-history-title-wrap">
                <span className="monthly-icon">⏱</span>
                <span className="monthly-history-title">
                  Monthly Position History (6-Month Horizon)
                </span>
              </div>
              <label className="checkbox-label compact">
                <input
                  type="checkbox"
                  checked={form.hasPastRankings}
                  onChange={(e) => setForm({ ...form, hasPastRankings: e.target.checked })}
                />
                <span>I already have past rankings (backfill)</span>
              </label>
            </div>

            <p className="monthly-history-subtitle">
              Current month reflects today's rank. Previous months start empty for new keywords.
            </p>

            {/* Months Pills Grid */}
            <div className="months-horizon-grid">
              {months.map((m) => {
                const isCurrent = m === currentMonthKey;
                return (
                  <div key={m} className={`month-horizon-card ${isCurrent ? "current" : ""}`}>
                    <div className="month-horizon-label">
                      {monthLabel(m)}
                      {isCurrent && <span className="live-pill">Live</span>}
                    </div>
                    {isCurrent ? (
                      <div className="month-horizon-val current-val">
                        {form.notRanking ? ">100" : form.position ? formatPosition(form.position) : "–"}
                      </div>
                    ) : form.hasPastRankings ? (
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="–"
                        className="month-horizon-input"
                        value={pastMonthsData[m]}
                        onChange={(e) => handleMonthChange(m, e.target.value)}
                      />
                    ) : (
                      <div className="month-horizon-val empty-val">–</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="monthly-info-note">
              <span className="info-icon">ⓘ</span>
              <span>
                Previous months have no data yet because tracking starts today. You can import historical data anytime via CSV or Google Search Console.
              </span>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="form-actions-footer">
            <button type="button" className="btn-cancel" onClick={onBack}>
              Cancel
            </button>
            <div className="form-actions-right">
              <button
                type="button"
                className="btn-secondary-action"
                onClick={(e) => handleSubmit(e, true)}
              >
                <span>⊕</span> Add & Add Another
              </button>
              <button type="submit" className="btn-primary-action">
                Add Keyword
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
