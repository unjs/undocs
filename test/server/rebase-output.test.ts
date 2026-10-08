import { describe, expect, it } from "vitest";
import { rebaseOutput } from "../../src/server/rebase-output.ts";

describe("rebaseOutput", () => {
  it("rebases preset-derived output paths onto docsDir", () => {
    const nitro = {
      options: {
        rootDir: "/pkg/root/undocs",
        output: {
          dir: "/pkg/root/undocs/.output",
          publicDir: "/pkg/root/undocs/.output/public",
          serverDir: "/pkg/root/undocs/.output/server",
        },
      },
    } as any;

    const mod = rebaseOutput("/my-project/docs");
    mod.setup?.(nitro);

    expect(nitro.options.output.dir).toBe("/my-project/docs/.output");
    expect(nitro.options.output.publicDir).toBe("/my-project/docs/.output/public");
    expect(nitro.options.output.serverDir).toBe("/my-project/docs/.output/server");
  });

  it("normalizes Windows backslashes in docsDir and output paths", () => {
    const nitro = {
      options: {
        rootDir: "C:/projects/my-docs/node_modules/undocs",
        output: {
          dir: "C:/projects/my-docs/node_modules/undocs/.output",
          publicDir: "C:/projects/my-docs/node_modules/undocs/.output/public",
          serverDir: "C:/projects/my-docs/node_modules/undocs/.output/server",
        },
      },
    } as any;

    const mod = rebaseOutput("C:\\projects\\my-docs");
    mod.setup?.(nitro);

    expect(nitro.options.output.dir).toBe("C:/projects/my-docs/.output");
    expect(nitro.options.output.publicDir).toBe("C:/projects/my-docs/.output/public");
    expect(nitro.options.output.serverDir).toBe("C:/projects/my-docs/.output/server");
  });

  it("handles Windows backslashes in rootDir and output", () => {
    const nitro = {
      options: {
        rootDir: "C:\\projects\\my-docs\\node_modules\\undocs\\",
        output: {
          dir: "C:\\projects\\my-docs\\node_modules\\undocs\\.output",
          publicDir: "C:\\projects\\my-docs\\node_modules\\undocs\\.output\\public",
          serverDir: "C:\\projects\\my-docs\\node_modules\\undocs\\.output\\server",
        },
      },
    } as any;

    const mod = rebaseOutput("C:\\projects\\my-docs\\");
    mod.setup?.(nitro);

    expect(nitro.options.output.dir).toBe("C:/projects/my-docs/.output");
    expect(nitro.options.output.publicDir).toBe("C:/projects/my-docs/.output/public");
    expect(nitro.options.output.serverDir).toBe("C:/projects/my-docs/.output/server");
  });

  it("does nothing when rootDir equals docsDir", () => {
    const nitro = {
      options: {
        rootDir: "/projects/docs",
        output: {
          dir: "/projects/docs/.output",
          publicDir: "/projects/docs/.output/public",
          serverDir: "/projects/docs/.output/server",
        },
      },
    } as any;

    const mod = rebaseOutput("/projects/docs");
    mod.setup?.(nitro);

    expect(nitro.options.output.dir).toBe("/projects/docs/.output");
    expect(nitro.options.output.publicDir).toBe("/projects/docs/.output/public");
  });
});
