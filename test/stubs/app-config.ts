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
