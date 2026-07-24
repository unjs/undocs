#!/usr/bin/env node

import { createCLI } from "./cli.mjs";

const cli = createCLI({
  name: "undocs",
  description: "UnJS Docs Tool",
});

cli.runMain();
