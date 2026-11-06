import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server.mjs";
import { askGroqModel, fetchPageText, findRelevantResources } from "../search.mjs";

const fixtures = [];
const username = "course-owner";
const password = "test-only-password-12345";
const validResource = {
  title: "Introduction à la sociologie des migrations",
  author: "Auteur du cours",
  type: "book",
  module: "مدخل الى سوسيولوجيا الهجرة",
  language: "fr",
  url: "",
  description: "Une référence pédagogique.",
  notes: "Extrait de cours sur les concepts de mobilité.",
};

async function setup({ aiAnswer, pageIndexer } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "course-library-"));
  const dataFile = path.join(directory, "resources.json");
  await copyFile(
    new URL("../data/resources.example.json", import.meta.url),
    dataFile,
  );
  const server = createServer({
    adminUsername: username,
    adminPassword: password,
    dataFile,
    aiAnswer,
    pageIndexer,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  fixtures.push({ directory, server });
  return { baseUrl, dataFile };
}

async function signIn(baseUrl) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(async ({ directory, server }) => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await rm(directory, { recursive: true, force: true });
  }));
});

test("public library is readable and resource edits require owner sign-in", async () => {
  const { baseUrl, dataFile } = await setup();
  const publicResponse = await fetch(`${baseUrl}/api/resources`);
  assert.equal(publicResponse.status, 200);
  assert.deepEqual(await publicResponse.json(), []);

  const unauthorized = await fetch(`${baseUrl}/api/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify(validResource),
  });
  assert.equal(unauthorized.status, 401);

  const cookie = await signIn(baseUrl);
  const addedResponse = await fetch(`${baseUrl}/api/resources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookie,
    },
    body: JSON.stringify(validResource),
  });
  assert.equal(addedResponse.status, 201);
  const added = await addedResponse.json();
  assert.equal(added.resource.title, validResource.title);
  assert.equal(added.resource.aiIndexed, true);
  assert.equal("embedding" in added.resource, false);

  const changedResponse = await fetch(`${baseUrl}/api/resources/${added.resource.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookie,
    },
    body: JSON.stringify({ ...validResource, notes: "Notes mises à jour." }),
  });
  assert.equal(changedResponse.status, 200);
  assert.equal((await changedResponse.json()).resource.notes, "Notes mises à jour.");

  const removedResponse = await fetch(`${baseUrl}/api/resources/${added.resource.id}`, {
    method: "DELETE",
    headers: { Origin: baseUrl, Cookie: cookie },
  });
  assert.equal(removedResponse.status, 200);
  assert.deepEqual((await fetch(`${baseUrl}/api/resources`).then((response) => response.json())), []);
  assert.deepEqual(JSON.parse(await readFile(dataFile, "utf8")), []);
});

test("resource validation rejects non-HTTPS links and invalid modules", async () => {
  const { baseUrl } = await setup();
  const cookie = await signIn(baseUrl);
  for (const invalid of [
    { ...validResource, url: "http://example.org/book" },
    { ...validResource, module: "un module inconnu" },
  ]) {
    const response = await fetch(`${baseUrl}/api/resources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: cookie,
      },
      body: JSON.stringify(invalid),
    });
    assert.equal(response.status, 400);
  }
});

test("AI endpoint passes saved resources to the answer provider", async () => {
  let received;
  const { baseUrl } = await setup({
    aiAnswer: async (input) => {
      received = input;
      return { answer: "Réponse fondée sur le cours [1].", sources: [] };
    },
  });
  const cookie = await signIn(baseUrl);
  await fetch(`${baseUrl}/api/resources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookie,
    },
    body: JSON.stringify(validResource),
  });

  const response = await fetch(`${baseUrl}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ question: "Quels concepts de sociologie ?", language: "fr" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, "Réponse fondée sur le cours [1].");
  assert.equal(received.language, "fr");
  assert.equal(received.resources[0].title, validResource.title);
});

test("indexed page text stays private to the server", async () => {
  const { baseUrl } = await setup({
    pageIndexer: async () => "Texte complet provenant de la page liée.",
  });
  const cookie = await signIn(baseUrl);
  const addedResponse = await fetch(`${baseUrl}/api/resources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookie,
    },
    body: JSON.stringify({ ...validResource, url: "https://example.org/reference" }),
  });
  const added = await addedResponse.json();
  assert.equal(added.resource.pageIndexed, true);
  assert.equal(added.resource.aiIndexed, true);
  assert.equal("pageText" in added.resource, false);
  assert.equal("embedding" in added.resource, false);

  const publicResponse = await fetch(`${baseUrl}/api/resources`);
  const listed = await publicResponse.json();
  assert.equal(listed[0].pageIndexed, true);
  assert.equal("pageText" in listed[0], false);
  assert.equal("embedding" in listed[0], false);
});

test("page indexing refuses loopback and local-only addresses", async () => {
  await assert.rejects(fetchPageText("https://127.0.0.1/private"), /public network addresses/);
  await assert.rejects(fetchPageText("https://localhost/private"), /Local and private network links/);
});

test("keyword retrieval ranks matching resources and falls back for cross-language material", () => {
  const resources = [
    { title: "كتاب عن الهجرة", notes: "المجتمع المدني والحركة" },
    { title: "A book about cooking", notes: "Recipes and ingredients" },
  ];
  assert.equal(findRelevantResources(resources, "cooking")[0].title, "A book about cooking");
  assert.equal(findRelevantResources(resources, "migration").length, 2);
});

test("Groq request keeps its key server-side and sends only bounded course context", async () => {
  let endpoint;
  let options;
  const result = await askGroqModel({
    question: "Quels concepts de sociologie ?",
    language: "fr",
    resources: [validResource],
    apiKey: "test-only-key",
    fetchImpl: async (url, requestOptions) => {
      endpoint = url;
      options = requestOptions;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Réponse fondée sur le cours [1]." } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(endpoint, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(options.headers.Authorization, "Bearer test-only-key");
  const payload = JSON.parse(options.body);
  assert.equal(payload.model, "llama-3.3-70b-versatile");
  assert.match(payload.messages[1].content, /Quels concepts de sociologie/);
  assert.match(payload.messages[1].content, /Extrait de cours sur les concepts de mobilité/);
  assert.equal(result.answer, "Réponse fondée sur le cours [1].");
  assert.equal(result.sources[0].title, validResource.title);
});

test("Groq assistant reports a missing API key explicitly", async () => {
  await assert.rejects(askGroqModel({
    question: "Question",
    language: "fr",
    resources: [validResource],
    apiKey: "",
  }), /GROQ_API_KEY is not configured/);
});

test("server requires configured admin credentials", () => {
  assert.throws(() => createServer({ adminUsername: "", adminPassword: "" }), /ADMIN_USERNAME/);
  assert.throws(() => createServer({ adminUsername: username, adminPassword: "short" }), /16 caractères/);
});
