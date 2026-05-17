import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import fch from "./index.js";
import {
  fetchCalls,
  fetchMock,
  mockFetchOnce,
  resetFetch,
  textHeaders,
} from "./test-utils.js";

describe("HTTP method shortcuts", () => {
  beforeEach(() => {
    resetFetch();
    fch.cache = null;
    fch.baseUrl = null;
    fch.baseURL = null;
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
  });

  it("can use the `fetch.get()` shorthand", async () => {
    mockFetchOnce("my-data");
    const body = await fch.get("/");
    expect(body).toBe("my-data");
    expect(fetchCalls[0][1].method).toEqual("GET");
  });

  it("can use the `fetch.head()` shorthand", async () => {
    mockFetchOnce("my-data");
    const body = await fch.head("/");
    expect(body).toBe("my-data");
    expect(fetchCalls[0][1].method).toEqual("HEAD");
  });

  it("can use the `fetch.patch()` shorthand", async () => {
    mockFetchOnce("my-data");
    expect(
      await fch.patch<string>("/", { hello: "world" }, { headers: { a: "b" } }),
    ).toBe("my-data");
    expect(fetchCalls[0][1].method).toEqual("PATCH");
    expect(fetchCalls[0][1].body).toEqual(JSON.stringify({ hello: "world" }));
    expect(fetchCalls[0][1].headers.a).toEqual("b");
  });

  it("can use the `fetch.put()` shorthand", async () => {
    mockFetchOnce("my-data");
    expect(
      await fch.put<string>("/", { hello: "world" }, { headers: { a: "b" } }),
    ).toBe("my-data");
    expect(fetchCalls[0][1].method).toEqual("PUT");
    expect(fetchCalls[0][1].body).toEqual(JSON.stringify({ hello: "world" }));
    expect(fetchCalls[0][1].headers.a).toEqual("b");
  });

  it("can use the `fetch.post()` shorthand", async () => {
    mockFetchOnce("my-data");
    expect(
      await fch.post<string>("/", { hello: "world" }, { headers: { a: "b" } }),
    ).toBe("my-data");
    expect(fetchCalls[0][1].method).toEqual("POST");
    expect(fetchCalls[0][1].body).toEqual(JSON.stringify({ hello: "world" }));
    expect(fetchCalls[0][1].headers.a).toEqual("b");
  });

  it("can use the `fetch.delete()` shorthand", async () => {
    mockFetchOnce("my-data");
    expect(await fch.delete<string>("/")).toBe("my-data");
    expect(fetchCalls[0][1].method).toEqual("DELETE");
  });

  it("can send a body with DELETE via options", async () => {
    mockFetchOnce("deleted", textHeaders);
    await fch.delete("/resource", { body: { reason: "test" } });
    expect(fetchCalls[0][1].method).toEqual("DELETE");
    expect(fetchCalls[0][1].body).toEqual('{"reason":"test"}');
  });

  it("fch.del is an alias for fch.delete", async () => {
    mockFetchOnce("deleted");
    await fch.del("/resource");
    expect(fetchCalls[0][1].method).toEqual("DELETE");
  });

  it("sends methods in uppercase to fetch()", async () => {
    mockFetchOnce("a").once("b").once("c").once("d").once("e").once("f");

    await fch.get("/");
    await fch.head("/");
    await fch.post("/", {});
    await fch.put("/", {});
    await fch.patch("/", {});
    await fch.delete("/");

    expect(fetchCalls[0][1].method).toEqual("GET");
    expect(fetchCalls[1][1].method).toEqual("HEAD");
    expect(fetchCalls[2][1].method).toEqual("POST");
    expect(fetchCalls[3][1].method).toEqual("PUT");
    expect(fetchCalls[4][1].method).toEqual("PATCH");
    expect(fetchCalls[5][1].method).toEqual("DELETE");
  });
});
