export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/** Low-level request wrapper with solid error text. */
async function request(url, { method = "GET", headers = {}, body, signal, prefer } = {}) {
  const h = new Headers(headers);
  if (prefer) h.set("Prefer", prefer);

  const res = await fetch(url, { method, headers: h, body, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  // 204/empty bodies are fine
  if (!res.headers.get("content-type")?.includes("application/json")) return null;
  return res.json();
}

/** Build a PostgREST URL with query params. */
function buildURL(resource, params) {
  const url = new URL(`${API_URL}/${resource}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/** Common PostgREST operators (do NOT URL-encode here; URLSearchParams will). */
export const op = {
  eq: (v) => `eq.${v}`,
  neq: (v) => `neq.${v}`,
  gt: (v) => `gt.${v}`,
  gte: (v) => `gte.${v}`,
  lt: (v) => `lt.${v}`,
  lte: (v) => `lte.${v}`,
  like: (v) => `like.${v}`,     // e.g. %term%
  ilike: (v) => `ilike.${v}`,   // case-insensitive
  in: (arr) => `in.(${arr.join(",")})`,
  isNull: () => `is.null`,
  isTrue: () => `is.true`,
  isFalse: () => `is.false`,
};

/** HTTP helpers */
export const api = {
  get(resource, params, opts) {
    return request(buildURL(resource, params), { ...opts, method: "GET" });
  },
  post(resource, rows, opts) {
    return request(`${API_URL}/${resource}`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
      // echo inserted rows back by default
      prefer: opts?.prefer ?? "return=representation",
    });
  },
  /** Bulk insert via CSV (headers must match column names). */
  postCSV(resource, csvString, opts) {
    return request(`${API_URL}/${resource}`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "text/csv", ...(opts?.headers || {}) },
      body: csvString,
      prefer: opts?.prefer ?? "return=representation",
    });
  },
  /** PATCH rows matching filters. Example: patch('games', { id: op.eq(gameId) }, { processed: true }) */
  patch(resource, filters, patchBody, opts) {
    return request(buildURL(resource, filters), {
      ...opts,
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
      body: JSON.stringify(patchBody),
      prefer: opts?.prefer ?? "return=representation",
    });
  },
  /** DELETE rows matching filters. Returns null (204) unless prefer=return=representation. */
  del(resource, filters, opts) {
    return request(buildURL(resource, filters), {
      ...opts,
      method: "DELETE",
      prefer: opts?.prefer,
    });
  },
};

/** ---------------------------
 *  Domain-specific shortcuts
 *  ---------------------------
 */

export const Teams = {
  list({ order = "name.asc", select = "id,name" } = {}) {
    return api.get("teams", { order, select });
  },
  create({ name, captain_id }) {
    // captain_id optional for your local/no-auth flow
    return api.post("teams", { name, ...(captain_id ? { captain_id } : {}) });
  },
};

export const Games = {
  listByTeam(teamId, { order = "date.desc", select = "id,title,date,video_url,hastimestamps,isscored,players,processed" } = {}) {
    return api.get("games", { team_id: op.eq(teamId), order, select });
  },
  byVideo(videoUrl, { select = "id" } = {}) {
    return api.get("games", { video_url: op.eq(videoUrl), select, limit: "1" });
  },
  create(row) {
    return api.post("games", row);
  },
  update(id, patch) {
    return api.patch("games", { id: op.eq(id) }, patch);
  },
  remove(id) {
    return api.del("games", { id: op.eq(id) });
  },
};

export const Stats = {
  listByGame(gameId, { order = "import_seq.asc", select = "*" } = {}) {
    return api.get("stats", { game_id: op.eq(gameId), order, select });
  },
  insert(rows) {
    return api.post("stats", rows);
  },
  /** csvString should include a header row that matches column names */
  insertCSV(csvString) {
    return api.postCSV("stats", csvString);
  },
};

export const TeamMembers = {
  roleForUser(teamId, userId) {
    return api.get("team_members", { team_id: op.eq(teamId), user_id: op.eq(userId), select: "role", limit: "1" });
  },
  upsert(member) {
    // requires a unique constraint to merge; otherwise just insert
    return api.post("team_members", member, { prefer: "resolution=merge-duplicates,return=representation" });
  },
};

/** Example:
 * const { data } = await Teams.list()
 * const games = await Games.listByTeam(teamId)
 * await Games.update(gameId, { processed: true })
 * await Stats.insert([{ game_id, import_seq: 1, ... }])
 */
