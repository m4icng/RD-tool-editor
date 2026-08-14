---
# BẢN THẢO BRAINSTORM: Layer item và thứ tự khay chứa
**Ngày:** 2026-08-11
**Trạng thái:** ✅ Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- Đường đi không thay đổi khi chuyển layer.
- Các element nền/map không thay đổi khi chuyển layer.
- Layer chỉ dùng để thay đổi các item xuất hiện trên map.
- Khu vực “Khay chứa” phải hiển thị thứ tự xuất hiện của các khay chứa vật phẩm.
- Các object xe hiện tại sẽ được thay bằng object khay chứa.
- Palette đặt item trên map chỉ cung cấp một object khay chứa trống.
- Loại vật phẩm của khay được cấu hình theo layer trong panel Khay chứa, không được chọn tại lúc đặt khay lên map.
- Một level có nhiều vị trí khay trống dùng chung trên map.
- Mỗi vị trí khay sở hữu nhiều layer/recipe xuất hiện lần lượt.
- Trong phạm vi một vị trí khay, mỗi layer tương ứng một lượt khay; thứ tự layer là thứ tự spawn tại vị trí đó.
- Đường đi, điểm bắt đầu của rắn và vị trí khay trống là element dùng chung của toàn level.
- Mỗi global map layer chỉ chứa trái cây thu thập; đổi layer sẽ thay tập Táo, Chuối, Nho và Cà tím đang xuất hiện.
- Mỗi vị trí khay có queue layer độc lập và tự tiến tới layer tiếp theo khi khay hiện tại fill đủ 9.
- Người dùng click trực tiếp khay trống trên map để chọn; khay được highlight và panel hiển thị queue layer riêng của vị trí đó.
- Panel hiển thị định danh và tọa độ khay đang chọn.
- Tổng recipe của mọi tray queue phải khớp chính xác tổng trái cây trên map theo từng loại; không cho phép thiếu hoặc dư.
- Khay trống mới đặt có queue rỗng (0 layer); panel cung cấp nút Thêm layer.
- Layer mới trong queue bắt đầu với recipe 0/9 và ở trạng thái chưa hợp lệ cho đến khi tổng bằng 9.
- Không migrate schema v2; editor dùng schema/storage version mới và level sạch. Import schema cũ báo không tương thích.
- Mọi khay có sức chứa cố định là 9; capacity không chỉnh sửa theo layer.
- Mặc định khay yêu cầu 9 item cùng loại, nhưng cho phép recipe trộn nhiều loại.
- Tổng số lượng yêu cầu trong recipe của mỗi layer luôn phải bằng 9, ví dụ 3 Táo + 3 Chuối + 3 Nho.
- UI recipe dùng bộ đếm giảm/tăng cho từng loại trái cây và hiển thị tổng `x/9`.
- Layer/khay được sắp xếp thứ tự spawn bằng kéo-thả.
- Mỗi layer có thêm nút `↑/↓` để reorder bằng bàn phím và hỗ trợ accessibility.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

Mô hình hiện tại:

`Layer -> cells -> { path, item }`

Mô hình mục tiêu sơ bộ:

`Level -> sharedMap(path + elements + snakeStart + traySlots) + fruitLayers(fruits) + trayQueues`

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | “Khay chứa vật phẩm” tương ứng với dữ liệu nào? | Option A, nhưng thay toàn bộ xe thành khay chứa. Trên map chỉ spawn khay trống; phần Khay chứa dùng để setup số layer và mỗi layer là khay vật phẩm nào. | Tái sử dụng vai trò gameplay của truck dưới tên khay chứa; object map là khay trống, cấu hình nội dung nằm theo layer. |
| 2 | Quan hệ giữa một layer và khay chứa hoạt động thế nào? | Option A. | Ban đầu chốt một layer là một lượt khay; Q9 đã làm rõ layer này thuộc từng vị trí khay, không phải toàn level. |
| 3 | Khi chuyển layer, object nào trên map được phép thay đổi? | Option A. | Quyết định mới nhất: chỉ fruit thay đổi; path, element, snake start và tray slot là dữ liệu dùng chung. |
| 4 | Trái cây của các layer không active hiển thị thế nào? | Option A. | Editor chỉ render fruit của layer active; dữ liệu dùng chung luôn giữ nguyên. |
| 5 | Sức chứa của khay ở mỗi layer được xác định thế nào? | Sức chứa luôn bằng 9. | Mọi layer dùng capacity cố định 9; UI chỉ cấu hình loại vật phẩm của khay. |
| 6 | Một layer hợp lệ phải có số lượng và loại trái cây thế nào? | Mặc định Option A, nhưng cho phép mix; ví dụ 3 táo, 3 chuối, 3 nho và phải fill đủ khay. | Layer lưu recipe theo loại; tổng recipe bắt buộc bằng 9. Mặc định recipe đơn loại 9 item. |
| 7 | UI cấu hình thành phần khay hoạt động thế nào? | Option A. | Mỗi loại trái cây có bộ đếm −/số lượng/+; UI hiển thị tổng x/9 và validate tổng bằng 9. |
| 8 | Thay đổi thứ tự xuất hiện của layer/khay bằng cách nào? | Option A, bổ sung nút ↑/↓ cho accessibility. | Hỗ trợ drag-and-drop và nút ↑/↓; renumber ngay sau reorder. |
| 9 | Trên map có bao nhiêu vị trí khay trống? | Có nhiều vị trí khay; mỗi khay có nhiều layer xuất hiện. | Level lưu nhiều tray slot dùng chung; mỗi slot sở hữu chuỗi tray layers/recipes riêng. |
| 10 | Layer trái cây liên hệ với nhiều chuỗi khay thế nào? | Option B. | Quyết định cũ “fruit dùng chung” được yêu cầu mới nhất thay thế: fruit chạy tuần tự theo global layer; mỗi tray slot vẫn giữ queue độc lập xuyên suốt game. |
| 11 | Chọn và cấu hình queue của từng vị trí khay bằng cách nào? | Option A. | Click khay trên map để highlight và mở queue riêng trong panel; hiển thị ID/tọa độ. |
| 12 | Tổng trái cây trên map phải khớp toàn bộ recipe thế nào? | Option A. | Bắt buộc khớp chính xác theo từng fruit type; validator báo cả thiếu và dư. |
| 13 | Khay trống mới được đặt có queue mặc định thế nào? | Option A. | Queue bắt đầu với 0 layer; người dùng chủ động thêm layer trong panel. |
| 14 | Recipe ban đầu của layer mới là gì? | Option A. | Mọi counter bắt đầu bằng 0; layer invalid cho đến khi đạt tổng 9/9. |
| 15 | Xử lý dữ liệu schema v2 hiện có thế nào? | Option C. | Không migrate; schema/storage version mới khởi tạo level sạch và từ chối import schema cũ. |

## 4. [OPEN FLAGS] — Điểm chưa rõ, cần kiểm tra hoặc xác nhận thêm

- Không còn open flag blocking implementation.

## 5. Kết quả cuối phiên

### Mô hình dữ liệu mục tiêu

```text
Level
├── grid
├── paths[]                         # dùng chung
├── snakeStart                     # element dùng chung
├── fruitLayers[]                  # mỗi layer chỉ chứa fruit thu thập
└── traySlots[]                    # nhiều vị trí khay trên map
    ├── id, position
    └── layers[]                   # queue độc lập của từng tray slot
        ├── id, order
        └── recipe                 # { apple, banana, grape }, tổng = 9
```

### Quy tắc editor

1. Đường đi, element, snake start, vị trí khay và cấu hình tray queue là dữ liệu dùng chung của level; global layer chỉ chứa fruit.
2. Palette thay ba xe theo loại bằng một object `Khay trống`.
3. Click khay trên map để highlight và mở queue của riêng khay đó trong panel.
4. Khay mới có queue 0 layer; layer mới có recipe 0/9 và invalid cho đến khi đủ 9.
5. Recipe cấu hình bằng counter `− / số lượng / +` cho Táo, Chuối và Nho.
6. Mỗi tray slot tiến queue độc lập khi layer hiện tại được fill đủ 9.
7. Layer trong queue reorder bằng drag-and-drop và nút `↑/↓`; thứ tự được renumber ngay.
8. Validator yêu cầu tổng recipe của tất cả tray queues khớp chính xác tổng fruit của mọi global fruit layer theo từng loại.
9. Playable bắt đầu từ fruit layer đầu tiên và tự chuyển sang layer kế tiếp khi layer hiện tại hết fruit; map, rắn, cargo và tiến độ mọi khay không reset.
9. Xóa khay đồng nghĩa xóa queue thuộc khay đó và cần xác nhận khi queue không rỗng.
10. Schema/storage dùng version mới; không migrate schema v2 và từ chối import dữ liệu cũ với thông báo rõ ràng.

### Thay đổi UI chính

- Đổi panel `Layer & khay chứa` thành panel cấu hình `Khay chứa`.
- Khi chưa chọn khay: hướng dẫn click một khay trên map.
- Khi đã chọn: hiển thị `Khay XX · x/y`, danh sách queue layers, recipe counters, tổng `x/9`, nút thêm/xóa/reorder.
- Thống kê/validation hiển thị tổng nhu cầu và chênh lệch fruit theo từng loại.
- Panel Data dùng dạng compact để ưu tiên diện tích map; hiển thị tổng số loại fruit, số fruit trên map / số khay cần theo từng loại, chi tiết `đã setup/cần` của từng khay và breakdown fruit của từng global layer.
- Cho phép kéo hoặc dùng phím mũi tên trên separator để thay đổi chiều rộng sidebar, Map ↔ panel phải, Playable ↔ HUD và chiều cao Khay ↔ Data; kích thước được lưu trên thiết bị.

## Bổ sung — Palette Item / Element (2026-08-12)

- Khu vực `Item & element` được chia thành hai tab `Item` và `Element`; triển khai `Item` trước.
- ID fruit dạng số theo thứ tự trong tab Item: Táo `1`, Chuối `2`, Nho `3`, Cà tím `4`. Đầu rắn và khay tiếp tục dùng `snake-start`, `tray-empty`.
- Mỗi nút item hiển thị tooltip `ID: <object-id>` khi hover hoặc focus.
- `snake-start` chỉ được phép tồn tại một lần trên toàn bộ map, kể cả khi dữ liệu editor hiện vẫn có nhiều layer.
- `tray-empty` là khay trống có capacity cố định `9`, queue khởi tạo rỗng và được setup tại panel Khay chứa.
- Tab `Element` được tạo sẵn với empty state; danh sách element sẽ được bổ sung ở bước sau.

## Bổ sung — Menu công cụ Xóa (2026-08-12)

- Hover hoặc focus nút `Xóa` mở bốn lựa chọn: `Xóa toàn bộ map`, `Xóa đường đi`, `Xóa item`, `Xóa element`.
- `Xóa đường đi`, `Xóa item` và `Xóa element` là ba erase mode riêng, hỗ trợ click và rê chuột trên map.
- Chuột phải sử dụng erase mode đang chọn; mode mặc định là `Đường đi`.
- Mỗi mode chỉ xóa đúng nhóm dữ liệu, không xóa kèm nhóm khác trên cùng ô.
- `Xóa toàn bộ map` yêu cầu xác nhận, xóa cells ở tất cả layer nhưng giữ kích thước map và cấu trúc layer; thao tác có thể Undo.
- `Xóa thông minh` và chuột phải bóc dữ liệu tại ô theo thứ tự: fruit của global layer đang chọn → item dùng chung → element → đường đi. Nếu cùng tọa độ còn fruit ở layer khác, đường dùng chung được bảo vệ cho tới khi fruit ở các layer đó được xóa.
- Menu mở rộng trong sidebar thay vì phủ lên playfield, đồng thời hỗ trợ điều khiển bằng focus/bàn phím.

## Trạng thái triển khai — Editor khay chứa (2026-08-12)

- Click khay trên map hoặc trong danh sách sẽ mở editor queue riêng của vị trí đó.
- Có thể thêm/xóa nhiều layer; layer mới bắt đầu với recipe `0/9`.
- Mỗi layer có counter `− / số lượng / +` cho Táo, Chuối, Nho và Cà tím.
- Tổng recipe bị khóa tối đa ở `9`; UI đánh dấu hợp lệ khi đạt đúng `9/9`.
- Layer có thể sắp xếp bằng kéo-thả hoặc nút `↑/↓`; số thứ tự cập nhật ngay.
- Xóa layer có recipe sẽ hỏi xác nhận.
- Dữ liệu xe cũ có nút chuyển thành khay mới capacity `9` và một recipe đơn loại `9/9`.
- Validator hiển thị khay chưa có layer, layer chưa đủ `9/9` và chênh lệch giữa fruit trên map với tổng recipe.
---
