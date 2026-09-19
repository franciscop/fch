# Fch [![fch](https://img.shields.io/npm/v/fch?label=fch&color=greenlime)](https://www.npmjs.com/package/fch) [![tests](https://github.com/franciscop/fetch/workflows/tests/badge.svg)](https://github.com/franciscop/fetch/actions) [![gzip size](https://img.badgesize.io/franciscop/fetch/master/index.min.js.svg?label=gzip&logo=&compression=gzip)](https://github.com/franciscop/fetch/blob/master/index.min.js) [![dependencies](https://img.shields.io/badge/dependencies-0-limegreen.svg)](https://github.com/franciscop/fetch/blob/master/package.json)

A tiny library to make API calls easier. Similar to Axios, but tiny size and simpler API:

```ts
// Plain usage
import fch from "fch";
const mew = await fch<Pokemon>("https://pokeapi.co/pokemon/151");
console.log(mew);

// As an API abstraction
const api = fch.create({ baseUrl: "https://pokeapi.co/" });
const mew = await api.get<Pokemon>("/pokemon/151");
await api.patch<Partial<Pokemon>>("/pokemon/151", { type: "psychic" });
```

- Create instances with shared options across requests.
- Configurable **cache** that works in-memory, with redis, or others.
- Automatically encode and decode JSON bodies.
- Await/Async Promises; non-OK responses (status < 200 or >= 300) will throw an error.
- Credentials: "include" by default
- Interceptors: `before` the request, `after` the response and catch with `error`.
- Designed for both Node.js and the browser through its extensible cache system.
- No dependencies; include it with a simple `<script>` on the browser.
- Full Types definitions so you get nice autocomplete.

```js
import fch from "fch";

const api = fch.create({ baseUrl, headers, ...options });

api.get<T>(url, { headers, ...options });
api.head<T>(url, { headers, ...options });
api.post<T>(url, body, { headers, ...options });
api.patch<T>(url, body, { headers, ...options });
api.put<T>(url, body, { headers, ...options });
api.delete<T>(url, { headers, ...options });
```

| Options                   | Default            | Description                              |
| ------------------------- | ------------------ | ---------------------------------------- |
| [`method`](#method)       | `"get"`            | Default method to use for the call       |
| [`url`](#url)             | `"/"`              | The path or url for the request          |
| [`baseUrl`](#url)         | `null`             | The shared base of the API               |
| [`body`](#body)           | `null`             | The body to send with the request        |
| [`query`](#query)         | `{}`               | Add query parameters to the URL          |
| [`headers`](#headers)     | `{}`               | Shared headers across all requests       |
| [`output`](#output)       | `"body"`           | The return value of the API call         |
| [`cache`](#cache)         | `undefined`        | A polystore Store for caching GET responses |
| [`before`](#interceptors) | `req => req`       | `(req: FchRequest) => FchRequest` — transform the request before sending |
| [`after`](#interceptors)  | `res => res`       | `(res: FchResponse) => FchResponse` — transform the response before returning |
| [`error`](#interceptors)  | `err => throw err` | Process errors before returning them     |

## Getting Started

Install it in your project:

```bash
npm install fch
```

Then import it to be able to use it in your code:

```js
import fch from "fch";
const body = await fch.get("/");
```

On the browser you can add it with a script and it will be available as `fch`:

```html
<!-- Import it as usual -->
<script src="https://cdn.jsdelivr.net/npm/fch" type="module"></script>
<script type="module">
  fch("/hello");
</script>
```

## Options

These are all available options and their defaults:

```js
import api from "fch";

// General options with their defaults; all of these are also parameters:
api.method = "get"; // Default method to use for api()
api.url = "/"; // Relative or absolute url where the request is sent
api.baseUrl = null; // Set an API base URL reused all across requests
api.query = {}; // Merged with the query parameters passed manually
api.headers = {}; // Merged with the headers on a per-request basis

// Control simple variables
api.output = "body"; // Return the parsed body; use 'response' or 'stream' otherwise
api.cache = undefined; // Avoid sending GET requests that were already sent recently

// Interceptors
api.before = (req) => req;
api.after = (res) => res;
api.error = (err) => {
  throw err;
};
```

They can all be defined globally as shown above, passed manually as the options argument, or be used when [creating a new instance](#create-an-instance).

### Method

The HTTP method to make the request. When using the shorthand, it defaults to `GET`. We recommend using the method syntax:

```js
import api from "fch";

api.get("/cats");
api.post("/cats", { name: "snowball" });
api.put(`/cats/3`, { name: "snowball" });
```

You can use it with the plain function as an option parameter. The methods are all lowercase but the option as a parameter is case insensitive; it can be either uppercase or lowercase:

```js
// Recommended way of dealing with methods:
api.get(...);

// INVALID; won't work
api.GET(...);

// Both of these are valid:
api({ method: 'GET' })
api({ method: 'get'})
```

Example: adding a new cat and fixing a typo:

```js
import api from "fch";

const cats = await api.get("/cats");
console.log(cats);
const { id } = await api.post("/cats", { name: "snowbll" });
await api.patch(`/cats/${id}`, { name: "snowball" });
```

All methods accept a generic type parameter for the response body:

```ts
type Cat = { id: number; name: string };

const cats = await api.get<Cat[]>("/cats");
const cat = await api.post<Cat>("/cats", { name: "snowball" });
await api.patch<Cat>(`/cats/${cat.id}`, { name: "snowball" });
```

### Url

Specify where to send the request to. It must be the first argument in all methods and the base call:

```js
import api from "fch";

await api("/hello", { method: "post", body: "...", headers: {} });
await api.post("/hello", body, { headers: {} });
```

It can be either absolute or relative, in which case it'll use the local one in the page. It's recommended to set `baseUrl`:

```js
import api from "fch";
api.baseUrl = "https://api.filemon.io/";
api.get("/hello");
// Called https://api.filemon.io/hello
```

> Note: with Node.js you need to either set an absolute baseUrl or make the URL absolute

### Body

> These docs refer to the REQUEST body, for the RESPONSE body see the [**Output docs**](#output).

The `body` can be a string, a plain object|array, a FormData instance, a URLSearchParams instance, a Blob or File, an ArrayBuffer or typed array, a ReadableStream, a SubmitEvent or a HTMLFormElement. If it's a plain array or object, it'll be stringified and the header `application/json` will be added. Everything else is handed to `fetch()` as-is, so binary data keeps its bytes and a Blob keeps its own content type. Streams get `duplex: "half"` set for you, which Node requires:

```js
import fch from "fch";

// Sending plain text
await fch.post("/houses", "plain text");

// Will JSON.stringify it internally and add the JSON headers
await api.post("/houses", { id: 1, name: "Cute Cottage" });

// Binary bodies are sent untouched
await api.put("/houses/1/photo", new Blob([bytes], { type: "image/png" }));
await api.put("/houses/1/photo", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

// Form-encoded bodies too
await api.post("/houses", new URLSearchParams({ name: "Cute Cottage" }));

// Send it as FormData
form.onsubmit = (e) => api.post("/houses", new FormData(e.target));

// We have some helpers so you can just pass the Event or <form> itself!
form.onsubmit = (e) => api.post("/houses", e);
form.onsubmit = (e) => api.post("/houses", e.target);
form.onsubmit = (e) => api.post("/houses", new FormData(e.target));
```

The methods `GET` and `HEAD` do not accept a body. For `DELETE`, while not common, you can pass a body via the options parameter if needed: `fch.delete('/resource', { body: {...} })`.

### Query

You can easily pass url query parameters by using the option `query`:

```js
api.get("/cats", { query: { limit: 3 } });
// /cats?limit=3
```

While rare, sometimes you might want to persist a query parameter across requests and always include it; in that case, you can define it globally and it'll be added to every request, or on an instance:

```js
import fch from "fch";
fch.query.myparam = "abc";

fch.get("/cats", { query: { limit: 3 } });
// /cats?limit=3&myparam=abc

const api = fch.create({ query: { sort: "asc" } });
api.get("/cats");
// /cats?sort=asc&myparam=abc
```

For POST or others, they go into the options as usual:

```js
fch.post("/cats", { my: "body" }, { query: { abc: "def" } });
// /cats?abc=def
```

### Headers

You can define headers in 4 ways:

- Globally, in which case they'll be added to every request
- On an instance, so they are added every time you use that instance
- Per-request, so that they are only added to the current request.
- In the `before` interceptor, which again can be global, on an instance, or per-request

```js
import fch from "fch";

// Globally, so they are reused across all requests
fch.headers.a = "b";

// With an interceptor, in case you need dynamic headers per-request
fch.before = (req) => {
  req.headers.c = "d";
  return req;
};

// Set them for this single request:
fch.get("/hello", { headers: { e: "f" } });
// Total headers on the request:
// { a: 'b', c: 'd', e: 'f' }
```

When to use each?

- If you need headers shared across all requests, like an API key, then the global one is the best place.
- If it's all the requests to only certain endpoint, like we are communicating to multiple endpoints use the instance
- When you need to extract them dynamically from somewhere it's better to use the .before() interceptor. An example would be the user Authorization token.
- When it changes on each request, it's not consistent or it's an one-off, use the option argument.

### Output

The default output manipulation is to expect either plain `TEXT` as `plain/text` or `JSON` as `application/json` from the `Content-Type`. If your API works with these (the vast majority of APIs do) then you should be fine out of the box! A JSON response with an empty body, like a `204` or the reply to a `HEAD`, resolves to `null`.

```js
const cats = await api.get("/cats");
console.log(cats); // [{ id: 1, name: 'Whiskers', ... }, ...]
```

> Note: for your typical API, we recommend sending the proper headers from the API and **not** using the more advanced options below.

For more expressive control, you can use the **`output` option** (either as a default when [creating an instance](#create-an-instance) or with each call), or using a method:

```js
const api = fch.create({ output: "json" }); // JSON by default
const streamImg = await api.get("/cats/123/image", { output: "stream" }); // Stream the image
const streamImg2 = await api.get("/cats/123/image").stream(); // Shortcut for the one above
```

This controls whether the call returns just the body (default), or the whole response. It can be controlled globally or on a per-request basis:

```js
// Return only the body (default)
const body = await api.get("/data");

// Return the whole response (with .body):
const response = await api.get("/data", { output: "response" });

// Return a plain body stream
const stream = await api.get("/data", { output: "stream" });
stream.pipeTo(outStream);

// Return a blob, since `response.blob()` is available:
const blob = await api.get("/data", { output: "blob" });
```

There are few options that can be specified:

- `output: "body"` (default): returns the body, parsed as JSON or plain TEXT depending on the headers.
- `output: "response"`: return the full response with the properties `body`, `headers`, `status`. The body will be parsed as JSON or plain TEXT depending on the headers. If you want the raw `response`, use `raw` or `clone` instead (see below in "raw" or "clone").
- `output: "stream"`: return a [web ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) of the body as the result of the promise.
- `output: "arrayBuffer"`\*: returns an arrayBuffer of the response body.
- `output: "blob"`\*: returns a Blob of the response body.
- `output: "clone"`\*: returns the raw Response, with the raw body. See also `raw` below.
- `output: "formData"`\* (might be unavailable): returns an instance of FormData with all the parsed data.
- `output: "json"`\*: attempts to parse the response as JSON.
- `output: "text"`\*: puts the response body as plain text.
- `output: "raw"`\*: an alias for `clone`, returning the raw response (after passing through `after`).

\* Standard [MDN methods](https://developer.mozilla.org/en-US/docs/Web/API/Response#methods)

The `output` values can all be used as a method as well. So all of these are equivalent:

```js
const text = await api.get("/cats", { output: "text" });
const text = await api.get("/cats").text();

const raw = await api.get("/cats", { output: "raw" });
const raw = await api.get("/cats").raw();
```

For example, return the raw body as a `ReadableStream` with the option `stream`:

```js
const stream = await api.get('/cats', { output: 'stream' });
stream.pipeTo(...);
// or
const stream = await api.get('/cats').stream();
stream.pipeTo(...);
```

### Cache

> We use **[polystore](https://polystore.dev/)** for Cache management.

The cache (disabled by default) is a great method to reduce the number of API requests we make. Provide a [polystore](https://polystore.dev/) Store instance directly to `fch.create()` and fch will cache GET responses using whatever persistence that store offers. Set `cache` to `null` on a call to skip caching entirely.

While a GET request is in flight, fch keeps an internal map of ongoing requests to deduplicate parallel calls to the same URL within the same instance. As soon as the request resolves, the result is written to your store and the entry is removed from the in-flight map.

To activate the cache, create a **polystore** store and pass it to fch:

```js
import kv from "polystore";

// This API reuses responses using an in-memory Map:
const cache = kv(new Map(), { expires: '1h' });
const api = fch.create({ baseUrl: "...", cache });

// Call `.expires()` to return an instance with a different cache time
const shortCache = cache.expires('10min');
api.get("/somedata", { cache: shortCache });
```

Polystore supports multiple backends. For example, with Redis:

```js
import fch from "fch";
import kv from "polystore";
import { createClient } from "redis";

// Redis-backed cache store
const cache = kv(createClient().connect());

const api = fch.create({ cache });
```

That's the basic usage, but "invalidating cache" is not one of the complex topics in CS for no reason. To clear the cache, call `cache.clear()` at any time:

```js
import kv from "polystore";

const cache = kv(new Map());
const api = fch.create({ cache });

// Remove them all
await cache.clear();
```

You can also access the underlying store directly through the polystore instance to perform low-level operations:

```js
import fch from "fch";
import kv from "polystore";
import { createClient } from "redis";

const redis = await createClient().connect();
const cache = kv(redis);

const api = fch.create({ cache });

// Later on, you can access the underlying Redis client
await redis.flushDB();
```

#### Creating a custom store

You can create a custom store that works with fch by implementing the polystore-compatible interface. See the [polystore documentation](https://polystore.dev/documentation#custom-store) for details on creating custom stores and adapters.

### Interceptors

You can also add the interceptors `before`, `after` and `error`:

- `before`: Called when the request is fully formed, but before actually launching it.
- `after`: Called just after the response is created and if there was no error, but before parsing anything else.
- `error`: When the response is not okay, if possible it'll include the `response` object.

The interceptors are typed as follows:

```ts
type FchRequest = {
  url: string;
  method: string;
  headers: { [name: string]: string };
  body?: BodyInit | null;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
};

type FchResponse = {
  status: number;
  statusText: string;
  headers: { [name: string]: string };
  body: unknown;
};
```

```js
// Perform an action or request transformation before the request is sent
fch.before = async (req: FchRequest): Promise<FchRequest> => {
  req.headers['Authorization'] = 'Bearer ' + getToken();
  return req;
};

// Perform an action or data transformation after the request is finished
fch.after = async (res: FchResponse): Promise<FchResponse> => {
  res.body = transform(res.body);
  return res;
};

// Perform an action or data transformation when an error is thrown
fch.error = async err => {
  // Need to re-throw if we want to throw on error
  throw err;

  // OR, resolve it as if it didn't fail
  return err.response;

  // OR, resolve it with a custom value
  return { message: 'Request failed with a code ' + err.response.status };
};
```

## How to

### Return the full response

By default a successful request will just return the data. However this one is configurable on a global level:

```js
import fch from "fch";
fch.output = "response";

const res = await fch("/hello");
console.log(res.status);
```

Or on a per-request level:

```js
import fch from "fch";

// Valid values are 'body' (default) or 'response'
const res = await fch("/hello", { output: "response" });
const res = await fch("/hello").response();
```

It does perform some basic parsing of the `body`, if you don't want any of that you can retrieve the very raw response:

```js
import fch from "fch";

// Valid values are 'body' (default) or 'response'
const res = await fch("/hello", { output: "raw" });
console.log(res.body); // ReadableStream
```

### Stop errors from throwing

To overwrite the global behavior you can write a interceptor:

```js
import fch from "fch";
fch.error = (error) => error.response;

const res = await fch("/notfound").response();
expect(res.status).toBe(404);
```

### Set a base URL

There's a configuration parameter for that:

```js
import fch from "fch";
fch.baseUrl = "https://api.filemon.io/";

// Calls "https://api.filemon.io/blabla"
const body = await fch.get("/blabla");
```

### Set authorization headers

You can set that globally as a header:

```js
import fch from "fch";
fch.headers.Authorization = "bearer abc";

const me = await fch("/users/me");
```

Or globally on a per-request basis, for example if you take the value from localStorage:

```js
import fch from "fch";

// All the requests will add the Authorization header when the token is
// in localStorage
fch.before = (req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = "bearer " + token;
  }
  return req;
};

const me = await fch("/users/me");
```

Or on a per-request basis, though we wouldn't recommend this:

```js
import fch from "fch";

const me = await fch("/users/me", { headers: { Authorization: "bearer abc" } });
```

### Create an instance

You can create an instance with its own defaults and global options easily. It's common when writing an API that you want to encapsulate away:

```js
import fch from 'fch';

const api = fch.create({
  baseUrl: 'https://api.filemon.io/',
  ...
});

api.get('/hello');   // Gets https://api.filemon.io/hello
fch.get('/hello');   // Gets http://localhost:3000/hello (or wherever you are)
```

Note: for server-side (Node.js) usage, you always want to set `baseUrl`.

### Streaming a response body

To stream the body, you need to use the `output: "stream"` option so that it returns a [WebStream ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream):

```js
import fch from "fch";

// Valid values are 'body' (default) or 'response'
const stream = await fch("/data", { output: "stream" });
stream.pipeTo(outStream);
```

You might want to convert it to a Node.js ReadStream:

```js
import fch from "fch";
import { Readable } from "node:stream";

const stream = await fch("/data", { output: "stream" });
const readableNodeStream = Readable.fromWeb(stream);
// ...
```

### Cancel ongoing requests

You can cancel ongoing requests [similarly to native fetch()](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort#examples), by passing it a signal:

```js
import api from "fch";

const controller = new AbortController();
const signal = controller.signal;

abortButton.addEventListener("click", () => {
  controller.abort();
  console.log("Download aborted");
});

api.get(url, { signal });
```

### Define shared options

You can also define values straight away:

```js
import api from "fch";

api.baseUrl = "https://pokeapi.co/";

const mew = await api.get("/pokemon/151");
console.log(mew);
```

You can also [create an instance](#create-an-instance) that will have the same options for all requests made with that instance.

### Node.js vs Browser

First, we use the native Node.js' fetch() and the browser's native fetch(), so any difference between those also applies to this library. For example, if you were to call `"/"` in the browser it'd refer to the current URL, while in Node.js it'd fail since you need to specify the full URL. Some other places where you might find differences: CORS, cache, etc.

In the library itself there's nothing different between the browser and Node.js, but it might be interesting to note that things like ephemeral cache in Node.js are normally long-lived and shared, while in a browser request it'd bound to the browser runtime.

### Differences with Axios

The main difference is that things are simplified with fch:

```js
// Modify headers
axios.defaults.headers.Authorization = "...";
fch.headers.Authorization = "...";

// Set a base URL
axios.defaults.baseURL = "...";
fch.baseUrl = "...";

// Add an interceptor
axios.interceptors.request.use(fn);
fch.before = fn;
```

API size is also strikingly different, with **7.8kb** for Axios and **1.5kb** for fch (gzipped).

As disadvantages, I can think of two major ones for `fch`:

- Requires Node.js 18+, which is the version that includes `fetch()` by default.
- Does not support many of the more advanced options, like `onUploadProgress` nor `onDownloadProgress`.
