# YOKOOL ADMIN v2.0 — Phase 2A: Content Management

Bản nâng cấp này thêm 4 trang quản lý nội dung mới vào admin:
- **Sản phẩm** — CRUD đầy đủ với upload ảnh lên Cloudflare R2
- **Tin tức** — Markdown editor + live preview
- **Banner hero** — 6 slot (3 trang chủ + 3 B2B)
- **Cấu hình site** — contact widget, footer, B2B info

---

## 📋 Hướng dẫn deploy (cho Jay)

### Bước 1 — Upload code mới vào GitHub repo admin

Trong GitHub repo admin của Jay:

1. **Thêm/sửa các file backend** (`functions/api/`):
   - `_middleware.js` (đè lên — thêm public GET routes)
   - `_utils.js` (đè lên — thêm slugify helper)
   - `products/index.js` (file mới)
   - `products/[id].js` (file mới)
   - `articles/index.js` (file mới)
   - `articles/[slug].js` (file mới)
   - `banners.js` (file mới)
   - `config.js` (file mới)
   - `upload.js` (file mới)

2. **Thêm/sửa file frontend** (`public/`):
   - `index.html` (đè lên — thêm sidebar items)
   - `app.js` (đè lên — thêm routes)
   - `styles.css` (đè lên — thêm styles)

3. **Thêm schema-v2.sql** vào root repo (chỉ để tham khảo, sẽ chạy ở bước 3)

Commit + push.

### Bước 2 — Tạo Cloudflare R2 bucket cho ảnh

R2 free 10GB, dư xài cho 1000+ ảnh sản phẩm.

1. Vào **Cloudflare Dashboard** → **R2** (menu trái)
2. Bấm **Create bucket**
3. Tên bucket: `yokool-images` → **Create**
4. Trong bucket vừa tạo → tab **Settings**
5. Phần **Public access** → bấm **Allow Access** → confirm
6. Sau khi enable, Cloudflare hiện **"Public R2.dev Bucket URL"** dạng:
   ```
   https://pub-abc123def456789.r2.dev
   ```
   → **Copy URL này** (cần dùng ở bước 4)

### Bước 3 — Chạy schema-v2.sql lên D1 database

1. Vào Cloudflare Dashboard → **D1** → chọn database `yokool-admin-db`
2. Tab **Console**
3. Mở file `schema-v2.sql` (đính kèm trong zip), copy **TOÀN BỘ** nội dung (1 dòng dài thôi)
4. Paste vào ô Console → bấm **Execute**

Xác nhận thành công: tab **Tables** sẽ có thêm `products`, `articles`, `banners`, `site_config`.
Mỗi bảng đã có seed data sẵn (4 sản phẩm Yokool, 6 banner mặc định, 17 config keys).

### Bước 4 — Bind R2 bucket + set env variable vào Pages

1. Vào **Workers & Pages** → click vào project `yokool-admin`
2. Tab **Settings** → mục **Functions** → kéo xuống **R2 bucket bindings** → **Add binding**:
   - Variable name: `IMAGES` (chữ in hoa, đúng tên)
   - R2 bucket: `yokool-images`
   - **Save**

3. Vẫn ở tab Settings, kéo xuống **Environment variables** → **Add variable**:
   - Variable name: `R2_PUBLIC_BASE`
   - Value: dán URL ở bước 2.6 (vd `https://pub-abc123def456789.r2.dev`)
   - Type: **Plaintext** (không cần Secret)
   - **Save**

### Bước 5 — Re-deploy

Tab **Deployments** → bấm **... ** ở deployment mới nhất → **Retry deployment**.

Đợi ~1 phút, deployment Success → tất cả tính năng mới đã sẵn sàng.

### Bước 6 — Test

Vào `https://yokool-admin.pages.dev` → login → trong sidebar đã có 4 mục mới:
- **Sản phẩm** — phải thấy 4 sản phẩm seed (JP395, RC502, SL207, OL212)
- **Tin tức** — danh sách rỗng, bấm "Viết bài mới" thử
- **Banner** — 6 slot có nội dung sẵn
- **Cấu hình site** — form đầy đủ hotline, Zalo, footer, ...

Test upload: vào 1 sản phẩm → bấm "📤 Upload" cạnh ô "Ảnh chính" → chọn 1 ảnh JPG → phải thấy URL điền vào ô và preview hiện ra. Nếu lỗi `R2 bucket chưa được bind` → check lại Bước 4.

---

## 🌐 Tích hợp dynamic content vào yokool.vn

Sau khi admin đã có data, để yokool.vn hiển thị động:

### Cập nhật `yokool-api.js` ở repo `Yokool-web`

File mới `yokool-api.js` v3 đính kèm trong `integration/yokool-api.js`. **Up đè lên file cũ** ở repo Yokool-web. File này có thêm tính năng:
- Fetch products / articles / banners / config từ admin API (cache 5 phút)
- Tự động fill nội dung động qua attribute `data-yokool-*`

### Cách dùng — thêm attribute vào HTML

Trong các file HTML của Yokool site, thay vì hard-code, dùng attribute:

**Contact widget (mọi page):**
```html
<a data-yokool-config="zalo_link" href="#" target="_blank">...</a>
<a data-yokool-config="messenger_link" href="#" target="_blank">...</a>
<a data-yokool-config="hotline" href="tel:#">Gọi ngay</a>
```

**Footer (mọi page):**
```html
<p data-yokool-config="footer_tagline">Năng lượng. Không giới hạn.</p>
<p data-yokool-config="footer_copyright">© 2026 YOKOOL...</p>
<p data-yokool-config="footer_version">v3.4</p>
```

**Banner slot (index.html, b2b.html):**
```html
<div class="carousel-slide" data-yokool-banner="home_1"></div>
<div class="carousel-slide" data-yokool-banner="home_2"></div>
<div class="carousel-slide" data-yokool-banner="home_3"></div>
```

**Grid sản phẩm (index.html):**
```html
<div class="products-grid" data-yokool-products data-yokool-limit="4"></div>
```

**Danh sách tin tức (news.html):**
```html
<div class="articles-list" data-yokool-articles data-yokool-limit="10"></div>
```

Cách áp dụng: Jay có thể chuyển dần từng phần — không cần làm 1 lần. Để hardcode hiện tại vẫn work, chỉ thay những phần muốn lấy động.

### Custom domain (khuyến nghị)

Hiện admin URL là `yokool-admin.pages.dev`. Để gọn, set subdomain riêng:

1. Cloudflare Pages → project `yokool-admin` → tab **Custom domains** → **Set up a custom domain**
2. Domain: `admin.yokool.vn` → **Continue** → Cloudflare tự thêm DNS record
3. Đợi 1–2 phút, vào `https://admin.yokool.vn` test

Sau đó sửa `yokool-api.js` ở Yokool-web repo:
```js
const API_BASE = 'https://admin.yokool.vn';   // thay yokool-admin.pages.dev
```

---

## 📁 Cấu trúc files mới (so với v1)

```
yokool-admin-v2/
├── schema-v2.sql               ← MỚI: 4 bảng + seed
├── functions/api/
│   ├── _middleware.js          ← SỬA: thêm public GET routes
│   ├── _utils.js               ← SỬA: thêm slugify + parseJSON
│   ├── products/
│   │   ├── index.js            ← MỚI
│   │   └── [id].js             ← MỚI
│   ├── articles/
│   │   ├── index.js            ← MỚI
│   │   └── [slug].js           ← MỚI
│   ├── banners.js              ← MỚI
│   ├── config.js               ← MỚI
│   └── upload.js               ← MỚI (R2 bucket)
├── public/
│   ├── index.html              ← SỬA: 4 sidebar items mới
│   ├── app.js                  ← SỬA: 8 routes + 8 page renderers
│   └── styles.css              ← SỬA: thêm CSS cho form, banner card, markdown editor
└── integration/
    └── yokool-api.js           ← MỚI v3: fetchers + auto-populate
```

---

## 🚨 Troubleshooting

**Build failed sau khi push:** Check Cloudflare Pages → Deployments → click vào deployment đỏ → xem log. Thường do lỗi cú pháp JS — copy log gửi tôi.

**Upload ảnh lỗi "R2 bucket chưa được bind":** Quên bước 4. Vào Pages Settings → Functions → R2 bucket bindings → thêm `IMAGES` → `yokool-images` → Retry deployment.

**Upload thành công nhưng ảnh không hiện (404):** R2 bucket chưa enable Public Access. Vào R2 → bucket `yokool-images` → Settings → Allow Access.

**yokool.vn vẫn hiển thị nội dung cũ sau khi sửa trong admin:** Cache 5 phút trong localStorage. Cách bypass:
- F12 → Console → gõ: `YokoolAPI.clearCache(); location.reload();`
- Hoặc đợi 5 phút

**"Mã sản phẩm đã tồn tại":** code (như JP395) là UNIQUE. Đổi mã khác hoặc xoá sản phẩm cũ trước.

**Lỗi 401 khi gọi POST/PATCH/DELETE từ admin:** Session expired. Logout → login lại.
