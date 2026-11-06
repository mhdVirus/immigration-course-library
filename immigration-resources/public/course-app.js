const modules = [
  "الهجرة و المجتمع المدني:المفاهيم و الرهانات",
  "مدخل الى سوسيولوجيا الهجرة",
  "الهجرة و الرقمنة و النوع الاجتماعي",
  "انثروبولوجيا الحركية و العبور",
  "السياسات العمومية للهجرة و اللجوء",
];

const resourceTypes = [
  ["book", "Livre"],
  ["article", "Article"],
  ["link", "Lien / site web"],
  ["course-material", "Support de cours"],
];

const resourceLanguages = [
  ["ar", "Arabe"],
  ["fr", "Français"],
  ["en", "Anglais"],
  ["es", "Espagnol"],
  ["el", "Grec"],
];

const typeLabels = Object.fromEntries(resourceTypes);
const languageLabels = Object.fromEntries(resourceLanguages);
const elements = {
  ownerToggle: document.querySelector("#owner-toggle"),
  ownerPanel: document.querySelector("#owner-panel"),
  ownerClose: document.querySelector("#owner-close"),
  ownerHeading: document.querySelector("#owner-heading"),
  loginForm: document.querySelector("#login-form"),
  addForm: document.querySelector("#add-form"),
  ownerFooter: document.querySelector("#owner-panel-footer"),
  logoutButton: document.querySelector("#logout-button"),
  search: document.querySelector("#search-input"),
  module: document.querySelector("#module-filter"),
  list: document.querySelector("#resource-list"),
  count: document.querySelector("#result-count"),
  status: document.querySelector("#directory-status"),
  questionForm: document.querySelector("#question-form"),
  question: document.querySelector("#question-input"),
  askButton: document.querySelector("#ask-button"),
  assistantStatus: document.querySelector("#assistant-status"),
  assistantAnswer: document.querySelector("#assistant-answer"),
  answerText: document.querySelector("#answer-text"),
  answerSources: document.querySelector("#answer-sources"),
};

let resources = [];
let authenticated = false;

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "La demande n’a pas abouti.");
  return data;
}

function setStatus(message = "") {
  elements.status.textContent = message;
}

function setOwnerState(isAuthenticated) {
  authenticated = isAuthenticated;
  elements.loginForm.hidden = isAuthenticated;
  elements.addForm.hidden = !isAuthenticated;
  elements.ownerFooter.hidden = !isAuthenticated;
  elements.ownerHeading.textContent = isAuthenticated ? "Ajouter une ressource" : "Accès responsable";
  elements.ownerToggle.textContent = isAuthenticated ? "Gérer la bibliothèque" : "Accès responsable";
  renderResources();
}

function selectField(labelText, name, options, value) {
  const label = document.createElement("label");
  label.className = `field-${name}`;
  label.append(document.createTextNode(labelText));
  const select = document.createElement("select");
  select.name = name;
  select.required = true;
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    select.append(option);
  }
  if (value) select.value = value;
  label.append(select);
  return label;
}

function moduleField(value) {
  const options = [["", "Choisir un module"], ...modules.map((moduleName) => [moduleName, moduleName])];
  const field = selectField("Module du cours", "module", options, value);
  for (const option of field.querySelectorAll("option")) {
    if (option.value) {
      option.dir = "rtl";
      option.lang = "ar";
    }
  }
  return field;
}

function makeField(labelText, name, value = "", type = "text") {
  const label = document.createElement("label");
  label.className = `field-${name}`;
  label.append(document.createTextNode(labelText));

  let input;
  if (name === "type") {
    input = selectField(labelText, name, resourceTypes, value).querySelector("select");
    label.replaceChildren(document.createTextNode(labelText), input);
  } else if (name === "language") {
    input = selectField(labelText, name, resourceLanguages, value || "fr").querySelector("select");
    label.replaceChildren(document.createTextNode(labelText), input);
  } else if (name === "module") {
    return moduleField(value);
  } else if (name === "description" || name === "notes") {
    input = document.createElement("textarea");
    input.maxLength = name === "notes" ? 10000 : 500;
    input.value = value;
    input.required = false;
  } else {
    input = document.createElement("input");
    input.type = type;
    input.value = value;
    input.required = name === "title" || name === "type" || name === "module" || name === "language";
    if (name === "title") input.maxLength = 180;
    if (name === "author") input.maxLength = 160;
    if (name === "url") input.maxLength = 2048;
  }
  input.name = name;
  label.append(input);
  return label;
}

function createResourceForm(initial = null, onCancel = null) {
  const form = document.createElement("form");
  form.className = initial ? "resource-form resource-edit-form" : "resource-form";
  form.append(
    makeField("Titre", "title", initial?.title || ""),
    makeField("Auteur / éditeur", "author", initial?.author || ""),
    makeField("Type de ressource", "type", initial?.type || "book"),
    makeField("Module", "module", initial?.module || ""),
    makeField("Langue de la ressource", "language", initial?.language || "fr"),
    makeField("Lien HTTPS (facultatif)", "url", initial?.url || "", "url"),
    makeField("Description", "description", initial?.description || ""),
    makeField("Notes de cours (utilisées par l’assistant)", "notes", initial?.notes || ""),
  );

  const actions = document.createElement("div");
  actions.className = "form-actions";
  const submit = document.createElement("button");
  submit.className = "button button-primary";
  submit.type = "submit";
  submit.textContent = initial ? "Enregistrer les modifications" : "Ajouter à la bibliothèque";
  actions.append(submit);
  if (onCancel) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "text-button";
    cancel.textContent = "Annuler";
    cancel.addEventListener("click", onCancel);
    actions.append(cancel);
  }
  form.append(actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    try {
      const path = initial ? `/api/resources/${initial.id}` : "/api/resources";
      const result = await request(path, {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      resources = result.resources;
      setStatus(result.indexingError || (initial ? "Ressource mise à jour." : "Ressource ajoutée."));
      if (!initial) form.reset();
      renderResources();
    } catch (error) {
      setStatus(error.message);
    }
  });
  return form;
}

function createText(tag, className, value, language = null) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  if (language) {
    element.lang = language;
    element.dir = language === "ar" ? "rtl" : "auto";
  }
  return element;
}

function renderEditForm(resource, row) {
  row.replaceChildren(createResourceForm(resource, renderResources));
}

function renderResources() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const moduleName = elements.module.value;
  const visible = resources.filter((resource) => {
    const matchesModule = !moduleName || resource.module === moduleName;
    const searchable = [
      resource.title,
      resource.author,
      resource.module,
      typeLabels[resource.type],
      resource.description,
      resource.notes,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return matchesModule && searchable.includes(query);
  });

  elements.count.textContent = `${visible.length} ${visible.length === 1 ? "ressource" : "ressources"}`;
  elements.list.replaceChildren();
  if (visible.length === 0) {
    const empty = document.createElement("li");
    empty.className = "resource-empty";
    empty.textContent = resources.length
      ? "Aucune ressource ne correspond. Modifiez le module ou la recherche."
      : "La bibliothèque est vide. Connectez-vous pour ajouter les premiers livres, articles ou liens du cours.";
    elements.list.append(empty);
    return;
  }

  for (const resource of visible) {
    const row = document.createElement("li");
    row.className = "resource-row";
    const titleGroup = document.createElement("div");
    titleGroup.append(
      createText("h3", "resource-title", resource.title, resource.language),
      createText("p", "resource-publisher", resource.author || "Auteur ou éditeur non indiqué"),
    );
    const moduleBadge = createText("span", "resource-module", resource.module, "ar");
    const detailGroup = document.createElement("div");
    detailGroup.className = "resource-detail";
    detailGroup.append(
      createText("span", "resource-type", typeLabels[resource.type] || resource.type),
      createText("span", "resource-language", languageLabels[resource.language] || resource.language),
    );
    if (resource.description) {
      detailGroup.append(createText("p", "resource-description", resource.description, resource.language));
    }
    if (resource.notes) {
      detailGroup.append(createText("p", "resource-notes", resource.notes, resource.language));
    }
    if (resource.pageIndexed) {
      detailGroup.append(createText("span", "indexed-label", "Page web indexée pour l’assistant"));
    } else if (resource.aiIndexed) {
      detailGroup.append(createText("span", "indexed-label", "Référence indexée pour l’assistant"));
    }
    row.append(titleGroup, moduleBadge, detailGroup);
    if (resource.url) {
      const link = document.createElement("a");
      link.className = "resource-link";
      link.href = resource.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Ouvrir la source ↗";
      link.lang = "fr";
      row.append(link);
    }

    if (authenticated) {
      const actions = document.createElement("div");
      actions.className = "resource-actions";
      const edit = document.createElement("button");
      edit.className = "text-button";
      edit.type = "button";
      edit.textContent = "Modifier";
      edit.addEventListener("click", () => renderEditForm(resource, row));
      const remove = document.createElement("button");
      remove.className = "text-button";
      remove.type = "button";
      remove.textContent = "Supprimer";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Supprimer « ${resource.title} » de la bibliothèque ?`)) return;
        try {
          const result = await request(`/api/resources/${resource.id}`, { method: "DELETE" });
          resources = result.resources;
          setStatus("Ressource supprimée.");
          renderResources();
        } catch (error) {
          setStatus(error.message);
        }
      });
      actions.append(edit, remove);
      row.append(actions);
    }
    elements.list.append(row);
  }
}

function addAnswerSources(sources) {
  elements.answerSources.replaceChildren();
  if (!sources.length) return;
  const heading = document.createElement("h4");
  heading.textContent = "Références consultées";
  const list = document.createElement("ol");
  list.className = "answer-source-list";
  for (const source of sources) {
    const item = document.createElement("li");
    const title = document.createElement("span");
    title.textContent = `${source.title} — ${source.module}`;
    title.dir = "auto";
    item.append(title);
    if (source.url) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Ouvrir";
      link.lang = "fr";
      item.append(document.createTextNode(" "), link);
    }
    list.append(item);
  }
  elements.answerSources.append(heading, list);
}

elements.ownerToggle.addEventListener("click", () => {
  const opening = elements.ownerPanel.hidden;
  elements.ownerPanel.hidden = !opening;
  elements.ownerToggle.setAttribute("aria-expanded", String(opening));
  if (opening) elements.ownerPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

elements.ownerClose.addEventListener("click", () => {
  elements.ownerPanel.hidden = true;
  elements.ownerToggle.setAttribute("aria-expanded", "false");
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(elements.loginForm));
  try {
    await request("/api/login", { method: "POST", body: JSON.stringify(values) });
    elements.loginForm.reset();
    setOwnerState(true);
    setStatus("Connexion réussie. Vous pouvez ajouter et modifier les ressources.");
  } catch (error) {
    setStatus(error.message);
  }
});

elements.addForm.replaceWith(createResourceForm());
elements.addForm = document.querySelector("#owner-panel .resource-form");

elements.logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/logout", { method: "POST", body: "{}" });
    setOwnerState(false);
    setStatus("Vous êtes déconnecté·e.");
  } catch (error) {
    setStatus(error.message);
  }
});

elements.questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = elements.question.value.trim();
  if (!question) return;
  elements.askButton.disabled = true;
  elements.askButton.textContent = "Recherche en cours…";
  elements.assistantStatus.textContent = "Recherche dans les ressources enregistrées…";
  elements.assistantAnswer.hidden = true;
  try {
    const result = await request("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, language: "fr" }),
    });
    elements.answerText.textContent = result.answer;
    addAnswerSources(result.sources);
    elements.assistantAnswer.hidden = false;
    elements.assistantStatus.textContent = "";
  } catch (error) {
    elements.assistantStatus.textContent = error.message;
  } finally {
    elements.askButton.disabled = false;
    elements.askButton.textContent = "Interroger l’assistant";
  }
});

elements.search.addEventListener("input", renderResources);
elements.module.addEventListener("change", renderResources);
document.querySelector("#filter-form").addEventListener("submit", (event) => event.preventDefault());

async function initialize() {
  for (const moduleName of modules) {
    const option = document.createElement("option");
    option.value = moduleName;
    option.textContent = moduleName;
    option.dir = "rtl";
    option.lang = "ar";
    elements.module.append(option);
  }
  try {
    const [loadedResources, session] = await Promise.all([
      request("/api/resources"),
      request("/api/session"),
    ]);
    resources = loadedResources;
    setOwnerState(session.authenticated);
    setStatus("");
  } catch (error) {
    setStatus(`Impossible de charger la bibliothèque : ${error.message}`);
    elements.list.replaceChildren();
  }
}

initialize();
