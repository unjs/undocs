// Test stand-in for the `virtual:undocs/app-config` vfs (see vitest.config.ts).
// Same shape as `generateAppConfig`'s return value, with fixed values so tests
// can assert on them.
export default {
  docs: {
    name: "Test Docs",
    github: "unjs/undocs",
    branch: "main",
    socials: {
      x: "unjsio",
      discord: "https://discord.gg/example",
    },
    versions: [{ label: "v3", to: "https://docs.test", active: true }],
    redirects: {
      // Exact, wildcard-with-tail, and off-site — the three shapes
      // `resolveRedirect` distinguishes.
      "/deploy": "/guide/deploy",
      "/docs/**": "/**",
      "/changelog": "https://github.com/unjs/undocs/releases",
    },
  },
  site: {
    name: "Test Docs",
    description: "Documentation used by the undocs test-suite.",
    url: "https://docs.test",
  },
  ui: {
    colors: { primary: "amber" },
  },
};
