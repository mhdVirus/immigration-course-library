import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseResourceStore } from "../storage.mjs";

test("Supabase resource store reads and mutates rows through the private REST API", async () => {
  const calls = [];
  const responses = [
    new Response(JSON.stringify([{ resource: { id: "one", title: "Livre" } }]), { status: 200 }),
    new Response(JSON.stringify([{ id: "two" }]), { status: 201 }),
    new Response(JSON.stringify([{ id: "two" }]), { status: 200 }),
    new Response(JSON.stringify([{ id: "two" }]), { status: 200 }),
  ];
  const store = createSupabaseResourceStore({
    url: "https://course-project.supabase.co",
    serviceRoleKey: "server-only-test-key",
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return responses.shift();
    },
  });

  assert.deepEqual(await store.list(), [{ id: "one", title: "Livre" }]);
  await store.create({ id: "two", createdAt: "2026-11-06T00:00:00.000Z", title: "Article" });
  assert.equal(await store.update("two", { id: "two", title: "Article modifié" }), true);
  assert.equal(await store.remove("two"), true);

  assert.deepEqual(calls.map(({ options }) => options.method), ["GET", "POST", "PATCH", "DELETE"]);
  assert.equal(calls[0].url.searchParams.get("select"), "resource");
  assert.equal(calls[1].options.headers.Authorization, "Bearer server-only-test-key");
  assert.equal(calls[1].url.searchParams.has("apikey"), false);
  assert.equal(calls[1].options.body.includes("Article"), true);
  assert.equal(calls[2].url.searchParams.get("id"), "eq.two");
  assert.equal(calls[3].url.searchParams.get("id"), "eq.two");
});

test("Supabase storage requires a complete HTTPS configuration", () => {
  assert.equal(createSupabaseResourceStore({ url: "", serviceRoleKey: "" }), null);
  assert.throws(
    () => createSupabaseResourceStore({ url: "https://course-project.supabase.co", serviceRoleKey: "" }),
    /Configure both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
  );
  assert.throws(
    () => createSupabaseResourceStore({ url: "http://course-project.supabase.co", serviceRoleKey: "secret" }),
    /must use HTTPS/,
  );
});
