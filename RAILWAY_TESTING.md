# Hướng Dẫn Kiểm Thử Hệ Thống Affiliate (Production)

Sau khi deploy thành công lên Railway, bạn có thể kiểm thử hệ thống theo 2 cách: Chạy script tự động hoặc thao tác thủ công.

## Cách 1: Chạy Script Test Tự Động (Khuyên dùng)

Script này sẽ tự động thực hiện mọi bước kiểm tra từ A-Z.

1.  **Lấy Domain:**
    *   Vào Railway Dashboard → Chọn Project `affiliate-service`.
    *   Vào Tab **Settings** → Mục **Networking**.
    *   Copy **Public Domain** (ví dụ: `https://affiliate-service-production.up.railway.app`).
    *   *(Nếu chưa có Domain, bấm "Generate Domain")*.

2.  **Chạy Script:**
    Tại thư mục `apps/affiliate-service`, chạy lệnh:
    ```bash
    node scripts/test-live.js
    ```

3.  **Nhập thông tin:**
    *   Script sẽ hỏi URL: Paste domain bạn vừa copy vào.
    *   Các bước còn lại sẽ tự động chạy (Health check, Tạo data mẫu, Test click, Test đơn hàng...).

---

## Cách 2: Kiểm Thử Thủ Công

Nếu bạn muốn trải nghiệm thực tế như người dùng:

### Bước 1: Setup Dữ Liệu
Gửi POST request để tạo dữ liệu mẫu (hoặc dùng Postman):
*   **URL:** `https://YOUR_DOMAIN/api/v1/seed`
*   **Header:** `X-Admin-Key: <AFFILIATE_API_KEY trong .env>`
*   **Response:** Lưu lại `apiKey` của Product và `code` của Affiliate (ví dụ: `DEMO001`).

### Bước 2: Test Link Affiliate (Click)
Mở trình duyệt (hoặc tab ẩn danh):
*   Truy cập: `https://YOUR_DOMAIN/go/app1?ref=DEMO001`
*   **Kết quả mong đợi:**
    *   Trang web sẽ redirect về `https://suckhoetaichinh.vn`.
    *   Mở DevTools (F12) → Application → Cookies.
    *   Thấy các cookie: `affiliate_ref=DEMO001`, `affiliate_id`, `affiliate_product_id`.

### Bước 3: Test Tạo Đơn Hàng (Conversion)
Giả lập một đơn hàng thành công (Server-to-Server):
*   **Method:** POST
*   **URL:** `https://YOUR_DOMAIN/api/v1/track/conversion`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `X-API-Key: <PRODUCT_API_KEY_LẤY_Ở_BƯỚC_1>`
*   **Body:**
    ```json
    {
      "orderId": "ORDER_TEST_01",
      "amount": 500000,
      "affiliateCode": "DEMO001"
    }
    ```
    *(Note: Trường `affiliateCode` là tùy chọn để force test, thực tế hệ thống sẽ tự detect từ IP/Cookie nếu tích hợp sâu).*

### Bước 4: Kiểm Tra Admin
*   Dùng Postman gọi: `GET https://YOUR_DOMAIN/api/v1/admin/overview`
*   Header: `X-Admin-Key: ...`
*   **Kết quả:** Thấy `totalClicks` tăng và `revenue` được ghi nhận.

---

## Troubleshooting
*   **Lỗi 500 Health Check:** Kiểm tra lại biến `DATABASE_URL` trong Railway Variables.
*   **Lỗi 401 Unauthorized:** Kiểm tra `AFFILIATE_API_KEY` có trùng khớp giữa local `.env` và Railway Variables không.
*   **Lỗi Permission Denied:** Đã được fix ở version mới nhất, nếu bị lại hãy redeploy.
