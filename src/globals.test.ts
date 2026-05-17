import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import fch from "./index.js";

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

describe("baseUrl and baseURL configuration", () => {
	beforeEach(() => {
		if (fetchMock) {
			fetchMock.mockRestore();
		}
		fetchCalls = [];
		fch.baseUrl = null;
		fch.baseURL = null;
	});

	it("can use the baseUrl", async () => {
		mockFetchOnce("hi");
		fch.baseUrl = "https://google.com/";
		const body = await fch.get("/hello");
		expect(body).toBe("hi");
		expect(fetchCalls[0][0]).toBe("https://google.com/hello");
		expect(fetchCalls[0][1].method).toEqual("GET");
	});

	it("can use the baseURL", async () => {
		mockFetchOnce("hi");
		fch.baseURL = "https://google.com/";
		const body = await fch.get("/hello");
		expect(body).toBe("hi");
		expect(fetchCalls[0][0]).toBe("https://google.com/hello");
		expect(fetchCalls[0][1].method).toEqual("GET");
	});

	it("can use the baseURL with a path", async () => {
		mockFetchOnce("hi");
		fch.baseURL = "https://google.com/hi/";
		const body = await fch.get("/hello");
		expect(body).toBe("hi");
		expect(fetchCalls[0][0]).toBe("https://google.com/hi/hello");
		expect(fetchCalls[0][1].method).toEqual("GET");
	});

	it("can use the baseUrl as an option", async () => {
		mockFetchOnce("hi");
		const baseUrl = "https://google.com/";
		const body = await fch.get("/hello", { baseUrl });
		expect(body).toBe("hi");
		expect(fetchCalls[0][0]).toBe("https://google.com/hello");
		expect(fetchCalls[0][1].method).toEqual("GET");
	});

	it("can use the baseURL", async () => {
		mockFetchOnce("hi");
		const baseURL = "https://google.com/";
		const body = await fch.get("/hello", { baseURL });
		expect(body).toBe("hi");
		expect(fetchCalls[0][0]).toBe("https://google.com/hello");
		expect(fetchCalls[0][1].method).toEqual("GET");
	});
});

describe("query parameters", () => {
	beforeEach(() => {
		if (fetchMock) {
			fetchMock.mockRestore();
		}
		fetchCalls = [];
		fch.query = {};
	});

	afterEach(() => {
		fch.query = {};
	});

	it("works with query", async () => {
		mockFetchOnce("hello");
		const body = await fch("/", { query: { abc: "def" } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?abc=def");
	});

	it("works with existing query and new one", async () => {
		mockFetchOnce("hello");
		const body = await fch("/?ghi=jkl", { query: { abc: "def" } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?abc=def&ghi=jkl");
	});

	it("ignores undefined", async () => {
		mockFetchOnce("hello");
		const body = await fch("/?ghi=jkl", { query: { abc: undefined as any } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?ghi=jkl");
	});

	it("can set a default query for everywhere", async () => {
		mockFetchOnce("hello");
		fch.query = { abc: "def" };
		const body = await fch("/?mno=pqr", { query: { ghi: "jkl" } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?abc=def&ghi=jkl&mno=pqr");
	});

	it("query overwriting: url > local", async () => {
		mockFetchOnce("hello");
		const body = await fch("/?abc=def", { query: { abc: "hij" } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?abc=def");
	});

	it("query overwriting: local > global", async () => {
		mockFetchOnce("hello");
		fch.query = { abc: "hij" };
		const body = await fch("/", { query: { abc: "def" } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?abc=def");
	});

	it("query overwriting: url > local > global", async () => {
		mockFetchOnce("hello");
		fch.query = { abc: "klm" };
		const body = await fch("/?abc=def", { query: { abc: "hij" } });

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/?abc=def");
	});
});

describe("interceptors", () => {
	beforeEach(() => {
		if (fetchMock) {
			fetchMock.mockRestore();
		}
		fetchCalls = [];
	});

	afterEach(() => {
		fch.before = (req) => req;
		fch.after = (res) => res;
	});

	it("can create a before interceptor", async () => {
		mockFetchOnce("hello");
		const body = await fch("/", {
			before: (req) => {
				req.url = "/hello";
				req.method = "put";
				return req;
			},
		});

		expect(body).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/hello");
		expect(fetchCalls[0][1].method).toEqual("PUT");
		expect(fetchCalls[0][1].headers).toEqual({});
	});

	it("can create a global before interceptor", async () => {
		mockFetchOnce("hello");
		fch.before = (req) => {
			req.url = "/hello";
			req.method = "put";
			return req;
		};
		const data = await fch("/");

		expect(data).toEqual("hello");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/hello");
		expect(fetchCalls[0][1].method).toEqual("PUT");
		expect(fetchCalls[0][1].headers).toEqual({});

		delete fch.before;
	});

	it("can create an after interceptor", async () => {
		mockFetchOnce("hello", { status: 201, headers: { hello: "world" } });
		const res = await fch("/", {
			output: "response",
			after: (res) => {
				res.body = "bye";
				res.status = 200;
				res.headers.hello = "world";
				return res;
			},
		});

		expect(res.body).toEqual("bye");
		expect(res.status).toEqual(200);
		expect(res.headers.hello).toEqual("world");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/");
		expect(fetchCalls[0][1].method).toEqual("GET");
		expect(fetchCalls[0][1].headers).toEqual({});
	});

	it("can create a global after interceptor", async () => {
		mockFetchOnce("hello", { status: 201, headers: { hello: "world" } });
		fch.after = (res) => {
			res.body = "bye";
			res.status = 200;
			res.headers.hello = "world";
			return res;
		};
		const res = await fch("/", { output: "response" });

		expect(res.body).toEqual("bye");
		expect(res.status).toEqual(200);
		// expect(res.statusText).toEqual("Created");
		expect(res.headers.hello).toEqual("world");
		expect(fetchCalls.length).toEqual(1);
		expect(fetchCalls[0][0]).toEqual("/");
		expect(fetchCalls[0][1].method).toEqual("GET");
		expect(fetchCalls[0][1].headers).toEqual({});
	});

	it("supports an async before interceptor", async () => {
		mockFetchOnce("hello");
		const body = await fch("/", {
			before: async (req) => {
				req.headers["x-async"] = "true";
				return req;
			},
		});

		expect(body).toEqual("hello");
		expect(fetchCalls[0][1].headers["x-async"]).toEqual("true");
	});

	it("supports an async after interceptor", async () => {
		mockFetchOnce("hello");
		const res = await fch("/", {
			output: "response",
			after: async (res) => {
				res.body = "async-modified";
				return res;
			},
		});

		expect(res.body).toEqual("async-modified");
	});
});
