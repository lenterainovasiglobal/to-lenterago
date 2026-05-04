// assets/discount.js
(function () {
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
    
    // Convert headers: "kode TO" -> "kode_to"
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

  function computeStackedDiscount(d1, d2) {
    const a = Math.max(0, d1);
    const b = Math.max(0, d2);
    if (a === 0 && b === 0) return 0;
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    return big + Math.round(small * 0.25);
  }

  window.DiscountLib = { parseCSV, toNum, fmtIDR, computeStackedDiscount };
})();