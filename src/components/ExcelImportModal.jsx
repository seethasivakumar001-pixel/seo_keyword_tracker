import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { monthKeys, monthLabel } from "../data";

// Month name map for 1-12
const MONTH_MAP = {
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

function tryParseMonthKey(key) {
  if (!key) return null;
  const trimmed = String(key).trim();
  if (!trimmed) return null;

  // Ignore summary/comparison columns like "Change", "Variance", "Diff"
  if (/change|diff|variance|vs|trend|compare/i.test(trimmed)) {
    return null;
  }

  // 1. Direct YYYY-MM or YYYY/MM e.g. "2026-05", "2026/05"
  const isoMatch = trimmed.match(/^(\d{4})[-/](0?[1-9]|1[0-2])$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, "0")}`;
  }

  // 2. MM/YYYY or MM-YYYY e.g. "05/2026", "05-2026", "5/2026"
  const revMatch = trimmed.match(/^(0?[1-9]|1[0-2])[-/](\d{4})$/);
  if (revMatch) {
    return `${revMatch[2]}-${String(revMatch[1]).padStart(2, "0")}`;
  }

  // 3. Month word + optional year e.g. "May 26", "MAY 26", "May 2026", "Sept 26", "Sep-26", "June 2026", "Oct"
  const match = trimmed.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:[\s\-_'/]*(\d{2,4}))?/i
  );

  if (match) {
    const mName = match[1].toLowerCase();
    const mNum = MONTH_MAP[mName];
    if (!mNum) return null;

    let year = new Date().getFullYear();
    if (match[2]) {
      const yStr = match[2];
      if (yStr.length === 2) {
        const yNum = parseInt(yStr, 10);
        year = yNum <= 50 ? 2000 + yNum : 1900 + yNum;
      } else if (yStr.length === 4) {
        year = parseInt(yStr, 10);
      }
    }
    return `${year}-${String(mNum).padStart(2, "0")}`;
  }

  return null;
}

function parsePositionValue(val) {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str || str === "–" || str === "-" || str === "n/a" || str === "na" || str === "none") {
    return null;
  }
  if (str === ">100" || str === "100+" || str === "101" || str === "> 100" || str === "<100") {
    return 101;
  }
  const clean = str.replace(/[^0-9]/g, "");
  if (!clean) return null;
  const num = parseInt(clean, 10);
  if (isNaN(num) || num <= 0) return null;
  if (num >= 100) return 101;
  return num;
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

  if (!isOpen) return null;

  // 1. Download Sample Excel Template
  const handleDownloadSample = () => {
    const horizonMonths = monthKeys(6);
    const sampleData = [
      {
        "Keyword": "seo rank tracker tool",
        "Category": "Core Features",
        "Search Volume": 8400,
        "Difficulty (KD)": 42,
        "Current Position": 6,
        [monthLabel(horizonMonths[0])]: 18,
        [monthLabel(horizonMonths[1])]: 15,
        [monthLabel(horizonMonths[2])]: 12,
        [monthLabel(horizonMonths[3])]: 9,
        [monthLabel(horizonMonths[4])]: 8,
        [monthLabel(horizonMonths[5])]: 6,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/features` : "https://example.com/features",
      },
      {
        "Keyword": "google keyword position checker",
        "Category": "Core Features",
        "Search Volume": 12500,
        "Difficulty (KD)": 58,
        "Current Position": 14,
        [monthLabel(horizonMonths[0])]: 25,
        [monthLabel(horizonMonths[1])]: 22,
        [monthLabel(horizonMonths[2])]: 19,
        [monthLabel(horizonMonths[3])]: 17,
        [monthLabel(horizonMonths[4])]: 16,
        [monthLabel(horizonMonths[5])]: 14,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/checker` : "https://example.com/checker",
      },
      {
        "Keyword": "automated serp tracking software",
        "Category": "Automation",
        "Search Volume": 3600,
        "Difficulty (KD)": 35,
        "Current Position": 3,
        [monthLabel(horizonMonths[0])]: 8,
        [monthLabel(horizonMonths[1])]: 6,
        [monthLabel(horizonMonths[2])]: 5,
        [monthLabel(horizonMonths[3])]: 4,
        [monthLabel(horizonMonths[4])]: 3,
        [monthLabel(horizonMonths[5])]: 3,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/software` : "https://example.com/software",
      },
      {
        "Keyword": "competitor backlink analysis",
        "Category": "Competitors",
        "Search Volume": 6200,
        "Difficulty (KD)": 49,
        "Current Position": 19,
        [monthLabel(horizonMonths[0])]: 32,
        [monthLabel(horizonMonths[1])]: 28,
        [monthLabel(horizonMonths[2])]: 25,
        [monthLabel(horizonMonths[3])]: 23,
        [monthLabel(horizonMonths[4])]: 21,
        [monthLabel(horizonMonths[5])]: 19,
        "Target URL": activeProject?.domain ? `https://${activeProject.domain}/backlinks` : "https://example.com/backlinks",
      },
      {
        "Keyword": "daily keyword rank updates",
        "Category": "Rankings",
        "Search Volume": 1900,
        "Difficulty (KD)": 28,
        "Current Position": 8,
        [monthLabel(horizonMonths[0])]: 14,
        [monthLabel(horizonMonths[1])]: 12,
        [monthLabel(horizonMonths[2])]: 11,
        [monthLabel(horizonMonths[3])]: 10,
        [monthLabel(horizonMonths[4])]: 9,
        [monthLabel(horizonMonths[5])]: 8,
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
      { wch: 18 }, // Current Position
      ...horizonMonths.map(() => ({ wch: 11 })),
      { wch: 42 }, // Target URL
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Keywords");
    XLSX.writeFile(wb, "sample-seo-keywords-template.xlsx");
  };

  // Helper to normalize and map sheet column names
  const normalizeRow = (row, idx) => {
    let kw = "";
    let cat = availableCategories[0] || "General";
    let vol = 1200;
    let diff = 35;
    let pos = 20;
    let hasExplicitPos = false;
    let url = activeProject?.domain ? `https://${activeProject.domain}/` : "https://example.com/";
    const monthlyData = {};

    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase();
      const stringVal = val !== undefined && val !== null ? String(val).trim() : "";

      // Check if this column is a monthly comparison column (e.g. May 26, Jun 26, 2026-05, etc.)
      const monthKey = tryParseMonthKey(key);
      if (monthKey) {
        const parsedMVal = parsePositionValue(val);
        if (parsedMVal !== null) {
          monthlyData[monthKey] = parsedMVal;
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
        cleanKey === "current rank"
      ) {
        const parsedPos = parsePositionValue(stringVal);
        if (parsedPos !== null) {
          pos = parsedPos;
          hasExplicitPos = true;
        }
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

    const currentMonthKey = monthKeys(6).at(-1);

    // If no explicit position column was found, use the latest month's position
    if (!hasExplicitPos && Object.keys(monthlyData).length > 0) {
      if (monthlyData[currentMonthKey]) {
        pos = monthlyData[currentMonthKey];
      } else {
        const sortedMonthKeys = Object.keys(monthlyData).sort();
        pos = monthlyData[sortedMonthKeys[sortedMonthKeys.length - 1]];
      }
    } else if (hasExplicitPos && Object.keys(monthlyData).length === 0) {
      monthlyData[currentMonthKey] = pos;
    }

    return {
      tempId: `import-${Date.now()}-${idx}`,
      keyword: kw,
      group: cat,
      volume: vol,
      difficulty: diff,
      position: pos,
      url: url,
      monthly: monthlyData,
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

      // Check if first line has headers
      const firstLineDelim = lines[0].includes("\t") ? "\t" : ",";
      const firstLineParts = lines[0].split(firstLineDelim).map((p) => p.trim());
      const isHeaderRow = firstLineParts.some(
        (p) =>
          /keyword|query|term|group|category|volume|difficulty|position|rank/i.test(p) ||
          tryParseMonthKey(p) !== null
      );

      let parsed = [];
      const currentMonthKey = monthKeys(6).at(-1);

      if (isHeaderRow && lines.length > 1) {
        const headers = firstLineParts;
        const dataLines = lines.slice(1);

        parsed = dataLines
          .map((line, idx) => {
            const delim = line.includes("\t") ? "\t" : ",";
            const cells = line.split(delim).map((c) => c.trim());
            const rowObj = {};
            headers.forEach((h, hIdx) => {
              rowObj[h] = cells[hIdx] !== undefined ? cells[hIdx] : "";
            });
            return normalizeRow(rowObj, idx);
          })
          .filter(Boolean);
      } else {
        // Unstructured rows: Keyword, Group, Volume, KD, Current Position, URL...
        parsed = lines
          .map((line, idx) => {
            const delimiter = line.includes("\t") ? "\t" : ",";
            const parts = line.split(delimiter).map((p) => p.trim());

            const kw = parts[0] || "";
            const group = parts[1] || availableCategories[0] || "General";
            const vol = parseInt(parts[2]?.replace(/[^0-9]/g, ""), 10) || 1200;
            const diff = parseInt(parts[3]?.replace(/[^0-9]/g, ""), 10) || 35;
            const pos = parsePositionValue(parts[4]) || 20;
            const url = parts[5] || (activeProject?.domain ? `https://${activeProject.domain}/` : "/");

            const monthly = { [currentMonthKey]: pos };

            return {
              tempId: `paste-${Date.now()}-${idx}`,
              keyword: kw,
              group,
              volume: vol,
              difficulty: diff,
              position: pos,
              url,
              monthly,
            };
          })
          .filter((k) => k.keyword);
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
      const currentMonthKey = monthKeys(6).at(-1);

      const finalKeywords = parsedKeywords.map((pk, idx) => {
        const kwPos = pk.position || 25;
        const kwMonthly = pk.monthly && Object.keys(pk.monthly).length > 0
          ? { ...pk.monthly }
          : { [currentMonthKey]: kwPos };

        // Ensure current month has ranking
        if (!kwMonthly[currentMonthKey] && kwPos) {
          kwMonthly[currentMonthKey] = kwPos;
        }

        const history = Array(30).fill(kwPos);

        return {
          id: Date.now() + idx + Math.floor(Math.random() * 1000),
          projectId: activeProject.id,
          keyword: pk.keyword,
          group: pk.group || "General",
          url: pk.url || (activeProject.domain ? `https://${activeProject.domain}/` : "/"),
          volume: pk.volume || 1200,
          difficulty: pk.difficulty || 35,
          history,
          monthly: kwMonthly,
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
        style={{ maxWidth: 680 }}
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
              <span>Import Keywords via Excel / CSV</span>
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
            <b>Need a template?</b>
            <span>Download our pre-formatted sample Excel sheet with column headers.</span>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: File Upload */}
        {activeTab === "file" && (
          <div>
            {!parsedKeywords.length ? (
              <div
                className={`excel-dropzone ${dragOver ? "dragover" : ""}`}
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
                <div className="excel-drop-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "0.95rem" }}>
                  {dragOver ? "Drop your Excel sheet here" : "Click or drag & drop Excel sheet here"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--mute)", marginTop: 4 }}>
                  Supports <b>.xlsx, .xls, .csv</b> files with column headers
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Tab 2: Paste Rows */}
        {activeTab === "paste" && !parsedKeywords.length && (
          <div>
            <textarea
              rows={6}
              style={{ width: "100%", marginBottom: 10, fontFamily: "monospace", fontSize: "0.82rem" }}
              placeholder={`Keyword, Category, Search Volume, KD, Current Position, Target URL\nrank tracking software, Core Features, 8400, 42, 6, https://example.com/software\ncompetitor analysis tool, Competitors, 4500, 35, 12, https://example.com/competitors`}
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

            <div className="tablewrap" style={{ maxHeight: 240, overflowY: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 12px" }}>Keyword</th>
                    <th style={{ padding: "8px 12px" }}>Category</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Volume</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>KD</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Current Rank</th>
                    <th style={{ padding: "8px 12px" }}>Monthly Ranks</th>
                    <th style={{ padding: "8px 12px" }}>Target URL</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedKeywords.slice(0, 10).map((pk, idx) => (
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
                        {pk.monthly && Object.keys(pk.monthly).length > 0 ? (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {Object.entries(pk.monthly).map(([m, pVal]) => (
                              <span
                                key={m}
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "1px 5px",
                                  background: "rgba(99, 102, 241, 0.15)",
                                  color: "#a5b4fc",
                                  borderRadius: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {monthLabel(m)}: #{pVal}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.75rem" }}>
                            {monthLabel(monthKeys(6).at(-1))}: #{pk.position}
                          </span>
                        )}
                      </td>
                      <td className="muted" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "7px 12px" }}>
                        {pk.url}
                      </td>
                    </tr>
                  ))}
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
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
