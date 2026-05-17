// ============================================================
// YOKOOL ↔ ADMIN API integration (v3)
// ------------------------------------------------------------
// Đặt file này cùng cấp với script.js. Thêm vào MỌI trang yokool.vn
// ngay sau <script src="script.js"></script>:
//
//   <script src="yokool-api.js"></script>
//
// Tính năng:
//   1. Tự động gửi đơn hàng từ checkout → admin API
//   2. Cung cấp window.YokoolAPI.fetchProducts/Articles/Banners/Config
//   3. Tự động fill nội dung động (contact, footer, banner, products,
//      articles) qua data-yokool-* attribute
// ============================================================

(function () {
  'use strict';

  // 👉 SỬA URL NÀY khi có custom domain admin.yokool.vn
  const API_BASE = 'https://yokool-admin.pages.dev';

  // Cache 5 phút trong localStorage để giảm fetch
  const CACHE_TTL = 5 * 60 * 1000;

  // ============================================================
  // 1. POST helpers
  // ============================================================

  async function submitOrder(order) {
    const c = order.customer || order;
    const payload = {
      customer_name: (c.fullname || c.fullName || c.name || '').trim(),
      customer_phone: String(c.phone || '').replace(/\s+/g, ''),
      customer_email: (c.email || '').trim(),
      shipping_address: (c.address || '').trim(),
      shipping_ward: c.ward || '',
      shipping_district: c.district || '',
      shipping_province: (c.city || c.province || '').trim(),
      customer_note: c.note || order.note || '',
      payment_method: order.paymentMethod || order.payment_method || 'COD',
      shipping_fee: parseInt(order.shipping_fee || order.shippingFee || 0, 10) || 0,
      items: (order.items || []).map(it => ({
        product_code: String(it.id || it.code || '').toUpperCase(),
        product_name: it.name || '',
        quantity: parseInt(it.qty || it.quantity || 1, 10) || 1,
        unit_price: parseInt(it.price || it.unit_price || 0, 10) || 0,
      })),
    };
    console.log('[YokoolAPI] POST /api/orders payload:', payload);
    const res = await fetch(API_BASE + '/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Lỗi gửi đơn (HTTP ' + res.status + ')'));
    return data;
  }

  async function submitInquiry(inquiry) {
    const payload = {
      company: inquiry.company || '',
      contact_name: inquiry.contact_name || inquiry.contactName || inquiry.name || '',
      position: inquiry.position || '',
      email: inquiry.email || '',
      phone: String(inquiry.phone || '').replace(/\s+/g, ''),
      products: Array.isArray(inquiry.products) ? inquiry.products : [],
      quantity: inquiry.quantity || '',
      deadline: inquiry.deadline || '',
      purpose: inquiry.purpose || '',
      customer_note: inquiry.customer_note || inquiry.note || '',
    };
    const res = await fetch(API_BASE + '/api/inquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Lỗi gửi inquiry');
    return data;
  }

  // ============================================================
  // 2. GET helpers (cache 5 phút)
  // ============================================================

  function cacheKey(path) { return 'yokool_cache_' + path; }

  async function fetchWithCache(path) {
    const key = cacheKey(path);
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && (Date.now() - cached.t) < CACHE_TTL) {
        return cached.data;
      }
    } catch {}
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    try {
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
    } catch {}
    return data;
  }

  async function fetchProducts(category) {
    const path = '/api/products' + (category ? '?category=' + encodeURIComponent(category) : '');
    const data = await fetchWithCache(path);
    return data.products || [];
  }

  async function fetchProduct(idOrSlug) {
    const data = await fetchWithCache('/api/products/' + encodeURIComponent(idOrSlug));
    return data.product;
  }

  async function fetchArticles(limit) {
    const data = await fetchWithCache('/api/articles?limit=' + (limit || 20));
    return data.articles || [];
  }

  async function fetchArticle(slug) {
    const data = await fetchWithCache('/api/articles/' + encodeURIComponent(slug));
    return data.article;
  }

  async function fetchBanners() {
    const data = await fetchWithCache('/api/banners');
    return data.banners || [];
  }

  async function fetchConfig() {
    const data = await fetchWithCache('/api/config');
    return data.config || {};
  }

  function clearCache() {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('yokool_cache_')) localStorage.removeItem(k);
      });
    } catch {}
  }

  window.YokoolAPI = {
    submitOrder, submitInquiry,
    fetchProducts, fetchProduct,
    fetchArticles, fetchArticle,
    fetchBanners, fetchConfig,
    clearCache,
    API_BASE,
  };

  // ============================================================
  // 3. Auto-hook YokoolCart.saveOrder
  // ============================================================

  let hooked = false;
  function hookSaveOrder() {
    if (hooked) return;
    if (!window.YokoolCart || typeof window.YokoolCart.saveOrder !== 'function') return;
    const original = window.YokoolCart.saveOrder.bind(window.YokoolCart);
    window.YokoolCart.saveOrder = function (order) {
      const localResult = original(order);
      submitOrder(order)
        .then(r => {
          console.log('[YokoolAPI] ✓ Order saved:', r.order_id);
          if (window.yokoolToast) setTimeout(() => window.yokoolToast('Đơn đã ghi nhận: ' + r.order_id, 'success'), 500);
        })
        .catch(err => console.error('[YokoolAPI] ✗ Order failed:', err.message));
      return localResult;
    };
    hooked = true;
    console.log('[YokoolAPI] ✓ Hooked YokoolCart.saveOrder');
  }
  hookSaveOrder();
  let tries = 0;
  const intv = setInterval(() => {
    hookSaveOrder();
    if (hooked || ++tries >= 50) clearInterval(intv);
  }, 100);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookSaveOrder);
  }

  // ============================================================
  // 4. Auto-populate dynamic content
  // ------------------------------------------------------------
  // <span data-yokool-config="hotline">+84...</span>
  // <a data-yokool-config="zalo_link" href="#">...</a>     → set href
  // <div data-yokool-banner="home_1"></div>                → render banner
  // <div data-yokool-products data-yokool-limit="4"></div> → render grid
  // <div data-yokool-articles data-yokool-limit="3"></div> → render list
  // ============================================================

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function applyConfig(config) {
    document.querySelectorAll('[data-yokool-config]').forEach(el => {
      const key = el.dataset.yokoolConfig;
      const value = config[key] || '';
      if (!value) return;
      if (el.tagName === 'A')      el.href = value;
      else if (el.tagName === 'IMG') el.src = value;
      else if (el.tagName === 'INPUT') el.value = value;
      else el.textContent = value;
    });
  }

  function applyBanners(banners) {
    document.querySelectorAll('[data-yokool-banner]').forEach(el => {
      const slot = el.dataset.yokoolBanner;
      const b = banners.find(x => x.slot === slot);
      if (!b || !b.enabled) return;
      el.innerHTML = `
        ${b.image_url ? `<img src="${escapeHtml(b.image_url)}" alt="" class="slide-bg" aria-hidden="true">` : ''}
        <div class="slide-content">
          ${b.eyebrow ? `<span class="slide-eyebrow">${escapeHtml(b.eyebrow)}</span>` : ''}
          <h2 class="slide-title">${escapeHtml(b.title_line1 || '')}<br>${escapeHtml(b.title_line2 || '')}</h2>
          ${b.tagline ? `<p class="slide-tagline">${escapeHtml(b.tagline)}</p>` : ''}
          ${b.cta_text ? `<a href="${escapeHtml(b.cta_link || '#')}" class="cta-button slide-cta">${escapeHtml(b.cta_text)} <span class="cta-arrow">→</span></a>` : ''}
        </div>`;
    });
  }

  function applyProducts(products) {
    document.querySelectorAll('[data-yokool-products]').forEach(el => {
      const limit = parseInt(el.dataset.yokoolLimit || '0', 10);
      const list = limit > 0 ? products.slice(0, limit) : products;
      el.innerHTML = list.map(p => `
        <a href="products/${escapeHtml(p.slug)}.html" class="product-card">
          ${p.image_main ? `<img src="${escapeHtml(p.image_main)}" alt="${escapeHtml(p.name)}" class="product-card-image">` : ''}
          <div class="product-card-body">
            <span class="product-card-code">${escapeHtml(p.code)}</span>
            <h3 class="product-card-name">${escapeHtml(p.name)}</h3>
            ${p.description_short ? `<p class="product-card-desc">${escapeHtml(p.description_short)}</p>` : ''}
            <div class="product-card-price">
              <strong>${p.price.toLocaleString('vi-VN')}đ</strong>
              ${p.price_old ? `<span class="product-card-price-old">${p.price_old.toLocaleString('vi-VN')}đ</span>` : ''}
            </div>
          </div>
        </a>
      `).join('');
    });
  }

  function applyArticles(articles) {
    document.querySelectorAll('[data-yokool-articles]').forEach(el => {
      const limit = parseInt(el.dataset.yokoolLimit || '0', 10);
      const list = limit > 0 ? articles.slice(0, limit) : articles;
      el.innerHTML = list.map(a => `
        <a href="news/${escapeHtml(a.slug)}.html" class="article-card">
          ${a.thumbnail ? `<img src="${escapeHtml(a.thumbnail)}" alt="" class="article-card-thumb">` : ''}
          <div class="article-card-body">
            <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
            ${a.excerpt ? `<p class="article-card-excerpt">${escapeHtml(a.excerpt)}</p>` : ''}
            ${a.published_at ? `<span class="article-card-date">${a.published_at.slice(0, 10)}</span>` : ''}
          </div>
        </a>
      `).join('');
    });
  }

  async function autoPopulate() {
    const tasks = [];
    if (document.querySelector('[data-yokool-config]')) {
      tasks.push(fetchConfig().then(applyConfig).catch(e => console.warn('Config fetch failed:', e)));
    }
    if (document.querySelector('[data-yokool-banner]')) {
      tasks.push(fetchBanners().then(applyBanners).catch(e => console.warn('Banners fetch failed:', e)));
    }
    if (document.querySelector('[data-yokool-products]')) {
      tasks.push(fetchProducts().then(applyProducts).catch(e => console.warn('Products fetch failed:', e)));
    }
    if (document.querySelector('[data-yokool-articles]')) {
      tasks.push(fetchArticles().then(applyArticles).catch(e => console.warn('Articles fetch failed:', e)));
    }
    await Promise.all(tasks);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoPopulate);
  } else {
    autoPopulate();
  }
})();
