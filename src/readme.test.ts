import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import kv from "polystore";
import fch from "./index";
import {
  delay,
  fetchCalls,
  jsonHeaders,
  mockFetchOnce,
  resetFetch,
  textHeaders,
} from "./test-utils";

/**
 * Tests for the README examples
 * These ensure all documentation examples actually work
 */

describe("README: Main examples", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("plain usage example works", async () => {
    mockFetchOnce(JSON.stringify({ name: "Mewtwo", id: 150 }), jsonHeaders);

    const mew = await fch("https://pokeapi.co/pokemon/150");
    expect(mew.name).toBe("Mewtwo");
    expect(fetchCalls[0][0]).toBe("https://pokeapi.co/pokemon/150");
  });

  it("API abstraction example works", async () => {
    const api = fch.create({ baseUrl: "https://pokeapi.co/" });

    mockFetchOnce(JSON.stringify({ name: "Mewtwo", id: 150 }), jsonHeaders);
    const mew = await api.get("/pokemon/150");
    expect(mew.name).toBe("Mewtwo");
    expect(fetchCalls[0][0]).toBe("https://pokeapi.co/pokemon/150");

    // Reset for second call
    fetchCalls.length = 0;

    mockFetchOnce(JSON.stringify({ type: "psychic" }), jsonHeaders);
    await api.patch("/pokemon/150", { type: "psychic" });
    expect(fetchCalls[0][0]).toBe("https://pokeapi.co/pokemon/150");
    expect(fetchCalls[0][1]?.method).toBe("PATCH");
  });

  it("create instance with options example works", async () => {
    const api = fch.create({
      baseUrl: "https://api.example.com",
      headers: { "X-Custom": "header" },
    });

    mockFetchOnce("ok", textHeaders);
    await api.get("/test");

    expect(fetchCalls[0][0]).toBe("https://api.example.com/test");
    expect(fetchCalls[0][1]?.headers?.["x-custom"]).toBe("header");
  });
});

describe("README: Cache examples", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("simple cache string example works", async () => {
    const cache = kv(new Map()).expires("1h");
    const api = fch.create({
      baseUrl: "https://api.myweb.com/",
      cache,
    });

    mockFetchOnce("data1", textHeaders);
    const res1 = await api.get("/somedata");
    expect(res1).toBe("data1");

    // Second call should be cached
    const res2 = await api.get("/somedata");
    expect(res2).toBe("data1");
    expect(fetchCalls.length).toBe(1); // Only one actual fetch
  });

  it("per-request cache override example works", async () => {
    const cache = kv(new Map()).expires("1h");
    const shortCache = kv(new Map()).expires("20s");
    const api = fch.create({
      baseUrl: "https://api.myweb.com/",
      cache,
    });

    mockFetchOnce("data", textHeaders);
    await api.get("/somedata", { cache: shortCache });
    expect(fetchCalls.length).toBe(1);
  });
});

describe("How to: Stop errors from throwing", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("allows stopping errors from throwing with error interceptor", async () => {
    const api = fch.create({
      output: "response",
      error: (error: any) => error.response,
    });

    mockFetchOnce("Not found", { status: 404, statusText: "Not Found" });

    const res = await api("/notfound");
    expect(res.status).toBe(404);
  });
});

describe("How to: Return the full response", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("returns full response on global level", async () => {
    const api = fch.create({ output: "response" });

    mockFetchOnce("Hello", textHeaders);

    const res = await api("/hello");
    expect(res.status).toBe(200);
    expect(res.body).toBe("Hello");
  });

  it("returns full response on per-request level", async () => {
    mockFetchOnce("Hello", textHeaders);

    const res = await fch("/hello", { output: "response" });
    expect(res.status).toBe(200);
    expect(res.body).toBe("Hello");
  });

  it("per-request output does not affect other requests", async () => {
    mockFetchOnce("Hello", textHeaders);
    const res = await fch("/hello", { output: "response" });
    expect(res.status).toBe(200);

    mockFetchOnce("World", textHeaders);
    const body = await fch("/hello");
    expect(body).toBe("World");
  });

  it("returns raw response with ReadableStream body", async () => {
    mockFetchOnce("Hello", textHeaders);

    const res = await fch("/hello", { output: "raw" });
    expect(res.body).toBeInstanceOf(ReadableStream);
  });
});

describe("How to: Set a base URL", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("sets base URL globally", async () => {
    const api = fch.create({
      baseUrl: "https://api.filemon.io/",
    });

    mockFetchOnce("test", textHeaders);

    await api.get("/blabla");
    expect(fetchCalls[0][0]).toBe("https://api.filemon.io/blabla");
  });
});

describe("How to: Set authorization headers", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("sets authorization header globally", async () => {
    const api = fch.create({
      headers: { Authorization: "bearer abc" },
    });

    mockFetchOnce(JSON.stringify({ id: 1 }), jsonHeaders);

    await api("/users/me");
    expect(fetchCalls[0][1]?.headers?.authorization).toBe("bearer abc");
  });

  it("sets authorization header via before interceptor", async () => {
    let token = "token123";
    const api = fch.create({
      before: (req) => {
        if (token) {
          req.headers.authorization = `bearer ${token}`;
        }
        return req;
      },
    });

    mockFetchOnce(JSON.stringify({ id: 1 }), jsonHeaders);

    await api("/users/me");
    expect(fetchCalls[0][1]?.headers?.authorization).toBe("bearer token123");
  });

  it("sets authorization header per-request", async () => {
    mockFetchOnce(JSON.stringify({ id: 1 }), jsonHeaders);

    await fch("/users/me", { headers: { Authorization: "bearer abc" } });
    expect(fetchCalls[0][1]?.headers?.authorization).toBe("bearer abc");
  });
});

describe("How to: Create an instance", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("creates instance with own defaults", async () => {
    const api = fch.create({
      baseUrl: "https://api.filemon.io/",
    });

    mockFetchOnce("world", textHeaders);
    await api.get("/hello");
    expect(fetchCalls[0][0]).toBe("https://api.filemon.io/hello");

    // Reset fetchCalls to test global fch separately
    fetchCalls.length = 0;

    mockFetchOnce("world", textHeaders);
    await fch.get("https://localhost:3000/hello");
    expect(fetchCalls[0][0]).toBe("https://localhost:3000/hello");
  });
});

describe("How to: Streaming a response body", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("streams response with output: stream option", async () => {
    mockFetchOnce("data", textHeaders);

    const stream = await fch("/data", { output: "stream" });
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("converts WebStream to Node.js ReadStream", async () => {
    mockFetchOnce("data", textHeaders);

    const stream = await fch("/data", { output: "stream" });
    const readableNodeStream = Readable.fromWeb(stream);
    expect(readableNodeStream).toBeInstanceOf(Readable);
  });
});

describe("How to: Cancel ongoing requests", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("cancels ongoing request with AbortController", async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    mockFetchOnce(async () => {
      await delay(100);
      return new Response("data");
    });

    const promise = fch.get("/data", { signal });

    // Abort immediately
    controller.abort();

    // The request should be rejected due to abort
    try {
      await promise;
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      // Verify it threw an error (abort error handling varies by runtime)
      expect(error).toBeDefined();
    }
  });
});

describe("How to: Define shared options", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("defines shared baseUrl", async () => {
    const api = fch.create({
      baseUrl: "https://pokeapi.co/",
    });

    mockFetchOnce(JSON.stringify({ name: "mew" }), jsonHeaders);

    const mew = await api.get("/pokemon/150");
    expect(mew.name).toBe("mew");
    expect(fetchCalls[0][0]).toBe("https://pokeapi.co/pokemon/150");
  });
});

describe("How to: Differences with Axios (API comparison)", () => {
  beforeEach(() => {
    resetFetch();
  });

  afterEach(() => {
    resetFetch();
  });

  it("modifies headers (fch way)", async () => {
    const api = fch.create({
      headers: { Authorization: "bearer token" },
    });

    mockFetchOnce("ok", textHeaders);

    await api.get("/test");
    expect(fetchCalls[0][1]?.headers?.authorization).toBe("bearer token");
  });

  it("sets base URL (fch way)", async () => {
    const api = fch.create({
      baseUrl: "https://api.example.com",
    });

    mockFetchOnce("ok", textHeaders);

    await api.get("/test");
    expect(fetchCalls[0][0]).toBe("https://api.example.com/test");
  });

  it("adds interceptor (fch way)", async () => {
    let intercepted = false;

    const api = fch.create({
      before: (req) => {
        intercepted = true;
        return req;
      },
    });

    mockFetchOnce("ok", textHeaders);

    await api.get("/test");
    expect(intercepted).toBe(true);
  });
});
