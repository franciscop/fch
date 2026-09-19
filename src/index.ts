// Type definitions
type Store = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: any, options?: any) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
  has?: (key: string) => Promise<boolean>;
  clear?: () => Promise<unknown>;
};

type Headers = { [name: string]: string };
type Query = { [name: string]: string };
type Methods =
  | "get"
  | "head"
  | "post"
  | "patch"
  | "put"
  | "delete"
  | "GET"
  | "HEAD"
  | "POST"
  | "PATCH"
  | "PUT"
  | "DELETE";
type Body =
  | string
  | unknown[]
  | { [key: string]: unknown }
  | FormData
  | URLSearchParams
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | HTMLFormElement
  | SubmitEvent
  | ReadableStream;

type FchError = Error & { response?: Response };

type FchRequest = Omit<RequestInit, "body" | "headers" | "method"> & {
  url: string;
  method: string;
  headers: Headers;
  body?: BodyInit | null;
  duplex?: "half";
};

type FchResponse = {
  status: number;
  statusText: string;
  headers: Headers;
  body: unknown;
};

type FchResult<T = unknown> = {
  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2>;
  catch<R = never>(
    onrejected?: ((reason: any) => R | PromiseLike<R>) | null,
  ): Promise<T | R>;
  finally(onfinally?: (() => void) | null): Promise<T>;
  text(): Promise<string>;
  json<R = unknown>(): Promise<R>;
  blob(): Promise<Blob>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<FormData>;
  body<R = unknown>(): Promise<R>;
  stream(): Promise<ReadableStream | null>;
  raw(): Promise<Response>;
  clone(): Promise<Response>;
  response(): Promise<FchResponse>;
};

type Options = Omit<RequestInit, "body" | "cache" | "headers" | "method"> & {
  url?: string;
  method?: Methods;
  query?: Query;
  headers?: Headers;
  baseUrl?: string;
  baseURL?: string;
  body?: Body;
  cache?: Store | null;
  output?: string;
  duplex?: "half";
  before?: (req: FchRequest) => FchRequest | Promise<FchRequest>;
  after?: (res: FchResponse) => FchResponse | Promise<FchResponse>;
  error?: (error: FchError) => any;
};

interface FchInstance {
  <T = any>(url?: string, options?: Options): FchResult<T>;
  create: (options?: Options) => FchInstance;
  get: <T = any>(url: string, options?: Options) => FchResult<T>;
  head: <T = any>(url: string, options?: Options) => FchResult<T>;
  post: <T = any>(url: string, body?: Body, options?: Options) => FchResult<T>;
  patch: <T = any>(url: string, body?: Body, options?: Options) => FchResult<T>;
  put: <T = any>(url: string, body?: Body, options?: Options) => FchResult<T>;
  delete: <T = any>(url: string, options?: Options) => FchResult<T>;
  del: <T = any>(url: string, options?: Options) => FchResult<T>;
  url: string;
  method: Methods;
  query: Query;
  headers: Headers;
  baseUrl: string | null;
  baseURL: string | null;
  cache?: Store | null;
  output: string;
  credentials: RequestCredentials;
  before?: (req: FchRequest) => FchRequest | Promise<FchRequest>;
  after?: (res: FchResponse) => FchResponse | Promise<FchResponse>;
  error?: (error: FchError) => any;
}

// Anything fetch() can serialize natively is passed straight through
const isNativeBody = (body: object): boolean => {
  if (body instanceof FormData) return true;
  if (body instanceof URLSearchParams) return true;
  if (body instanceof Blob) return true;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return true;
  if (body instanceof ReadableStream) return true;
  // Node streams
  return typeof (body as Record<string, unknown>)["pipe"] === "function";
};

const isStreamBody = (body: unknown): boolean =>
  !!body &&
  typeof body === "object" &&
  (body instanceof ReadableStream ||
    typeof (body as Record<string, unknown>)["pipe"] === "function");

const hasObjectBody = (body: Body | null | undefined): boolean => {
  if (!body) return false;
  if (typeof body !== "object") return false;
  return !isNativeBody(body);
};

const noUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj;
  const copy: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) copy[key] = obj[key];
  }
  return copy;
};

class ResponseError extends Error {
  response: Response;

  constructor(response: Response) {
    const message = "Error " + response.status;
    super(message);
    this.response = response;
    this.message = message;
  }
}

const createUrl = (url: string, query: Query, base: string | null): string => {
  const hashIndex = url.indexOf("#");
  if (hashIndex !== -1) url = url.slice(0, hashIndex);
  const queryIndex = url.indexOf("?");
  let path = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const urlQuery = queryIndex === -1 ? "" : url.slice(queryIndex + 1);

  const entries = new URLSearchParams(
    Object.fromEntries([
      ...new URLSearchParams(noUndefined(query) as Record<string, string>),
      ...new URLSearchParams(urlQuery),
    ]),
  ).toString();
  if (entries) {
    path = path + "?" + entries;
  }

  if (!base) return path!;
  const fullUrl = new URL(
    path!.replace(/^\//, ""),
    base.replace(/\/$/, "") + "/",
  );
  return fullUrl.href;
};

const createHeaders = (raw: Headers): Headers => {
  const headers: Headers = {};
  for (const [key, value] of Object.entries(raw)) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
};

const getBody = async (res: Response): Promise<unknown> => {
  const type = res.headers.get("content-type");
  const isJson = type && type.includes("application/json");
  const text = await res.clone().text();
  if (!isJson) return text;
  // 204 and HEAD responses carry a JSON type but no body
  return text ? JSON.parse(text) : null;
};

const parseResponse = async (res: Response): Promise<FchResponse> => {
  const response: FchResponse = {
    status: res.status,
    statusText: res.statusText,
    headers: {},
    body: undefined,
  };

  res.headers.forEach((value, key) => {
    response.headers[key.toLowerCase()] = value;
  });

  if (!res.ok) {
    throw new ResponseError(res);
  }

  response.body = await getBody(res);

  return response;
};

function create(defaults: Options = {}): FchInstance {
  const ongoing: Record<string, Promise<unknown>> = {};

  const fch = function <T = any>(
    url: string = "/",
    options: Options = {},
  ): FchResult<T> {
    let {
      output,
      before,
      after,
      error,
      cache,
      ...request
    } = { ...fch, ...options } as any;

    request.url = createUrl(
      url,
      { ...fch.query, ...options.query },
      options.baseUrl ?? options.baseURL ?? fch.baseUrl ?? fch.baseURL,
    );
    request.method = (request.method || "GET").toUpperCase();
    request.headers = createHeaders({ ...fch.headers, ...options.headers });

    if (
      (typeof SubmitEvent !== "undefined" &&
        request.body instanceof SubmitEvent) ||
      (typeof HTMLFormElement !== "undefined" &&
        request.body instanceof HTMLFormElement)
    ) {
      request.body = new FormData(request.body);
    }

    if (hasObjectBody(request.body)) {
      request.body = JSON.stringify(noUndefined(request.body));
      if (!request.headers["content-type"]) {
        request.headers["content-type"] = "application/json";
      }
    }

    // Node requires this for any streamed request body
    if (isStreamBody(request.body) && !request.duplex) {
      request.duplex = "half";
    }

    // Lazy, memoized raw fetch — shared across all output methods
    let responseProm: Promise<Response> | null = null;
    const getResponse = (): Promise<Response> => {
      if (!responseProm) {
        const req: Promise<FchRequest> = before
          ? Promise.resolve(before(request as FchRequest))
          : Promise.resolve(request as FchRequest);
        responseProm = req.then((r) => {
          r.method = r.method.toUpperCase();
          return fetch(r.url, r);
        });
      }
      return responseProm;
    };

    // Process raw response according to the output mode
    const process = async (res: Response): Promise<T> => {
      if (res.ok && output === "stream") return res.body as T;

      if (
        res.ok &&
        (res as unknown as Record<string, unknown>)[output] &&
        typeof (res as unknown as Record<string, unknown>)[output] === "function"
      ) {
        const clone = res.clone() as unknown as Record<string, () => unknown>;
        return clone[output]!() as T;
      }

      const response = await after(await parseResponse(res));

      if (output === "body") return response.body as T;
      if (output === "response") return response as T;
      if (output === "raw") return res.clone() as T;
      throw new Error(`Invalid option output="${output}"`);
    };

    // Memoized default promise — respects cache and in-flight deduplication
    let defaultProm: Promise<T> | null = null;
    const getDefault = (): Promise<T> => {
      if (defaultProm) return defaultProm;

      if (!cache || request.method !== "GET") {
        defaultProm = getResponse().then(process).catch(error);
        return defaultProm;
      }

      const key = `${request.method}:${request.url}`;
      defaultProm = (async (): Promise<T> => {
        const cached = await cache.get(key);
        if (cached) return cached as T;

        if (ongoing[key]) return ongoing[key] as Promise<T>;

        try {
          ongoing[key] = getResponse().then(process);
          const result = await ongoing[key];
          await cache.set(key, result);
          return result as T;
        } finally {
          delete ongoing[key];
        }
      })().catch(error);

      return defaultProm;
    };

    // Helper for output methods: checks ok, clones, applies error handler
    const via = <R>(fn: (res: Response) => Promise<R>): Promise<R> =>
      getResponse()
        .then((res) => {
          if (!res.ok) throw new ResponseError(res);
          return fn(res.clone());
        })
        .catch(error);

    return {
      then(onfulfilled?: any, onrejected?: any) {
        return getDefault().then(onfulfilled, onrejected);
      },
      catch(onrejected?: any) {
        return getDefault().catch(onrejected);
      },
      finally(onfinally?: any) {
        return getDefault().finally(onfinally);
      },
      text: () => via((res) => res.text()),
      json: <R = unknown>() => via((res) => res.json()) as Promise<R>,
      blob: () => via((res) => res.blob()),
      arrayBuffer: () => via((res) => res.arrayBuffer()),
      formData: () => via((res) => res.formData()),
      body: <R = unknown>() => via((res) => getBody(res)) as Promise<R>,
      stream: () => via(async (res) => res.body),
      raw: () => via(async (res) => res),
      clone: () => via(async (res) => res),
      response: () =>
        getResponse()
          .then(async (res) => after(await parseResponse(res)))
          .catch(error) as Promise<FchResponse>,
    } as FchResult<T>;
  } as unknown as FchInstance;

  fch.url = defaults.url ?? "/";
  fch.method = (defaults.method ?? "get") as Methods;
  fch.query = defaults.query ?? {};
  fch.headers = defaults.headers ?? {};
  fch.baseUrl = defaults.baseUrl ?? defaults.baseURL ?? null;
  fch.baseURL = defaults.baseUrl ?? defaults.baseURL ?? null;
  fch.cache = defaults.cache;
  fch.output = defaults.output ?? "body";
  fch.credentials = defaults.credentials ?? "include";
  fch.before = defaults.before ?? ((req) => req);
  fch.after = defaults.after ?? ((res) => res);
  fch.error = defaults.error ?? ((err: Error) => Promise.reject(err));

  fch.get = <T = any>(url: string, opts?: Options) =>
    fch<T>(url, { method: "get", ...opts });
  fch.head = <T = any>(url: string, opts?: Options) =>
    fch<T>(url, { method: "head", ...opts });
  fch.post = <T = any>(url: string, body?: Body, opts?: Options) =>
    fch<T>(url, { method: "post", body, ...opts });
  fch.patch = <T = any>(url: string, body?: Body, opts?: Options) =>
    fch<T>(url, { method: "patch", body, ...opts });
  fch.put = <T = any>(url: string, body?: Body, opts?: Options) =>
    fch<T>(url, { method: "put", body, ...opts });
  fch.delete = <T = any>(url: string, opts?: Options) =>
    fch<T>(url, { method: "delete", ...opts });
  fch.del = fch.delete;
  fch.create = create;

  return fch;
}

if (typeof window !== "undefined") {
  (window as any).fch = create();
}

export { create };
export default create();
