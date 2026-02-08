// Brand rotator: smoothly cycles through all brand logos, showing three at a time.
const brandImages = [
  { src: "assets/images/biotech.png", alt: "Biotech" },
  { src: "assets/images/myprotein.png", alt: "Myprotein" },
  { src: "assets/images/dymatiz.png", alt: "Dymatize" },
  { src: "assets/images/mark2.png", alt: "Mark 2" },
  { src: "assets/images/optimum.png", alt: "Optimum Nutrition" },
  { src: "assets/images/iherb.png", alt: "iHerb" },
  { src: "assets/images/scitec.png", alt: "Scitec" },
];

const SHOP_STORE_KEY = "ipro_store";
const SHOP_API_BASE_KEY = "ipro_mock_api_base";
const SHOP_API_PATH_KEY = "ipro_mock_api_path";

const SHOP_CONFIG = {
  shippingThreshold: 300,
  shippingFee: 100,
  pointValue: 2.5,
  pointsEarnRate: 0.4,
  coupons: {
    IPRO10: { type: "percent", value: 0.1, label: "تم تطبيق خصم 10٪" },
    FIT20: { type: "percent", value: 0.2, label: "تم تطبيق خصم 20٪" },
    SAVE15: { type: "fixed", value: 15, label: "تم تطبيق خصم 15 د.ع" },
  },
};

const createEmptyStore = () => ({
  cart: [],
  favorites: [],
  orders: [],
  lastOrderId: null,
  points: {
    balance: 0,
    history: [],
  },
  coupon: null,
  profile: {
    name: "محمد أحمد",
    email: "mohamed2000@gmail.com",
    phone: "07800000000",
  },
  addresses: [
    {
      id: "addr-1",
      label: "المنزل",
      city: "بغداد",
      area: "الكرادة",
      street: "شارع النضال",
      notes: "قرب ساحة اللقاء",
      isDefault: true,
    },
  ],
});

const normalizeStore = (input) => {
  const base = createEmptyStore();
  if (!input || typeof input !== "object") return base;
  return {
    ...base,
    ...input,
    cart: Array.isArray(input.cart) ? input.cart : base.cart,
    favorites: Array.isArray(input.favorites) ? input.favorites : base.favorites,
    orders: Array.isArray(input.orders) ? input.orders : base.orders,
    lastOrderId:
      typeof input.lastOrderId === "string" || typeof input.lastOrderId === "number"
        ? input.lastOrderId
        : base.lastOrderId,
    profile: {
      ...base.profile,
      ...(input.profile || {}),
    },
    addresses: Array.isArray(input.addresses) ? input.addresses : base.addresses,
    points: {
      ...base.points,
      ...(input.points || {}),
      history: Array.isArray(input.points?.history)
        ? input.points.history
        : base.points.history,
    },
  };
};

const loadLocalStore = () => {
  try {
    const raw = localStorage.getItem(SHOP_STORE_KEY);
    if (!raw) return createEmptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    return createEmptyStore();
  }
};

let shopStore = loadLocalStore();
let storeSyncTimer;

const getMockApiBase = () =>
  document.documentElement.getAttribute("data-mock-api") ||
  localStorage.getItem(SHOP_API_BASE_KEY) ||
  "";

const getMockApiPath = () =>
  localStorage.getItem(SHOP_API_PATH_KEY) || "/store/1";

const saveStore = (next) => {
  shopStore = normalizeStore(next);
  localStorage.setItem(SHOP_STORE_KEY, JSON.stringify(shopStore));
  scheduleStoreSync();
  refreshShopUI();
};

const updateStore = (mutate) => {
  const snapshot = normalizeStore({
    ...shopStore,
    cart: [...shopStore.cart],
    favorites: [...shopStore.favorites],
    orders: [...shopStore.orders],
    profile: { ...(shopStore.profile || {}) },
    addresses: Array.isArray(shopStore.addresses)
      ? shopStore.addresses.map((addr) => ({ ...addr }))
      : [],
    points: {
      ...shopStore.points,
      history: [...shopStore.points.history],
    },
  });
  const next = mutate(snapshot) || snapshot;
  saveStore(next);
};

const scheduleStoreSync = () => {
  const base = getMockApiBase();
  if (!base) return;
  clearTimeout(storeSyncTimer);
  storeSyncTimer = setTimeout(syncStoreToMockApi, 800);
};

const syncStoreToMockApi = async () => {
  const base = getMockApiBase();
  if (!base) return;
  const url = `${base.replace(/\/$/, "")}${getMockApiPath()}`;
  const payload = {
    state: shopStore,
    updatedAt: new Date().toISOString(),
  };
  try {
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Ignore sync errors in mock mode.
  }
};

const hydrateStoreFromMockApi = async () => {
  const base = getMockApiBase();
  if (!base) return;
  const url = `${base.replace(/\/$/, "")}${getMockApiPath()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    const next = normalizeStore(data?.state || data);
    shopStore = next;
    localStorage.setItem(SHOP_STORE_KEY, JSON.stringify(shopStore));
  } catch (error) {
    // Ignore hydration errors in mock mode.
  }
};

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, "-")
    .replace(/[\\u0000-\\u001f]/g, "")
    .replace(/-+/g, "-");

const parseNumber = (value) => {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^\d.\\-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (amount) =>
  `${Number(amount || 0).toFixed(2)} د.ع`;

const extractBackgroundImage = (el) => {
  if (!el) return "";
  const styleValue =
    el.style.backgroundImage || window.getComputedStyle(el).backgroundImage;
  const matches = Array.from(
    String(styleValue || "").matchAll(/url\\([\"']?(.*?)[\"']?\\)/g)
  );
  if (!matches.length) return "";
  const last = matches[matches.length - 1];
  return last ? last[1] : "";
};

const isLikelyProductImage = (src) => {
  if (!src) return false;
  const value = String(src).toLowerCase();
  if (
    value.includes("icons/") ||
    value.includes("/icons/") ||
    value.includes("icon-") ||
    value.includes("logo") ||
    value.includes("badge") ||
    value.includes("edge") ||
    value.includes("arrow") ||
    value.includes("chevron") ||
    value.includes("heart") ||
    value.includes("bag")
  ) {
    return false;
  }
  return true;
};

const getProductImageFromCard = (card) => {
  if (!card) return "";
  const imageWrapper = card.querySelector(".product-image");
  const bgImage = extractBackgroundImage(imageWrapper);
  if (bgImage) return bgImage;

  const preferredSelectors = [
    ".plp-product",
    ".pm-similar-media img",
    ".cart-item-thumb img",
    ".popup-dialog-thumb img",
    ".product-thumb img",
    ".product-main img",
  ];

  for (const selector of preferredSelectors) {
    const img = card.querySelector(selector);
    const src = img ? img.getAttribute("src") : "";
    if (src) return src;
  }

  const images = Array.from(card.querySelectorAll("img"));
  const candidate = images.find((img) =>
    isLikelyProductImage(img.getAttribute("src"))
  );
  if (candidate) return candidate.getAttribute("src") || "";
  return "";
};

const buildProductId = (name, price, image) => {
  const base = slugify(name || image || "product");
  const priceToken = Number.isFinite(price) ? Math.round(price * 100) : 0;
  return `${base}-${priceToken || 0}`;
};

const getProductById = (id) => {
  if (!id) return null;
  return (
    shopStore.cart.find((item) => item.id === id) ||
    shopStore.favorites.find((item) => item.id === id) ||
    null
  );
};

const extractProductFromCard = (card) => {
  if (!card) return null;
  const dataset = card.dataset || {};
  const name =
    dataset.productName ||
    card.querySelector(".product-name")?.textContent?.trim();
  const priceEl = card.querySelector(".price-current, .price");
  const price = parseNumber(
    dataset.productPrice || (priceEl ? priceEl.textContent : 0)
  );
  const image =
    dataset.productImage ||
    getProductImageFromCard(card) ||
    "";
  const primaryLink =
    card.querySelector(".product-cta") ||
    card.querySelector('[data-link*="product"]') ||
    card.querySelector('a[href*="product"]');
  let url =
    dataset.productUrl ||
    (primaryLink
      ? primaryLink.getAttribute("data-link") || primaryLink.getAttribute("href")
      : "");
  if (!url) {
    const fallback = card.querySelector("[data-link], a[href]");
    const candidate = fallback
      ? fallback.getAttribute("data-link") || fallback.getAttribute("href")
      : "";
    if (candidate && !/cart|favorite|checkout/.test(candidate)) {
      url = candidate;
    }
  }
  if (!name) return null;
  const id = dataset.productId || buildProductId(name, price, image);
  return { id, name, price, image, url };
};

const hydrateProductCardData = (root = document) => {
  root.querySelectorAll(".product-card").forEach((card) => {
    if (!card.dataset.productImage) {
      const image = getProductImageFromCard(card);
      if (image) card.dataset.productImage = image;
    }
    if (!card.dataset.productName) {
      const name = card.querySelector(".product-name")?.textContent?.trim();
      if (name) card.dataset.productName = name;
    }
    if (!card.dataset.productPrice) {
      const priceEl = card.querySelector(".price-current, .price");
      const price = parseNumber(priceEl ? priceEl.textContent : 0);
      if (Number.isFinite(price) && price > 0) {
        card.dataset.productPrice = String(price);
      }
    }
    if (!card.dataset.productUrl) {
      const link =
        card.querySelector(".product-cta") ||
        card.querySelector('[data-link*="product"]') ||
        card.querySelector('a[href*="product"]');
      const url = link
        ? link.getAttribute("data-link") || link.getAttribute("href")
        : "";
      if (url) card.dataset.productUrl = url;
    }
  });
};

const extractProductFromProductPage = (root) => {
  const container = root || document;
  const name = container.querySelector(".pm-info h1")?.textContent?.trim();
  const price = parseNumber(
    container.querySelector(".pm-price .current")?.textContent
  );
  const image =
    container.querySelector(".pm-media-card img")?.getAttribute("src") || "";
  if (!name) return null;
  const meta = [];
  container.querySelectorAll(".pm-option").forEach((option) => {
    const title = option.querySelector(".pm-option-title")?.textContent?.trim();
    const chip =
      option.querySelector(".pm-chips .active")?.textContent?.trim() ||
      option.querySelector(".pm-option-value")?.textContent?.trim();
    if (title && chip) {
      meta.push(`${title.replace(/:$/, "").trim()}: ${chip}`);
    }
  });
  const id = buildProductId(name, price, image);
  return { id, name, price, image, meta };
};

const resolveProductFromButton = (btn) => {
  if (!btn) return null;
  const existingId = btn.dataset.productId;
  if (existingId) {
    const cached = getProductById(existingId);
    if (cached) return cached;
  }
  const card = btn.closest(".product-card");
  if (card) return extractProductFromCard(card);
  if (document.querySelector(".pm-page")) {
    return extractProductFromProductPage(btn.closest(".pm-page") || document);
  }
  return null;
};

const getCartCount = () =>
  shopStore.cart.reduce((sum, item) => sum + (item.qty || 0), 0);

const getFavoritesCount = () => shopStore.favorites.length;

const getCartSubtotal = () =>
  shopStore.cart.reduce(
    (sum, item) => sum + (item.price || 0) * (item.qty || 0),
    0
  );

const getShippingFee = (subtotal) => {
  if (subtotal <= 0) return 0;
  return subtotal >= SHOP_CONFIG.shippingThreshold ? 0 : SHOP_CONFIG.shippingFee;
};

const getPointsValue = (points) => points * SHOP_CONFIG.pointValue;

const getEarnedPoints = (subtotal) =>
  Math.round(subtotal * SHOP_CONFIG.pointsEarnRate);

const getCouponDiscount = (subtotal) => {
  const coupon = shopStore.coupon;
  if (!coupon) return 0;
  if (coupon.type === "percent") {
    return subtotal * coupon.value;
  }
  return coupon.value || 0;
};

const applyCouponCode = (rawCode) => {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) {
    updateStore((draft) => {
      draft.coupon = null;
      return draft;
    });
    return { ok: false, message: "يرجى إدخال كود الكوبون." };
  }
  const rule = SHOP_CONFIG.coupons[code];
  if (!rule) {
    updateStore((draft) => {
      draft.coupon = null;
      return draft;
    });
    return { ok: false, message: "الكوبون غير صالح." };
  }
  updateStore((draft) => {
    draft.coupon = { code, ...rule };
    return draft;
  });
  return { ok: true, message: rule.label || "تم تطبيق الكوبون." };
};

const addToCart = (product, qty = 1) => {
  if (!product) return;
  updateStore((draft) => {
    const existing = draft.cart.find((item) => item.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      draft.cart.push({
        ...product,
        qty,
      });
    }
    return draft;
  });
};

const setCartItemQty = (id, qty) => {
  updateStore((draft) => {
    const item = draft.cart.find((entry) => entry.id === id);
    if (!item) return draft;
    if (qty <= 0) {
      draft.cart = draft.cart.filter((entry) => entry.id !== id);
    } else {
      item.qty = qty;
    }
    return draft;
  });
};

const removeFromCart = (id) => {
  updateStore((draft) => {
    draft.cart = draft.cart.filter((entry) => entry.id !== id);
    return draft;
  });
};

const clearCart = () => {
  updateStore((draft) => ({ ...draft, cart: [] }));
};

const toggleFavorite = (product) => {
  if (!product) return false;
  let isFavorite = false;
  updateStore((draft) => {
    const exists = draft.favorites.find((item) => item.id === product.id);
    if (exists) {
      draft.favorites = draft.favorites.filter((item) => item.id !== product.id);
      isFavorite = false;
    } else {
      draft.favorites.push(product);
      isFavorite = true;
    }
    return draft;
  });
  return isFavorite;
};

const addToFavorites = (product) => {
  if (!product) return;
  updateStore((draft) => {
    const exists = draft.favorites.find((item) => item.id === product.id);
    if (!exists) {
      draft.favorites.push(product);
    }
    return draft;
  });
};

const clearFavorites = () => {
  updateStore((draft) => ({ ...draft, favorites: [] }));
};

const createOrderFromCart = ({ usePoints = false, paymentMethod = "" } = {}) => {
  if (!shopStore.cart.length) return null;
  const subtotal = getCartSubtotal();
  const couponDiscount = Math.min(getCouponDiscount(subtotal), subtotal);
  const availablePoints = shopStore.points.balance || 0;
  const maxPointValue = getPointsValue(availablePoints);
  const pointsDiscountRaw = Math.min(
    maxPointValue,
    Math.max(0, subtotal - couponDiscount)
  );
  const pointsUsed = usePoints
    ? Math.min(availablePoints, Math.round(pointsDiscountRaw / SHOP_CONFIG.pointValue))
    : 0;
  const pointsDiscount = usePoints ? getPointsValue(pointsUsed) : 0;
  const shipping = getShippingFee(subtotal - couponDiscount - pointsDiscount);
  const total = Math.max(0, subtotal - couponDiscount - pointsDiscount + shipping);
  const earnedPoints = getEarnedPoints(subtotal);
  const createdAt = new Date().toISOString();
  const orderId = `${Date.now()}`.slice(-6);

  const order = {
    id: orderId,
    number: `#${orderId}`,
    createdAt,
    dateLabel: new Date().toLocaleDateString("ar-IQ"),
    status: "قيد التنفيذ",
    paymentMethod: paymentMethod || "عبر منصة قبل",
    items: shopStore.cart.map((item) => ({ ...item })),
    subtotal,
    couponDiscount,
    pointsDiscount,
    shipping,
    total,
    earnedPoints,
    pointsUsed,
  };

  updateStore((draft) => {
    const nextBalance = Math.max(0, (draft.points.balance || 0) - pointsUsed) + earnedPoints;
    if (pointsUsed > 0) {
      draft.points.history.unshift({
        id: `${orderId}-use`,
        date: order.dateLabel,
        note: `استخدام نقاط للطلب ${order.number}`,
        points: -pointsUsed,
        balance: Math.max(0, (draft.points.balance || 0) - pointsUsed),
      });
    }
    draft.points.history.unshift({
      id: `${orderId}-earn`,
      date: order.dateLabel,
      note: `شراء ${order.items.map((item) => item.name).join(" + ")}`,
      points: earnedPoints,
      balance: nextBalance,
    });
    draft.points.balance = nextBalance;
    draft.orders = [order, ...(draft.orders || [])];
    draft.lastOrderId = orderId;
    draft.cart = [];
    draft.coupon = null;
    return draft;
  });

  return order;
};

function startBrandRotation() {
  const slots = document.querySelectorAll(".brand-logo img");
  if (!slots.length || brandImages.length === 0) return;

  let startIndex = 0;

  const render = () => {
    slots.forEach((imgEl, i) => {
      imgEl.classList.add("fading");
      setTimeout(() => {
        const brand = brandImages[(startIndex + i) % brandImages.length];
        imgEl.src = brand.src;
        imgEl.alt = brand.alt;
        requestAnimationFrame(() => imgEl.classList.remove("fading"));
      }, 180);
    });
    startIndex = (startIndex + 1) % brandImages.length;
  };

  render();
  setInterval(render, 2600);
}

document.addEventListener("DOMContentLoaded", startBrandRotation);

function startGoalCarousel() {
  const carousel = document.querySelector(".goal-carousel");
  const cards = carousel ? Array.from(carousel.querySelectorAll(".goal-card")) : [];
  if (!carousel || cards.length === 0) return;

  let currentIndex = 0;
  let isUserActive = false;
  let resumeTimeout;
  const isRTL = getComputedStyle(carousel).direction === "rtl";

  const scrollToCard = (index) => {
    const card = cards[index];
    if (!card) return;
    const offset = card.offsetLeft - carousel.offsetLeft;
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    const target = isRTL ? maxScroll - offset : offset;
    carousel.scrollTo({ left: target, behavior: "smooth" });
  };

  const autoAdvance = () => {
    if (isUserActive) return;
    currentIndex = (currentIndex + 1) % cards.length;
    scrollToCard(currentIndex);
  };

  let autoInterval = setInterval(autoAdvance, 3500);

  const handleUserInteraction = () => {
    isUserActive = true;
    clearInterval(autoInterval);
    clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => {
      isUserActive = false;
      autoInterval = setInterval(autoAdvance, 3500);
    }, 5000);
  };

  ["touchstart", "mousedown", "wheel"].forEach((eventName) => {
    carousel.addEventListener(eventName, handleUserInteraction, {
      passive: true,
    });
  });

  const prevBtn = document.querySelector('[data-goal-nav="prev"]');
  const nextBtn = document.querySelector('[data-goal-nav="next"]');
  const goToIndex = (nextIndex) => {
    currentIndex = (nextIndex + cards.length) % cards.length;
    scrollToCard(currentIndex);
  };

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      handleUserInteraction();
      goToIndex(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      handleUserInteraction();
      goToIndex(currentIndex + 1);
    });
  }
}

document.addEventListener("DOMContentLoaded", startGoalCarousel);

function initTestimonialsCarousel() {
  const track = document.querySelector(".testimonials-track");
  const cards = track ? Array.from(track.querySelectorAll(".review-card")) : [];
  if (!track || cards.length === 0) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (prefersReduced.matches) return;

  let currentIndex = 0;
  let isUserActive = false;
  let resumeTimeout;
  const isRTL = getComputedStyle(track).direction === "rtl";

  const scrollToCard = (index) => {
    const card = cards[index];
    if (!card) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 0) return;
    const rawOffset =
      card.offsetLeft - track.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
    const clamped = Math.max(0, Math.min(maxScroll, rawOffset));
    const target = isRTL ? maxScroll - clamped : clamped;
    track.scrollTo({ left: target, behavior: "smooth" });
  };

  const autoAdvance = () => {
    if (isUserActive) return;
    currentIndex = (currentIndex + 1) % cards.length;
    scrollToCard(currentIndex);
  };

  let autoInterval = setInterval(autoAdvance, 3600);

  const handleUserInteraction = () => {
    isUserActive = true;
    clearInterval(autoInterval);
    clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => {
      isUserActive = false;
      autoInterval = setInterval(autoAdvance, 3600);
    }, 5000);
  };

  ["touchstart", "mousedown", "wheel"].forEach((eventName) => {
    track.addEventListener(eventName, handleUserInteraction, { passive: true });
  });
}

document.addEventListener("DOMContentLoaded", initTestimonialsCarousel);

function initCategoryFilters() {
  const container = document.querySelector(".category-shop");
  if (!container) return;
  const buttons = Array.from(container.querySelectorAll(".category-pill"));
  const cards = Array.from(
    container.querySelectorAll(".category-carousel .product-card")
  );
  if (!buttons.length || !cards.length) return;

  const setActive = (filter) => {
    buttons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.filter === filter)
    );
    cards.forEach((card) => {
      const categories = (card.dataset.category || "").split(/\s+/);
      const show = filter === "all" || categories.includes(filter);
      card.style.display = show ? "flex" : "none";
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setActive(btn.dataset.filter));
  });
}

document.addEventListener("DOMContentLoaded", initCategoryFilters);

function initProductsPage() {
  const section = document.querySelector(".products-section");
  if (!section) return;

  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "");

  const searchQuery = new URLSearchParams(window.location.search).get("search");
  let searchKey = normalize(searchQuery);
  if (searchQuery) {
    document.querySelectorAll('input[type="search"]').forEach((input) => {
      input.value = searchQuery;
    });
  }

  const sortBtn = section.querySelector(".sort-dropdown");
  const sortMenu = section.querySelector(".sort-menu");
  const sortLabel = sortBtn ? sortBtn.querySelector("span") : null;
  const filterBtn = section.querySelector(".filter-btn");
  const filterPanel = section.querySelector(".filter-panel");
  const filterPills = filterPanel
    ? Array.from(filterPanel.querySelectorAll(".filter-pill"))
    : [];
  const categoryRow = section.querySelector(".products-categories");
  const categoryPills = categoryRow
    ? Array.from(categoryRow.querySelectorAll(".category-pill"))
    : [];
  const filtersHeader = section.querySelector(".filters-header");
  const filtersBody = section.querySelector(".filters-body");
  const filterGroups = filtersBody
    ? Array.from(filtersBody.querySelectorAll(".filter-group"))
    : [];
  const filterInputs = filtersBody
    ? Array.from(filtersBody.querySelectorAll('input[type="checkbox"]'))
    : [];
  const priceRange = filtersBody?.querySelector('input[type="range"]');
  const priceOutput = filtersBody?.querySelector("[data-price-output]");
  const list = section.querySelector(".products-list");
  const cards = list ? Array.from(list.querySelectorAll(".product-card")) : [];
  if (!sortBtn || !sortMenu || !list || cards.length === 0) return;

  const initFilterSubsections = () => {
    filterGroups.forEach((group, index) => {
      const title = group.querySelector(".filter-title");
      if (!title) return;

      let options = Array.from(group.children).find(
        (node) => node !== title && node.classList?.contains("filter-options")
      );

      if (!options) {
        options = document.createElement("div");
        options.className = "filter-options";
        Array.from(group.children).forEach((node) => {
          if (node !== title) options.appendChild(node);
        });
        group.appendChild(options);
      }

      if (!options.id) options.id = `filter-options-${index + 1}`;
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");
      title.setAttribute("aria-controls", options.id);

      const setCollapsed = (collapsed) => {
        group.classList.toggle("is-collapsed", collapsed);
        title.setAttribute("aria-expanded", collapsed ? "false" : "true");
        options.setAttribute("aria-hidden", collapsed ? "true" : "false");
      };

      if (title.dataset.filterToggleBound !== "true") {
        title.dataset.filterToggleBound = "true";
        title.addEventListener("click", () => {
          const collapsed = group.classList.contains("is-collapsed");
          setCollapsed(!collapsed);
        });
        title.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          title.click();
        });
      }

      setCollapsed(true);
    });
  };

  initFilterSubsections();

  let emptyState = section.querySelector(".products-empty");
  if (!emptyState) {
    emptyState = document.createElement("div");
    emptyState.className = "products-empty";
    emptyState.textContent = "لا توجد نتائج مطابقة لبحثك.";
    emptyState.hidden = true;
    list.insertAdjacentElement("afterend", emptyState);
  }

  const originalOrder = cards.slice();
  let currentSort = "default";
  let currentFilter = "all";

  const getPrice = (card) => parseFloat(card.dataset.price || "0");
  const getRating = (card) => parseFloat(card.dataset.rating || "0");

  const getActiveFilters = () => {
    const active = {};
    filterInputs.forEach((input) => {
      if (!input.checked) return;
      const group = input.dataset.filterGroup;
      const value = input.dataset.filterValue || input.value || "";
      if (!group || !value) return;
      if (!active[group]) active[group] = [];
      active[group].push(value);
    });
    return active;
  };

  const updatePriceOutput = () => {
    if (!priceRange || !priceOutput) return;
    priceOutput.textContent = `حتى ${priceRange.value}.000 د.ع`;
  };

  const applyFilter = () => {
    const activeFilters = getActiveFilters();
    const maxPrice = priceRange ? parseFloat(priceRange.value || "0") : null;
    const priceMaxValue = priceRange
      ? parseFloat(priceRange.max || priceRange.value || "0")
      : null;
    const hasCheckboxFilters = Object.values(activeFilters).some(
      (values) => values.length
    );
    const hasPriceFilter =
      typeof maxPrice === "number" &&
      typeof priceMaxValue === "number" &&
      maxPrice < priceMaxValue;
    let visibleCount = 0;
    cards.forEach((card) => {
      const tags = (card.dataset.tags || "").split(/\s+/);
      const name = card.querySelector(".product-name")?.textContent || "";
      const dataText = `${name} ${card.dataset.tags || ""} ${
        card.dataset.category || ""
      } ${card.dataset.brand || ""}`;
      const matchesSearch = !searchKey || normalize(dataText).includes(searchKey);
      const matchesCategory =
        currentFilter === "all" || tags.includes(currentFilter);
      const matchesPrice =
        maxPrice === null || Number.isNaN(maxPrice)
          ? true
          : getPrice(card) <= maxPrice;
      const matchesFilters = Object.entries(activeFilters).every(
        ([group, values]) => {
          if (!values.length) return true;
          const cardValues = (card.dataset[group] || "")
            .split(/\s+/)
            .filter(Boolean);
          return values.some((value) => cardValues.includes(value));
        }
      );
      const show =
        matchesSearch && matchesCategory && matchesPrice && matchesFilters;
      card.style.display = show ? "flex" : "none";
      if (show) visibleCount += 1;
    });
    const shouldShowEmpty =
      searchKey ||
      currentFilter !== "all" ||
      hasCheckboxFilters ||
      hasPriceFilter;
    emptyState.hidden = visibleCount > 0 || !shouldShowEmpty;
  };

  const applySort = () => {
    let sorted = cards.slice();
    if (currentSort === "price-asc") {
      sorted.sort((a, b) => getPrice(a) - getPrice(b));
    } else if (currentSort === "price-desc") {
      sorted.sort((a, b) => getPrice(b) - getPrice(a));
    } else if (currentSort === "rating-desc") {
      sorted.sort((a, b) => getRating(b) - getRating(a));
    } else {
      sorted = originalOrder;
    }
    sorted.forEach((card) => list.appendChild(card));
    applyFilter();
  };

  sortBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    sortMenu.classList.toggle("show");
    sortMenu.setAttribute(
      "aria-hidden",
      sortMenu.classList.contains("show") ? "false" : "true"
    );
    sortBtn.setAttribute(
      "aria-expanded",
      sortMenu.classList.contains("show") ? "true" : "false"
    );
  });

  sortMenu.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSort = btn.dataset.sort || "default";
      if (sortLabel) {
        sortLabel.textContent = btn.textContent.trim();
      }
      sortMenu.classList.remove("show");
      sortMenu.setAttribute("aria-hidden", "true");
      sortBtn.setAttribute("aria-expanded", "false");
      applySort();
    });
  });

  const setFiltersCollapsed = (shouldCollapse) => {
    if (!filtersHeader || !filtersBody) return;
    filtersBody.classList.toggle("is-collapsed", shouldCollapse);
    filtersHeader.setAttribute("aria-expanded", shouldCollapse ? "false" : "true");
  };

  if (filtersHeader && filtersBody) {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    setFiltersCollapsed(!isDesktop);
  }

  if (filtersHeader && filtersBody) {
    filtersHeader.addEventListener("click", () => {
      filtersBody.classList.toggle("is-collapsed");
      const isCollapsed = filtersBody.classList.contains("is-collapsed");
      filtersHeader.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
  }

  filterInputs.forEach((input) => {
    input.addEventListener("change", applyFilter);
  });

  if (priceRange) {
    priceRange.addEventListener("input", () => {
      updatePriceOutput();
      applyFilter();
    });
    updatePriceOutput();
  }

  if (filterBtn && filterPanel) {
    filterBtn.addEventListener("click", () => {
      filterPanel.classList.toggle("is-hidden");
    });
  }

  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      currentFilter = pill.dataset.filter || "all";
      filterPills.forEach((btn) =>
        btn.classList.toggle("active", btn === pill)
      );
      categoryPills.forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.filter === currentFilter)
      );
      applyFilter();
    });
  });

  categoryPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      currentFilter = pill.dataset.filter || "all";
      categoryPills.forEach((btn) =>
        btn.classList.toggle("active", btn === pill)
      );
      filterPills.forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.filter === currentFilter)
      );
      applyFilter();
    });
  });

  document.querySelectorAll('input[type="search"]').forEach((input) => {
    if (input.dataset.productsSearchBound === "true") return;
    input.dataset.productsSearchBound = "true";
    input.addEventListener("input", () => {
      const value = input.value.trim();
      searchKey = normalize(value);
      if (value) {
        const nextUrl = `products.html?search=${encodeURIComponent(value)}`;
        window.history.replaceState(null, "", nextUrl);
      } else {
        window.history.replaceState(null, "", "products.html");
      }
      applyFilter();
    });
  });

  document.addEventListener("click", (event) => {
    if (!sortMenu.contains(event.target) && !sortBtn.contains(event.target)) {
      sortMenu.classList.remove("show");
      sortMenu.setAttribute("aria-hidden", "true");
      sortBtn.setAttribute("aria-expanded", "false");
    }
  });

  applySort();
}

document.addEventListener("DOMContentLoaded", initProductsPage);

function initProductPage() {
  const page = document.querySelector(".pm-page");
  if (!page) return;

  const accordions = Array.from(page.querySelectorAll(".pm-accordion-item"));
  accordions.forEach((item, index) => {
    const header = item.querySelector(".pm-accordion-header");
    const body = item.querySelector(".pm-accordion-body");
    const icon = item.querySelector(".pm-accordion-icon");
    if (!header || !body) return;

    if (header.dataset.accordionBound !== "true") {
      header.dataset.accordionBound = "true";
      header.addEventListener("click", () => {
        item.classList.toggle("open");
        syncState(true);
      });
    }

    if (!body.id) body.id = `pm-accordion-body-${index + 1}`;
    header.setAttribute("aria-controls", body.id);
    body.removeAttribute("hidden");

    const syncState = (animate = false) => {
      const isOpen = item.classList.contains("open");
      header.setAttribute("aria-expanded", isOpen ? "true" : "false");
      body.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (icon) icon.textContent = isOpen ? "-" : "+";

      if (!animate) {
        body.style.maxHeight = isOpen ? "none" : "0px";
        return;
      }

      if (isOpen) {
        body.style.maxHeight = "0px";
        const targetHeight = body.scrollHeight;
        requestAnimationFrame(() => {
          body.style.maxHeight = `${targetHeight}px`;
        });
      } else {
        if (body.style.maxHeight === "none") {
          body.style.maxHeight = `${body.scrollHeight}px`;
          void body.offsetHeight;
        }
        const currentHeight = body.scrollHeight;
        body.style.maxHeight = `${currentHeight}px`;
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
        });
      }
    };

    if (body.dataset.accordionTransitionBound !== "true") {
      body.dataset.accordionTransitionBound = "true";
      body.addEventListener("transitionend", (event) => {
        if (event.propertyName !== "max-height") return;
        if (item.classList.contains("open")) {
          body.style.maxHeight = "none";
        }
      });
    }

    syncState(false);
  });

  const qty = page.querySelector(".pm-qty");
  if (qty) {
    const minus = qty.querySelector("button:first-child");
    const plus = qty.querySelector("button:last-child");
    const valueEl = qty.querySelector("span");
    let value = parseInt(valueEl ? valueEl.textContent.trim() : "1", 10);
    if (!Number.isFinite(value) || value < 1) value = 1;

    const renderValue = () => {
      if (valueEl) valueEl.textContent = String(value);
      if (minus) minus.disabled = value <= 1;
    };

    if (minus) {
      minus.addEventListener("click", () => {
        value = Math.max(1, value - 1);
        renderValue();
      });
    }
    if (plus) {
      plus.addEventListener("click", () => {
        value += 1;
        renderValue();
      });
    }
    renderValue();
  }

  const chipGroups = Array.from(page.querySelectorAll(".pm-chips"));
  chipGroups.forEach((group) => {
    group.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn || btn.classList.contains("disabled")) return;
      group
        .querySelectorAll("button")
        .forEach((node) => node.classList.toggle("active", node === btn));
    });
  });

  const mainImage = page.querySelector(".pm-media-card > img");
  const thumbButtons = Array.from(
    page.querySelectorAll(".pm-media-thumbs button")
  );
  if (mainImage && thumbButtons.length) {
    thumbButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const img = btn.querySelector("img");
        if (!img) return;
        mainImage.src = img.src;
        mainImage.alt = img.alt || mainImage.alt;
        thumbButtons.forEach((node) => node.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  const reviewPagination = page.querySelector(".pm-review-pagination");
  if (reviewPagination) {
    reviewPagination.addEventListener("click", (event) => {
      const btn = event.target.closest(".pm-page-btn");
      if (!btn || btn.hasAttribute("aria-label")) return;
      reviewPagination
        .querySelectorAll(".pm-page-btn")
        .forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
    });
  }
}

document.addEventListener("DOMContentLoaded", initProductPage);

function initQtySteppers() {
  const steppers = Array.from(document.querySelectorAll("[data-qty]"));
  if (!steppers.length) return;

  const updateCartCount = () => {
    if (steppers.some((stepper) => stepper.dataset.itemId)) {
      updateBadgeCounts();
      return;
    }
    const realSteppers = steppers.filter(
      (stepper) => !stepper.closest("#popup-cart-dialog")
    );
    const sources = realSteppers.length ? realSteppers : steppers;
    const total = sources.reduce((sum, stepper) => {
      const valueEl = stepper.querySelector("span");
      const value = parseInt(valueEl ? valueEl.textContent.trim() : "0", 10);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    if (Number.isFinite(total)) {
      getCartBadgeEls().forEach((el) => {
        el.textContent = String(total);
      });
    }
  };

  steppers.forEach((stepper) => {
    if (stepper.dataset.bound === "true") return;
    stepper.dataset.bound = "true";
    const buttons = stepper.querySelectorAll("button");
    const valueEl = stepper.querySelector("span");
    if (!buttons.length || !valueEl) return;

    const itemId = stepper.dataset.itemId;
    let value = parseInt(valueEl.textContent.trim(), 10);
    if (itemId) {
      const item = shopStore.cart.find((entry) => entry.id === itemId);
      if (item && Number.isFinite(item.qty)) value = item.qty;
    }
    if (!Number.isFinite(value) || value < 1) value = 1;

    const renderValue = () => {
      valueEl.textContent = String(value);
      if (buttons[0]) buttons[0].disabled = !itemId && value <= 1;
    };

    buttons[0]?.addEventListener("click", () => {
      if (itemId && value <= 1) {
        setCartItemQty(itemId, 0);
        updateCartCount();
        return;
      }
      value = Math.max(1, value - 1);
      renderValue();
      if (itemId) {
        setCartItemQty(itemId, value);
      }
      updateCartCount();
    });

    buttons[1]?.addEventListener("click", () => {
      value += 1;
      renderValue();
      if (itemId) {
        setCartItemQty(itemId, value);
      }
      updateCartCount();
    });

    renderValue();
  });

  updateCartCount();
}

document.addEventListener("DOMContentLoaded", initQtySteppers);

function initPopupCartDialog() {
  const dialog = document.getElementById("popup-cart-dialog");
  if (!dialog) return;

  const header = dialog.querySelector(".popup-dialog-header");
  if (header) {
    const buttons = Array.from(header.querySelectorAll(".popup-dialog-btn"));
    const [leftBtn, rightBtn] = buttons;

    if (leftBtn && leftBtn.dataset.popupNavBound !== "true") {
      leftBtn.dataset.popupNavBound = "true";
      leftBtn.removeAttribute("data-popup-close");
      leftBtn.setAttribute("aria-label", "الانتقال إلى السلة");
      leftBtn.innerHTML =
        '<i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>';
      leftBtn.addEventListener("click", () => {
        window.location.href = "cart.html";
      });
    }

    if (rightBtn && rightBtn.dataset.popupCloseBound !== "true") {
      rightBtn.dataset.popupCloseBound = "true";
      rightBtn.setAttribute("data-popup-close", "");
      rightBtn.setAttribute("aria-label", "إغلاق");
      rightBtn.innerHTML =
        '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    }
  }

  const openDialog = () => {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    document.body.classList.add("popup-open");
  };

  const closeDialog = () => {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    document.body.classList.remove("popup-open");
  };

  document.querySelectorAll("[data-popup-cart-trigger]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      openDialog();
    });
  });

  dialog.querySelectorAll("[data-popup-close]").forEach((btn) => {
    btn.addEventListener("click", closeDialog);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
}

const getCartBadgeEls = () =>
  document.querySelectorAll(
    "[data-popup-cart-trigger] .desktop-badge, [data-popup-cart-trigger] .element, .checkout-badge"
  );

const getFavoriteBadgeEls = () => {
  const badges = Array.from(
    document.querySelectorAll(
      '.header .desktop-action[href="favorite.html"] .desktop-badge'
    )
  );

  document
    .querySelectorAll('.header-mobile img[src*="heart.svg"]')
    .forEach((img) => {
      const badge = img.closest(".div")?.querySelector(".element");
      if (badge) badges.push(badge);
    });

  return badges;
};

const updateBadgeCounts = () => {
  const cartCount = getCartCount();
  const favCount = getFavoritesCount();
  getCartBadgeEls().forEach((el) => {
    el.textContent = String(cartCount);
  });
  getFavoriteBadgeEls().forEach((el) => {
    el.textContent = String(favCount);
  });
};

function applyStoredCartCount() {
  updateBadgeCounts();
}

function applyStoredFavoriteCount() {
  updateBadgeCounts();
}

document.addEventListener("DOMContentLoaded", applyStoredCartCount);
document.addEventListener("DOMContentLoaded", applyStoredFavoriteCount);
document.addEventListener("DOMContentLoaded", initPopupCartDialog);

function initButtonLinks() {
  const buttons = document.querySelectorAll("button[data-link]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    if (btn.dataset.linkBound === "true") return;
    btn.dataset.linkBound = "true";
    btn.addEventListener("click", (event) => {
      const href = btn.getAttribute("data-link");
      if (!href) return;
      if (href === "favorite.html") return;
      if (btn.matches('[aria-label*="المفضلة"], [aria-label*="مفضلة"]')) {
        return;
      }
      if (btn.matches('[aria-label*="العربة"], [aria-label*="سلة"]')) {
        return;
      }
      if (btn.classList.contains("checkout-submit")) {
        return;
      }
      if (btn.classList.contains("outline") || btn.classList.contains("solid")) {
        return;
      }

      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );
      const shouldDelay = btn.dataset.anim === "true";

      if (shouldDelay && !prefersReduced.matches) {
        event.preventDefault();
        setTimeout(() => {
          window.location.href = href;
        }, 220);
      } else {
        window.location.href = href;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initButtonLinks);

function initProductCardNavigation() {
  document.querySelectorAll(".product-card").forEach((card) => {
    if (card.dataset.cardNavBound === "true") return;
    card.dataset.cardNavBound = "true";
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea, label")) {
        return;
      }
      const url =
        card.dataset.productUrl ||
        card.querySelector(".product-cta")?.getAttribute("data-link") ||
        card.querySelector('a[href*="product"]')?.getAttribute("href") ||
        "product.html";
      window.location.href = url;
    });
  });
}

document.addEventListener("DOMContentLoaded", initProductCardNavigation);

function initSectionReveal() {
  const sections = Array.from(document.querySelectorAll("section"));
  if (!sections.length) return;

  if (document.querySelector(".products-page")) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  sections.forEach((section, index) => {
    section.classList.add("reveal-section");
    section.style.transitionDelay = `${Math.min(index * 40, 240)}ms`;
  });

  if (!("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  sections.forEach((section) => observer.observe(section));
}

document.addEventListener("DOMContentLoaded", initSectionReveal);

function initAnnouncementClose() {
  const bar = document.querySelector(".announcement-bar");
  if (!bar) return;
  const closeBtn = bar.querySelector("[data-announcement-close]");
  if (!closeBtn) return;
  closeBtn.addEventListener("click", () => {
    bar.remove();
    document.documentElement.style.setProperty("--announcement-bar-height", "0px");
  });
}

document.addEventListener("DOMContentLoaded", initAnnouncementClose);

function initButtonAnimations() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  const purchaseButtons = document.querySelectorAll(
    ".product-cta, .solid, .cart-checkout-btn, .checkout-submit, .popup-checkout"
  );
  const cartButtons = document.querySelectorAll(
    'button[aria-label="أضف للعربة"]'
  );
  const favoriteButtons = document.querySelectorAll(
    'button[aria-label*="مفضلة"], button[aria-label*="المفضلة"]'
  );

  const triggerAnim = (btn, className) => {
    btn.classList.remove(className);
    void btn.offsetWidth;
    btn.classList.add(className);
    const handler = () => btn.classList.remove(className);
    btn.addEventListener("animationend", handler, { once: true });
  };

  purchaseButtons.forEach((btn) => {
    if (btn.dataset.animBound === "true") return;
    btn.dataset.animBound = "true";
    btn.dataset.anim = "true";
    btn.addEventListener("click", () => {
      if (prefersReduced.matches) return;
      triggerAnim(btn, "btn-anim-purchase");
    });
  });

  cartButtons.forEach((btn) => {
    if (btn.dataset.animBound === "true") return;
    btn.dataset.animBound = "true";
    btn.dataset.anim = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (!prefersReduced.matches) triggerAnim(btn, "btn-anim-cart");
      const product = resolveProductFromButton(btn);
      if (product) addToCart(product, 1);
    });
  });

  favoriteButtons.forEach((btn) => {
    if (btn.dataset.animBound === "true") return;
    btn.dataset.animBound = "true";
    btn.dataset.anim = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const product = resolveProductFromButton(btn);
      const isFavorite = toggleFavorite(product);
      btn.classList.toggle("is-favorite", isFavorite);

      if (prefersReduced.matches) return;
      triggerAnim(btn, "btn-anim-fav");
    });
  });
}

document.addEventListener("DOMContentLoaded", initButtonAnimations);

function initCheckoutInteractions() {
  const page = document.querySelector(".checkout-page");
  if (!page) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  const paymentOptions = Array.from(page.querySelectorAll(".checkout-payment"));
  if (paymentOptions.length) {
    paymentOptions.forEach((option) => {
      option.addEventListener("click", () => {
        paymentOptions.forEach((node) => node.classList.remove("active"));
        option.classList.add("active");

        const input = option.querySelector("input[type='radio']");
        if (input) input.checked = true;

        paymentOptions.forEach((node) => {
          const icon = node.querySelector("i");
          if (!icon) return;
          const isActive = node === option;
          icon.classList.toggle("fa-circle-dot", isActive);
          icon.classList.toggle("fa-circle", !isActive);
        });

        if (!prefersReduced.matches) {
          option.classList.remove("is-animating");
          void option.offsetWidth;
          option.classList.add("is-animating");
        }
      });
    });
  }

  const coupon = page.querySelector(".checkout-coupon");
  const applyBtn = coupon ? coupon.querySelector(".checkout-apply") : null;
  const input = coupon ? coupon.querySelector("input") : null;
  const message = coupon ? coupon.querySelector(".checkout-coupon-message") : null;
  if (!coupon || !applyBtn || !input) return;

  if (shopStore.coupon?.code) {
    input.value = shopStore.coupon.code;
  }

  const applyCoupon = () => {
    const result = applyCouponCode(input.value);
    coupon.classList.toggle("is-error", !result.ok);
    coupon.classList.toggle("is-applied", result.ok);
    if (message) message.textContent = result.message || "";
  };

  applyBtn.addEventListener("click", applyCoupon);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyCoupon();
  });
}

document.addEventListener("DOMContentLoaded", initCheckoutInteractions);

const buildMetaHtml = (meta = []) => {
  if (!meta.length) return "";
  return meta.map((line) => `<span>${line}</span>`).join("");
};

const buildProductCardHtml = (product) => {
  if (!product) return "";
  const fallbackImage = "assets/figma/products/product-01.png";
  const resolvedImage = isLikelyProductImage(product.image)
    ? product.image
    : fallbackImage;
  const imageStyle = `style="background-image: linear-gradient(135deg, rgba(41, 78, 62, 0.12), rgba(230, 237, 20, 0.12)), url('${resolvedImage}');"`;
  const isFavorite = shopStore.favorites.some((item) => item.id === product.id);
  const link = product.url || "product.html";
  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-image" ${imageStyle}>
        <div class="badge-row"></div>
        <div class="icon-row">
          <button class="icon-button" aria-label="أضف للعربة" data-product-id="${product.id}">
            <img src="assets/icons/bag.svg" alt="" />
          </button>
          <button class="icon-button${isFavorite ? " is-favorite" : ""}" aria-label="أضف للمفضلة" data-product-id="${product.id}">
            <img src="assets/icons/heart.svg" alt="" />
          </button>
        </div>
      </div>
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <div class="price-row">
          <span class="price-current">${formatCurrency(product.price)}</span>
        </div>
        <button class="product-cta" data-link="${link}">
          <span>اشتري الان</span>
        </button>
      </div>
    </article>`;
};

function renderFavoritesPage() {
  const grid = document.querySelector("[data-favorites-grid]");
  if (!grid) return;
  const empty = document.querySelector("[data-favorites-empty]");
  const countEl = document.querySelector("[data-favorites-count]");
  const favorites = shopStore.favorites || [];
  if (countEl) countEl.textContent = `النتائج: (${favorites.length}) صنف`;
  if (!favorites.length) {
    grid.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  grid.innerHTML = favorites.map(buildProductCardHtml).join("");
}

const buildCartItemHtml = (item) => {
  const metaHtml = buildMetaHtml(item.meta || []);
  const points = getEarnedPoints(item.price * item.qty);
  const fallbackImage = "assets/figma/products/product-01.png";
  const imageSrc = isLikelyProductImage(item.image) ? item.image : fallbackImage;
  return `
    <article class="cart-item" data-item-id="${item.id}">
      <div class="cart-item-info">
        <div class="cart-item-top">
          <label class="cart-select">
            <input type="checkbox" />
            متوفر الآن
          </label>
          <h3>${item.name}</h3>
        </div>
        ${metaHtml ? `<div class="cart-item-meta">${metaHtml}</div>` : ""}
        <div class="cart-tags">
          <span class="cart-tag cart-tag-ship">
            <i class="fa-solid fa-truck" aria-hidden="true"></i>
            الشحن مجاني
          </span>
          <span class="cart-tag cart-tag-points">
            <img src="assets/figma/product-details/icon-gift.png" alt="" />
            +${points} نقطة
          </span>
        </div>
        <div class="cart-item-bottom">
          <span class="cart-price">${formatCurrency(item.price)}</span>
          <div class="qty-stepper" data-qty data-item-id="${item.id}">
            <button type="button" aria-label="ناقص">
              <i class="fa-solid fa-minus" aria-hidden="true"></i>
            </button>
            <span>${item.qty}</span>
            <button type="button" aria-label="زائد">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="cart-item-thumb">
        <img src="${imageSrc}" alt="${item.name}" />
      </div>
    </article>`;
};

const renderCartSummary = () => {
  const subtotal = getCartSubtotal();
  const couponDiscount = Math.min(getCouponDiscount(subtotal), subtotal);
  const shipping = getShippingFee(subtotal - couponDiscount);
  const total = Math.max(0, subtotal - couponDiscount + shipping);

  const pricing = document.querySelector(".cart-pricing");
  if (pricing) {
    const rows = pricing.querySelectorAll(".cart-price-row");
    if (rows[0]) rows[0].lastElementChild.textContent = formatCurrency(subtotal);
    if (rows[1])
      rows[1].lastElementChild.textContent =
        couponDiscount > 0 ? `-${formatCurrency(couponDiscount)}` : formatCurrency(0);
    if (rows[2]) rows[2].lastElementChild.textContent = formatCurrency(0);
    if (rows[3]) rows[3].lastElementChild.textContent = formatCurrency(shipping);
    const totalEl = pricing.querySelector(".cart-price-total span:last-child");
    if (totalEl) totalEl.textContent = formatCurrency(total);
  }

  const cartCouponInput = document.querySelector(".cart-coupon input");
  if (cartCouponInput && shopStore.coupon?.code) {
    cartCouponInput.value = shopStore.coupon.code;
  }

  const pointsRows = document.querySelectorAll(".cart-points .cart-points-row");
  const earned = getEarnedPoints(subtotal);
  if (pointsRows[0]) {
    const valueEl = pointsRows[0].querySelector("span");
    if (valueEl) valueEl.textContent = `+${earned} نقطة`;
  }
  if (pointsRows[1]) {
    const valueEl = pointsRows[1].querySelector("span");
    if (valueEl)
      valueEl.textContent = `${shopStore.points.balance} نقطة = ${formatCurrency(
        getPointsValue(shopStore.points.balance)
      )}`;
  }

  const shippingBox = document.querySelector(".cart-shipping");
  if (shippingBox) {
    const remaining = Math.max(0, SHOP_CONFIG.shippingThreshold - subtotal);
    const textEl = shippingBox.querySelector("p");
    if (textEl) {
      textEl.textContent = remaining
        ? `أنت على بعد ${formatCurrency(remaining)} للحصول على امتياز الشحن المجاني.`
        : "أنت مؤهل للشحن المجاني!";
    }
    const fill = shippingBox.querySelector(".cart-progress-fill");
    if (fill) {
      const progress = Math.min(1, subtotal / SHOP_CONFIG.shippingThreshold) * 100;
      fill.style.width = `${progress}%`;
    }
  }
};

function renderCartPage() {
  const itemsSection = document.querySelector(".cart-items");
  if (!itemsSection) return;
  const header = itemsSection.querySelector(".cart-items-header");
  const headerHtml = header ? header.outerHTML : "";
  const items = shopStore.cart || [];
  if (!items.length) {
    itemsSection.innerHTML = `${headerHtml}<div class="cart-empty">سلتك فارغة حالياً.</div>`;
    renderCartSummary();
    return;
  }
  const itemsHtml = items
    .map((item, index) => {
      const line = index < items.length - 1 ? '<div class="cart-line"></div>' : "";
      return `${buildCartItemHtml(item)}${line}`;
    })
    .join("");
  itemsSection.innerHTML = `${headerHtml}${itemsHtml}`;
  renderCartSummary();
}

const buildPopupItemHtml = (item) => {
  const metaHtml = buildMetaHtml(item.meta || []);
  const points = getEarnedPoints(item.price * item.qty);
  const fallbackImage = "assets/figma/products/product-01.png";
  const imageSrc = isLikelyProductImage(item.image) ? item.image : fallbackImage;
  return `
    <article class="popup-dialog-item" data-item-id="${item.id}">
      <div class="popup-dialog-info">
        <div class="popup-dialog-title">
          <div class="popup-dialog-actions">
            <button type="button" aria-label="حذف" data-action="remove-cart-item" data-item-id="${item.id}">
              <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
            </button>
            <span class="popup-dialog-divider"></span>
            <button type="button" aria-label="إضافة للمفضلة" data-action="favorite-cart-item" data-product-id="${item.id}">
              <i class="fa-regular fa-heart" aria-hidden="true"></i>
            </button>
          </div>
          <h3>${item.name}</h3>
        </div>
        ${metaHtml ? `<div class="popup-dialog-meta">${metaHtml}</div>` : ""}
        <div class="popup-dialog-tags">
          <span class="popup-dialog-tag popup-dialog-tag-ship">
            <i class="fa-solid fa-truck" aria-hidden="true"></i>
            الشحن مجاني
          </span>
          <span class="popup-dialog-tag popup-dialog-tag-points">
            <img src="assets/figma/product-details/icon-gift.png" alt="" />
            +${points} نقطة
          </span>
        </div>
        <div class="popup-dialog-bottom">
          <span class="popup-dialog-price">${formatCurrency(item.price)}</span>
          <div class="qty-stepper" data-qty data-item-id="${item.id}">
            <button type="button" aria-label="ناقص">
              <i class="fa-solid fa-minus" aria-hidden="true"></i>
            </button>
            <span>${item.qty}</span>
            <button type="button" aria-label="زائد">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="popup-dialog-thumb">
        <img src="${imageSrc}" alt="${item.name}" />
      </div>
    </article>`;
};

function renderPopupCart() {
  const dialog = document.getElementById("popup-cart-dialog");
  if (!dialog) return;
  const itemsWrap = dialog.querySelector(".popup-dialog-items");
  if (!itemsWrap) return;
  const items = shopStore.cart || [];
  if (!items.length) {
    itemsWrap.innerHTML = '<div class="popup-dialog-empty">سلتك فارغة حالياً.</div>';
  } else {
    const html = items
      .map((item, index) => {
        const line = index < items.length - 1 ? '<div class="popup-dialog-line"></div>' : "";
        return `${buildPopupItemHtml(item)}${line}`;
      })
      .join("");
    itemsWrap.innerHTML = html;
  }

  const subtotal = getCartSubtotal();
  const couponDiscount = Math.min(getCouponDiscount(subtotal), subtotal);
  const shipping = getShippingFee(subtotal - couponDiscount);
  const total = Math.max(0, subtotal - couponDiscount + shipping);
  const earned = getEarnedPoints(subtotal);

  const pointsRows = dialog.querySelectorAll(".popup-dialog-point-row");
  if (pointsRows[0]) {
    const valueEl = pointsRows[0].querySelector("span");
    if (valueEl) valueEl.textContent = `+${earned} نقطة`;
  }
  if (pointsRows[1]) {
    const valueEl = pointsRows[1].querySelector("span");
    if (valueEl)
      valueEl.textContent = `${shopStore.points.balance} نقطة = ${formatCurrency(
        getPointsValue(shopStore.points.balance)
      )}`;
  }

  const checkoutLink = dialog.querySelector(".popup-dialog-checkout");
  if (checkoutLink) {
    checkoutLink.textContent = `التوجه للدفع (${formatCurrency(total)})`;
  }

  const shippingBox = dialog.querySelector(".popup-dialog-shipping");
  if (shippingBox) {
    const remaining = Math.max(0, SHOP_CONFIG.shippingThreshold - subtotal);
    const textEl = shippingBox.querySelector("p");
    if (textEl) {
      textEl.textContent = remaining
        ? `أنت على بعد ${formatCurrency(remaining)} للحصول على امتياز الشحن المجاني.`
        : "أنت مؤهل للشحن المجاني!";
    }
    const fill = shippingBox.querySelector(".popup-dialog-progress-fill");
    if (fill) {
      const progress = Math.min(1, subtotal / SHOP_CONFIG.shippingThreshold) * 100;
      fill.style.width = `${progress}%`;
    }
  }

  const popupCouponInput = dialog.querySelector(".popup-dialog-coupon input");
  if (popupCouponInput && shopStore.coupon?.code) {
    popupCouponInput.value = shopStore.coupon.code;
  }
}

const buildCheckoutItemHtml = (item) => {
  const metaHtml = buildMetaHtml(item.meta || []);
  return `
    <article class="checkout-item" data-item-id="${item.id}">
      <div class="checkout-item-info">
        <div class="checkout-qty">${item.qty}</div>
        <div>
          <h3>${item.name}</h3>
          ${metaHtml ? `<div class="checkout-meta">${metaHtml}</div>` : ""}
          <span class="checkout-chip">
            اسم العنصر
            <img src="assets/figma/product-details/icon-gift.png" alt="" />
          </span>
          <p class="checkout-price">${formatCurrency(item.price)}</p>
        </div>
      </div>
      <div class="checkout-thumb">
        <img src="${item.image || "assets/figma/products/product-01.png"}" alt="${item.name}" />
      </div>
    </article>`;
};

function renderCheckoutPage() {
  const page = document.querySelector(".checkout-page");
  if (!page) return;
  const productsWrap = page.querySelector(".checkout-products");
  if (productsWrap) {
    if (!shopStore.cart.length) {
      productsWrap.innerHTML = '<div class="checkout-empty">سلتك فارغة حالياً.</div>';
    } else {
      productsWrap.innerHTML = shopStore.cart.map(buildCheckoutItemHtml).join("");
    }
  }

  const subtotal = getCartSubtotal();
  const couponDiscount = Math.min(getCouponDiscount(subtotal), subtotal);
  const pointsBalance = shopStore.points.balance || 0;
  const maxPointValue = getPointsValue(pointsBalance);
  const usePoints = page.querySelector(".checkout-checkbox input")?.checked;
  const pointsDiscount = usePoints
    ? Math.min(maxPointValue, Math.max(0, subtotal - couponDiscount))
    : 0;
  const shipping = getShippingFee(subtotal - couponDiscount - pointsDiscount);
  const total = Math.max(0, subtotal - couponDiscount - pointsDiscount + shipping);

  const pricing = page.querySelector(".checkout-pricing");
  if (pricing) {
    const getValueEl = (key) =>
      pricing.querySelector(`[data-price-row="${key}"] [data-price-value]`);
    const subtotalEl = getValueEl("subtotal");
    const couponEl = getValueEl("coupon");
    const pointsEl = getValueEl("points");
    const shippingEl = getValueEl("shipping");
    const totalEl = getValueEl("total");

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (couponEl)
      couponEl.textContent =
        couponDiscount > 0 ? `-${formatCurrency(couponDiscount)}` : formatCurrency(0);
    if (pointsEl)
      pointsEl.textContent =
        pointsDiscount > 0 ? `-${formatCurrency(pointsDiscount)}` : formatCurrency(0);
    if (shippingEl) shippingEl.textContent = formatCurrency(shipping);
    if (totalEl) totalEl.textContent = formatCurrency(total);
  }

  const couponInput = page.querySelector(".checkout-coupon input");
  if (couponInput && shopStore.coupon?.code) {
    couponInput.value = shopStore.coupon.code;
  }

  const pointsRows = page.querySelectorAll(".checkout-points-row");
  const earned = getEarnedPoints(subtotal);
  if (pointsRows[0]) {
    const valueEl = pointsRows[0].querySelector("span");
    if (valueEl) valueEl.textContent = `+${earned} نقطة`;
  }
  if (pointsRows[1]) {
    const valueEl = pointsRows[1].querySelector("span");
    if (valueEl)
      valueEl.textContent = `${pointsBalance} نقطة = ${formatCurrency(
        getPointsValue(pointsBalance)
      )}`;
  }

  const pointsLabel = page.querySelector(".checkout-checkbox");
  if (pointsLabel) {
    const labelText = `استخدم نقاطي (${pointsBalance} نقطة = ${formatCurrency(
      getPointsValue(pointsBalance)
    )} خصم)`;
    const inputEl = pointsLabel.querySelector("input");
    if (inputEl) {
      const textNode = Array.from(pointsLabel.childNodes).find(
        (node) => node.nodeType === 3
      );
      if (textNode) {
        textNode.textContent = ` ${labelText}`;
      } else {
        pointsLabel.appendChild(document.createTextNode(` ${labelText}`));
      }
    } else {
      pointsLabel.textContent = labelText;
    }
  }

  const badge = page.querySelector(".checkout-badge");
  if (badge) badge.textContent = String(getCartCount());
}

function renderOrderConfirmation() {
  const page = document.querySelector(".order-confirmation-page");
  if (!page) return;
  const order =
    shopStore.orders.find((item) => item.id === shopStore.lastOrderId) ||
    shopStore.orders[0];
  if (!order) return;

  const details = page.querySelector(".order-details");
  if (details) {
    const rows = details.querySelectorAll("div");
    if (rows[0]) rows[0].textContent = `رقم الطلب: ${order.number}`;
    if (rows[1]) rows[1].textContent = `طريقة الدفع: ${order.paymentMethod}`;
  }

  const summary = page.querySelector(".order-summary");
  if (summary) {
    const itemsHtml = order.items
      .map(
        (item) => `
        <div class="order-item">
          <div class="order-item-thumb">
            <img src="${item.image || "assets/figma/products/product-01.png"}" alt="${item.name}" />
          </div>
          <div class="order-item-info">
            <h3 class="order-item-title">${item.name}</h3>
            ${item.meta ? `<div class="order-item-meta">${item.meta.join(" · ")}</div>` : ""}
            <span class="order-item-tag">+${getEarnedPoints(item.price * item.qty)} نقطة</span>
            <span class="order-item-price">${formatCurrency(item.price)}</span>
          </div>
          <span class="order-item-qty">${item.qty}</span>
        </div>`
      )
      .join("");

    const totalsHtml = `
      <div class="order-totals">
        <div class="order-totals-row">
          <span>المجموع الفرعي</span>
          <span>${formatCurrency(order.subtotal)}</span>
        </div>
        <div class="order-totals-row">
          <span>كوبون التخفيض</span>
          <span>${order.couponDiscount ? `-${formatCurrency(order.couponDiscount)}` : formatCurrency(0)}</span>
        </div>
        <div class="order-totals-row">
          <span>خصم النقاط</span>
          <span>${order.pointsDiscount ? `-${formatCurrency(order.pointsDiscount)}` : formatCurrency(0)}</span>
        </div>
        <div class="order-totals-row">
          <span>سعر التوصيل</span>
          <span>${formatCurrency(order.shipping)}</span>
        </div>
        <div class="order-totals-row total">
          <span>السعر الإجمالي</span>
          <span>${formatCurrency(order.total)}</span>
        </div>
      </div>
      <div class="order-points">
        <div class="order-points-row">
          <span><i class="fa-solid fa-gift"></i> النقاط المكتسبة من هذا الطلب:</span>
          <span>+${order.earnedPoints} نقطة</span>
        </div>
        <div class="order-points-row">
          <span><i class="fa-regular fa-circle"></i> رصيدك الحالي:</span>
          <span>${shopStore.points.balance} نقطة = ${formatCurrency(
            getPointsValue(shopStore.points.balance)
          )}</span>
        </div>
      </div>`;

    summary.innerHTML = `${itemsHtml}${totalsHtml}`;
  }
}

function renderOrderDetailsPage() {
  const page = document.querySelector(".order-details-page");
  if (!page) return;
  const order =
    shopStore.orders.find((item) => item.id === shopStore.lastOrderId) ||
    shopStore.orders[0];
  if (!order) return;

  const crumb = page.querySelector(".account-breadcrumb span:last-child");
  if (crumb) crumb.textContent = `طلب رقم ${order.number}`;

  const infoHeader = page.querySelector(".order-info-header");
  if (infoHeader) {
    const numberEl = infoHeader.querySelector("div");
    const statusEl = infoHeader.querySelector(".order-status");
    const dateEl = infoHeader.querySelector("div:last-child");
    if (numberEl) numberEl.textContent = `رقم الطلب: ${order.number}`;
    if (statusEl) {
      const statusMap = {
        "قيد التنفيذ": "status-processing",
        "مكتمل": "status-complete",
        "جاري التوصيل": "status-shipping",
        "ملغى": "status-canceled",
        "مرتجع": "status-return",
      };
      statusEl.textContent = order.status;
      statusEl.className = `order-status ${statusMap[order.status] || "status-processing"}`;
    }
    if (dateEl) dateEl.textContent = `التاريخ: ${order.dateLabel || order.createdAt}`;
  }

  const summary = page.querySelector(".order-details-summary");
  if (summary) {
    const itemsHtml = order.items
      .map(
        (item) => `
        <div class="order-item">
          <div class="order-item-thumb">
            <img src="${item.image || "assets/figma/products/product-01.png"}" alt="${item.name}" />
          </div>
          <div class="order-item-info">
            <h3 class="order-item-title">${item.name}</h3>
            ${item.meta ? `<div class="order-item-meta">${item.meta.join(" · ")}</div>` : ""}
            <span class="order-item-tag">+${getEarnedPoints(item.price * item.qty)} نقطة</span>
            <span class="order-item-price">${formatCurrency(item.price)}</span>
          </div>
          <span class="order-item-qty">${item.qty}</span>
        </div>`
      )
      .join("");

    const totalsHtml = `
      <div class="order-totals">
        <div class="order-totals-row">
          <span>المجموع الفرعي</span>
          <span>${formatCurrency(order.subtotal)}</span>
        </div>
        <div class="order-totals-row">
          <span>كوبون التخفيض</span>
          <span>${order.couponDiscount ? `-${formatCurrency(order.couponDiscount)}` : formatCurrency(0)}</span>
        </div>
        <div class="order-totals-row">
          <span>خصم النقاط</span>
          <span>${order.pointsDiscount ? `-${formatCurrency(order.pointsDiscount)}` : formatCurrency(0)}</span>
        </div>
        <div class="order-totals-row">
          <span>سعر التوصيل</span>
          <span>${formatCurrency(order.shipping)}</span>
        </div>
        <div class="order-totals-row total">
          <span>السعر الإجمالي</span>
          <span>${formatCurrency(order.total)}</span>
        </div>
      </div>
      <div class="order-points">
        <div class="order-points-row">
          <span><i class="fa-solid fa-gift"></i> النقاط المكتسبة من هذا الطلب:</span>
          <span>+${order.earnedPoints} نقطة</span>
        </div>
      </div>`;

    summary.innerHTML = `${itemsHtml}${totalsHtml}`;
  }
}

function renderOrdersPage() {
  const list = document.querySelector(".orders-list");
  if (!list) return;
  const orders = shopStore.orders || [];
  if (!orders.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fa-regular fa-clipboard" aria-hidden="true"></i>
        </div>
        <h2>لا توجد طلبات حتى الآن.</h2>
        <p>ابدأ التسوق الآن وسيظهر سجل طلباتك هنا.</p>
      </div>`;
    return;
  }

  const statusMap = {
    "قيد التنفيذ": "status-processing",
    "مكتمل": "status-complete",
    "جاري التوصيل": "status-shipping",
    "ملغى": "status-canceled",
    "مرتجع": "status-return",
  };

  list.innerHTML = orders
    .map((order) => {
      const statusClass = statusMap[order.status] || "status-processing";
      const itemsHtml = order.items
        .map(
          (item) => `
          <div class="orders-item">
            <span class="orders-item-qty">${item.qty}</span>
            <div class="orders-item-info">
              <h3>${item.name}</h3>
              ${item.meta ? `<p>${item.meta.join(" · ")}</p>` : ""}
              <span class="orders-item-price">${formatCurrency(item.price)}</span>
            </div>
            <div class="orders-item-thumb">
              <img src="${item.image || "assets/figma/products/product-01.png"}" alt="${item.name}" />
            </div>
          </div>`
        )
        .join("");

      return `
        <article class="order-card">
          <div class="order-card-header">
            <span class="order-date">التاريخ: ${order.dateLabel || order.createdAt}</span>
            <span class="order-status ${statusClass}">${order.status}</span>
            <span class="order-number">رقم الطلب: ${order.number}</span>
          </div>
          <div class="orders-items">
            ${itemsHtml}
          </div>
          <div class="order-card-footer">
            <span>الإجمالي: ${formatCurrency(order.total)}</span>
            <a class="order-card-btn" href="order-details.html">عرض التفاصيل</a>
          </div>
        </article>`;
    })
    .join("");
}

function renderPointsPage() {
  const page = document.querySelector(".points-page");
  if (!page) return;
  const summary = page.querySelector(".points-summary strong");
  if (summary) {
    summary.textContent = `${shopStore.points.balance} نقطة = ${formatCurrency(
      getPointsValue(shopStore.points.balance)
    )}`;
  }

  const tbody = page.querySelector(".points-table tbody");
  if (!tbody) return;
  const history = shopStore.points.history || [];
  if (!history.length) {
    tbody.innerHTML = '<tr><td colspan="4">لا توجد نقاط حتى الآن.</td></tr>';
    return;
  }

  tbody.innerHTML = history
    .map((entry) => {
      const isPositive = entry.points >= 0;
      return `
        <tr>
          <td>${entry.date || ""}</td>
          <td>${entry.note || ""}</td>
          <td class="${isPositive ? "points-plus" : "points-minus"}">${
        isPositive ? `+${entry.points}` : entry.points
      }</td>
          <td>${entry.balance}</td>
        </tr>`;
    })
    .join("");
}

function renderProfilePage() {
  const page = document.querySelector(".profile-page");
  if (!page) return;

  const profile = shopStore.profile || {};
  const nameEl = page.querySelector("[data-profile-name]");
  const emailEl = page.querySelector("[data-profile-email]");
  const phoneEl = page.querySelector("[data-profile-phone]");
  if (nameEl) nameEl.textContent = profile.name || "";
  if (emailEl) emailEl.textContent = profile.email || "";
  if (phoneEl) phoneEl.textContent = profile.phone || "";

  const addressList = page.querySelector("[data-address-list]");
  if (!addressList) return;
  const addresses = Array.isArray(shopStore.addresses) ? shopStore.addresses : [];
  if (!addresses.length) {
    addressList.innerHTML =
      '<div class="address-empty">لا توجد عناوين بعد. أضف عنوانك الأول الآن.</div>';
    return;
  }

  addressList.innerHTML = addresses
    .map((addr) => {
      const title = addr.label || "عنوان";
      const location = [addr.city, addr.area].filter(Boolean).join(" - ");
      const street = addr.street || "";
      const notes = addr.notes || "";
      const isDefault = addr.isDefault;
      return `
        <article class="address-card" data-address-id="${addr.id}">
          <div class="address-card-header">
            <h4>${title}</h4>
            ${isDefault ? '<span class="address-chip">افتراضي</span>' : ""}
          </div>
          ${location ? `<p class="address-line">${location}</p>` : ""}
          ${street ? `<p class="address-line">${street}</p>` : ""}
          ${notes ? `<p class="address-notes">${notes}</p>` : ""}
          <div class="address-actions">
            <button class="address-btn" type="button" data-address-edit>تعديل</button>
            <button class="address-btn danger" type="button" data-address-delete>حذف</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function initProfilePage() {
  const page = document.querySelector(".profile-page");
  if (!page || page.dataset.profileBound === "true") return;
  page.dataset.profileBound = "true";

  const view = page.querySelector("[data-profile-view]");
  const form = page.querySelector("[data-profile-form]");
  const editBtn = page.querySelector("[data-profile-edit]");
  const cancelBtn = page.querySelector("[data-profile-cancel]");
  const nameInput = form?.querySelector('input[name="name"]');
  const emailInput = form?.querySelector('input[name="email"]');
  const phoneInput = form?.querySelector('input[name="phone"]');

  const showForm = (show) => {
    if (!form || !view) return;
    form.classList.toggle("is-hidden", !show);
    view.classList.toggle("is-hidden", show);
  };

  editBtn?.addEventListener("click", () => {
    const profile = shopStore.profile || {};
    if (nameInput) nameInput.value = profile.name || "";
    if (emailInput) emailInput.value = profile.email || "";
    if (phoneInput) phoneInput.value = profile.phone || "";
    showForm(true);
  });

  cancelBtn?.addEventListener("click", () => {
    showForm(false);
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = {
      name: nameInput?.value?.trim() || "",
      email: emailInput?.value?.trim() || "",
      phone: phoneInput?.value?.trim() || "",
    };
    updateStore((draft) => {
      draft.profile = { ...draft.profile, ...payload };
      return draft;
    });
    showForm(false);
  });

  const addressList = page.querySelector("[data-address-list]");
  const addressForm = page.querySelector("[data-address-form]");
  const addressAdd = page.querySelector("[data-address-add]");
  const addressCancel = addressForm?.querySelector("[data-address-cancel]");
  const addressTitle = addressForm?.querySelector("[data-address-form-title]");
  const addrLabel = addressForm?.querySelector('input[name="label"]');
  const addrCity = addressForm?.querySelector('input[name="city"]');
  const addrArea = addressForm?.querySelector('input[name="area"]');
  const addrStreet = addressForm?.querySelector('input[name="street"]');
  const addrNotes = addressForm?.querySelector('textarea[name="notes"]');
  const addrDefault = addressForm?.querySelector('input[name="isDefault"]');

  let editingId = null;

  const openAddressForm = (addr = null) => {
    if (!addressForm) return;
    editingId = addr?.id || null;
    if (addressTitle) {
      addressTitle.textContent = editingId ? "تعديل العنوان" : "إضافة عنوان جديد";
    }
    if (addrLabel) addrLabel.value = addr?.label || "";
    if (addrCity) addrCity.value = addr?.city || "";
    if (addrArea) addrArea.value = addr?.area || "";
    if (addrStreet) addrStreet.value = addr?.street || "";
    if (addrNotes) addrNotes.value = addr?.notes || "";
    if (addrDefault) addrDefault.checked = !!addr?.isDefault;
    addressForm.classList.remove("is-hidden");
  };

  const closeAddressForm = () => {
    if (!addressForm) return;
    addressForm.classList.add("is-hidden");
    editingId = null;
  };

  addressAdd?.addEventListener("click", () => openAddressForm());
  addressCancel?.addEventListener("click", () => closeAddressForm());

  addressForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = {
      id: editingId || `addr-${Date.now()}`,
      label: addrLabel?.value?.trim() || "",
      city: addrCity?.value?.trim() || "",
      area: addrArea?.value?.trim() || "",
      street: addrStreet?.value?.trim() || "",
      notes: addrNotes?.value?.trim() || "",
      isDefault: !!addrDefault?.checked,
    };

    updateStore((draft) => {
      const addresses = Array.isArray(draft.addresses) ? draft.addresses : [];
      let next = addresses.slice();
      if (payload.isDefault) {
        next = next.map((addr) => ({ ...addr, isDefault: false }));
      }
      const existingIndex = next.findIndex((addr) => addr.id === payload.id);
      if (existingIndex >= 0) {
        next[existingIndex] = { ...next[existingIndex], ...payload };
      } else {
        next.push(payload);
      }
      draft.addresses = next;
      return draft;
    });

    closeAddressForm();
  });

  addressList?.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-address-edit]");
    const deleteBtn = event.target.closest("[data-address-delete]");
    const card = event.target.closest(".address-card");
    if (!card) return;
    const id = card.dataset.addressId;
    if (!id) return;

    if (editBtn) {
      const addr = (shopStore.addresses || []).find((item) => item.id === id);
      if (addr) openAddressForm(addr);
    }

    if (deleteBtn) {
      updateStore((draft) => {
        draft.addresses = (draft.addresses || []).filter((addr) => addr.id !== id);
        if (!draft.addresses.length) return draft;
        if (!draft.addresses.some((addr) => addr.isDefault)) {
          draft.addresses[0].isDefault = true;
        }
        return draft;
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", initProfilePage);

function syncFavoriteButtons() {
  const favoriteIds = new Set((shopStore.favorites || []).map((item) => item.id));
  document
    .querySelectorAll('button[aria-label*="المفضلة"], button[aria-label*="مفضلة"]')
    .forEach((btn) => {
      const product = resolveProductFromButton(btn);
      if (product) btn.dataset.productId = product.id;
      const isFavorite = product ? favoriteIds.has(product.id) : false;
      btn.classList.toggle("is-favorite", isFavorite);
    });
}

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

const buildSearchCatalog = () => {
  const map = new Map();
  const addProduct = (product) => {
    if (product && !map.has(product.id)) map.set(product.id, product);
  };

  document.querySelectorAll(".product-card").forEach((card) => {
    addProduct(extractProductFromCard(card));
  });

  if (document.querySelector(".pm-page")) {
    addProduct(extractProductFromProductPage(document));
  }

  (shopStore.favorites || []).forEach(addProduct);
  (shopStore.cart || []).forEach(addProduct);

  return Array.from(map.values());
};

const findProductMatch = (query) => {
  const q = normalizeSearchText(query);
  if (!q) return null;
  const catalog = buildSearchCatalog();
  return (
    catalog.find((item) => normalizeSearchText(item.name).includes(q)) ||
    catalog.find((item) =>
      normalizeSearchText((item.meta || []).join(" ")).includes(q)
    ) ||
    null
  );
};

const handleSearchSubmit = (value) => {
  const query = String(value || "").trim();
  if (!query) return;
  localStorage.setItem("ipro_last_search", query);
  const match = findProductMatch(query);
  const target = `products.html?search=${encodeURIComponent(query)}`;
  window.location.href = target;
};

function initSearchInputs() {
  const inputs = document.querySelectorAll('input[type="search"]');
  if (!inputs.length) return;
  inputs.forEach((input) => {
    if (input.dataset.searchBound === "true") return;
    input.dataset.searchBound = "true";
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleSearchSubmit(input.value);
    });
  });
}

function initMobileMenu() {
  const burgerImg = document.querySelector(".header-mobile img[src*='burger.svg']");
  if (!burgerImg) return;
  const trigger = burgerImg.closest(".frame") || burgerImg;
  if (trigger.dataset.menuBound === "true") return;
  trigger.dataset.menuBound = "true";

  let menu = document.querySelector(".mobile-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.className = "mobile-menu";
    menu.hidden = true;

    const links = Array.from(document.querySelectorAll(".desktop-links a"))
      .map((link) => ({
        href: link.getAttribute("href"),
        label: link.textContent.trim(),
      }))
      .filter((item) => item.href && item.label);

    const fallbackLinks = [
      { href: "index.html", label: "الرئيسية" },
      { href: "products.html", label: "المنتجات" },
      { href: "products.html", label: "العروض والخصومات" },
      { href: "blog.html", label: "المدونة" },
      { href: "about.html", label: "من نحن" },
      { href: "contact.html", label: "تواصل معنا" },
      { href: "profile.html", label: "الملف الشخصي" },
    ];

    const navLinks = links.length ? links : fallbackLinks;
    const navHtml = navLinks
      .map((item) => `<a href="${item.href}">${item.label}</a>`)
      .join("");

    menu.innerHTML = `
      <div class="mobile-menu-backdrop" data-mobile-menu-close></div>
      <div class="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="القائمة">
        <div class="mobile-menu-header">
          <span>القائمة</span>
          <button type="button" data-mobile-menu-close aria-label="إغلاق">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <nav class="mobile-menu-links">${navHtml}</nav>
      </div>
    `;

    document.body.appendChild(menu);
  }

  const openMenu = () => {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("open"));
    document.body.classList.add("mobile-menu-open");
  };

  const closeMenu = () => {
    menu.classList.remove("open");
    document.body.classList.remove("mobile-menu-open");
    setTimeout(() => {
      menu.hidden = true;
    }, 200);
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openMenu();
  });

  menu.querySelectorAll("[data-mobile-menu-close], .mobile-menu-backdrop").forEach((node) => {
    node.addEventListener("click", closeMenu);
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
}

function refreshShopUI() {
  updateBadgeCounts();
  hydrateProductCardData();
  renderFavoritesPage();
  renderCartPage();
  renderPopupCart();
  renderCheckoutPage();
  renderOrderConfirmation();
  renderOrderDetailsPage();
  renderOrdersPage();
  renderPointsPage();
  renderProfilePage();
  initProductCardNavigation();
  syncFavoriteButtons();
  initButtonLinks();
  initButtonAnimations();
  initQtySteppers();
  initCheckoutSubmission();
  initSearchInputs();
  initMobileMenu();
}

function initCheckoutSubmission() {
  const btn = document.querySelector(".checkout-submit");
  if (!btn || btn.dataset.checkoutBound === "true") return;
  btn.dataset.checkoutBound = "true";
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    const page = document.querySelector(".checkout-page");
    const usePoints = page?.querySelector(".checkout-checkbox input")?.checked;
    const paymentMethod = page
      ?.querySelector(".checkout-payment.active span")
      ?.textContent?.trim();
    const order = createOrderFromCart({ usePoints, paymentMethod });
    if (!order) return;
    const href = btn.getAttribute("data-link") || "order-confirmation.html";
    window.location.href = href;
  });
}

function initShopActions() {
  if (document.body.dataset.shopActionsBound === "true") return;
  document.body.dataset.shopActionsBound = "true";

  document.addEventListener("click", (event) => {
    const headerProfile = event.target.closest(
      ".header img[src*='profile.svg']"
    );
    if (headerProfile) {
      event.preventDefault();
      window.location.href = "profile.html";
      return;
    }

    const headerFavMobile = event.target.closest(
      ".header-mobile img[src*='heart.svg']"
    );
    if (headerFavMobile) {
      event.preventDefault();
      window.location.href = "favorite.html";
      return;
    }

    const addToCartBtn = event.target.closest(".pm-ctas .outline");
    if (addToCartBtn) {
      event.preventDefault();
      const qty =
        parseInt(
          document.querySelector(".pm-qty span")?.textContent?.trim() || "1",
          10
        ) || 1;
      const product = extractProductFromProductPage(document);
      if (product) addToCart(product, qty);
      return;
    }

    const buyNowBtn = event.target.closest(".pm-ctas .solid");
    if (buyNowBtn) {
      event.preventDefault();
      const qty =
        parseInt(
          document.querySelector(".pm-qty span")?.textContent?.trim() || "1",
          10
        ) || 1;
      const product = extractProductFromProductPage(document);
      if (product) addToCart(product, qty);
      const href = buyNowBtn.getAttribute("data-link") || "checkout.html";
      window.location.href = href;
      return;
    }

    const clearFav = event.target.closest('[data-action="clear-favorites"]');
    if (clearFav) {
      event.preventDefault();
      clearFavorites();
      return;
    }

    const cartClearBtn = event.target.closest(".cart-actions .cart-outline-btn");
    if (cartClearBtn && cartClearBtn.textContent.includes("حذف")) {
      event.preventDefault();
      clearCart();
      return;
    }

    const headerRemove = event.target.closest(
      ".cart-items-actions [aria-label='حذف']"
    );
    if (headerRemove) {
      event.preventDefault();
      clearCart();
      return;
    }

    const headerFav = event.target.closest(
      ".cart-items-actions [aria-label*='المفضلة']"
    );
    if (headerFav) {
      event.preventDefault();
      shopStore.cart.forEach((item) => addToFavorites(item));
      return;
    }

    const removeItem = event.target.closest('[data-action="remove-cart-item"]');
    if (removeItem) {
      event.preventDefault();
      const id = removeItem.dataset.itemId;
      if (id) removeFromCart(id);
      return;
    }

    const favItem = event.target.closest('[data-action="favorite-cart-item"]');
    if (favItem) {
      event.preventDefault();
      const product = getProductById(favItem.dataset.productId);
      if (product) addToFavorites(product);
      return;
    }

    const reorderBtn = event.target.closest(".order-info-card .primary-btn");
    if (reorderBtn) {
      event.preventDefault();
      const order =
        shopStore.orders.find((item) => item.id === shopStore.lastOrderId) ||
        shopStore.orders[0];
      if (order) {
        updateStore((draft) => {
          draft.cart = order.items.map((item) => ({ ...item }));
          return draft;
        });
      }
      const href = reorderBtn.getAttribute("href") || "cart.html";
      window.location.href = href;
      return;
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches(".checkout-checkbox input")) {
      refreshShopUI();
    }
  });

  document
    .querySelectorAll(".cart-coupon, .popup-dialog-coupon")
    .forEach((block) => {
      if (block.dataset.couponBound === "true") return;
      block.dataset.couponBound = "true";
      const input = block.querySelector("input");
      const applyBtn = block.querySelector(".cart-apply-btn, .popup-dialog-apply");
      const labelSpan = block.querySelector("label span");
      if (!input || !applyBtn) return;
      if (shopStore.coupon?.code) input.value = shopStore.coupon.code;
      if (labelSpan && !input.placeholder) {
        input.placeholder = labelSpan.textContent.trim();
        labelSpan.classList.add("is-hidden");
      }
      applyBtn.addEventListener("click", () => {
        applyCouponCode(input.value);
      });
    });
}

const initShopBootstrap = async () => {
  await hydrateStoreFromMockApi();
  refreshShopUI();
};

document.addEventListener("DOMContentLoaded", initShopBootstrap);
document.addEventListener("DOMContentLoaded", initShopActions);


function initFaqAccordion() {
  const faqItems = Array.from(document.querySelectorAll(".faq-item"));
  if (!faqItems.length) return;

  faqItems.forEach((item) => {
    const button = item.querySelector(".faq-question");
    if (!button) return;
    button.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      faqItems.forEach((node) => node.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });
}

document.addEventListener("DOMContentLoaded", initFaqAccordion);
