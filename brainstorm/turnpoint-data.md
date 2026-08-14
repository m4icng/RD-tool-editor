---
# BẢN THẢO BRAINSTORM: Turnpoint trong dữ liệu level
**Ngày:** 2026-08-13
**Trạng thái:** ✅ Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- `turnpoint` là tập các ô trên road nơi đầu rắn phải dừng và chờ người chơi chọn hướng tiếp theo.
- Playable phải dùng dữ liệu turnpoint của level thay cho việc chỉ suy luận điểm dừng từ số nhánh đường.
- Schema đã chốt: `turnpoint: { index: [...] }` nằm ở root, song song với `road`.
- Mọi mảng có khóa `index` được xuất gọn trên một dòng để giảm diện tích và dung lượng JSON.
- Mọi điểm nối cần rẽ hướng đều là turnpoint: gồm góc cua có hai nhánh vuông góc và giao lộ có từ ba nhánh; đoạn thẳng và ngõ cụt không tự tạo turnpoint.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

```text
JSON turnpoint → Editor state → Playable session
                                ↓
                    Snake đi vào turnpoint
                                ↓
                   WAITING → chờ WASD/Arrow/Swipe
```

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | Xác nhận schema và cách trình bày các mảng index? | Các giá trị index xuất hiện cùng một dòng để tiết kiệm diện tích và giảm dung lượng file. | Dùng `turnpoint.index`; compact `road.index`, `turnpoint.index` và `items[].index` thành mảng một dòng. |
| 2 | Những vị trí đường nào phải có turnpoint? | Tất cả các điểm tiếp nối rẽ hướng đều có data turnpoint. | Góc cua và giao lộ được xuất turnpoint; đoạn thẳng hai đầu đối diện và endpoint không được xuất. |

## 4. [OPEN FLAGS] — Điểm chưa rõ, cần kiểm tra hoặc xác nhận thêm

- Không còn open flag blocking implementation.

## 5. Kết quả cuối phiên

Đã chốt schema turnpoint, quy tắc sinh turnpoint từ mọi góc rẽ/giao lộ và định dạng JSON compact cho các mảng index.
---
