import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { askGroqModel, courseModules, fetchPageText } from "./search.mjs";
import { createSupabaseResourceStore } from "./storage.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_DATA_FILE = path.join(ROOT, "data", "resources.json");
const SEED_FILE = path.join(ROOT, "data", "resources.example.json");
const COOKIE_NAME = "course_resource_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_AI_REQUESTS_PER_MINUTE = 12;
const RESOURCE_TYPES = new Set(["book", "link", "article", "course-material"]);
const LANGUAGES = new Set(["ar", "fr", "en", "es", "el"]);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(response, status, value, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function safeEqual(left, right) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function cookiesFromHeader(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1
          ? [part, ""]
          : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

async function readJson(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    throw new ApiError(415, "La demande doit être envoyée au format JSON.");
  }

  let body = "";
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      throw new ApiError(413, "La demande est trop volumineuse.");
    }
    body += chunk.toString("utf8");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, "Le contenu de la demande n’est pas un JSON valide.");
  }
}

function validateResource(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "Renseignez les informations de la ressource.");
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const author = typeof input.author === "string" ? input.author.trim() : "";
  const type = typeof input.type === "string" ? input.type : "";
  const module = typeof input.module === "string" ? input.module : "";
  const language = typeof input.language === "string" ? input.language : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const urlValue = typeof input.url === "string" ? input.url.trim() : "";

  if (!title || title.length > 180) {
    throw new ApiError(400, "Le titre doit contenir entre 1 et 180 caractères.");
  }
  if (author.length > 160) {
    throw new ApiError(400, "Le nom de l’auteur ou de l’éditeur ne peut dépasser 160 caractères.");
  }
  if (!RESOURCE_TYPES.has(type)) {
    throw new ApiError(400, "Choisissez un type de ressource proposé.");
  }
  if (!courseModules.includes(module)) {
    throw new ApiError(400, "Choisissez l’un des modules du cours.");
  }
  if (!LANGUAGES.has(language)) {
    throw new ApiError(400, "Choisissez une langue proposée.");
  }
  if (description.length > 500 || notes.length > 10_000) {
    throw new ApiError(400, "La description ou les notes sont trop longues.");
  }
  if (urlValue.length > 2048) {
    throw new ApiError(400, "Le lien est trop long.");
  }

  let url = "";
  if (urlValue) {
    try {
      url = new URL(urlValue).href;
    } catch {
      throw new ApiError(400, "Saisissez un lien HTTPS valide ou laissez ce champ vide.");
    }
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
      throw new ApiError(400, "Utilisez un lien HTTPS sans identifiants intégrés.");
    }
  }

  return { title, author, type, module, language, url, description, notes };
}

async function readResources(dataFile) {
  const contents = await readFile(dataFile, "utf8");
  const resources = JSON.parse(contents);
  if (!Array.isArray(resources)) {
    throw new Error("The resource data file must contain a JSON array.");
  }
  return resources;
}

function publicResource(resource) {
  const { id, title, author, type, module, language, url, description, notes, pageText, embedding } = resource;
  return {
    id,
    title,
    author,
    type,
    module,
    language,
    url,
    description,
    notes,
    pageIndexed: Boolean(pageText),
    aiIndexed: Boolean(title || description || notes || pageText || embedding),
  };
}

async function writeResources(dataFile, resources) {
  const temporaryFile = `${dataFile}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, `${JSON.stringify(resources, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryFile, dataFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

function createFileResourceStore(dataFile) {
  return {
    list: () => readResources(dataFile),
    async create(resource) {
      const resources = await readResources(dataFile);
      await writeResources(dataFile, [...resources, resource]);
    },
    async update(id, resource) {
      const resources = await readResources(dataFile);
      const index = resources.findIndex((entry) => entry.id === id);
      if (index === -1) return false;
      resources[index] = resource;
      await writeResources(dataFile, resources);
      return true;
    },
    async remove(id) {
      const resources = await readResources(dataFile);
      const updated = resources.filter((entry) => entry.id !== id);
      if (updated.length === resources.length) return false;
      await writeResources(dataFile, updated);
      return true;
    },
  };
}

export async function ensureDataFile(dataFile = DEFAULT_DATA_FILE) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await readFile(dataFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await copyFile(SEED_FILE, dataFile);
  }
}

export function createServer({
  adminUsername = process.env.ADMIN_USERNAME,
  adminPassword = process.env.ADMIN_PASSWORD,
  dataFile = process.env.DATA_FILE || DEFAULT_DATA_FILE,
  resourceStore,
  production = process.env.NODE_ENV === "production",
  pageIndexer = fetchPageText,
  aiAnswer = askGroqModel,
} = {}) {
  if (
    typeof adminUsername !== "string" ||
    !adminUsername.trim() ||
    adminUsername.length > 64
  ) {
    throw new Error("Définissez ADMIN_USERNAME (64 caractères maximum).");
  }
  if (typeof adminPassword !== "string" || adminPassword.length < 16) {
    throw new Error("Définissez un ADMIN_PASSWORD unique d’au moins 16 caractères.");
  }
  const store = resourceStore || createSupabaseResourceStore() || createFileResourceStore(dataFile);

  const sessions = new Map();
  const loginAttempts = new Map();
  const assistantRequests = new Map();
  let mutationQueue = Promise.resolve();

  const serializeMutation = (operation) => {
    const result = mutationQueue.then(operation);
    mutationQueue = result.catch(() => {});
    return result;
  };

  const sessionFor = (request) => {
    const token = cookiesFromHeader(request.headers.cookie)[COOKIE_NAME];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { token, session };
  };

  const setSecurityHeaders = (response) => {
    response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (production) {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  };

  const requireSameOrigin = (request) => {
    const origin = request.headers.origin;
    if (!origin) return;
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ApiError(403, "Cette demande ne provient pas de ce site.");
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.host !== request.headers.host
    ) {
      throw new ApiError(403, "Cette demande ne provient pas de ce site.");
    }
  };

  const enforceLoginLimit = (request) => {
    const ip = request.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (!record || now - record.startedAt >= LOGIN_WINDOW_MS) {
      loginAttempts.set(ip, { count: 0, startedAt: now });
      return ip;
    }
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      throw new ApiError(429, "Trop de tentatives de connexion. Réessayez dans 15 minutes.");
    }
    return ip;
  };

  const enforceAssistantLimit = (request) => {
    const ip = request.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = assistantRequests.get(ip);
    if (!record || now - record.startedAt >= 60_000) {
      assistantRequests.set(ip, { count: 1, startedAt: now });
      return;
    }
    if (record.count >= MAX_AI_REQUESTS_PER_MINUTE) {
      throw new ApiError(429, "Trop de questions en peu de temps. Réessayez dans une minute.");
    }
    record.count += 1;
  };

  const server = createHttpServer(async (request, response) => {
    setSecurityHeaders(response);

    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const { pathname } = requestUrl;

      if (pathname.startsWith("/api/")) {
        if (request.method === "GET" && pathname === "/api/resources") {
          jsonResponse(response, 200, (await store.list()).map(publicResource));
          return;
        }

        if (request.method === "GET" && pathname === "/api/session") {
          jsonResponse(response, 200, { authenticated: Boolean(sessionFor(request)) });
          return;
        }

        if (request.method === "POST") {
          requireSameOrigin(request);
          const body = await readJson(request);

          if (pathname === "/api/ask") {
            enforceAssistantLimit(request);
            const question = typeof body.question === "string" ? body.question.trim() : "";
            const language = typeof body.language === "string" ? body.language : "";
            if (!question || question.length > 2000) {
              throw new ApiError(400, "La question doit contenir entre 1 et 2 000 caractères.");
            }
            if (!LANGUAGES.has(language)) {
              throw new ApiError(400, "Choisissez une langue de réponse proposée.");
            }
            const resources = await store.list();
            try {
              jsonResponse(response, 200, await aiAnswer({
                question,
                language,
                resources,
              }));
            } catch (error) {
              console.error("Hosted AI request failed:", error.message);
              jsonResponse(response, 503, {
                error: "L’assistant Groq est indisponible. Vérifiez GROQ_API_KEY et la configuration du modèle.",
              });
            }
            return;
          }

          if (pathname === "/api/login") {
            const ip = enforceLoginLimit(request);
            const username = typeof body.username === "string" ? body.username : "";
            const password = typeof body.password === "string" ? body.password : "";
            const valid =
              safeEqual(username, adminUsername) && safeEqual(password, adminPassword);
            if (!valid) {
              const record = loginAttempts.get(ip);
              record.count += 1;
              jsonResponse(response, 401, { error: "Identifiant ou mot de passe incorrect." });
              return;
            }

            loginAttempts.delete(ip);
            const token = randomBytes(32).toString("base64url");
            sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
            const secure = production ? "; Secure" : "";
            response.setHeader(
              "Set-Cookie",
              `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
            );
            jsonResponse(response, 200, { authenticated: true });
            return;
          }

          if (pathname === "/api/logout") {
            const currentSession = sessionFor(request);
            if (currentSession) sessions.delete(currentSession.token);
            response.setHeader(
              "Set-Cookie",
              `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? "; Secure" : ""}`,
            );
            jsonResponse(response, 200, { authenticated: false });
            return;
          }

          if (pathname === "/api/resources") {
            const currentSession = sessionFor(request);
            if (!currentSession) {
              throw new ApiError(401, "Connectez-vous pour gérer les ressources.");
            }
            const details = validateResource(body);
            let pageText = "";
            let indexingError = "";
            if (details.url) {
              try {
                pageText = await pageIndexer(details.url);
              } catch (error) {
                indexingError = "Ressource enregistrée, mais page non indexée. Ajoutez des notes manuellement.";
              }
            }
            const resourceFields = { ...details, pageText };
            const resource = {
              id: randomUUID(),
              ...resourceFields,
              createdAt: new Date().toISOString(),
            };
            const resources = await serializeMutation(async () => {
              await store.create(resource);
              return store.list();
            });
            jsonResponse(response, 201, {
              resource: publicResource(resource),
              resources: resources.map(publicResource),
              indexingError,
            });
            return;
          }
        }

        const resourceMatch = pathname.match(/^\/api\/resources\/([0-9a-f-]{36})$/i);
        if (resourceMatch && ["PATCH", "DELETE"].includes(request.method)) {
          requireSameOrigin(request);
          const currentSession = sessionFor(request);
          if (!currentSession) {
            throw new ApiError(401, "Connectez-vous pour gérer les ressources.");
          }

          const resourceId = resourceMatch[1];
          const body = request.method === "PATCH" ? await readJson(request) : null;
          const currentResources = await store.list();
          const existingResource = currentResources.find((resource) => resource.id === resourceId);
          if (!existingResource) {
            throw new ApiError(404, "Cette ressource n’existe plus dans la bibliothèque.");
          }
          let updatedDetails = null;
          let pageText = existingResource.pageText || "";
          let indexingError = "";
          if (request.method === "PATCH") {
            updatedDetails = validateResource(body);
            if (updatedDetails.url !== existingResource.url) {
              pageText = "";
              if (updatedDetails.url) {
                try {
                  pageText = await pageIndexer(updatedDetails.url);
                } catch (error) {
                  indexingError = "Ressource enregistrée, mais page non indexée. Ajoutez des notes manuellement.";
                }
              }
            }
          }
          const result = await serializeMutation(async () => {
            if (request.method === "DELETE") {
              const removed = currentResources.find((resource) => resource.id === resourceId);
              if (!await store.remove(resourceId)) {
                throw new ApiError(404, "Cette ressource n’existe plus dans la bibliothèque.");
              }
              const updated = await store.list();
              return {
                removed: publicResource(removed),
                resources: updated.map(publicResource),
              };
            }
            const updatedResource = {
              ...existingResource,
              ...updatedDetails,
              pageText,
              updatedAt: new Date().toISOString(),
            };
            if (!await store.update(resourceId, updatedResource)) {
              throw new ApiError(404, "Cette ressource n’existe plus dans la bibliothèque.");
            }
            const updated = await store.list();
            return {
              resource: publicResource(updatedResource),
              resources: updated.map(publicResource),
            };
          });
          jsonResponse(response, 200, { ...result, indexingError });
          return;
        }

        jsonResponse(response, 405, { error: "Cette route API ne prend pas en charge cette demande." }, {
          Allow: "GET, POST, PATCH, DELETE",
        });
        return;
      }

      if (!["GET", "HEAD"].includes(request.method)) {
        jsonResponse(response, 405, { error: "Utilisez GET pour ouvrir cette page." }, { Allow: "GET, HEAD" });
        return;
      }

      const files = {
        "/": ["index.html", "text/html; charset=utf-8"],
        "/index.html": ["index.html", "text/html; charset=utf-8"],
        "/course-app.js": ["course-app.js", "text/javascript; charset=utf-8"],
        "/styles.css": ["styles.css", "text/css; charset=utf-8"],
      };
      const file = files[pathname];
      if (!file) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const contents = await readFile(path.join(PUBLIC_DIR, file[0]));
      response.writeHead(200, {
        "Content-Type": file[1],
        "Cache-Control": pathname === "/" || pathname === "/index.html"
          ? "no-store"
          : "no-cache",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch (error) {
      if (error instanceof ApiError) {
        jsonResponse(response, error.status, { error: error.message });
        return;
      }
      console.error("Request failed:", error);
      jsonResponse(response, 500, { error: "The server could not complete that request." });
    }
  });

  return server;
}

async function start() {
  if (!process.env.SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await ensureDataFile();
  }
  const server = createServer();
  const host = process.env.HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.PORT || "4173", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT doit être un nombre compris entre 1 et 65 535.");
  }
  server.listen(port, host, () => {
    console.log(`Bibliothèque des ressources du cours disponible sur http://${host}:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
