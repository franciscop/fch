import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import fch from "./index.js";
import {
  fetchCalls,
  fetchMock,
  jsonHeaders,
  mockFetchOnce,
  resetFetch,
} from "./test-utils.js";

const sent = () => fetchCalls[0][1];

describe("edge cases", () => {
  beforeEach(() => {
    resetFetch();
    fch.cache = null;
    fch.baseUrl = null;
    fch.baseURL = null;
  });

  afterEach(() => {
    if (fetchMock) fetchMock.mockRestore();
  });

  it("returns null for an empty body with a JSON content type", async () => {
    mockFetchOnce(new Response(null, { status: 204, ...jsonHeaders }));
    expect(await fch.delete<null>("/")).toBe(null);
  });

  it("returns null for a HEAD against a JSON endpoint", async () => {
    mockFetchOnce(new Response(null, jsonHeaders));
    expect(await fch.head<null>("/")).toBe(null);
  });

  it("still returns an empty string for an empty text body", async () => {
    mockFetchOnce(new Response(""));
    expect(await fch.get<string>("/")).toBe("");
  });

  it("sets duplex for a ReadableStream body", async () => {
    mockFetchOnce("ok");
    await fch.post("/", new Response("hi").body!);
    expect(sent().duplex).toBe("half");
  });

  it("sets duplex for a Node stream body", async () => {
    mockFetchOnce("ok");
    const nodeish = { pipe: () => {} };
    await fch.post("/", nodeish as any);
    expect(sent().duplex).toBe("half");
  });

  it("does not set duplex for other bodies", async () => {
    mockFetchOnce("ok");
    await fch.post("/", { a: 1 });
    expect(sent().duplex).toBe(undefined);
  });

  it("lets a per-call baseURL override the instance baseUrl", async () => {
    mockFetchOnce("ok");
    const api = fch.create({ baseUrl: "https://a.com/" });
    await api.get("x", { baseURL: "https://b.com/" });
    expect(fetchCalls[0][0]).toBe("https://b.com/x");
  });

  it("lets a per-call baseUrl override the instance baseURL", async () => {
    mockFetchOnce("ok");
    const api = fch.create({ baseURL: "https://a.com/" });
    await api.get("x", { baseUrl: "https://b.com/" });
    expect(fetchCalls[0][0]).toBe("https://b.com/x");
  });

  it("can read other outputs after a custom output consumed the body", async () => {
    mockFetchOnce(new Response(JSON.stringify({ a: 1 }), jsonHeaders));
    const result = fch.get("/", { output: "json" });
    expect(await result).toEqual({ a: 1 });
    expect(await result.text()).toBe(JSON.stringify({ a: 1 }));
  });

  it("strips the fragment from the url", async () => {
    mockFetchOnce("ok");
    await fch.get("/p?a=1#frag");
    expect(fetchCalls[0][0]).toBe("/p?a=1");
  });

  it("keeps a literal ? inside a query value", async () => {
    mockFetchOnce("ok");
    await fch.get("/p?a=b?c");
    expect(fetchCalls[0][0]).toBe("/p?a=b%3Fc");
  });
});
