// Chạy trong Console của trình duyệt khi đang mở https://sofifa.com/document (đã qua kiểm tra Cloudflare).
// Thử các cách gắn token vào https://api.sofifa.net/leagues để tìm cách đúng.
// Token nhập qua hộp thoại, không lưu vào file hay lịch sử; kết quả in ra Console đã che token.
(async () => {
  const token = prompt("Dán API token sofifa (không gửi cho ai):");
  if (!token) return console.warn("Chưa nhập token.");
  const base = "https://api.sofifa.net/leagues";
  const mask = (s) => s.split(token).join("***");
  const attempts = [
    { name: "không token (cookie)", url: base, init: { credentials: "include" } },
    { name: "Authorization: Bearer", url: base, init: { headers: { Authorization: `Bearer ${token}` } } },
    { name: "Authorization: <token>", url: base, init: { headers: { Authorization: token } } },
    { name: "x-api-key", url: base, init: { headers: { "x-api-key": token } } },
    { name: "?key=", url: `${base}?key=${encodeURIComponent(token)}`, init: {} },
    { name: "?token=", url: `${base}?token=${encodeURIComponent(token)}`, init: {} },
    { name: "?access_token=", url: `${base}?access_token=${encodeURIComponent(token)}`, init: {} },
  ];
  const results = [];
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, a.init);
      const text = await res.text();
      results.push({ cách: a.name, status: res.status, mẫu: mask(text.slice(0, 300)) });
    } catch (e) {
      results.push({ cách: a.name, status: "lỗi", mẫu: `${e.message} (có thể do CORS)` });
    }
  }
  console.table(results);
  const ok = results.find((r) => r.status === 200);
  console.log(ok ? `Cách dùng được: ${ok.cách}. Dán bảng trên cho Claude (đã che token).` : "Không cách nào trả 200. Dán bảng trên cho Claude.");
})();
