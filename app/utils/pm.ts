export const packageManagers = [
  { name: 'npm', command: 'npm', install: 'i ', run: 'run ', x: 'npx ' },
  { name: 'yarn', command: 'yarn', install: 'add ', run: '', x: 'yarn dlx ' },
  { name: 'pnpm', command: 'pnpm', install: 'i ', run: '', x: 'pnpm dlx ' },
  { name: 'bun', command: 'bun', install: 'i ', run: 'run ', x: 'bunx ' },
  { name: 'deno', command: 'deno', install: 'i npm:', run: 'run ', x: 'deno run -A npm:' },
  // { name: 'auto', command: 'npx nypm', install: 'i ', run: 'run ', x: 'npx ' },
] as const
