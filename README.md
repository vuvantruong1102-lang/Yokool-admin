# Yokool Admin v1.0 — Phase 1 MVP

Web app quản trị cho Yokool, deploy lên **Cloudflare Pages** + database **Cloudflare D1**.

## Tính năng

- ✅ Đăng nhập admin có password (PBKDF2 + session cookie 7 ngày)
- ✅ Dashboard với 4 chỉ số: đơn mới hôm nay · đơn đang xử lý · doanh thu 7 ngày · B2B chờ phản hồi
- ✅ Quản lý đơn B2C: danh sách, lọc theo trạng thái, tìm kiếm, chi tiết, cập nhật trạng thái, xuất CSV cho shipper
- ✅ Quản lý yêu cầu B2B: danh sách, lọc, chi tiết, theo dõi trạng thái, ghi chú nội bộ
- ✅ Yokool site (`yokool.vn`) gửi đơn / inquiry vào DB qua API public

## Cấu trúc thư mục

```
yokool-admin/
├── schema.sql                      ← Chạy 1 lần để tạo tables
├── functions/                      ← Backend (Pages Functions)
│   └── api/
│       ├── _middleware.js          ← Auth + CORS
│       ├── _utils.js               ← Helpers dùng chung
│       ├── auth/
│       │   ├── setup.js            ← Tạo admin đầu tiên
│       │   ├── login.js
│       │   ├── logout.js
│       │   └── me.js
│       ├── orders/
│       │   ├── index.js            ← GET list / POST tạo đơn (public)
│       │   ├── [id].js             ← GET / PATCH chi tiết
│       │   └── export.js           ← Tải CSV
│       ├── inquiries/
│       │   ├── index.js
│       │   └── [id].js
│       └── dashboard.js
├── public/                         ← Frontend admin SPA
│   ├── index.html                  ← Shell + nav
│   ├── login.html
│   ├── setup.html
│   ├── styles.css
│   └── app.js                      ← Toàn bộ logic SPA
└── integration/                    ← Patch cho Yokool site
    ├── b2b-patch.html
    └── checkout-patch.html
```

---

## HƯỚNG DẪN SETUP TỪ ĐẦU (cho người mới)

### 📋 Bước 1 — Tạo GitHub repo riêng cho admin

1. Vào https://github.com/new
2. Repository name: `yokool-admin`
3. Public hoặc Private đều được. Tạo xong.
4. Trên trang repo, bấm **"Add file" → "Upload files"**
5. **KÉO TOÀN BỘ folder `yokool-admin`** (mở zip ra) vào ô upload (không cần kéo file zip, kéo từng file con)
6. Commit message: `Initial admin v1.0`
7. Bấm **"Commit changes"**

### 📋 Bước 2 — Tạo D1 database trên Cloudflare

1. Vào https://dash.cloudflare.com → chọn account của Jay
2. Sidebar trái → **Storage & Databases** → **D1 SQL Database**
3. Bấm **"Create database"**
4. Tên: `yokool-admin-db`
5. Location: chọn **Asia-Pacific (APAC)** để gần VN, response nhanh
6. Bấm **"Create"**

### 📋 Bước 3 — Chạy schema.sql để tạo tables

1. Trong D1 vừa tạo, vào tab **"Console"**
2. Mở file `schema.sql` (trong bộ yokool-admin)
3. **Copy TOÀN BỘ nội dung** rồi paste vào ô console
4. Bấm **"Execute"**
5. Sẽ thấy thông báo thành công. Tab **"Tables"** sẽ hiện 5 bảng:
   `admin_users`, `sessions`, `orders`, `order_items`, `b2b_inquiries`

### 📋 Bước 4 — Tạo Pages project

1. Sidebar trái → **Workers & Pages** → **Create application** → tab **"Pages"** → **"Connect to Git"**
2. Chọn GitHub → cho phép Cloudflare đọc repo → chọn repo `yokool-admin`
3. **Build settings:**
   - Framework preset: **None**
   - Build command: (để trống)
   - Build output directory: **`public`**
   - Root directory: (để trống — mặc định là `/`)
4. Bấm **"Save and Deploy"**
5. Đợi ~30s, deploy xong sẽ có URL kiểu `https://yokool-admin.pages.dev`

### 📋 Bước 5 — Bind D1 database vào Pages project

⚠️ **Bước này quan trọng nhất** — không bind thì admin sẽ không kết nối được DB.

1. Vào project `yokool-admin` vừa tạo → tab **"Settings"** → **"Bindings"**
2. Bấm **"Add" → "D1 database"**
3. Variable name: `DB` (phải đúng tên này, không đổi)
4. D1 database: chọn `yokool-admin-db` (đã tạo ở Bước 2)
5. Bấm **"Save"**
6. **Quan trọng**: vào tab **"Deployments"** → bấm **"Retry deployment"** trên deploy mới nhất để Pages áp dụng binding mới

### 📋 Bước 6 — Tạo tài khoản admin đầu tiên

1. Mở browser, truy cập `https://yokool-admin.pages.dev`
2. Trang sẽ **tự động redirect** sang `/setup.html` vì DB chưa có admin nào
3. Điền:
   - Họ và tên: Jay
   - Email: email của Jay
   - Mật khẩu: tối thiểu 8 ký tự
4. Bấm **"Tạo tài khoản"** → tự động đăng nhập vào dashboard

✅ Đến đây admin đã chạy được, có thể tạo/xem đơn thử nghiệm.

### 📋 Bước 7 — Nối Yokool main site với admin API

#### A. Patch trang `b2b.html`

1. Mở file `b2b.html` trong repo `Yokool-web`
2. Tìm dòng cuối có `<script>` chứa code xử lý form `b2bForm` (đoạn ~30 dòng JavaScript)
3. Thay TOÀN BỘ block `<script>` đó bằng nội dung trong file `integration/b2b-patch.html`
4. ⚠️ Trong patch, **sửa URL** ở dòng:
   ```js
   const API_BASE = 'https://yokool-admin.pages.dev';
   ```
   thành URL admin của Jay (nếu khác).
5. Commit + push.

#### B. Patch trang `checkout.html`

1. Mở file `checkout.html`. Trước `</body>` thêm `<script>` block trong `integration/checkout-patch.html`.
2. Mở `script.js`, tìm chỗ xử lý submit form checkout (nơi gọi `YokoolCart.saveOrder()`).
3. Sau khi `saveOrder()` xong, thêm:
   ```js
   try {
     const result = await window.YokoolAPI.submitOrder(order);
     window.yokoolToast('Đã đặt đơn! Mã: ' + result.order_id, 'success');
   } catch (err) {
     console.error(err);
     window.yokoolToast('Đặt đơn lỗi, vui lòng gọi hotline.', 'error');
   }
   ```
4. ⚠️ Đảm bảo hàm submit handler là `async function` (có `async` ở đầu) để dùng được `await`.
5. Commit + push.

### 📋 Bước 8 — Test end-to-end

1. Vào `https://yokool.vn` (hoặc URL Pages của Yokool main)
2. **Test đơn B2C:** thêm sản phẩm vào giỏ → checkout → điền form → đặt đơn
3. Vào `https://yokool-admin.pages.dev/#/orders` → đơn mới phải xuất hiện
4. **Test B2B:** vào `/b2b.html` → điền form → gửi
5. Vào `https://yokool-admin.pages.dev/#/inquiries` → inquiry phải xuất hiện

✅ Xong Phase 1!

---

## (TUỲ CHỌN) Custom domain `admin.yokool.vn`

1. Vào project `yokool-admin` trên Cloudflare → tab **"Custom domains"** → **"Set up a custom domain"**
2. Nhập: `admin.yokool.vn`
3. Cloudflare tự thêm DNS record (vì domain `yokool.vn` đã trỏ về Cloudflare)
4. SSL tự cấp sau 1-2 phút
5. Sau khi xong, đổi `API_BASE` trong 2 patch (`b2b-patch.html` + `checkout-patch.html`) thành:
   ```js
   const API_BASE = 'https://admin.yokool.vn';
   ```

---

## Vận hành hàng ngày

### Xem đơn mới
- Vào `https://admin.yokool.vn` (hoặc `.pages.dev`)
- Dashboard hiện đơn mới nhất
- Bấm **"Đơn hàng B2C"** ở sidebar để xem đầy đủ

### Cập nhật trạng thái đơn
1. Click vào đơn cần xử lý
2. Bên phải có panel "Cập nhật trạng thái"
3. Chọn trạng thái mới (`Đang xử lý` / `Đang giao` / `Đã giao` / `Huỷ`)
4. Có thể ghi chú nội bộ (chỉ admin thấy, KH không thấy)
5. Bấm **"Lưu thay đổi"**

### Xuất CSV cho shipper
1. Vào **Đơn hàng B2C**
2. Filter trạng thái = **"Đang xử lý"** hoặc **"Đang giao"**
3. Bấm **"Xuất CSV cho shipper"** (góc phải trên)
4. File CSV tự tải về, mở bằng Excel có đủ Vietnamese diacritics

### Quản lý B2B
- Inquiry mới có trạng thái mặc định **"Chưa liên hệ"**
- Sau khi gọi/email khách: đổi sang **"Đã liên hệ"**
- Sau khi gửi báo giá: **"Đã báo giá"**
- Chốt được deal: **"Đã chốt deal"**
- Khách từ chối: **"Đã mất"**
- Ghi chú nội bộ để track lịch sử trao đổi

---

## Bảo mật & sao lưu

- **Mật khẩu admin**: dùng PBKDF2 100k iterations + salt riêng cho mỗi user. Không lưu plain text.
- **Session**: cookie HttpOnly + Secure + SameSite=Lax. Hết hạn sau 7 ngày, auto cleanup expired sessions.
- **Sao lưu D1**: Cloudflare có **Time Travel** tự động backup 30 ngày. Vào D1 → tab "Time Travel" để restore điểm bất kỳ.
- **Export DB**: vào D1 → "..." → "Export" để tải về file SQL.

---

## Free tier Cloudflare (đủ dùng nhiều năm)

| Resource | Limit/ngày | Yokool dự kiến dùng |
|----------|-----------|---------------------|
| D1 rows read | 5.000.000 | < 1.000 |
| D1 rows written | 100.000 | < 100 |
| D1 storage | 5 GB | < 10 MB |
| Workers requests | 100.000 | < 500 |

→ Có thể chạy free hàng năm trời. Khi nào lên Workers Paid ($5/tháng) cũng được, sẽ có thêm Time Travel 30 ngày, không giới hạn requests.

---

## Cảnh báo quan trọng về D1

⚠️ **D1 tính tiền theo số rows scan**, không phải số query. Nếu sau này thêm bảng và viết query không có INDEX, có thể đốt rất nhiều rows. Tất cả tables hiện tại trong `schema.sql` đã có đủ INDEX cho mọi `WHERE` / `ORDER BY`. Khi thêm cột filter mới, **nhớ thêm INDEX**.

---

## Phase 2 (tuần 3-4) — sắp tới

Khi Phase 1 chạy ổn, mình sẽ làm tiếp:

- 🔜 **Quản lý sản phẩm** — CRUD 4 sản phẩm, trang web fetch từ API thay vì hard-code HTML
- 🔜 **Quản lý bài viết Tin tức** — Markdown editor, `news.html` load từ DB
- 🔜 **Quản lý banner hero** — đổi ảnh + text 3 slide
- 🔜 **Quản lý hotline / Zalo / Messenger** — cấu hình contact widget

Có vấn đề gì cứ ping. Chúc Jay launch thuận lợi! 🚀
