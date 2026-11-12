// =============================================================
//  網頁互動邏輯
//  1. 載入 sql.js，執行 data.js 的 SQL，建立資料庫
//  2. 產生欄位說明、樣本資料、查詢題目、結果比較、自由練習
// =============================================================
(function () {
  'use strict';

  const SQLJS_CDN = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';
  const TABLES = ['movies', 'halls', 'seats', 'showtimes', 'members', 'orders', 'tickets'];

  const state = {
    SQL: null,       // sql.js 模組
    pristine: null,  // 初始資料庫的二進位快照，每次執行都從這裡複製一份
    playDb: null,    // 自由練習用的資料庫（會保留修改）
  };

  // ---------- 小工具 ----------
  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 解說文字以換行分段（內容是本檔案作者寫的 HTML，不是使用者輸入）
  function paragraphs(text) {
    return text.split('\n').map((line) => `<p>${line}</p>`).join('');
  }

  function showStatus(kind, message) {
    const el = $('#db-status');
    el.className = 'db-status ' + kind;
    el.textContent = message;
  }

  // ---------- 資料庫 ----------
  function freshDb() {
    const db = new state.SQL.Database(state.pristine);
    db.run('PRAGMA foreign_keys = ON;');
    return db;
  }

  function totalChanges(db) {
    return db.exec('SELECT total_changes();')[0].values[0][0];
  }

  // 逐句執行 SQL。和 db.exec() 不同的是：SELECT 查不到資料時，仍然保留欄位名稱（顯示「0 列」）。
  function execSql(db, sql) {
    const start = performance.now();
    const results = [];
    try {
      const before = totalChanges(db);
      for (const stmt of db.iterateStatements(sql)) {
        try {
          const columns = stmt.getColumnNames();
          if (columns.length > 0) {
            const values = [];
            while (stmt.step()) values.push(stmt.get());
            results.push({ columns, values });
          } else {
            while (stmt.step()) { /* INSERT / UPDATE / DELETE / CREATE… */ }
          }
        } finally {
          stmt.free();
        }
      }
      return { ok: true, results, changes: totalChanges(db) - before, ms: performance.now() - start };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err), ms: performance.now() - start };
    }
  }

  // 在一份全新的資料庫副本上執行，不會影響其他題目
  function runIsolated(sql) {
    const db = freshDb();
    try {
      return execSql(db, sql);
    } finally {
      db.close();
    }
  }

  function lastResult(outcome) {
    if (!outcome.ok || outcome.results.length === 0) return null;
    return outcome.results[outcome.results.length - 1];
  }

  // ---------- 結果呈現 ----------
  function formatValue(value) {
    if (value instanceof Uint8Array) return `[BLOB ${value.length} bytes]`;
    return value;
  }

  function renderTable(result, opts = {}) {
    const numeric = result.columns.map((_, i) => {
      const nonNull = result.values.map((row) => row[i]).filter((v) => v !== null);
      return nonNull.length > 0 && nonNull.every((v) => typeof v === 'number');
    });
    const head = result.columns
      .map((col, i) => `<th${numeric[i] ? ' class="num"' : ''}>${escapeHtml(col)}</th>`)
      .join('');
    let body;
    if (result.values.length === 0) {
      body = `<tr><td class="empty" colspan="${result.columns.length}">（沒有符合條件的資料）</td></tr>`;
    } else {
      body = result.values
        .map((row) => '<tr>' + row.map((v, i) => {
          if (v === null) return '<td class="null">NULL</td>';
          return `<td${numeric[i] ? ' class="num"' : ''}>${escapeHtml(formatValue(v))}</td>`;
        }).join('') + '</tr>')
        .join('');
    }
    return `<div class="table-scroll${opts.tall ? ' tall' : ''}"><table class="result-table">` +
      `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderOutcome(target, outcome) {
    if (!outcome.ok) {
      target.innerHTML = `<div class="error-box" role="alert"><span class="error-title">SQL 執行錯誤</span>` +
        `<code>${escapeHtml(outcome.error)}</code></div>`;
      return;
    }
    const changes = outcome.changes > 0 ? `資料異動 ${outcome.changes} 列` : '';
    if (outcome.results.length === 0) {
      target.innerHTML = `<p class="exec-msg">執行成功，沒有回傳資料表${changes ? `（${changes}）` : ''}。</p>`;
      return;
    }
    const multiple = outcome.results.length > 1;
    target.innerHTML = outcome.results.map((result, i) =>
      (multiple ? `<p class="result-label">結果 ${i + 1}</p>` : '') +
      renderTable(result) +
      `<p class="result-meta">${result.values.length} 列</p>`
    ).join('') + (changes ? `<p class="exec-msg">${changes}</p>` : '');
  }

  function compareResults(expected, actual) {
    if (!actual) return { cls: 'bad', text: '沒有回傳資料表' };
    const sameColumns = JSON.stringify(expected.columns) === JSON.stringify(actual.columns);
    const exp = expected.values.map((row) => JSON.stringify(row));
    const act = actual.values.map((row) => JSON.stringify(row));
    if (sameColumns && exp.join('\n') === act.join('\n')) {
      return { cls: 'ok', text: '✓ 與預期結果相同' };
    }
    if (sameColumns && exp.length === act.length &&
        [...exp].sort().join('\n') === [...act].sort().join('\n')) {
      return { cls: 'warn', text: '資料相同，但順序不同' };
    }
    if (!sameColumns) return { cls: 'bad', text: '欄位與預期不同' };
    if (exp.length !== act.length) {
      return { cls: 'bad', text: `與預期不同：預期 ${exp.length} 列，實際 ${act.length} 列` };
    }
    return { cls: 'bad', text: '列數相同，但內容不同' };
  }

  // ---------- 編輯器 ----------
  function setupEditor(textarea, initialSql, onRun) {
    textarea.value = initialSql;
    textarea.setAttribute('wrap', 'off');
    textarea.setAttribute('spellcheck', 'false');
    const fit = () => { textarea.rows = Math.max(4, textarea.value.split('\n').length + 1); };
    fit();
    textarea.addEventListener('input', fit);
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onRun();
      }
    });
    return fit;
  }

  // 找出兩段 SQL 中不同的行（最長共同子序列）
  function lineDiff(a, b) {
    const A = a.split('\n');
    const B = b.split('\n');
    const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) {
      for (let j = B.length - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0;
    let j = 0;
    while (i < A.length && j < B.length) {
      if (A[i] === B[j]) { i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', A[i++]]);
      else out.push(['+', B[j++]]);
    }
    while (i < A.length) out.push(['-', A[i++]]);
    while (j < B.length) out.push(['+', B[j++]]);
    return out;
  }

  // ---------- 各區塊 ----------
  function renderErd() {
    const erd = $('#erd');
    if (!window.mermaid) {
      erd.classList.add('erd-fallback');
      return;
    }
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      er: { useMaxWidth: true },
      themeVariables: {
        fontFamily: v('--font-sans'),
        fontSize: '14px',
        background: v('--surface'),
        primaryColor: v('--surface-2'),
        primaryTextColor: v('--text'),
        primaryBorderColor: v('--accent'),
        secondaryColor: v('--surface'),
        tertiaryColor: v('--surface'),
        mainBkg: v('--surface-2'),
        nodeBorder: v('--accent'),
        lineColor: v('--muted'),
        textColor: v('--text'),
        edgeLabelBackground: v('--surface'),
        attributeBackgroundColorOdd: v('--surface'),
        attributeBackgroundColorEven: v('--surface-2'),
      },
    });
    window.mermaid.run({ nodes: [erd] }).catch(() => erd.classList.add('erd-fallback'));
  }

  function buildSchemaDocs() {
    $('#schema-docs').innerHTML = TABLE_DOCS.map((doc) => {
      const rows = doc.columns.map(([name, type, constraint, desc]) => {
        let c = escapeHtml(constraint);
        c = c.replace(/^PK/, '<span class="key pk">PK</span>').replace(/^FK/, '<span class="key fk">FK</span>');
        return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(type)}</td><td>${c}</td><td>${escapeHtml(desc)}</td></tr>`;
      }).join('');
      return `<article class="card doc-card">
        <h4><code>${doc.name}</code>${escapeHtml(doc.zh)}</h4>
        <p class="doc-desc">${escapeHtml(doc.desc)}</p>
        <div class="table-scroll plain"><table class="doc-table">
          <thead><tr><th>欄位</th><th>型別</th><th>限制</th><th>說明</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${doc.note ? `<p class="doc-note">${escapeHtml(doc.note)}</p>` : ''}
      </article>`;
    }).join('');
    $('#schema-sql').textContent = SCHEMA_SQL;
  }

  function buildStats() {
    const outcome = runIsolated('SELECT COUNT(*) FROM tickets;');
    $('#stat-tickets').textContent = lastResult(outcome).values[0][0];
    $('#stat-tables').textContent = TABLES.length;
    $('#stat-questions').textContent = QUESTIONS.length;
    $('#stat-compare').textContent = COMPARISONS.length;
  }

  function buildSampleData() {
    const tabs = $('#sample-tabs');
    const target = $('#sample-table');
    const db = freshDb();
    const data = {};
    TABLES.forEach((t) => { data[t] = lastResult(execSql(db, `SELECT * FROM ${t};`)); });
    db.close();

    const buttons = TABLES.map((t) => {
      const doc = TABLE_DOCS.find((d) => d.name === t);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.setAttribute('role', 'tab');
      btn.innerHTML = `<span class="tab-en">${t}</span><span class="tab-zh">${escapeHtml(doc.zh)}</span>` +
        `<span class="tab-count">${data[t].values.length}</span>`;
      btn.addEventListener('click', () => select(t));
      tabs.appendChild(btn);
      return btn;
    });

    function select(t) {
      buttons.forEach((b, i) => b.setAttribute('aria-selected', TABLES[i] === t ? 'true' : 'false'));
      target.innerHTML = renderTable(data[t], { tall: true }) +
        `<p class="result-meta">${t} 共 ${data[t].values.length} 列</p>`;
    }
    select('movies');
  }

  function buildQuestions() {
    const list = $('#query-list');
    QUESTIONS.forEach((q, index) => {
      const no = `Q${index + 1}`;
      const card = document.createElement('article');
      card.className = 'card q-card';
      card.id = q.id;
      card.innerHTML = `
        <header class="q-head">
          <span class="q-no">${no}</span>
          <div>
            <p class="q-who">${escapeHtml(q.who)}</p>
            <h3>${escapeHtml(q.title)}</h3>
          </div>
        </header>
        <p class="q-text">${escapeHtml(q.question)}</p>
        <div class="tags">${q.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        <textarea class="sql-editor" aria-label="${no} 的 SQL"></textarea>
        <div class="editor-actions">
          <button class="btn primary" data-action="run" type="button">執行</button>
          <button class="btn ghost" data-action="reset" type="button">還原 SQL</button>
          <span class="hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> 也可以執行</span>
        </div>
        <div class="result-grid">
          <div class="pane">
            <div class="pane-head"><span>預期結果</span></div>
            <div class="pane-body" data-role="expected"></div>
          </div>
          <div class="pane">
            <div class="pane-head"><span>實際結果</span><span class="status" data-role="status"></span></div>
            <div class="pane-body" data-role="actual">
              <p class="placeholder">修改 SQL 後按「執行」，實際結果會顯示在這裡</p>
            </div>
          </div>
        </div>
        <details class="explain">
          <summary>SQL 解說</summary>
          <div class="explain-body">${paragraphs(q.explain)}</div>
        </details>`;
      list.appendChild(card);

      const expectedOutcome = runIsolated(q.sql);
      renderOutcome($('[data-role="expected"]', card), expectedOutcome);
      const expected = lastResult(expectedOutcome);

      const editor = $('textarea', card);
      const actualEl = $('[data-role="actual"]', card);
      const statusEl = $('[data-role="status"]', card);

      const run = () => {
        const outcome = runIsolated(editor.value);
        renderOutcome(actualEl, outcome);
        const status = outcome.ok ? compareResults(expected, lastResult(outcome)) : { cls: 'bad', text: '執行失敗' };
        statusEl.className = 'status ' + status.cls;
        statusEl.textContent = status.text;
      };
      const fit = setupEditor(editor, q.sql, run);
      $('[data-action="run"]', card).addEventListener('click', run);
      $('[data-action="reset"]', card).addEventListener('click', () => {
        editor.value = q.sql;
        fit();
        actualEl.innerHTML = '<p class="placeholder">已還原成參考 SQL，按「執行」查看結果</p>';
        statusEl.className = 'status';
        statusEl.textContent = '';
      });
    });
  }

  function buildComparisons() {
    const list = $('#compare-list');
    COMPARISONS.forEach((c, index) => {
      const card = document.createElement('article');
      card.className = 'card cmp-card';
      card.id = c.id;

      const diffHtml = lineDiff(c.before.sql, c.after.sql)
        .map(([sign, line]) => `<span class="${sign === '-' ? 'del' : 'add'}">${sign} ${escapeHtml(line)}</span>`)
        .join('\n');

      const side = (key, badge) => `
        <div class="cmp-side ${key}">
          <div class="cmp-label"><span class="side-badge">${badge}</span>${escapeHtml(c[key].label)}</div>
          <textarea class="sql-editor" aria-label="比較 ${index + 1} ${badge}的 SQL"></textarea>
          <div class="editor-actions">
            <button class="btn primary" data-action="run" type="button">執行</button>
            <button class="btn ghost" data-action="reset" type="button">還原</button>
          </div>
          <div class="pane-body" data-role="result"></div>
        </div>`;

      card.innerHTML = `
        <header class="q-head">
          <span class="q-no">比較 ${index + 1}</span>
          <div><h3>${escapeHtml(c.title)}</h3></div>
        </header>
        <p class="q-text">${escapeHtml(c.scenario)}</p>
        <div class="cmp-grid">${side('before', '原本')}${side('after', '修改後')}</div>
        <div class="cmp-notes">
          <div class="note">
            <h4>改了什麼</h4>
            <p>${c.change}</p>
            <pre class="diff" aria-label="SQL 差異">${diffHtml}</pre>
          </div>
          <div class="note">
            <h4>結果怎麼變</h4>
            <p>${c.diff}</p>
          </div>
          <div class="note wide">
            <h4>為什麼</h4>
            ${paragraphs(c.reason)}
          </div>
        </div>`;
      list.appendChild(card);

      ['before', 'after'].forEach((key) => {
        const wrap = $(`.cmp-side.${key}`, card);
        const editor = $('textarea', wrap);
        const resultEl = $('[data-role="result"]', wrap);
        const run = () => renderOutcome(resultEl, runIsolated(editor.value));
        const fit = setupEditor(editor, c[key].sql, run);
        $('[data-action="run"]', wrap).addEventListener('click', run);
        $('[data-action="reset"]', wrap).addEventListener('click', () => {
          editor.value = c[key].sql;
          fit();
          run();
        });
        run();
      });
    });
  }

  const PLAYGROUND_EXAMPLES = [
    {
      label: '重複劃位（UNIQUE）',
      sql: `-- 場次 1 的 C3（seat_id = 43）已經賣出了，再賣一次會怎樣？
INSERT INTO tickets (order_id, showtime_id, seat_id, ticket_type, price_paid)
VALUES (1, 1, 43, '全票', 380);`,
    },
    {
      label: '不存在的場次（FOREIGN KEY）',
      sql: `-- 資料庫裡沒有 99 號場次
INSERT INTO tickets (order_id, showtime_id, seat_id, ticket_type, price_paid)
VALUES (1, 99, 31, '全票', 380);`,
    },
    {
      label: '不合法的票種（CHECK）',
      sql: `-- 票種只能是 全票／學生票／優待票
INSERT INTO tickets (order_id, showtime_id, seat_id, ticket_type, price_paid)
VALUES (1, 1, 31, '半價票', 190);`,
    },
    {
      label: '賣出一張票，再查空位',
      sql: `-- 賣出場次 1 的 A1（seat_id = 31）
INSERT INTO tickets (order_id, showtime_id, seat_id, ticket_type, price_paid)
VALUES (1, 1, 31, '全票', 380);

-- 再查一次空位：A1 不見了，剩 7 個
SELECT se.seat_row || se.seat_no AS 座位
FROM seats AS se
LEFT JOIN tickets AS t
       ON t.seat_id = se.seat_id
      AND t.showtime_id = 1
WHERE se.hall_id = 3
  AND t.ticket_id IS NULL
ORDER BY se.seat_row, se.seat_no;`,
    },
    {
      label: '忘了限定場次的空位查詢',
      sql: `-- 比較 2 的延伸：ON 裡少了 t.showtime_id = 1
-- 初始資料下會得到 7 列：C5 不見了，因為 C5 在「場次 2」被賣掉
-- （如果你剛剛在這裡賣出 A1，會再少一個；按「重設資料庫」可恢復）
SELECT se.seat_row || se.seat_no AS 座位
FROM seats AS se
LEFT JOIN tickets AS t
       ON t.seat_id = se.seat_id
WHERE se.hall_id = 3
  AND t.ticket_id IS NULL
ORDER BY se.seat_row, se.seat_no;`,
    },
    {
      label: 'COUNT(*) vs COUNT(欄位)',
      sql: `-- COUNT(member_id) 不計算 NULL（非會員的訂單）
SELECT COUNT(*)         AS 全部訂單,
       COUNT(member_id) AS 會員訂單
FROM orders;`,
    },
  ];

  function buildPlayground() {
    state.playDb = freshDb();
    const editor = $('#pg-editor');
    const resultEl = $('#pg-result');

    const run = () => renderOutcome(resultEl, execSql(state.playDb, editor.value));
    const fit = setupEditor(editor, editor.value, run);

    const load = (sql) => {
      editor.value = sql;
      fit();
      run();
    };

    const tableRow = $('#pg-tables');
    TABLES.forEach((t) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip mono';
      chip.textContent = t;
      chip.addEventListener('click', () => load(`SELECT * FROM ${t};`));
      tableRow.appendChild(chip);
    });

    const exampleRow = $('#pg-examples');
    PLAYGROUND_EXAMPLES.forEach((ex) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = ex.label;
      chip.addEventListener('click', () => load(ex.sql));
      exampleRow.appendChild(chip);
    });

    $('#pg-run').addEventListener('click', run);
    $('#pg-reset').addEventListener('click', () => {
      state.playDb.close();
      state.playDb = freshDb();
      resultEl.innerHTML = '<p class="exec-msg">已重設為初始資料。</p>';
    });
  }

  // ---------- 啟動 ----------
  async function init() {
    renderErd();
    buildSchemaDocs();

    if (typeof window.initSqlJs !== 'function') {
      showStatus('error', '無法載入 sql.js，請確認網路連線後重新整理頁面。');
      return;
    }
    try {
      state.SQL = await window.initSqlJs({ locateFile: (file) => SQLJS_CDN + file });
      const db = new state.SQL.Database();
      db.run('PRAGMA foreign_keys = ON;');
      db.run(SCHEMA_SQL);
      db.run(SEED_SQL);
      state.pristine = db.export();
      db.close();
    } catch (err) {
      showStatus('error', '資料庫建立失敗：' + (err && err.message ? err.message : err));
      return;
    }

    buildStats();
    buildSampleData();
    buildQuestions();
    buildComparisons();
    buildPlayground();
    showStatus('ok', '資料庫已就緒，所有 SQL 都直接在你的瀏覽器裡執行。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
