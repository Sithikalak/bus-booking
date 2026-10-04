export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface ApiClient {
  <T>(path: string, method?: string, body?: unknown): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = sessionStorage.getItem("citylink-token");
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Cannot reach CityLink. Check that the backend is running, then try again.",
      "NETWORK",
      0,
    );
  }
  const rawText = await response.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    // response is not JSON
  }

  if (!response.ok || !json?.success) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      if (sessionStorage.getItem("citylink-token")) {
        sessionStorage.removeItem("citylink-token");
        window.dispatchEvent(new Event("session-expired"));
      }
    }
    const message =
      json?.message ||
      (rawText && rawText.length < 150 ? rawText : `Server returned error (${response.status})`);
    throw new ApiError(
      message || "Unable to complete request.",
      json?.errorCode || "ERROR",
      response.status,
    );
  }
  return json.data as T;
}

export const api: ApiClient = Object.assign(request, {
  get: <T>(path: string): Promise<T> => request<T>(path, "GET"),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, "POST", body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, "PUT", body),
  delete: <T>(path: string): Promise<T> => request<T>(path, "DELETE"),
});

export { useApi } from "../hooks/useApi";

export const query = (
  values: Record<string, string | number | undefined | null>,
) => {
  const p = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== null) p.set(k, String(v));
  });
  return p.toString();
};
