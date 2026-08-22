/** Public entry for undocs plugin authors. */
export {
  defineUndocsPlugin,
  defineUndocsPluginBundle,
  type UndocsClientPlugin,
  type UndocsClientPluginContext,
} from "./app/plugins/types.ts";

export type {
  UndocsPluginBundle,
  UndocsPluginContext,
  UndocsServerPlugin,
} from "./server/plugins/types.ts";

export type { PluginSpec, ResolvedPluginSpec } from "./shared/plugins/types.ts";
