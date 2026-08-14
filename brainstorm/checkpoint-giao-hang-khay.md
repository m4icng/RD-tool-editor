---
# BẢN THẢO BRAINSTORM: Checkpoint giao hàng và visual khay
**Ngày:** 2026-08-12
**Trạng thái:** 🟢 Đã triển khai

## 1. Tóm tắt & Quyết định cốt lõi

- Rắn không đi vào ô khay để giao hàng nữa, tránh mắc kẹt/ngõ cụt và không thể quay đầu khi có đuôi.
- Mỗi khay sử dụng một checkpoint nằm trên hoặc sát đường đi để kích hoạt giao hàng.
- Cargo được chuyển vào khay lần lượt, không cập nhật toàn bộ recipe và đổi tray layer ngay lập tức.
- Trong lúc chuyển, khay và HUD phải hiển thị rõ loại fruit hiện tại còn cần.
- Map, fruit layers, cargo và queue layer độc lập của từng khay vẫn tuân theo spec hiện tại.
- Ô khay `(x, y)` chỉ dùng để render visual và tuyệt đối không thể đi vào.
- Checkpoint giao hàng là một dot cố định tại ô ngay bên dưới khay `(x, y+1)`; đây mới là tọa độ gameplay thực và bắt buộc phải nằm trên đường đi.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

```text
Snake đi qua checkpoint
        ↓
Tạo delivery queue từ cargo hợp lệ
        ↓
Chuyển từng fruit → cập nhật visual → cập nhật delivered
        ↓
Khi queue rỗng: kiểm tra layer khay đủ 9
        ↓
Đủ recipe → mới chuyển sang tray layer tiếp theo
```

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | Quan hệ vị trí giữa ô khay, checkpoint và đường đi? | Điểm giao hàng là dot bên dưới ô khay; không thể đi trực tiếp vào ô khay. Ô bên dưới mới là điểm gameplay đúng. | Khay tại `(x,y)` là visual/non-traversable; checkpoint tại `(x,y+1)` nằm trên path và kích hoạt giao hàng. |
| 2 | Rắn xử lý thế nào khi có cargo phù hợp tại checkpoint? | Người dùng yêu cầu cập nhật logic vào Playable; áp dụng Option A đã đề xuất. | Rắn chuyển sang `DELIVERING`, dừng tại checkpoint và khóa input cho tới khi giao xong. |
| 3 | Cargo mix được lấy theo thứ tự nào? | Suy ra từ hàng đang kéo và recipe hiện tại. | Duyệt từ đầu hàng; giao từng fruit còn thiếu, giữ nguyên thứ tự các fruit không phù hợp. |
| 4 | Visual khay hiển thị gì? | Cần thể hiện loại quả khay đang cần. | Hiển thị đồng thời icon và số lượng còn thiếu của mọi loại trong tray layer hiện tại; cập nhật sau từng fruit. |
| 5 | Khi nào đổi tray layer? | Không được đổi tức thì cùng lúc với cả cargo. | Chỉ đổi sau animation của fruit cuối cùng làm đủ recipe; tiếp tục giao layer kế nếu cargo còn phù hợp. |

## 4. Quy tắc triển khai

- Nhịp giao mặc định: 280 ms/fruit; WASD, phím mũi tên và swipe bị khóa trong `DELIVERING`.
- Fruit khay không cần được giữ nguyên trong hàng và không chặn các fruit phù hợp khác.
- Ô visual khay luôn bị chặn kể cả dữ liệu cũ còn đánh dấu path dưới ô đó.
- Khi đặt khay trong Editor, ô bên dưới tự được tạo path/checkpoint; không cho đặt khay ở hàng cuối.
- Playable validation chặn level nếu checkpoint nằm ngoài map hoặc không nằm trên path.

## 5. Kết quả cuối phiên

Đã tích hợp checkpoint tách biệt, giao hàng tuần tự, visual nhu cầu khay và dữ liệu mẫu tương thích vào Playable.
---
