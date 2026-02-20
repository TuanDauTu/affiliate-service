# HƯỚNG DẪN CONFIG RAILWAY (DATABASE & VARIABLES)

Service của bạn đang thiếu kết nối Database. Hãy làm theo các bước sau để fix:

## BƯỚC 1: TẠO DATABASE (Nếu chưa có)
1. Trong giao diện Project trên Railway.
2. Bấm nút **+ New** (hoặc chuột phải chọn New service).
3. Chọn **Database** -> **PostgreSQL**.
4. Chờ vài giây để database được tạo.

## BƯỚC 2: LẤY DATABASE URL
1. Click vào khối **PostgreSQL** vừa tạo.
2. Chuyển sang tab **Variables**.
3. Tìm dòng **DATABASE_URL**.
4. Bấm biểu tượng 📋 (Copy) để copy toàn bộ giá trị.

## BƯỚC 3: CẤU HÌNH CHO SERVICE CỦA BẠN
1. Click vào khối **affiliate-service** (App của bạn).
2. Chuyển sang tab **Variables**.
3. Bấm **New Variable**.
4. Nhập tên biến: `DATABASE_URL`.
5. Paste giá trị vừa copy vào ô Value.
6. Bấm **Add**.
7. App sẽ tự động Redeploy.

## BƯỚC 4: CÁC BIẾN KHÁC (BẮT BUỘC)
Đảm bảo bạn cũng đã set các biến này trong tab **Variables** của affiliate-service:

| Tên | Giá trị mẫu (Tự đổi cho bảo mật) |
|-----|-----------------------------------|
| `NODE_ENV` | `production` |
| `AFFILIATE_API_KEY` | `sk_aff_secret_key_cua_ban` |
| `JWT_SECRET` | `chuoi_bao_mat_ngau_nhien` |

## KIỂM TRA
- Sau khi redeploy, vào tab **Deploy Logs**.
- Nếu thấy dòng: `✅ Migrations applied successfully` và `✅ Affiliate Service running...` là thành công!
