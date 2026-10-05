import { useState, useMemo, useEffect } from "react";
import TrashTable from "./TrashTable";

export default function TrashPanel({
  isOpen,
  onClose,
  trashedProjects,
  trashedCategories,
  trashedKeywords,
  allProjects,
  allCategories,
  onRestoreProject,
  onRestoreCategory,
  onRestoreKeyword,
  onPurgeProject,
  onPurgeCategory,
  onPurgeKeyword,
  onBulkRestore,
  onBulkPurge,
  onEmptyTrash,
}) {
  const [activeTab, setActiveTab] = useState("keywords"); // "projects" | "categories" | "keywords"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  // Clear selections when switching tabs or closing
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, isOpen]);

  // Keyboard escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Set default tab to one that has items if current is empty
  useEffect(() => {
    if (isOpen) {
      if (activeTab === "keywords" && trashedKeywords.length === 0) {
        if (trashedCategories.length > 0) setActiveTab("categories");
        else if (trashedProjects.length > 0) setActiveTab("projects");
      }
    }
  }, [isOpen, trashedKeywords.length, trashedCategories.length, trashedProjects.length]);

  const totalTrashCount =
    trashedProjects.length + trashedCategories.length + trashedKeywords.length;

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return trashedProjects;
    const q = searchQuery.toLowerCase();
    return trashedProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.domain && p.domain.toLowerCase().includes(q))
    );
  }, [trashedProjects, searchQuery]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return trashedCategories;
    const q = searchQuery.toLowerCase();
    return trashedCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [trashedCategories, searchQuery]);

  const filteredKeywords = useMemo(() => {
    if (!searchQuery.trim()) return trashedKeywords;
    const q = searchQuery.toLowerCase();
    return trashedKeywords.filter(
      (k) =>
        k.keyword.toLowerCase().includes(q) ||
        (k.group && k.group.toLowerCase().includes(q)) ||
        (k.url && k.url.toLowerCase().includes(q))
    );
  }, [trashedKeywords, searchQuery]);

  const currentItems =
    activeTab === "projects"
      ? filteredProjects
      : activeTab === "categories"
      ? filteredCategories
      : filteredKeywords;

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (ids) => {
    setSelectedIds(ids);
  };

  const handleBulkRestoreClick = () => {
    if (!selectedIds.length) return;
    onBulkRestore(activeTab, selectedIds);
    setSelectedIds([]);
  };

  const handleBulkPurgeClick = () => {
    if (!selectedIds.length) return;
    onBulkPurge(activeTab, selectedIds);
    setSelectedIds([]);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay trash-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card trash-panel-card"
        style={{ maxWidth: 840, width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="modal-header" style={{ paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(244, 63, 94, 0.12)",
                color: "var(--down)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 className="modal-title" style={{ fontSize: "1.25rem" }}>
                  Trash
                </h2>
                {totalTrashCount > 0 && (
                  <span className="trash-badge" style={{ fontSize: "0.8rem", padding: "2px 8px" }}>
                    {totalTrashCount}
                  </span>
                )}
              </div>
              <p className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                Items are permanently deleted after 30 days
              </p>
            </div>
          </div>
          <button className="link" onClick={onClose} style={{ fontSize: "1.2rem" }} aria-label="Close Trash">
            ✕
          </button>
        </div>

        {/* Search & Action Bar */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
          <div className="toolbar-search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <svg
              className="search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search in trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="link"
                style={{ position: "absolute", right: 10, color: "var(--mute)", fontSize: "0.85rem" }}
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>

          {totalTrashCount > 0 && (
            <button
              type="button"
              className="btn-cancel"
              style={{
                color: "var(--down)",
                borderColor: "rgba(244, 63, 94, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
              onClick={onEmptyTrash}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              </svg>
              Empty Trash
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 10, marginTop: 4 }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => setActiveTab("projects")}
          >
            Projects
            <span
              style={{
                marginLeft: 6,
                fontSize: "0.72rem",
                background: activeTab === "projects" ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.06)",
                padding: "1px 6px",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {trashedProjects.length}
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "categories" ? "active" : ""}`}
            onClick={() => setActiveTab("categories")}
          >
            Categories
            <span
              style={{
                marginLeft: 6,
                fontSize: "0.72rem",
                background: activeTab === "categories" ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.06)",
                padding: "1px 6px",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {trashedCategories.length}
            </span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "keywords" ? "active" : ""}`}
            onClick={() => setActiveTab("keywords")}
          >
            Keywords
            <span
              style={{
                marginLeft: 6,
                fontSize: "0.72rem",
                background: activeTab === "keywords" ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.06)",
                padding: "1px 6px",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {trashedKeywords.length}
            </span>
          </button>
        </div>

        {/* Bulk Actions Header (when items selected) */}
        {selectedIds.length > 0 && (
          <div
            className="trash-bulk-bar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(99, 102, 241, 0.12)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: "0.85rem",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)", fontWeight: 600 }}>
              <span>{selectedIds.length} {selectedIds.length === 1 ? "item" : "items"} selected</span>
              <button
                type="button"
                className="link"
                style={{ fontSize: "0.78rem", color: "var(--mute)", textDecoration: "underline" }}
                onClick={() => setSelectedIds([])}
              >
                Deselect
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="trash-restore-btn"
                onClick={handleBulkRestoreClick}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Restore Selected ({selectedIds.length})
              </button>
              <button
                type="button"
                className="trash-delete-forever-btn"
                onClick={handleBulkPurgeClick}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                </svg>
                Delete Forever ({selectedIds.length})
              </button>
            </div>
          </div>
        )}

        {/* Tab Content Table */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {totalTrashCount === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--mute)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                Trash is empty
              </div>
              <p style={{ fontSize: "0.85rem" }}>
                Deleted projects, categories, and keywords will appear here.
              </p>
            </div>
          ) : (
            <TrashTable
              type={activeTab}
              items={currentItems}
              projects={allProjects}
              categories={allCategories}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onRestore={(item) => {
                if (activeTab === "projects") onRestoreProject(item);
                else if (activeTab === "categories") onRestoreCategory(item);
                else onRestoreKeyword(item);
              }}
              onDeleteForever={(item) => {
                if (activeTab === "projects") onPurgeProject(item);
                else if (activeTab === "categories") onPurgeCategory(item);
                else onPurgeKeyword(item);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--mute)" }}>
            Showing {currentItems.length} {activeTab}
          </div>
          <button type="button" className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
