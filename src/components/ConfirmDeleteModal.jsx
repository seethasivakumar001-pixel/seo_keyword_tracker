import { useEffect, useState, useRef } from "react";

export default function ConfirmDeleteModal({ modal, onClose }) {
  const [typedProjectName, setTypedProjectName] = useState("");
  const [categoryKeywordChoice, setCategoryKeywordChoice] = useState("cascade"); // "cascade" (b) | "uncategorize" (a)
  const [restoredCategoryName, setRestoredCategoryName] = useState(
    modal?.initialName ||
      (modal?.category
        ? `${modal.category.name} (restored)`
        : modal?.project
        ? `${modal.project.name} (restored)`
        : "")
  );
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [modal]);

  if (!modal) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card confirm-delete-card"
        style={{ maxWidth: modal.type === "deleteProject" ? 500 : 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background:
                  modal.type === "nameConflict" || modal.type?.startsWith("restore")
                    ? "rgba(99, 102, 241, 0.15)"
                    : "rgba(244, 63, 94, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  modal.type === "nameConflict" || modal.type?.startsWith("restore")
                    ? "var(--accent)"
                    : "var(--down)",
                flexShrink: 0,
              }}
            >
              {modal.type === "nameConflict" || modal.type?.startsWith("restore") ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              )}
            </div>
            <h2 className="modal-title" style={{ fontSize: "1.15rem" }}>
              {modal.title}
            </h2>
          </div>
          <button className="link" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Delete Category Confirmation */}
        {modal.type === "deleteCategory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Delete category <b>"{modal.category.name}"</b>?
              {modal.keywordCount > 0 ? (
                <span style={{ color: "var(--mute)", display: "block", marginTop: 4 }}>
                  This category currently contains <b>{modal.keywordCount}</b> {modal.keywordCount === 1 ? "keyword" : "keywords"}.
                </span>
              ) : (
                <span style={{ color: "var(--mute)", display: "block", marginTop: 4 }}>
                  This category contains no keywords.
                </span>
              )}
            </p>

            {modal.keywordCount > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "var(--panel-subtle)",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  What should happen to its keywords?
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: categoryKeywordChoice === "cascade" ? "rgba(99, 102, 241, 0.1)" : "transparent",
                    border: categoryKeywordChoice === "cascade" ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                    transition: "all 0.12s",
                  }}
                >
                  <input
                    type="radio"
                    name="catChoice"
                    value="cascade"
                    checked={categoryKeywordChoice === "cascade"}
                    onChange={() => setCategoryKeywordChoice("cascade")}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ink)" }}>
                      Delete keywords with the category
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--mute)" }}>
                      Move all {modal.keywordCount} keywords to Trash (they can be restored together later).
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: categoryKeywordChoice === "uncategorize" ? "rgba(99, 102, 241, 0.1)" : "transparent",
                    border: categoryKeywordChoice === "uncategorize" ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                    transition: "all 0.12s",
                  }}
                >
                  <input
                    type="radio"
                    name="catChoice"
                    value="uncategorize"
                    checked={categoryKeywordChoice === "uncategorize"}
                    onChange={() => setCategoryKeywordChoice("uncategorize")}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ink)" }}>
                      Move keywords to "Uncategorized"
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--mute)" }}>
                      Keep all {modal.keywordCount} keywords active and remove their category assignment.
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                style={{
                  background: "var(--down)",
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => {
                  modal.onConfirm({
                    moveKeywordsToUncategorized: categoryKeywordChoice === "uncategorize",
                  });
                }}
              >
                Delete Category
              </button>
            </div>
          </div>
        )}

        {/* Delete Project Confirmation */}
        {modal.type === "deleteProject" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: "var(--ink)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              Are you sure you want to delete project <b>"{modal.project.name}"</b>?
            </div>

            <div
              style={{
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.25)",
                padding: "12px 14px",
                borderRadius: 8,
                fontSize: "0.84rem",
                color: "#fca5a5",
                lineHeight: 1.4,
              }}
            >
              ⚠️ Warning: This project includes <b>{modal.categoryCount} {modal.categoryCount === 1 ? "category" : "categories"}</b> and <b>{modal.keywordCount} {modal.keywordCount === 1 ? "keyword" : "keywords"}</b>. All of them will be soft-deleted and moved to Trash.
            </div>

            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label" style={{ fontSize: "0.82rem" }}>
                Type the project name <b style={{ color: "var(--ink)" }}>{modal.project.name}</b> to confirm:
              </label>
              <input
                ref={inputRef}
                placeholder={`Type "${modal.project.name}"`}
                value={typedProjectName}
                onChange={(e) => setTypedProjectName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={typedProjectName.trim() !== modal.project.name.trim()}
                style={{
                  background:
                    typedProjectName.trim() === modal.project.name.trim()
                      ? "var(--down)"
                      : "rgba(244, 63, 94, 0.3)",
                  color: typedProjectName.trim() === modal.project.name.trim() ? "#fff" : "#94a3b8",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  border: "none",
                  cursor:
                    typedProjectName.trim() === modal.project.name.trim()
                      ? "pointer"
                      : "not-allowed",
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  if (typedProjectName.trim() === modal.project.name.trim()) {
                    modal.onConfirm();
                  }
                }}
              >
                Delete Project
              </button>
            </div>
          </div>
        )}

        {/* Delete Forever (Purge) Confirmation */}
        {modal.type === "deleteForever" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Are you sure you want to permanently delete {modal.itemDescription || "this item"}?
            </p>

            <div
              style={{
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: "0.84rem",
                color: "#fca5a5",
              }}
            >
              This action cannot be undone. {modal.cascadeWarning || "The item will be removed permanently from your database."}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                style={{
                  background: "var(--down)",
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => modal.onConfirm()}
              >
                Delete Forever
              </button>
            </div>
          </div>
        )}

        {/* Name Conflict on Project Restore */}
        {modal.type === "projectNameConflict" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              An active project named <b>"{modal.project.name}"</b> already exists.
            </p>
            <p className="muted" style={{ fontSize: "0.84rem", marginTop: -6 }}>
              Please enter a unique name to restore this project:
            </p>

            <div className="form-group">
              <label className="form-label">New Project Name *</label>
              <input
                ref={inputRef}
                value={restoredCategoryName}
                onChange={(e) => setRestoredCategoryName(e.target.value)}
                placeholder="Project Name"
                style={{ width: "100%" }}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!restoredCategoryName.trim()}
                onClick={() => {
                  if (restoredCategoryName.trim()) {
                    modal.onConfirm(restoredCategoryName.trim());
                  }
                }}
              >
                Restore with New Name
              </button>
            </div>
          </div>
        )}

        {/* Name Conflict on Category Restore */}
        {modal.type === "nameConflict" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              An active category named <b>"{modal.category.name}"</b> already exists in project <b>"{modal.projectName}"</b>.
            </p>
            <p className="muted" style={{ fontSize: "0.84rem", marginTop: -6 }}>
              Please enter a unique name to restore this category:
            </p>

            <div className="form-group">
              <label className="form-label">New Category Name *</label>
              <input
                ref={inputRef}
                value={restoredCategoryName}
                onChange={(e) => setRestoredCategoryName(e.target.value)}
                placeholder="Category Name"
                style={{ width: "100%" }}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!restoredCategoryName.trim()}
                onClick={() => {
                  if (restoredCategoryName.trim()) {
                    modal.onConfirm(restoredCategoryName.trim());
                  }
                }}
              >
                Restore with New Name
              </button>
            </div>
          </div>
        )}

        {/* Restore Keyword with Category in Trash */}
        {modal.type === "restoreKeywordPrompt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              The category <b>"{modal.categoryName}"</b> for keyword <b>"{modal.keyword.keyword}"</b> is currently in Trash.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="sidebar-nav-item"
                style={{
                  background: "var(--panel-subtle)",
                  border: "1px solid var(--line)",
                  padding: "12px 14px",
                  borderRadius: 8,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  alignItems: "flex-start",
                }}
                onClick={() => modal.onConfirm({ restoreCategory: true })}
              >
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                  Restore category "{modal.categoryName}" too
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--mute)" }}>
                  Restores both the category and this keyword.
                </div>
              </button>

              <button
                type="button"
                className="sidebar-nav-item"
                style={{
                  background: "var(--panel-subtle)",
                  border: "1px solid var(--line)",
                  padding: "12px 14px",
                  borderRadius: 8,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  alignItems: "flex-start",
                }}
                onClick={() => modal.onConfirm({ moveToUncategorized: true })}
              >
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                  Move keyword to "Uncategorized"
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--mute)" }}>
                  Restores only this keyword under the Uncategorized group.
                </div>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Restore Prompt when Parent Project is in Trash */}
        {modal.type === "restoreProjectPrompt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              The parent project <b>"{modal.projectName}"</b> is currently in Trash.
            </p>
            <p className="muted" style={{ fontSize: "0.84rem", marginTop: -8 }}>
              To restore {modal.itemDescription || "this item"}, the project must be restored as well.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => modal.onConfirm()}
              >
                Restore Project & {modal.itemType || "Item"}
              </button>
            </div>
          </div>
        )}

        {/* Empty Trash Confirmation */}
        {modal.type === "emptyTrash" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Are you sure you want to empty the trash ({modal.totalCount} items)?
            </p>
            <div
              style={{
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: "0.84rem",
                color: "#fca5a5",
              }}
            >
              All trashed projects, categories, and keywords will be permanently deleted. This action cannot be undone.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                style={{
                  background: "var(--down)",
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => modal.onConfirm()}
              >
                Empty Trash
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
