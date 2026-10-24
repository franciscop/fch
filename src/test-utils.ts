import { spyOn } from "bun:test";

export const delay = (num: number): Promise<void> =>
  new Promise((done) => setTimeout(done, num));

export const jsonType: string = "application/json";

export const jsonHeaders: { headers: { "Content-Type": string } } = {
  headers: { "Content-Type": jsonType },
};

export const textHeaders: { headers: { "Content-Type": string } } = {
  headers: { "Content-Type": "text/plain" },
};

// Mock fetch globally
export let fetchMock: any;
export let fetchCalls: any[] = [];

export async function normalizeResponse(
  response: any,
  args: any,
): Promise<Response> {
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

export function mockFetch(response: any): void {
  fetchCalls = [];
  fetchMock = (spyOn(global, "fetch") as any).mockImplementation(
    async (...args: any[]) => {
      fetchCalls.push(args);
      return normalizeResponse(response, args);
    },
  );
}

export function mockFetchOnce(response: any, init?: ResponseInit): any {
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

export function resetFetch() {
  if (fetchMock) {
    fetchMock.mockRestore();
  }
  fetchCalls = [];
}
