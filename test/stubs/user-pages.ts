// Test stand-in for the `virtual:undocs/user-pages` vfs (see vitest.config.ts).
// Same shape the `undocs:user-theme` plugin emits: `match` is a `RegExp` source
// string tested against `route.path`. One custom page, so `webmcp`'s route check
// can be exercised against a route that has no content-index entry.
export const pages = [
  {
    match: String.raw`^/showcase$`,
    meta: {},
    component: () => Promise.resolve({ default: {} as any }),
  },
];

export default pages;
