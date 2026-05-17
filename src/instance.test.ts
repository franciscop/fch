import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import kv from "polystore";

import fch from "./index.js";
import { delay, fetchCalls, mockFetchOnce, resetFetch } from "./test-utils.js";

describe("fch.create()", () => {
  beforeEach(() => {
    resetFetch();
    // Reset global fch defaults
    fch.baseUrl = null;
    fch.baseURL = null;
    fch.headers = {};
    fch.query = {};
    fch.cache = null;
  });

  it("creates instance with custom baseUrl", async () => {
    mockFetchOnce("response from api");
    const api = fch.create({ baseUrl: "https://api.example.com" });

    const result = await api.get("/users");

    expect(result).toEqual("response from api");
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][0]).toEqual("https://api.example.com/users");
    expect(fetchCalls[0][1].method).toEqual("GET");
  });

  it("creates instance with custom baseURL", async () => {
    mockFetchOnce("response from api");
    const api = fch.create({ baseURL: "https://api.example.com" });

    const result = await api.get("/users");

    expect(result).toEqual("response from api");
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][0]).toEqual("https://api.example.com/users");
  });

  it("creates instance with custom headers", async () => {
    mockFetchOnce("authenticated response");
    const api = fch.create({
      headers: {
        Authorization: "Bearer token123",
        "X-Custom-Header": "custom-value",
      },
    });

    const result = await api.get("/protected");

    expect(result).toEqual("authenticated response");
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][1].headers).toEqual({
      authorization: "Bearer token123",
      "x-custom-header": "custom-value",
    });
  });

  it("creates instance with custom query params", async () => {
    mockFetchOnce("filtered results");
    const api = fch.create({
      query: { apiKey: "abc123", version: "v2" },
    });

    const result = await api.get("/data");

    expect(result).toEqual("filtered results");
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][0]).toEqual("/data?apiKey=abc123&version=v2");
  });

  it("ensures instance isolation - changing instance doesn't affect global", async () => {
    mockFetchOnce("from instance").once("from global");

    const api = fch.create({
      baseUrl: "https://api.example.com",
      headers: { "X-Instance": "true" },
    });

    // Make request with instance
    const instanceResult = await api.get("/users");

    // Make request with global fch
    const globalResult = await fch.get("/users");

    expect(instanceResult).toEqual("from instance");
    expect(globalResult).toEqual("from global");
    expect(fetchCalls.length).toEqual(2);

    // Instance request has baseUrl and custom header
    expect(fetchCalls[0][0]).toEqual("https://api.example.com/users");
    expect(fetchCalls[0][1].headers).toEqual({ "x-instance": "true" });

    // Global request has no baseUrl and no custom header
    expect(fetchCalls[1][0]).toEqual("/users");
    expect(fetchCalls[1][1].headers).toEqual({});
  });

  it("ensures instance isolation - changing global doesn't affect instance", async () => {
    mockFetchOnce("from instance").once("from global");

    const api = fch.create({
      baseUrl: "https://api.example.com",
      headers: { "X-Instance": "true" },
    });

    // Change global defaults
    fch.baseUrl = "https://global.example.com";
    fch.headers = { "X-Global": "true" };

    // Make request with instance (should use instance defaults)
    const instanceResult = await api.get("/users");

    // Make request with global (should use global defaults)
    const globalResult = await fch.get("/users");

    expect(instanceResult).toEqual("from instance");
    expect(globalResult).toEqual("from global");
    expect(fetchCalls.length).toEqual(2);

    // Instance request still has original baseUrl and headers
    expect(fetchCalls[0][0]).toEqual("https://api.example.com/users");
    expect(fetchCalls[0][1].headers).toEqual({ "x-instance": "true" });

    // Global request has new baseUrl and headers
    expect(fetchCalls[1][0]).toEqual("https://global.example.com/users");
    expect(fetchCalls[1][1].headers).toEqual({ "x-global": "true" });
  });

  it("inherits defaults from instance creation", async () => {
    mockFetchOnce(JSON.stringify({ user: "john" }), {
      headers: { "Content-Type": "application/json" },
    });

    const api = fch.create({
      baseUrl: "https://api.example.com",
      headers: { Authorization: "Bearer token" },
      query: { apiKey: "key123" },
    });

    // Make request without specifying anything
    const result = await api("/users");

    expect(result).toEqual({ user: "john" });
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][0]).toEqual(
      "https://api.example.com/users?apiKey=key123",
    );
    expect(fetchCalls[0][1].headers).toEqual({
      authorization: "Bearer token",
    });
  });

  it("allows overriding instance defaults in individual requests", async () => {
    mockFetchOnce("custom response");

    const api = fch.create({
      baseUrl: "https://api.example.com",
      headers: { Authorization: "Bearer token" },
      query: { apiKey: "key123" },
    });

    // Override all defaults in this request
    const result = await api("/users", {
      baseUrl: "https://other.example.com",
      headers: { Authorization: "Bearer other-token" },
      query: { apiKey: "other-key" },
    });

    expect(result).toEqual("custom response");
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][0]).toEqual(
      "https://other.example.com/users?apiKey=other-key",
    );
    expect(fetchCalls[0][1].headers).toEqual({
      authorization: "Bearer other-token",
    });
  });

  it("merges headers from instance and request", async () => {
    mockFetchOnce("merged headers response");

    const api = fch.create({
      headers: {
        Authorization: "Bearer token",
        "X-Instance-Header": "instance",
      },
    });

    const result = await api.get("/data", {
      headers: {
        "X-Request-Header": "request",
      },
    });

    expect(result).toEqual("merged headers response");
    expect(fetchCalls.length).toEqual(1);
    expect(fetchCalls[0][1].headers).toEqual({
      authorization: "Bearer token",
      "x-instance-header": "instance",
      "x-request-header": "request",
    });
  });

  it("merges query params from instance and request", async () => {
    mockFetchOnce("merged query response");

    const api = fch.create({
      query: { apiKey: "key123", version: "v2" },
    });

    const result = await api.get("/data", {
      query: { filter: "active" },
    });

    expect(result).toEqual("merged query response");
    expect(fetchCalls.length).toEqual(1);
    // Check that all query params are present (order doesn't matter)
    const url = fetchCalls[0][0];
    expect(url).toContain("apiKey=key123");
    expect(url).toContain("version=v2");
    expect(url).toContain("filter=active");
    expect(url).toStartWith("/data?");
  });

  it("creates nested instances", async () => {
    mockFetchOnce("v1 response").once("v2 response");

    const baseApi = fch.create({
      baseUrl: "https://api.example.com",
      headers: { Authorization: "Bearer token" },
    });

    // Creating instances from another instance - they don't inherit parent config
    // They just use the .create method, starting fresh with their own defaults
    const v1Api = baseApi.create({
      baseUrl: "https://api.example.com/v1/",
      headers: {
        Authorization: "Bearer token",
        "X-Version": "v1",
      },
    });

    const v2Api = baseApi.create({
      baseUrl: "https://api.example.com/v2/",
      headers: {
        Authorization: "Bearer token",
        "X-Version": "v2",
      },
    });

    const v1Result = await v1Api.get("users");
    const v2Result = await v2Api.get("users");

    expect(v1Result).toEqual("v1 response");
    expect(v2Result).toEqual("v2 response");
    expect(fetchCalls.length).toEqual(2);

    // v1 request
    expect(fetchCalls[0][0]).toEqual("https://api.example.com/v1/users");
    expect(fetchCalls[0][1].headers).toEqual({
      authorization: "Bearer token",
      "x-version": "v1",
    });

    // v2 request
    expect(fetchCalls[1][0]).toEqual("https://api.example.com/v2/users");
    expect(fetchCalls[1][1].headers).toEqual({
      authorization: "Bearer token",
      "x-version": "v2",
    });
  });

  it("creates instance with custom output option", async () => {
    mockFetchOnce("response text", {
      status: 200,
      headers: { "X-Custom": "header" },
    });

    const api = fch.create({ output: "response" });

    const result = await api.get("/data");

    expect(result.body).toEqual("response text");
    expect(result.status).toEqual(200);
    expect(result.headers["x-custom"]).toEqual("header");
  });

  it("creates instance with before interceptor", async () => {
    mockFetchOnce("intercepted response");

    const api = fch.create({
      before: (req) => {
        req.headers["x-intercepted"] = "true";
        return req;
      },
    });

    const result = await api.get("/data");

    expect(result).toEqual("intercepted response");
    expect(fetchCalls[0][1].headers["x-intercepted"]).toEqual("true");
  });

  it("creates instance with after interceptor", async () => {
    mockFetchOnce("original response");

    const api = fch.create({
      output: "response",
      after: (res) => {
        res.body = "modified response";
        return res;
      },
    });

    const result = await api.get("/data");

    expect(result.body).toEqual("modified response");
  });

  it("supports all HTTP methods on instance", async () => {
    mockFetchOnce("get")
      .once("head")
      .once("post")
      .once("put")
      .once("patch")
      .once("delete");

    const api = fch.create({ baseUrl: "https://api.example.com" });

    const get: string = await api.get("/users");
    const head: string = await api.head("/users");
    const post: string = await api.post("/users", { name: "John" });
    const put: string = await api.put("/users/1", { name: "Jane" });
    const patch: string = await api.patch("/users/1", { name: "Jack" });
    const del: string = await api.delete("/users/1");

    expect(get).toEqual("get");
    expect(head).toEqual("head");
    expect(post).toEqual("post");
    expect(put).toEqual("put");
    expect(patch).toEqual("patch");
    expect(del).toEqual("delete");

    expect(fetchCalls.length).toEqual(6);
    expect(fetchCalls[0][1].method).toEqual("GET");
    expect(fetchCalls[1][1].method).toEqual("HEAD");
    expect(fetchCalls[2][1].method).toEqual("POST");
    expect(fetchCalls[3][1].method).toEqual("PUT");
    expect(fetchCalls[4][1].method).toEqual("PATCH");
    expect(fetchCalls[5][1].method).toEqual("DELETE");
  });

  it("creates instance with baseUrl containing path", async () => {
    mockFetchOnce("api response");

    const api = fch.create({ baseUrl: "https://example.com/api/v1/" });

    const result = await api.get("/users");

    expect(result).toEqual("api response");
    expect(fetchCalls[0][0]).toEqual("https://example.com/api/v1/users");
  });

  it("creates instance with baseUrl containing path without trailing slash", async () => {
    mockFetchOnce("api response");

    const api = fch.create({ baseUrl: "https://example.com/api/v1" });

    const result = await api.get("/users");

    expect(result).toEqual("api response");
    expect(fetchCalls[0][0]).toEqual("https://example.com/api/v1/users");
  });

  it("creates multiple independent instances", async () => {
    mockFetchOnce("github").once("gitlab");

    const github = fch.create({
      baseUrl: "https://api.github.com",
      headers: { Authorization: "token github-token" },
    });

    const gitlab = fch.create({
      baseUrl: "https://gitlab.com/api/",
      headers: { Authorization: "Bearer gitlab-token" },
    });

    const githubResult = await github.get("/user");
    const gitlabResult = await gitlab.get("user");

    expect(githubResult).toEqual("github");
    expect(gitlabResult).toEqual("gitlab");

    // Verify independence
    expect(fetchCalls[0][0]).toEqual("https://api.github.com/user");
    expect(fetchCalls[0][1].headers.authorization).toEqual(
      "token github-token",
    );

    expect(fetchCalls[1][0]).toEqual("https://gitlab.com/api/user");
    expect(fetchCalls[1][1].headers.authorization).toEqual(
      "Bearer gitlab-token",
    );
  });

  describe("cache configuration", () => {
    let api: any;

    beforeAll(() => {
      const cache = kv(new Map());
      api = fch.create({ cache });
    });

    beforeEach(async () => {
      resetFetch();
      await api.cache.clear();
    });

    it("uses cache", async () => {
      mockFetchOnce("a").once("b");
      const resa = await api("/a");
      const resb = await api("/a");

      expect(resa).toEqual("a");
      expect(resb).toEqual("a");
      expect(fetchCalls.length).toEqual(1);
    });

    it("uses cache with api.get", async () => {
      mockFetchOnce("a").once("b");
      const resa = await api("/a");
      const resb = await api.get("/a");

      expect(resa).toEqual("a");
      expect(resb).toEqual("a");
      expect(fetchCalls.length).toEqual(1);
    });

    it("skips cache if too short", async () => {
      mockFetchOnce("a").once("b");
      const cache = kv(new Map()).expires("2ms");
      const shortApi = fch.create({ cache });
      const resa = await shortApi("/a");
      await delay(10);
      const resb = await shortApi("/a");

      expect(resa).toEqual("a");
      expect(resb).toEqual("b");
      expect(fetchCalls.length).toEqual(2);
    });

    it("skips cache when using different methods", async () => {
      mockFetchOnce("a").once("b");
      const resa = await api.post("/a");
      const resb = await api.post("/a");

      expect(resa).toEqual("a");
      expect(resb).toEqual("b");
      expect(fetchCalls.length).toEqual(2);
    });

    it("allows overriding cache store per request", async () => {
      mockFetchOnce("a").once("b");
      const perRequestCache = kv(new Map());
      const resa = await api("/a", { cache: perRequestCache });
      const resb = await api("/a", { cache: perRequestCache });

      expect(resa).toEqual("a");
      expect(resb).toEqual("a");
      expect(fetchCalls.length).toEqual(1);
    });

    it("can disable cache per request", async () => {
      mockFetchOnce("a").once("b");
      const resa = await api("/a", { cache: null });
      const resb = await api("/a", { cache: null });

      expect(resa).toEqual("a");
      expect(resb).toEqual("b");
      expect(fetchCalls.length).toEqual(2);
    });

    it("deduplicates concurrent requests to the same URL", async () => {
      mockFetchOnce("data");
      const [a, b] = await Promise.all([api("/url"), api("/url")]);

      expect(a).toEqual("data");
      expect(b).toEqual("data");
      expect(fetchCalls.length).toEqual(1);
    });
  });
});
