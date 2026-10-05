import { formatRelativeTime } from "../data";

export default function TrashTable({
  type, // "projects" | "categories" | "keywords"
  items,
  projects,
  categories,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRestore,
  onDeleteForever,
}) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const someSelected = items.some((item) => selectedIds.includes(item.id)) && !allSelected;

  const getParentLabel = (item) => {
    if (type === "projects") {
      return item.domain || "–";
    }
    if (type === "categories") {
      const proj = projects.find((p) => p.id === item.projectId);
      return proj ? proj.name : "–";
    }
    if (type === "keywords") {
      const proj = projects.find((p) => p.id === item.projectId);
      const projName = proj ? proj.name : "–";
      const catName = item.group || "Uncategorized";
      return `${projName} > ${catName}`;
    }
    return "–";
  };

  if (!items.length) {
    return (
      <div className="trash-empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "var(--mute)" }}>
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ margin: "0 auto 10px", opacity: 0.5 }}
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
        <p style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          No {type} in Trash
        </p>
        <p style={{ fontSize: "0.82rem" }}>
          Deleted {type} will show up here until permanently removed.
        </p>
      </div>
    );
  }

  return (
    <div className="tablewrap trash-tablewrap" style={{ maxHeight: 420, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ width: 38, padding: "10px 8px 10px 14px", textAlign: "center" }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked ? items.map((i) => i.id) : [])}
                aria-label={`Select all ${type}`}
                style={{ cursor: "pointer" }}
              />
            </th>
            <th style={{ textAlign: "left" }}>
              {type === "projects" ? "Project Name" : type === "categories" ? "Category Name" : "Keyword"}
            </th>
            <th style={{ textAlign: "left" }}>
              {type === "projects" ? "Website Domain" : "Original Location"}
            </th>
            <th style={{ textAlign: "left", width: 140 }}>Deleted Date</th>
            <th style={{ textAlign: "right", paddingRight: 16, width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <tr
                key={item.id}
                className={isSelected ? "trash-row-selected" : ""}
                style={{
                  background: isSelected ? "rgba(99, 102, 241, 0.08)" : "transparent",
                  transition: "background 0.12s ease",
                }}
              >
                <td style={{ textAlign: "center", padding: "10px 8px 10px 14px" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.id)}
                    aria-label={`Select ${item.name || item.keyword}`}
                    style={{ cursor: "pointer" }}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                    {type === "categories" && (
                      <span className="category-dot" style={{ background: "var(--accent)" }} />
                    )}
                    <span>{item.name || item.keyword}</span>
                  </div>
                  {type === "keywords" && item.url && (
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {item.url}
                    </div>
                  )}
                </td>
                <td className="muted" style={{ fontSize: "0.82rem" }}>
                  {getParentLabel(item)}
                </td>
                <td>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--mute)",
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {formatRelativeTime(item.deletedAt)}
                  </span>
                </td>
                <td style={{ textAlign: "right", paddingRight: 14 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      className="trash-restore-btn"
                      onClick={() => onRestore(item)}
                      title="Restore item"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      className="trash-delete-forever-btn"
                      onClick={() => onDeleteForever(item)}
                      title="Permanently delete item"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      <span>Delete Forever</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
