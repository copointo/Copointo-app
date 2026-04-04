const API = "/api/admin";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getStats: ()                           => req<any>("GET",   "/stats"),
  getCafes: ()                           => req<any>("GET",   "/cafes"),
  addCafe:  (body: any)                  => req<any>("POST",  "/cafes", body),
  toggleCafe: (id: string)              => req<any>("PATCH", `/cafes/${id}/toggle`),
  deleteCafe: (id: string)              => req<any>("DELETE", `/cafes/${id}`),
  getUsers: ()                           => req<any>("GET",   "/users"),
  toggleBan: (id: string)              => req<any>("PATCH", `/users/${id}/ban`),
};
