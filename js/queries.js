// =============================================================
//  查詢題目（QUESTIONS）與結果比較（COMPARISONS）
//  「預期結果」是網頁載入時執行每題的參考 SQL 算出來的。
// =============================================================

const QUESTIONS = [
  {
    id: 'q1',
    who: '排片經理',
    title: '闔家觀賞片單',
    question: '週末早場想排適合全家人看的電影。列出「普遍級」或「保護級」的電影，顯示片名、類型、分級、片長，依片長由長到短排序。',
    tags: ['WHERE', 'IN', 'ORDER BY'],
    sql: `SELECT title, genre, rating, runtime_min
FROM movies
WHERE rating IN ('普遍級', '保護級')
ORDER BY runtime_min DESC;`,
    explain: `<code>IN ('普遍級', '保護級')</code> 等於 <code>rating = '普遍級' OR rating = '保護級'</code>，值比較多時更好讀。
<code>ORDER BY runtime_min DESC</code> 讓片長由大到小排列，<code>ASC</code>（預設）則是由小到大。`,
  },
  {
    id: 'q2',
    who: '售票人員',
    title: '11/20（五）場次表',
    question: '列出 2026-11-20 當天所有場次的開演時間、片名、影廳與票價，依開演時間排序。',
    tags: ['JOIN', 'date()', 'ORDER BY'],
    sql: `SELECT s.start_time, m.title, h.hall_name, h.hall_type, s.price
FROM showtimes AS s
JOIN movies AS m ON m.movie_id = s.movie_id
JOIN halls  AS h ON h.hall_id  = s.hall_id
WHERE date(s.start_time) = '2026-11-20'
ORDER BY s.start_time;`,
    explain: `<code>showtimes</code> 只存了 <code>movie_id</code> 和 <code>hall_id</code> 這兩個外鍵，所以要 JOIN <code>movies</code> 和 <code>halls</code> 才拿得到片名和廳名。
<code>date(s.start_time)</code> 把「2026-11-20 19:00」裁成「2026-11-20」，再拿來比對日期。`,
  },
  {
    id: 'q3',
    who: '排片經理',
    title: '各電影票房排行',
    question: '每部電影一共賣出幾張票？票房（實收金額）多少？依票房由高到低排序。',
    tags: ['JOIN', 'GROUP BY', 'COUNT', 'SUM'],
    sql: `SELECT m.title,
       COUNT(t.ticket_id) AS 售出張數,
       SUM(t.price_paid)  AS 票房
FROM movies AS m
JOIN showtimes AS s ON s.movie_id    = m.movie_id
JOIN tickets   AS t ON t.showtime_id = s.showtime_id
GROUP BY m.movie_id, m.title
ORDER BY 票房 DESC;`,
    explain: `三張表 JOIN 起來後，每一張票是一列。<code>GROUP BY</code> 把同一部電影的票收成一組，
<code>COUNT</code> 算張數，<code>SUM</code> 把實付金額加起來。
注意這裡用的是 INNER JOIN，還沒賣出任何票的電影不會出現（見「比較 1」）。`,
  },
  {
    id: 'q4',
    who: '排片經理',
    title: '各場次上座率',
    question: '每個場次賣了幾張票？佔該廳座位數的百分之幾？依上座率由高到低排序，沒人買的場次也要列出來。',
    tags: ['LEFT JOIN', '子查詢', 'GROUP BY', 'ROUND'],
    sql: `SELECT s.showtime_id,
       s.start_time,
       m.title,
       h.hall_name,
       COUNT(t.ticket_id) AS 已售,
       c.capacity         AS 座位數,
       ROUND(100.0 * COUNT(t.ticket_id) / c.capacity, 1) AS 上座率
FROM showtimes AS s
JOIN movies AS m ON m.movie_id = s.movie_id
JOIN halls  AS h ON h.hall_id  = s.hall_id
JOIN (SELECT hall_id, COUNT(*) AS capacity
      FROM seats
      GROUP BY hall_id) AS c ON c.hall_id = s.hall_id
LEFT JOIN tickets AS t ON t.showtime_id = s.showtime_id
GROUP BY s.showtime_id
ORDER BY 上座率 DESC, s.start_time;`,
    explain: `括號裡的子查詢先算出「每個廳有幾個座位」，再當成一張暫時的表 <code>c</code> 來 JOIN。
<code>LEFT JOIN tickets</code> 讓 0 張票的場次也留下來，這時 <code>COUNT(t.ticket_id)</code> 會是 0。
乘上 <code>100.0</code>（小數）是為了避免整數除法：如果寫成 <code>COUNT(...) / c.capacity</code>，12 / 20 會得到 0。`,
  },
  {
    id: 'q5',
    who: '售票人員',
    title: '這一場還有哪些空位？',
    question: '客人想買 11/20 19:00《深海信號》（場次 1，3廳 IMAX）的票。列出這一場所有還沒賣出的座位。',
    tags: ['LEFT JOIN', 'IS NULL', '子查詢'],
    sql: `SELECT se.seat_row || se.seat_no AS 座位
FROM seats AS se
LEFT JOIN tickets AS t
       ON t.seat_id = se.seat_id
      AND t.showtime_id = 1
WHERE se.hall_id = (SELECT hall_id
                    FROM showtimes
                    WHERE showtime_id = 1)
  AND t.ticket_id IS NULL
ORDER BY se.seat_row, se.seat_no;`,
    explain: `空位 = 這一廳的全部座位 − 這一場已經賣出的座位。
<code>LEFT JOIN</code> 拿每個座位去配對「場次 1 的票」，配不到票的座位（<code>t.ticket_id IS NULL</code>）就是空位。
「場次 1」這個條件一定要寫在 <code>ON</code> 裡，寫到 <code>WHERE</code> 結果就會整個不見（見「比較 2」）。
<code>||</code> 是 SQLite 的字串串接，把「C」和「3」接成「C3」。`,
  },
  {
    id: 'q6',
    who: '行銷人員',
    title: '高消費會員',
    question: '找出累計消費超過 500 元的會員，顯示會員等級、訂單數、票數與總消費，依總消費由高到低排序。',
    tags: ['GROUP BY', 'HAVING', 'COUNT(DISTINCT)'],
    sql: `SELECT mb.name  AS 會員,
       mb.level AS 等級,
       COUNT(DISTINCT o.order_id) AS 訂單數,
       COUNT(t.ticket_id)         AS 票數,
       SUM(t.price_paid)          AS 總消費
FROM members AS mb
JOIN orders  AS o ON o.member_id = mb.member_id
JOIN tickets AS t ON t.order_id  = o.order_id
GROUP BY mb.member_id, mb.name, mb.level
HAVING SUM(t.price_paid) > 500
ORDER BY 總消費 DESC;`,
    explain: `要先 <code>GROUP BY</code> 會員，才算得出每個人的總消費，所以「總消費 &gt; 500」只能寫在 <code>HAVING</code>（見「比較 5」）。
訂單數用 <code>COUNT(DISTINCT o.order_id)</code>，因為 JOIN 到 tickets 之後，一筆訂單有幾張票就會重複出現幾次。`,
  },
  {
    id: 'q7',
    who: '行銷人員',
    title: '加入後從沒買過票的會員',
    question: '行銷想寄「首購優惠券」給加入會員後一張票都沒買過的人。請找出這些會員。',
    tags: ['LEFT JOIN', 'IS NULL'],
    sql: `SELECT mb.member_id, mb.name, mb.join_date
FROM members AS mb
LEFT JOIN orders AS o ON o.member_id = mb.member_id
WHERE o.order_id IS NULL;`,
    explain: `<code>LEFT JOIN</code> 會保留所有會員；沒有任何訂單的會員，右邊 <code>orders</code> 的欄位全部是 NULL，
所以用 <code>o.order_id IS NULL</code> 就能把他們挑出來。
直覺寫成 <code>NOT IN</code> 反而會出錯，原因見「比較 3」。`,
  },
  {
    id: 'q8',
    who: '行銷人員',
    title: '看過兩部以上不同電影的影迷',
    question: '找出至少看過 2 部「不同」電影的會員（同一部看兩次只算一部），顯示看過幾部。',
    tags: ['多表 JOIN', 'COUNT(DISTINCT)', 'HAVING'],
    sql: `SELECT mb.name AS 會員,
       COUNT(DISTINCT s.movie_id) AS 看過幾部電影
FROM members   AS mb
JOIN orders    AS o ON o.member_id   = mb.member_id
JOIN tickets   AS t ON t.order_id    = o.order_id
JOIN showtimes AS s ON s.showtime_id = t.showtime_id
GROUP BY mb.member_id, mb.name
HAVING COUNT(DISTINCT s.movie_id) >= 2
ORDER BY 看過幾部電影 DESC, mb.member_id;`,
    explain: `會員 → 訂單 → 票 → 場次，一路 JOIN 到 <code>showtimes</code> 才知道每張票是哪部電影。
同一部電影看兩次、或一次買兩張，都會變成好幾列，所以要用 <code>COUNT(DISTINCT s.movie_id)</code> 先去掉重複再計數（見「比較 4」）。`,
  },
];

const COMPARISONS = [
  {
    id: 'c1',
    title: 'INNER JOIN 改成 LEFT JOIN',
    scenario: '延續 Q3「各電影票房」：排片經理想看「所有」電影的票房，包含還沒開賣的電影。',
    change: '把兩個 <code>JOIN</code> 都改成 <code>LEFT JOIN</code>。',
    before: {
      label: 'INNER JOIN',
      sql: `SELECT m.title,
       COUNT(t.ticket_id) AS 售出張數,
       SUM(t.price_paid)  AS 票房
FROM movies AS m
JOIN showtimes AS s ON s.movie_id    = m.movie_id
JOIN tickets   AS t ON t.showtime_id = s.showtime_id
GROUP BY m.movie_id, m.title
ORDER BY 票房 DESC;`,
    },
    after: {
      label: 'LEFT JOIN',
      sql: `SELECT m.title,
       COUNT(t.ticket_id) AS 售出張數,
       SUM(t.price_paid)  AS 票房
FROM movies AS m
LEFT JOIN showtimes AS s ON s.movie_id    = m.movie_id
LEFT JOIN tickets   AS t ON t.showtime_id = s.showtime_id
GROUP BY m.movie_id, m.title
ORDER BY 票房 DESC;`,
    },
    diff: '從 5 列變成 6 列，多了《鋼鐵山脈》：售出張數 0，票房是 NULL。',
    reason: `INNER JOIN 只留下兩邊都配對得到的資料。《鋼鐵山脈》12/4 才上映、還沒排場次，在 showtimes 裡找不到它，所以整列被丟掉。
LEFT JOIN 會保留左邊（movies）的每一列，配不到的欄位補 NULL。
<code>COUNT(t.ticket_id)</code> 不計算 NULL，所以是 0；<code>SUM</code> 遇到全部都是 NULL 時結果也是 NULL。想顯示成 0 可以寫 <code>COALESCE(SUM(t.price_paid), 0)</code>。
注意：只改第一個 JOIN 沒用，第二個 INNER JOIN 會再把 NULL 那列濾掉。`,
  },
  {
    id: 'c2',
    title: '條件寫在 ON 還是 WHERE',
    scenario: '延續 Q5「這一場還有哪些空位」：把「場次 1」這個條件從 ON 搬到 WHERE。',
    change: '把 <code>AND t.showtime_id = 1</code> 從 <code>ON</code> 子句移到 <code>WHERE</code> 子句。',
    before: {
      label: '條件在 ON',
      sql: `SELECT se.seat_row || se.seat_no AS 座位
FROM seats AS se
LEFT JOIN tickets AS t
       ON t.seat_id = se.seat_id
      AND t.showtime_id = 1
WHERE se.hall_id = (SELECT hall_id
                    FROM showtimes
                    WHERE showtime_id = 1)
  AND t.ticket_id IS NULL
ORDER BY se.seat_row, se.seat_no;`,
    },
    after: {
      label: '條件在 WHERE',
      sql: `SELECT se.seat_row || se.seat_no AS 座位
FROM seats AS se
LEFT JOIN tickets AS t
       ON t.seat_id = se.seat_id
WHERE se.hall_id = (SELECT hall_id
                    FROM showtimes
                    WHERE showtime_id = 1)
  AND t.showtime_id = 1
  AND t.ticket_id IS NULL
ORDER BY se.seat_row, se.seat_no;`,
    },
    diff: '從 8 個空位變成 0 列，看起來像是「全部賣完」，但事實上還有 8 個空位。',
    reason: `執行順序是先 JOIN（依照 ON 配對），再用 WHERE 篩選。
條件寫在 ON：只拿「場次 1 的票」來配對，沒被這一場買走的座位配不到票，t 的欄位是 NULL，剛好被 <code>IS NULL</code> 挑出來。
條件寫在 WHERE：先拿「所有場次的票」配對，再篩選。空位那幾列的 <code>t.showtime_id</code> 是 NULL，<code>NULL = 1</code> 不成立，被刪掉；
已售出的座位雖然 <code>showtime_id = 1</code>，但 <code>ticket_id IS NULL</code> 不成立，也被刪掉，最後一列都不剩。
延伸：如果完全忘了寫場次條件，會得到 7 列，少了 C5，因為 C5 在「場次 2」被賣掉了。這種看起來很合理的錯誤最危險，可以自己改改看。`,
  },
  {
    id: 'c3',
    title: 'NOT IN 遇到 NULL',
    scenario: '延續 Q7「從沒買過票的會員」：很多人直覺會用 NOT IN 來寫。',
    change: '把 LEFT JOIN + IS NULL 改寫成 <code>WHERE member_id NOT IN (SELECT member_id FROM orders)</code>。',
    before: {
      label: 'LEFT JOIN + IS NULL',
      sql: `SELECT mb.member_id, mb.name, mb.join_date
FROM members AS mb
LEFT JOIN orders AS o ON o.member_id = mb.member_id
WHERE o.order_id IS NULL;`,
    },
    after: {
      label: 'NOT IN',
      sql: `SELECT member_id, name, join_date
FROM members
WHERE member_id NOT IN (SELECT member_id FROM orders);`,
    },
    diff: '從 2 位會員（王柏翰、蔡宜蓁）變成 0 列，而且不會出現任何錯誤訊息。',
    reason: `orders 裡有 5 筆現場訂單的 <code>member_id</code> 是 NULL（非會員）。
<code>x NOT IN (1, 2, NULL)</code> 等於 <code>x &lt;&gt; 1 AND x &lt;&gt; 2 AND x &lt;&gt; NULL</code>。
任何值跟 NULL 比較的結果都是「未知」（UNKNOWN），不是 TRUE，所以整個條件永遠不會成立，一列都不會回傳。
修正方法：在子查詢加上 <code>WHERE member_id IS NOT NULL</code>，或改用 <code>NOT EXISTS</code> 或 LEFT JOIN。`,
  },
  {
    id: 'c4',
    title: 'COUNT 與 COUNT(DISTINCT)',
    scenario: '延續 Q8「看過兩部以上不同電影的影迷」：拿掉 DISTINCT 會怎樣？',
    change: '把 SELECT 和 HAVING 裡的 <code>COUNT(DISTINCT s.movie_id)</code> 都改成 <code>COUNT(s.movie_id)</code>。',
    before: {
      label: 'COUNT(DISTINCT)',
      sql: `SELECT mb.name AS 會員,
       COUNT(DISTINCT s.movie_id) AS 看過幾部電影
FROM members   AS mb
JOIN orders    AS o ON o.member_id   = mb.member_id
JOIN tickets   AS t ON t.order_id    = o.order_id
JOIN showtimes AS s ON s.showtime_id = t.showtime_id
GROUP BY mb.member_id, mb.name
HAVING COUNT(DISTINCT s.movie_id) >= 2
ORDER BY 看過幾部電影 DESC, mb.member_id;`,
    },
    after: {
      label: 'COUNT',
      sql: `SELECT mb.name AS 會員,
       COUNT(s.movie_id) AS 看過幾部電影
FROM members   AS mb
JOIN orders    AS o ON o.member_id   = mb.member_id
JOIN tickets   AS t ON t.order_id    = o.order_id
JOIN showtimes AS s ON s.showtime_id = t.showtime_id
GROUP BY mb.member_id, mb.name
HAVING COUNT(s.movie_id) >= 2
ORDER BY 看過幾部電影 DESC, mb.member_id;`,
    },
    diff: '從 3 位變成 6 位。陳怡君、黃詩涵、李佳穎只看過一部電影，卻被算成「3 部」或「2 部」。',
    reason: `JOIN 到 tickets 之後，每一張票是一列。陳怡君分兩個場次買了 3 張《深海信號》，所以她有 3 列，movie_id 都是 1。
<code>COUNT(s.movie_id)</code> 算的是列數（也就是票數）3；<code>COUNT(DISTINCT s.movie_id)</code> 先把重複的 1 去掉，只剩 1 部。
同樣地，李佳穎一次買了 3 張《雲端之上的貓》（親子票），黃詩涵買了 2 張學生票，都被誤判成影迷。`,
  },
  {
    id: 'c5',
    title: 'HAVING 改成 WHERE',
    scenario: '延續 Q6「高消費會員」：把「總消費 > 500」寫在 WHERE 會怎樣？',
    change: '把 <code>HAVING SUM(t.price_paid) &gt; 500</code> 改成寫在 GROUP BY 前面的 <code>WHERE SUM(t.price_paid) &gt; 500</code>。',
    before: {
      label: 'HAVING',
      sql: `SELECT mb.name AS 會員,
       SUM(t.price_paid) AS 總消費
FROM members AS mb
JOIN orders  AS o ON o.member_id = mb.member_id
JOIN tickets AS t ON t.order_id  = o.order_id
GROUP BY mb.member_id, mb.name
HAVING SUM(t.price_paid) > 500
ORDER BY 總消費 DESC;`,
    },
    after: {
      label: 'WHERE',
      sql: `SELECT mb.name AS 會員,
       SUM(t.price_paid) AS 總消費
FROM members AS mb
JOIN orders  AS o ON o.member_id = mb.member_id
JOIN tickets AS t ON t.order_id  = o.order_id
WHERE SUM(t.price_paid) > 500
GROUP BY mb.member_id, mb.name
ORDER BY 總消費 DESC;`,
    },
    diff: '原本回傳 4 位會員；改了之後直接出現錯誤：<code>misuse of aggregate: SUM()</code>。',
    reason: `SQL 的邏輯執行順序是 FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY。
WHERE 執行的時候還沒有分組，資料還是一張一張的票，根本沒有「每位會員的總和」可以比較，所以聚合函數（SUM、COUNT…）不能寫在 WHERE。
HAVING 在分組之後才執行，專門用來篩選「組」。
補充：<code>WHERE t.price_paid &gt; 300</code> 是合法的，但意思完全不同，變成「只加總單價超過 300 的票」。`,
  },
];
