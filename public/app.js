// ============================================================
// YOKOOL ADMIN — Single-Page App
// ============================================================

(function () {
  'use strict';

  // ---------- Helpers ----------

  const $ = (sel, root = document) => root.querySelector(sel);

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatVND(n) {
    if (typeof n !== 'number') n = parseInt(n, 10) || 0;
    return n.toLocaleString('vi-VN');
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return iso;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} giờ trước`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} ngày trước`;
    return formatDate(iso);
  }

  function toast(msg, type = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast is-visible' + (type ? ' is-' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.className = 'toast', 3000);
  }

  // ---------- API client ----------

  async function api(path, options = {}) {
    const res = await fetch('/api' + path, {
      credentials: 'include',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
    if (res.status === 401) {
      window.location.replace('/login.html');
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      let msg = 'Lỗi máy chủ';
      try { const j = await res.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  // ---------- Status labels ----------

  const ORDER_STATUSES = {
    new:        { label: 'Mới',        order: 1 },
    processing: { label: 'Đang xử lý', order: 2 },
    shipping:   { label: 'Đang giao',  order: 3 },
    delivered:  { label: 'Đã giao',    order: 4 },
    cancelled:  { label: 'Huỷ',        order: 5 },
  };

  const B2B_STATUSES = {
    new:       { label: 'Chưa liên hệ', order: 1 },
    contacted: { label: 'Đã liên hệ',   order: 2 },
    quoted:    { label: 'Đã báo giá',   order: 3 },
    deal:      { label: 'Đã chốt deal', order: 4 },
    lost:      { label: 'Đã mất',       order: 5 },
  };

  function badge(status, dict) {
    const info = dict[status] || { label: status };
    return `<span class="badge" data-status="${esc(status)}">${esc(info.label)}</span>`;
  }

  // ---------- Router ----------

  const routes = [
    { match: /^\/?$/,                       render: pageDashboard,     title: 'Tổng quan',     nav: 'dashboard' },
    { match: /^\/dashboard$/,               render: pageDashboard,     title: 'Tổng quan',     nav: 'dashboard' },
    { match: /^\/orders$/,                  render: pageOrdersList,    title: 'Đơn hàng B2C',  nav: 'orders' },
    { match: /^\/orders\/([^/]+)$/,         render: pageOrderDetail,   title: 'Chi tiết đơn',  nav: 'orders' },
    { match: /^\/inquiries$/,               render: pageInquiriesList, title: 'Yêu cầu B2B',   nav: 'inquiries' },
    { match: /^\/inquiries\/([^/]+)$/,      render: pageInquiryDetail, title: 'Chi tiết B2B',  nav: 'inquiries' },
    // Phase 2A — Content management
    { match: /^\/products$/,                render: pageProductsList,  title: 'Sản phẩm',      nav: 'products' },
    { match: /^\/products\/new$/,           render: pageProductNew,    title: 'Thêm sản phẩm', nav: 'products' },
    { match: /^\/products\/([^/]+)$/,       render: pageProductEdit,   title: 'Sửa sản phẩm',  nav: 'products' },
    { match: /^\/articles$/,                render: pageArticlesList,  title: 'Tin tức',       nav: 'articles' },
    { match: /^\/articles\/new$/,           render: pageArticleNew,    title: 'Viết bài mới',  nav: 'articles' },
    { match: /^\/articles\/([^/]+)$/,       render: pageArticleEdit,   title: 'Sửa bài viết',  nav: 'articles' },
    { match: /^\/banners$/,                 render: pageBanners,       title: 'Banner hero',   nav: 'banners' },
    { match: /^\/config$/,                  render: pageConfig,        title: 'Cấu hình site', nav: 'config' },
  ];

  function getPath() {
    const h = window.location.hash || '';
    const raw = h.startsWith('#') ? h.slice(1) : h;
    return raw.split('?')[0];
  }

  function getParams() {
    const h = window.location.hash || '';
    const raw = h.startsWith('#') ? h.slice(1) : h;
    return new URLSearchParams(raw.split('?')[1] || '');
  }

  async function navigate() {
    const path = getPath();
    const main = $('#main');

    for (const route of routes) {
      const m = path.match(route.match);
      if (m) {
        $('#topbarTitle').textContent = route.title;
        document.querySelectorAll('.sidebar-link').forEach(el => {
          el.classList.toggle('is-active', el.dataset.route === route.nav);
        });
        main.innerHTML = '<div class="loading">Đang tải</div>';
        try {
          await route.render(main, ...m.slice(1));
        } catch (err) {
          main.innerHTML = `<div class="empty"><span class="empty-icon">!</span>${esc(err.message || 'Lỗi tải trang')}</div>`;
        }
        return;
      }
    }
    main.innerHTML = '<div class="empty"><span class="empty-icon">?</span>Không tìm thấy trang</div>';
  }

  window.addEventListener('hashchange', navigate);

  // ---------- Page: Dashboard ----------

  async function pageDashboard(main) {
    const data = await api('/dashboard');
    const s = data.stats;

    main.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-eyebrow">/ DASHBOARD</div>
          <h1 class="page-title">Tổng quan.</h1>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Đơn mới hôm nay</div>
          <div class="stat-value">${s.orders_today}</div>
          <div class="stat-value-sub">${s.orders_new} đơn đang chờ xử lý</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Đơn đang xử lý</div>
          <div class="stat-value">${s.orders_open}</div>
          <div class="stat-value-sub">Bao gồm mới · đang xử lý · đang giao</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Doanh thu 7 ngày</div>
          <div class="stat-value">${formatVND(s.revenue_week)}<span class="stat-value-currency">đ</span></div>
          <div class="stat-value-sub">Đã giao 30 ngày: ${formatVND(s.revenue_month_delivered)}đ</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">B2B chờ phản hồi</div>
          <div class="stat-value">${s.b2b_new}</div>
          <div class="stat-value-sub">${s.b2b_open} yêu cầu đang theo dõi</div>
        </div>
      </div>

      <div class="two-col-recent">
        <div class="recent-card">
          <div class="recent-card-header">
            <div class="recent-card-title">Đơn mới nhất</div>
            <a href="#/orders" class="recent-card-link">XEM TẤT CẢ →</a>
          </div>
          ${data.recent_orders.length === 0
            ? `<div class="empty"><span class="empty-icon">▤</span>Chưa có đơn hàng nào</div>`
            : data.recent_orders.map(o => `
              <div class="recent-row" data-href="#/orders/${esc(o.id)}">
                <div>
                  <div class="cell-id">${esc(o.id)}</div>
                  <div class="cell-muted">${esc(o.customer_name)} · ${relTime(o.created_at)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="cell-money">${formatVND(o.total)}đ</div>
                  ${badge(o.status, ORDER_STATUSES)}
                </div>
              </div>
            `).join('')}
        </div>

        <div class="recent-card">
          <div class="recent-card-header">
            <div class="recent-card-title">Yêu cầu B2B mới nhất</div>
            <a href="#/inquiries" class="recent-card-link">XEM TẤT CẢ →</a>
          </div>
          ${data.recent_inquiries.length === 0
            ? `<div class="empty"><span class="empty-icon">◆</span>Chưa có yêu cầu B2B nào</div>`
            : data.recent_inquiries.map(i => `
              <div class="recent-row" data-href="#/inquiries/${esc(i.id)}">
                <div>
                  <div class="cell-id">${esc(i.id)}</div>
                  <div class="cell-muted">${esc(i.company)} · ${esc(i.contact_name)} · ${relTime(i.created_at)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="cell-muted" style="font-family:var(--font-mono); font-size:11px;">${esc(i.quantity || '—')}</div>
                  ${badge(i.status, B2B_STATUSES)}
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    bindRowLinks(main);
  }

  // ---------- Page: Orders list ----------

  async function pageOrdersList(main) {
    const sp = getParams();
    const status = sp.get('status') || '';
    const search = sp.get('search') || '';
    const page = parseInt(sp.get('page'), 10) || 1;

    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search) query.set('search', search);
    query.set('page', page);

    const data = await api('/orders?' + query.toString());
    const orders = data.orders;
    const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-eyebrow">/ ĐƠN HÀNG B2C</div>
          <h1 class="page-title">Đơn hàng.</h1>
          <p class="page-description">Tổng cộng ${data.total} đơn. Click vào đơn để xem chi tiết và cập nhật trạng thái.</p>
        </div>
        <button class="toolbar-action is-brand" id="exportBtn">Xuất CSV cho shipper</button>
      </div>

      <div class="toolbar">
        ${['', 'new', 'processing', 'shipping', 'delivered', 'cancelled'].map(s => `
          <button class="filter-chip ${status === s ? 'is-active' : ''}" data-filter-status="${esc(s)}">
            ${s === '' ? 'Tất cả' : ORDER_STATUSES[s].label}
          </button>
        `).join('')}
        <input type="text" class="toolbar-search" id="searchInput"
               placeholder="Tìm theo mã đơn / tên / SĐT..." value="${esc(search)}">
      </div>

      <div class="table-wrap">
        ${orders.length === 0 ? `
          <div class="empty"><span class="empty-icon">▤</span>Không có đơn nào</div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>SĐT</th>
                <th>Tỉnh</th>
                <th style="text-align:right">Tổng</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr data-href="#/orders/${esc(o.id)}">
                  <td class="cell-id">${esc(o.id)}</td>
                  <td class="cell-strong">${esc(o.customer_name)}</td>
                  <td class="cell-muted" style="font-family:var(--font-mono);">${esc(o.customer_phone)}</td>
                  <td class="cell-muted">${esc(o.shipping_province)}</td>
                  <td class="cell-money">${formatVND(o.total)}đ</td>
                  <td>${badge(o.status, ORDER_STATUSES)}</td>
                  <td class="cell-date">${relTime(o.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${totalPages > 1 ? paginationHTML(page, totalPages) : ''}
        `}
      </div>
    `;

    bindRowLinks(main);
    bindFilterChips(main, 'orders', status, search, page);

    $('#searchInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = new URLSearchParams();
        if (status) q.set('status', status);
        if (e.target.value.trim()) q.set('search', e.target.value.trim());
        const newUrl = '#/orders' + (q.toString() ? '?' + q.toString() : '');
        if (newUrl === window.location.hash) navigate();
        else window.location.hash = newUrl;
      }
    });

    $('#exportBtn')?.addEventListener('click', () => {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      window.open('/api/orders/export?' + q.toString(), '_blank');
    });
  }

  // ---------- Page: Order detail ----------

  async function pageOrderDetail(main, id) {
    const data = await api('/orders/' + encodeURIComponent(id));
    const o = data.order;
    const items = data.items;

    main.innerHTML = `
      <a href="#/orders" class="back-link">← QUAY LẠI DANH SÁCH</a>

      <div class="page-header">
        <div>
          <div class="page-eyebrow">/ ${esc(o.id)}</div>
          <h1 class="page-title">${esc(o.customer_name)}.</h1>
          <p class="page-description">
            Tạo lúc ${formatDate(o.created_at)} · Cập nhật ${relTime(o.updated_at)}
          </p>
        </div>
      </div>

      <div class="detail-grid">
        <div>
          <div class="panel">
            <div class="panel-eyebrow">/ Thông tin khách</div>
            <div class="kv-grid">
              <div class="kv-key">Họ tên</div>      <div class="kv-val">${esc(o.customer_name)}</div>
              <div class="kv-key">SĐT</div>         <div class="kv-val" style="font-family:var(--font-mono)">${esc(o.customer_phone)}</div>
              <div class="kv-key">Email</div>       <div class="kv-val ${o.customer_email ? '' : 'is-muted'}">${esc(o.customer_email) || 'không có'}</div>
              <div class="kv-key">Địa chỉ</div>     <div class="kv-val">${esc(o.shipping_address)}</div>
              <div class="kv-key">Phường/Xã</div>   <div class="kv-val ${o.shipping_ward ? '' : 'is-muted'}">${esc(o.shipping_ward) || '—'}</div>
              <div class="kv-key">Quận/Huyện</div>  <div class="kv-val ${o.shipping_district ? '' : 'is-muted'}">${esc(o.shipping_district) || '—'}</div>
              <div class="kv-key">Tỉnh/Thành</div>  <div class="kv-val">${esc(o.shipping_province)}</div>
              ${o.customer_note ? `
                <div class="kv-key">Ghi chú KH</div>
                <div class="kv-val">${esc(o.customer_note)}</div>
              ` : ''}
            </div>
          </div>

          <div class="panel">
            <div class="panel-eyebrow">/ Sản phẩm (${items.length})</div>
            <table class="items-table">
              <thead>
                <tr><th>Mã</th><th>Sản phẩm</th><th class="is-num">SL</th><th class="is-num">Đơn giá</th><th class="is-num">Thành tiền</th></tr>
              </thead>
              <tbody>
                ${items.map(it => `
                  <tr>
                    <td style="font-family:var(--font-mono); font-weight:600; color:var(--brand);">${esc(it.product_code)}</td>
                    <td>${esc(it.product_name)}</td>
                    <td class="is-num">${it.quantity}</td>
                    <td class="is-num">${formatVND(it.unit_price)}đ</td>
                    <td class="is-num"><strong>${formatVND(it.subtotal)}đ</strong></td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align:right">Tạm tính</td>
                  <td class="is-num">${formatVND(o.subtotal)}đ</td>
                </tr>
                <tr>
                  <td colspan="4" style="text-align:right; border-top:none; padding-top:4px;">
                    Phí vận chuyển
                  </td>
                  <td class="is-num" style="border-top:none; padding-top:4px;">${formatVND(o.shipping_fee)}đ</td>
                </tr>
                <tr>
                  <td colspan="4" style="text-align:right; border-top:none; padding-top:4px;">Thanh toán</td>
                  <td class="is-num" style="border-top:none; padding-top:4px; color:var(--brand); font-size:16px;">
                    <strong>${formatVND(o.total)}đ</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
            <div style="margin-top: 12px; font-size: 12px; color: var(--text-tertiary);">
              Phương thức: <strong style="color:var(--text-primary)">${esc(o.payment_method)}</strong>
            </div>
          </div>
        </div>

        <aside>
          <div class="panel">
            <div class="panel-eyebrow">/ Cập nhật trạng thái</div>

            <div class="field">
              <label class="field-label" for="orderStatus">Trạng thái</label>
              <select class="field-select" id="orderStatus">
                ${Object.entries(ORDER_STATUSES).map(([k, v]) => `
                  <option value="${k}" ${o.status === k ? 'selected' : ''}>${v.label}</option>
                `).join('')}
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="shippingFee">Phí vận chuyển (đ)</label>
              <input type="number" class="field-input" id="shippingFee" value="${o.shipping_fee}" min="0" step="1000">
            </div>

            <div class="field">
              <label class="field-label" for="internalNote">Ghi chú nội bộ</label>
              <textarea class="field-textarea" id="internalNote" rows="5"
                placeholder="VD: Khách yêu cầu gọi trước khi giao...">${esc(o.internal_note || '')}</textarea>
            </div>

            <button class="btn is-brand" id="saveOrderBtn" style="width: 100%;">Lưu thay đổi</button>
          </div>
        </aside>
      </div>
    `;

    $('#saveOrderBtn').addEventListener('click', async () => {
      const btn = $('#saveOrderBtn');
      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
      try {
        const body = {
          status: $('#orderStatus').value,
          internal_note: $('#internalNote').value,
          shipping_fee: parseInt($('#shippingFee').value, 10) || 0,
        };
        await api('/orders/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast('Đã lưu', 'success');
        navigate();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Lưu thay đổi';
      }
    });
  }

  // ---------- Page: Inquiries list ----------

  async function pageInquiriesList(main) {
    const sp = getParams();
    const status = sp.get('status') || '';
    const search = sp.get('search') || '';
    const page = parseInt(sp.get('page'), 10) || 1;

    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search) query.set('search', search);
    query.set('page', page);

    const data = await api('/inquiries?' + query.toString());
    const inquiries = data.inquiries;
    const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

    main.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-eyebrow">/ YÊU CẦU B2B</div>
          <h1 class="page-title">Doanh nghiệp.</h1>
          <p class="page-description">Tổng cộng ${data.total} yêu cầu. Click vào để xem chi tiết và đánh dấu trạng thái.</p>
        </div>
      </div>

      <div class="toolbar">
        ${['', 'new', 'contacted', 'quoted', 'deal', 'lost'].map(s => `
          <button class="filter-chip ${status === s ? 'is-active' : ''}" data-filter-status="${esc(s)}">
            ${s === '' ? 'Tất cả' : B2B_STATUSES[s].label}
          </button>
        `).join('')}
        <input type="text" class="toolbar-search" id="searchInput"
               placeholder="Tìm theo công ty / người liên hệ / SĐT..." value="${esc(search)}">
      </div>

      <div class="table-wrap">
        ${inquiries.length === 0 ? `
          <div class="empty"><span class="empty-icon">◆</span>Không có yêu cầu nào</div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Công ty</th>
                <th>Người liên hệ</th>
                <th>SĐT</th>
                <th>Số lượng</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              ${inquiries.map(i => `
                <tr data-href="#/inquiries/${esc(i.id)}">
                  <td class="cell-id">${esc(i.id)}</td>
                  <td class="cell-strong">${esc(i.company)}</td>
                  <td>${esc(i.contact_name)}</td>
                  <td class="cell-muted" style="font-family:var(--font-mono);">${esc(i.phone)}</td>
                  <td class="cell-muted" style="font-family:var(--font-mono); font-size:11px;">${esc(i.quantity || '—')}</td>
                  <td>${badge(i.status, B2B_STATUSES)}</td>
                  <td class="cell-date">${relTime(i.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${totalPages > 1 ? paginationHTML(page, totalPages) : ''}
        `}
      </div>
    `;

    bindRowLinks(main);
    bindFilterChips(main, 'inquiries', status, search, page);

    $('#searchInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = new URLSearchParams();
        if (status) q.set('status', status);
        if (e.target.value.trim()) q.set('search', e.target.value.trim());
        const newUrl = '#/inquiries' + (q.toString() ? '?' + q.toString() : '');
        if (newUrl === window.location.hash) navigate();
        else window.location.hash = newUrl;
      }
    });
  }

  // ---------- Page: Inquiry detail ----------

  async function pageInquiryDetail(main, id) {
    const data = await api('/inquiries/' + encodeURIComponent(id));
    const i = data.inquiry;
    const products = Array.isArray(i.products) ? i.products : [];

    main.innerHTML = `
      <a href="#/inquiries" class="back-link">← QUAY LẠI DANH SÁCH</a>

      <div class="page-header">
        <div>
          <div class="page-eyebrow">/ ${esc(i.id)}</div>
          <h1 class="page-title">${esc(i.company)}.</h1>
          <p class="page-description">
            ${esc(i.contact_name)}${i.position ? ' · ' + esc(i.position) : ''} ·
            Tạo lúc ${formatDate(i.created_at)} · Cập nhật ${relTime(i.updated_at)}
          </p>
        </div>
      </div>

      <div class="detail-grid">
        <div>
          <div class="panel">
            <div class="panel-eyebrow">/ Thông tin liên hệ</div>
            <div class="kv-grid">
              <div class="kv-key">Công ty</div>      <div class="kv-val cell-strong">${esc(i.company)}</div>
              <div class="kv-key">Người liên hệ</div><div class="kv-val">${esc(i.contact_name)}</div>
              <div class="kv-key">Chức vụ</div>      <div class="kv-val ${i.position ? '' : 'is-muted'}">${esc(i.position) || 'không có'}</div>
              <div class="kv-key">Email</div>        <div class="kv-val" style="font-family:var(--font-mono)"><a href="mailto:${esc(i.email)}">${esc(i.email)}</a></div>
              <div class="kv-key">SĐT</div>          <div class="kv-val" style="font-family:var(--font-mono)"><a href="tel:${esc(i.phone)}">${esc(i.phone)}</a></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-eyebrow">/ Nội dung yêu cầu</div>
            <div class="kv-grid">
              <div class="kv-key">Sản phẩm</div>
              <div class="kv-val">
                ${products.length === 0
                  ? '<span class="is-muted">Chưa chọn cụ thể</span>'
                  : products.map(p => `<code style="background:var(--brand-soft); color:var(--brand); padding:2px 8px; font-family:var(--font-mono); font-weight:600; margin-right:6px;">${esc(p)}</code>`).join('')}
              </div>
              <div class="kv-key">Số lượng</div>
              <div class="kv-val" style="font-family:var(--font-mono); font-weight:600;">${esc(i.quantity || '—')}</div>
              <div class="kv-key">Hạn cần</div>
              <div class="kv-val ${i.deadline ? '' : 'is-muted'}">${esc(i.deadline) || 'không nêu'}</div>
              <div class="kv-key">Mục đích</div>
              <div class="kv-val ${i.purpose ? '' : 'is-muted'}">${esc(i.purpose) || 'không nêu'}</div>
              ${i.customer_note ? `
                <div class="kv-key">Ghi chú KH</div>
                <div class="kv-val">${esc(i.customer_note)}</div>
              ` : ''}
            </div>
          </div>
        </div>

        <aside>
          <div class="panel">
            <div class="panel-eyebrow">/ Theo dõi & ghi chú</div>

            <div class="field">
              <label class="field-label" for="inquiryStatus">Trạng thái</label>
              <select class="field-select" id="inquiryStatus">
                ${Object.entries(B2B_STATUSES).map(([k, v]) => `
                  <option value="${k}" ${i.status === k ? 'selected' : ''}>${v.label}</option>
                `).join('')}
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="inquiryNote">Ghi chú nội bộ</label>
              <textarea class="field-textarea" id="inquiryNote" rows="8"
                placeholder="VD: Gọi lúc 10h ngày 17/5, KH muốn xem mockup logo trước...">${esc(i.internal_note || '')}</textarea>
            </div>

            <div style="display:flex; gap:8px;">
              <a class="btn is-ghost" href="mailto:${esc(i.email)}" style="flex:1; text-align:center;">Email KH</a>
              <a class="btn is-ghost" href="tel:${esc(i.phone)}" style="flex:1; text-align:center;">Gọi KH</a>
            </div>

            <button class="btn is-brand" id="saveInquiryBtn" style="width: 100%; margin-top: 12px;">Lưu thay đổi</button>
          </div>
        </aside>
      </div>
    `;

    $('#saveInquiryBtn').addEventListener('click', async () => {
      const btn = $('#saveInquiryBtn');
      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
      try {
        await api('/inquiries/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: JSON.stringify({
            status: $('#inquiryStatus').value,
            internal_note: $('#inquiryNote').value,
          }),
        });
        toast('Đã lưu', 'success');
        navigate();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Lưu thay đổi';
      }
    });
  }

  // ---------- Helpers used across pages ----------

  function paginationHTML(page, totalPages) {
    const btns = [];
    btns.push(`<button class="page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`);
    for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
      btns.push(`<button class="page-btn ${p === page ? 'is-current' : ''}" data-page="${p}">${p}</button>`);
    }
    btns.push(`<button class="page-btn" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`);
    return `
      <div class="pagination">
        <div>Trang ${page} / ${totalPages}</div>
        <div class="page-btns">${btns.join('')}</div>
      </div>
    `;
  }

  function bindRowLinks(root) {
    root.querySelectorAll('[data-href]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't hijack actual link clicks
        if (e.target.closest('a, button')) return;
        window.location.hash = el.dataset.href;
      });
    });
    // Pagination buttons
    root.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      if (btn.disabled) return;
      btn.addEventListener('click', () => {
        const p = btn.dataset.page;
        const h = window.location.hash || '';
        const raw = h.startsWith('#') ? h.slice(1) : h;
        const [base, qs] = raw.split('?');
        const params = new URLSearchParams(qs || '');
        params.set('page', p);
        window.location.hash = '#' + base + '?' + params.toString();
      });
    });
  }

  function bindFilterChips(root, basePath, currentStatus, currentSearch, currentPage) {
    root.querySelectorAll('[data-filter-status]').forEach(chip => {
      chip.addEventListener('click', () => {
        const s = chip.dataset.filterStatus;
        const params = new URLSearchParams();
        if (s) params.set('status', s);
        if (currentSearch) params.set('search', currentSearch);
        window.location.hash = '#/' + basePath + (params.toString() ? '?' + params.toString() : '');
      });
    });
  }

  // ============================================================
  // Phase 2A — Content management pages
  // ============================================================

  // ---------- Page: Products list ----------

  async function pageProductsList(main) {
    const data = await api('/products?all=1');
    const products = data.products || [];

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Sản phẩm</h1>
          <p class="page-subtitle">${products.length} sản phẩm</p>
        </div>
        <a href="#/products/new" class="btn btn-primary">+ Thêm sản phẩm</a>
      </div>

      ${products.length === 0 ? `
        <div class="empty"><span class="empty-icon">◇</span>Chưa có sản phẩm nào</div>
      ` : `
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Mã</th>
                <th>Tên</th>
                <th>Giá</th>
                <th>Tồn kho</th>
                <th>Sắp xếp</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td>${p.image_main ? `<img src="${esc(p.image_main)}" alt="" class="product-thumb">` : '<div class="product-thumb product-thumb--empty">—</div>'}</td>
                  <td><code>${esc(p.code)}</code></td>
                  <td>${esc(p.name)}</td>
                  <td>${formatVND(p.price)}đ</td>
                  <td>${p.in_stock ? (p.stock_qty || '∞') : '<span class="text-muted">Hết</span>'}</td>
                  <td>${p.sort_order}</td>
                  <td>${p.published ? '<span class="badge badge-success">Hiện</span>' : '<span class="badge badge-muted">Ẩn</span>'}</td>
                  <td><a href="#/products/${p.id}" class="btn-link">Sửa →</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  }

  // ---------- Page: Product new ----------

  async function pageProductNew(main) {
    renderProductForm(main, null);
  }

  // ---------- Page: Product edit ----------

  async function pageProductEdit(main, id) {
    const data = await api('/products/' + encodeURIComponent(id));
    renderProductForm(main, data.product);
  }

  function renderProductForm(main, p) {
    const isEdit = !!p;
    p = p || {
      code: '', name: '', slug: '', price: 0, price_old: null,
      description_short: '', description_long: '',
      image_main: '', image_gallery: [], category: '',
      in_stock: true, stock_qty: 0, sort_order: 99, published: true,
    };

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isEdit ? 'Sửa sản phẩm: ' + esc(p.name) : 'Thêm sản phẩm mới'}</h1>
          <p class="page-subtitle">${isEdit ? 'ID #' + p.id : 'Sản phẩm mới sẽ xuất hiện trên yokool.vn'}</p>
        </div>
        <a href="#/products" class="btn btn-ghost">← Quay lại</a>
      </div>

      <form id="productForm" class="form-card">
        <div class="form-grid form-grid--2">
          <div class="form-field">
            <label class="form-label">Mã sản phẩm <span class="required">*</span></label>
            <input class="form-input" name="code" value="${esc(p.code)}" placeholder="VD: JP395" required maxlength="20" style="text-transform: uppercase">
            <p class="form-help">Chữ in hoa, không dấu. VD: JP395, SL207</p>
          </div>
          <div class="form-field">
            <label class="form-label">Sắp xếp</label>
            <input class="form-input" name="sort_order" type="number" value="${p.sort_order}">
            <p class="form-help">Số nhỏ hiển thị trước</p>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Tên sản phẩm <span class="required">*</span></label>
          <input class="form-input" name="name" value="${esc(p.name)}" placeholder="VD: Sạc dự phòng JP395 10000mAh" required maxlength="200">
        </div>

        <div class="form-grid form-grid--2">
          <div class="form-field">
            <label class="form-label">Slug URL</label>
            <input class="form-input" name="slug" value="${esc(p.slug)}" placeholder="jp395 (tự tạo nếu bỏ trống)">
            <p class="form-help">URL: yokool.vn/products/[slug].html</p>
          </div>
          <div class="form-field">
            <label class="form-label">Danh mục</label>
            <input class="form-input" name="category" value="${esc(p.category || '')}" placeholder="powerbank, travel, ...">
          </div>
        </div>

        <div class="form-grid form-grid--2">
          <div class="form-field">
            <label class="form-label">Giá bán (VNĐ) <span class="required">*</span></label>
            <input class="form-input" name="price" type="number" value="${p.price}" min="1" required>
          </div>
          <div class="form-field">
            <label class="form-label">Giá gốc (VNĐ)</label>
            <input class="form-input" name="price_old" type="number" value="${p.price_old || ''}" placeholder="Để hiển thị giảm giá">
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Mô tả ngắn (hiện ở list sản phẩm)</label>
          <textarea class="form-input" name="description_short" rows="2" maxlength="500" placeholder="Mô tả 1-2 câu...">${esc(p.description_short || '')}</textarea>
        </div>

        <div class="form-field">
          <label class="form-label">Mô tả chi tiết</label>
          <textarea class="form-input" name="description_long" rows="6" maxlength="5000" placeholder="Mô tả đầy đủ, dùng cho trang product detail">${esc(p.description_long || '')}</textarea>
        </div>

        <div class="form-field">
          <label class="form-label">Ảnh chính</label>
          <div class="image-upload-row">
            <input class="form-input" name="image_main" value="${esc(p.image_main || '')}" placeholder="URL ảnh hoặc upload bên dưới">
            <button type="button" class="btn btn-ghost btn-sm" data-upload-target="image_main" data-folder="products">📤 Upload</button>
          </div>
          ${p.image_main ? `<img src="${esc(p.image_main)}" alt="" class="image-preview" id="preview_main">` : '<div id="preview_main"></div>'}
        </div>

        <div class="form-field">
          <label class="form-label">Gallery ảnh phụ (mỗi dòng 1 URL)</label>
          <textarea class="form-input" name="image_gallery" rows="3" placeholder="https://...">${(p.image_gallery || []).join('\n')}</textarea>
          <button type="button" class="btn btn-ghost btn-sm" data-upload-gallery data-folder="products" style="margin-top: 8px;">📤 Upload thêm ảnh vào gallery</button>
        </div>

        <div class="form-grid form-grid--3">
          <div class="form-field">
            <label class="form-checkbox-row">
              <input type="checkbox" name="in_stock" ${p.in_stock ? 'checked' : ''}>
              <span>Còn hàng</span>
            </label>
          </div>
          <div class="form-field">
            <label class="form-label">Tồn kho</label>
            <input class="form-input" name="stock_qty" type="number" value="${p.stock_qty}" min="0">
          </div>
          <div class="form-field">
            <label class="form-checkbox-row">
              <input type="checkbox" name="published" ${p.published ? 'checked' : ''}>
              <span>Hiển thị trên web</span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          ${isEdit ? '<button type="button" class="btn btn-danger" id="deleteProductBtn">Xoá sản phẩm</button>' : '<span></span>'}
          <button type="submit" class="btn btn-primary">${isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</button>
        </div>
      </form>
    `;

    // Bind upload buttons
    bindImageUpload(main);

    // Submit
    main.querySelector('#productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        code: fd.get('code'),
        name: fd.get('name'),
        slug: fd.get('slug') || undefined,
        price: parseInt(fd.get('price'), 10) || 0,
        price_old: fd.get('price_old') ? parseInt(fd.get('price_old'), 10) : null,
        description_short: fd.get('description_short') || '',
        description_long: fd.get('description_long') || '',
        image_main: fd.get('image_main') || '',
        image_gallery: (fd.get('image_gallery') || '').split('\n').map(s => s.trim()).filter(Boolean),
        category: fd.get('category') || '',
        in_stock: fd.get('in_stock') === 'on',
        stock_qty: parseInt(fd.get('stock_qty'), 10) || 0,
        sort_order: parseInt(fd.get('sort_order'), 10) || 0,
        published: fd.get('published') === 'on',
      };

      try {
        if (isEdit) {
          await api('/products/' + p.id, { method: 'PATCH', body: JSON.stringify(payload) });
          toast('Đã lưu sản phẩm', 'success');
        } else {
          await api('/products', { method: 'POST', body: JSON.stringify(payload) });
          toast('Đã tạo sản phẩm', 'success');
        }
        window.location.hash = '#/products';
      } catch (err) {
        toast(err.message || 'Lỗi lưu', 'error');
      }
    });

    // Delete
    const delBtn = main.querySelector('#deleteProductBtn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Xoá sản phẩm "${p.name}"? Không khôi phục được.`)) return;
        try {
          await api('/products/' + p.id, { method: 'DELETE' });
          toast('Đã xoá', 'success');
          window.location.hash = '#/products';
        } catch (err) {
          toast(err.message || 'Lỗi xoá', 'error');
        }
      });
    }
  }

  // ---------- Page: Articles list ----------

  async function pageArticlesList(main) {
    const data = await api('/articles?all=1&limit=50');
    const articles = data.articles || [];

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Tin tức</h1>
          <p class="page-subtitle">${articles.length} bài viết</p>
        </div>
        <a href="#/articles/new" class="btn btn-primary">+ Viết bài mới</a>
      </div>

      ${articles.length === 0 ? `
        <div class="empty"><span class="empty-icon">▢</span>Chưa có bài viết nào</div>
      ` : `
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tiêu đề</th>
                <th>Trạng thái</th>
                <th>Ngày đăng</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${articles.map(a => `
                <tr>
                  <td>${a.thumbnail ? `<img src="${esc(a.thumbnail)}" alt="" class="product-thumb">` : '<div class="product-thumb product-thumb--empty">—</div>'}</td>
                  <td>
                    <div class="article-title">${esc(a.title)}</div>
                    <div class="article-slug"><code>${esc(a.slug)}</code></div>
                  </td>
                  <td>${a.status === 'published' ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Draft</span>'}</td>
                  <td>${a.published_at ? formatDate(a.published_at) : '<span class="text-muted">—</span>'}</td>
                  <td><a href="#/articles/${encodeURIComponent(a.slug)}" class="btn-link">Sửa →</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  }

  // ---------- Page: Article new ----------

  async function pageArticleNew(main) {
    renderArticleForm(main, null);
  }

  // ---------- Page: Article edit ----------

  async function pageArticleEdit(main, slug) {
    const data = await api('/articles/' + encodeURIComponent(slug) + '?all=1');
    renderArticleForm(main, data.article);
  }

  function renderArticleForm(main, a) {
    const isEdit = !!a;
    a = a || {
      slug: '', title: '', excerpt: '', thumbnail: '',
      content_md: '', author: '', status: 'draft', published_at: null,
    };

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isEdit ? 'Sửa bài: ' + esc(a.title) : 'Viết bài mới'}</h1>
          <p class="page-subtitle">${isEdit ? 'Slug: /' + esc(a.slug) : 'Bài viết sẽ xuất hiện trên yokool.vn/news.html'}</p>
        </div>
        <a href="#/articles" class="btn btn-ghost">← Quay lại</a>
      </div>

      <form id="articleForm" class="form-card">
        <div class="form-field">
          <label class="form-label">Tiêu đề <span class="required">*</span></label>
          <input class="form-input" name="title" value="${esc(a.title)}" placeholder="VD: Top 5 mẹo bảo quản pin..." required maxlength="200">
        </div>

        <div class="form-grid form-grid--2">
          <div class="form-field">
            <label class="form-label">Slug URL</label>
            <input class="form-input" name="slug" value="${esc(a.slug)}" placeholder="tu-dong-tao-neu-bo-trong">
            <p class="form-help">URL: yokool.vn/news/[slug].html</p>
          </div>
          <div class="form-field">
            <label class="form-label">Tác giả</label>
            <input class="form-input" name="author" value="${esc(a.author || '')}" placeholder="Tên người viết">
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Mô tả ngắn (excerpt)</label>
          <textarea class="form-input" name="excerpt" rows="2" maxlength="500" placeholder="1-2 câu tóm tắt, hiển thị ở danh sách bài viết">${esc(a.excerpt || '')}</textarea>
        </div>

        <div class="form-field">
          <label class="form-label">Ảnh thumbnail</label>
          <div class="image-upload-row">
            <input class="form-input" name="thumbnail" value="${esc(a.thumbnail || '')}" placeholder="URL hoặc upload">
            <button type="button" class="btn btn-ghost btn-sm" data-upload-target="thumbnail" data-folder="articles">📤 Upload</button>
          </div>
          ${a.thumbnail ? `<img src="${esc(a.thumbnail)}" alt="" class="image-preview">` : ''}
        </div>

        <div class="form-field">
          <label class="form-label">Nội dung (Markdown) <span class="required">*</span></label>
          <div class="markdown-editor">
            <textarea class="form-input markdown-input" name="content_md" rows="20" required placeholder="# Tiêu đề\n\nNội dung bài viết, hỗ trợ **bold**, *italic*, [link](https://...), ảnh ![alt](url), danh sách:\n- mục 1\n- mục 2">${esc(a.content_md || '')}</textarea>
            <div class="markdown-preview" id="mdPreview"><em class="text-muted">Preview hiển thị ở đây</em></div>
          </div>
        </div>

        <div class="form-grid form-grid--2">
          <div class="form-field">
            <label class="form-label">Trạng thái</label>
            <select class="form-input" name="status">
              <option value="draft" ${a.status === 'draft' ? 'selected' : ''}>Draft (nháp)</option>
              <option value="published" ${a.status === 'published' ? 'selected' : ''}>Published (xuất bản)</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Ngày đăng</label>
            <input class="form-input" name="published_at" type="datetime-local" value="${a.published_at ? a.published_at.replace(' ', 'T').slice(0, 16) : ''}">
            <p class="form-help">Tự điền khi đổi sang Published</p>
          </div>
        </div>

        <div class="form-actions">
          ${isEdit ? '<button type="button" class="btn btn-danger" id="deleteArticleBtn">Xoá bài</button>' : '<span></span>'}
          <button type="submit" class="btn btn-primary">${isEdit ? 'Lưu' : 'Tạo bài viết'}</button>
        </div>
      </form>
    `;

    bindImageUpload(main);

    // Live markdown preview
    const ta = main.querySelector('.markdown-input');
    const preview = main.querySelector('#mdPreview');
    function updatePreview() {
      preview.innerHTML = renderMarkdown(ta.value) || '<em class="text-muted">Preview hiển thị ở đây</em>';
    }
    ta.addEventListener('input', updatePreview);
    updatePreview();

    // Submit
    main.querySelector('#articleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const publishedAt = fd.get('published_at') ? fd.get('published_at').replace('T', ' ') : null;
      const payload = {
        title: fd.get('title'),
        slug: fd.get('slug') || undefined,
        excerpt: fd.get('excerpt') || '',
        thumbnail: fd.get('thumbnail') || '',
        content_md: fd.get('content_md'),
        author: fd.get('author') || '',
        status: fd.get('status'),
        published_at: publishedAt,
      };

      try {
        if (isEdit) {
          await api('/articles/' + encodeURIComponent(a.slug), { method: 'PATCH', body: JSON.stringify(payload) });
          toast('Đã lưu bài viết', 'success');
        } else {
          await api('/articles', { method: 'POST', body: JSON.stringify(payload) });
          toast('Đã tạo bài viết', 'success');
        }
        window.location.hash = '#/articles';
      } catch (err) {
        toast(err.message || 'Lỗi lưu', 'error');
      }
    });

    // Delete
    const delBtn = main.querySelector('#deleteArticleBtn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Xoá bài "${a.title}"?`)) return;
        try {
          await api('/articles/' + encodeURIComponent(a.slug), { method: 'DELETE' });
          toast('Đã xoá', 'success');
          window.location.hash = '#/articles';
        } catch (err) {
          toast(err.message || 'Lỗi xoá', 'error');
        }
      });
    }
  }

  // ---------- Page: Banners ----------

  async function pageBanners(main) {
    const data = await api('/banners');
    const banners = data.banners || [];

    const byPage = {
      home: banners.filter(b => b.slot.startsWith('home_')),
      b2b:  banners.filter(b => b.slot.startsWith('b2b_')),
    };

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Banner hero</h1>
          <p class="page-subtitle">3 slide trang chủ + 3 slide trang B2B · 6 slot cố định</p>
        </div>
        <button type="button" class="btn btn-primary" id="saveBannersBtn">Lưu tất cả</button>
      </div>

      <form id="bannersForm">
        <h2 class="section-heading">Trang chủ (yokool.vn)</h2>
        ${byPage.home.map(renderBannerSlot).join('')}

        <h2 class="section-heading" style="margin-top: 40px;">Trang B2B (yokool.vn/b2b.html)</h2>
        ${byPage.b2b.map(renderBannerSlot).join('')}
      </form>
    `;

    bindImageUpload(main);

    main.querySelector('#saveBannersBtn').addEventListener('click', async () => {
      const payload = banners.map(b => {
        const card = main.querySelector(`[data-slot="${b.slot}"]`);
        return {
          slot: b.slot,
          image_url:   card.querySelector('[name="image_url"]').value,
          eyebrow:     card.querySelector('[name="eyebrow"]').value,
          title_line1: card.querySelector('[name="title_line1"]').value,
          title_line2: card.querySelector('[name="title_line2"]').value,
          tagline:     card.querySelector('[name="tagline"]').value,
          cta_text:    card.querySelector('[name="cta_text"]').value,
          cta_link:    card.querySelector('[name="cta_link"]').value,
          enabled:     card.querySelector('[name="enabled"]').checked,
        };
      });

      try {
        await api('/banners', { method: 'PUT', body: JSON.stringify({ banners: payload }) });
        toast('Đã lưu tất cả banner', 'success');
      } catch (err) {
        toast(err.message || 'Lỗi lưu', 'error');
      }
    });
  }

  function renderBannerSlot(b) {
    return `
      <div class="banner-card" data-slot="${b.slot}">
        <div class="banner-card-header">
          <strong>${b.slot}</strong>
          <label class="form-checkbox-row" style="margin: 0">
            <input type="checkbox" name="enabled" ${b.enabled ? 'checked' : ''}>
            <span>Hiển thị</span>
          </label>
        </div>

        <div class="banner-card-body">
          <div class="banner-card-image">
            ${b.image_url ? `<img src="${esc(b.image_url)}" alt="" class="banner-preview">` : '<div class="banner-preview banner-preview--empty">Chưa có ảnh</div>'}
            <div class="image-upload-row" style="margin-top: 8px;">
              <input class="form-input form-input--sm" name="image_url" value="${esc(b.image_url || '')}" placeholder="URL ảnh">
              <button type="button" class="btn btn-ghost btn-sm" data-upload-target="image_url" data-folder="banners">📤</button>
            </div>
          </div>

          <div class="banner-card-fields">
            <div class="form-field">
              <label class="form-label">Eyebrow</label>
              <input class="form-input form-input--sm" name="eyebrow" value="${esc(b.eyebrow || '')}" placeholder="/ B2B · Corporate gifts">
            </div>
            <div class="form-grid form-grid--2">
              <div class="form-field">
                <label class="form-label">Title dòng 1</label>
                <input class="form-input form-input--sm" name="title_line1" value="${esc(b.title_line1 || '')}" placeholder="Quà tặng">
              </div>
              <div class="form-field">
                <label class="form-label">Title dòng 2</label>
                <input class="form-input form-input--sm" name="title_line2" value="${esc(b.title_line2 || '')}" placeholder="đẳng cấp.">
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">Tagline</label>
              <textarea class="form-input form-input--sm" name="tagline" rows="2" placeholder="Câu mô tả ngắn">${esc(b.tagline || '')}</textarea>
            </div>
            <div class="form-grid form-grid--2">
              <div class="form-field">
                <label class="form-label">Nút CTA — text</label>
                <input class="form-input form-input--sm" name="cta_text" value="${esc(b.cta_text || '')}" placeholder="Nhận báo giá">
              </div>
              <div class="form-field">
                <label class="form-label">Nút CTA — link</label>
                <input class="form-input form-input--sm" name="cta_link" value="${esc(b.cta_link || '')}" placeholder="#b2b-inquiry">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- Page: Config ----------

  async function pageConfig(main) {
    const data = await api('/config');
    const c = data.config || {};

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Cấu hình site</h1>
          <p class="page-subtitle">Thông tin hiển thị trên yokool.vn (contact widget, footer, ...)</p>
        </div>
        <button type="button" class="btn btn-primary" id="saveConfigBtn">Lưu</button>
      </div>

      <form id="configForm" class="config-grid">

        <section class="config-section">
          <h2 class="section-heading">Contact widget</h2>
          <p class="section-desc">3 nút tròn nổi ở góc dưới phải trên yokool.vn</p>

          <div class="form-grid form-grid--2">
            <div class="form-field">
              <label class="form-label">Hotline (số điện thoại)</label>
              <input class="form-input" name="hotline" value="${esc(c.hotline)}" placeholder="+84 900 000 000">
            </div>
            <div class="form-field">
              <label class="form-label">Hotline — label hiển thị</label>
              <input class="form-input" name="hotline_label" value="${esc(c.hotline_label)}" placeholder="Gọi ngay">
            </div>

            <div class="form-field">
              <label class="form-label">Zalo link</label>
              <input class="form-input" name="zalo_link" value="${esc(c.zalo_link)}" placeholder="https://zalo.me/...">
            </div>
            <div class="form-field">
              <label class="form-label">Zalo — label</label>
              <input class="form-input" name="zalo_label" value="${esc(c.zalo_label)}" placeholder="Chat Zalo">
            </div>

            <div class="form-field">
              <label class="form-label">Messenger link</label>
              <input class="form-input" name="messenger_link" value="${esc(c.messenger_link)}" placeholder="https://m.me/...">
            </div>
            <div class="form-field">
              <label class="form-label">Messenger — label</label>
              <input class="form-input" name="messenger_label" value="${esc(c.messenger_label)}" placeholder="Chat Messenger">
            </div>
          </div>
        </section>

        <section class="config-section">
          <h2 class="section-heading">Thông tin B2B</h2>
          <p class="section-desc">Hiển thị ở trang B2B</p>

          <div class="form-grid form-grid--2">
            <div class="form-field">
              <label class="form-label">B2B Email</label>
              <input class="form-input" name="b2b_email" value="${esc(c.b2b_email)}" placeholder="b2b@yokool.vn">
            </div>
            <div class="form-field">
              <label class="form-label">B2B Hotline</label>
              <input class="form-input" name="b2b_hotline" value="${esc(c.b2b_hotline)}" placeholder="+84 900 000 000">
            </div>
            <div class="form-field">
              <label class="form-label">B2B Hotline — tên người phụ trách</label>
              <input class="form-input" name="b2b_hotline_owner" value="${esc(c.b2b_hotline_owner)}" placeholder="Mr. Trường">
            </div>
            <div class="form-field">
              <label class="form-label">Giờ làm việc</label>
              <input class="form-input" name="work_hours" value="${esc(c.work_hours)}" placeholder="T2–T6 · 8h30 – 17h30">
            </div>
            <div class="form-field" style="grid-column: 1 / -1;">
              <label class="form-label">Địa chỉ văn phòng</label>
              <input class="form-input" name="office_address" value="${esc(c.office_address)}" placeholder="Tầng X, Toà Y, Quận Z, TP. Hà Nội">
            </div>
          </div>
        </section>

        <section class="config-section">
          <h2 class="section-heading">Kênh bán hàng</h2>
          <div class="form-field">
            <label class="form-label">Shopee link</label>
            <input class="form-input" name="shopee_link" value="${esc(c.shopee_link)}" placeholder="https://shopee.vn/yokool">
          </div>
        </section>

        <section class="config-section">
          <h2 class="section-heading">Footer</h2>
          <p class="section-desc">Nội dung hiển thị ở chân trang mọi page</p>

          <div class="form-field">
            <label class="form-label">Tagline (dưới logo)</label>
            <input class="form-input" name="footer_tagline" value="${esc(c.footer_tagline)}" placeholder="Năng lượng. Không giới hạn.">
          </div>
          <div class="form-field">
            <label class="form-label">Giới thiệu ngắn</label>
            <textarea class="form-input" name="footer_about" rows="2" placeholder="Yokool — thương hiệu...">${esc(c.footer_about)}</textarea>
          </div>
          <div class="form-grid form-grid--2">
            <div class="form-field">
              <label class="form-label">Copyright</label>
              <input class="form-input" name="footer_copyright" value="${esc(c.footer_copyright)}" placeholder="© 2026 YOKOOL. Made in Vietnam.">
            </div>
            <div class="form-field">
              <label class="form-label">Version (góc phải footer)</label>
              <input class="form-input" name="footer_version" value="${esc(c.footer_version)}" placeholder="v3.4">
            </div>
          </div>
        </section>

      </form>
    `;

    main.querySelector('#saveConfigBtn').addEventListener('click', async () => {
      const form = main.querySelector('#configForm');
      const fd = new FormData(form);
      const config = {};
      for (const [k, v] of fd.entries()) config[k] = v;

      try {
        await api('/config', { method: 'PATCH', body: JSON.stringify({ config }) });
        toast('Đã lưu cấu hình. yokool.vn sẽ cập nhật trong vài phút (cache).', 'success');
      } catch (err) {
        toast(err.message || 'Lỗi lưu', 'error');
      }
    });
  }

  // ---------- Image upload helper ----------

  function bindImageUpload(root) {
    // Single-target upload
    root.querySelectorAll('[data-upload-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetName = btn.dataset.uploadTarget;
        const folder = btn.dataset.folder || 'misc';
        pickFileAndUpload(folder).then(url => {
          if (!url) return;
          const input = btn.closest('.image-upload-row, .banner-card-image').querySelector(`[name="${targetName}"]`);
          if (input) {
            input.value = url;
            // Auto-update preview if exists
            const card = btn.closest('.banner-card-image, .form-field');
            if (card) {
              let preview = card.querySelector('.image-preview, .banner-preview');
              if (!preview) {
                preview = document.createElement('img');
                preview.className = 'image-preview';
                card.insertBefore(preview, card.firstChild);
              }
              if (preview.tagName === 'IMG') preview.src = url;
              else preview.outerHTML = `<img src="${url}" class="image-preview" alt="">`;
            }
            toast('Upload thành công', 'success');
          }
        });
      });
    });

    // Gallery — append to textarea
    root.querySelectorAll('[data-upload-gallery]').forEach(btn => {
      btn.addEventListener('click', () => {
        const folder = btn.dataset.folder || 'misc';
        pickFileAndUpload(folder).then(url => {
          if (!url) return;
          const ta = btn.closest('.form-field').querySelector('textarea[name="image_gallery"]');
          if (ta) {
            ta.value = (ta.value ? ta.value + '\n' : '') + url;
            toast('Đã thêm vào gallery', 'success');
          }
        });
      });
    });
  }

  function pickFileAndUpload(folder) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', folder);
        try {
          toast('Đang upload...', 'info');
          const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload thất bại');
          resolve(data.url);
        } catch (err) {
          toast(err.message || 'Upload lỗi', 'error');
          resolve(null);
        }
      };
      input.click();
    });
  }

  // ---------- Minimal markdown renderer ----------

  function renderMarkdown(md) {
    if (!md) return '';
    let html = esc(md);
    // Code blocks (```...```)
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Bold / italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Images ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">');
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Unordered lists
    html = html.replace(/(^|\n)((?:- .+(?:\n|$))+)/g, (_, prefix, block) => {
      const items = block.trim().split('\n').map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('');
      return prefix + '<ul>' + items + '</ul>';
    });
    // Paragraphs (lines separated by blank line)
    html = html.split(/\n\n+/).map(para => {
      if (/^<(h[1-6]|ul|ol|pre|blockquote|img)/.test(para.trim())) return para;
      return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    return html;
  }

  // ---------- Boot ----------

  (async function boot() {
    // 1. Check setup
    try {
      const r = await fetch('/api/auth/setup', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (d.needsSetup) { window.location.replace('/setup.html'); return; }
      }
    } catch {}

    // 2. Check auth
    let user;
    try {
      const data = await api('/auth/me');
      user = data.user;
    } catch {
      window.location.replace('/login.html');
      return;
    }

    // 3. Render shell
    $('#topbarUserName').textContent = user.name;
    $('#topbarUserEmail').textContent = user.email;
    $('#app').style.visibility = 'visible';

    // 4. Bind logout
    $('#logoutBtn').addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch {}
      window.location.replace('/login.html');
    });

    // 5. Initial route
    if (!window.location.hash) window.location.hash = '#/dashboard';
    navigate();
  })();
})();
