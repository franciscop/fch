import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import fch from "./index.js";
import { fetchCalls, fetchMock, mockFetchOnce, resetFetch } from "./test-utils.js";

const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

const sent = () => fetchCalls[0][1];

describe("binary and native request bodies", () => {
  beforeEach(() => {
    resetFetch();
    fch.cache = null;
    fch.baseUrl = null;
    fch.baseURL = null;
  });

  afterEach(() => {
    if (fetchMock) fetchMock.mockRestore();
  });

  it("passes a Uint8Array through untouched", async () => {
    mockFetchOnce("ok");
    await fch.put("/", bytes);
    expect(sent().body).toBe(bytes);
    expect(sent().headers["content-type"]).toBe(undefined);
  });

  it("passes an ArrayBuffer through untouched", async () => {
    mockFetchOnce("ok");
    await fch.put("/", bytes.buffer);
    expect(sent().body).toBe(bytes.buffer);
    expect(sent().headers["content-type"]).toBe(undefined);
  });

  it("passes a DataView through untouched", async () => {
    mockFetchOnce("ok");
    const view = new DataView(bytes.buffer);
    await fch.put("/", view);
    expect(sent().body).toBe(view);
  });

  it("passes a Blob through and keeps its own type", async () => {
    mockFetchOnce("ok");
    const blob = new Blob([bytes], { type: "image/png" });
    await fch.put("/", blob);
    expect(sent().body).toBe(blob);
    expect(sent().headers["content-type"]).toBe(undefined);
  });

  it("passes a File through untouched", async () => {
    mockFetchOnce("ok");
    const file = new File([bytes], "a.png", { type: "image/png" });
    await fch.post("/", file);
    expect(sent().body).toBe(file);
  });

  it("passes URLSearchParams through untouched", async () => {
    mockFetchOnce("ok");
    const params = new URLSearchParams({ a: "1", b: "2" });
    await fch.post("/", params);
    expect(sent().body).toBe(params);
    expect(sent().headers["content-type"]).toBe(undefined);
  });

  it("does not corrupt the bytes actually delivered", async () => {
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const buf = new Uint8Array(await req.arrayBuffer());
        return Response.json({
          type: req.headers.get("content-type"),
          bytes: [...buf],
        });
      },
    });
    try {
      const url = `http://localhost:${server.port}/`;
      const raw = await fch.put<any>(url, bytes);
      expect(raw.bytes).toEqual([...bytes]);

      const blob = await fch.put<any>(
        url,
        new Blob([bytes], { type: "image/png" }),
      );
      expect(blob.bytes).toEqual([...bytes]);
      expect(blob.type).toBe("image/png");

      const form = await fch.put<any>(url, new URLSearchParams({ a: "1" }));
      expect(String.fromCharCode(...form.bytes)).toBe("a=1");
      expect(form.type).toStartWith("application/x-www-form-urlencoded");
    } finally {
      server.stop(true);
    }
  });

  it("still serializes plain objects and arrays as JSON", async () => {
    mockFetchOnce("ok");
    await fch.post("/", { a: 1 });
    expect(sent().body).toBe(JSON.stringify({ a: 1 }));
    expect(sent().headers["content-type"]).toBe("application/json");

    resetFetch();
    mockFetchOnce("ok");
    await fch.post("/", [1, 2]);
    expect(sent().body).toBe(JSON.stringify([1, 2]));
    expect(sent().headers["content-type"]).toBe("application/json");
  });

  it("does not mutate the object it serializes", async () => {
    mockFetchOnce("ok");
    const body = { a: 1, b: undefined };
    await fch.post("/", body);
    expect(sent().body).toBe(JSON.stringify({ a: 1 }));
    expect("b" in body).toBe(true);
  });
});
