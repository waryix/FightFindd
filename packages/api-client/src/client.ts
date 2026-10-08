import { isApiErrorBody, type ApiErrorCode } from "@fightfind/types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | "NETWORK_ERROR" | "UNKNOWN";
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: ApiClientError["code"] = "UNKNOWN",
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

export interface FileUpload {
  uri?: string;
  name: string;
  type: string;
  file?: Blob;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Called once on 401; return a fresh access token or null to give up. */
  refreshAccessToken?: () => Promise<string | null>;
  onAuthFailure?: () => void;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly options: ApiClientOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async resolveToken(): Promise<string | null> {
    const token = await this.options.getAccessToken?.();
    return token ?? null;
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}, retried = false): Promise<T> {
    const url = `${this.baseUrl}${path}${buildQuery(options.query)}`;
    const headers: Record<string, string> = { Accept: "application/json", ...this.options.defaultHeaders, ...options.headers };

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    if (options.auth !== false) {
      const token = await this.resolveToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiClientError("Could not reach FightFind. Check your connection.", 0, "NETWORK_ERROR");
    }

    if (response.status === 401 && !retried && options.auth !== false && this.options.refreshAccessToken) {
      const newToken = await this.options.refreshAccessToken().catch(() => null);
      if (newToken) return this.request<T>(method, path, options, true);
      this.options.onAuthFailure?.();
    } else if (response.status === 401) {
      this.options.onAuthFailure?.();
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      if (isApiErrorBody(parsed)) {
        throw new ApiClientError(
          parsed.error.message,
          response.status,
          parsed.error.code,
          parsed.error.details,
          parsed.error.requestId,
        );
      }
      throw new ApiClientError(`Request failed (${response.status})`, response.status);
    }

    return parsed as T;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, options);
  }
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("POST", path, { ...options, body });
  }
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PATCH", path, { ...options, body });
  }
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PUT", path, { ...options, body });
  }
  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, options);
  }

  async upload<T>(path: string, file: FileUpload, field = "file"): Promise<T> {
    const form = new FormData();
    if (file.file) {
      form.append(field, file.file, file.name);
    } else if (file.uri) {
      // React Native FormData file shape.
      form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    } else {
      throw new ApiClientError("No file provided", 400);
    }

    const headers: Record<string, string> = { ...this.options.defaultHeaders };
    const token = await this.resolveToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, { method: "POST", headers, body: form });
    } catch {
      throw new ApiClientError("Upload failed. Check your connection.", 0, "NETWORK_ERROR");
    }

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      if (isApiErrorBody(parsed)) {
        throw new ApiClientError(parsed.error.message, response.status, parsed.error.code, parsed.error.details);
      }
      throw new ApiClientError(`Upload failed (${response.status})`, response.status);
    }
    return parsed as T;
  }
}
