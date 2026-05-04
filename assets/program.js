// ========= CONFIG & STATE =========
const CACHE_BUST = "&t=" + new Date().getTime();
const URL_TO =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjwit9zh6fwpl98MTQk-aqK97M0VNt4YnrTz0VQM6nIKPuvV3_K7u_XKU4_YjQar0ZWtM1qRlpwsIy/pub?gid=713863957&single=true&output=csv" +
  CACHE_BUST;

const URL_REF =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf4c77CKU9bs4Vl4uXub6LY5mXKf7U6gg2B1TBjfpZuwxGpF0mev6QPnHQeFiaWmwgqCs1wUiyq4jP/pub?gid=2141907053&single=true&output=csv" +
  CACHE_BUST;

const URL_PRO =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf4c77CKU9bs4Vl4uXub6LY5mXKf7U6gg2B1TBjfpZuwxGpF0mev6QPnHQeFiaWmwgqCs1wUiyq4jP/pub?gid=765766751&single=true&output=csv" +
  CACHE_BUST;

let rowsAll = [],
  refRows = [],
  promoRows = [];

window.activeProg = "";
window.activeCat = "";

let visitedCats = new Set();

let refState = { code: "", ok: false, row: null };
let promoState = { code: "", ok: false, row: null };

// State untuk hint program berikutnya
const nextProgHintState = {
  show: false,
  nextProg: "",
  nextIdx: -1,
  threshold: 100,
};

// Pending query-apply (biar gak race condition)
const queryApplyState = {
  ref: "",
  promo: "",
  applied: false,
};

// ========= QUERY PARAM UTILS =========
function readQueryCodes() {
  try {
    const sp = new URLSearchParams(window.location.search || "");
    const ref = (sp.get("ref") || "").trim().toUpperCase();
    const promo = (sp.get("promo") || "").trim().toUpperCase();
    return { ref, promo };
  } catch (e) {
    return { ref: "", promo: "" };
  }
}

function setRefCode(val) {
  const code = (val || "").trim().toUpperCase();
  if (!code) {
    refState = { code: "", ok: false, row: null };
    return refState;
  }

  const f = refRows.find(
    (r) => (r.refferal_code || r.referral_code || "").toUpperCase() === code
  );

  refState =
    f && (f.status || "").toLowerCase() === "valid"
      ? { code, ok: true, row: f }
      : { code: "", ok: false, row: null };

  return refState;
}

function setPromoCode(val) {
  const code = (val || "").trim().toUpperCase();
  if (!code) {
    promoState = { code: "", ok: false, row: null };
    return promoState;
  }

  const f = promoRows.find((r) => (r.kode || "").toUpperCase() === code);

  promoState = f ? { code, ok: true, row: f } : { code: "", ok: false, row: null };
  return promoState;
}

function applyCodesFromQueryOnce() {
  if (queryApplyState.applied) return;
  queryApplyState.applied = true;

  const { ref, promo } = readQueryCodes();
  queryApplyState.ref = ref;
  queryApplyState.promo = promo;

  // Set input UI (kalau ada)
  const refIn = document.getElementById("ref_in");
  const proIn = document.getElementById("pro_in");
  if (refIn && ref) refIn.value = ref;
  if (proIn && promo) proIn.value = promo;

  // Apply state (AMAN karena dipanggil setelah refRows/promoRows sudah terisi)
  if (ref) setRefCode(ref);
  if (promo) setPromoCode(promo);

  refreshMsg();
}

// ========= LOGIC DISKON =========
function calculatePotentialDiscount(basePrice) {
  let refDisc = 0;
  if (refState.ok && refState.row) {
    const pct = DiscountLib.toNum(refState.row.topercentdis);
    const max = DiscountLib.toNum(refState.row.tomaxdiscount);
    refDisc = Math.min(basePrice * (pct / 100), max);
  }

  let proDisc = 0;
  if (promoState.ok && promoState.row) {
    const pct = DiscountLib.toNum(promoState.row.percdiskon);
    const max = DiscountLib.toNum(promoState.row.maksimal_diskon);
    const minBuy = DiscountLib.toNum(promoState.row.minimal_pembelian);
    if (basePrice >= minBuy) proDisc = Math.min(basePrice * (pct / 100), max);
  }

  const total = DiscountLib.computeStackedDiscount(refDisc, proDisc);
  return { total, final: Math.max(0, basePrice - total) };
}

// ========= UI RENDERING =========
window.render = function () {
  const root = document.getElementById("programList");
  if (!root) return;

  const activeData = rowsAll.filter(
    (r) => (r.status || "").toLowerCase().trim() === "open"
  );
  const progs = [...new Set(activeData.map((r) => r.program))];

  if (progs.length === 0) {
    root.innerHTML = `<div class="p-4 text-center text-slate-500 italic text-sm">Belum ada program dibuka.</div>`;
    removeNextProgToast();
    resetNextHint();
    return;
  }

  // SEMUA PROGRAM SELALU TERBUKA (tidak ada hide/accordion)
  root.innerHTML = progs
    .map((p, idx) => {
      const isNextTarget = nextProgHintState.show && nextProgHintState.nextIdx === idx;

      const attachedHintHtml = isNextTarget
        ? `
          <div class="next-prog-bubble absolute -top-8 left-1/2 -translate-x-1/2 z-20 w-max pointer-events-none clue-animate">
            <div class="bg-orange-500 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-md flex items-center gap-1 border border-orange-400">
              <span>👇 Ada TO ${escapeHtml(p)} di sini</span>
            </div>
            <div class="w-2 h-2 bg-orange-500 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-r border-b border-orange-400"></div>
          </div>
        `
        : "";

      return `
        <div class="prog-item active" data-prog-idx="${idx}" id="prog-item-${idx}">
          <div class="p-3 flex items-center font-extrabold transition-all duration-300 justify-center text-lg text-sky-600 bg-sky-50/50 ${
            isNextTarget ? "relative" : ""
          }">
            
            ${attachedHintHtml}

            <span>${p}</span>
          </div>

          ${renderDetail(p, activeData, progs)}
        </div>
      `;
    })
    .join("");

  setTimeout(() => {
    applyNextProgramHintBehavior();
    bindHorizontalScrollHelpers(); // <- scroll arrows + wheel-to-horizontal
  }, 50);
};

// toggleProg sekarang tidak dipakai (biar klik header nggak ngapa-ngapain)
window.toggleProg = () => {};

// NOTE: renderDetail masih pakai window.activeCat (global) seperti kode aslimu.
// Artinya: kategori yang kamu klik akan kebawa ke semua program (karena satu state).
// Ini sama persis pola sebelumnya, cuma sekarang semua program tampil.
function renderDetail(p, dataList, allProgs) {
  const subset = dataList.filter((r) => r.program === p);
  const cats = [...new Set(subset.map((r) => r.kategori))];

  if (!window.activeCat || !cats.includes(window.activeCat)) window.activeCat = cats[0];

  visitedCats.add(window.activeCat);

  const targetClueIndex = cats.findIndex((c) => !visitedCats.has(c));
  const nextCatName = targetClueIndex >= 0 ? cats[targetClueIndex] : "";

  // Dulu: pakai window.activeProg untuk cari program berikutnya
  // Sekarang: pakai program yang sedang dirender (p)
  if (targetClueIndex === -1) {
    const currentIdx = allProgs.indexOf(p);
    const nextIdx = currentIdx + 1;
    const nextProg = allProgs[nextIdx];

    if (nextProg) {
      if (!nextProgHintState.show || nextProgHintState.nextProg !== nextProg) {
        nextProgHintState.show = true;
        nextProgHintState.nextProg = nextProg;
        nextProgHintState.nextIdx = nextIdx;
        setTimeout(() => {
          const existingBubble = document.querySelector(
            `.prog-item[data-prog-idx="${nextIdx}"] .next-prog-bubble`
          );
          if (!existingBubble) window.render();
          else applyNextProgramHintBehavior();
        }, 0);
      }
    } else {
      resetNextHint();
    }
  }

  return `
    <div class="pb-2">
      <div class="px-3 mb-3">

          <div class="cat-scroll-area hscroll" data-hscroll="1">
            ${cats
              .map((c, idx) => {
                const safeC = String(c).replace(/'/g, "\\'");
                const shouldShowHint = idx === targetClueIndex;

                return `
                  <button class="cat-btn relative ${c === window.activeCat ? "active" : ""}"
                    onclick="window.activeCat='${safeC}'; window.render()">
                    ${c}
                    ${
                      shouldShowHint
                        ? `
                      <div class="absolute -top-10 left-1/2 -translate-x-1/2 z-20 w-max pointer-events-none clue-animate">
                        <div class="bg-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow-sm flex items-center gap-1 border border-orange-400">
                          <span>Cek TO ${escapeHtml(nextCatName)} disini </span>
                        </div>
                        <div class="w-1.5 h-1.5 bg-orange-500 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-0.5 border-r border-b border-orange-400"></div>
                      </div>
                    `
                        : ""
                    }
                  </button>
                `;
              })
              .join("")}
          </div>


      </div>

      <div class="px-3">
        <div class="hscroll-wrap relative">
          <button class="hscroll-arrow left" type="button" aria-label="Scroll kiri"
            onclick="window.hscrollBy(this, -320)">
            ‹
          </button>

          <div class="pkg-grid-scroll hscroll" data-hscroll="1">
            ${subset
              .filter((r) => r.kategori === window.activeCat)
              .reverse()
              .map((r) => {
                const price = DiscountLib.toNum(r.biaya);
                const disc = calculatePotentialDiscount(price);
                const code = r.kode_to || r.kode || "";

                return `
                  <div class="pkg-card">
                    <div class="text-center font-extrabold text-base mb-1 min-h-[40px] flex items-center justify-center border-b border-slate-100 pb-1 leading-tight">
                      ${r.event}
                    </div>

                    <div class="text-xs text-slate-600 text-center mb-2 bg-slate-50 rounded-lg py-1 border border-slate-200">
                      <div class="mb-0.5 pb-0.5 border-b border-slate-200/60">
                        <div class="text-[10px] uppercase font-bold text-slate-400">Deadline</div>
                        <div class="font-black text-rose-600">${r.deadline_daftar || "Secepatnya"}</div>
                      </div>
                      <div class="text-[10px] font-bold text-slate-800 pt-0.5">Pelaksanaan: ${r.pelaksanaan || "-"}</div>
                    </div>

                    <ul class="benefit-ui">
                      ${(r.fasilitas || "")
                        .split(/[;\n]/)
                        .filter((b) => b.trim())
                        .map((b) => `<li>${b}</li>`)
                        .join("")}
                    </ul>

                    <div class="mt-auto pt-2 border-t border-dashed border-slate-300">
                      ${
                        disc.total > 0
                          ? `
                        <div class="text-right text-[10px] font-bold text-rose-500 line-through">${DiscountLib.fmtIDR(price)}</div>
                        <div class="text-right font-black text-blue-600 text-lg leading-none">${DiscountLib.fmtIDR(disc.final)}</div>
                      `
                          : `<div class="text-right font-black text-blue-600 text-lg leading-none">${DiscountLib.fmtIDR(price)}</div>`
                      }
                      <button class="btn btn-primary w-full mt-2 py-1.5 btn-daftar" data-kode="${code}">Daftar Sekarang</button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>

          <button class="hscroll-arrow right" type="button" aria-label="Scroll kanan"
            onclick="window.hscrollBy(this, 320)">
            ›
          </button>
        </div>
      </div>
    </div>
  `;
}

// ========= NEXT PROGRAM BEHAVIOR (TOAST VS BUBBLE) =========
function applyNextProgramHintBehavior() {
  if (!nextProgHintState.show || nextProgHintState.nextIdx < 0) {
    removeNextProgToast();
    return;
  }

  const targetHeader = document.querySelector(
    `.prog-item[data-prog-idx="${nextProgHintState.nextIdx}"] > div`
  );

  if (!targetHeader) {
    renderNextProgToast(nextProgHintState.nextProg);
    return;
  }

  const rect = targetHeader.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const isFarBelow = rect.top > windowHeight - 100;

  if (isFarBelow) {
    renderNextProgToast(nextProgHintState.nextProg);
  } else {
    removeNextProgToast();
  }
}

window.addEventListener(
  "scroll",
  () => {
    if (applyNextProgramHintBehavior._t) cancelAnimationFrame(applyNextProgramHintBehavior._t);
    applyNextProgramHintBehavior._t = requestAnimationFrame(applyNextProgramHintBehavior);
  },
  { passive: true }
);

window.addEventListener(
  "resize",
  () => {
    if (applyNextProgramHintBehavior._t) cancelAnimationFrame(applyNextProgramHintBehavior._t);
    applyNextProgramHintBehavior._t = requestAnimationFrame(applyNextProgramHintBehavior);
  },
  { passive: true }
);

// ========= HSCROLL HELPERS (ARROWS + WHEEL) =========
window.hscrollBy = (btnEl, dx) => {
  const wrap = btnEl?.closest(".hscroll-wrap");
  const sc = wrap?.querySelector("[data-hscroll='1']");
  if (!sc) return;
  sc.scrollBy({ left: dx, behavior: "smooth" });
};

function bindHorizontalScrollHelpers() {
  // Convert wheel vertical to horizontal on hscroll areas
  const areas = document.querySelectorAll("[data-hscroll='1']");
  areas.forEach((el) => {
    if (el._wheelBound) return;
    el._wheelBound = true;

el.addEventListener(
  "wheel",
  (e) => {
    // trackpad horizontal already ok; convert vertical only
    const absY = Math.abs(e.deltaY);
    const absX = Math.abs(e.deltaX);

    // kalau user memang lagi scroll vertikal (wheel biasa)
    if (absY > absX) {
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      const atLeft = el.scrollLeft <= 0;
      const atRight = el.scrollLeft >= maxScrollLeft - 1;

      // kalau masih bisa geser horizontal ke arah wheel, baru kita "ambil alih"
      const goingRight = e.deltaY > 0;
      const canScrollHoriz =
        (goingRight && !atRight) || (!goingRight && !atLeft);

      if (canScrollHoriz) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
      // kalau sudah mentok kiri/kanan => JANGAN preventDefault
      // biar scroll turun/naik halaman tetap jalan
    }
  },
  { passive: false }
);


    // Optional: drag-to-scroll (mouse)
    let isDown = false;
    let startX = 0;
    let startLeft = 0;

    el.addEventListener("mousedown", (e) => {
      isDown = true;
      startX = e.pageX;
      startLeft = el.scrollLeft;
      el.classList.add("dragging");
    });

    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      el.scrollLeft = startLeft - dx;
    });
  });
}

// ========= FLOAT TOAST IMPLEMENTATION =========
function renderNextProgToast(nextProg) {
  const existing = document.getElementById("next-prog-toast");

  if (existing) {
    if (existing.dataset.nextProg === nextProg) return;
    existing.dataset.nextProg = nextProg;
    const txt = document.getElementById("next-prog-toast-text");
    if (txt) txt.textContent = `👇 Ada TO ${nextProg} di bawah`;
    return;
  }

  const toast = document.createElement("div");
  toast.id = "next-prog-toast";
  toast.dataset.nextProg = nextProg;
  toast.className =
    "fixed left-1/2 -translate-x-1/2 bottom-8 z-[100] w-max max-w-[90vw] cursor-pointer clue-animate";

  toast.innerHTML = `
    <div onclick="window.scrollToNextProgFromToast()"
         class="bg-orange-500 text-white text-xs font-extrabold px-3 py-2 rounded-xl shadow-xl flex items-center justify-center gap-2 border border-orange-400 hover:bg-orange-600 transition-colors">
      <span id="next-prog-toast-text">👇 Ada TO ${escapeHtml(nextProg)} di bawah</span>
    </div>
    <div class="w-3 h-3 bg-orange-500 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1.5 border-r border-b border-orange-400"></div>
  `;

  document.body.appendChild(toast);
}

function removeNextProgToast() {
  const t = document.getElementById("next-prog-toast");
  if (t) t.remove();
}

window.scrollToNextProgFromToast = () => {
  const nextIdx = nextProgHintState.nextIdx;
  if (nextIdx < 0) return;

  removeNextProgToast();

  const el = document.querySelector(`.prog-item[data-prog-idx="${nextIdx}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

function resetNextHint() {
  nextProgHintState.show = false;
  nextProgHintState.nextProg = "";
  nextProgHintState.nextIdx = -1;
}

// ========= NAV UTILS =========
window.scrollToNextProg = (p) => {
  // sekarang hanya scroll ke program tersebut (tidak ada buka/tutup)
  const idx = [...document.querySelectorAll(".prog-item")].findIndex((x) =>
    (x.querySelector("span")?.textContent || "").trim() === String(p).trim()
  );

  if (idx >= 0) {
    document.querySelector(`.prog-item[data-prog-idx="${idx}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
};

// ========= INTERACTION =========
window.applyRef = () => {
  const el = document.getElementById("ref_in");
  if (!el) return;

  setRefCode(el.value);
  refreshMsg();
  window.render();
};

window.applyPro = () => {
  const el = document.getElementById("pro_in");
  if (!el) return;

  setPromoCode(el.value);
  refreshMsg();
  window.render();
};

function refreshMsg() {
  const mR = document.getElementById("ref_msg"),
    mP = document.getElementById("pro_msg");
  const refIn = document.getElementById("ref_in");
  const proIn = document.getElementById("pro_in");

  if (mR) {
    if (refState.ok) {
      mR.innerText = "Kode Referral Aktif!";
      mR.className = "text-[11px] mt-1 font-bold text-emerald-600 block";
      mR.classList.remove("hidden");
    } else if (refIn && refIn.value) {
      mR.innerText = "Tidak Valid";
      mR.className = "text-[11px] mt-1 font-bold text-rose-600 block";
      mR.classList.remove("hidden");
    } else {
      mR.classList.add("hidden");
    }
  }

  if (mP) {
    if (promoState.ok) {
      mP.innerText = "Kode Promo Aktif!";
      mP.className = "text-[11px] mt-1 font-bold text-emerald-600 block";
      mP.classList.remove("hidden");
    } else if (proIn && proIn.value) {
      mP.innerText = "Tidak Valid";
      mP.className = "text-[11px] mt-1 font-bold text-rose-600 block";
      mP.classList.remove("hidden");
    } else {
      mP.classList.add("hidden");
    }
  }
}

async function init() {
  try {
    // baca query dari awal (tapi apply-nya nanti)
    const q = readQueryCodes();
    queryApplyState.ref = q.ref;
    queryApplyState.promo = q.promo;

    const [p, r, o] = await Promise.all([fetch(URL_TO), fetch(URL_REF), fetch(URL_PRO)]);
    rowsAll = DiscountLib.parseCSV(await p.text());
    refRows = DiscountLib.parseCSV(await r.text());
    promoRows = DiscountLib.parseCSV(await o.text());

    const open = rowsAll.filter((r) => (r.status || "").toLowerCase().trim() === "open");
    window.activeProg = open.length ? open[0].program : "";
    window.activeCat = "";

    visitedCats.clear();
    removeNextProgToast();
    resetNextHint();

    // APPLY QUERY CODES SETELAH DATA KELAR
    applyCodesFromQueryOnce();

    window.render();
  } catch (e) {
    console.error(e);
  }
}

// ========= MODIFIED REDIRECT LOGIC =========
document.addEventListener("click", (e) => {
  const b = e.target.closest(".btn-daftar");
  if (!b) return;

  const code = b.getAttribute("data-kode");
  const f = rowsAll.find((r) => r.kode_to === code || r.kode === code);

  if (f) {
    // Simpan ke Session Storage
    sessionStorage.setItem("to_pkg_code", code);
    sessionStorage.setItem("to_pkg_name", f.event);
    sessionStorage.setItem("to_pkg_price", DiscountLib.toNum(f.biaya));

    // Ambil kode aktif
    const activeRef = refState.ok ? refState.code : "";
    const activePromo = promoState.ok ? promoState.code : "";

    if (activeRef) sessionStorage.setItem("applied_ref_code", activeRef);
    if (activePromo) sessionStorage.setItem("applied_promo_code", activePromo);

    // URL Redirect: /daftar/?paket=KODE&ref=REFERRAL&promo=PROMO
    let targetUrl = `/daftar/formulir/?paket=${encodeURIComponent(code)}`;
    if (activeRef) targetUrl += `&ref=${encodeURIComponent(activeRef)}`;
    if (activePromo) targetUrl += `&promo=${encodeURIComponent(activePromo)}`;

    window.location.href = targetUrl;
  }
});

window.copyRek = () => {
  navigator.clipboard
    .writeText("1030012515330")
    .then(() => alert("Rekening disalin!"))
    .catch(() => alert("Gagal menyalin rekening"));
};

// ========= utils =========
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
