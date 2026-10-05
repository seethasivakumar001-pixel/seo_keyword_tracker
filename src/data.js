// Mock data. Replace with Google Search Console / rank API responses later.
const rnd = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

export function makeHistory(seed, start, days = 30) {
  const r = rnd(seed);
  let p = start;
  return Array.from({ length: days }, () => {
    p = Math.min(100, Math.max(1, Math.round(p + (r() - 0.55) * 4)));
    return p;
  });
}

export function getDifficultyInfo(score) {
  const kd = Math.min(100, Math.max(1, Number(score) || 1));
  if (kd <= 29) {
    return {
      score: kd,
      level: "Easy",
      color: "var(--kd-easy)",
      bg: "var(--kd-easy-bg)",
      text: "var(--kd-easy-text)",
      border: "var(--kd-easy-border)",
      desc: "Low competition. Easy to rank with well-structured content.",
    };
  }
  if (kd <= 49) {
    return {
      score: kd,
      level: "Medium",
      color: "var(--kd-med)",
      bg: "var(--kd-med-bg)",
      text: "var(--kd-med-text)",
      border: "var(--kd-med-border)",
      desc: "Moderate competition. Requires authoritative content and internal links.",
    };
  }
  if (kd <= 69) {
    return {
      score: kd,
      level: "Hard",
      color: "var(--kd-hard)",
      bg: "var(--kd-hard-bg)",
      text: "var(--kd-hard-text)",
      border: "var(--kd-hard-border)",
      desc: "High competition. High domain authority and quality backlinks needed.",
    };
  }
  return {
    score: kd,
    level: "Very Hard",
    color: "var(--kd-vhard)",
    bg: "var(--kd-vhard-bg)",
    text: "var(--kd-vhard-text)",
    border: "var(--kd-vhard-border)",
    desc: "Very high competition. Dominant established brands in top results.",
  };
}

export function formatPosition(pos) {
  const p = Number(pos);
  if (!p && p !== 0) return "–";
  if (p > 100) return ">100";
  if (p >= 90 && p <= 100) return "<100";
  return `#${p}`;
}

export function formatVolume(vol) {
  const v = Number(vol) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString("en-IN");
}

const seeds = [
  ["react vite tutorial", "Blog", 18, 12100, 38, "/blog/react-vite"],
  ["frontend developer portfolio", "Blog", 31, 5400, 45, "/blog/portfolio"],
  ["tailwind css cheat sheet", "Resources", 9, 22200, 68, "/resources/tailwind"],
  ["next.js seo checklist", "Blog", 24, 3600, 28, "/blog/nextjs-seo"],
  ["core web vitals explained", "Guides", 14, 8100, 52, "/guides/cwv"],
  ["bootstrap 5 templates", "Resources", 42, 9900, 74, "/resources/bootstrap"],
  ["javascript es6 features", "Guides", 6, 18100, 81, "/guides/es6"],
  ["css grid vs flexbox", "Guides", 12, 14800, 63, "/guides/grid-flex"],
];

export function monthKeys(n = 6) {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}

export const monthLabel = (k) => {
  const [y, m] = k.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

export const initialProjects = [
  { id: "p1", name: "TechSphere Cloud", domain: "techsphere.io", deletedAt: null, deletedWith: null },
  { id: "p2", name: "DataMesh Systems", domain: "datamesh.io", deletedAt: null, deletedWith: null },
];

export const initialCategories = [
  { id: "cat-blog-p1", name: "Blog", projectId: "p1", deletedAt: null, deletedWith: null },
  { id: "cat-resources-p1", name: "Resources", projectId: "p1", deletedAt: null, deletedWith: null },
  { id: "cat-guides-p1", name: "Guides", projectId: "p1", deletedAt: null, deletedWith: null },
  { id: "cat-core-p2", name: "Core Product", projectId: "p2", deletedAt: null, deletedWith: null },
];

export function formatRelativeTime(isoDate) {
  if (!isoDate) return "";
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay >= 30) {
    const months = Math.floor(diffDay / 30);
    return `Deleted ${months} ${months === 1 ? "month" : "months"} ago`;
  }
  if (diffDay > 1) return `Deleted ${diffDay} days ago`;
  if (diffDay === 1) return "Deleted 1 day ago";
  if (diffHour >= 1) return `Deleted ${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
  if (diffMin >= 1) return `Deleted ${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  return "Deleted just now";
}

export function isExpired(isoDate) {
  if (!isoDate) return false;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(isoDate).getTime() > THIRTY_DAYS_MS;
}

export const initialKeywords = seeds.map(([keyword, group, start, volume, difficulty, url], i) => {
  const history = makeHistory(i * 97 + 13, start);
  const m = makeHistory(i * 53 + 7, start + 6, 6);
  m[5] = history.at(-1);
  const monthly = Object.fromEntries(monthKeys().map((k, j) => [k, m[j]]));
  return {
    id: i + 1,
    projectId: "p1",
    keyword,
    group,
    volume,
    difficulty,
    url,
    history,
    monthly,
    deletedAt: null,
    deletedWith: null,
  };
});

