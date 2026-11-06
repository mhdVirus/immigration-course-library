const modules = [
  "الهجرة و المجتمع المدني:المفاهيم و الرهانات",
  "مدخل الى سوسيولوجيا الهجرة",
  "الهجرة و الرقمنة و النوع الاجتماعي",
  "انثروبولوجيا الحركية و العبور",
  "السياسات العمومية للهجرة و اللجوء",
];

const typeLabels = {
  book: "Livre",
  article: "Article",
  link: "Lien / site web",
  "course-material": "Support de cours",
};

const languageLabels = {
  ar: "Arabe",
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  el: "Grec",
};

const elements = {
  search: document.querySelector("#search-input"),
  module: document.querySelector("#module-filter"),
  list: document.querySelector("#resource-list"),
  count: document.querySelector("#result-count"),
  status: document.querySelector("#directory-status"),
};

let resources = [];

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
      : "Aucune référence n’a encore été publiée dans cette bibliothèque.";
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
      createText("span", "resource-type", typeLabels[resource.type]),
      createText("span", "resource-language", languageLabels[resource.language]),
    );
    if (resource.description) {
      detailGroup.append(createText("p", "resource-description", resource.description, resource.language));
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
    elements.list.append(row);
  }
}

function isPublicResource(resource) {
  if (!resource || typeof resource !== "object") return false;
  if (
    typeof resource.title !== "string" ||
    !resource.title.trim() ||
    !modules.includes(resource.module) ||
    !Object.hasOwn(typeLabels, resource.type) ||
    !Object.hasOwn(languageLabels, resource.language)
  ) {
    return false;
  }
  if (resource.url) {
    try {
      if (new URL(resource.url).protocol !== "https:") return false;
    } catch {
      return false;
    }
  }
  return true;
}

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
    const response = await fetch("./resources.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const publishedResources = await response.json();
    if (!Array.isArray(publishedResources)) throw new Error("Format de références invalide");
    resources = publishedResources.filter(isPublicResource);
    elements.status.textContent = "";
    renderResources();
  } catch {
    elements.status.textContent = "Impossible de charger les références. Réessayez plus tard.";
    elements.count.textContent = "";
    elements.list.replaceChildren();
  }
}

elements.search.addEventListener("input", renderResources);
elements.module.addEventListener("change", renderResources);
document.querySelector("#filter-form").addEventListener("submit", (event) => event.preventDefault());

initialize();
