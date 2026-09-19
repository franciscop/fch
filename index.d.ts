export type Store = {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: any, options?: any) => Promise<unknown>;
    del: (key: string) => Promise<unknown>;
    has?: (key: string) => Promise<boolean>;
    clear?: () => Promise<unknown>;
};
type Headers = {
    [name: string]: string;
};
export type Query = {
    [name: string]: string;
};
export type Methods = "get" | "head" | "post" | "patch" | "put" | "delete" | "GET" | "HEAD" | "POST" | "PATCH" | "PUT" | "DELETE";
type Body = string | unknown[] | {
    [key: string]: unknown;
} | FormData | URLSearchParams | Blob | ArrayBuffer | ArrayBufferView | HTMLFormElement | SubmitEvent | ReadableStream;
export type FchError = Error & {
    response?: Response;
};
export type FchRequest = Omit<RequestInit, "body" | "headers" | "method"> & {
    url: string;
    method: string;
    headers: Headers;
    body?: BodyInit | null;
    duplex?: "half";
};
export type FchResponse = {
    status: number;
    statusText: string;
    headers: Headers;
    body: unknown;
};
export type FchResult<T = unknown> = {
    then<R1 = T, R2 = never>(onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null): Promise<R1 | R2>;
    catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | null): Promise<T | R>;
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
export type Options = Omit<RequestInit, "body" | "cache" | "headers" | "method"> & {
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
export interface FchInstance {
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
declare function create(defaults?: Options): FchInstance;
export { create };
declare const _default: FchInstance;
export default _default;
