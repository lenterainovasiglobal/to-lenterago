// assets/discount.js
(function () {
  let isAlertShowing = false;

  function parseCSV(text) {
    const result = [];
    let row = [''], i = 0, quote = false;
    for (let idx = 0; idx < text.length; idx++) {
      const char = text[idx];
      if (char === '"') {
        if (quote && text[idx + 1] === '"') { row[i] += '"'; idx++; }
        else quote = !quote;
      } else if (char === ',' && !quote) { row[++i] = ''; }
      else if ((char === '\n' || char === '\r') && !quote) {
        if (char === '\r' && text[idx + 1] === '\n') idx++;
        result.push(row); row = ['']; i = 0;
      } else { row[i] += char; }
    }
    if(row.length > 0 && row[0] !== '') result.push(row);
    
    const headers = (result[0] || []).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
    return result.slice(1).filter(r => r && r.some(x => String(x || "").trim() !== "")).map(r => {
        let obj = {};
        headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").toString().trim());
        return obj;
    });
  }

  function toNum(str) {
    return parseInt(String(str || "0").replace(/[^\d]/g, ""), 10) || 0;
  }

  function fmtIDR(num) {
    return "Rp " + new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(Number(num) || 0)));
  }

  // --- FUNGSI EKSEKUSI (Pasti Panggil Fungsi di File Lain) ---
  function forceApplyLogic() {
    // Jalankan apply di halaman Program (program.js)
    if (typeof window.applyRef === 'function') window.applyRef();
    if (typeof window.applyPro === 'function') window.applyPro();
    
    // Jalankan hitung di halaman Formulir (form-daftar.js)
    if (typeof window.calculateTotal === 'function') window.calculateTotal();
  }

  // --- FUNGSI MODAL CUSTOM ---
  function showNurdwhModal() {
    if (isAlertShowing) return;
    isAlertShowing = true;

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);`;

    const modal = document.createElement('div');
    modal.style.cssText = `background:#fff;padding:30px;border-radius:20px;max-width:90%;width:400px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);`;

    modal.innerHTML = `
      <div style="font-size:60px;margin-bottom:10px;">⚠️</div>
      <div style="font-weight:900;font-size:1.3rem;color:#1e293b;margin-bottom:15px;font-family:sans-serif;">PEMBATALAN DISKON</div>
      <p style="color:#475569;font-size:1rem;line-height:1.6;margin-bottom:25px;font-family:sans-serif;">
        Kode Referral <b style="color:#e11d48;">"NURDWH"</b> tidak bisa gabung dengan kode promo apapun.
      </p>
      <button id="btnCloseNurdwh" style="background:#1e293b;color:#fff;border:none;padding:15px 0;width:100%;border-radius:12px;font-weight:800;cursor:pointer;font-size:1rem;">OKE, SAYA MENGERTI</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('btnCloseNurdwh').onclick = function() {
      // Kosongkan semua input
      ['promoInput', 'referralInput', 'pro_in', 'ref_in'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      
      document.body.removeChild(overlay);
      isAlertShowing = false;
      forceApplyLogic(); // Reset tampilan harga setelah input kosong
    };
  }

  function computeStackedDiscount(d1, d2) {
    const p = (document.getElementById('promoInput')?.value || document.getElementById('pro_in')?.value || "").trim().toUpperCase();
    const r = (document.getElementById('referralInput')?.value || document.getElementById('ref_in')?.value || "").trim().toUpperCase();

    // Jika salah satu adalah NURDWH dan dua-duanya punya nilai diskon (>0)
    if ((p === "NURDWH" || r === "NURDWH") && d1 > 0 && d2 > 0) {
      showNurdwhModal();
      return 0; // Batalkan diskon
    }

    const a = Math.max(0, d1), b = Math.max(0, d2);
    if (a === 0 && b === 0) return 0;
    const big = Math.max(a, b), small = Math.min(a, b);
    return big + Math.round(small * 0.25);
  }

  // --- LOGIKA AUTO-APPLY (PASTI JALAN) ---
  // Menggunakan Event Delegation pada document agar elemen baru pun terdeteksi
  document.addEventListener('focusout', function(e) {
    if (['promoInput', 'referralInput', 'pro_in', 'ref_in'].includes(e.target.id)) {
      forceApplyLogic();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && ['promoInput', 'referralInput', 'pro_in', 'ref_in'].includes(e.target.id)) {
      e.preventDefault();
      forceApplyLogic();
      e.target.blur(); // Menghilangkan fokus agar trigger focusout juga jika perlu
    }
  });

  window.DiscountLib = { parseCSV, toNum, fmtIDR, computeStackedDiscount };
})();