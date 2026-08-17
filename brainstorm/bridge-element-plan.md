---
# BẢN THẢO BRAINSTORM: Bridge Element trong Level Editor
**Ngày:** 2026-08-14
**Trạng thái:** ✅ Đã ghi nhận plan triển khai

## 1. Tóm tắt & Quyết định cốt lõi

- `Bridge` là element đại diện cho trường hợp hai tuyến đường cắt nhau tại cùng một tọa độ nhưng không tạo giao lộ.
- Tại một tọa độ Bridge chỉ tồn tại một element Bridge, nhưng Bridge biểu diễn hai lane/tuyến đi qua nhau.
- Tàu đi qua Bridge luôn tiếp tục đi thẳng theo tuyến hiện tại.
- Không được rẽ từ Horizontal sang Vertical hoặc từ Vertical sang Horizontal tại Bridge.
- Hai phần của cùng đoàn tàu đi qua hai lane khác nhau của Bridge không bị tính là self-collision.
- Self-collision tại Bridge chỉ được bỏ qua khi hai phần đoàn tàu nằm trên hai axis khác nhau; cùng axis vẫn va chạm.
- `axis` xác định trục Bridge:
  - `0`: Horizontal nằm chiều ngang.
  - `1`: Vertical nằm chiều dọc.
- Bridge phải được hỗ trợ đầy đủ trong editor: place, hover chọn hướng ở sidebar palette, edit trong canvas card, delete, import, export, validate, preview đúng orientation.
- Dữ liệu Bridge phải dễ deserialize trực tiếp trong Unity.

## 2. JSON Data

Schema chính thức:

```json
"bridgeElement": [
  {
    "index": 402,
    "axis": 0
  },
  {
    "index": 393,
    "axis": 1
  }
]
```

Quy ước:

| Field | Type | Ý nghĩa |
|---|---|---|
| `bridgeElement` | `Array<BridgeElement>` | Danh sách Bridge trong level. |
| `index` | `number` | Ô grid zero-based row-major, cùng quy ước với các field index khác. |
| `axis` | `0 \| 1` | Trục Bridge: `0` Horizontal, `1` Vertical. |

## 3. Editor Behavior

### 3.1 Place Bridge trên Grid

- Thêm Bridge vào nhóm element trong Level Editor.
- Khi công cụ Bridge đang active, click lên một ô hợp lệ sẽ tạo hoặc cập nhật Bridge tại `index` đó.
- Nếu ô đã có Bridge, click với axis hiện tại sẽ cập nhật `axis` thay vì tạo bản ghi trùng.
- Bridge được lưu theo index duy nhất; không cho phép duplicate cùng `index`.

### 3.2 Chọn hướng khi hover palette element

- Trong sidebar palette element, Bridge có lựa chọn axis `Horizontal` / `Vertical` khi hover hoặc khi mở control phụ.
- Axis đang chọn trở thành default cho lần place Bridge tiếp theo.
- UI label nên map rõ:
  - Horizontal: `axis = 0`
  - Vertical: `axis = 1`
- Preview icon trong palette cần phản ánh axis đang chọn để designer không đặt nhầm.

### 3.3 Edit axis trong canvas card

- Khi chọn một Bridge trên canvas, card chỉnh sửa phải hiển thị:
  - Element type: `Bridge`
  - Index / tọa độ ô nếu editor hiện có pattern này.
  - Control đổi axis giữa Horizontal và Vertical.
- Đổi axis cập nhật ngay preview trên canvas và state export.

### 3.4 Delete Bridge

- Delete thông qua thao tác xóa element hiện có của editor.
- Xóa Bridge chỉ xóa record trong `bridgeElement`; không tự xóa Path/Grass/PriorityPoint/tray/item trừ khi hiện có luật xóa chung khác trong editor.

## 4. Validation

Bridge chỉ hợp lệ khi:

- `index` nằm trong bounds của map.
- `axis` là `0` hoặc `1`.
- Không có hai Bridge cùng `index`.
- Mỗi Bridge chỉ có một giá trị `axis`.
- `axis = 0` hoạt động theo Left ↔ Right.
- `axis = 1` hoạt động theo Top ↔ Bottom.
- Không tồn tại trường hợp một Bridge có đồng thời Horizontal và Vertical.
- Không yêu cầu Bridge phải có Path đủ Left / Right / Top / Bottom.
- Khi đổi `axis`, editor update Bridge hiện tại, không tạo thêm Bridge mới cùng `index`.
- Nếu editor có hệ thống element độc quyền theo ô, Bridge không được trùng với element khác tại cùng `index`, trừ khi element đó được thiết kế rõ là overlay hợp lệ.

Open validation cần kiểm tra trong codebase:

- Editor hiện lưu Path theo ô hay theo cạnh/kết nối.
- Quy tắc overlap với các element khác đang nằm ở đâu.

## 5. Preview / Rendering

Canvas preview phải thể hiện đúng orientation:

- `axis = 0`: phần Horizontal là cầu nằm ngang.
- `axis = 1`: phần Vertical là cầu nằm dọc.
- Visual grid dùng icon `↔` full-cell cho Horizontal; Vertical là icon `↔` xoay 90 độ.
- Icon cần truyền đạt đây là cầu, không phải giao lộ rẽ hướng.
- Hover/selected state vẫn giữ được đọc hướng cầu rõ ràng.
- Khi zoom hoặc resize, Bridge không làm lệch layout grid và không che mất trạng thái selection/cell highlight.

## 6. Import / Export

### Import

- Khi đọc JSON, parse `bridgeElement` nếu có.
- Mỗi item phải có `index` number và `axis` number hợp lệ.
- Từ chối hoặc report lỗi rõ ràng nếu:
  - `index` out of bounds.
  - `axis` khác `0`/`1`.
  - Có duplicate `index`.
- Nếu file thiếu `bridgeElement`, editor có thể hiểu là không có Bridge để giữ backward-compatible với level cũ, trừ khi format mới yêu cầu field này bắt buộc.

### Export

- Export `bridgeElement` ở root JSON.
- Mỗi Bridge xuất theo dạng:

```json
{
  "index": 402,
  "axis": 0
}
```

- Nên sort theo `index` tăng dần để JSON ổn định, dễ diff.
- Không export Bridge duplicate hoặc invalid.

\

## 8. Checklist triển khai Editor

- [x] Thêm model/state cho `bridgeElement`.
- [x] Thêm constants/type cho `Bridge` và `axis`.
- [x] Thêm Bridge vào sidebar element palette.
- [x] Thêm hover/control chọn Horizontal/Vertical trong palette.
- [x] Thêm thao tác place Bridge trên grid.
- [x] Thêm canvas card để edit `axis`.
- [x] Thêm delete Bridge.
- [x] Thêm renderer/preview Bridge theo `axis`.
- [x] Thêm import parser cho `bridgeElement`.
- [x] Thêm export serializer cho `bridgeElement`.
- [x] Thêm validation bounds, axis, duplicate.
- [x] Thêm test import/export nếu project đã có test tương ứng.
- [x] Thêm test validation nếu project đã có test tương ứng.

## 9. Kết quả cuối phiên

Đã chốt plan Bridge Element cho Level Editor: schema `bridgeElement`, quy ước `axis`, hành vi place/edit/delete, validation, preview, import/export và lưu ý deserialize cho Unity.

## 10. Lịch sử thay đổi

- 2026-08-17: Đổi visual grid Bridge sang icon `↔` kích thước full block index; axis Vertical dùng icon xoay 90 độ.
- 2026-08-17: Căn giữa visual Bridge theo cả bốn phía trong cell.
- 2026-08-17: Cập nhật runtime collision: Bridge cho phép hai phần đoàn tàu overlap cùng index nếu đang đi qua hai axis khác nhau.
---
