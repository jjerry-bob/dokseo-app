/* ===== 독서기록장 app.js ===== */
"use strict";

/* ---------- 저장소 ---------- */
const LS_BOOKS = "dokseo.books";
const LS_SETTINGS = "dokseo.settings";

let books = loadBooks();
let settings = loadSettings();

function loadBooks() {
  try {
    const raw = localStorage.getItem(LS_BOOKS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveBooks() {
  try {
    localStorage.setItem(LS_BOOKS, JSON.stringify(books));
  } catch (e) {
    toast("저장 공간이 부족합니다. 표지 이미지를 줄이거나 데이터를 정리해 주세요.");
  }
}
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
  catch (e) { return {}; }
}
function saveSettings() { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }

function uuid() {
  return (crypto.randomUUID) ? crypto.randomUUID()
    : "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
      }) + "-" + Date.now();
}

/* ---------- 공통 유틸 ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function fmtDate(d) {
  if (!d) return "-";
  const [y, m, dd] = d.split("-");
  return `${y}.${m}.${dd}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function starHtml(n) {
  n = Number(n) || 0;
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class="${i <= n ? "" : "off"}">${i <= n ? "★\uFE0E" : "☆\uFE0E"}</span>`;
  return `<span class="stars">${s}</span>`;
}

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}

function confirmDlg(msg) {
  return new Promise(resolve => {
    $("#confirm-msg").textContent = msg;
    $("#confirm-overlay").classList.remove("hidden");
    const done = ok => {
      $("#confirm-overlay").classList.add("hidden");
      $("#confirm-ok").onclick = $("#confirm-cancel").onclick = null;
      resolve(ok);
    };
    $("#confirm-ok").onclick = () => done(true);
    $("#confirm-cancel").onclick = () => done(false);
  });
}

function promptDlg(title, initial = "") {
  return new Promise(resolve => {
    $("#prompt-title").textContent = title;
    const input = $("#prompt-input");
    input.value = initial;
    $("#prompt-overlay").classList.remove("hidden");
    input.focus();
    const done = val => {
      $("#prompt-overlay").classList.add("hidden");
      $("#prompt-ok").onclick = $("#prompt-cancel").onclick = null;
      resolve(val);
    };
    $("#prompt-ok").onclick = () => done(input.value.trim());
    $("#prompt-cancel").onclick = () => done(null);
  });
}

/* ---------- 화면 전환 ---------- */
const SCREENS = ["home", "list", "form", "detail", "stats", "settings"];
let currentScreen = "home";
let detailBookId = null;
let editBookId = null;   // null이면 새 책 등록

function show(name) {
  currentScreen = name;
  SCREENS.forEach(s => $("#screen-" + s).classList.toggle("hidden", s !== name));
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  window.scrollTo(0, 0);
  closeCardMenus();
  if (name === "home") renderHome();
  if (name === "list") renderList();
  if (name === "stats") renderStats();
  if (name === "settings") renderSettings();
}

$$(".nav-item").forEach(b => b.addEventListener("click", () => show(b.dataset.screen)));

/* ---------- 홈 화면 ---------- */
function renderHome() {
  const year = new Date().getFullYear();
  const doneAll = books.filter(b => b.status === "완독");
  const doneThisYear = doneAll.filter(b => (b.finishDate || "").startsWith(String(year)));
  const reading = books.filter(b => b.status === "읽는 중");

  $("#home-year-line").innerHTML = `${year}년 <b>${doneThisYear.length}권</b> 완독`;
  $("#home-done-count").textContent = doneAll.length + "권";
  $("#home-reading-count").textContent = reading.length + "권";

  // 현재 읽는 책 (가장 최근 시작)
  const cur = reading.slice().sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))[0];
  const body = $("#home-reading-body");
  if (cur) {
    body.innerHTML = `
      <button class="reading-book" style="width:100%;text-align:left" data-id="${cur.id}">
        ${coverHtml(cur, "cover")}
        <div class="reading-info">
          <div class="title">${esc(cur.title)}</div>
          <div class="author">${esc(cur.author)}</div>
          <div class="reading-meta">
            <span class="status-badge">읽는 중</span>
            <span>시작일 ${fmtDate(cur.startDate)}</span>
          </div>
        </div>
      </button>`;
    body.querySelector("button").addEventListener("click", () => openDetail(cur.id));
  } else {
    body.innerHTML = `<p class="empty-note">읽고 있는 책이 없습니다. 새 책을 추가해 보세요.</p>`;
  }

  // 최근 기록: 최근 완독 순 (없으면 최근 등록)
  const recent = doneAll
    .slice().sort((a, b) => (b.finishDate || "").localeCompare(a.finishDate || ""))
    .slice(0, 3);
  const list = $("#home-recent-list");
  if (recent.length === 0) {
    list.innerHTML = `<p class="empty-note">아직 완독한 책이 없습니다.</p>`;
  } else {
    list.innerHTML = recent.map(b => bookCardHtml(b, { showFinish: true, menu: false })).join("");
    list.querySelectorAll(".book-card").forEach(el =>
      el.addEventListener("click", () => openDetail(el.dataset.id)));
  }
}

$("#home-add-btn").addEventListener("click", () => openForm(null));
$("#home-more-btn").addEventListener("click", () => { listFilter = "전체"; show("list"); });
$("#tile-done").addEventListener("click", () => { listFilter = "완독"; show("list"); });
$("#tile-reading").addEventListener("click", () => { listFilter = "읽는 중"; show("list"); });

/* ---------- 책 카드 HTML ---------- */
function coverHtml(b, cls) {
  if (b.coverImage) return `<img class="${cls}" src="${b.coverImage}" alt="">`;
  return `<div class="${cls}">📕</div>`;
}
function bookCardHtml(b, opts = {}) {
  const date = opts.showFinish && b.finishDate ? fmtDate(b.finishDate)
    : (b.finishDate ? fmtDate(b.finishDate) : (b.startDate ? fmtDate(b.startDate) : ""));
  const badgeCls = "s-" + (b.status || "").replace(/\s/g, "");
  return `
  <div class="book-card" data-id="${b.id}" role="button" tabindex="0">
    ${coverHtml(b, "cover")}
    <div class="info">
      <div class="title">${esc(b.title)}</div>
      <div class="author">${esc(b.author)}</div>
      ${b.rating ? starHtml(b.rating) : ""}
      <div class="meta-row">
        <span class="status-badge ${badgeCls}">${esc(b.status)}</span>
        <span class="date">${date}</span>
      </div>
    </div>
    ${opts.menu === false ? "" : `<button class="kebab" data-menu="${b.id}" aria-label="메뉴">⋮</button>`}
  </div>`;
}

/* ---------- 책 목록 화면 ---------- */
let listFilter = "전체";
let listSort = "recent";
let listQuery = "";

function renderList() {
  // 필터 칩 상태 반영
  $$("#filter-chips .chip").forEach(c =>
    c.classList.toggle("active", c.dataset.filter === listFilter));
  $("#sort-select").value = listSort;

  let arr = books.slice();
  if (listFilter !== "전체") arr = arr.filter(b => b.status === listFilter);
  if (listQuery) {
    const q = listQuery.toLowerCase();
    arr = arr.filter(b =>
      (b.title || "").toLowerCase().includes(q) ||
      (b.author || "").toLowerCase().includes(q));
  }
  const sorters = {
    recent: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
    title:  (a, b) => (a.title || "").localeCompare(b.title || "", "ko"),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    finish: (a, b) => (b.finishDate || "").localeCompare(a.finishDate || "")
  };
  arr.sort(sorters[listSort] || sorters.recent);

  const wrap = $("#book-list");
  if (arr.length === 0) {
    wrap.innerHTML = `<p class="empty-note">${listQuery ? "검색 결과가 없습니다." : "등록된 책이 없습니다.\n홈에서 '＋ 책 추가'로 시작해 보세요."}</p>`;
    return;
  }
  wrap.innerHTML = arr.map(b => bookCardHtml(b)).join("");
  wrap.querySelectorAll(".book-card").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.closest(".kebab") || e.target.closest(".card-menu")) return;
      openDetail(el.dataset.id);
    });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter") openDetail(el.dataset.id);
    });
  });
  wrap.querySelectorAll(".kebab").forEach(k =>
    k.addEventListener("click", e => { e.stopPropagation(); toggleCardMenu(k); }));
}

function toggleCardMenu(kebabBtn) {
  const existing = kebabBtn.parentElement.querySelector(".card-menu");
  closeCardMenus();
  if (existing) return;
  const id = kebabBtn.dataset.menu;
  const menu = document.createElement("div");
  menu.className = "card-menu";
  menu.innerHTML = `<button class="edit">수정</button><button class="del">삭제</button>`;
  menu.querySelector(".edit").addEventListener("click", e => { e.stopPropagation(); closeCardMenus(); openForm(id); });
  menu.querySelector(".del").addEventListener("click", async e => {
    e.stopPropagation(); closeCardMenus(); await deleteBook(id);
  });
  kebabBtn.parentElement.appendChild(menu);
}
function closeCardMenus() { $$(".card-menu").forEach(m => m.remove()); }
document.addEventListener("click", e => {
  if (!e.target.closest(".kebab")) closeCardMenus();
});

$("#search-input").addEventListener("input", e => { listQuery = e.target.value.trim(); renderList(); });
$("#sort-select").addEventListener("change", e => { listSort = e.target.value; renderList(); });
$$("#filter-chips .chip").forEach(c =>
  c.addEventListener("click", () => { listFilter = c.dataset.filter; renderList(); }));

/* ---------- 삭제 ---------- */
async function deleteBook(id) {
  const b = books.find(x => x.id === id);
  if (!b) return;
  const ok = await confirmDlg(`'${b.title}'을(를) 삭제하시겠습니까?\n삭제한 기록은 되돌릴 수 없습니다.`);
  if (!ok) return;
  books = books.filter(x => x.id !== id);
  saveBooks();
  toast("삭제되었습니다.");
  if (currentScreen === "detail") show("list");
  else if (currentScreen === "list") renderList();
  else renderHome();
}

/* ---------- 등록/수정 폼 ---------- */
let formCoverData = null; // base64 or null
let formRating = 0;

function openForm(id) {
  editBookId = id;
  const b = id ? books.find(x => x.id === id) : null;
  $("#form-title").textContent = b ? "책 정보 수정" : "새 책 등록";
  $("#f-title").value = b ? b.title : "";
  $("#f-author").value = b ? b.author : "";
  $("#f-publisher").value = b ? (b.publisher || "") : "";
  $("#f-genre").value = b ? (b.genre || "기타") : "인문학";
  const status = b ? b.status : "읽는 중";
  $$('#f-status input').forEach(r => r.checked = r.value === status);
  $("#f-start").value = b ? (b.startDate || "") : todayStr();
  $("#f-finish").value = b ? (b.finishDate || "") : "";
  formCoverData = b ? (b.coverImage || null) : null;
  formRating = b ? (b.rating || 0) : 0;
  renderCoverPreview();
  renderFormStars();
  show("form");
}

function renderCoverPreview() {
  const img = $("#cover-preview");
  const plus = $("#cover-plus");
  const removeBtn = $("#cover-remove-btn");
  if (formCoverData) {
    img.src = formCoverData;
    img.classList.remove("hidden");
    plus.classList.add("hidden");
    removeBtn.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
    plus.classList.remove("hidden");
    removeBtn.classList.add("hidden");
  }
}
function renderFormStars() {
  const wrap = $("#f-rating");
  wrap.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = i <= formRating ? "★\uFE0E" : "☆\uFE0E";
    btn.className = i <= formRating ? "on" : "";
    btn.setAttribute("aria-label", i + "점");
    btn.addEventListener("click", () => {
      formRating = (formRating === i) ? 0 : i; // 같은 별 다시 누르면 해제
      renderFormStars();
    });
    wrap.appendChild(btn);
  }
}

$("#cover-box").addEventListener("click", () => $("#cover-input").click());
$("#cover-remove-btn").addEventListener("click", () => { formCoverData = null; renderCoverPreview(); });
$("#cover-input").addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => resizeImage(ev.target.result, 480, data => {
    formCoverData = data;
    renderCoverPreview();
  });
  reader.onerror = () => toast("이미지를 불러오지 못했습니다.");
  reader.readAsDataURL(file);
});

// 표지 이미지 리사이즈 (저장 공간 절약)
function resizeImage(dataUrl, maxSide, cb) {
  const img = new Image();
  img.onload = () => {
    let { width: w, height: h } = img;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    cb(cv.toDataURL("image/jpeg", 0.82));
  };
  img.onerror = () => toast("지원하지 않는 이미지 형식입니다.");
  img.src = dataUrl;
}

$("#form-back-btn").addEventListener("click", () => {
  show(editBookId ? "detail" : "home");
});

$("#form-save-btn").addEventListener("click", () => {
  const title = $("#f-title").value.trim();
  const author = $("#f-author").value.trim();
  if (!title) { toast("책 제목을 입력해 주세요."); $("#f-title").focus(); return; }
  if (!author) { toast("저자를 입력해 주세요."); $("#f-author").focus(); return; }

  const status = $$('#f-status input').find(r => r.checked).value;
  const startDate = $("#f-start").value || "";
  let finishDate = $("#f-finish").value || "";
  if (status === "완독" && !finishDate) finishDate = todayStr();
  if (startDate && finishDate && finishDate < startDate) {
    toast("완독일이 시작일보다 빠릅니다."); return;
  }

  const data = {
    title, author,
    publisher: $("#f-publisher").value.trim(),
    genre: $("#f-genre").value,
    coverImage: formCoverData,
    status, startDate, finishDate,
    rating: formRating
  };

  if (editBookId) {
    const b = books.find(x => x.id === editBookId);
    Object.assign(b, data);
    saveBooks();
    toast("저장되었습니다.");
    openDetail(editBookId);
  } else {
    const b = Object.assign({
      id: uuid(),
      review: "",
      notes: [],
      quotes: [],
      createdAt: new Date().toISOString()
    }, data);
    books.push(b);
    saveBooks();
    toast("책이 등록되었습니다.");
    show("home");
  }
});

/* ---------- 상세 화면 ---------- */
function openDetail(id) {
  detailBookId = id;
  renderDetail();
  show("detail");
}

function renderDetail() {
  const b = books.find(x => x.id === detailBookId);
  if (!b) { show("list"); return; }
  $("#detail-header-title").textContent = b.title;

  const days = readingDays(b);
  const body = $("#detail-body");
  body.innerHTML = `
    <div class="detail-top">
      ${coverHtml(b, "cover")}
      <div class="info">
        <div class="title">${esc(b.title)}</div>
        <div class="author">${esc(b.author)}</div>
        <div class="publisher">${esc(b.publisher || "")}</div>
        <div class="detail-stars" id="d-stars"></div>
      </div>
    </div>

    <section class="card">
      <div class="info-table">
        <div><span class="k">상태</span><span class="v navy">${esc(b.status)}</span></div>
        <div><span class="k">시작일</span><span class="v">${fmtDate(b.startDate)}</span></div>
        <div><span class="k">완독일</span><span class="v">${fmtDate(b.finishDate)}</span></div>
        ${days ? `<div><span class="k">독서 기간</span><span class="v">${days}일</span></div>` : ""}
      </div>
    </section>

    <section class="card">
      <div class="detail-section-head">
        <h2 class="card-label">한줄평</h2>
        <button class="edit-icon" id="d-review-edit" aria-label="한줄평 수정">✏️</button>
      </div>
      <p class="detail-text ${b.review ? "" : "placeholder"}">${b.review ? esc(b.review) : "한줄평을 남겨보세요."}</p>
    </section>

    <section class="card">
      <div class="detail-section-head">
        <h2 class="card-label">메모</h2>
      </div>
      <div id="d-notes"></div>
      <button class="add-inline-btn" id="d-note-add">＋ 메모 추가</button>
    </section>

    <section class="card">
      <div class="detail-section-head">
        <h2 class="card-label">인상 깊은 문장</h2>
      </div>
      <div id="d-quotes"></div>
      <button class="add-inline-btn" id="d-quote-add">＋ 문장 추가</button>
    </section>

    <div class="detail-btns">
      <button class="ghost-btn" id="d-edit-btn">수정</button>
      <button class="danger-btn" id="d-del-btn">삭제</button>
    </div>
  `;

  // 별점 (탭으로 즉시 수정)
  const starWrap = $("#d-stars");
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.textContent = i <= (b.rating || 0) ? "★\uFE0E" : "☆\uFE0E";
    btn.className = i <= (b.rating || 0) ? "on" : "";
    btn.setAttribute("aria-label", i + "점");
    btn.addEventListener("click", () => {
      b.rating = (b.rating === i) ? 0 : i;
      saveBooks(); toast("평점이 저장되었습니다."); renderDetail();
    });
    starWrap.appendChild(btn);
  }

  // 한줄평
  $("#d-review-edit").addEventListener("click", async () => {
    const v = await promptDlg("한줄평", b.review || "");
    if (v === null) return;
    b.review = v; saveBooks(); toast("저장되었습니다."); renderDetail();
  });

  // 메모
  const notesWrap = $("#d-notes");
  if (!b.notes || b.notes.length === 0) {
    notesWrap.innerHTML = `<p class="empty-note">아직 메모가 없습니다.</p>`;
  } else {
    notesWrap.innerHTML = b.notes.map((n, i) => `
      <div class="note-item">
        <div>${esc(n.content)}</div>
        <div class="note-date">${fmtDate(n.date)}</div>
        <div class="note-actions">
          <button data-nedit="${i}">수정</button>
          <button class="del" data-ndel="${i}">삭제</button>
        </div>
      </div>`).join("");
    notesWrap.querySelectorAll("[data-nedit]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.nedit);
        const v = await promptDlg("메모 수정", b.notes[i].content);
        if (v === null || v === "") return;
        b.notes[i].content = v; saveBooks(); toast("저장되었습니다."); renderDetail();
      }));
    notesWrap.querySelectorAll("[data-ndel]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.ndel);
        if (!(await confirmDlg("이 메모를 삭제하시겠습니까?"))) return;
        b.notes.splice(i, 1); saveBooks(); toast("삭제되었습니다."); renderDetail();
      }));
  }
  $("#d-note-add").addEventListener("click", async () => {
    const v = await promptDlg("새 메모");
    if (!v) return;
    b.notes = b.notes || [];
    b.notes.push({ date: todayStr(), content: v });
    saveBooks(); toast("메모가 추가되었습니다."); renderDetail();
  });

  // 인용구
  const qWrap = $("#d-quotes");
  if (!b.quotes || b.quotes.length === 0) {
    qWrap.innerHTML = `<p class="empty-note">인상 깊은 문장을 기록해 보세요.</p>`;
  } else {
    qWrap.innerHTML = b.quotes.map((q, i) => `
      <div class="quote-item"><span class="quote-text">${esc(q.content)}</span>
        <div class="note-actions"><button class="del" data-qdel="${i}">삭제</button></div>
      </div>`).join("");
    qWrap.querySelectorAll("[data-qdel]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.qdel);
        if (!(await confirmDlg("이 문장을 삭제하시겠습니까?"))) return;
        b.quotes.splice(i, 1); saveBooks(); toast("삭제되었습니다."); renderDetail();
      }));
  }
  $("#d-quote-add").addEventListener("click", async () => {
    const v = await promptDlg("인상 깊은 문장");
    if (!v) return;
    b.quotes = b.quotes || [];
    b.quotes.push({ content: v });
    saveBooks(); toast("문장이 추가되었습니다."); renderDetail();
  });

  $("#d-edit-btn").addEventListener("click", () => openForm(b.id));
  $("#d-del-btn").addEventListener("click", () => deleteBook(b.id));
}

function readingDays(b) {
  if (!b.startDate || !b.finishDate) return 0;
  const ms = new Date(b.finishDate) - new Date(b.startDate);
  if (isNaN(ms) || ms < 0) return 0;
  return Math.round(ms / 86400000) + 1;
}

$("#detail-back-btn").addEventListener("click", () => show("list"));

/* ---------- 통계 화면 ---------- */
const GENRE_COLORS = ["#3D6BAA", "#8FBF88", "#F0B449", "#C6CBD4", "#B07CC6", "#E08573", "#63B5B0", "#8A8F98"];

function renderStats() {
  // 연도 선택 옵션 구성
  const years = new Set([new Date().getFullYear()]);
  books.forEach(b => { if (b.finishDate) years.add(Number(b.finishDate.slice(0, 4))); });
  const yearSel = $("#stats-year");
  const prev = yearSel.value;
  yearSel.innerHTML = Array.from(years).sort((a, b) => b - a)
    .map(y => `<option value="${y}">${y}년</option>`).join("");
  if (prev && Array.from(years).includes(Number(prev))) yearSel.value = prev;
  const selYear = Number(yearSel.value);

  const done = books.filter(b => b.status === "완독");
  const rated = books.filter(b => b.rating > 0);
  $("#st-total").textContent = books.length + "권";
  $("#st-done").textContent = done.length + "권";
  $("#st-reading").textContent = books.filter(b => b.status === "읽는 중").length + "권";
  $("#st-avg").textContent = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : "-";

  // 월별 완독 (선택 연도)
  $("#chart-month-title").textContent = `월별 완독 권수 (${selYear}년)`;
  const monthly = Array(12).fill(0);
  done.forEach(b => {
    if (b.finishDate && Number(b.finishDate.slice(0, 4)) === selYear)
      monthly[Number(b.finishDate.slice(5, 7)) - 1]++;
  });
  drawBarChart($("#chart-month"), monthly.map((v, i) => ({ label: (i + 1) + "월", value: v })));

  // 연도별 완독
  const byYear = {};
  done.forEach(b => {
    if (b.finishDate) {
      const y = b.finishDate.slice(0, 4);
      byYear[y] = (byYear[y] || 0) + 1;
    }
  });
  const yearData = Object.keys(byYear).sort().slice(-6)
    .map(y => ({ label: y, value: byYear[y] }));
  drawBarChart($("#chart-year"), yearData.length ? yearData : [{ label: String(selYear), value: 0 }]);

  // 장르별 비율 (전체 등록 기준)
  const byGenre = {};
  books.forEach(b => {
    const g = b.genre || "기타";
    byGenre[g] = (byGenre[g] || 0) + 1;
  });
  const entries = Object.entries(byGenre).sort((a, b) => b[1] - a[1]);
  drawDonut($("#chart-genre"), entries);
  const legend = $("#genre-legend");
  const total = books.length;
  $("#genre-empty").classList.toggle("hidden", total > 0);
  legend.innerHTML = entries.map(([g, n], i) => `
    <li><span class="dot" style="background:${GENRE_COLORS[i % GENRE_COLORS.length]}"></span>
    ${esc(g)}<span class="pct">${Math.round(n / total * 100)}%</span></li>`).join("");
}

$("#stats-year").addEventListener("change", renderStats);

function setupCanvas(cv, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || cv.parentElement.clientWidth || 300;
  cv.width = w * dpr;
  cv.height = cssH * dpr;
  cv.style.height = cssH + "px";
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: cssH };
}

function chartColors() {
  const dark = document.body.classList.contains("dark");
  return {
    bar: dark ? "#4C7DD0" : "#2C5488",
    grid: dark ? "#34363E" : "#EAE4D6",
    label: dark ? "#9BA0A8" : "#8A8F98",
    value: dark ? "#ECEDEF" : "#26282E"
  };
}

function drawBarChart(cv, data) {
  const { ctx, w, h } = setupCanvas(cv, 180);
  const c = chartColors();
  ctx.clearRect(0, 0, w, h);
  const padL = 8, padR = 8, padT = 18, padB = 22;
  const cw = w - padL - padR, ch = h - padT - padB;
  const max = Math.max(1, ...data.map(d => d.value));
  const n = data.length;
  const slot = cw / n;
  const barW = Math.min(26, slot * 0.55);

  // 가로 격자선
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  [0, 0.5, 1].forEach(t => {
    const y = padT + ch * (1 - t) + 0.5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
  });

  ctx.textAlign = "center";
  data.forEach((d, i) => {
    const x = padL + slot * i + slot / 2;
    const bh = d.value === 0 ? 0 : Math.max(3, ch * d.value / max);
    ctx.fillStyle = c.bar;
    roundedRect(ctx, x - barW / 2, padT + ch - bh, barW, bh, 4);
    // 값 라벨
    if (d.value > 0) {
      ctx.fillStyle = c.value;
      ctx.font = "600 11px sans-serif";
      ctx.fillText(d.value, x, padT + ch - bh - 4);
    }
    // x축 라벨
    ctx.fillStyle = c.label;
    ctx.font = "10px sans-serif";
    ctx.fillText(d.label, x, h - 6);
  });
}
function roundedRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function drawDonut(cv, entries) {
  const dpr = window.devicePixelRatio || 1;
  const size = 150;
  cv.width = size * dpr; cv.height = size * dpr;
  cv.style.width = cv.style.height = size + "px";
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const cx = size / 2, cy = size / 2, rOut = size / 2 - 4, rIn = size / 2 - 32;
  if (total === 0) {
    ctx.strokeStyle = chartColors().grid; ctx.lineWidth = rOut - rIn;
    ctx.beginPath(); ctx.arc(cx, cy, (rOut + rIn) / 2, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  let start = -Math.PI / 2;
  entries.forEach(([, n], i) => {
    const ang = n / total * Math.PI * 2;
    ctx.fillStyle = GENRE_COLORS[i % GENRE_COLORS.length];
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, start, start + ang);
    ctx.arc(cx, cy, rIn, start + ang, start, true);
    ctx.closePath(); ctx.fill();
    start += ang;
  });
  // 중앙 아이콘
  ctx.fillStyle = chartColors().label;
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("📖", cx, cy + 1);
}

window.addEventListener("resize", () => {
  if (currentScreen === "stats") renderStats();
});

/* ---------- 설정 화면 ---------- */
function renderSettings() {
  $("#dark-toggle").checked = !!settings.dark;
  // 저장 공간 사용량 (대략)
  try {
    const bytes = (localStorage.getItem(LS_BOOKS) || "").length * 2;
    $("#storage-usage").textContent = bytes < 1024 * 1024
      ? Math.round(bytes / 1024) + " KB"
      : (bytes / 1024 / 1024).toFixed(1) + " MB";
  } catch (e) { $("#storage-usage").textContent = "-"; }
}

function applyDark() {
  document.body.classList.toggle("dark", !!settings.dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = settings.dark ? "#17181C" : "#1E3A5F";
}
$("#dark-toggle").addEventListener("change", e => {
  settings.dark = e.target.checked;
  saveSettings();
  applyDark();
  if (currentScreen === "stats") renderStats();
});

/* 백업: 내보내기 */
$("#export-btn").addEventListener("click", () => {
  if (books.length === 0) { toast("내보낼 데이터가 없습니다."); return; }
  const payload = {
    app: "독서기록장",
    version: 1,
    exportedAt: new Date().toISOString(),
    books
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `독서기록장_백업_${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("백업 파일이 다운로드되었습니다.");
});

/* 백업: 가져오기 */
$("#import-btn").addEventListener("click", () => $("#import-input").click());
$("#import-input").addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    let data;
    try { data = JSON.parse(ev.target.result); }
    catch (err) { toast("올바른 JSON 파일이 아닙니다."); return; }
    const incoming = Array.isArray(data) ? data : data.books;
    if (!Array.isArray(incoming)) { toast("독서기록장 백업 파일이 아닙니다."); return; }
    const valid = incoming.filter(b => b && typeof b === "object" && b.title);
    if (valid.length === 0) { toast("가져올 책 데이터가 없습니다."); return; }

    let mode = "replace";
    if (books.length > 0) {
      const merge = await confirmDlg(
        `백업 파일에 ${valid.length}권이 있습니다.\n[확인] 기존 데이터에 합치기 / [취소] 취소`);
      if (!merge) return;
      mode = "merge";
    }
    valid.forEach(b => {
      if (!b.id) b.id = uuid();
      b.notes = Array.isArray(b.notes) ? b.notes : [];
      b.quotes = Array.isArray(b.quotes) ? b.quotes : [];
      if (!b.createdAt) b.createdAt = new Date().toISOString();
      const idx = books.findIndex(x => x.id === b.id);
      if (idx >= 0) books[idx] = b; else books.push(b);
    });
    saveBooks();
    toast(`${valid.length}권을 가져왔습니다.`);
    renderSettings();
  };
  reader.onerror = () => toast("파일을 읽지 못했습니다.");
  reader.readAsText(file);
});

/* 데이터 초기화 */
$("#reset-btn").addEventListener("click", async () => {
  if (!(await confirmDlg("모든 독서 기록이 삭제됩니다.\n정말 초기화하시겠습니까?"))) return;
  if (!(await confirmDlg("이 작업은 되돌릴 수 없습니다.\n계속하시겠습니까?"))) return;
  books = [];
  saveBooks();
  toast("모든 데이터가 초기화되었습니다.");
  renderSettings();
});

/* ---------- PWA: Service Worker 등록 ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

/* ---------- 초기화 ---------- */
applyDark();
show("home");
