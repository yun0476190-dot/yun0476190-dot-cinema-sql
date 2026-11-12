// =============================================================
//  資料庫結構（CREATE TABLE）與樣本資料（INSERT）
//  網頁載入時，會在瀏覽器裡用 sql.js（SQLite）執行這兩段 SQL，
//  建立一個只存在於瀏覽器記憶體中的資料庫。
// =============================================================

const SCHEMA_SQL = `-- 電影
CREATE TABLE movies (
  movie_id     INTEGER PRIMARY KEY,
  title        TEXT    NOT NULL,
  genre        TEXT    NOT NULL,
  rating       TEXT    NOT NULL CHECK (rating IN ('普遍級', '保護級', '輔12', '輔15', '限制級')),
  runtime_min  INTEGER NOT NULL CHECK (runtime_min > 0),
  release_date TEXT    NOT NULL                 -- YYYY-MM-DD
);

-- 影廳
CREATE TABLE halls (
  hall_id   INTEGER PRIMARY KEY,
  hall_name TEXT NOT NULL UNIQUE,
  hall_type TEXT NOT NULL CHECK (hall_type IN ('一般', 'IMAX'))
);

-- 座位：實體座位屬於「影廳」，不屬於「場次」
CREATE TABLE seats (
  seat_id  INTEGER PRIMARY KEY,
  hall_id  INTEGER NOT NULL REFERENCES halls (hall_id),
  seat_row TEXT    NOT NULL,                    -- 排：A、B、C…
  seat_no  INTEGER NOT NULL,                    -- 號：1、2、3…
  UNIQUE (hall_id, seat_row, seat_no)           -- 同一廳不會有兩個 C3
);

-- 場次：哪部電影、在哪一廳、幾點播
CREATE TABLE showtimes (
  showtime_id INTEGER PRIMARY KEY,
  movie_id    INTEGER NOT NULL REFERENCES movies (movie_id),
  hall_id     INTEGER NOT NULL REFERENCES halls (hall_id),
  start_time  TEXT    NOT NULL,                 -- YYYY-MM-DD HH:MM
  price       INTEGER NOT NULL CHECK (price > 0) -- 這場的全票定價
);

-- 會員
CREATE TABLE members (
  member_id INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  phone     TEXT,                               -- 可為 NULL：沒留電話
  level     TEXT NOT NULL DEFAULT '一般' CHECK (level IN ('一般', '金卡')),
  join_date TEXT NOT NULL
);

-- 訂單：一筆訂單可以買多張票
CREATE TABLE orders (
  order_id   INTEGER PRIMARY KEY,
  member_id  INTEGER REFERENCES members (member_id), -- 可為 NULL：現場購票的非會員
  order_time TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('網路', '現場'))
);

-- 票：連接「場次」與「座位」的中間表
CREATE TABLE tickets (
  ticket_id   INTEGER PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders (order_id),
  showtime_id INTEGER NOT NULL REFERENCES showtimes (showtime_id),
  seat_id     INTEGER NOT NULL REFERENCES seats (seat_id),
  ticket_type TEXT    NOT NULL CHECK (ticket_type IN ('全票', '學生票', '優待票')),
  price_paid  INTEGER NOT NULL CHECK (price_paid >= 0), -- 實付金額
  UNIQUE (showtime_id, seat_id)                 -- 同一場次、同一座位只能賣一次
);`;

const SEED_SQL = `INSERT INTO movies (movie_id, title, genre, rating, runtime_min, release_date) VALUES
  (1, '深海信號',     '科幻', '輔12',   128, '2026-11-06'),
  (2, '午夜便利店',   '喜劇', '普遍級', 102, '2026-10-30'),
  (3, '雲端之上的貓', '動畫', '普遍級',  95, '2026-11-13'),
  (4, '最後一班捷運', '驚悚', '輔15',   110, '2026-10-23'),
  (5, '夏日的約定',   '愛情', '保護級', 118, '2026-11-13'),
  (6, '鋼鐵山脈',     '動作', '輔12',   135, '2026-12-04');  -- 即將上映，還沒排場次

INSERT INTO halls (hall_id, hall_name, hall_type) VALUES
  (1, '1廳', '一般'),
  (2, '2廳', '一般'),
  (3, '3廳', 'IMAX');

-- 1廳、2廳：A–C 排 × 1–5 號（各 15 位）；3廳 IMAX：A–D 排 × 1–5 號（20 位）
INSERT INTO seats (seat_id, hall_id, seat_row, seat_no) VALUES
  ( 1, 1, 'A', 1), ( 2, 1, 'A', 2), ( 3, 1, 'A', 3), ( 4, 1, 'A', 4), ( 5, 1, 'A', 5),
  ( 6, 1, 'B', 1), ( 7, 1, 'B', 2), ( 8, 1, 'B', 3), ( 9, 1, 'B', 4), (10, 1, 'B', 5),
  (11, 1, 'C', 1), (12, 1, 'C', 2), (13, 1, 'C', 3), (14, 1, 'C', 4), (15, 1, 'C', 5),
  (16, 2, 'A', 1), (17, 2, 'A', 2), (18, 2, 'A', 3), (19, 2, 'A', 4), (20, 2, 'A', 5),
  (21, 2, 'B', 1), (22, 2, 'B', 2), (23, 2, 'B', 3), (24, 2, 'B', 4), (25, 2, 'B', 5),
  (26, 2, 'C', 1), (27, 2, 'C', 2), (28, 2, 'C', 3), (29, 2, 'C', 4), (30, 2, 'C', 5),
  (31, 3, 'A', 1), (32, 3, 'A', 2), (33, 3, 'A', 3), (34, 3, 'A', 4), (35, 3, 'A', 5),
  (36, 3, 'B', 1), (37, 3, 'B', 2), (38, 3, 'B', 3), (39, 3, 'B', 4), (40, 3, 'B', 5),
  (41, 3, 'C', 1), (42, 3, 'C', 2), (43, 3, 'C', 3), (44, 3, 'C', 4), (45, 3, 'C', 5),
  (46, 3, 'D', 1), (47, 3, 'D', 2), (48, 3, 'D', 3), (49, 3, 'D', 4), (50, 3, 'D', 5);

INSERT INTO showtimes (showtime_id, movie_id, hall_id, start_time, price) VALUES
  (1, 1, 3, '2026-11-20 19:00', 380),
  (2, 1, 3, '2026-11-21 14:00', 380),
  (3, 2, 1, '2026-11-20 20:00', 280),
  (4, 3, 2, '2026-11-21 10:30', 220),  -- 早場優惠
  (5, 3, 2, '2026-11-21 13:00', 280),
  (6, 4, 1, '2026-11-20 22:30', 280),
  (7, 5, 2, '2026-11-20 19:30', 280),
  (8, 5, 1, '2026-11-22 11:00', 220),  -- 早場，目前還沒賣出任何票
  (9, 2, 1, '2026-11-21 16:00', 280);

INSERT INTO members (member_id, name, phone, level, join_date) VALUES
  (1, '陳怡君', '0912-000-101', '金卡', '2024-03-15'),
  (2, '林冠宇', '0912-000-102', '一般', '2025-01-08'),
  (3, '黃詩涵', NULL,           '一般', '2025-06-20'),
  (4, '張家豪', '0912-000-104', '金卡', '2023-11-02'),
  (5, '李佳穎', '0912-000-105', '一般', '2026-02-14'),
  (6, '王柏翰', NULL,           '一般', '2026-09-01'),  -- 加入後沒買過票
  (7, '吳欣妤', '0912-000-107', '一般', '2026-10-10'),
  (8, '劉宗翰', '0912-000-108', '金卡', '2024-08-30'),
  (9, '蔡宜蓁', '0912-000-109', '一般', '2026-11-02');  -- 加入後沒買過票

INSERT INTO orders (order_id, member_id, order_time, channel) VALUES
  ( 1, 1,    '2026-11-15 21:03', '網路'),
  ( 2, 2,    '2026-11-16 12:20', '網路'),
  ( 3, 4,    '2026-11-17 09:15', '網路'),
  ( 4, 8,    '2026-11-18 13:30', '網路'),
  ( 5, 5,    '2026-11-18 20:45', '網路'),
  ( 6, 3,    '2026-11-19 08:50', '網路'),
  ( 7, 4,    '2026-11-19 19:00', '網路'),
  ( 8, 1,    '2026-11-19 22:10', '網路'),
  ( 9, 2,    '2026-11-20 10:00', '網路'),
  (10, NULL, '2026-11-20 17:55', '現場'),  -- 非會員
  (11, NULL, '2026-11-20 18:40', '現場'),
  (12, NULL, '2026-11-20 18:50', '現場'),
  (13, NULL, '2026-11-20 22:05', '現場'),
  (14, 8,    '2026-11-21 09:00', '網路'),
  (15, NULL, '2026-11-21 12:40', '現場'),
  (16, 7,    '2026-11-21 15:20', '現場');

-- 全票 = 場次定價；學生票 = 定價 − 40；優待票 = 定價的一半
INSERT INTO tickets (ticket_id, order_id, showtime_id, seat_id, ticket_type, price_paid) VALUES
  ( 1,  1, 1, 43, '全票',   380),  -- 3廳 C3
  ( 2,  1, 1, 44, '全票',   380),  -- 3廳 C4
  ( 3,  2, 1, 47, '學生票', 340),  -- 3廳 D2
  ( 4,  3, 3,  7, '全票',   280),  -- 1廳 B2
  ( 5,  3, 3,  8, '全票',   280),  -- 1廳 B3
  ( 6,  4, 7, 23, '全票',   280),  -- 2廳 B3
  ( 7,  4, 7, 24, '全票',   280),  -- 2廳 B4
  ( 8,  5, 4, 16, '全票',   220),  -- 2廳 A1
  ( 9,  5, 4, 17, '優待票', 110),  -- 2廳 A2
  (10,  5, 4, 18, '優待票', 110),  -- 2廳 A3
  (11,  6, 5, 22, '學生票', 240),  -- 2廳 B2
  (12,  6, 5, 23, '學生票', 240),  -- 2廳 B3
  (13,  7, 2, 44, '全票',   380),  -- 3廳 C4
  (14,  7, 2, 45, '全票',   380),  -- 3廳 C5
  (15,  8, 2, 43, '全票',   380),  -- 3廳 C3
  (16,  9, 6, 14, '學生票', 240),  -- 1廳 C4
  (17,  9, 6, 15, '全票',   280),  -- 1廳 C5
  (18, 10, 1, 32, '全票',   380),  -- 3廳 A2
  (19, 10, 1, 33, '全票',   380),  -- 3廳 A3
  (20, 10, 1, 34, '全票',   380),  -- 3廳 A4
  (21, 10, 1, 35, '全票',   380),  -- 3廳 A5
  (22, 11, 1, 36, '全票',   380),  -- 3廳 B1
  (23, 11, 1, 37, '全票',   380),  -- 3廳 B2
  (24, 11, 1, 38, '全票',   380),  -- 3廳 B3
  (25, 12, 1, 48, '學生票', 340),  -- 3廳 D3
  (26, 12, 1, 49, '學生票', 340),  -- 3廳 D4
  (27, 13, 6, 11, '全票',   280),  -- 1廳 C1
  (28, 14, 9,  8, '全票',   280),  -- 1廳 B3
  (29, 15, 5, 16, '優待票', 140),  -- 2廳 A1
  (30, 16, 9,  1, '全票',   280);  -- 1廳 A1`;

// 欄位說明（顯示在「資料庫設計」區塊）
const TABLE_DOCS = [
  {
    name: 'movies', zh: '電影',
    desc: '影城正在上映與即將上映的電影。',
    columns: [
      ['movie_id', 'INTEGER', 'PK', '電影編號'],
      ['title', 'TEXT', 'NOT NULL', '片名'],
      ['genre', 'TEXT', 'NOT NULL', '類型，例如科幻、動畫、喜劇'],
      ['rating', 'TEXT', 'NOT NULL、CHECK', '分級：普遍級、保護級、輔12、輔15、限制級'],
      ['runtime_min', 'INTEGER', 'NOT NULL、CHECK > 0', '片長（分鐘）'],
      ['release_date', 'TEXT', 'NOT NULL', '上映日期（YYYY-MM-DD）'],
    ],
  },
  {
    name: 'halls', zh: '影廳',
    desc: '影城的三個放映廳。',
    columns: [
      ['hall_id', 'INTEGER', 'PK', '影廳編號'],
      ['hall_name', 'TEXT', 'NOT NULL、UNIQUE', '廳名'],
      ['hall_type', 'TEXT', 'NOT NULL、CHECK', '廳別：一般、IMAX'],
    ],
  },
  {
    name: 'seats', zh: '座位',
    desc: '每個影廳的實體座位。座位屬於影廳，不會因為場次不同而改變。',
    columns: [
      ['seat_id', 'INTEGER', 'PK', '座位編號'],
      ['hall_id', 'INTEGER', 'FK → halls', '這個座位在哪一廳'],
      ['seat_row', 'TEXT', 'NOT NULL', '排（A、B、C…）'],
      ['seat_no', 'INTEGER', 'NOT NULL', '號（1、2、3…）'],
    ],
    note: 'UNIQUE (hall_id, seat_row, seat_no)：同一廳不會出現兩個 C3。',
  },
  {
    name: 'showtimes', zh: '場次',
    desc: '某部電影在某個影廳、某個時間的一次放映。',
    columns: [
      ['showtime_id', 'INTEGER', 'PK', '場次編號'],
      ['movie_id', 'INTEGER', 'FK → movies', '放映哪部電影'],
      ['hall_id', 'INTEGER', 'FK → halls', '在哪一廳放映'],
      ['start_time', 'TEXT', 'NOT NULL', '開演時間（YYYY-MM-DD HH:MM）'],
      ['price', 'INTEGER', 'NOT NULL、CHECK > 0', '這一場的全票定價'],
    ],
  },
  {
    name: 'members', zh: '會員',
    desc: '加入影城會員的觀眾。',
    columns: [
      ['member_id', 'INTEGER', 'PK', '會員編號'],
      ['name', 'TEXT', 'NOT NULL', '姓名'],
      ['phone', 'TEXT', '可為 NULL', '手機；沒留電話的會員是 NULL'],
      ['level', 'TEXT', 'NOT NULL、CHECK', '會員等級：一般、金卡（預設一般）'],
      ['join_date', 'TEXT', 'NOT NULL', '加入日期'],
    ],
  },
  {
    name: 'orders', zh: '訂單',
    desc: '一次結帳就是一筆訂單，一筆訂單可以包含多張票。',
    columns: [
      ['order_id', 'INTEGER', 'PK', '訂單編號'],
      ['member_id', 'INTEGER', 'FK → members，可為 NULL', '下訂的會員；現場購票的非會員是 NULL'],
      ['order_time', 'TEXT', 'NOT NULL', '下訂時間'],
      ['channel', 'TEXT', 'NOT NULL、CHECK', '購票管道：網路、現場'],
    ],
  },
  {
    name: 'tickets', zh: '票',
    desc: '一張票 = 某個場次的某個座位。它是連接「場次」與「座位」的中間表。',
    columns: [
      ['ticket_id', 'INTEGER', 'PK', '票券編號'],
      ['order_id', 'INTEGER', 'FK → orders', '屬於哪一筆訂單'],
      ['showtime_id', 'INTEGER', 'FK → showtimes', '哪一個場次'],
      ['seat_id', 'INTEGER', 'FK → seats', '哪一個座位'],
      ['ticket_type', 'TEXT', 'NOT NULL、CHECK', '票種：全票、學生票、優待票'],
      ['price_paid', 'INTEGER', 'NOT NULL、CHECK ≥ 0', '實際付款金額'],
    ],
    note: 'UNIQUE (showtime_id, seat_id)：同一場次、同一座位只能賣一次，資料庫直接擋下重複劃位。',
  },
];
