export function authHeaders(accessToken?: string | null, init?: HeadersInit) {
  const headers = new Headers(init);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

export const authFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  accessToken?: string | null,
) => {
  return fetch(input, { ...init, headers: authHeaders(accessToken, init.headers) });
};
