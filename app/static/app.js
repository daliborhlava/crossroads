const state = {
  config: null,
  cards: [],
  filteredCards: [],
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

async function fetchConfig() {
  const response = await fetch("/api/config");
  state.config = await response.json();
  renderPage();
}

function renderPage() {
  const { title, subtitle, searchPlaceholder, sections = [] } = state.config || {};
  if (title) elements.title.textContent = title;
  if (subtitle) elements.subtitle.textContent = subtitle;
  if (searchPlaceholder) elements.search.placeholder = searchPlaceholder;

  elements.sections.innerHTML = "";
  state.cards = [];

  sections.forEach((section, sectionIndex) => {
    const wrapper = document.createElement("section");
    wrapper.className = "section";
    wrapper.dataset.section = section.name || "";

    const header = document.createElement("div");
    header.className = "section__header";

    const icon = document.createElement("i");
    icon.className = `mdi ${section.icon || "mdi-atom"}`;

    const titleEl = document.createElement("h2");
    titleEl.textContent = section.name || "Untitled";

    header.append(icon, titleEl);
    wrapper.append(header);

    const grid = document.createElement("div");
    grid.className = "section__grid";

    (section.items || []).forEach((item, index) => {
      const card = document.createElement("a");
      card.className = "card";
      card.href = item.url || "#";
      card.target = "_blank";
      card.rel = "noreferrer";
      card.dataset.search = [item.title, item.url, item.description, section.name]
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
      const meta = document.createElement("div");
      meta.className = "card__meta";
      meta.textContent = item.url || "";
      textWrap.append(titleText, meta);

      if (item.description) {
        const desc = document.createElement("div");
        desc.className = "card__desc";
        desc.textContent = item.description;
        textWrap.append(desc);
      }

      card.append(iconWrap, textWrap);
      card.style.animationDelay = `${Math.min(index * 0.03, 0.4)}s`;
      grid.append(card);
      state.cards.push({ card, section: wrapper });
    });

    wrapper.append(grid);
    wrapper.style.animationDelay = `${Math.min(sectionIndex * 0.05, 0.4)}s`;
    elements.sections.append(wrapper);
  });

  applyFilter("");
}

function applyFilter(value) {
  const query = normalize(value);
  let visible = 0;
  const sectionCounts = new Map();

  state.cards.forEach(({ card, section }) => {
    const matches = !query || card.dataset.search.includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
    const count = sectionCounts.get(section) || 0;
    sectionCounts.set(section, count + (matches ? 1 : 0));
  });

  sectionCounts.forEach((count, section) => {
    section.hidden = count === 0;
  });

  elements.empty.hidden = visible !== 0;
  elements.count.textContent = `${visible} result${visible === 1 ? "" : "s"}`;
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
    elements.editorStatus.textContent = "Monaco failed to load, using plain editor.";
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
    if (window.monaco) {
      state.monacoReady = true;
      state.monaco = window.monaco.editor.create(elements.monacoHost, {
        value: "",
        language: "yaml",
        theme: "vs",
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
      window.require.config({
        paths: {
          vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
        },
      });
      window.require(["vs/editor/editor.main"], () => {
        state.monacoReady = true;
        state.monaco = window.monaco.editor.create(elements.monacoHost, {
          value: "",
          language: "yaml",
          theme: "vs",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
        });
        resolve();
      });
    };
    loader.onerror = () => reject(new Error("Monaco loader failed"));
    document.body.append(loader);
  });

  return state.monacoLoading;
}

function wireEvents() {
  elements.overlay.hidden = true;

  elements.search.addEventListener("input", (event) => {
    applyFilter(event.target.value);
  });

  elements.search.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const firstVisible = state.cards.find(({ card }) => !card.hidden);
      if (firstVisible) {
        event.preventDefault();
        firstVisible.card.focus();
      }
      return;
    }
    if (event.key === "Enter") {
      const firstVisible = state.cards.find(({ card }) => !card.hidden);
      if (firstVisible) firstVisible.card.click();
    }
  });

  elements.sections.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
      return;
    }
    const visibleCards = state.cards
      .map(({ card }) => card)
      .filter((card) => !card.hidden);
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
fetchConfig().then(() => focusSearch());
