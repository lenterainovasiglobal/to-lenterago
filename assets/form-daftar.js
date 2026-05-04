// assets/form-daftar.js

const CACHE_BUST = "&t=" + new Date().getTime();
const URL_TO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjwit9zh6fwpl98MTQk-aqK97M0VNt4YnrTz0VQM6nIKPuvV3_K7u_XKU4_YjQar0ZWtM1qRlpwsIy/pub?gid=713863957&single=true&output=csv" + CACHE_BUST;
const URL_REF = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf4c77CKU9bs4Vl4uXub6LY5mXKf7U6gg2B1TBjfpZuwxGpF0mev6QPnHQeFiaWmwgqCs1wUiyq4jP/pub?gid=2141907053&single=true&output=csv" + CACHE_BUST;
const URL_PRO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQf4c77CKU9bs4Vl4uXub6LY5mXKf7U6gg2B1TBjfpZuwxGpF0mev6QPnHQeFiaWmwgqCs1wUiyq4jP/pub?gid=765766751&single=true&output=csv" + CACHE_BUST;

const CLOUD_NAME = "dnmicio2v";
const UPLOAD_PRESET = "tes2025";

let pkgRows = [], refRows = [], promoRows = [];
let selectedPkg = { code: "", name: "", price: 0 };
let iti; 

const promoInput = document.getElementById('promoInput');
const referralInput = document.getElementById('referralInput');
const pkgSelect = document.getElementById('packageSelect'); 

if(promoInput) promoInput.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
if(referralInput) referralInput.addEventListener('input', function() { this.value = this.value.toUpperCase(); });

// === INIT PHONE INPUT ===
const inputWa = document.querySelector("#wa_siswa");
if (inputWa) {
    iti = window.intlTelInput(inputWa, {
        initialCountry: "id",
        separateDialCode: true,
        preferredCountries: ["id", "my"],
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js"
    });

    // FITUR BARU: HANYA MENERIMA ANGKA
    inputWa.addEventListener('input', function() {
        // Hapus karakter apa pun yang BUKAN angka 0-9
        this.value = this.value.replace(/[^0-9]/g, '');
        
        // Sembunyikan error jika user sedang mengetik (validasi akhir ada di submit)
        hideError('wa_siswa', 'err-wa_siswa');
    });
}

// === FITUR BARU: VALIDASI EMAIL DINAMIS ===
const inputEmail = document.getElementById('email');
if (inputEmail) {
    inputEmail.addEventListener('input', function() {
        const val = this.value.trim();
        const errEl = document.getElementById('err-email');
        const inputEl = this;

        // Reset state dulu
        inputEl.classList.remove('input-error');
        errEl.classList.add('hidden');

        if (val === "") {
             // Biarkan kosong dulu kalau user menghapus semua, nanti kena validasi submit
             return; 
        }

        // Cek 1: Harus ada @
        if (!val.includes('@')) {
            errEl.textContent = "⚠ Email harus memiliki tanda '@'.";
            inputEl.classList.add('input-error');
            errEl.classList.remove('hidden');
            return;
        }

        // Cek 2: Setelah @ harus ada domain dan titik (misal gmail.com)
        const parts = val.split('@');
        const domain = parts[1];
        
        if (!domain || !domain.includes('.') || domain.split('.').pop().length < 2) {
            errEl.textContent = "⚠ Format email belum lengkap (contoh: .com / .id)";
            inputEl.classList.add('input-error');
            errEl.classList.remove('hidden');
            return;
        }

        // Jika lolos semua, sembunyikan error
        inputEl.classList.remove('input-error');
        errEl.classList.add('hidden');
    });
}

// === LOGIC DROPDOWN PAKET ===
if(pkgSelect) {
    pkgSelect.addEventListener('change', function() {
        const newCode = this.value;
        if(!newCode) return;
        
        hideError('packageSelect', 'err-package');

        const row = pkgRows.find(r => (r.kode_to || r.kode) === newCode);
        if(row) {
            selectedPkg.code = newCode;
            selectedPkg.name = row.event;
            selectedPkg.price = DiscountLib.toNum(row.biaya);

            sessionStorage.setItem("to_pkg_code", selectedPkg.code);
            sessionStorage.setItem("to_pkg_name", selectedPkg.name);
            sessionStorage.setItem("to_pkg_price", selectedPkg.price);

            document.getElementById("choosePkgBanner")?.classList.add("hidden");

            renderPickedPackage();
            calculateTotal();
        }
    });
}

function renderPickedPackage() {
  const elName = document.getElementById("pickedPkgName");
  const elCode = document.getElementById("pickedPkgCode");
  const elPrice = document.getElementById("pickedPkgPrice");
  const elBenefits = document.getElementById("pickedPkgBenefits");
  const elProg = document.getElementById("pickedPkgProgram");
  const elKat  = document.getElementById("pickedPkgKategori");

  if (!elName) return;

  elName.textContent = selectedPkg.name || "-";
  elCode.textContent = selectedPkg.code || "-";
  elPrice.textContent = selectedPkg.price ? DiscountLib.fmtIDR(selectedPkg.price) : "-";
  elBenefits.innerHTML = "";

  if (!selectedPkg.code || pkgRows.length === 0) return;

  const row = pkgRows.find(r => String(r.kode_to || r.kode || "").trim() === String(selectedPkg.code).trim());
  if (!row) return;

  elProg.textContent = row.program || "-";
  elKat.textContent  = row.kategori || "-";
  
  const benefits = String(row.fasilitas || "").split(/\r?\n|;/).map(x => x.trim()).filter(Boolean);
  elBenefits.innerHTML = benefits.map(b => `<li class="flex gap-2"><span class="text-emerald-600 font-black">✓</span><span>${b}</span></li>`).join("");
}

function getRefDiscount(code, basePrice) {
    const c = (code || "").trim().toUpperCase();
    if (!c) return 0;
    const row = refRows.find(r => (r.refferal_code || r.referral_code || "").toUpperCase() === c);
    if (!row || (row.status || "").toLowerCase() !== "valid") return 0;

    const pct = DiscountLib.toNum(row.topercentdis);
    const max = DiscountLib.toNum(row.tomaxdiscount);
    return Math.min(basePrice * (pct / 100), max);
}

function getPromoDiscount(code, basePrice) {
    const c = (code || "").trim().toUpperCase();
    if (!c) return 0;
    const row = promoRows.find(r => (r.kode || "").toUpperCase() === c);
    if (!row) return 0;

    const minBuy = DiscountLib.toNum(row.minimal_pembelian);
    if (basePrice < minBuy) return 0;

    const pct = DiscountLib.toNum(row.percdiskon);
    const max = DiscountLib.toNum(row.maksimal_diskon);
    return Math.min(basePrice * (pct / 100), max);
}

function calculateTotal() {
    const basePrice = selectedPkg.price || 0;
    const refCode = (referralInput.value || "").trim().toUpperCase();
    const promoCode = (promoInput.value || "").trim().toUpperCase();

    const dRef = getRefDiscount(refCode, basePrice);
    const dPro = getPromoDiscount(promoCode, basePrice);

    referralInput.style.color = dRef > 0 ? "#10b981" : (refCode ? "#ef4444" : "");
    referralInput.style.fontWeight = dRef > 0 ? "800" : "";
    
    promoInput.style.color = dPro > 0 ? "#10b981" : (promoCode ? "#ef4444" : "");
    promoInput.style.fontWeight = dPro > 0 ? "800" : "";

    sessionStorage.setItem("to_ref_code", refCode);
    sessionStorage.setItem("to_promo_code", promoCode);

    const totalCut = DiscountLib.computeStackedDiscount(dRef, dPro);
    const finalPrice = Math.max(0, basePrice - totalCut);

    let shownRef = dRef;
    let shownPro = dPro;
    if (dRef > 0 && dPro > 0) {
        if (dRef >= dPro) shownPro = Math.round(dPro * 0.25);
        else shownRef = Math.round(dRef * 0.25);
    }

    document.getElementById('price-after').textContent = DiscountLib.fmtIDR(basePrice);
    document.getElementById('refferal').textContent = '- ' + DiscountLib.fmtIDR(shownRef);
    document.getElementById('promotion').textContent = '- ' + DiscountLib.fmtIDR(shownPro);
    document.getElementById('total-cut').textContent = '- ' + DiscountLib.fmtIDR(totalCut);
    document.getElementById('final-amount').textContent = DiscountLib.fmtIDR(finalPrice);
}
window.calculateTotal = calculateTotal;

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
  const fd = new FormData();
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("file", file);
  const res = await fetch(url, { method: "POST", body: fd });
  const data = await res.json();
  return data.secure_url || "";
}

// === UTILS VALIDASI ===
function showError(inputId, msgId, customText = null) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if(input) input.classList.add('input-error');
    if(msg) {
        if(customText) msg.textContent = customText;
        msg.classList.remove('hidden');
    }
}

function hideError(inputId, msgId) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if(input) input.classList.remove('input-error');
    if(msg) msg.classList.add('hidden');
}

// Reset error saat mengetik (untuk input standar selain Email & WA yang punya logic khusus)
['nama', 'tgl_lahir'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('input', () => hideError(id, `err-${id}`));
    }
});

function updateFileName(input) {
  const area = document.getElementById('preview-text');
  const file = input.files && input.files[0];

  hideError('uploadArea', 'err-bukti');

  if (file) {
    if (!file.type.startsWith('image/')) {
        alert("Maaf, hanya file gambar (JPG/PNG) yang diperbolehkan. PDF tidak diizinkan.");
        input.value = ""; 
        area.innerHTML = `<p class="text-sm font-bold text-slate-600">Klik untuk upload bukti transfer</p><p class="text-xs text-slate-400 mt-1">Hanya Gambar (JPG, PNG).</p>`;
        return;
    }
    area.innerHTML = `<p class="text-sm font-bold text-emerald-600">Terpilih: ${file.name}</p>`;
  }
}
document.getElementById('uploadArea').addEventListener('click', () => document.getElementById('bukti_bayar').click());

// === SUBMIT HANDLER DENGAN VALIDASI ===
document.getElementById('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  let isValid = true;

  if (!selectedPkg.code) {
      showError('packageSelect', 'err-package');
      isValid = false;
  } else {
      hideError('packageSelect', 'err-package');
  }

  const nama = document.getElementById('nama').value.trim();
  if (!nama) { showError('nama', 'err-nama'); isValid = false; }

  const tgl = document.getElementById('tgl_lahir').value;
  if (!tgl) { showError('tgl_lahir', 'err-tgl_lahir'); isValid = false; }

  // VALIDASI EMAIL SAAT SUBMIT (Pastikan Regex validasi email standar)
  const emailVal = document.getElementById('email').value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex standar email
  if (!emailVal) { 
      showError('email', 'err-email', "⚠ Email wajib diisi."); 
      isValid = false; 
  } else if (!emailPattern.test(emailVal)) {
      showError('email', 'err-email', "⚠ Format email tidak valid."); 
      isValid = false; 
  }

  // VALIDASI WA SAAT SUBMIT
  // Cek apakah nomor valid secara internasional (+62...)
  if (!iti.isValidNumber()) {
      showError('wa_siswa', 'err-wa_siswa', "⚠ Nomor WhatsApp tidak valid.");
      isValid = false;
  } else {
      hideError('wa_siswa', 'err-wa_siswa');
  }

  const fileInput = document.getElementById('bukti_bayar');
  const file = fileInput.files[0];
  if (!file) {
      showError('uploadArea', 'err-bukti');
      isValid = false;
  } else if (!file.type.startsWith('image/')) {
      alert("Bukti pembayaran harus berupa gambar (JPG/PNG).");
      showError('uploadArea', 'err-bukti');
      isValid = false;
  }

  if (!isValid) {
      const firstError = document.querySelector('.input-error');
      if(firstError) firstError.scrollIntoView({behavior: 'smooth', block: 'center'});
      return;
  }

  const fd = new FormData(e.target);
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.innerText = "Memproses...";
  submitBtn.disabled = true;

  try {
    const buktiUrl = await uploadToCloudinary(file);
    
    // Ambil Nomor Full dengan kode negara
    const fullWa = iti.getNumber();

    const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLScoSGikWQMnNrIrzOGGjRwfGlM26CzoyscQF_JPsqX6EiiMRA/formResponse";
    
    const params = new URLSearchParams();
    params.append("entry.1396138807", fd.get("nama"));       
    params.append("entry.321551140", fd.get("email"));       
    params.append("entry.976979149", fd.get("tgl_lahir"));   
    params.append("entry.748072089", fullWa); // GUNAKAN NOMOR LENGKAP +62
    params.append("entry.1440813157", selectedPkg.code);     
    params.append("entry.1151595007", buktiUrl);             
    params.append("entry.840537132", promoInput.value.toUpperCase());   
    params.append("entry.2135777566", referralInput.value.toUpperCase()); 

    await fetch(formUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    // === PERUBAHAN SATU-SATUNYA: redirect berdasarkan referral ===
    const refCode = (referralInput.value || "").trim().toUpperCase();
    window.location.href = (refCode === "NURDWH") ? "/daftar/sukses2" : "/daftar/sukses";

  } catch (err) {
      alert("Gagal memproses pendaftaran. Coba lagi.");
      console.error(err);
      submitBtn.innerText = "Kirim Pendaftaran TO";
      submitBtn.disabled = false;
  }
});

// === LOGIC DROPDOWN ===
function setupPackageDropdown() {
    if(!pkgSelect) return;
    
    pkgSelect.innerHTML = '<option value="" disabled selected>-- Pilih Paket TO --</option>';

    const openPkgs = pkgRows.filter(r => (r.status || "").toLowerCase().trim() === "open");

    const categories = [];
    const pkgsByCat = {};

    openPkgs.forEach(p => {
        const cat = p.kategori || "Lainnya";
        if(!pkgsByCat[cat]) {
            categories.push(cat);
            pkgsByCat[cat] = [];
        }
        pkgsByCat[cat].push(p);
    });

    categories.forEach(cat => {
        const catPkgs = pkgsByCat[cat].reverse(); 
        
        const group = document.createElement('optgroup');
        group.label = cat;

        catPkgs.forEach(r => {
            const code = r.kode_to || r.kode;
            const name = r.event;
            const price = DiscountLib.fmtIDR(DiscountLib.toNum(r.biaya));
            
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${name} (${price})`;
            group.appendChild(opt);
        });
        
        pkgSelect.appendChild(group);
    });

    if(selectedPkg.code) {
        pkgSelect.value = selectedPkg.code;
    }
}

async function init() {
  // Ambil state awal dari sessionStorage
  selectedPkg.code = (sessionStorage.getItem("to_pkg_code") || "").trim();
  selectedPkg.name = (sessionStorage.getItem("to_pkg_name") || "").trim();
  selectedPkg.price = DiscountLib.toNum(sessionStorage.getItem("to_pkg_price"));

  if (!selectedPkg.code) document.getElementById("choosePkgBanner")?.classList.remove("hidden");

  // Ambil parameter URL, tapi JANGAN diaplikasikan dulu sebelum CSV keload
  const urlParams = new URLSearchParams(window.location.search);
  const pendingPkg = (urlParams.get('paket') || "").trim();
  const pendingRef = (urlParams.get('ref') || "").trim();
  const pendingPromo = (urlParams.get('promo') || "").trim();

  // Load semua CSV dulu
  const [pkgRes, refRes, proRes] = await Promise.all([fetch(URL_TO), fetch(URL_REF), fetch(URL_PRO)]);
  pkgRows = DiscountLib.parseCSV(await pkgRes.text());
  refRows = DiscountLib.parseCSV(await refRes.text());
  promoRows = DiscountLib.parseCSV(await proRes.text());

  // Setup dropdown setelah data paket ready
  setupPackageDropdown();

  // 1) Paket: setelah pkgRows ready, baru set paket dari URL (kalau ada), atau fallback ke sessionStorage
  const finalPkgCode = (pendingPkg || selectedPkg.code || "").trim();
  if (finalPkgCode) {
    const row = pkgRows.find(r => String(r.kode_to || r.kode || "").trim() === String(finalPkgCode).trim());
    if (row) {
      selectedPkg.code = finalPkgCode;
      selectedPkg.name = row.event;
      selectedPkg.price = DiscountLib.toNum(row.biaya);

      sessionStorage.setItem("to_pkg_code", selectedPkg.code);
      sessionStorage.setItem("to_pkg_name", selectedPkg.name);
      sessionStorage.setItem("to_pkg_price", selectedPkg.price);

      document.getElementById("choosePkgBanner")?.classList.add("hidden");

      if (pkgSelect) pkgSelect.value = selectedPkg.code;
    }
  }

  // 2) Referral: setelah refRows ready, baru masukkan kodenya (URL menang)
  const finalRef = (pendingRef || sessionStorage.getItem("to_ref_code") || "").trim();
  if (finalRef) {
    sessionStorage.setItem("to_ref_code", finalRef);
    if (referralInput) referralInput.value = finalRef.toUpperCase();
  }

  // 3) Promo: setelah promoRows ready, baru masukkan kodenya (URL menang)
  const finalPromo = (pendingPromo || sessionStorage.getItem("to_promo_code") || "").trim();
  if (finalPromo) {
    sessionStorage.setItem("to_promo_code", finalPromo);
    if (promoInput) promoInput.value = finalPromo.toUpperCase();
  }

  // Render dan hitung setelah semua state + CSV siap
  renderPickedPackage();
  calculateTotal();
}


window.copyRek = () => {
    const rek = document.getElementById('rekening').textContent.trim();
    navigator.clipboard.writeText(rek).then(() => alert('Nomor rekening disalin: ' + rek));
};

init();
