// ============================================================
// YOKOOL → ADMIN INTEGRATION
// ============================================================
// Đặt URL của admin API ở đây. 2 lựa chọn:
//   1. https://yokool-admin.pages.dev          (mặc định Cloudflare Pages)
//   2. https://admin.yokool.vn                 (sau khi cấu hình custom domain)
// ============================================================

window.YokoolAPI = (function () {
  const API_BASE = 'https://yokool-admin.pages.dev';

  async function postJSON(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Lỗi máy chủ');
    return data;
  }

  // -----------------------------------------------------------
  // Gửi đơn B2C lên admin
  // Trả về: { ok: true, order_id: 'ORD-...', total }
  // -----------------------------------------------------------
  async function submitOrder(order) {
    // order = {
    //   customer: { name, phone, email, address, ward, district, province, note },
    //   items: [{ code, name, qty, price }],
    //   payment_method, shipping_fee
    // }
    return postJSON('/api/orders', {
      customer_name:     order.customer.name,
      customer_phone:    order.customer.phone,
      customer_email:    order.customer.email || '',
      shipping_address:  order.customer.address,
      shipping_ward:     order.customer.ward || '',
      shipping_district: order.customer.district || '',
      shipping_province: order.customer.province,
      customer_note:     order.customer.note || '',
      payment_method:    order.payment_method || 'COD',
      shipping_fee:      order.shipping_fee || 0,
      items: order.items.map(it => ({
        product_code: it.code,
        product_name: it.name,
        quantity:     it.qty,
        unit_price:   it.price,
      })),
    });
  }

  // -----------------------------------------------------------
  // Gửi yêu cầu B2B lên admin
  // Trả về: { ok: true, inquiry_id: 'INQ-...' }
  // -----------------------------------------------------------
  async function submitInquiry(inquiry) {
    // inquiry = { company, contact_name, position, email, phone,
    //             products: ['SL207', ...], quantity, deadline, purpose, note }
    return postJSON('/api/inquiries', {
      company:       inquiry.company,
      contact_name:  inquiry.contact_name,
      position:      inquiry.position || '',
      email:         inquiry.email,
      phone:         inquiry.phone,
      products:      Array.isArray(inquiry.products) ? inquiry.products : [],
      quantity:      inquiry.quantity,
      deadline:      inquiry.deadline || '',
      purpose:       inquiry.purpose || '',
      customer_note: inquiry.note || '',
    });
  }

  return { submitOrder, submitInquiry };
})();
