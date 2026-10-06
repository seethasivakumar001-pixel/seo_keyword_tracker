import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { monthKeys, monthLabel, formatPosition } from "../data";

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function matchMonthHeader(header, candidateMonthKeys = monthKeys(12)) {
  if (!header || typeof header !== "string") return null;
  const raw = header.trim().toLowerCase();

  // Exclude non-month keyword columns
  if (
    raw === "keyword" ||
    raw === "keyword name" ||
    raw === "query" ||
    raw === "term" ||
    raw === "category" ||
    raw === "group" ||
    raw === "url" ||
    raw === "target url" ||
    raw.includes("search volume") ||
    raw.includes("monthly searches") ||
    raw.includes("difficulty") ||
    raw.includes("kd") ||
    raw.includes("change") ||
    raw.includes("sparkline") ||
    raw.includes("history")
  ) {
    return null;
  }

  // 1. Direct formatted label check e.g. "may 26", "jun 26", "sept 26", "sep 26", "oct 26"
  for (const mKey of candidateMonthKeys) {
    const label = monthLabel(mKey).toLowerCase(); // e.g. "may 26"
    const normLabel = label.replace(/[\s\-_']/g, "");
    const normRaw = raw.replace(/[\s\-_']/g, "");
    if (normRaw === normLabel || normRaw.includes(normLabel)) {
      return mKey;
    }
  }

  // 2. ISO / numeric formats: "2026-05", "2026/05", "05-2026", "05/2026"
  const isoMatch = raw.match(/\b(\d{4})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}`;
    }
  }
  const revMatch = raw.match(/\b(\d{1,2})[-/](\d{4})\b/);
  if (revMatch) {
    const m = parseInt(revMatch[1], 10);
    const y = parseInt(revMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}`;
    }
  }

  // 3. Month names with 2-digit or 4-digit years: e.g. "May 2026", "June 2026", "Oct 26", "Sept 26"
  for (const [mName, mNum] of Object.entries(MONTH_NAMES)) {
    const regex = new RegExp(`\\b${mName}(?:ember|ober|ust|uary|arch|il|une|uly)?(?:['\\s_-]*(\\d{2,4}))?\\b`, "i");
    const match = raw.match(regex);
    if (match) {
      let year = match[1] ? parseInt(match[1], 10) : null;
      if (year !== null) {
        if (year < 100) year += 2000;
        return `${year}-${String(mNum).padStart(2, "0")}`;
      } else {
        // Find matching candidate key in active window
        const found = candidateMonthKeys.find((k) => {
          const [, m] = k.split("-");
          return parseInt(m, 10) === mNum;
        });
        if (found) return found;
        const curYear = new Date().getFullYear();
        return `${curYear}-${String(mNum).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

function parsePositionValue(val) {
  if (val === undefined || val === null) return null;
  const raw = String(val).trim();
  if (!raw || raw === "-" || raw === "–" || raw.toLowerCase() === "n/a" || raw.toLowerCase() === "na") return null;
  if (raw === ">100" || raw === "100+" || raw === "101" || raw === "> 100" || raw === "<100") {
    return 101;
  }
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) return null;
  if (n >= 100) return 101;
  if (n >= 1) return n;
  return null;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  activeProject,
  availableCategories,
  onImportSuccess,
}) {
  const [activeTab, setActiveTab] = useState("file"); // "file" | "paste"
  const [file, setFile] = useState(null);
  const [parsedKeywords, setParsedKeywords] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const horizonMonths = monthKeys(6);
  const availableMonths = monthKeys(12);
  const currentMonthKey = horizonMonths.at(-1);

  if (!isOpen) return null;

  // 1. Download Sample Excel Template with Monthly Comparison Columns
  const handleDownloadSample = () => {
    const m0 = monthLabel(horizonMonths[0]);
    const m1 = monthLabel(horizonMonths[1]);
    const m2 = monthLabel(horizonMonths[2]);
    const m3 = monthLabel(horizonMonths[3]);
    const m4 = monthLabel(horizonMonths[4]);
    const m5 = monthLabel(horizonMonths[5]);

    const sampleData = [
      {
        "Keyword": "seo rank tracker tool",
        "Category": "Core Features",
        "Search Volume": 8400,
        "Difficulty (KD)": 42,
        [m0]: 14,
        [m1]: 12,
        [m2]: 10,
        [m3]: 8,
        [m4]: 7,
        [m5]: 6,
        "Current Position": 6,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/features` : "https://example.com/features",
      },
      {
        "Keyword": "google keyword position checker",
        "Category": "Core Features",
        "Search Volume": 12500,
        "Difficulty (KD)": 58,
        [m0]: 24,
        [m1]: 22,
        [m2]: 19,
        [m3]: 18,
        [m4]: 15,
        [m5]: 14,
        "Current Position": 14,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/checker` : "https://example.com/checker",
      },
      {
        "Keyword": "automated serp tracking software",
        "Category": "Automation",
        "Search Volume": 3600,
        "Difficulty (KD)": 35,
        [m0]: 12,
        [m1]: 9,
        [m2]: 7,
        [m3]: 5,
        [m4]: 4,
        [m5]: 3,
        "Current Position": 3,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/software` : "https://example.com/software",
      },
      {
        "Keyword": "competitor backlink analysis",
        "Category": "Competitors",
        "Search Volume": 6200,
        "Difficulty (KD)": 49,
        [m0]: 35,
        [m1]: 30,
        [m2]: 28,
        [m3]: 24,
        [m4]: 21,
        [m5]: 19,
        "Current Position": 19,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/backlinks` : "https://example.com/backlinks",
      },
      {
        "Keyword": "daily keyword rank updates",
        "Category": "Rankings",
        "Search Volume": 1900,
        "Difficulty (KD)": 28,
        [m0]: 18,
        [m1]: 16,
        [m2]: 14,
        [m3]: 11,
        [m4]: 9,
        [m5]: 8,
        "Current Position": 8,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/daily-updates` : "https://example.com/daily-updates",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths
    ws["!cols"] = [
      { wch: 35 }, // Keyword
      { wch: 18 }, // Category
      { wch: 16 }, // Search Volume
      { wch: 18 }, // Difficulty (KD)
      { wch: 10 }, // m0
      { wch: 10 }, // m1
      { wch: 10 }, // m2
      { wch: 10 }, // m3
      { wch: 10 }, // m4
      { wch: 10 }, // m5
      { wch: 18 }, // Current Position
      { wch: 42 }, // Target URL
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Keywords");
    XLSX.writeFile(wb, "sample-seo-keywords-monthly-template.xlsx");
  };

  // Helper to normalize and map sheet column names
  const normalizeRow = (row, idx) => {
    let kw = "";
    let cat = availableCategories[0] || "General";
    let vol = 1200;
    let diff = 35;
    let explicitPos = null;
    let url = activeProject?.domain ? `https://${activeProject.domain}/` : "https://example.com/";
    const monthly = {};

    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase();
      const stringVal = val !== undefined && val !== null ? String(val).trim() : "";

      // Check for monthly ranking column first
      const monthKey = matchMonthHeader(key, availableMonths);
      if (monthKey) {
        const parsedMVal = parsePositionValue(stringVal);
        if (parsedMVal !== null) {
          monthly[monthKey] = parsedMVal;
        }
        continue;
      }

      if (
        cleanKey === "keyword" ||
        cleanKey === "keyword name" ||
        cleanKey === "query" ||
        cleanKey === "term" ||
        cleanKey === "kw" ||
        cleanKey === "name"
      ) {
        kw = stringVal;
      } else if (
        cleanKey === "category" ||
        cleanKey === "group" ||
        cleanKey === "group name" ||
        cleanKey === "cluster" ||
        cleanKey === "tag"
      ) {
        if (stringVal) cat = stringVal;
      } else if (
        cleanKey === "search volume" ||
        cleanKey === "volume" ||
        cleanKey === "monthly searches" ||
        cleanKey === "vol" ||
        cleanKey === "sv"
      ) {
        const parsedVol = parseInt(stringVal.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsedVol)) vol = parsedVol;
      } else if (
        cleanKey === "difficulty (kd)" ||
        cleanKey === "difficulty" ||
        cleanKey === "kd" ||
        cleanKey === "keyword difficulty" ||
        cleanKey === "diff"
      ) {
        const parsedDiff = parseInt(stringVal.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsedDiff)) diff = Math.min(100, Math.max(0, parsedDiff));
      } else if (
        cleanKey === "current position" ||
        cleanKey === "position" ||
        cleanKey === "rank" ||
        cleanKey === "pos" ||
        cleanKey === "current rank" ||
        cleanKey === "latest rank"
      ) {
        const parsedPos = parsePositionValue(stringVal);
        if (parsedPos !== null) explicitPos = parsedPos;
      } else if (
        cleanKey === "target url" ||
        cleanKey === "url" ||
        cleanKey === "landing page" ||
        cleanKey === "page" ||
        cleanKey === "link"
      ) {
        if (stringVal) url = stringVal;
      }
    }

    if (!kw) return null;

    // Determine current position
    let finalPos = 20;
    if (monthly[currentMonthKey]) {
      finalPos = monthly[currentMonthKey];
    } else if (explicitPos !== null) {
      finalPos = explicitPos;
      monthly[currentMonthKey] = explicitPos;
    } else {
      const sortedKeys = Object.keys(monthly).sort();
      if (sortedKeys.length > 0) {
        finalPos = monthly[sortedKeys[sortedKeys.length - 1]];
        monthly[currentMonthKey] = finalPos;
      } else {
        monthly[currentMonthKey] = finalPos;
      }
    }

    return {
      tempId: `import-${Date.now()}-${idx}`,
      keyword: kw,
      group: cat,
      volume: vol,
      difficulty: diff,
      position: finalPos,
      url: url,
      monthly: monthly,
    };
  };

  // 2. Parse Uploaded Excel File
  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!uploadedFile) return;

    setError(null);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawJson.length) {
          throw new Error("The uploaded sheet appears to be empty.");
        }

        const validKeywords = rawJson
          .map((row, idx) => normalizeRow(row, idx))
          .filter(Boolean);

        if (!validKeywords.length) {
          throw new Error(
            "No valid keywords found. Please ensure your sheet has a 'Keyword' column header."
          );
        }

        setParsedKeywords(validKeywords);
      } catch (err) {
        console.error("Excel parse error:", err);
        setError(err.message || "Failed to parse Excel file. Please verify file format.");
        setParsedKeywords([]);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  // 3. Parse Paste Text
  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    setError(null);

    try {
      const lines = pasteText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (!lines.length) {
        throw new Error("No keywords could be parsed from the provided text.");
      }

      // Check if first line is a header row
      const firstLine = lines[0].toLowerCase();
      const delimiter = lines[0].includes("\t") ? "\t" : ",";
      const isHeader =
        firstLine.includes("keyword") ||
        firstLine.includes("group") ||
        firstLine.includes("category") ||
        firstLine.includes("volume") ||
        firstLine.includes("rank") ||
        firstLine.includes("difficulty");

      let parsed = [];
      if (isHeader && lines.length > 1) {
        const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));
        const dataLines = lines.slice(1);
        parsed = dataLines.map((line, idx) => {
          const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));
          const rowObj = {};
          headers.forEach((h, hIdx) => {
            rowObj[h] = parts[hIdx] !== undefined ? parts[hIdx] : "";
          });
          return normalizeRow(rowObj, idx);
        }).filter(Boolean);
      } else {
        parsed = lines.map((line, idx) => {
          const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ""));
          const kw = parts[0] || "";
          const group = parts[1] || availableCategories[0] || "General";
          const vol = parseInt(parts[2], 10) || 1200;
          const diff = parseInt(parts[3], 10) || 35;
          const pos = parseInt(parts[4], 10) || 20;
          const url = parts[5] || (activeProject?.domain ? `https://${activeProject.domain}/` : "/");

          return {
            tempId: `paste-${Date.now()}-${idx}`,
            keyword: kw,
            group,
            volume: vol,
            difficulty: diff,
            position: pos,
            url,
            monthly: { [currentMonthKey]: pos },
          };
        }).filter((k) => k.keyword);
      }

      if (!parsed.length) {
        throw new Error("No keywords could be parsed from the provided text.");
      }

      setParsedKeywords(parsed);
    } catch (err) {
      setError(err.message || "Failed to parse text.");
    }
  };

  // 4. Final Import Action
  const handleConfirmImport = async () => {
    if (!parsedKeywords.length || !activeProject) return;

    setLoading(true);
    try {
      const finalKeywords = parsedKeywords.map((pk, idx) => {
        const monthlyObj = { ...(pk.monthly || {}) };
        if (Object.keys(monthlyObj).length === 0 && pk.position) {
          monthlyObj[currentMonthKey] = pk.position;
        } else if (!monthlyObj[currentMonthKey] && pk.position) {
          monthlyObj[currentMonthKey] = pk.position;
        }

        return {
          id: Date.now() + idx + Math.floor(Math.random() * 1000),
          projectId: activeProject.id,
          keyword: pk.keyword,
          group: pk.group || "General",
          url: pk.url || (activeProject.domain ? `https://${activeProject.domain}/` : "/"),
          volume: pk.volume || 1200,
          difficulty: pk.difficulty || 35,
          history: Array(30).fill(pk.position || 25),
          monthly: monthlyObj,
          deletedAt: null,
          deletedWith: null,
        };
      });

      await onImportSuccess(finalKeywords);
      onClose();
    } catch (err) {
      console.error("Import error:", err);
      setError(err.message || "An error occurred while importing keywords.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card excel-import-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Import Keywords & Monthly Comparison</span>
            </h2>
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: 2 }}>
              Target Project: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{activeProject?.name || "Active Workspace"}</span> ({activeProject?.domain || "–"})
            </p>
          </div>
          <button className="link" onClick={onClose} style={{ fontSize: "1.2rem" }}>
            ✕
          </button>
        </div>

        {/* Template Download Banner */}
        <div className="excel-sample-banner">
          <div className="excel-sample-text">
            <b>Need a template with monthly positions?</b>
            <span>Download our pre-formatted sample Excel sheet with 6-month ranking columns.</span>
          </div>
          <button
            type="button"
            className="excel-download-btn"
            onClick={handleDownloadSample}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Sample (.xlsx)</span>
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="excel-tabs">
          <button
            type="button"
            className={`excel-tab-btn ${activeTab === "file" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("file");
              setError(null);
            }}
          >
            📄 Upload Excel / CSV File
          </button>
          <button
            type="button"
            className={`excel-tab-btn ${activeTab === "paste" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("paste");
              setError(null);
            }}
          >
            📋 Paste Text / CSV Rows
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="auth-error-banner" style={{ marginBottom: 16 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Upload File */}
        {activeTab === "file" && !parsedKeywords.length && (
          <div>
            <div
              className={`excel-dropzone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileUpload(e);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <div className="excel-dropzone-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="excel-dropzone-title">
                Drag and drop your Excel or CSV file here
              </div>
              <div className="excel-dropzone-sub">
                or <span style={{ color: "var(--accent)", textDecoration: "underline" }}>browse from your computer</span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--mute)", marginTop: 6 }}>
                Supports keyword columns & monthly ranking columns (e.g. <b>May 26, Jun 26, Jul 26...</b>)
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Paste Rows */}
        {activeTab === "paste" && !parsedKeywords.length && (
          <div>
            <textarea
              rows={6}
              style={{ width: "100%", marginBottom: 10, fontFamily: "monospace", fontSize: "0.82rem" }}
              placeholder={`Keyword, Category, Search Volume, KD, Current Position, May 26, Jun 26, Jul 26, Aug 26, Sept 26, Oct 26\nrank tracking software, Core Features, 8400, 42, 6, 14, 12, 10, 8, 7, 6\ncompetitor analysis tool, Competitors, 4500, 35, 12, 22, 20, 18, 16, 14, 12`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              type="button"
              className="btn-header-outline"
              style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
              onClick={handleParsePaste}
            >
              Parse Pasted Keywords
            </button>
          </div>
        )}

        {/* Parsed Keywords Preview Table */}
        {parsedKeywords.length > 0 && (
          <div className="excel-preview-container">
            <div className="excel-preview-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="excel-count-badge">✓ {parsedKeywords.length} Keywords Ready</span>
                {file && <span className="muted" style={{ fontSize: "0.78rem" }}>File: {file.name}</span>}
              </div>
              <button
                type="button"
                className="link"
                style={{ fontSize: "0.78rem", color: "#fb7185" }}
                onClick={() => {
                  setParsedKeywords([]);
                  setFile(null);
                  setPasteText("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Clear & Re-upload
              </button>
            </div>

            <div className="excel-preview-scroll">
              <table style={{ width: "100%", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 12px", minWidth: 160 }}>Keyword</th>
                    <th style={{ padding: "8px 12px", minWidth: 110 }}>Category</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", minWidth: 80 }}>Volume</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", minWidth: 60 }}>KD</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", minWidth: 90 }}>Current Rank</th>
                    <th style={{ padding: "8px 12px", minWidth: 180 }}>Monthly Positions</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedKeywords.slice(0, 10).map((pk, idx) => {
                    const monthlyEntries = Object.entries(pk.monthly || {});
                    return (
                      <tr key={pk.tempId || idx}>
                        <td style={{ fontWeight: 600, color: "var(--ink)", padding: "7px 12px" }}>
                          {pk.keyword}
                        </td>
                        <td style={{ padding: "7px 12px" }}>
                          <span className="chip" style={{ fontSize: "0.72rem", padding: "2px 7px" }}>
                            {pk.group}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", padding: "7px 12px" }}>
                          {pk.volume ? pk.volume.toLocaleString() : "–"}
                        </td>
                        <td style={{ textAlign: "center", padding: "7px 12px" }}>
                          {pk.difficulty}%
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 700, padding: "7px 12px" }}>
                          #{pk.position}
                        </td>
                        <td style={{ padding: "7px 12px" }}>
                          {monthlyEntries.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {monthlyEntries.map(([mKey, mPos]) => (
                                <span
                                  key={mKey}
                                  style={{
                                    fontSize: "0.72rem",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(99, 102, 241, 0.15)",
                                    color: "#a5b4fc",
                                    border: "1px solid rgba(99, 102, 241, 0.25)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {monthLabel(mKey)}: <b>{formatPosition(mPos)}</b>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: "0.76rem" }}>
                              {monthLabel(currentMonthKey)}: #{pk.position}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {parsedKeywords.length > 10 && (
              <p className="muted" style={{ fontSize: "0.75rem", marginTop: 6, textAlign: "center" }}>
                ... and {parsedKeywords.length - 10} more keywords
              </p>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="excel-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!parsedKeywords.length || loading}
            onClick={handleConfirmImport}
          >
            {loading ? "Importing to Database..." : `Import ${parsedKeywords.length} Keywords`}
          </button>
        </div>
      </div>
    </div>
  );
}
