import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import fch from "./index.js";

const jsonType: string = "application/json";
const jsonHeaders: { headers: { "Content-Type": string } } = {
  headers: { "Content-Type": jsonType },
};
const textHeaders: { headers: { "Content-Type": string } } = {
  headers: { "Content-Type": "text/plain" },
};

// Mock fetch globally
let fetchMock: any;
let fetchCalls: any[] = [];

async function normalizeResponse(response: any, args: any): Promise<Response> {
  if (typeof response === "function") {
    const result = await response(...args);
    return normalizeResponse(result, args);
  }
  if (typeof response === "string") {
    return new Response(response);
  }
  if (response instanceof Response) {
    return response;
  }
  if (response instanceof FormData) {
    // FormData needs to be passed directly to Response constructor
    return new Response(response);
  }
  if (response && typeof response === "object" && response.body !== undefined) {
    // Handle { body: ..., status: ..., headers: ... } format
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  if (response instanceof Error) {
    throw response;
  }
  return new Response(String(response));
}

function mockFetchOnce(response: any, init?: ResponseInit): any {
  // If init is provided, wrap response in Response object with init options
  if (init && typeof response === "string") {
    response = new Response(response, init);
  }

  const responses: any[] = [response];
  let callCount = 0;
  fetchCalls = [];
  fetchMock = (spyOn(global, "fetch") as any).mockImplementation(
    async (...args: any[]) => {
      fetchCalls.push(args);
      const resp = responses[callCount] || responses[responses.length - 1];
      callCount++;
      return normalizeResponse(resp, args);
    },
  );

  // Return an object that supports chaining .once()
  return {
    once(nextResponse: any, nextInit?: ResponseInit) {
      if (nextInit && typeof nextResponse === "string") {
        responses.push(new Response(nextResponse, nextInit));
      } else {
        responses.push(nextResponse);
      }
      return this;
    },
  };
}

describe("output option", () => {
  beforeEach(() => {});

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    fetchCalls = [];
  });

  it("output=body can parse TEXT", async () => {
    mockFetchOnce("12345", textHeaders);
    const body = await fch("/", { output: "body" });

    expect(body).toEqual("12345");
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=body can parse JSON", async () => {
    mockFetchOnce(JSON.stringify({ secret: "12345" }), jsonHeaders);
    const body = await fch("/", { output: "body" });

    expect(body).toEqual({ secret: "12345" });
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=text can parse plain text", async () => {
    mockFetchOnce("hiii");
    const body = await fch("/", { output: "text" });

    expect(body).toEqual("hiii");
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=json can parse plain json", async () => {
    mockFetchOnce(JSON.stringify({ a: "b" }));
    const body = await fch("/", { output: "json" });

    expect(body).toEqual({ a: "b" });
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=blob can parse blobs", async () => {
    mockFetchOnce("hello");
    const body = await fch("/", { output: "blob" });

    // expect(body).toBeInstanceOf(Blob);
    expect(await body.text()).toEqual("hello");
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=arrayBuffer returns an arrayBuffer", async () => {
    mockFetchOnce(new ArrayBuffer(8));
    const body = await fch("/", { output: "arrayBuffer" });
    expect(body instanceof ArrayBuffer).toBe(true);
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=formData returns a FormData instance", async () => {
    const formData = new FormData();
    formData.append("test", "value");
    mockFetchOnce(formData);
    const body = await fch("/", { output: "formData" });
    expect(body instanceof FormData).toBe(true);
    expect(body.get("test")).toBe("value");
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=response returns the processed response+body", async () => {
    mockFetchOnce("hello");
    const res = await (fch("/") as any).response();
    expect(res.body).toBe("hello");
    expect(res.status).toBe(200);
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=raw returns the raw response+body", async () => {
    mockFetchOnce("hello");
    const res = await fch("/", { output: "raw" });
    expect(res.body instanceof ReadableStream).toBe(true);
    expect(fetchCalls.length).toEqual(1);
  });

  it("output=clone returns the raw response+body", async () => {
    mockFetchOnce("hello");
    const res = await fch("/", { output: "clone" });
    expect(res.body instanceof ReadableStream).toBe(true);
    expect(fetchCalls.length).toEqual(1);
  });
});

describe("output methods", () => {
  beforeEach(() => {});

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    fetchCalls = [];
  });

  it(".body() can parse JSON", async () => {
    mockFetchOnce(JSON.stringify({ secret: "12345" }), jsonHeaders);
    const body = await (fch("/") as any).body();

    expect(body).toEqual({ secret: "12345" });
    expect(fetchCalls.length).toEqual(1);
  });

  it(".body() can parse plain text", async () => {
    mockFetchOnce("hiii", textHeaders);
    const body = await (fch("/") as any).text();

    expect(body).toEqual("hiii");
    expect(fetchCalls.length).toEqual(1);
  });

  it(".text() can parse plain text", async () => {
    mockFetchOnce("hiii");
    const body = await (fch("/") as any).text();

    expect(body).toEqual("hiii");
    expect(fetchCalls.length).toEqual(1);
  });

  it(".json() can parse JSON", async () => {
    mockFetchOnce(JSON.stringify({ a: "b" }));
    const body = await (fch("/") as any).json();

    expect(body).toEqual({ a: "b" });
    expect(fetchCalls.length).toEqual(1);
  });

  it("default behavior matches .json() with JSON content-type", async () => {
    mockFetchOnce(JSON.stringify({ test: "data" }), jsonHeaders);
    const result1 = await fch("/");

    mockFetchOnce(JSON.stringify({ test: "data" }), jsonHeaders);
    const result2 = await (fch("/") as any).json();

    expect(result1).toEqual(result2);
    expect(result1).toEqual({ test: "data" });
  });

  it("default behavior matches .text() with text content-type", async () => {
    mockFetchOnce("hello world", textHeaders);
    const result1 = await fch("/");

    mockFetchOnce("hello world", textHeaders);
    const result2 = await (fch("/") as any).text();

    expect(result1).toEqual(result2);
    expect(result1).toEqual("hello world");
  });

  it("default behavior matches .body() for automatic parsing", async () => {
    mockFetchOnce(JSON.stringify({ auto: "parse" }), jsonHeaders);
    const result1 = await fch("/");

    mockFetchOnce(JSON.stringify({ auto: "parse" }), jsonHeaders);
    const result2 = await (fch("/") as any).body();

    expect(result1).toEqual(result2);
    expect(result1).toEqual({ auto: "parse" });
  });

  it(".blob() can parse blobs", async () => {
    mockFetchOnce("hello");
    const body = await (fch("/") as any).blob();

    expect(await body.text()).toEqual("hello");
    expect(fetchCalls.length).toEqual(1);
  });

  it(".arrayBuffer() returns an arrayBuffer", async () => {
    mockFetchOnce(new ArrayBuffer(8));
    const body = await (fch("/") as any).arrayBuffer();
    expect(body instanceof ArrayBuffer).toBe(true);
    expect(fetchCalls.length).toEqual(1);
  });

  it(".formData() returns a FormData instance", async () => {
    const formData = new FormData();
    formData.append("key", "value");
    mockFetchOnce(formData);
    const body = await (fch("/") as any).formData();
    expect(body instanceof FormData).toBe(true);
    expect(body.get("key")).toBe("value");
    expect(fetchCalls.length).toEqual(1);
  });

  it(".response() returns the processed response+body", async () => {
    mockFetchOnce("hello");
    const res = await (fch("/") as any).response();
    expect(res.body).toBe("hello");
    expect(res.status).toBe(200);
    expect(fetchCalls.length).toEqual(1);
  });

  it(".raw() returns the raw response+body", async () => {
    mockFetchOnce("hello");
    const res = await (fch("/") as any).raw();
    expect(res.body instanceof ReadableStream).toBe(true);
    expect(fetchCalls.length).toEqual(1);
  });

  it(".clone() returns the raw response+body", async () => {
    mockFetchOnce("hello");
    const res = await (fch("/") as any).clone();
    expect(res.body instanceof ReadableStream).toBe(true);
    expect(fetchCalls.length).toEqual(1);
  });

  it("output methods trigger the error handler on non-OK responses", async () => {
    mockFetchOnce("not found", { status: 404 } as any);
    const err = await fch
      .get("/")
      .text()
      .catch((e: any) => e);
    expect(err instanceof Error).toBe(true);
    expect(err.message).toBe("Error 404");
  });
});

describe("request body variations", () => {
  beforeEach(() => {
    mockFetchOnce("hello");
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    fetchCalls = [];
  });

  it("will send a string as-is", async () => {
    await fch("/", { method: "POST", body: "abcdef" });

    const { body, headers } = fetchCalls[0][1];
    expect(body).toBe("abcdef");
    expect(headers).toEqual({});
  });

  it("will send FormData as-is", async () => {
    await fch("/", { method: "POST", body: new FormData() });

    const { body, headers } = fetchCalls[0][1];
    expect(body instanceof FormData).toBe(true);
    expect(headers).toEqual({});
  });

  it("will send an object as JSON", async () => {
    await fch("/", { method: "POST", body: { a: "b" } });

    const { body, headers } = fetchCalls[0][1];
    expect(body).toBe('{"a":"b"}');
    expect(headers).toEqual({ "content-type": jsonType });
  });

  it("will send an array as JSON", async () => {
    await fch("/", { method: "POST", body: ["a", "b"] });

    const { body, headers } = fetchCalls[0][1];
    expect(body).toBe('["a","b"]');
    expect(headers).toEqual({ "content-type": jsonType });
  });
});
