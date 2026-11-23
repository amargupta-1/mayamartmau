/* ============================================================
   MAYA MART – app.js v7 (Independent Storefront Edition)
   Connected to: TRIAL 001 -> 'mayamartmau.in' tab (14-Col Feed)
   Features:
   - Single-fetch live Google Sheet sync + manual Refresh button
   - In-Stock First sorting (Out-of-Stock pushed to bottom)
   - Blinkit-style Main Category -> Subcategory -> Marg Company Filter
   - Selling Rate vs MRP comparison + savings badge + stock urgency
   - Promotional Offer Banner Carousel + Min Home Delivery Notice
   - Cart, Wishlist, Recently Viewed, Deep Links & WhatsApp Checkout
   ============================================================ */

'use strict';

const CONFIG = {
  SHEET_ID:           '1D_ksWAPlSRWVZgz3kaQi3-k8MygM-wxjZnkYLu1Dum0',
  SHEET_NAME:         'mayamartmau.in',
  WA_NUMBER:          '919278224984',
  MIN_DELIVERY_ORDER: 299,
  PAGE_SIZE:          40,
  DEBOUNCE_MS:        280,
  RECENT_MAX:         10,
  STORE_NAME:         'Maya Mart',
  CACHE_KEY:          'mm_products_v7',
  CACHE_TTL:          15 * 60 * 1000, // 15 minutes
  EXCLUDED_CATEGORIES: ['UNCATEGORIZED STAGING', '-BLANK-', 'BLANK', '']
};

const MAIN_CAT_ICONS = {
  'GROCERY & KITCHEN':         ['🌾', '🌶️', '🫙', '🫘', '🍚', '🧂'],
  'SNACKS & MUNCHIES':         ['🍿', '🥨', '🍪', '🥜', '🍘', '🧆'],
  'SWEETS & CHOCOLATES':       ['🍫', '🍬', '🍭', '🧁', '🍩', '🍮'],
  'DAIRY & BREAKFAST':         ['🥛', '🧈', '🧀', '🥣', '🍞', '🍯'],
  'BREAKFAST & DAIRY':         ['🥛', '🧈', '🧀', '🥣', '🍞', '🍯'],
  'BEVERAGES & TEA':           ['🍵', '☕', '🧃', '🥤', '🧋', '🍃'],
  'PACKAGED & INSTANT FOOD':   ['🍜', '🍝', '🥫', '🍲', '🍛', '🍱'],
  'PERSONAL CARE':             ['🧼', '🧴', '🪥', '💇', '🌸', '✨'],
  'CLEANING & HOUSEHOLD':      ['🧹', '🫧', '🪣', '🧽', '🧴', '🧻'],
  'POOJA NEEDS':               ['🪔', '🕯️', '🌺', '🕉️', '✨', '🥥'],
  'HEALTH & WELLNESS':         ['💪', '🍯', '🌿', '💊', '🥗', '⚡'],
  'BABY CARE':                 ['👶', '🍼', '🧸', '🎀', '🛁', '🌸'],
  'ELECTRONICS & ELECTRICALS': ['🔋', '💡', '🔌', '🔦', '⚡', '🎧'],
  'GENERAL GROCERY':           ['🛒', '🏪', '🛍️', '📦', '🧺', '🎁'],
  'DEFAULT':                   ['🛒', '📦', '🏪', '🛍️', '🎁', '🧺']
};

function getCatIcon(cat) {
  const key = String(cat || '').toUpperCase().trim();
  const pool = MAIN_CAT_ICONS[key] || MAIN_CAT_ICONS['DEFAULT'];
  return pool[0];
}

function getIconForProduct(category, productId, productTitle) {
  const key = String(category || '').toUpperCase().trim();
  const pool = MAIN_CAT_ICONS[key] || MAIN_CAT_ICONS['DEFAULT'];
  const str = String(productId) + String(productTitle || '');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash & 0x7fffffff;
  }
  return pool[hash % pool.length];
}

function getCatFallbackSvg(category, productId, productTitle) {
  const icon = productId ? getIconForProduct(category, productId, productTitle) : getCatIcon(category);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
    <rect width='200' height='200' fill='%23fff0f0' rx='16'/>
    <text x='100' y='115' font-size='72' text-anchor='middle' dominant-baseline='middle'>${icon}</text>
  </svg>`;
  return `data:image/svg+xml,${svg.replace(/\n\s*/g, ' ')}`;
}

// ============================================================
// STATE
// ============================================================
let allProducts       = [];
let filteredProds     = [];
let displayedCount    = 0;
let cart              = JSON.parse(localStorage.getItem('mm_cart')     || '[]');
let wishlist          = JSON.parse(localStorage.getItem('mm_wishlist') || '[]');
let recentlyViewed    = JSON.parse(localStorage.getItem('mm_recent')   || '[]');
let activeCategory    = 'ALL';
let activeSubcategory = 'ALL';
let activeBrand       = 'ALL';
let activeFilter      = 'all';
let activeSort        = 'default';
let searchQuery       = '';
let isDark            = localStorage.getItem('mm_dark') === 'true';

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  applyDarkMode();
  initPromoCarousel();
  bindUI();
  initProducts(false);
  renderCartBadge();
  renderWishlistBadge();
  renderRecentlyViewed();
  injectMobileCartBar();
  injectToast();
  handleDeepLink();
});

// ============================================================
// PROMO OFFER BANNER CAROUSEL
// ============================================================
function initPromoCarousel() {
  const track = document.getElementById('promoTrack');
  const prevBtn = document.getElementById('promoPrev');
  const nextBtn = document.getElementById('promoNext');
  const dots = document.querySelectorAll('.promo-dot');
  if (!track || !dots.length) return;

  let current = 0;
  const total = dots.length;
  let timer = null;

  const goTo = (idx) => {
    current = (idx + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  };

  const startAuto = () => {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 5000);
  };

  if (prevBtn) prevBtn.addEventListener('click', () => { goTo(current - 1); startAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { goTo(current + 1); startAuto(); });
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      goTo(Number(dot.dataset.slide) || 0);
      startAuto();
    });
  });

  // Touch swipe support
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 40) {
      goTo(diff < 0 ? current + 1 : current - 1);
      startAuto();
    }
  }, { passive: true });

  startAuto();
}

// ============================================================
// DEEP LINK (?product=ID)
// ============================================================
function handleDeepLink() {
  const pid = new URLSearchParams(location.search).get('product');
  if (!pid) return;
  history.replaceState({}, '', location.pathname);
  const tryOpen = (attempts) => {
    const p = allProducts.find(x => x.id === pid);
    if (p) { openQuickView(p); return; }
    if (attempts > 0) setTimeout(() => tryOpen(attempts - 1), 400);
  };
  tryOpen(12);
}

// ============================================================
// TOAST
// ============================================================
function injectToast() {
  if (document.getElementById('mmToast')) return;
  const t = document.createElement('div');
  t.id = 'mmToast';
  t.className = 'mm-toast';
  document.body.appendChild(t);
}

function showToast(msg) {
  const t = document.getElementById('mmToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('show', 'hide');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.replace('show', 'hide'), 2200);
}

// ============================================================
// STICKY MOBILE CART BAR
// ============================================================
function injectMobileCartBar() {
  if (document.getElementById('mobileCartBar')) return;
  const bar = document.createElement('div');
  bar.className = 'mobile-cart-bar';
  bar.id = 'mobileCartBar';
  bar.innerHTML = `
    <button class="btn btn-primary" id="mobileCartBtn" style="flex:1;justify-content:center;gap:8px;">
      <i class="fa-solid fa-cart-shopping"></i>
      Cart <span class="mobile-cart-bar-count" id="mobileCartCount">0</span>
    </button>
    <button class="btn btn-outline" id="mobileWishBtn" style="flex:1;justify-content:center;gap:8px;">
      <i class="fa-regular fa-heart"></i>
      Wishlist <span class="mobile-cart-bar-count" id="mobileWishCount" style="background:var(--red)">0</span>
    </button>`;
  document.body.appendChild(bar);

  document.getElementById('mobileCartBtn').addEventListener('click', () => {
    renderCartPanel();
    document.getElementById('cartOverlay').classList.remove('hidden');
  });
  document.getElementById('mobileWishBtn').addEventListener('click', () => {
    renderWishPanel();
    document.getElementById('wishlistOverlay').classList.remove('hidden');
  });
  updateMobileBar();
}

function updateMobileBar() {
  const cartTotal = cart.reduce((s, i) => s + i.qty, 0);
  const mc = document.getElementById('mobileCartCount');
  const mw = document.getElementById('mobileWishCount');
  if (mc) mc.textContent = cartTotal;
  if (mw) mw.textContent = wishlist.length;
}

// ============================================================
// DATA FETCHING (Single Live Fetch from 'mayamartmau.in' tab)
// ============================================================
async function initProducts(forceRefresh = false) {
  showLoading(true);
  showError(false);

  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(CONFIG.CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.ts && (Date.now() - cached.ts) < CONFIG.CACHE_TTL && Array.isArray(cached.data) && cached.data.length) {
          allProducts = cached.data;
          onCatalogReady();
          return;
        }
      }
    } catch (e) { /* Ignore corrupt cache */ }
  }

  try {
    const products = await fetchMainStorefrontSheet();
    if (!products.length) throw new Error('No products returned from mayamartmau.in tab');

    allProducts = products;
    try {
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ ts: Date.now(), data: allProducts }));
    } catch (e) { /* Storage full */ }

    onCatalogReady();
    if (forceRefresh) showToast(`✓ Synced ${allProducts.length} live products`);
  } catch (e) {
    console.error('Catalog load failed:', e);
    showLoading(false);
    showError(true);
  }
}

function onCatalogReady() {
  buildCategoryNav();
  buildCategoryGrid();
  buildTaxonomyBars();
  applyFiltersAndRender();
  showLoading(false);
  handleDeepLink();
}

async function fetchMainStorefrontSheet(retries = 2) {
  const encoded = encodeURIComponent(CONFIG.SHEET_NAME);
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encoded}&nocache=${Date.now()}`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const jsonStr = text.replace(/^[^\(]*\(/, '').replace(/\);\s*$/, '');
    const data = JSON.parse(jsonStr);
    if (!data.table || !data.table.rows) return [];
    return parseStorefrontTable(data.table);
  } catch (e) {
    clearTimeout(tid);
    if (retries > 0) {
      await new Promise(res => setTimeout(res, 900));
      return fetchMainStorefrontSheet(retries - 1);
    }
    throw e;
  }
}

function parseStorefrontTable(table) {
  const colMap = {};
  table.cols.forEach((col, i) => {
    const label = (col.label || '').toLowerCase().trim()
      .replace(/[\s\-\.]+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (label) colMap[label] = i;
  });

  // Fallback positional mapping matching A:N schema of mayamartmau.in tab
  const idxOf = (key, fallbackIdx) => (colMap[key] !== undefined ? colMap[key] : fallbackIdx);

  const iId      = idxOf('id', 0);
  const iTitle   = idxOf('title', 1);
  const iDesc    = idxOf('description', 2);
  const iPrice   = idxOf('price', 3);
  const iSale    = idxOf('sale_price', 4);
  const iAvail   = idxOf('availability', 5);
  const iStock   = idxOf('stock_quantity', 6);
  const iImg     = idxOf('image_link', 7);
  const iGtin    = idxOf('gtin', 9);
  const iBrand   = idxOf('brand', 10);
  const iMainCat = idxOf('main_category', 11);
  const iSubCat  = idxOf('subcategory', 12);

  const cellVal = (row, idx) => {
    if (!row.c || !row.c[idx]) return '';
    const v = row.c[idx].v;
    return v !== null && v !== undefined ? String(v).trim() : '';
  };

  const products = [];
  table.rows.forEach(row => {
    if (!row.c || row.c.every(c => !c || c.v === null || c.v === '')) return;

    const id    = cellVal(row, iId);
    const title = cellVal(row, iTitle);
    if (!id || !title) return;
    if (id.toLowerCase() === 'id' || title.toLowerCase() === 'title') return;

    const mainCatRaw = cellVal(row, iMainCat) || 'General Grocery';
    if (CONFIG.EXCLUDED_CATEGORIES.includes(mainCatRaw.toUpperCase())) return;

    const subCatRaw = cellVal(row, iSubCat) || 'General';
    const brandRaw  = cellVal(row, iBrand) || '';
    const brand     = (brandRaw === '-BLANK-' || brandRaw === '') ? 'Other' : brandRaw;

    const desc      = cellVal(row, iDesc);
    const mrp       = parseFloat(cellVal(row, iPrice).replace(/[^0-9.]/g, '')) || 0;
    const rate      = parseFloat(cellVal(row, iSale).replace(/[^0-9.]/g, '')) || 0;
    const stockQty  = parseInt(cellVal(row, iStock).replace(/[^0-9-]/g, ''), 10) || 0;

    const availStr  = cellVal(row, iAvail).toLowerCase().replace(/_/g, ' ');
    const inStock   = availStr.includes('in stock') && !availStr.includes('out') && stockQty > 0;

    // Effective selling price & MRP calculation
    let finalPrice = 0;
    let originalMrp = 0;
    if (rate > 0 && mrp > 0 && rate < mrp) {
      finalPrice = rate;
      originalMrp = mrp;
    } else if (rate > 0) {
      finalPrice = rate;
    } else if (mrp > 0) {
      finalPrice = mrp;
    }

    const rawImage = cellVal(row, iImg);
    const image = rawImage.startsWith('http')
      ? rawImage
      : getCatFallbackSvg(mainCatRaw, id, title);

    const barcode = cellVal(row, iGtin);

    products.push({
      id: String(id),
      title,
      packSize: desc,
      mrp: originalMrp,
      sale_price: finalPrice,
      stock_quantity: stockQty,
      availability: inStock ? 'IN STOCK' : 'OUT OF STOCK',
      inStock,
      image,
      barcode,
      brand,
      category: mainCatRaw,
      subcategory: subCatRaw
    });
  });

  return products;
}

// ============================================================
// BLINKIT 3-TIER TAXONOMY (MAIN CATEGORY -> SUBCATEGORY -> BRAND)
// ============================================================
function getAllCategories() {
  const counts = {};
  allProducts.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
}

function buildCategoryNav() {
  const cats = getAllCategories();
  const navInner = document.getElementById('catNav').querySelector('.cat-nav-inner');
  navInner.innerHTML = '';
  navInner.appendChild(makeMainPill('ALL', `🛒 All (${allProducts.length})`));
  cats.forEach(cat => {
    navInner.appendChild(makeMainPill(cat, `${getCatIcon(cat)} ${cat}`));
  });
}

function makeMainPill(cat, label) {
  const btn = document.createElement('button');
  btn.className = 'cat-pill' + (cat === activeCategory ? ' active' : '');
  btn.dataset.cat = cat;
  btn.textContent = label;
  btn.addEventListener('click', () => {
    setCategory(cat);
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
  });
  return btn;
}

function buildCategoryGrid() {
  const cats = getAllCategories();
  const grid = document.getElementById('catGrid');
  grid.innerHTML = cats.map(cat => {
    const inStockCount = allProducts.filter(p => p.category === cat && p.inStock).length;
    const totalCount   = allProducts.filter(p => p.category === cat).length;
    return `<button class="cat-card${cat === activeCategory ? ' active' : ''}" data-cat="${escHtml(cat)}">
      <div class="cat-card-icon">${getCatIcon(cat)}</div>
      <div class="cat-card-name">${escHtml(cat)}</div>
      <div class="cat-card-count">${inStockCount} in stock · ${totalCount} total</div>
    </button>`;
  }).join('');

  grid.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => {
      setCategory(btn.dataset.cat);
      document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function setCategory(cat) {
  activeCategory    = cat;
  activeSubcategory = 'ALL';
  activeBrand       = 'ALL';

  document.querySelectorAll('.cat-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.cat === cat));
  document.querySelectorAll('.cat-card').forEach(c =>
    c.classList.toggle('active', c.dataset.cat === cat));

  buildTaxonomyBars();
  updateTitle();
  applyFiltersAndRender();
}

function setSubcategory(sub) {
  activeSubcategory = sub;
  activeBrand       = 'ALL';
  buildTaxonomyBars();
  updateTitle();
  applyFiltersAndRender();
}

function setBrand(brand) {
  activeBrand = (activeBrand === brand && brand !== 'ALL') ? 'ALL' : brand;
  buildTaxonomyBars();
  updateTitle();
  applyFiltersAndRender();
}

function buildTaxonomyBars() {
  const subcatRow   = document.getElementById('subcatRow');
  const subcatStrip = document.getElementById('subcatStrip');
  const brandStrip  = document.getElementById('brandStrip');
  const crumbWrap   = document.getElementById('activeBreadcrumb');
  const crumbTrail  = document.getElementById('breadcrumbTrail');

  // 1. Subcategory pills (visible when a Main Category is selected)
  if (activeCategory !== 'ALL') {
    const catProds = allProducts.filter(p => p.category === activeCategory);
    const subCounts = {};
    catProds.forEach(p => {
      subCounts[p.subcategory] = (subCounts[p.subcategory] || 0) + 1;
    });
    const subs = Object.entries(subCounts).sort((a, b) => b[1] - a[1]);

    subcatRow.classList.remove('hidden');
    let subHtml = `<button class="subcat-pill${activeSubcategory === 'ALL' ? ' active' : ''}" data-sub="ALL">
      All in ${escHtml(activeCategory)} <span class="subcat-count">${catProds.length}</span>
    </button>`;
    subs.forEach(([sub, count]) => {
      subHtml += `<button class="subcat-pill${activeSubcategory === sub ? ' active' : ''}" data-sub="${escHtml(sub)}">
        ${escHtml(sub)} <span class="subcat-count">${count}</span>
      </button>`;
    });
    subcatStrip.innerHTML = subHtml;
    subcatStrip.querySelectorAll('.subcat-pill').forEach(btn => {
      btn.addEventListener('click', () => setSubcategory(btn.dataset.sub));
    });
  } else {
    subcatRow.classList.add('hidden');
    subcatStrip.innerHTML = '';
  }

  // 2. Optional Brand (Marg Company) pills scoped to active Category + Subcategory
  let scoped = allProducts;
  if (activeCategory !== 'ALL')    scoped = scoped.filter(p => p.category === activeCategory);
  if (activeSubcategory !== 'ALL') scoped = scoped.filter(p => p.subcategory === activeSubcategory);

  const brandCounts = {};
  scoped.forEach(p => {
    if (p.brand && p.brand !== 'Other') {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    }
  });
  const brands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);

  let brandHtml = `<button class="brand-pill${activeBrand === 'ALL' ? ' active' : ''}" data-brand="ALL">
    All Brands (${scoped.length})
  </button>`;
  brands.forEach(([b, count]) => {
    brandHtml += `<button class="brand-pill${activeBrand === b ? ' active' : ''}" data-brand="${escHtml(b)}">
      ${escHtml(b)} (${count})
    </button>`;
  });
  brandStrip.innerHTML = brandHtml;
  brandStrip.querySelectorAll('.brand-pill').forEach(btn => {
    btn.addEventListener('click', () => setBrand(btn.dataset.brand));
  });

  // 3. Breadcrumb trail
  const crumbs = [];
  if (activeCategory !== 'ALL')    crumbs.push(`<span class="breadcrumb-crumb">${escHtml(activeCategory)}</span>`);
  if (activeSubcategory !== 'ALL') crumbs.push(`<span>›</span><span class="breadcrumb-crumb">${escHtml(activeSubcategory)}</span>`);
  if (activeBrand !== 'ALL')       crumbs.push(`<span>›</span><span class="breadcrumb-crumb">Brand: ${escHtml(activeBrand)}</span>`);

  if (crumbs.length) {
    crumbWrap.classList.remove('hidden');
    crumbTrail.innerHTML = `<span>Browsing:</span> ${crumbs.join(' ')}`;
  } else {
    crumbWrap.classList.add('hidden');
    crumbTrail.innerHTML = '';
  }
}

// ============================================================
// FILTER / IN-STOCK FIRST SORT / SEARCH
// ============================================================
function applyFiltersAndRender() {
  let prods = [...allProducts];

  if (activeCategory !== 'ALL')    prods = prods.filter(p => p.category === activeCategory);
  if (activeSubcategory !== 'ALL') prods = prods.filter(p => p.subcategory === activeSubcategory);
  if (activeBrand !== 'ALL')       prods = prods.filter(p => p.brand === activeBrand);

  if (activeFilter === 'instock') {
    prods = prods.filter(p => p.inStock);
  } else if (activeFilter === 'outofstock') {
    prods = prods.filter(p => !p.inStock);
  } else if (activeFilter === 'sale') {
    prods = prods.filter(p => p.mrp > 0 && p.sale_price > 0 && p.sale_price < p.mrp);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    prods = prods.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.subcategory.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q)
    );
  }

  // Always keep In-Stock items first and push Out-of-Stock items to the bottom
  prods.sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

    if (activeSort === 'price-low')  return (a.sale_price || 999999) - (b.sale_price || 999999);
    if (activeSort === 'price-high') return (b.sale_price || 0) - (a.sale_price || 0);
    if (activeSort === 'alpha-az')   return a.title.localeCompare(b.title);
    if (activeSort === 'alpha-za')   return b.title.localeCompare(a.title);
    return 0;
  });

  filteredProds  = prods;
  displayedCount = 0;

  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';

  updateSearchCount(prods.length);

  if (!prods.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:56px 20px;color:var(--text-muted)">
      <div style="font-size:2.4rem;margin-bottom:10px;">🔍</div>
      <div style="font-size:1rem;font-weight:800;margin-bottom:6px">No matching products found</div>
      <div style="font-size:.85rem;margin-bottom:14px">Try clearing your search or switching back to All Brands</div>
      <button class="btn btn-outline" onclick="resetAllFilters()">Show All Products</button>
    </div>`;
    document.getElementById('loadMoreWrap').classList.add('hidden');
    updateSubtitle(0, 0);
    return;
  }

  const inStockVisible = prods.filter(p => p.inStock).length;
  renderNextPage();
  updateSubtitle(prods.length, inStockVisible);
}

function resetAllFilters() {
  activeCategory    = 'ALL';
  activeSubcategory = 'ALL';
  activeBrand       = 'ALL';
  activeFilter      = 'all';
  searchQuery       = '';

  ['searchInput', 'searchInputMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.search-clear-btn').forEach(b => b.style.display = 'none');
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));

  buildTaxonomyBars();
  updateTitle();
  applyFiltersAndRender();
}

function updateSearchCount(count) {
  const el = document.getElementById('searchResultCount');
  if (!el) return;
  if (!searchQuery) { el.textContent = ''; return; }
  el.textContent = count === 0
    ? `No results for "${searchQuery}"`
    : `${count} result${count === 1 ? '' : 's'} for "${searchQuery}"`;
}

function renderNextPage() {
  const slice = filteredProds.slice(displayedCount, displayedCount + CONFIG.PAGE_SIZE);
  const grid  = document.getElementById('productGrid');
  const frag  = document.createDocumentFragment();
  slice.forEach((p, i) => {
    const card = createProductCard(p);
    card.style.animationDelay = `${(i % CONFIG.PAGE_SIZE) * 10}ms`;
    frag.appendChild(card);
  });
  grid.appendChild(frag);
  displayedCount += slice.length;
  document.getElementById('loadMoreWrap')
    .classList.toggle('hidden', displayedCount >= filteredProds.length);
}

// ============================================================
// SEARCH SUGGESTIONS
// ============================================================
function showSuggestions(q) {
  ['searchSuggestions', 'searchSuggestionsMobile'].forEach(boxId => {
    const box = document.getElementById(boxId);
    if (!box) return;
    if (!q || q.length < 2) {
      box.innerHTML = '';
      box.classList.remove('open');
      return;
    }
    const matches = allProducts
      .filter(p => p.title.toLowerCase().includes(q.toLowerCase()) || p.brand.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (a.inStock === b.inStock ? 0 : a.inStock ? -1 : 1))
      .slice(0, 6);

    if (!matches.length) {
      box.innerHTML = '';
      box.classList.remove('open');
      return;
    }

    box.innerHTML = matches.map(p => `
      <div class="suggestion-item" data-id="${escHtml(p.id)}">
        <div style="flex:1">
          <div class="suggestion-name">${escHtml(p.title)} ${p.packSize ? `(${escHtml(p.packSize)})` : ''}</div>
          <div class="suggestion-meta">${escHtml(p.brand)} · ${escHtml(p.subcategory)} · ${p.inStock ? 'In Stock' : 'Out of Stock'}</div>
        </div>
        <div style="font-weight:800;color:var(--primary);font-size:.86rem">${p.sale_price > 0 ? '₹' + p.sale_price : ''}</div>
      </div>`).join('');

    box.classList.add('open');
    box.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const p = allProducts.find(x => x.id === item.dataset.id);
        if (p) openQuickView(p);
        hideSuggestions();
      });
    });
  });
}

function hideSuggestions() {
  ['searchSuggestions', 'searchSuggestionsMobile'].forEach(id => {
    const box = document.getElementById(id);
    if (box) box.classList.remove('open');
  });
}

// ============================================================
// SKELETON LOADING
// ============================================================
function showSkeletons() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="product-card skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="product-card-body">
        <div class="skeleton skeleton-line" style="width:45%;height:11px;margin-bottom:6px"></div>
        <div class="skeleton skeleton-line" style="width:85%;height:14px;margin-bottom:8px"></div>
        <div class="skeleton skeleton-line" style="width:40%;height:18px"></div>
      </div>
      <div class="product-card-footer">
        <div class="skeleton skeleton-line" style="width:100%;height:34px;border-radius:8px"></div>
      </div>
    </div>`).join('');
}

// ============================================================
// PRODUCT CARD
// ============================================================
function createProductCard(p) {
  const inCart  = getCartQty(p.id);
  const inWish  = wishlist.some(w => w.id === p.id);
  const inStock = p.inStock;
  const hasSale = p.mrp > 0 && p.sale_price > 0 && p.sale_price < p.mrp;
  const saveAmt = hasSale ? Math.round(p.mrp - p.sale_price) : 0;
  const lowStock = inStock && p.stock_quantity > 0 && p.stock_quantity <= 5;

  const card = document.createElement('div');
  card.className = 'product-card' + (!inStock ? ' product-card--oos' : '');
  card.setAttribute('data-id', p.id);

  card.innerHTML = `
    <div class="product-card-img-wrap">
      <img class="product-card-img"
           data-src="${escHtml(p.image)}"
           data-cat="${escHtml(p.category)}"
           data-pid="${escHtml(p.id)}"
           data-ptitle="${escHtml(p.title)}"
           src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
           alt="${escHtml(p.title)}" loading="lazy" />
      ${!inStock
        ? '<span class="product-card-badge product-card-badge--oos">Out of Stock</span>'
        : hasSale
          ? `<span class="product-card-badge product-card-badge--sale">Save ₹${saveAmt}</span>`
          : ''}
      <button class="product-card-wish${inWish ? ' wished' : ''}" aria-label="Wishlist">
        <i class="fa-${inWish ? 'solid' : 'regular'} fa-heart"></i>
      </button>
    </div>
    <div class="product-card-body">
      ${p.brand && p.brand !== 'Other' ? `<div class="product-card-brand">${escHtml(p.brand)}</div>` : ''}
      <div class="product-card-name">${escHtml(p.title)}</div>
      ${p.packSize ? `<span class="product-card-pack">${escHtml(p.packSize)}</span>` : ''}
      <div class="product-card-price">
        ${p.sale_price > 0
          ? `₹${p.sale_price}`
          : '<span style="color:var(--text-muted);font-size:.84rem">Ask Rate on WA</span>'}
        ${hasSale ? `<span class="original">₹${p.mrp}</span>` : ''}
      </div>
      <div class="product-card-avail ${!inStock ? 'out-stock' : lowStock ? 'low-stock' : 'in-stock'}">
        ${!inStock
          ? '● Out of Stock'
          : lowStock
            ? `● Only ${p.stock_quantity} left`
            : '● In Stock'}
      </div>
    </div>
    <div class="product-card-footer" data-footer="${escHtml(p.id)}">
      ${inCart > 0
        ? qtyStepperHTML(p.id, inCart)
        : `<button class="btn-add" ${!inStock ? 'disabled' : ''}>
             <i class="fa-solid fa-cart-plus"></i> ${inStock ? 'Add to Cart' : 'Out of Stock'}
           </button>`}
      <button class="btn-qv"><i class="fa-solid fa-eye"></i> Quick View</button>
    </div>`;

  lazyLoad(card.querySelector('.product-card-img'));

  card.querySelector('.product-card-wish').addEventListener('click', e => {
    e.stopPropagation();
    toggleWishlist(p);
    const btn = e.currentTarget;
    btn.classList.remove('heart-bounce');
    void btn.offsetWidth;
    btn.classList.add('heart-bounce');
    const icon = btn.querySelector('i');
    const nowWished = wishlist.some(w => w.id === p.id);
    icon.className = `fa-${nowWished ? 'solid' : 'regular'} fa-heart`;
    btn.classList.toggle('wished', nowWished);
  });

  card.querySelector('.btn-qv').addEventListener('click', () => openQuickView(p));

  const addBtn = card.querySelector('.btn-add');
  if (addBtn && inStock) {
    addBtn.addEventListener('click', () => {
      addToCart(p);
      refreshCardFooter(p.id);
      showToast(`✓ ${p.title} added to cart`);
    });
  }

  bindStepperEvents(card, p);
  return card;
}

function qtyStepperHTML(id, qty) {
  return `<div class="qty-stepper">
    <button class="stepper-minus" aria-label="Decrease">−</button>
    <span class="qty-val">${qty}</span>
    <button class="stepper-plus" aria-label="Increase">+</button>
  </div>`;
}

function addBtnHTML(p) {
  return `<button class="btn-add" ${!p.inStock ? 'disabled' : ''}>
    <i class="fa-solid fa-cart-plus"></i> ${p.inStock ? 'Add to Cart' : 'Out of Stock'}
  </button>`;
}

function bindStepperEvents(card, p) {
  const minus = card.querySelector('.stepper-minus');
  const plus  = card.querySelector('.stepper-plus');
  if (minus) minus.addEventListener('click', () => { changeCartQty(p.id, -1); refreshCardFooter(p.id); });
  if (plus)  plus.addEventListener('click',  () => { changeCartQty(p.id,  1); refreshCardFooter(p.id); });
}

function refreshCardFooter(id) {
  const card = document.querySelector(`.product-card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  const footer = card.querySelector(`[data-footer="${CSS.escape(id)}"]`);
  if (!footer) return;
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const qty = getCartQty(id);
  const qvBtn = '<button class="btn-qv"><i class="fa-solid fa-eye"></i> Quick View</button>';
  footer.innerHTML = (qty > 0 ? qtyStepperHTML(id, qty) : addBtnHTML(p)) + qvBtn;

  const addBtn = footer.querySelector('.btn-add');
  if (addBtn && p.inStock) {
    addBtn.addEventListener('click', () => {
      addToCart(p);
      refreshCardFooter(id);
      showToast(`✓ ${p.title} added to cart`);
    });
  }
  footer.querySelector('.btn-qv').addEventListener('click', () => openQuickView(p));
  bindStepperEvents(card, p);
}

// ============================================================
// LAZY LOAD
// ============================================================
const imgObserver = window.IntersectionObserver
  ? new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        img.src = img.dataset.src;
        img.onerror = () => {
          img.src = getCatFallbackSvg(img.dataset.cat || 'DEFAULT', img.dataset.pid, img.dataset.ptitle);
          img.onerror = null;
        };
        obs.unobserve(img);
      });
    }, { rootMargin: '300px' })
  : null;

function lazyLoad(img) {
  if (imgObserver) imgObserver.observe(img);
  else img.src = img.dataset.src;
}

// ============================================================
// QUICK VIEW
// ============================================================
function openQuickView(p) {
  addToRecentlyViewed(p);
  const hasSale = p.mrp > 0 && p.sale_price > 0 && p.sale_price < p.mrp;
  const inStock = p.inStock;

  document.getElementById('qvContent').innerHTML = `
    <div class="qv-img-wrap">
      <img class="qv-img" src="${escHtml(p.image)}" alt="${escHtml(p.title)}" loading="lazy"
           onerror="this.src=getCatFallbackSvg('${escHtml(p.category)}','${escHtml(p.id)}');this.onerror=null" />
    </div>
    <div class="qv-info">
      <div class="qv-cat">${escHtml(p.category)} › ${escHtml(p.subcategory)}</div>
      <div class="qv-name">${escHtml(p.title)}</div>
      <div class="qv-metas">
        ${p.brand && p.brand !== 'Other' ? `<span class="qv-meta-tag">🏷️ ${escHtml(p.brand)}</span>` : ''}
        ${p.packSize ? `<span class="qv-meta-tag">⚖️ ${escHtml(p.packSize)}</span>` : ''}
        <span class="qv-meta-tag">ID: ${escHtml(p.id)}</span>
        ${p.barcode ? `<span class="qv-meta-tag">📦 ${escHtml(p.barcode)}</span>` : ''}
      </div>
      <div class="qv-price">
        ${p.sale_price > 0 ? `₹${p.sale_price}` : '<span style="font-size:.9rem">Confirm rate on WhatsApp</span>'}
        ${hasSale ? `<span style="font-size:.85rem;text-decoration:line-through;color:var(--text-muted);font-weight:600;margin-left:6px">₹${p.mrp}</span>` : ''}
      </div>
      <div class="qv-price-label">${hasSale ? `You save ₹${Math.round(p.mrp - p.sale_price)} off MRP` : 'Store selling rate (incl. taxes)'}</div>
      <div class="qv-avail ${inStock ? 'in-stock' : 'out-stock'}">
        ${inStock ? `✔ In Stock${p.stock_quantity <= 5 ? ` (Only ${p.stock_quantity} left)` : ''}` : '✖ Currently Out of Stock'}
      </div>
      <div class="qv-actions" id="qvActions">
        ${getCartQty(p.id) > 0
          ? qtyStepperHTML(p.id, getCartQty(p.id))
          : `<button class="btn btn-primary btn-full qv-add-btn" ${!inStock ? 'disabled' : ''}>
               <i class="fa-solid fa-cart-plus"></i> ${inStock ? 'Add to Cart' : 'Out of Stock'}
             </button>`}
      </div>
      <button class="btn btn-outline btn-full qv-share-btn" style="margin-top:8px;">
        <i class="fa-solid fa-share-nodes"></i> Share Product
      </button>
    </div>`;

  const overlay = document.getElementById('quickViewOverlay');
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  bindQVActions(overlay, p);
  overlay.querySelector('.qv-share-btn').addEventListener('click', () => shareProduct(p));
}

function bindQVActions(overlay, p) {
  const actionsDiv = overlay.querySelector('#qvActions');
  const addBtn = actionsDiv.querySelector('.qv-add-btn');
  if (addBtn && p.inStock) {
    addBtn.addEventListener('click', () => {
      addToCart(p);
      refreshCardFooter(p.id);
      showToast(`✓ ${p.title} added to cart`);
      actionsDiv.innerHTML = qtyStepperHTML(p.id, getCartQty(p.id));
      bindQVSteppers(actionsDiv, p);
    });
  }
  bindQVSteppers(actionsDiv, p);
}

function bindQVSteppers(ctx, p) {
  const minus = ctx.querySelector('.stepper-minus');
  const plus  = ctx.querySelector('.stepper-plus');
  const qvActions = document.getElementById('qvActions');

  if (minus) minus.addEventListener('click', () => {
    changeCartQty(p.id, -1);
    refreshCardFooter(p.id);
    const q = getCartQty(p.id);
    const qv = ctx.querySelector('.qty-val');
    if (qv) qv.textContent = q;
    if (q === 0 && qvActions) {
      qvActions.innerHTML = `<button class="btn btn-primary btn-full qv-add-btn">
        <i class="fa-solid fa-cart-plus"></i> Add to Cart
      </button>`;
      bindQVActions(document.getElementById('quickViewOverlay'), p);
    }
  });

  if (plus) plus.addEventListener('click', () => {
    changeCartQty(p.id, 1);
    refreshCardFooter(p.id);
    const qv = ctx.querySelector('.qty-val');
    if (qv) qv.textContent = getCartQty(p.id);
  });
}

function closeQuickView() {
  document.getElementById('quickViewOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function shareProduct(p) {
  const url = `${location.origin}${location.pathname}?product=${encodeURIComponent(p.id)}`;
  if (navigator.share) {
    navigator.share({ title: p.title, text: `Check out ${p.title} on Maya Mart`, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('📋 Product link copied!')).catch(() => {});
  }
}

// ============================================================
// CART & WISHLIST
// ============================================================
function addToCart(p) {
  const existing = cart.find(i => i.id === p.id);
  if (existing) existing.qty += 1;
  else {
    cart.push({
      id: p.id,
      title: p.title,
      packSize: p.packSize || '',
      price: p.sale_price || 0,
      image: p.image,
      qty: 1,
      category: p.category
    });
  }
  saveCart();
  renderCartBadge();
  updateMobileBar();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCartBadge();
  updateMobileBar();
}

function changeCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCartBadge();
  updateMobileBar();
}

function getCartQty(id) {
  const item = cart.find(i => i.id === id);
  return item ? item.qty : 0;
}

function saveCart() { localStorage.setItem('mm_cart', JSON.stringify(cart)); }

function renderCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById('cartCount');
  if (el) {
    el.textContent = total;
    el.classList.toggle('hidden', total === 0);
  }
}

function toggleWishlist(p) {
  const idx = wishlist.findIndex(w => w.id === p.id);
  if (idx >= 0) wishlist.splice(idx, 1);
  else wishlist.push({ id: p.id, title: p.title, price: p.sale_price || 0, image: p.image, category: p.category });
  localStorage.setItem('mm_wishlist', JSON.stringify(wishlist));
  renderWishlistBadge();
  updateMobileBar();
}

function renderWishlistBadge() {
  const el = document.getElementById('wishlistCount');
  if (el) {
    el.textContent = wishlist.length;
    el.classList.toggle('hidden', wishlist.length === 0);
  }
}

// ============================================================
// RECENTLY VIEWED
// ============================================================
function addToRecentlyViewed(p) {
  recentlyViewed = recentlyViewed.filter(r => r.id !== p.id);
  recentlyViewed.unshift({ id: p.id, title: p.title, price: p.sale_price || 0, image: p.image, category: p.category });
  if (recentlyViewed.length > CONFIG.RECENT_MAX) recentlyViewed.pop();
  localStorage.setItem('mm_recent', JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const wrap = document.getElementById('recentSection');
  const list = document.getElementById('recentGrid');
  if (!wrap || !list) return;
  if (!recentlyViewed.length) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  list.innerHTML = recentlyViewed.map(r => `
    <div class="recent-card" data-id="${escHtml(r.id)}" style="
      flex-shrink:0;width:130px;background:var(--surface);border:1.5px solid var(--border);
      border-radius:12px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;">
      <div style="width:130px;height:95px;background:var(--surface2);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${escHtml(r.image)}" alt="${escHtml(r.title)}"
             data-cat="${escHtml(r.category || 'DEFAULT')}" data-pid="${escHtml(r.id)}"
             style="width:100%;height:100%;object-fit:contain;padding:6px;"
             onerror="this.src=getCatFallbackSvg(this.dataset.cat,this.dataset.pid);this.onerror=null" />
      </div>
      <div style="padding:8px;flex:1;display:flex;flex-direction:column;gap:3px;">
        <div style="font-size:.74rem;font-weight:700;color:var(--text);line-height:1.3;
                    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(r.title)}</div>
        <div style="font-size:.78rem;font-weight:800;color:var(--primary);">${r.price > 0 ? '₹' + r.price : '—'}</div>
      </div>
    </div>`).join('');

  list.querySelectorAll('.recent-card').forEach(card => {
    card.addEventListener('click', () => {
      const p = allProducts.find(x => x.id === card.dataset.id);
      if (p) openQuickView(p);
    });
  });
}

// ============================================================
// DARK MODE & UI HELPERS
// ============================================================
function applyDarkMode() {
  document.body.classList.toggle('dark-mode', isDark);
}

function toggleDarkMode() {
  isDark = !isDark;
  localStorage.setItem('mm_dark', isDark);
  applyDarkMode();
}

function showLoading(show) {
  const el = document.getElementById('loadingState');
  if (el) el.classList.toggle('hidden', !show);
  if (show) showSkeletons();
}

function showError(show) {
  const el = document.getElementById('errorState');
  if (el) el.classList.toggle('hidden', !show);
}

function updateTitle() {
  const el = document.getElementById('productsTitle');
  if (!el) return;
  if (activeBrand !== 'ALL') {
    el.textContent = `🏷️ ${activeBrand}`;
  } else if (activeSubcategory !== 'ALL') {
    el.textContent = `${getCatIcon(activeCategory)} ${activeSubcategory}`;
  } else if (activeCategory !== 'ALL') {
    el.textContent = `${getCatIcon(activeCategory)} ${activeCategory}`;
  } else {
    el.textContent = 'All Products';
  }
}

function updateSubtitle(totalCount, inStockCount) {
  const el = document.getElementById('productsSubtitle');
  if (!el) return;
  el.textContent = `Showing ${totalCount} products (${inStockCount} in stock first)`;
}

// ============================================================
// BIND UI
// ============================================================
function bindUI() {
  let debounceTimer;

  const updateClearBtn = (input) => {
    const wrap = input.closest('.search-wrap');
    const btn = wrap && wrap.querySelector('.search-clear-btn');
    if (btn) btn.style.display = input.value ? 'flex' : 'none';
  };

  const onSearchInput = (input) => {
    updateClearBtn(input);
    showSuggestions(input.value.trim());
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.trim();
      const other = input.id === 'searchInput'
        ? document.getElementById('searchInputMobile')
        : document.getElementById('searchInput');
      if (other && other.value !== input.value) { other.value = input.value; updateClearBtn(other); }
      applyFiltersAndRender();
    }, CONFIG.DEBOUNCE_MS);
  };

  const clearSearch = () => {
    ['searchInput', 'searchInputMobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; updateClearBtn(el); }
    });
    searchQuery = '';
    hideSuggestions();
    applyFiltersAndRender();
  };

  ['searchInput', 'searchInputMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => onSearchInput(el));
      el.addEventListener('blur', () => setTimeout(hideSuggestions, 200));
    }
  });

  document.querySelectorAll('.search-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => { clearSearch(); btn.closest('.search-wrap')?.querySelector('input')?.focus(); });
  });

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFiltersAndRender();
    });
  });

  const resetTaxBtn = document.getElementById('resetTaxBtn');
  if (resetTaxBtn) resetTaxBtn.addEventListener('click', resetAllFilters);

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.addEventListener('change', () => { activeSort = sortSelect.value; applyFiltersAndRender(); });

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', renderNextPage);

  const darkToggle = document.getElementById('darkToggle');
  if (darkToggle) darkToggle.addEventListener('click', toggleDarkMode);

  const refreshBtn = document.getElementById('refreshCatalogBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => initProducts(true));

  const wholesaleBtn = document.getElementById('wholesaleBtn');
  if (wholesaleBtn) {
    wholesaleBtn.addEventListener('click', () => {
      const msg = 'Hello Maya Mart! I want to inquire about wholesale / bulk pricing for an order.';
      window.open(`https://wa.me/${CONFIG.WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }

  // Back to top
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Quick view
  const qvClose = document.getElementById('qvClose');
  if (qvClose) qvClose.addEventListener('click', closeQuickView);
  const qvOverlay = document.getElementById('quickViewOverlay');
  if (qvOverlay) qvOverlay.addEventListener('click', e => { if (e.target === qvOverlay) closeQuickView(); });

  // Cart panel
  const cartBtn   = document.getElementById('cartBtn');
  const cartPanel = document.getElementById('cartOverlay');
  const cartClose = document.getElementById('cartClose');
  if (cartBtn)   cartBtn.addEventListener('click', () => { renderCartPanel(); cartPanel.classList.remove('hidden'); });
  if (cartClose) cartClose.addEventListener('click', () => cartPanel.classList.add('hidden'));
  if (cartPanel) cartPanel.addEventListener('click', e => { if (e.target === cartPanel) cartPanel.classList.add('hidden'); });

  // Wishlist panel
  const wishBtn   = document.getElementById('wishlistBtn');
  const wishPanel = document.getElementById('wishlistOverlay');
  const wishClose = document.getElementById('wishlistClose');
  if (wishBtn)   wishBtn.addEventListener('click', () => { renderWishPanel(); wishPanel.classList.remove('hidden'); });
  if (wishClose) wishClose.addEventListener('click', () => wishPanel.classList.add('hidden'));
  if (wishPanel) wishPanel.addEventListener('click', e => { if (e.target === wishPanel) wishPanel.classList.add('hidden'); });
}

// ============================================================
// CART PANEL RENDER (With Home Delivery Minimum Order Progress)
// ============================================================
function renderCartPanel() {
  const list   = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  if (!list) return;

  if (!cart.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:2.4rem;margin-bottom:10px;">🛒</div>
      <div style="font-weight:800;font-size:.95rem;margin-bottom:4px">Your cart is empty</div>
      <div style="font-size:.82rem">Add in-stock items to get started</div>
    </div>`;
    if (footer) footer.innerHTML = '';
    return;
  }

  list.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${escHtml(item.id)}">
      <img class="cart-item-img" src="${escHtml(item.image)}" alt="${escHtml(item.title)}"
           data-cat="${escHtml(item.category || 'DEFAULT')}" data-pid="${escHtml(item.id)}"
           onerror="this.src=getCatFallbackSvg(this.dataset.cat,this.dataset.pid);this.onerror=null" />
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.title)} ${item.packSize ? `(${escHtml(item.packSize)})` : ''}</div>
        <div class="cart-item-price">${item.price > 0 ? '₹' + item.price : 'Confirm rate'}</div>
      </div>
      <div class="cart-item-right">
        <button class="cart-item-remove-btn" data-id="${escHtml(item.id)}" aria-label="Remove item" title="Remove">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="cart-item-stepper">
          <button class="stepper-minus" data-id="${escHtml(item.id)}">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="stepper-plus" data-id="${escHtml(item.id)}">+</button>
        </div>
        ${item.price > 0 ? `<div style="font-size:.75rem;color:var(--text-muted);text-align:right">= ₹${item.price * item.qty}</div>` : ''}
      </div>
    </div>`).join('');

  list.querySelectorAll('.cart-item-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(btn.dataset.id);
      refreshCardFooter(btn.dataset.id);
      renderCartPanel();
    });
  });
  list.querySelectorAll('.stepper-minus').forEach(btn => {
    btn.addEventListener('click', () => { changeCartQty(btn.dataset.id, -1); refreshCardFooter(btn.dataset.id); renderCartPanel(); });
  });
  list.querySelectorAll('.stepper-plus').forEach(btn => {
    btn.addEventListener('click', () => { changeCartQty(btn.dataset.id, 1); refreshCardFooter(btn.dataset.id); renderCartPanel(); });
  });

  const sum = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const minOrd = CONFIG.MIN_DELIVERY_ORDER;
  const remaining = Math.max(0, minOrd - sum);
  const pct = Math.min(100, Math.round((sum / minOrd) * 100));

  if (footer) {
    const savedName    = localStorage.getItem('mm_cust_name')    || '';
    const savedAddress = localStorage.getItem('mm_cust_address') || '';

    footer.innerHTML = `
      <div class="delivery-progress-box">
        ${remaining > 0
          ? `<i class="fa-solid fa-truck-fast"></i> Add <strong>₹${remaining}</strong> more for <strong>Free Home Delivery</strong> (Min. ₹${minOrd})`
          : `<i class="fa-solid fa-circle-check"></i> Eligible for <strong>Free Home Delivery</strong> in Mau!`}
        <div class="delivery-progress-bar"><div class="delivery-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="cart-total">
        <span>Estimated Total</span>
        <strong>${sum > 0 ? '₹' + sum : 'Confirm with store'}</strong>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="btnDelivery" class="btn btn-primary" style="flex:1;justify-content:center;font-size:.82rem;padding:9px 0;">
          <i class="fa-solid fa-truck-fast"></i> Home Delivery
        </button>
        <button id="btnPickup" class="btn btn-outline" style="flex:1;justify-content:center;font-size:.82rem;padding:9px 0;">
          <i class="fa-solid fa-store"></i> Store Pickup
        </button>
      </div>
      <input id="coName" class="co-input" type="text" placeholder="Your name *" value="${escHtml(savedName)}" />
      <div id="coAddressWrap" style="display:block;">
        <textarea id="coAddress" class="co-input" rows="2" placeholder="Delivery address in Mau *" style="resize:none;">${escHtml(savedAddress)}</textarea>
      </div>
      <button id="waOrderBtn" class="btn btn-wa btn-full">
        <i class="fa-brands fa-whatsapp"></i> Send Order via WhatsApp
      </button>`;

    let deliveryMode = 'delivery';

    const btnDelivery   = footer.querySelector('#btnDelivery');
    const btnPickup     = footer.querySelector('#btnPickup');
    const coAddressWrap = footer.querySelector('#coAddressWrap');
    const coName        = footer.querySelector('#coName');
    const coAddress     = footer.querySelector('#coAddress');

    const setMode = (mode) => {
      deliveryMode = mode;
      btnDelivery.className = mode === 'delivery' ? 'btn btn-primary' : 'btn btn-outline';
      btnDelivery.style.cssText = 'flex:1;justify-content:center;font-size:.82rem;padding:9px 0;';
      btnPickup.className   = mode === 'pickup'   ? 'btn btn-primary' : 'btn btn-outline';
      btnPickup.style.cssText   = 'flex:1;justify-content:center;font-size:.82rem;padding:9px 0;';
      coAddressWrap.style.display = mode === 'delivery' ? 'block' : 'none';
    };

    btnDelivery.addEventListener('click', () => setMode('delivery'));
    btnPickup.addEventListener('click',   () => setMode('pickup'));

    coName.addEventListener('blur',    () => localStorage.setItem('mm_cust_name',    coName.value.trim()));
    coAddress.addEventListener('blur', () => localStorage.setItem('mm_cust_address', coAddress.value.trim()));

    footer.querySelector('#waOrderBtn').addEventListener('click', () => {
      const name    = coName.value.trim();
      const address = coAddress ? coAddress.value.trim() : '';

      coName.classList.remove('error');
      if (coAddress) coAddress.classList.remove('error');

      if (!name) { coName.classList.add('error'); coName.focus(); return; }
      if (deliveryMode === 'delivery' && !address) { coAddress.classList.add('error'); coAddress.focus(); return; }

      localStorage.setItem('mm_cust_name', name);
      if (deliveryMode === 'delivery') localStorage.setItem('mm_cust_address', address);

      const lines = cart.map(i =>
        `• ${i.title}${i.packSize ? ' (' + i.packSize + ')' : ''}\n  ID: ${i.id} | Qty: ${i.qty}${i.price > 0 ? ` | ₹${i.price} × ${i.qty} = ₹${i.price * i.qty}` : ''}`
      ).join('\n');
      const orderType = deliveryMode === 'delivery' ? 'Home Delivery 🚚' : 'Store Pickup 🏪';
      const addrLine  = deliveryMode === 'delivery' ? `\nAddress: ${address}` : '';
      const minNote   = (deliveryMode === 'delivery' && sum < minOrd) ? `\n_(Note: Order is under ₹${minOrd} free-delivery threshold)_` : '';
      const msg = `🛒 *Maya Mart Order*\n\nOrder Type: ${orderType}\nName: ${name}${addrLine}\n\n*My Order:*\n${lines}\n\n${sum > 0 ? `*Estimated Total: ₹${sum}*` : 'Please confirm prices.'}${minNote}`;

      window.open(`https://wa.me/${CONFIG.WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }
}

// ============================================================
// WISHLIST PANEL RENDER
// ============================================================
function renderWishPanel() {
  const list = document.getElementById('wishlistItems');
  if (!list) return;

  if (!wishlist.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
      <div style="font-size:2.2rem;margin-bottom:10px;">🤍</div>
      <div style="font-weight:800;font-size:.95rem;margin-bottom:4px">Your wishlist is empty</div>
      <div style="font-size:.82rem">Tap ♡ on any product to save it</div>
    </div>`;
    return;
  }

  list.innerHTML = wishlist.map(item => `
    <div class="wish-item" data-id="${escHtml(item.id)}">
      <img class="wish-item-img" src="${escHtml(item.image)}" alt="${escHtml(item.title)}"
           data-cat="${escHtml(item.category || 'DEFAULT')}" data-pid="${escHtml(item.id)}"
           onerror="this.src=getCatFallbackSvg(this.dataset.cat,this.dataset.pid);this.onerror=null" />
      <div class="wish-item-info">
        <div class="wish-item-name">${escHtml(item.title)}</div>
        <div class="wish-item-price">${item.price > 0 ? '₹' + item.price : '—'}</div>
      </div>
      <div class="wish-item-actions">
        <button class="wish-add-btn" data-id="${escHtml(item.id)}" aria-label="Add to cart" title="Add to cart">
          <i class="fa-solid fa-cart-plus"></i>
        </button>
        <button class="wish-remove" data-id="${escHtml(item.id)}" aria-label="Remove from wishlist">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.wish-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = allProducts.find(x => x.id === btn.dataset.id);
      if (p && p.inStock) {
        addToCart(p);
        refreshCardFooter(p.id);
        showToast(`✓ ${p.title} added to cart`);
      } else if (p) {
        showToast('Item is currently out of stock');
      }
    });
  });

  list.querySelectorAll('.wish-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = allProducts.find(x => x.id === btn.dataset.id);
      if (p) { toggleWishlist(p); refreshCardFooter(p.id); }
      renderWishPanel();
    });
  });
}

// ============================================================
// UTILITY
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
