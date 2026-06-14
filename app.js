const DEFAULT_LANGUAGE = "ta";
const DEFAULT_CATEGORY_ICON = "icons/toolbox.svg";

let currentLang = DEFAULT_LANGUAGE;
let translations = {};
let inventoryConfig = {
  schemaVersion: 1,
  lastUpdated: "",
  display: {
    showPrice: true,
    showStatus: true,
    currency: "INR"
  },
  machines: []
};
let currentFilter = "all";
let currentSearch = "";

const statusMap = {
  available: {
    className: "status-available",
    en: "Available",
    ta: "கிடைக்கும்"
  },
  unavailable: {
    className: "status-out",
    en: "Currently Not Available",
    ta: "தற்போது கிடைக்காது"
  }
};

const categoryIconMap = {
  CUTTING: "icons/cutting.svg",
  GRINDING: "icons/grinding.svg",
  DRILLING: "icons/drilling.svg",
  BREAKING: "icons/breaking.svg",
  WELDING: "icons/welding.svg",
  POWER_TOOLS: "icons/toolbox.svg",
  MEASURING_TOOLS: "icons/measuring-tools.svg",
  LIFTING_EQUIPMENT: "icons/lifting-equipment.svg",
  LADDER: "icons/ladder.svg",
  CONCRETE_TOOLS: "icons/mixing.svg",
  CLEANING_EQUIPMENT: "icons/cleaning-equipment.svg",
  ELECTRICAL_TOOLS: "icons/electrical-tools.svg",
  PAINTING_TOOLS: "icons/brush.svg",
  UNKNOWN: "icons/toolbox.svg"
};

const categoryTranslationKeyMap = {
  CUTTING: "cat_cutting",
  GRINDING: "cat_grinding",
  DRILLING: "cat_drilling",
  BREAKING: "cat_breaking",
  WELDING: "cat_welding",
  POWER_TOOLS: "cat_power_tools",
  MEASURING_TOOLS: "cat_measuring_tools",
  LIFTING_EQUIPMENT: "cat_lifting_equipment",
  LADDER: "cat_ladder",
  CONCRETE_TOOLS: "cat_concrete_tools",
  CLEANING_EQUIPMENT: "cat_cleaning_equipment",
  ELECTRICAL_TOOLS: "cat_electrical_tools",
  PAINTING_TOOLS: "cat_painting_tools",
  UNKNOWN: "cat_unknown"
};

document.addEventListener("DOMContentLoaded", () => {
  bindUi();
  initializeWebsiteData();
});

function bindUi() {
  document.querySelectorAll("[data-page-target]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      showPage(element.dataset.pageTarget, element);
    });
  });

  document.querySelectorAll("[data-category-filter]").forEach((element) => {
    element.addEventListener("click", () => {
      filterAndGo(element.dataset.categoryFilter);
    });
  });

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      setFilter(button.dataset.filter, button);
    });
  });

  const langButton = document.getElementById("langBtn");
  if (langButton) langButton.addEventListener("click", toggleLang);

  const navToggle = document.getElementById("navToggle");
  if (navToggle) navToggle.addEventListener("click", toggleNav);

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", filterMachines);
}

async function initializeWebsiteData() {
  try {
    const [languageResponse, inventoryResponse] = await Promise.all([
      fetch("languages.json", { cache: "no-store" }),
      fetch("inventory.json", { cache: "no-store" })
    ]);

    if (!languageResponse.ok || !inventoryResponse.ok) {
      throw new Error("Failed to load site data.");
    }

    translations = await languageResponse.json();
    const loadedInventory = await inventoryResponse.json();
    inventoryConfig = normalizeInventoryConfig(loadedInventory);

    applyLanguageTranslations();
    renderMachines();
  } catch (error) {
    console.error(error);
    const grid = document.getElementById("machinesGrid");
    const noResults = document.getElementById("noResults");
    if (grid) grid.innerHTML = "";
    if (noResults) noResults.hidden = false;
  }
}

function normalizeInventoryConfig(rawConfig) {
  return {
    schemaVersion: rawConfig?.schemaVersion || 1,
    lastUpdated: rawConfig?.lastUpdated || "",
    display: {
      showPrice: rawConfig?.display?.showPrice !== false,
      showStatus: rawConfig?.display?.showStatus !== false,
      currency: rawConfig?.display?.currency || "INR"
    },
    machines: Array.isArray(rawConfig?.machines) ? rawConfig.machines : []
  };
}

function applyLanguageTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    const value = translations?.[currentLang]?.[key];
    if (!value) return;

    if (element.tagName === "INPUT") {
      element.placeholder = value;
      return;
    }

    element.textContent = value;
  });
}

function renderMachines() {
  const grid = document.getElementById("machinesGrid");
  const noResults = document.getElementById("noResults");
  if (!grid) return;

  const query = currentSearch.trim().toLowerCase();
  const filteredMachines = inventoryConfig.machines.filter((machine) => {
    const localizedName = getLocalizedValue(machine.name).toLowerCase();
    const localizedDescription = getLocalizedValue(machine.description).toLowerCase();
    const category = (machine.category || "").toLowerCase();
    const searchable = [localizedName, localizedDescription, category].join(" ");

    const matchesSearch = !query || searchable.includes(query);
    const matchesFilter =
      currentFilter === "all" ||
      machine.category === currentFilter ||
      machine.status === currentFilter;

    return matchesSearch && matchesFilter;
  });

  if (filteredMachines.length === 0) {
    grid.innerHTML = "";
    if (noResults) noResults.hidden = false;
    return;
  }

  if (noResults) noResults.hidden = true;

  grid.innerHTML = filteredMachines
    .map((machine) => {
      const status = statusMap[machine.status] || statusMap.available;
      const imageMarkup = buildMachineImage(machine);
      const pricingMarkup = inventoryConfig.display.showPrice
        ? buildPricing(machine.pricing)
        : "";
      const statusMarkup = inventoryConfig.display.showStatus
        ? `<span class="status-badge ${status.className}">${currentLang === "ta" ? status.ta : status.en}</span>`
        : "";

      return `
        <article class="machine-card">
          <div class="machine-img">${imageMarkup}</div>
          <div class="machine-info">
            <div class="machine-name">${escapeHtml(getLocalizedValue(machine.name) || translateInline("untitled_machine"))}</div>
            <div class="machine-category">${escapeHtml(getCategoryLabel(machine.category))}</div>
            <div class="machine-desc">${escapeHtml(getLocalizedValue(machine.description))}</div>
            ${pricingMarkup}
            ${statusMarkup}
          </div>
        </article>
      `;
    })
    .join("");
}

function buildMachineImage(machine) {
  const image = machine.images?.[0];
  const iconPath = categoryIconMap[machine.category] || DEFAULT_CATEGORY_ICON;
  const displayName = escapeHtml(getLocalizedValue(machine.name) || translateInline("untitled_machine"));

  if (image) {
    return `<img src="${image}" alt="${displayName}" loading="lazy" onerror="this.onerror=null;this.src='${iconPath}'">`;
  }

  return `<img src="${iconPath}" alt="${displayName}" loading="lazy">`;
}

function buildPricing(pricing = {}) {
  const currency = inventoryConfig.display.currency || "INR";
  const formatter = new Intl.NumberFormat(currentLang === "ta" ? "ta-IN" : "en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  });

  const perDay = typeof pricing.rentPerDay === "number" ? formatter.format(pricing.rentPerDay) : null;
  const advance = typeof pricing.advanceAmount === "number" ? formatter.format(pricing.advanceAmount) : null;

  if (!perDay && !advance) return "";

  return `
    <div class="machine-pricing">
      ${perDay ? `<div>${translateInline("price_per_day")}: <strong>${perDay}</strong></div>` : ""}
      ${advance ? `<div>${translateInline("advance_amount")}: <strong>${advance}</strong></div>` : ""}
    </div>
  `;
}

function getCategoryLabel(category) {
  const key = categoryTranslationKeyMap[category];
  return translations?.[currentLang]?.[key] || category || translateInline("cat_unknown");
}

function setFilter(filterValue, buttonElement) {
  currentFilter = filterValue;
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.classList.toggle("active", button === buttonElement);
  });
  renderMachines();
}

function filterMachines(event) {
  currentSearch = event?.target?.value || "";
  renderMachines();
}

function showPage(pageId, navElement = null) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `page-${pageId}`);
  });

  document.querySelectorAll("[data-page-target]").forEach((link) => {
    link.classList.toggle("active", link === navElement || (link.dataset.pageTarget === pageId && navElement === null));
  });

  const navLinks = document.getElementById("navLinks");
  if (navLinks) navLinks.classList.remove("open");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function filterAndGo(category) {
  currentFilter = category || "all";
  currentSearch = "";

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === currentFilter);
  });

  showPage("inventory");
  renderMachines();
}

function toggleLang() {
  currentLang = currentLang === "ta" ? "en" : "ta";
  applyLanguageTranslations();
  renderMachines();
}

function toggleNav() {
  const navLinks = document.getElementById("navLinks");
  if (navLinks) navLinks.classList.toggle("open");
}

function getLocalizedValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[currentLang] || value.en || Object.values(value)[0] || "";
}

function translateInline(key) {
  return translations?.[currentLang]?.[key] || key;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
