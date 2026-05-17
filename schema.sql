
-- Admin users (Jay + nhân viên tương lai)
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  password_salt TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'admin',     -- admin | staff
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- Sessions (login token lưu vào cookie)
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT    NOT NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Đơn hàng B2C từ checkout.html
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,                -- ORD-20260517-001
  customer_name     TEXT    NOT NULL,
  customer_phone    TEXT    NOT NULL,
  customer_email    TEXT,
  shipping_address  TEXT    NOT NULL,
  shipping_ward     TEXT,
  shipping_district TEXT,
  shipping_province TEXT    NOT NULL,
  customer_note     TEXT,
  subtotal          INTEGER NOT NULL,                -- VND
  shipping_fee      INTEGER NOT NULL DEFAULT 0,
  total             INTEGER NOT NULL,
  payment_method    TEXT    NOT NULL DEFAULT 'COD',  -- COD | bank | ...
  status            TEXT    NOT NULL DEFAULT 'new',  -- new | processing | shipping | delivered | cancelled
  internal_note     TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone      ON orders(customer_phone);

-- Sản phẩm trong từng đơn
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     TEXT    NOT NULL,
  product_code TEXT    NOT NULL,                     -- SL207 | OL212 | JP395 | RC502
  product_name TEXT    NOT NULL,
  quantity     INTEGER NOT NULL,
  unit_price   INTEGER NOT NULL,
  subtotal     INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Yêu cầu B2B từ b2b.html
CREATE TABLE IF NOT EXISTS b2b_inquiries (
  id            TEXT PRIMARY KEY,                    -- INQ-20260517-001
  company       TEXT    NOT NULL,
  contact_name  TEXT    NOT NULL,
  position      TEXT,
  email         TEXT    NOT NULL,
  phone         TEXT    NOT NULL,
  products      TEXT,                                -- JSON array string ["SL207","OL212"]
  quantity      TEXT,                                -- "50-99" | "100-499" | "500-999" | "1000+"
  deadline      TEXT,
  purpose       TEXT,
  customer_note TEXT,
  status        TEXT    NOT NULL DEFAULT 'new',      -- new | contacted | quoted | deal | lost
  internal_note TEXT,
  assigned_to   INTEGER,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assigned_to) REFERENCES admin_users(id)
);
CREATE INDEX IF NOT EXISTS idx_b2b_status  ON b2b_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_b2b_created ON b2b_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_phone   ON b2b_inquiries(phone);
