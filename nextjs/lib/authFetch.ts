export const authFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  accessToken?: string | null,
) => {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(input, { ...init, headers });
};
