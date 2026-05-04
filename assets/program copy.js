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
  threshold: 100 
};

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
    root.innerHTML = `<div class="p-8 text-center text-slate-500 italic">Belum ada program dibuka.</div>`;
    removeNextProgToast();
    resetNextHint();
    return;
  }

  root.innerHTML = progs
    .map((p, idx) => {
      const isActive = window.activeProg === p;
      const isNextTarget = nextProgHintState.show && nextProgHintState.nextIdx === idx;

      const attachedHintHtml = isNextTarget
        ? `
          <div class="next-prog-bubble absolute -top-12 left-1/2 -translate-x-1/2 z-20 w-max pointer-events-none clue-animate">
            <div class="bg-orange-500 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 border border-orange-400">
              <span>Eitss, ada TO ${escapeHtml(p)} juga di bawah sini ya</span>
              <span>👇</span>
            </div>
            <div class="w-3 h-3 bg-orange-500 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1.5 border-r border-b border-orange-400"></div>
          </div>
        `
        : "";

      return `
        <div class="prog-item ${isActive ? "active" : ""}" data-prog-idx="${idx}" id="prog-item-${idx}">
          <div class="p-5 flex items-center cursor-pointer font-extrabold transition-all duration-300 ${
            isActive
              ? "justify-center text-xl text-sky-600 bg-sky-50/50"
              : "justify-between text-base text-slate-700 hover:bg-slate-50"
          } ${isNextTarget ? "relative" : ""}"
            onclick="window.toggleProg('${String(p).replace(/'/g, "\\'")}')">
            
            ${attachedHintHtml}

            <span>${p}</span>
            ${isActive ? "" : "<span>+</span>"}
          </div>
          ${isActive ? renderDetail(p, activeData, progs) : ""}
        </div>
      `;
    })
    .join("");

  setTimeout(() => {
    applyNextProgramHintBehavior();
  }, 50);
};

window.toggleProg = (p) => {
  if (window.activeProg !== p) {
    visitedCats.clear();
    window.activeCat = "";
  }

  window.activeProg = window.activeProg === p ? "" : p;
  removeNextProgToast();
  resetNextHint();
  window.render();
};

function renderDetail(p, dataList, allProgs) {
  const subset = dataList.filter((r) => r.program === p);
  const cats = [...new Set(subset.map((r) => r.kategori))];

  if (!window.activeCat || !cats.includes(window.activeCat)) window.activeCat = cats[0];

  visitedCats.add(window.activeCat);

  const targetClueIndex = cats.findIndex((c) => !visitedCats.has(c));
  const nextCatName = targetClueIndex >= 0 ? cats[targetClueIndex] : "";

  if (targetClueIndex === -1) {
    const currentIdx = allProgs.indexOf(window.activeProg);
    const nextIdx = currentIdx + 1;
    const nextProg = allProgs[nextIdx];

    if (nextProg) {
        if (!nextProgHintState.show || nextProgHintState.nextProg !== nextProg) {
            nextProgHintState.show = true;
            nextProgHintState.nextProg = nextProg;
            nextProgHintState.nextIdx = nextIdx;
            setTimeout(() => {
               const existingBubble = document.querySelector(`.prog-item[data-prog-idx="${nextIdx}"] .next-prog-bubble`);
               if(!existingBubble) window.render(); 
               else applyNextProgramHintBehavior();
            }, 0);
        }
    } else {
        resetNextHint();
    }
  }

  return `
    <div class="pb-6">
      <div class="px-5 mb-8">
        <div class="cat-scroll-area flex gap-2">
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
                    <div class="absolute -top-11 left-1/2 -translate-x-1/2 z-20 w-max pointer-events-none clue-animate">
                      <div class="bg-orange-500 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 border border-orange-400">
                        <span>Cek TO ${escapeHtml(nextCatName)} disini ya!</span>
                        <span>👇</span>
                      </div>
                      <div class="w-2 h-2 bg-orange-500 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-r border-b border-orange-400"></div>
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

      <div class="pkg-grid-scroll px-5">
        ${subset
          .filter((r) => r.kategori === window.activeCat)
          .reverse() 
          .map((r) => {
            const price = DiscountLib.toNum(r.biaya);
            const disc = calculatePotentialDiscount(price);
            const code = r.kode_to || r.kode || "";

            return `
              <div class="pkg-card">
                <div class="text-center font-extrabold text-lg mb-3 min-h-[56px] flex items-center justify-center border-b border-slate-100 pb-2">
                  ${r.event}
                </div>

                <div class="text-sm text-slate-600 text-center mb-3 bg-slate-50 rounded-xl py-2 border border-slate-200">
                  <div class="mb-1 pb-1 border-b border-slate-200/60">
                    <div class="text-xs uppercase font-bold text-slate-400">Deadline</div>
                    <div class="font-black text-rose-600">${r.deadline_daftar || "Secepatnya"}</div>
                  </div>
                  <div class="text-xs font-bold text-slate-800">Pelaksanaan: ${r.pelaksanaan || "-"}</div>
                </div>

                <ul class="benefit-ui">
                  ${(r.fasilitas || "")
                    .split(/[;\n]/)
                    .filter((b) => b.trim())
                    .map((b) => `<li>${b}</li>`)
                    .join("")}
                </ul>

                <div class="mt-auto pt-4 border-t border-dashed border-slate-300">
                  ${
                    disc.total > 0
                      ? `
                    <div class="text-right text-xs font-bold text-rose-500 line-through">${DiscountLib.fmtIDR(price)}</div>
                    <div class="text-right font-black text-blue-600 text-xl">${DiscountLib.fmtIDR(disc.final)}</div>
                  `
                      : `<div class="text-right font-black text-blue-600 text-xl">${DiscountLib.fmtIDR(price)}</div>`
                  }
                  <button class="btn btn-primary w-full mt-3 py-3 btn-daftar" data-kode="${code}">Daftar Sekarang</button>
                </div>
              </div>
            `;
          })
          .join("")}
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

  const targetHeader = document.querySelector(`.prog-item[data-prog-idx="${nextProgHintState.nextIdx}"] > div`);
  
  if (!targetHeader) {
    renderNextProgToast(nextProgHintState.nextProg);
    return;
  }

  const rect = targetHeader.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const isFarBelow = rect.top > (windowHeight - 100);

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


// ========= FLOAT TOAST IMPLEMENTATION =========
function renderNextProgToast(nextProg) {
  const existing = document.getElementById("next-prog-toast");
  
  if (existing) {
     if(existing.dataset.nextProg === nextProg) return;
     existing.dataset.nextProg = nextProg;
     const txt = document.getElementById("next-prog-toast-text");
     if(txt) txt.textContent = `Eitss, ada TO ${nextProg} juga di bawah sini ya`;
     return;
  }

  const toast = document.createElement("div");
  toast.id = "next-prog-toast";
  toast.dataset.nextProg = nextProg;
  toast.className = "fixed left-1/2 -translate-x-1/2 bottom-8 z-[100] w-max max-w-[90vw] cursor-pointer clue-animate";
  
  toast.innerHTML = `
    <div onclick="window.scrollToNextProgFromToast()" 
         class="bg-orange-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-center gap-2 border border-orange-400 hover:bg-orange-600 transition-colors">
      <span id="next-prog-toast-text">Eitss, ada TO ${escapeHtml(nextProg)} juga di bawah sini ya</span>
      <span>👇</span>
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
    const progName = nextProgHintState.nextProg;
    if(window.activeProg !== progName) {
        window.toggleProg(progName);
    }
  }
};

function resetNextHint() {
  nextProgHintState.show = false;
  nextProgHintState.nextProg = "";
  nextProgHintState.nextIdx = -1;
}

// ========= NAV UTILS =========
window.scrollToNextProg = (p) => {
  window.activeProg = p;
  window.activeCat = "";
  visitedCats.clear();
  window.render();
  setTimeout(() => {
    document.querySelector(".prog-item.active")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 150);
};

// ========= INTERACTION =========
window.applyRef = () => {
  const el = document.getElementById("ref_in");
  if (!el) return;

  const val = el.value.trim().toUpperCase();
  const f = refRows.find(
    (r) => (r.refferal_code || r.referral_code || "").toUpperCase() === val
  );

  refState =
    val && f && (f.status || "").toLowerCase() === "valid"
      ? { code: val, ok: true, row: f }
      : { code: "", ok: false, row: null };

  refreshMsg();
  window.render();
};

window.applyPro = () => {
  const el = document.getElementById("pro_in");
  if (!el) return;

  const val = el.value.trim().toUpperCase();
  const f = promoRows.find((r) => (r.kode || "").toUpperCase() === val);

  promoState = val && f ? { code: val, ok: true, row: f } : { code: "", ok: false, row: null };

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
    
    if(activeRef) sessionStorage.setItem("applied_ref_code", activeRef);
    if(activePromo) sessionStorage.setItem("applied_promo_code", activePromo);

    // URL Redirect: /daftar/?paket=KODE&ref=REFERRAL&promo=PROMO
    let targetUrl = `/daftar/?paket=${encodeURIComponent(code)}`;
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