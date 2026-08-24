import { defineComponent, h } from "vue"; import { pluginHost } from "@app/plugins/host.ts"; /**
Generic chrome slot — renders `headerActions` from all client plugins. */ export default
defineComponent({ name: "PluginChrome", setup() { return () => { const actions =
pluginHost.headerActions(); if (!actions.length) return null; return h( "div", { class: "hidden
items-center gap-1 md:flex" }, actions.map((component, i) => h(component, { key: i })), ); }; }, });
