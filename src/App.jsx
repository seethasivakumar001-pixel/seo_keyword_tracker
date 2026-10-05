import { useEffect, useMemo, useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  initialKeywords,
  initialProjects,
  initialCategories,
  getDifficultyInfo,
  formatVolume,
  formatPosition,
  isExpired,
  monthKeys,
} from "./data";
import Monthly from "./components/Monthly";
import AddKeywordView from "./components/AddKeywordView";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import TrashPanel from "./components/TrashPanel";
import UndoToast from "./components/UndoToast";
import AuthModal from "./components/AuthModal";
import ExcelImportModal from "./components/ExcelImportModal";
import {
  checkServerHealth,
  fetchDatabaseData,
  syncDatabase,
  apiCreateProject,
  apiUpdateProject,
  apiDeleteProject,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  apiCreateKeyword,
  apiUpdateKeyword,
  apiDeleteKeyword,
  apiLogout,
  apiGetMe,
} from "./services/api";

const STORE = "seo-keywords-v3";
const DELETED_STORE = "seo-deleted-keywords-v3";
const PROJECTS_STORE = "seo-projects-v3";
const ACTIVE_PROJECT_STORE = "seo-active-project-v3";
const CATEGORIES_STORE = "seo-categories-v3";

const cur = (k) => (k.history && k.history.length > 0 ? k.history.at(-1) : 50);
const delta = (k) => (k.history && k.history.length > 7 ? k.history.at(-8) - cur(k) : 0);

function Spark({ data, up }) {
  if (!data || !data.length) return null;
  const w = 84,
    h = 24,
    min = Math.min(...data),
    span = Math.max(...data) - min || 1;
  const pts = data
    .map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${((v - min) / span) * (h - 4) + 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="1.6" stroke={up ? "var(--up)" : "var(--down)"} />
    </svg>
  );
}

function Change({ d }) {
  if (!d) return <span className="muted">–</span>;
  return <span className={d > 0 ? "up" : "down"}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}</span>;
}

function KdBadge({ score }) {
  const kd = getDifficultyInfo(score);
  return (
    <div className="kd-meter">
      <div
        className="kd-pill"
        style={{
          backgroundColor: kd.bg,
          color: kd.text,
          borderColor: kd.border,
        }}
      >
        <span className="kd-dot" style={{ backgroundColor: kd.color }} />
        <span>{kd.score}% {kd.level}</span>
      </div>
      <div className="kd-meter-bar">
        <div
          className="kd-meter-fill"
          style={{ width: `${kd.score}%`, backgroundColor: kd.color }}
        />
      </div>
    </div>
  );
}

function Detail({ row, onClose, onRemove }) {
  const n = row.history ? row.history.length : 30;
  const kd = getDifficultyInfo(row.difficulty || 40);
  const data = (row.history || Array(30).fill(50)).map((pos, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return { day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), pos };
  });

  return (
    <aside className="drawer" role="dialog" aria-label={`History for ${row.keyword}`}>
      <div className="drawer-header">
        <div>
          <h2>{row.keyword}</h2>
          <p className="muted">
            {row.url} · <span style={{ fontWeight: 600, color: "var(--accent)" }}>{row.group}</span>
          </p>
        </div>
        <button className="link" onClick={onClose} style={{ fontSize: "1.1rem" }}>
          ✕
        </button>
      </div>

      <div className="drawer-cards">
        <div className="drawer-card">
          <span className="label">Current Rank</span>
          <span className="value">{formatPosition(cur(row))}</span>
        </div>
        <div className="drawer-card">
          <span className="label">7-Day Change</span>
          <span className="value" style={{ fontSize: "1.15rem" }}>
            <Change d={delta(row)} />
          </span>
        </div>
        <div className="drawer-card">
          <span className="label">Monthly Search Volume</span>
          <span className="value">{row.volume ? row.volume.toLocaleString("en-IN") : "–"}</span>
        </div>
        <div className="drawer-card">
          <span className="label">Difficulty Level</span>
          <span className="value" style={{ color: kd.text, fontSize: "1.15rem" }}>
            {kd.level} ({kd.score}%)
          </span>
        </div>
      </div>

      <div className="kd-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>
            Keyword Difficulty (KD)
          </span>
          <span
            className="kd-pill"
            style={{
              backgroundColor: kd.bg,
              color: kd.text,
              borderColor: kd.border,
            }}
          >
            <span className="kd-dot" style={{ backgroundColor: kd.color }} />
            {kd.level} · {kd.score}/100
          </span>
        </div>
        <div className="kd-meter-bar" style={{ height: 8 }}>
          <div
            className="kd-meter-fill"
            style={{ width: `${kd.score}%`, backgroundColor: kd.color }}
          />
        </div>
        <p className="muted" style={{ fontSize: "0.82rem" }}>
          {kd.desc}
        </p>
      </div>

      <div>
        <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>
          30-Day Ranking Position Trend
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--mute)" }} minTickGap={24} stroke="var(--line)" />
              <YAxis reversed domain={[1, "dataMax + 5"]} tick={{ fontSize: 11, fill: "var(--mute)" }} stroke="var(--line)" />
              <Tooltip
                formatter={(v) => [`#${v}`, "Rank Position"]}
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  color: "var(--ink)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
                labelStyle={{ color: "var(--mute)", marginBottom: 4 }}
                itemStyle={{ color: "var(--ink)", fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="pos"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={{ r: 2, fill: "var(--accent)" }}
                activeDot={{ r: 6, fill: "var(--accent)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <button className="danger" style={{ width: "100%" }} onClick={onRemove}>
          Delete Keyword
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  // 0. Auth & Server State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem("seo-auth-user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("seo-auth-token") || null);
  const [dbStatus, setDbStatus] = useState({ connected: false, database: "mysql" });

  // 1. Projects State with Auto-Purge of >30 days expired items
  const [projects, setProjects] = useState(() => {
    try {
      const s = localStorage.getItem(PROJECTS_STORE);
      const parsed = s ? JSON.parse(s) : initialProjects;
      return parsed
        .map((p) => ({
          ...p,
          deletedAt: p.deletedAt || null,
          deletedWith: p.deletedWith || null,
        }))
        .filter((p) => !isExpired(p.deletedAt));
    } catch {
      return initialProjects;
    }
  });

  // 2. Active Project ID
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try {
      const s = localStorage.getItem(ACTIVE_PROJECT_STORE);
      return s || "p1";
    } catch {
      return "p1";
    }
  });

  // 3. Categories State
  const [categories, setCategories] = useState(() => {
    try {
      const s = localStorage.getItem(CATEGORIES_STORE);
      if (!s) return initialCategories;
      const parsed = JSON.parse(s);
      // Migrate legacy string array if any
      const normalized = parsed.map((item, idx) => {
        if (typeof item === "string") {
          return {
            id: `cat-migrated-${idx}-${item}`,
            name: item,
            projectId: "p1",
            deletedAt: null,
            deletedWith: null,
          };
        }
        return {
          ...item,
          deletedAt: item.deletedAt || null,
          deletedWith: item.deletedWith || null,
        };
      });
      return normalized.filter((c) => !isExpired(c.deletedAt));
    } catch {
      return initialCategories;
    }
  });

  // 4. Keywords State (Rows)
  const [rows, setRows] = useState(() => {
    try {
      const s = localStorage.getItem(STORE);
      const parsed = s ? JSON.parse(s) : initialKeywords;
      let allKeywords = parsed.map((k) => ({
        ...k,
        projectId: k.projectId || "p1",
        deletedAt: k.deletedAt || null,
        deletedWith: k.deletedWith || null,
      }));

      // Migrate legacy DELETED_STORE if present
      const delS = localStorage.getItem(DELETED_STORE);
      if (delS) {
        try {
          const oldDeleted = JSON.parse(delS);
          if (Array.isArray(oldDeleted) && oldDeleted.length > 0) {
            const migratedDeleted = oldDeleted.map((d) => ({
              ...d,
              projectId: d.projectId || "p1",
              deletedAt: d.deletedAt || new Date().toISOString(),
              deletedWith: d.deletedWith || null,
            }));
            allKeywords = [...migratedDeleted, ...allKeywords];
          }
          localStorage.removeItem(DELETED_STORE);
        } catch {}
      }

      return allKeywords.filter((k) => !isExpired(k.deletedAt));
    } catch {
      return initialKeywords;
    }
  });

  // UI state
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [openCategoryMenuId, setOpenCategoryMenuId] = useState(null);

  const [newProjectForm, setNewProjectForm] = useState({ name: "", domain: "" });
  const [projectError, setProjectError] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [confirmModal, setConfirmModal] = useState(null);
  const [showTrashPanel, setShowTrashPanel] = useState(false);
  const [undoToast, setUndoToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [view, setView] = useState("list"); // "list" | "add"
  const [tab, setTab] = useState("daily");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [kdFilter, setKdFilter] = useState("All");
  const [rankFilter, setRankFilter] = useState("All");
  const [sort, setSort] = useState({ key: "position", asc: true });
  const [openId, setOpenId] = useState(null);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [form, setForm] = useState({
    keyword: "",
    group: "",
    url: "",
    volume: "",
    difficulty: "",
    position: "",
  });

  const categoryMenuRef = useRef(null);

  // Close category 3-dot menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target)) {
        setOpenCategoryMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auth session check & Server health
  useEffect(() => {
    async function checkStatus() {
      const status = await checkServerHealth();
      setDbStatus(status);
      if (authToken) {
        const me = await apiGetMe(authToken);
        if (me) {
          setCurrentUser(me);
          localStorage.setItem("seo-auth-user", JSON.stringify(me));
        }
      }
    }
    checkStatus();
  }, [authToken]);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem("seo-auth-user", JSON.stringify(user));
    if (token) localStorage.setItem("seo-auth-token", token);
  };

  const handleSignOut = async () => {
    await apiLogout();
    setCurrentUser(null);
    setAuthToken(null);
    localStorage.removeItem("seo-auth-user");
    localStorage.removeItem("seo-auth-token");
    setShowTrashPanel(false);
    setOpenId(null);
    setShowQuickModal(false);
    setShowBulkModal(false);
    setShowAddProjectModal(false);
  };

  // Initial load from Database if server is available
  useEffect(() => {
    async function loadDb() {
      const dbData = await fetchDatabaseData();
      if (dbData && dbData.projects) {
        // Merge any local projects from localStorage that were created before DB connected
        const dbProjectIds = new Set(dbData.projects.map((p) => p.id));
        const missingLocalProjects = projects.filter((p) => !dbProjectIds.has(p.id));

        const mergedProjects = [...dbData.projects, ...missingLocalProjects];
        setProjects(mergedProjects);
        setCategories(dbData.categories && dbData.categories.length > 0 ? dbData.categories : categories);
        setRows(dbData.keywords && dbData.keywords.length > 0 ? dbData.keywords : rows);

        // If local had new projects or keywords not in DB, sync them to MySQL immediately
        if (missingLocalProjects.length > 0) {
          await syncDatabase({ projects: mergedProjects, categories, keywords: rows });
        }
      }
    }
    loadDb();
  }, []);

  // Save to localStorage & sync to DB
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STORE, JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORE, JSON.stringify(categories));
    } catch {}
  }, [categories]);

  useEffect(() => {
    try {
      if (activeProjectId) {
        localStorage.setItem(ACTIVE_PROJECT_STORE, activeProjectId);
      }
    } catch {}
  }, [activeProjectId]);

  // Selectors: Active Items
  const activeProjects = useMemo(() => {
    return projects.filter((p) => !p.deletedAt);
  }, [projects]);

  // Ensure activeProjectId points to a valid active project if any exist
  useEffect(() => {
    if (activeProjects.length > 0) {
      const exists = activeProjects.some((p) => p.id === activeProjectId);
      if (!exists) {
        setActiveProjectId(activeProjects[0].id);
      }
    }
  }, [activeProjects, activeProjectId]);

  const activeProject = useMemo(() => {
    return (
      activeProjects.find((p) => p.id === activeProjectId) ||
      activeProjects[0] ||
      null
    );
  }, [activeProjects, activeProjectId]);

  const activeCategories = useMemo(() => {
    if (!activeProject) return [];
    return categories.filter(
      (c) => c.projectId === activeProject.id && !c.deletedAt
    );
  }, [categories, activeProject]);

  const activeKeywords = useMemo(() => {
    if (!activeProject) return [];
    return rows.filter(
      (r) => r.projectId === activeProject.id && !r.deletedAt
    );
  }, [rows, activeProject]);

  // Trashed items selectors
  const trashedProjects = useMemo(() => {
    return projects.filter((p) => !!p.deletedAt);
  }, [projects]);

  const trashedCategories = useMemo(() => {
    return categories.filter((c) => !!c.deletedAt);
  }, [categories]);

  const trashedKeywords = useMemo(() => {
    return rows.filter((r) => !!r.deletedAt);
  }, [rows]);

  const totalTrashCount =
    trashedProjects.length + trashedCategories.length + trashedKeywords.length;

  const availableCategoryNames = useMemo(() => {
    const list = activeCategories.map((c) => c.name);
    activeKeywords.forEach((k) => {
      if (k.group && !list.includes(k.group)) {
        list.push(k.group);
      }
    });
    return list;
  }, [activeCategories, activeKeywords]);

  // Filtered & Sorted Keywords
  const filtered = useMemo(() => {
    return activeKeywords.filter((r) => {
      const mG = group === "All" || r.group === group;
      const mQ =
        !q ||
        r.keyword.toLowerCase().includes(q.toLowerCase()) ||
        (r.url && r.url.toLowerCase().includes(q.toLowerCase()));

      const kd = getDifficultyInfo(r.difficulty || 40);
      const mKD =
        kdFilter === "All" ||
        (kdFilter === "Easy" && kd.score <= 29) ||
        (kdFilter === "Medium" && kd.score >= 30 && kd.score <= 49) ||
        (kdFilter === "Hard" && kd.score >= 50 && kd.score <= 69) ||
        (kdFilter === "Very Hard" && kd.score >= 70);

      const p = cur(r);
      const mRank =
        rankFilter === "All" ||
        (rankFilter === "Top 10" && p >= 1 && p <= 10) ||
        (rankFilter === "Top 20" && p >= 11 && p <= 20) ||
        (rankFilter === "Top 30" && p >= 21 && p <= 30) ||
        (rankFilter === "Top 40" && p >= 31 && p <= 40) ||
        (rankFilter === "Top 50" && p >= 41 && p <= 50);

      return mG && mQ && mKD && mRank;
    });
  }, [activeKeywords, group, q, kdFilter, rankFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let av, bv;
      if (sort.key === "keyword") {
        av = a.keyword.toLowerCase();
        bv = b.keyword.toLowerCase();
      } else if (sort.key === "position") {
        av = cur(a);
        bv = cur(b);
      } else if (sort.key === "change") {
        av = delta(a);
        bv = delta(b);
      } else if (sort.key === "volume") {
        av = a.volume || 0;
        bv = b.volume || 0;
      } else if (sort.key === "difficulty") {
        av = a.difficulty || 0;
        bv = b.difficulty || 0;
      }
      if (av < bv) return sort.asc ? -1 : 1;
      if (av > bv) return sort.asc ? 1 : -1;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  // Metrics for active project keywords
  const top3 = activeKeywords.filter((r) => cur(r) <= 3).length;
  const top10 = activeKeywords.filter((r) => cur(r) <= 10).length;
  const totalVolume = activeKeywords.reduce((sum, r) => sum + (Number(r.volume) || 0), 0);
  const avgDifficulty = activeKeywords.length
    ? Math.round(activeKeywords.reduce((sum, r) => sum + (Number(r.difficulty) || 40), 0) / activeKeywords.length)
    : 0;
  const avgKdInfo = getDifficultyInfo(avgDifficulty);

  // -------------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------------

  // Soft Delete Keyword
  const handleSoftDeleteKeyword = (id) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const now = new Date().toISOString();

    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, deletedAt: now, deletedWith: null } : r))
    );

    if (openId === id) setOpenId(null);

    setUndoToast({
      id: `toast-kw-${id}`,
      type: "delete",
      message: (
        <span>
          Keyword <b>"{target.keyword}"</b> deleted.
        </span>
      ),
      undoAction: () => {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, deletedAt: null, deletedWith: null } : r))
        );
      },
    });
  };

  // Trigger Category Delete Confirmation
  const handlePromptDeleteCategory = (category) => {
    setOpenCategoryMenuId(null);
    const catKeywords = activeKeywords.filter((k) => k.group === category.name);

    setConfirmModal({
      type: "deleteCategory",
      title: `Delete Category`,
      category,
      keywordCount: catKeywords.length,
      onConfirm: ({ moveKeywordsToUncategorized }) => {
        const now = new Date().toISOString();
        const prevKeywordsState = [...rows];
        const prevCategoriesState = [...categories];

        if (moveKeywordsToUncategorized) {
          // Move keywords to "Uncategorized" and keep them active
          setRows((prev) =>
            prev.map((k) =>
              k.projectId === category.projectId && k.group === category.name && !k.deletedAt
                ? { ...k, group: "Uncategorized" }
                : k
            )
          );
          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id ? { ...c, deletedAt: now, deletedWith: null } : c
            )
          );
        } else {
          // Cascade delete keywords with deletedWith = category.id
          setCategories((prev) =>
            prev.map((c) =>
              c.id === category.id ? { ...c, deletedAt: now, deletedWith: null } : c
            )
          );
          setRows((prev) =>
            prev.map((k) =>
              k.projectId === category.projectId && k.group === category.name && !k.deletedAt
                ? { ...k, deletedAt: now, deletedWith: category.id }
                : k
            )
          );
        }

        if (group === category.name) {
          setGroup("All");
        }

        setConfirmModal(null);

        setUndoToast({
          id: `toast-cat-${category.id}`,
          type: "delete",
          message: (
            <span>
              Category <b>"{category.name}"</b> deleted.
            </span>
          ),
          undoAction: () => {
            setCategories(prevCategoriesState);
            setRows(prevKeywordsState);
          },
        });
      },
    });
  };

  // Trigger Project Delete Confirmation
  const handlePromptDeleteProject = (project) => {
    setShowProjectDropdown(false);
    if (activeProjects.length <= 1) return;

    const projCategories = categories.filter(
      (c) => c.projectId === project.id && !c.deletedAt
    );
    const projKeywords = rows.filter(
      (k) => k.projectId === project.id && !k.deletedAt
    );

    setConfirmModal({
      type: "deleteProject",
      title: "Delete Project",
      project,
      categoryCount: projCategories.length,
      keywordCount: projKeywords.length,
      onConfirm: () => {
        const now = new Date().toISOString();
        const prevProjects = [...projects];
        const prevCategories = [...categories];
        const prevKeywords = [...rows];
        const prevActiveId = activeProjectId;

        // Soft delete project
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, deletedAt: now, deletedWith: null } : p
          )
        );

        // Cascade to active categories in this project
        setCategories((prev) =>
          prev.map((c) =>
            c.projectId === project.id && !c.deletedAt
              ? { ...c, deletedAt: now, deletedWith: project.id }
              : c
          )
        );

        // Cascade to active keywords in this project
        setRows((prev) =>
          prev.map((k) =>
            k.projectId === project.id && !k.deletedAt
              ? { ...k, deletedAt: now, deletedWith: project.id }
              : k
          )
        );

        // Switch to next available project
        const remaining = activeProjects.filter((p) => p.id !== project.id);
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
        }

        setConfirmModal(null);

        setUndoToast({
          id: `toast-proj-${project.id}`,
          type: "delete",
          message: (
            <span>
              Project <b>"{project.name}"</b> deleted.
            </span>
          ),
          undoAction: () => {
            setProjects(prevProjects);
            setCategories(prevCategories);
            setRows(prevKeywords);
            setActiveProjectId(prevActiveId);
          },
        });
      },
    });
  };

  // Restore Project
  const handleRestoreProject = (project, forcedNewName = null) => {
    const activeProjects = projects.filter((p) => !p.deletedAt && p.id !== project.id);
    const targetName = forcedNewName || project.name;
    const hasConflict = activeProjects.some(
      (p) => p.name.trim().toLowerCase() === targetName.trim().toLowerCase()
    );

    if (hasConflict && !forcedNewName) {
      setConfirmModal({
        type: "projectNameConflict",
        title: "Project Name Conflict",
        project,
        initialName: `${project.name} (restored)`,
        onConfirm: (newName) => {
          setConfirmModal(null);
          handleRestoreProject(project, newName);
        },
      });
      return;
    }

    const finalName = targetName.trim();

    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, name: finalName, deletedAt: null, deletedWith: null } : p
      )
    );

    // Restore cascaded categories & keywords where deletedWith === project.id
    setCategories((prev) =>
      prev.map((c) =>
        c.projectId === project.id && c.deletedWith === project.id
          ? { ...c, deletedAt: null, deletedWith: null }
          : c
      )
    );

    setRows((prev) =>
      prev.map((k) =>
        k.projectId === project.id && k.deletedWith === project.id
          ? { ...k, deletedAt: null, deletedWith: null }
          : k
      )
    );

    setUndoToast({
      id: `toast-res-proj-${project.id}`,
      type: "restore",
      message: (
        <span>
          Restored project <b>"{finalName}"</b>.
        </span>
      ),
      viewAction: () => {
        setActiveProjectId(project.id);
        setGroup("All");
        setView("list");
      },
    });
  };

  // Restore Category
  const handleRestoreCategory = (category, forcedNewName = null) => {
    // Check parent project status
    const parentProject = projects.find((p) => p.id === category.projectId);
    if (parentProject && parentProject.deletedAt) {
      setConfirmModal({
        type: "restoreProjectPrompt",
        title: "Restore Parent Project",
        projectName: parentProject.name,
        itemDescription: `category "${category.name}"`,
        itemType: "Category",
        onConfirm: () => {
          handleRestoreProject(parentProject);
          handleRestoreCategory(category, forcedNewName);
          setConfirmModal(null);
        },
      });
      return;
    }

    // Check name conflict with active categories in same project
    const activeCatsInProj = categories.filter(
      (c) => c.projectId === category.projectId && !c.deletedAt && c.id !== category.id
    );
    const targetName = forcedNewName || category.name;
    const hasConflict = activeCatsInProj.some(
      (c) => c.name.trim().toLowerCase() === targetName.trim().toLowerCase()
    );

    if (hasConflict && !forcedNewName) {
      setConfirmModal({
        type: "nameConflict",
        title: "Category Name Conflict",
        category,
        projectName: parentProject ? parentProject.name : "Project",
        initialName: `${category.name} (restored)`,
        onConfirm: (newName) => {
          setConfirmModal(null);
          handleRestoreCategory(category, newName);
        },
      });
      return;
    }

    const finalName = targetName.trim();

    // Restore category
    setCategories((prev) =>
      prev.map((c) =>
        c.id === category.id
          ? { ...c, name: finalName, deletedAt: null, deletedWith: null }
          : c
      )
    );

    // Restore cascaded keywords with deletedWith === category.id
    setRows((prev) =>
      prev.map((k) =>
        k.deletedWith === category.id
          ? { ...k, group: finalName, deletedAt: null, deletedWith: null }
          : k
      )
    );

    setUndoToast({
      id: `toast-res-cat-${category.id}`,
      type: "restore",
      message: (
        <span>
          Restored category <b>"{finalName}"</b>.
        </span>
      ),
      viewAction: () => {
        setActiveProjectId(category.projectId);
        setGroup(finalName);
        setView("list");
      },
    });
  };

  // Restore Keyword
  const handleRestoreKeyword = (keyword, options = {}) => {
    // Check parent project
    const parentProject = projects.find((p) => p.id === keyword.projectId);
    if (parentProject && parentProject.deletedAt) {
      setConfirmModal({
        type: "restoreProjectPrompt",
        title: "Restore Parent Project",
        projectName: parentProject.name,
        itemDescription: `keyword "${keyword.keyword}"`,
        itemType: "Keyword",
        onConfirm: () => {
          handleRestoreProject(parentProject);
          handleRestoreKeyword(keyword, options);
          setConfirmModal(null);
        },
      });
      return;
    }

    // Check parent category
    if (keyword.group && keyword.group !== "Uncategorized") {
      const parentCat = categories.find(
        (c) => c.projectId === keyword.projectId && c.name === keyword.group
      );

      if (parentCat && parentCat.deletedAt && !options.restoreCategory && !options.moveToUncategorized) {
        setConfirmModal({
          type: "restoreKeywordPrompt",
          title: "Category in Trash",
          categoryName: parentCat.name,
          keyword,
          onConfirm: (choice) => {
            setConfirmModal(null);
            handleRestoreKeyword(keyword, choice);
          },
        });
        return;
      }

      if (options.restoreCategory && parentCat) {
        handleRestoreCategory(parentCat);
      }
    }

    const finalGroup = options.moveToUncategorized ? "Uncategorized" : keyword.group;

    setRows((prev) =>
      prev.map((k) =>
        k.id === keyword.id
          ? { ...k, group: finalGroup, deletedAt: null, deletedWith: null }
          : k
      )
    );

    setUndoToast({
      id: `toast-res-kw-${keyword.id}`,
      type: "restore",
      message: (
        <span>
          Restored <b>"{keyword.keyword}"</b>.
        </span>
      ),
      viewAction: () => {
        setActiveProjectId(keyword.projectId);
        setGroup(finalGroup);
        setView("list");
      },
    });
  };

  // Purge Single Item (Delete Forever)
  const handlePromptPurgeItem = (type, item) => {
    const itemDesc =
      type === "projects"
        ? `project "${item.name}"`
        : type === "categories"
        ? `category "${item.name}"`
        : `keyword "${item.keyword}"`;

    let cascadeWarn = "";
    if (type === "projects") {
      cascadeWarn = "All categories and keywords in this project will also be permanently deleted.";
    } else if (type === "categories") {
      cascadeWarn = "All keywords deleted with this category will also be permanently deleted.";
    }

    setConfirmModal({
      type: "deleteForever",
      title: "Permanently Delete",
      itemDescription: itemDesc,
      cascadeWarning: cascadeWarn,
      onConfirm: () => {
        if (type === "projects") {
          setProjects((prev) => prev.filter((p) => p.id !== item.id));
          setCategories((prev) => prev.filter((c) => c.projectId !== item.id));
          setRows((prev) => prev.filter((k) => k.projectId !== item.id));
        } else if (type === "categories") {
          setCategories((prev) => prev.filter((c) => c.id !== item.id));
          setRows((prev) => prev.filter((k) => k.deletedWith !== item.id));
        } else if (type === "keywords") {
          setRows((prev) => prev.filter((k) => k.id !== item.id));
        }
        setConfirmModal(null);
      },
    });
  };

  // Bulk Restore in Trash
  const handleBulkRestore = (type, ids) => {
    if (type === "projects") {
      ids.forEach((id) => {
        const p = projects.find((proj) => proj.id === id);
        if (p) handleRestoreProject(p);
      });
    } else if (type === "categories") {
      ids.forEach((id) => {
        const c = categories.find((cat) => cat.id === id);
        if (c) handleRestoreCategory(c);
      });
    } else if (type === "keywords") {
      ids.forEach((id) => {
        const k = rows.find((row) => row.id === id);
        if (k) handleRestoreKeyword(k);
      });
    }
  };

  // Bulk Purge in Trash
  const handleBulkPurge = (type, ids) => {
    setConfirmModal({
      type: "deleteForever",
      title: "Permanently Delete Selected",
      itemDescription: `${ids.length} selected ${type}`,
      cascadeWarning: "All selected items and their cascaded children will be permanently removed.",
      onConfirm: () => {
        if (type === "projects") {
          setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
          setCategories((prev) => prev.filter((c) => !ids.includes(c.projectId)));
          setRows((prev) => prev.filter((k) => !ids.includes(k.projectId)));
        } else if (type === "categories") {
          setCategories((prev) => prev.filter((c) => !ids.includes(c.id)));
          setRows((prev) => prev.filter((k) => !ids.includes(k.deletedWith)));
        } else if (type === "keywords") {
          setRows((prev) => prev.filter((k) => !ids.includes(k.id)));
        }
        setConfirmModal(null);
      },
    });
  };

  // Empty Entire Trash
  const handlePromptEmptyTrash = () => {
    setConfirmModal({
      type: "emptyTrash",
      title: "Empty Entire Trash",
      totalCount: totalTrashCount,
      onConfirm: () => {
        setProjects((prev) => prev.filter((p) => !p.deletedAt));
        setCategories((prev) => prev.filter((c) => !c.deletedAt));
        setRows((prev) => prev.filter((k) => !k.deletedAt));
        setConfirmModal(null);
      },
    });
  };

  // Create Project Handler
  const handleCreateProject = async (e) => {
    e.preventDefault();
    const trimmedName = newProjectForm.name.trim();
    if (!trimmedName) return;

    // Check for duplicate active project name
    const isDuplicate = projects.some(
      (p) => !p.deletedAt && p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setProjectError(`A project named "${trimmedName}" already exists. Please choose a unique name.`);
      return;
    }

    const cleanDomain = newProjectForm.domain?.trim()
      ? newProjectForm.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
      : "";
    const newP = {
      id: `p-${Date.now()}`,
      name: trimmedName,
      domain: cleanDomain,
      deletedAt: null,
      deletedWith: null,
    };
    const updated = [...projects, newP];
    setProjects(updated);
    setActiveProjectId(newP.id);
    setNewProjectForm({ name: "", domain: "" });
    setProjectError("");
    setShowAddProjectModal(false);
    setShowProjectDropdown(false);
    try {
      await apiCreateProject(newP);
    } catch (err) {
      console.warn("apiCreateProject failed:", err.message);
    }
    await syncDatabase({ projects: updated, categories, keywords: rows });
  };

  // Create Category Handler
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed || !activeProject) return;

    // Check for duplicate active category in current project
    const isDuplicate = categories.some(
      (c) =>
        c.projectId === activeProject.id &&
        !c.deletedAt &&
        c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setCategoryError(`Category "${trimmed}" already exists in ${activeProject.name}.`);
      return;
    }

    const newCat = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      projectId: activeProject.id,
      deletedAt: null,
      deletedWith: null,
    };
    const updatedCats = [...categories, newCat];
    setCategories(updatedCats);
    setGroup(trimmed);
    setNewCategoryName("");
    setCategoryError("");
    setShowAddCategoryModal(false);
    try {
      await apiCreateCategory(newCat);
    } catch (err) {
      console.warn("apiCreateCategory failed:", err.message);
    }
    await syncDatabase({ projects, categories: updatedCats, keywords: rows });
  };

  // Add Keyword (Quick Form)
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.keyword.trim() || !activeProject) return;
    const pos = Math.min(100, Math.max(1, parseInt(form.position, 10) || 50));
    const vol = Math.max(0, parseInt(form.volume, 10) || 1000);
    const diff = Math.min(100, Math.max(1, parseInt(form.difficulty, 10) || 35));

    const trimmedGroup = form.group.trim();
    let normalizedGroup = trimmedGroup || availableCategoryNames[0] || "General";
    let updatedCategories = categories;

    // Auto-create category if new, or normalize casing if existing
    if (normalizedGroup && normalizedGroup !== "General") {
      const existingCat = categories.find(
        (c) =>
          c.projectId === activeProject.id &&
          !c.deletedAt &&
          c.name.trim().toLowerCase() === normalizedGroup.toLowerCase()
      );
      if (existingCat) {
        normalizedGroup = existingCat.name;
      } else {
        const newCat = {
          id: `cat-${Date.now()}`,
          name: normalizedGroup,
          projectId: activeProject.id,
          deletedAt: null,
          deletedWith: null,
        };
        updatedCategories = [...categories, newCat];
        setCategories(updatedCategories);
        try {
          await apiCreateCategory(newCat);
        } catch (err) {
          console.warn("apiCreateCategory failed:", err.message);
        }
      }
    }

    const currentMonthKey = monthKeys(6).at(-1);
    const newRow = {
      id: Date.now(),
      projectId: activeProject.id,
      keyword: form.keyword.trim(),
      group: normalizedGroup,
      url: form.url.trim() || (activeProject.domain ? `https://${activeProject.domain}/` : "/"),
      volume: vol,
      difficulty: diff,
      history: Array(30).fill(pos),
      monthly: { [currentMonthKey]: pos },
      deletedAt: null,
      deletedWith: null,
    };

    const updatedKeywords = [newRow, ...rows];
    setRows(updatedKeywords);
    setForm({ keyword: "", group: "", url: "", volume: "", difficulty: "", position: "" });
    setShowQuickModal(false);
    await apiCreateKeyword(newRow);
    await syncDatabase({ projects, categories: updatedCategories, keywords: updatedKeywords });
  };

  // Excel / CSV Import Handler
  const handleExcelImportSuccess = async (importedKeywords) => {
    if (!importedKeywords || !importedKeywords.length || !activeProject) return;

    // Discover any new categories present in the Excel file
    const distinctGroups = Array.from(
      new Set(importedKeywords.map((k) => k.group?.trim()).filter(Boolean))
    );
    let updatedCats = [...categories];
    for (const gName of distinctGroups) {
      const existingCat = updatedCats.find(
        (c) =>
          c.projectId === activeProject.id &&
          !c.deletedAt &&
          c.name.trim().toLowerCase() === gName.toLowerCase()
      );
      if (existingCat) {
        // Normalize keyword groups in imported items to existing category name
        importedKeywords.forEach((k) => {
          if (k.group && k.group.trim().toLowerCase() === gName.toLowerCase()) {
            k.group = existingCat.name;
          }
        });
      } else {
        const alreadyInUpdated = updatedCats.some(
          (c) =>
            c.projectId === activeProject.id &&
            !c.deletedAt &&
            c.name.trim().toLowerCase() === gName.toLowerCase()
        );
        if (!alreadyInUpdated) {
          const newC = {
            id: `cat-${Date.now()}-${gName.replace(/\s+/g, "-")}`,
            name: gName,
            projectId: activeProject.id,
            deletedAt: null,
            deletedWith: null,
          };
          updatedCats.push(newC);
          try {
            await apiCreateCategory(newC);
          } catch (err) {
            console.warn("apiCreateCategory failed:", err.message);
          }
        }
      }
    }

    setCategories(updatedCats);
    const updatedKeywords = [...importedKeywords, ...rows];
    setRows(updatedKeywords);
    setShowBulkModal(false);

    // Sync to MySQL / Database
    await syncDatabase({ projects, categories: updatedCats, keywords: updatedKeywords });
  };

  // Save Edit Keyword
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingKeyword) return;

    const pos = Math.min(100, Math.max(1, parseInt(editingKeyword.position, 10) || 50));
    const vol = Math.max(0, parseInt(editingKeyword.volume, 10) || 1000);
    const diff = Math.min(100, Math.max(1, parseInt(editingKeyword.difficulty, 10) || 35));

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== editingKeyword.id) return r;
        const newHistory = [...(r.history || Array(30).fill(pos))];
        newHistory[newHistory.length - 1] = pos;
        return {
          ...r,
          keyword: editingKeyword.keyword.trim(),
          group: editingKeyword.group.trim() || "General",
          url: editingKeyword.url.trim() || "/",
          volume: vol,
          difficulty: diff,
          history: newHistory,
        };
      })
    );
    setEditingKeyword(null);
  };

  const handleSort = (key) => {
    setSort((prev) => ({
      key,
      asc: prev.key === key ? !prev.asc : true,
    }));
  };

  const openRow = rows.find((r) => r.id === openId && !r.deletedAt);

  if (!currentUser) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} dbStatus={dbStatus} />;
  }

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="app-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Brand & Project Switcher */}
        <div className="sidebar-brand">
          {activeProject ? (
            <button
              className="sidebar-project-btn"
              onClick={() => setShowProjectDropdown((prev) => !prev)}
              title="Switch or Add Project"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <div className="sidebar-logo">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                </div>
                <div className="sidebar-brand-info">
                  <span className="sidebar-brand-name">{activeProject.name}</span>
                  <span className="sidebar-brand-sub">{activeProject.domain || "No domain set"}</span>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--mute)", flexShrink: 0, marginLeft: 6 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          ) : (
            <button
              className="sidebar-project-btn"
              onClick={() => setShowAddProjectModal(true)}
              style={{ borderStyle: "dashed" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="sidebar-logo" style={{ background: "#334155" }}>
                  +
                </div>
                <div className="sidebar-brand-info">
                  <span className="sidebar-brand-name">Create Project</span>
                  <span className="sidebar-brand-sub">No active projects</span>
                </div>
              </div>
            </button>
          )}

          {showProjectDropdown && (
            <div className="sidebar-project-dropdown">
              <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", padding: "4px 8px 6px" }}>
                Active Projects ({activeProjects.length})
              </div>
              {activeProjects.map((proj) => (
                <div
                  key={proj.id}
                  className={`sidebar-project-item ${proj.id === activeProjectId ? "active" : ""}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div
                    style={{ minWidth: 0, flex: 1, cursor: "pointer" }}
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {proj.name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--mute)" }}>{proj.domain || "No domain"}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {proj.id === activeProjectId && (
                      <span style={{ color: "var(--accent)", fontSize: "0.9rem", fontWeight: 700 }}>✓</span>
                    )}
                    <button
                      type="button"
                      className="project-trash-btn"
                      disabled={activeProjects.length <= 1}
                      title={
                        activeProjects.length <= 1
                          ? "Cannot delete the only project"
                          : `Delete "${proj.name}"`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePromptDeleteProject(proj);
                      }}
                      aria-label={`Delete project ${proj.name}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="sidebar-add-project-btn"
                onClick={() => {
                  setShowAddProjectModal(true);
                  setShowProjectDropdown(false);
                }}
              >
                <span>+</span> Add Project
              </button>
            </div>
          )}
        </div>

        {/* Primary CTA button */}
        <div className="sidebar-action-wrap">
          <button
            className="sidebar-primary-cta"
            disabled={!activeProject}
            onClick={() => {
              setView("add");
              setSidebarOpen(false);
            }}
          >
            <span className="cta-plus">+</span>
            <span>Add Keyword</span>
          </button>
        </div>

        {/* Views & Trends */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Views & Trends</div>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${view === "list" && tab === "daily" ? "active" : ""}`}
              onClick={() => {
                setView("list");
                setTab("daily");
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Daily Trend</span>
            </button>

            <button
              className={`sidebar-nav-item ${view === "list" && tab === "monthly" ? "active" : ""}`}
              onClick={() => {
                setView("list");
                setTab("monthly");
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span>Monthly Comparison</span>
            </button>
          </nav>
        </div>

        {/* Categories Section */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Categories</span>
            <button
              className="sidebar-mini-add-btn"
              disabled={!activeProject}
              onClick={() => setShowAddCategoryModal(true)}
              title="Create new category"
            >
              + Add
            </button>
          </div>
          <nav className="sidebar-nav sidebar-categories-nav">
            <button
              className={`sidebar-nav-item ${group === "All" ? "active" : ""}`}
              onClick={() => {
                setGroup("All");
                setView("list");
                setSidebarOpen(false);
              }}
            >
              <span className="category-dot" style={{ background: group === "All" ? "var(--accent)" : "#475569" }} />
              <span className="category-text">All Categories</span>
              <span className="category-count">{activeKeywords.length}</span>
            </button>

            {activeCategories.map((cat) => {
              const count = activeKeywords.filter((r) => r.group === cat.name).length;
              const isMenuOpen = openCategoryMenuId === cat.id;

              return (
                <div key={cat.id} className="sidebar-category-row">
                  <button
                    className={`sidebar-nav-item ${group === cat.name ? "active" : ""}`}
                    onClick={() => {
                      setGroup(cat.name);
                      setView("list");
                      setSidebarOpen(false);
                    }}
                  >
                    <span className="category-dot" />
                    <span className="category-text">{cat.name}</span>
                    <span className="category-count">{count}</span>

                    <div className="category-actions-group" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="category-action-btn delete"
                        title={`Delete category "${cat.name}"`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromptDeleteCategory(cat);
                        }}
                        aria-label={`Delete category ${cat.name}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="category-action-btn"
                        title="Category options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenCategoryMenuId(isMenuOpen ? null : cat.id);
                        }}
                        aria-label={`Options for ${cat.name}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </button>
                    </div>
                  </button>

                  {isMenuOpen && (
                    <div ref={categoryMenuRef} className="category-dropdown-menu">
                      <button
                        type="button"
                        className="category-dropdown-item delete"
                        onClick={() => handlePromptDeleteCategory(cat)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        </svg>
                        Delete Category
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Quick Actions */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Quick Actions</div>
          <nav className="sidebar-nav">
            <button
              className="sidebar-nav-item"
              onClick={() => {
                setShowAddProjectModal(true);
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="M14 9h3" />
                <path d="M14 14h3" />
              </svg>
              <span>+ Add Project</span>
            </button>

            <button
              className="sidebar-nav-item"
              disabled={!activeProject}
              onClick={() => {
                setShowAddCategoryModal(true);
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                <line x1="12" x2="12" y1="10" y2="16" />
                <line x1="9" x2="15" y1="13" y2="13" />
              </svg>
              <span>+ Add Category</span>
            </button>

            <button
              className="sidebar-nav-item"
              disabled={!activeProject}
              onClick={() => {
                setShowQuickModal((prev) => !prev);
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>Quick Modal</span>
            </button>

            <button
              className="sidebar-nav-item"
              disabled={!activeProject}
              onClick={() => {
                setShowBulkModal(true);
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
              </svg>
              <span>Bulk Import</span>
            </button>

            <button
              className="sidebar-nav-item"
              onClick={() => {
                setShowTrashPanel(true);
                setSidebarOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              <span>Trash</span>
              {totalTrashCount > 0 && <span className="trash-badge">{totalTrashCount}</span>}
            </button>
          </nav>
        </div>

        {/* Portfolio Health */}
        <div className="sidebar-stats-widget">
          <div className="sidebar-stats-header">
            <span>Portfolio Health</span>
            <span className="sidebar-live-pill">● Live</span>
          </div>
          <div className="sidebar-stats-grid">
            <div className="sidebar-stat-cell">
              <span className="sidebar-stat-label">Total</span>
              <span className="sidebar-stat-val">{activeKeywords.length}</span>
            </div>
            <div className="sidebar-stat-cell">
              <span className="sidebar-stat-label">Top 3</span>
              <span className="sidebar-stat-val" style={{ color: "var(--up)" }}>{top3}</span>
            </div>
            <div className="sidebar-stat-cell">
              <span className="sidebar-stat-label">Top 10</span>
              <span className="sidebar-stat-val" style={{ color: "var(--accent)" }}>{top10}</span>
            </div>
            <div className="sidebar-stat-cell">
              <span className="sidebar-stat-label">Avg KD</span>
              <span className="sidebar-stat-val" style={{ color: avgKdInfo.color }}>{avgDifficulty}%</span>
            </div>
          </div>
        </div>

        {/* User Profile & Sign Out Widget */}
        <div className="sidebar-user-widget">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name" title={currentUser.name}>
                {currentUser.name || "User"}
              </span>
              <span className="sidebar-user-email" title={currentUser.email}>
                {currentUser.email || "admin@seotracker.io"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-signout-btn"
            onClick={handleSignOut}
            title="Sign out of your account"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main-content">
        <div className="mobile-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="sidebar-logo" style={{ width: 28, height: 28, borderRadius: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>RankPulse</span>
          </div>
          <button className="mobile-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
        </div>

        <main>
          {!activeProject ? (
            <div className="no-projects-view">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--mute)", marginBottom: 16 }}>
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="M14 9h3" />
                <path d="M14 14h3" />
              </svg>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
                No active projects
              </h2>
              <p className="muted" style={{ maxWidth: 440, fontSize: "0.9rem", marginBottom: 20 }}>
                All projects have been moved to Trash or none have been created yet. Create a new workspace or restore a project from Trash.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  className="btn-header-primary"
                  onClick={() => setShowAddProjectModal(true)}
                  style={{ padding: "10px 22px" }}
                >
                  <span>+</span> Create Project
                </button>
                {totalTrashCount > 0 && (
                  <button
                    className="btn-header-ghost"
                    onClick={() => setShowTrashPanel(true)}
                    style={{ padding: "10px 18px" }}
                  >
                    Open Trash ({totalTrashCount})
                  </button>
                )}
              </div>
            </div>
          ) : view === "add" ? (
            <AddKeywordView
              onBack={() => setView("list")}
              onAdd={async (newKw) => {
                const trimmedGroup = (newKw.group || "").trim();
                let normalizedGroup = trimmedGroup || availableCategoryNames[0] || "General";
                let updatedCategories = categories;

                if (normalizedGroup && normalizedGroup !== "General") {
                  const existingCat = categories.find(
                    (c) =>
                      c.projectId === activeProject.id &&
                      !c.deletedAt &&
                      c.name.trim().toLowerCase() === normalizedGroup.toLowerCase()
                  );
                  if (existingCat) {
                    normalizedGroup = existingCat.name;
                  } else {
                    const newCat = {
                      id: `cat-${Date.now()}`,
                      name: normalizedGroup,
                      projectId: activeProject.id,
                      deletedAt: null,
                      deletedWith: null,
                    };
                    updatedCategories = [...categories, newCat];
                    setCategories(updatedCategories);
                    try {
                      await apiCreateCategory(newCat);
                    } catch (err) {
                      console.warn("apiCreateCategory failed:", err.message);
                    }
                  }
                }

                const kwToAdd = {
                  ...newKw,
                  group: normalizedGroup,
                  projectId: activeProject.id,
                  deletedAt: null,
                  deletedWith: null,
                };

                const updatedKeywords = [kwToAdd, ...rows];
                setRows(updatedKeywords);
                await apiCreateKeyword(kwToAdd);
                await syncDatabase({ projects, categories: updatedCategories, keywords: updatedKeywords });
              }}
              defaultDomain={activeProject.domain || "example.com"}
              availableCategories={availableCategoryNames}
            />
          ) : (
            <>
              <header className="main-header">
                <div>
                  <h1>Keyword Intelligence & SERP Tracker</h1>
                  <p className="muted">
                    Monitor real-time Google search positions, historical sparklines, and monthly variance for <span style={{ color: "var(--accent)", fontWeight: 600 }}>{activeProject.domain || activeProject.name}</span>.
                  </p>
                </div>
                <div className="header-actions">
                  <button
                    className="btn-header-ghost"
                    onClick={() => setShowTrashPanel(true)}
                    title="View and restore deleted items"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    <span>Trash</span>
                    {totalTrashCount > 0 && <span className="trash-badge">{totalTrashCount}</span>}
                  </button>
                  <button
                    className="btn-header-ghost"
                    onClick={() => setShowBulkModal(true)}
                    title="Import keywords from Excel (.xlsx, .xls) or CSV sheet"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>Import Excel</span>
                  </button>
                  <button
                    className="btn-header-outline"
                    onClick={() => setShowQuickModal((prev) => !prev)}
                  >
                    Quick Modal
                  </button>
                  <button className="btn-header-primary" onClick={() => setView("add")}>
                    <span>+</span> Add Keyword
                  </button>
                  <button
                    type="button"
                    className="header-signout-pill"
                    onClick={handleSignOut}
                    title={`Signed in as ${currentUser.email}. Click to sign out.`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </header>

              <div className="tabs">
                <button
                  className={`tab-btn ${tab === "daily" ? "active" : ""}`}
                  onClick={() => setTab("daily")}
                >
                  Daily Trend
                </button>
                <button
                  className={`tab-btn ${tab === "monthly" ? "active" : ""}`}
                  onClick={() => setTab("monthly")}
                >
                  Monthly Comparison
                </button>
              </div>

              <div className="stats">
                <div>
                  <b>{activeKeywords.length}</b>
                  <span>Total Keywords</span>
                </div>
                <div>
                  <b>{top3}</b>
                  <span>Top 3 Rankings</span>
                </div>
                <div>
                  <b>{top10}</b>
                  <span>Top 10 Rankings</span>
                </div>
                <div>
                  <b>{formatVolume(totalVolume)}</b>
                  <span>Total Search Volume</span>
                </div>
                <div>
                  <b style={{ color: avgKdInfo.color }}>{avgDifficulty}%</b>
                  <span>Avg KD ({avgKdInfo.level})</span>
                </div>
              </div>

              {tab === "monthly" ? (
                <Monthly rows={activeKeywords} setRows={setRows} />
              ) : (
                <>
                  {showQuickModal && (
                    <form className="add" onSubmit={handleAdd}>
                      <div className="add-header">+ Track New Keyword</div>
                      <input
                        placeholder="Keyword (e.g. nextjs seo)"
                        required
                        value={form.keyword}
                        onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                      />
                      <input
                        placeholder="Category / Group"
                        value={form.group}
                        onChange={(e) => setForm({ ...form, group: e.target.value })}
                      />
                      <input
                        placeholder="Page URL (/guides/...)"
                        value={form.url}
                        onChange={(e) => setForm({ ...form, url: e.target.value })}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Vol (e.g. 5000)"
                        value={form.volume}
                        onChange={(e) => setForm({ ...form, volume: e.target.value })}
                      />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="KD% (1-100)"
                        value={form.difficulty}
                        onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                      />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Pos (1-100)"
                        value={form.position}
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                      />
                      <button className="primary" type="submit">
                        + Add
                      </button>
                    </form>
                  )}

                  <div className="toolbar">
                    <div className="toolbar-search-wrap">
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
                        placeholder="Search keywords or URLs..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                    </div>

                    <div className="toolbar-filters-group">
                      <div className="chips">
                        <span className="chip-label">Difficulty:</span>
                        {["All", "Easy", "Medium", "Hard", "Very Hard"].map((lvl) => (
                          <button
                            key={lvl}
                            className={`chip ${kdFilter === lvl ? "on" : ""}`}
                            onClick={() => setKdFilter(lvl)}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>

                      <div className="toolbar-divider" />

                      <div className="chips">
                        <span className="chip-label">Rank:</span>
                        {["All", "Top 10", "Top 20", "Top 30", "Top 40", "Top 50"].map((rf) => (
                          <button
                            key={rf}
                            className={`chip ${rankFilter === rf ? "on" : ""}`}
                            onClick={() => setRankFilter(rf)}
                          >
                            {rf}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th className="sortable th-keyword" onClick={() => handleSort("keyword")}>
                            Keyword {sort.key === "keyword" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          <th className="sortable th-pos" onClick={() => handleSort("position")}>
                            Position {sort.key === "position" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          <th className="sortable th-change" onClick={() => handleSort("change")}>
                            7d Change {sort.key === "change" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          <th className="sortable th-volume" onClick={() => handleSort("volume")}>
                            Search Volume {sort.key === "volume" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          <th className="sortable th-kd" onClick={() => handleSort("difficulty")}>
                            Difficulty (KD) {sort.key === "difficulty" ? (sort.asc ? "▲" : "▼") : ""}
                          </th>
                          <th className="th-trend">30d Trend</th>
                          <th className="th-url">Target URL</th>
                          <th className="th-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r) => (
                          <tr key={r.id} onClick={() => setOpenId(r.id)}>
                            <td className="td-keyword">
                              <div className="keyword-title">{r.keyword}</div>
                              <div className="keyword-group">{r.group}</div>
                            </td>
                            <td className="td-pos pos">{formatPosition(cur(r))}</td>
                            <td className="td-change">
                              <Change d={delta(r)} />
                            </td>
                            <td className="td-volume vol-cell">
                              {r.volume ? r.volume.toLocaleString("en-IN") : "–"}
                              <div className="vol-sub">/ month</div>
                            </td>
                            <td className="td-kd">
                              <KdBadge score={r.difficulty || 40} />
                            </td>
                            <td className="td-trend">
                              <Spark data={r.history} up={delta(r) >= 0} />
                            </td>
                            <td className="td-url muted" title={r.url}>
                              {r.url || "–"}
                            </td>
                            <td className="td-actions actions-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="actions-wrap">
                                <button
                                  className="action-btn view-btn"
                                  title="View details & trends"
                                  onClick={() => setOpenId(r.id)}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>View</span>
                                </button>
                                <button
                                  className="action-btn edit-btn"
                                  title="Edit keyword"
                                  onClick={() => setEditingKeyword({ ...r, position: cur(r) })}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  </svg>
                                  <span>Edit</span>
                                </button>
                                <button
                                  className="action-btn delete-btn"
                                  title="Delete keyword"
                                  onClick={() => handleSoftDeleteKeyword(r.id)}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!sorted.length && (
                      <p className="empty">No matching keywords found. Try changing your search or filters.</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Drawer Detail */}
          {openRow && (
            <Detail
              row={openRow}
              onClose={() => setOpenId(null)}
              onRemove={() => handleSoftDeleteKeyword(openRow.id)}
            />
          )}

          {/* Edit Keyword Modal */}
          {editingKeyword && (
            <div className="modal-overlay" onClick={() => setEditingKeyword(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">Edit Keyword</h2>
                  <button className="link" onClick={() => setEditingKeyword(null)}>
                    ✕
                  </button>
                </div>
                <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Keyword Query *</label>
                    <input
                      required
                      value={editingKeyword.keyword}
                      onChange={(e) =>
                        setEditingKeyword({ ...editingKeyword, keyword: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category / Group</label>
                    <input
                      value={editingKeyword.group}
                      onChange={(e) =>
                        setEditingKeyword({ ...editingKeyword, group: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Target Landing Page URL</label>
                    <input
                      value={editingKeyword.url}
                      onChange={(e) =>
                        setEditingKeyword({ ...editingKeyword, url: e.target.value })
                      }
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Search Volume</label>
                      <input
                        type="number"
                        min="0"
                        value={editingKeyword.volume}
                        onChange={(e) =>
                          setEditingKeyword({ ...editingKeyword, volume: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">KD % (1-100)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editingKeyword.difficulty}
                        onChange={(e) =>
                          setEditingKeyword({ ...editingKeyword, difficulty: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Position (1-100)</label>
                      <input
                        type="number"
                        min="1"
                        max="101"
                        value={editingKeyword.position}
                        onChange={(e) =>
                          setEditingKeyword({ ...editingKeyword, position: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setEditingKeyword(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Excel / CSV Import Modal */}
          <ExcelImportModal
            isOpen={showBulkModal}
            onClose={() => setShowBulkModal(false)}
            activeProject={activeProject}
            availableCategories={availableCategoryNames}
            onImportSuccess={handleExcelImportSuccess}
          />

          {/* Add Project Modal */}
          {showAddProjectModal && (
            <div
              className="modal-overlay"
              onClick={() => {
                setShowAddProjectModal(false);
                setProjectError("");
              }}
            >
              <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">+ Add New Project</h2>
                  <button
                    className="link"
                    onClick={() => {
                      setShowAddProjectModal(false);
                      setProjectError("");
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: -6, marginBottom: 14 }}>
                  Create a new workspace to track keyword rankings for another domain.
                </p>

                {projectError && (
                  <div className="auth-error-banner" style={{ marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{projectError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Project Name *</label>
                    <input
                      required
                      placeholder="e.g. Acme SaaS Platform"
                      value={newProjectForm.name}
                      onChange={(e) => {
                        setNewProjectForm({ ...newProjectForm, name: e.target.value });
                        if (projectError) setProjectError("");
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Target Website / Domain <span className="muted" style={{ fontWeight: 400, textTransform: "none", fontSize: "0.78rem" }}>(Optional)</span>
                    </label>
                    <input
                      placeholder="e.g. acme.com or datamesh.io"
                      value={newProjectForm.domain}
                      onChange={(e) => setNewProjectForm({ ...newProjectForm, domain: e.target.value })}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setShowAddProjectModal(false);
                        setProjectError("");
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Create Project
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Add Category Modal */}
          {showAddCategoryModal && (
            <div
              className="modal-overlay"
              onClick={() => {
                setShowAddCategoryModal(false);
                setCategoryError("");
              }}
            >
              <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">+ Add New Category</h2>
                  <button
                    className="link"
                    onClick={() => {
                      setShowAddCategoryModal(false);
                      setCategoryError("");
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: -6, marginBottom: 14 }}>
                  Group keywords by product pillars, topic clusters, or landing pages.
                </p>

                {categoryError && (
                  <div className="auth-error-banner" style={{ marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{categoryError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateCategory} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Category Name *</label>
                    <input
                      required
                      placeholder="e.g. Integrations, Pricing, Competitors..."
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        if (categoryError) setCategoryError("");
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setShowAddCategoryModal(false);
                        setCategoryError("");
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Create Category
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Confirm Delete / Restore Modals */}
          {confirmModal && (
            <ConfirmDeleteModal
              modal={confirmModal}
              onClose={() => setConfirmModal(null)}
            />
          )}

          {/* Trash Panel Modal */}
          <TrashPanel
            isOpen={showTrashPanel}
            onClose={() => setShowTrashPanel(false)}
            trashedProjects={trashedProjects}
            trashedCategories={trashedCategories}
            trashedKeywords={trashedKeywords}
            allProjects={projects}
            allCategories={categories}
            onRestoreProject={handleRestoreProject}
            onRestoreCategory={handleRestoreCategory}
            onRestoreKeyword={handleRestoreKeyword}
            onPurgeProject={(p) => handlePromptPurgeItem("projects", p)}
            onPurgeCategory={(c) => handlePromptPurgeItem("categories", c)}
            onPurgeKeyword={(k) => handlePromptPurgeItem("keywords", k)}
            onBulkRestore={handleBulkRestore}
            onBulkPurge={handleBulkPurge}
            onEmptyTrash={handlePromptEmptyTrash}
          />

          {/* Undo / Restored Toast Notification */}
          <UndoToast
            toast={undoToast}
            onDismiss={() => setUndoToast(null)}
          />
        </main>
      </div>
    </div>
  );
}
