export function createSupabaseResourceStore({
  url = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  if (!url && !serviceRoleKey) return null;
  if (!url || !serviceRoleKey) {
    throw new Error("Configure both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  let endpoint;
  try {
    endpoint = new URL("/rest/v1/course_resources", url);
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL.");
  }
  if (endpoint.protocol !== "https:") {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }

  async function request(method, query = {}, resource) {
    const target = new URL(endpoint);
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, value);
    }

    let response;
    try {
      response = await fetchImpl(target, {
        method,
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        signal: AbortSignal.timeout(30_000),
        ...(resource ? {
          body: JSON.stringify({
            id: resource.id,
            created_at: resource.createdAt,
            resource,
          }),
        } : {}),
      });
    } catch (error) {
      throw new Error(`Supabase could not be reached: ${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`Supabase returned HTTP ${response.status}.`);
    }
    if (response.status === 204) return [];
    return response.json();
  }

  return {
    async list() {
      const rows = await request("GET", { select: "resource", order: "created_at.asc" });
      return rows.map(({ resource }) => resource);
    },
    async create(resource) {
      await request("POST", {}, resource);
    },
    async update(id, resource) {
      const rows = await request("PATCH", { id: `eq.${id}`, select: "id" }, resource);
      return rows.length > 0;
    },
    async remove(id) {
      const rows = await request("DELETE", { id: `eq.${id}`, select: "id" });
      return rows.length > 0;
    },
  };
}
