"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { monthKeys, monthLabel, getDifficultyInfo, formatPosition } from "../data";

export default function Monthly({ rows, setRows }) {
  const months = monthKeys(6);
  const currentMonthKey = months.at(-1);
  const [from, setFrom] = useState(months[0]);
  const [to, setTo] = useState(months.at(-1));

  const pos = (r, m) => {
    if (r.monthly && r.monthly[m] !== undefined && r.monthly[m] !== null && r.monthly[m] !== "") {
      return Number(r.monthly[m]);
    }
    // Fallback: If it's the current active month, use the latest position from daily trend history
    if (m === currentMonthKey) {
      if (r.history && r.history.length > 0) {
        return Number(r.history[r.history.length - 1]);
      }
    }
    return undefined;
  };

  const diff = (r) => (pos(r, from) !== undefined && pos(r, to) !== undefined ? pos(r, from) - pos(r, to) : null); // + = improved

  const setPos = (id, m, v) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const monthly = { ...(r.monthly || {}) };
        const raw = String(v).trim();
        let newHistory = r.history ? [...r.history] : Array(30).fill(50);
        let parsedVal = undefined;

        if (raw === ">100" || raw === "100+" || raw === "101" || raw === "> 100" || raw === "<100") {
          parsedVal = 101;
          monthly[m] = 101;
        } else if (raw === "" || raw === "-" || raw === "–") {
          delete monthly[m];
        } else {
          const n = Number(raw.replace(/[^0-9]/g, ""));
          if (n >= 100) {
            parsedVal = 101;
            monthly[m] = 101;
          } else if (n >= 1) {
            parsedVal = n;
            monthly[m] = n;
          } else {
            delete monthly[m];
          }
        }

        if (m === currentMonthKey && parsedVal !== undefined) {
          newHistory[newHistory.length - 1] = parsedVal;
        }

        return { ...r, monthly, history: newHistory };
      })
    );

  const diffs = rows.map(diff).filter((d) => d !== null);
  const summary = [
    ["Improved", diffs.filter((d) => d > 0).length],
    ["Dropped", diffs.filter((d) => d < 0).length],
    ["Unchanged", diffs.filter((d) => d === 0).length],
  ];

  const head = [
    "Keyword",
    "Group",
    "Volume",
    "Difficulty",
    ...months.map(monthLabel),
    `Change (${monthLabel(from)} vs ${monthLabel(to)})`,
  ];

  const body = () =>
    rows.map((r) => {
      const kd = getDifficultyInfo(r.difficulty || 40);
      return [
        r.keyword,
        r.group,
        r.volume ? r.volume.toLocaleString("en-IN") : "–",
        `${kd.score}% (${kd.level})`,
        ...months.map((m) => {
          const p = pos(r, m);
          return p !== undefined && p !== null ? formatPosition(p) : "";
        }),
        diff(r) ?? "",
      ];
    });

  const toExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([head, ...body()]);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      ...months.map(() => ({ wch: 9 })),
      { wch: 26 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Keyword Analysis");
    XLSX.writeFile(wb, "keyword-seo-report.xlsx");
  };

  const toPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("SEO Keyword Monthly Ranking & Difficulty Report", 14, 15);
    doc.setFontSize(9);
    doc.text(
      `Comparison: ${monthLabel(from)} vs ${monthLabel(to)} | Total Keywords: ${rows.length} | Improved: ${summary[0][1]}, Dropped: ${summary[1][1]}, Unchanged: ${summary[2][1]}.`,
      14,
      21
    );
    autoTable(doc, {
      head: [head],
      body: body(),
      startY: 26,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [67, 56, 202] },
    });
    doc.save("keyword-seo-report.pdf");
  };

  const picker = (label, val, setVal) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
      <span className="muted">Compare</span> {label}
      <select value={val} onChange={(e) => setVal(e.target.value)}>
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section>
      <div className="cmp">
        {picker("from", from, setFrom)}
        {picker("to", to, setTo)}
        {summary.map(([l, v]) => (
          <span key={l} className="muted" style={{ marginLeft: 8 }}>
            <b style={{ color: "var(--ink)" }}>{v}</b> {l.toLowerCase()}
          </span>
        ))}
        <span className="actions">
          <button className="primary" onClick={toExcel}>
            Download Excel
          </button>{" "}
          <button className="primary" onClick={toPdf}>
            Download PDF
          </button>
        </span>
      </div>

      <div className="tablewrap">
        <table className="monthly">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Volume</th>
              <th>Difficulty (KD)</th>
              {months.map((m) => (
                <th key={m} className={m === from || m === to ? "hl" : ""}>
                  {monthLabel(m)}
                </th>
              ))}
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = diff(r);
              const kd = getDifficultyInfo(r.difficulty || 40);
              return (
                <tr key={r.id}>
                  <td>
                    <b>{r.keyword}</b>
                    <div className="muted">{r.group}</div>
                  </td>
                  <td className="vol-cell">
                    {r.volume ? r.volume.toLocaleString("en-IN") : "–"}
                  </td>
                  <td>
                    <span
                      className="kd-pill"
                      style={{
                        backgroundColor: kd.bg,
                        color: kd.text,
                        borderColor: kd.border,
                      }}
                    >
                      <span className="kd-dot" style={{ backgroundColor: kd.color }} />
                      {kd.score}% {kd.level}
                    </span>
                  </td>
                  {months.map((m) => {
                    const p = pos(r, m);
                    const displayVal =
                      p !== undefined && p !== null
                        ? p > 100
                          ? ">100"
                          : p >= 90 && p <= 100
                          ? "<100"
                          : String(p)
                        : "";
                    return (
                      <td key={m} className={m === from || m === to ? "hl" : ""}>
                        <input
                          className="cell"
                          type="text"
                          aria-label={`${r.keyword} position in ${monthLabel(m)}`}
                          value={displayVal}
                          onChange={(e) => setPos(r.id, m, e.target.value)}
                        />
                      </td>
                    );
                  })}
                  <td>
                    {d === null ? (
                      <span className="muted">–</span>
                    ) : d === 0 ? (
                      <span className="muted">No change</span>
                    ) : (
                      <span className={d > 0 ? "up" : "down"}>
                        {d > 0 ? "▲" : "▼"} {Math.abs(d)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty">No keywords yet. Add one in the Daily trend tab.</p>
        )}
      </div>
    </section>
  );
}
