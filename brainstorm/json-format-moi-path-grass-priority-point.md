---
# BẢN THẢO BRAINSTORM: JSON Format mới — Path, Grass và PriorityPoint
**Ngày:** 2026-08-13
**Trạng thái:** ✅ Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- File tham chiếu dùng map `13 × 17`; editor đã cho phép kích thước nguyên dương nên không cần thay đổi luật kích thước.
- `Path.index` có vẻ thay thế `road.index` và vẫn là danh sách index zero-based row-major.
- `PriorityPoint.index` trong file mẫu trùng chính xác tập góc cua và giao lộ suy ra từ `Path.index`: `[0,12,91,97,103,208,214,220]`.
- Schema tray đã khớp phiên bản editor hiện tại: `deliverPoint`, `trayPosition`, `layers`.
- Field `Grass` chưa có cấu trúc dữ liệu hợp lệ trong file mẫu.
- Mọi ô nền xanh ban đầu là cỏ; dữ liệu cỏ vẫn phải lưu index để game liệt kê trường hợp chọn sprite và bo góc theo hướng.
- Grass mặc định được tự sinh là toàn bộ ô không thuộc Path, nhưng cho phép người thiết kế chỉnh thủ công sau đó.
- `Path.index` và `Grass.index` loại trừ nhau. Ô không thuộc cả hai được giữ trống để dành cho terrain/element khác trong tương lai.
- Format mới là format duy nhất được hỗ trợ: export dùng `Path`, `Grass`, `PriorityPoint`; import file còn dùng `road/turnpoint` sẽ bị từ chối.
- `PriorityPoint` tự sinh từ mọi góc cua của Path, nhưng vẫn cho phép người thiết kế set thủ công.
- Người thiết kế có thể thêm hoặc xóa cả PriorityPoint tự sinh; mọi PriorityPoint luôn phải thuộc Path.
- UI sẽ thêm tab `Terrain` cạnh `Item` và `Element` để chỉnh dữ liệu địa hình.
- Tab Terrain gồm `Grass`, `Terrain trống`, `PriorityPoint`; công cụ `Vẽ đường` hiện tại vẫn giữ riêng.
- Khi xóa Path, ô đó luôn trở lại Grass; PriorityPoint trên ô Path bị xóa cũng bị loại bỏ.
- PriorityPoint chỉ tự sinh khi thao tác vẽ vừa tạo góc Path mới. Khi import, editor giữ nguyên chính xác `PriorityPoint.index` và không tự bổ sung các góc đã bị xóa thủ công.
- Khi chọn PriorityPoint, chuột trái chỉ thêm; chuột phải/Xóa thông minh xóa PriorityPoint trước và giữ Path trong cùng thao tác.
- Khi tăng kích thước map, mọi ô mới mặc định là Grass và được thêm vào `Grass.index`.
- Khi topology thay đổi, PriorityPoint nguồn tự sinh bị xóa nếu ô không còn là góc; PriorityPoint nguồn thủ công vẫn được giữ miễn là còn thuộc Path.
- Mọi PriorityPoint từ file import được xem là thủ công để bảo toàn dữ liệu; chỉ điểm editor tự sinh trong phiên hiện tại mang nguồn tự sinh.
- `Path`, `Grass`, `PriorityPoint` đều là field bắt buộc, đúng capitalization và có cấu trúc `{ "index": [...] }`; import từ chối file thiếu/sai field.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

| Field mới | Field editor hiện tại | Nhận định |
|---|---|---|
| `map.width/height` | `grid.columns/rows` | Tương thích |
| `Path.index` | `road.index` | Có vẻ là đổi tên/capitalization |
| `Grass` | Chưa có | Placeholder, cần chốt schema và ý nghĩa |
| `PriorityPoint.index` | `turnpoint.index` | Dữ liệu mẫu khớp toàn bộ góc cua/giao lộ |
| `spawns` | `spawns` | Tương thích |
| `itemLayers` | `itemLayers` | Tương thích |
| `trays` | `trays` | Tương thích schema `deliverPoint/trayPosition` |
| `elements` | `elements` | Vẫn là object rỗng |

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | Field `Grass` chính thức lưu dữ liệu theo cách nào? | Tất cả phần ban đầu màu xanh đều là cỏ và vẫn lưu trường index để phục vụ chọn sprite/bo góc theo hướng. | Dùng `Grass.index`; dữ liệu cỏ không được lược bỏ dù có thể suy ra từ map. |
| 2 | Editor xác định `Grass.index` theo quy luật nào? | Option C. | Khởi tạo Grass bằng phần bù của Path, sau đó cho phép chỉnh Grass thủ công. |
| 3 | Quan hệ giữa `Grass.index` và `Path.index` khi chỉnh thủ công? | Option C. | Không cho phép trùng; ô không thuộc cả hai là terrain trống dự phòng cho loại nền/element tương lai. |
| 4 | Xử lý key mới và format cũ như thế nào? | Option B. | Chỉ hỗ trợ format mới; không import/migration `road/turnpoint` cũ. |
| 5 | `PriorityPoint.index` được tạo và chỉnh sửa theo quy luật nào? | Tự sinh từ mọi góc cua, nhưng vẫn cho phép người thiết kế tự set thủ công. | Có tập tự sinh từ hình dạng Path và có thao tác thủ công trong editor. |
| 6 | Quyền chỉnh thủ công PriorityPoint ở mức nào? | Option B. | Cho phép thêm/xóa mọi PriorityPoint, kể cả điểm tự sinh; cấm PriorityPoint ngoài Path. |
| 7 | Công cụ chỉnh Grass và PriorityPoint đặt ở đâu? | Thêm tab Terrain. | Thêm category `Terrain` vào palette hiện tại. |
| 8 | Tab Terrain chứa lựa chọn nào? | Option A. | Grass, Terrain trống, PriorityPoint; giữ công cụ Vẽ đường hiện tại. |
| 9 | Terrain của ô sau khi xóa Path là gì? | Option A. | Luôn trả về Grass và xóa PriorityPoint liên quan. |
| 10 | Làm sao giữ việc xóa PriorityPoint tự sinh sau lưu/import? | Option A. | Chỉ sinh khi tạo góc mới; import giữ nguyên PriorityPoint trong file. |
| 11 | Thao tác thêm/xóa PriorityPoint thế nào? | Option A. | Trái thêm; phải/Xóa thông minh xóa PriorityPoint trước, không xóa Path cùng lúc. |
| 12 | Terrain mặc định khi tăng kích thước map? | Option A. | Mọi ô mới là Grass và được thêm vào Grass.index. |
| 13 | PriorityPoint tự sinh khi ô không còn là góc được xử lý thế nào? | Option A. | Xóa điểm tự sinh; giữ điểm thủ công nếu ô vẫn thuộc Path. |
| 14 | Phân loại nguồn PriorityPoint khi import thế nào? | Option B. | Tất cả điểm import là thủ công; không tự xóa do thay đổi topology trừ khi Path của chính ô bị xóa. |
| 15 | Ba field mới có bắt buộc khi import không? | Option A. | Path, Grass, PriorityPoint đều bắt buộc, đúng capitalization và cấu trúc index. |

## 4. [OPEN FLAGS] — Điểm chưa rõ, cần kiểm tra hoặc xác nhận thêm

- Không còn open flag chặn triển khai.

## 5. Kết quả cuối phiên

- Format mới bắt buộc dùng `Path.index`, `Grass.index`, `PriorityPoint.index`; không migration field cũ.
- Path và Grass loại trừ nhau; ô ngoài cả hai là terrain trống dự phòng.
- Map mới và vùng map tăng thêm mặc định toàn Grass.
- Vẽ Path loại Grass; xóa Path trả về Grass và xóa PriorityPoint của ô đó.
- Grass và Terrain trống chỉnh bằng tab Terrain; nút Vẽ đường giữ nguyên.
- PriorityPoint tự sinh khi thao tác Path tạo góc mới, nhưng cho phép thêm/xóa thủ công và luôn phải thuộc Path.
- Chuột trái thêm PriorityPoint; chuột phải/Xóa thông minh xóa PriorityPoint trước và giữ Path.
- Điểm tự sinh được quản lý theo topology trong phiên; điểm import được xem là thủ công để bảo toàn file.
- Export lưu đầy đủ Grass index để runtime chọn sprite/bo góc.
---
