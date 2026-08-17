import { defineEventHandler, getRequestURL, redirect } from "nitro/h3";

// Public `.md` alias preserves the query while redirecting to the raw route.

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  if (!url.pathname.endsWith(".md") || url.pathname.startsWith("/raw/")) {
    return;
  }
  return redirect(`/raw${url.pathname}${url.search}`, 302);
});
