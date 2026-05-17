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
    { match: /^\/?$/,                       render: pageDashboard,    title: 'Tổng quan',    nav: 'dashboard' },
    { match: /^\/dashboard$/,               render: pageDashboard,    title: 'Tổng quan',    nav: 'dashboard' },
    { match: /^\/orders$/,                  render: pageOrdersList,   title: 'Đơn hàng B2C', nav: 'orders' },
    { match: /^\/orders\/([^/]+)$/,         render: pageOrderDetail,  title: 'Chi tiết đơn', nav: 'orders' },
    { match: /^\/inquiries$/,               render: pageInquiriesList,title: 'Yêu cầu B2B',  nav: 'inquiries' },
    { match: /^\/inquiries\/([^/]+)$/,      render: pageInquiryDetail,title: 'Chi tiết B2B', nav: 'inquiries' },
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
