const API_BASE = "http://localhost:3001/api";

export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (!res.ok) return { connected: false };
    const data = await res.json();
    return { connected: true, database: data.database };
  } catch {
    return { connected: false };
  }
}

export async function apiLogin({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to login");
  }
  return data;
}

export async function apiRegister({ name, email, password }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to register");
  }
  return data;
}

export async function apiGetMe(token) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function apiLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
  } catch (err) {
    console.warn("Logout error:", err);
  }
}

export async function fetchDatabaseData() {
  try {
    const res = await fetch(`${API_BASE}/data`);
    if (!res.ok) throw new Error("Failed to fetch from DB");
    return await res.json();
  } catch (err) {
    console.warn("DB offline, falling back to local data:", err.message);
    return null;
  }
}

export async function syncDatabase(payload) {
  try {
    const res = await fetch(`${API_BASE}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.warn("DB sync failed:", err.message);
    return null;
  }
}

export async function apiCreateProject(project) {
  try {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to create project");
    }
    return data;
  } catch (err) {
    console.warn("apiCreateProject failed:", err.message);
    throw err;
  }
}

export async function apiUpdateProject(id, updates) {
  try {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to update project");
    }
    return data;
  } catch (err) {
    console.warn("apiUpdateProject failed:", err.message);
    throw err;
  }
}

export async function apiDeleteProject(id) {
  try {
    await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("apiDeleteProject failed:", err.message);
  }
}

export async function apiCreateCategory(category) {
  try {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to create category");
    }
    return data;
  } catch (err) {
    console.warn("apiCreateCategory failed:", err.message);
    throw err;
  }
}

export async function apiUpdateCategory(id, updates) {
  try {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to update category");
    }
    return data;
  } catch (err) {
    console.warn("apiUpdateCategory failed:", err.message);
    throw err;
  }
}

export async function apiDeleteCategory(id) {
  try {
    await fetch(`${API_BASE}/categories/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("apiDeleteCategory failed:", err.message);
  }
}

export async function apiCreateKeyword(keyword) {
  try {
    await fetch(`${API_BASE}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keyword),
    });
  } catch (err) {
    console.warn("apiCreateKeyword failed:", err.message);
  }
}

export async function apiUpdateKeyword(id, updates) {
  try {
    await fetch(`${API_BASE}/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.warn("apiUpdateKeyword failed:", err.message);
  }
}

export async function apiDeleteKeyword(id) {
  try {
    await fetch(`${API_BASE}/keywords/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("apiDeleteKeyword failed:", err.message);
  }
}
