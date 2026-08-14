---
# BẢN THẢO BRAINSTORM: Nhóm dữ liệu tray theo ID
**Ngày:** 2026-08-13
**Trạng thái:** ✅ Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- Mục tiêu là chỉ khai báo ID của mỗi tray một lần, thay vì lặp `trayId` trong `positions` và từng phần tử `layers`.
- Một level vẫn có nhiều tray; mỗi tray sở hữu checkpoint và queue layer/recipe độc lập.
- `trays` là mảng các tray group; mỗi group khai báo `trayId` đúng một lần, có đúng một phần tử trong `positions[]`, và chứa `layers[]` riêng.
- Import tiếp tục nhận schema tray phẳng cũ để chuyển tiếp; export chỉ sinh schema grouped mới.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

```text
Level.trays
  └─ Tray (ID khai báo một lần)
       ├─ position/checkpoint
       └─ layers[]
            └─ items[]
```

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | Với nhiều tray, có dùng `trays[]` gồm object `{ trayId, positions, layers }` không? | Đúng. | Dùng mảng tray group; không lặp `trayId` trong position hoặc layer. |

## 4. [OPEN FLAGS] — Điểm chưa rõ, cần kiểm tra hoặc xác nhận thêm

- Không còn open flag blocking implementation.

## 5. Kết quả cuối phiên

Đã chốt schema grouped cho tray và chính sách chuyển tiếp từ file schema phẳng cũ.
---
