const state = {
  config: null,
  cards: [],
  filteredCards: [],
  sections: [],
  monaco: null,
  monacoReady: false,
  monacoLoading: null,
};

const elements = {
  title: document.getElementById("page-title"),
  subtitle: document.getElementById("page-subtitle"),
  search: document.getElementById("search-input"),
  clear: document.getElementById("clear-search"),
  sections: document.getElementById("sections"),
  empty: document.getElementById("empty-state"),
  count: document.getElementById("result-count"),
  editButton: document.getElementById("edit-config"),
  overlay: document.getElementById("editor-overlay"),
  editorStatus: document.getElementById("editor-status"),
  textarea: document.getElementById("config-text"),
  monacoHost: document.getElementById("monaco"),
  save: document.getElementById("save-config"),
  cancel: document.getElementById("cancel-edit"),
};

const normalize = (value) => (value || "").toString().toLowerCase();

function getTokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter(Boolean);
}

function getItemKeywords(item) {
  const raw = item.keyword ?? item.keywords;
  if (Array.isArray(raw)) {
    return raw.map((entry) => normalize(entry)).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[, ]+/)
      .map((entry) => normalize(entry))
      .filter(Boolean);
  }
  return [];
}

async function fetchConfig() {
  const response = await fetch("/api/config");
  state.config = await response.json();
  renderPage();
}

const COLLAPSE_KEY = "crossroads:collapsed";

function getCollapsedState() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function setCollapsedState(nextState) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(nextState));
}

function isSectionCollapsed(name) {
  const stateMap = getCollapsedState();
  if (!(name in stateMap)) return true;
  return Boolean(stateMap[name]);
}

function updateSectionCollapsed(name, collapsed) {
  const stateMap = getCollapsedState();
  stateMap[name] = collapsed;
  setCollapsedState(stateMap);
}

function setSectionCollapsed(wrapper, collapsed) {
  wrapper.classList.toggle("section--collapsed", collapsed);
  const toggle = wrapper.querySelector(".section__toggle");
  const icon = toggle?.querySelector("i");
  if (toggle) {
    toggle.setAttribute("aria-expanded", (!collapsed).toString());
    toggle.title = collapsed ? "Expand section" : "Collapse section";
  }
  if (icon) {
    icon.className = collapsed ? "mdi mdi-chevron-down" : "mdi mdi-chevron-up";
  }
}

function renderPage() {
  const { title, subtitle, searchPlaceholder, sections = [] } = state.config || {};
  if (title) elements.title.textContent = title;
  if (subtitle) elements.subtitle.textContent = subtitle;
  if (searchPlaceholder) elements.search.placeholder = searchPlaceholder;

  elements.sections.innerHTML = "";
  state.cards = [];
  state.sections = [];

  sections.forEach((section, sectionIndex) => {
    const wrapper = document.createElement("section");
    wrapper.className = "section";
    wrapper.dataset.section = section.name || "";

    const header = document.createElement("div");
    header.className = "section__header";

    const icon = document.createElement("i");
    icon.className = `mdi ${section.icon || "mdi-atom"} section__icon`;

    const titleEl = document.createElement("h2");
    titleEl.textContent = section.name || "Untitled";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "section__toggle";
    toggle.innerHTML = "<i class=\"mdi mdi-chevron-down\"></i>";
    toggle.addEventListener("click", () => {
      const collapsed = !wrapper.classList.contains("section--collapsed");
      setSectionCollapsed(wrapper, collapsed);
      updateSectionCollapsed(section.name || "", collapsed);
    });

    header.append(icon, titleEl, toggle);
    wrapper.append(header);

    const grid = document.createElement("div");
    grid.className = "section__grid";

    (section.items || []).forEach((item, index) => {
      const card = document.createElement("a");
      card.className = "card";
      card.href = item.url || "#";
      card.target = "_blank";
      card.rel = "noreferrer";
      card.title = item.url || "";
      const keywords = getItemKeywords(item);
      card.dataset.keywords = keywords.join(" ");
      card.dataset.search = [item.title, item.url, item.description, keywords.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const iconWrap = document.createElement("div");
      iconWrap.className = "card__icon";
      const iconEl = document.createElement("i");
      iconEl.className = `mdi ${item.icon || "mdi-atom"}`;
      iconWrap.append(iconEl);

      const textWrap = document.createElement("div");
      const titleText = document.createElement("div");
      titleText.className = "card__title";
      titleText.textContent = item.title || "Untitled";
      textWrap.append(titleText);

      if (item.description) {
        const meta = document.createElement("div");
        meta.className = "card__meta";
        meta.textContent = item.description;
        textWrap.append(meta);
      }

      card.append(iconWrap, textWrap);
      card.style.animationDelay = `${Math.min(index * 0.03, 0.4)}s`;
      grid.append(card);
      state.cards.push({ card, section: wrapper, item });
    });

    wrapper.append(grid);
    wrapper.style.animationDelay = `${Math.min(sectionIndex * 0.05, 0.4)}s`;
    elements.sections.append(wrapper);
    state.sections.push({ name: section.name || "", wrapper });

    const collapsed = isSectionCollapsed(section.name || "");
    setSectionCollapsed(wrapper, collapsed);
  });

  applyFilter("");
}

function applyFilter(value) {
  const query = normalize(value).trim();
  const tokens = getTokens(query);
  let visible = 0;
  const sectionCounts = new Map();

  state.cards.forEach(({ card, section }) => {
    const keywords = (card.dataset.keywords || "")
      .split(/\s+/)
      .filter(Boolean);
    let matches = tokens.length === 0;
    if (!matches) {
      matches = tokens.every((token) => card.dataset.search.includes(token));
    }
    if (!matches && tokens.length > 0 && keywords.length > 0) {
      matches = keywords.includes(tokens[0]);
    }
    card.classList.toggle("is-hidden", !matches);
    if (matches) visible += 1;
    const count = sectionCounts.get(section) || 0;
    sectionCounts.set(section, count + (matches ? 1 : 0));
  });

  sectionCounts.forEach((count, section) => {
    section.hidden = count === 0;
    if (query) {
      setSectionCollapsed(section, false);
    } else {
      const name = section.dataset.section || "";
      setSectionCollapsed(section, isSectionCollapsed(name));
    }
  });

  elements.empty.hidden = visible !== 0;
  elements.count.textContent = `${visible} result${visible === 1 ? "" : "s"}`;
}

function buildSearchUrl(item, query) {
  const searchUrl = item.searchUrl || item.search_url;
  if (searchUrl && query) {
    return searchUrl.replace("%s", encodeURIComponent(query));
  }
  return item.url || "";
}

function findItemByKeyword(keyword) {
  const target = normalize(keyword);
  if (!target) return null;
  const matches = state.cards
    .map(({ item }) => item)
    .filter((item) => getItemKeywords(item).includes(target));
  if (matches.length === 1) return matches[0];
  return null;
}

function resolveCommandTarget(query) {
  const tokens = getTokens(query);
  if (!tokens.length) return "";
  const directItem = findItemByKeyword(tokens[0]);
  if (directItem) {
    const remainder = tokens.slice(1).join(" ");
    return buildSearchUrl(directItem, remainder);
  }

  const visibleCards = state.cards.filter(
    ({ card }) => !card.classList.contains("is-hidden")
  );
  if (visibleCards.length === 1) {
    const only = visibleCards[0].item;
    return buildSearchUrl(only, "");
  }
  return "";
}

function getFocusableCards() {
  return state.cards
    .filter(
      ({ card, section }) =>
        !card.classList.contains("is-hidden") &&
        !section.classList.contains("section--collapsed")
    )
    .map(({ card }) => card);
}

function ensureFirstSectionExpanded() {
  const candidate = state.sections.find(({ wrapper }) => {
    if (wrapper.hidden || wrapper.classList.contains("section--collapsed")) {
      const hasVisibleCard = [...wrapper.querySelectorAll(".card")].some(
        (card) => !card.classList.contains("is-hidden")
      );
      return hasVisibleCard;
    }
    return false;
  });
  if (candidate) {
    setSectionCollapsed(candidate.wrapper, false);
    updateSectionCollapsed(candidate.name, false);
  }
}

function focusSearch() {
  requestAnimationFrame(() => elements.search.focus());
}

async function openEditor() {
  elements.editorStatus.textContent = "Loading config...";
  elements.overlay.hidden = false;
  elements.textarea.value = "";
  elements.textarea.hidden = false;
  elements.monacoHost.hidden = true;

  const response = await fetch("/api/config/raw");
  const raw = await response.text();
  elements.textarea.value = raw;

  try {
    await ensureMonaco();
    if (state.monaco) {
      state.monaco.setValue(raw);
      elements.monacoHost.hidden = false;
      elements.textarea.hidden = true;
    }
    elements.editorStatus.textContent = "";
  } catch (error) {
    elements.editorStatus.textContent = `Monaco failed to load: ${error.message}`;
  }
}

function closeEditor() {
  elements.overlay.hidden = true;
  elements.editorStatus.textContent = "";
}

async function saveConfig() {
  const payload = state.monaco ? state.monaco.getValue() : elements.textarea.value;
  elements.editorStatus.textContent = "Saving...";

  const response = await fetch("/api/config/raw", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: payload,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: "Save failed" }));
    elements.editorStatus.textContent = detail.detail || "Save failed";
    return;
  }

  elements.editorStatus.textContent = "Saved.";
  await fetchConfig();
  closeEditor();
}

function ensureMonaco() {
  if (state.monacoReady) return Promise.resolve();
  if (state.monacoLoading) return state.monacoLoading;

  state.monacoLoading = new Promise((resolve, reject) => {
    window.MonacoEnvironment = {
      getWorkerUrl() {
        const workerUrl =
          "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/base/worker/workerMain.js";
        const blob = [
          "self.MonacoEnvironment={baseUrl:'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/'};",
          `importScripts('${workerUrl}');`,
        ].join("");
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(blob)}`;
      },
    };

    if (window.monaco && window.monaco.editor) {
      state.monacoReady = true;
      state.monaco = window.monaco.editor.create(elements.monacoHost, {
        value: "",
        language: "yaml",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
      });
      resolve();
      return;
    }

    const loader = document.createElement("script");
    loader.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js";
    loader.onload = () => {
      if (!window.require) {
        reject(new Error("Monaco loader did not expose require"));
        return;
      }
      window.require.config({
        paths: {
          vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
        },
      });
      window.require(["vs/editor/editor.main"], () => {
        if (!window.monaco || !window.monaco.editor) {
          reject(new Error("Monaco editor not available after load"));
          return;
        }
        state.monacoReady = true;
        state.monaco = window.monaco.editor.create(elements.monacoHost, {
          value: "",
          language: "yaml",
          theme: "vs-dark",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
        });
        resolve();
      });
    };
    loader.onerror = () => reject(new Error("Monaco loader failed to download"));
    document.body.append(loader);
  });

  return state.monacoLoading;
}

function wireEvents() {
  elements.overlay.hidden = true;

  window.addEventListener(
    "keydown",
    (event) => {
      if (
        (event.key === "Tab" || event.code === "Tab") &&
        document.activeElement === elements.search
      ) {
        let focusable = getFocusableCards();
        if (!focusable.length) {
          ensureFirstSectionExpanded();
          focusable = getFocusableCards();
        }
        if (focusable.length) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    },
    true
  );

  elements.search.addEventListener("input", (event) => {
    applyFilter(event.target.value);
  });

  elements.search.addEventListener("keydown", (event) => {
    if (event.key === "Tab" || event.code === "Tab") {
      let focusable = getFocusableCards();
      if (!focusable.length) {
        ensureFirstSectionExpanded();
        focusable = getFocusableCards();
      }
      if (focusable.length) {
        event.preventDefault();
        focusable[0].focus();
      }
      return;
    }
    if (event.key === "Enter") {
      const target = resolveCommandTarget(elements.search.value);
      if (target) {
        window.location.assign(target);
      }
    }
  });

  elements.sections.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
      return;
    }
    const visibleCards = getFocusableCards();
    if (!visibleCards.length) return;

    const current = document.activeElement;
    const currentIndex = visibleCards.indexOf(current);
    if (currentIndex === -1) return;

    event.preventDefault();
    const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
    const nextIndex = (currentIndex + delta + visibleCards.length) % visibleCards.length;
    visibleCards[nextIndex].focus();
  });

  elements.sections.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && event.shiftKey) {
      const card = document.activeElement;
      if (card && card.classList.contains("card")) {
        event.preventDefault();
        focusSearch();
      }
    }
  });

  elements.clear.addEventListener("click", () => {
    elements.search.value = "";
    applyFilter("");
    focusSearch();
  });

  elements.editButton.addEventListener("click", openEditor);
  elements.cancel.addEventListener("click", closeEditor);
  elements.save.addEventListener("click", saveConfig);

  elements.overlay.addEventListener("click", (event) => {
    if (event.target === elements.overlay) closeEditor();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "/" && elements.overlay.hidden) {
      event.preventDefault();
      focusSearch();
    }
    if (event.key === "Escape" && !elements.overlay.hidden) {
      closeEditor();
    }
    if (event.key === "Escape" && elements.overlay.hidden) {
      focusSearch();
    }
  });
}

wireEvents();
fetchConfig().then(() => {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get("q");
  if (initial) {
    elements.search.value = initial;
    applyFilter(initial);
    const target = resolveCommandTarget(initial);
    if (target) {
      window.location.replace(target);
      return;
    }
  }
  focusSearch();
});
