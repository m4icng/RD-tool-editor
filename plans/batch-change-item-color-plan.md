# Railway Dash Editor — Batch Change Item Color / Item ID Plan

## 1. Goal

Bổ sung chức năng `Đổi màu hàng loạt` để Designer đổi nhanh `itemId` của:

- Item đã đặt trên Map.
- Item requirement trong Tray.
- Hoặc đồng thời Map + Tray.

Ví dụ:

```text
Red ID 1 → Blue ID 3
```

Có thể đổi:

```text
Map Item ID 1 → ID 3
Tray Requirement ID 1 → ID 3
```

trong một thao tác.

Mục tiêu là recolor Level nhanh mà không phải sửa từng Item Layer và từng Tray Layer.

---

## 2. Vị trí chức năng

Đặt trong:

```text
Level Des → Item
```

hoặc:

```text
TOOLS
- Đổi màu hàng loạt
```

Click mở popup.

---

## 3. UI v1

```text
ĐỔI MÀU HÀNG LOẠT

Chế độ
[ Thay thế ▼ ]

Từ
[ Đỏ - ID 1 ▼ ]

Sang
[ Xanh biển - ID 3 ▼ ]

Áp dụng cho
[x] Item trên Map
[x] Yêu cầu trong Khay

Map scope
[ Tất cả Layer ▼ ]

Tray scope
[ Tất cả Khay ▼ ]

Ảnh hưởng
Map: 27 Item
Tray: 36 Item

[ Hủy ]
[ Đổi màu ]
```

Mặc định nên bật cả:

```text
[x] Item trên Map
[x] Yêu cầu trong Khay
```

để hạn chế phá Item Balance.

---

## 4. Scope

Hỗ trợ:

### Map Only
Chỉ đổi `itemId` trong `itemLayers`.

### Tray Only
Chỉ đổi `itemId` trong Tray requirement.

### Map + Tray
Đổi đồng thời cả hai phía trong cùng một transaction.

Recommended mặc định: `Map + Tray`.

---

## 5. Map Layer Scope

Cho phép:

```text
○ Tất cả Item Layer
○ Layer hiện tại
○ Chọn Layer
```

Advanced:

```text
[x] Layer 0
[x] Layer 1
[ ] Layer 2
[x] Layer 3
```

---

## 6. Tray Scope

Cho phép:

```text
○ Tất cả Tray
○ Tray hiện tại
○ Chọn Tray
```

V1 chỉ cần:

```text
All Tray / Selected Tray
```

để UI đơn giản.

---

## 7. Replace Color

Mode:

```text
Replace
```

Ví dụ:

```text
ID 1 Red → ID 3 Blue
```

Before:

```text
Red = 18
Blue = 9
```

After:

```text
Red = 0
Blue = 27
```

Blue hiện có vẫn giữ nguyên.

---

## 8. Swap Color

Bổ sung mode:

```text
Swap
```

Ví dụ:

```text
Red ID 1 ↔ Blue ID 3
```

Kết quả:

```text
Item ID1 cũ → ID3
Item ID3 cũ → ID1
```

Áp dụng tương tự cho Tray.

UI:

```text
Chế độ

● Thay thế
○ Hoán đổi
```

---

## 9. Multi Color Remap

V2 có thể hỗ trợ:

```text
ID1 → ID3
ID3 → ID6
ID6 → ID1
```

UI:

```text
COLOR REMAP

Đỏ ID1        → Xanh biển ID3
Xanh biển ID3 → Xanh lá ID6
Xanh lá ID6   → Đỏ ID1

[ + Thêm mapping ]
```

---

## 10. Atomic Mapping — Rule bắt buộc

Không được xử lý mapping tuần tự.

Sai:

```text
1 → 3
3 → 6
```

nếu thực hiện:

```text
replace 1 thành 3
↓
replace tất cả 3 thành 6
```

thì Item ID1 ban đầu sẽ bị đổi tiếp thành ID6.

Phải xử lý theo `Original ItemId`.

Flow đúng:

```text
Capture Original State
↓
Read Original ID
↓
Lookup mapping[originalId]
↓
Write Final ID
```

Ví dụ:

```text
1 → 3
3 → 6
6 → 1
```

phải cho kết quả:

```text
Original 1 → 3
Original 3 → 6
Original 6 → 1
```

Không cascading replace.

---

## 11. Map Item Data

Cấu trúc hiện tại:

```text
itemLayers
→ layer
→ items
→ itemId
→ index[]
```

Batch recolor chỉ đổi:

```text
itemId
```

Không đổi:

```text
index
layer
```

Ví dụ:

Before:

```json
{
  "itemId": 1,
  "index": [10, 11, 12]
}
```

After:

```json
{
  "itemId": 3,
  "index": [10, 11, 12]
}
```

---

## 12. Normalize Item Group sau Replace

Nếu cùng Layer có:

```text
ID1:
10,11,12

ID3:
20,21,22
```

và Replace:

```text
1 → 3
```

sau đó normalize thành:

```text
ID3:
10,11,12,20,21,22
```

Không giữ nhiều group cùng `itemId` trong cùng Layer nếu schema hiện tại dùng một group / ID.

---

## 13. Tray Requirement

Tray requirement cũng remap theo cùng mapping.

Ví dụ:

Before:

```text
Tray 0 Layer 0
Red ID1 ×9
```

After:

```text
Tray 0 Layer 0
Blue ID3 ×9
```

Chỉ thay `itemId`.

Giữ nguyên `amount`.

---

## 14. Không đổi Amount

Batch Color Change không được tự đổi số lượng Tray requirement.

Ví dụ:

```text
Red ×9 → Blue ×9
```

Không tự merge amount sai thành:

```text
Blue ×18
```

trừ khi schema hiện tại thực sự cần normalize nhiều requirement cùng ID theo rule riêng.

---

## 15. Preview trước Apply

Popup cần tính trước số data bị ảnh hưởng.

Ví dụ:

```text
PREVIEW

Đỏ ID1 → Xanh biển ID3

Map
32 Item sẽ đổi

Tray
45 Requirement Item sẽ đổi

Item Balance sau thay đổi:
✓ Balanced
```

Hoặc:

```text
⚠ Item Balance sau thay đổi:
Blue Map 36
Blue Tray 27

Map dư 9
```

Designer vẫn được Apply nếu Editor hiện tại cho phép Level Invalid.

---

## 16. Locked Layer

Locked Layer chỉ khóa đối với Generator.

Designer vẫn được phép recolor thủ công.

Nếu scope chứa Locked Layer:

```text
⚠ Có 2 Layer đang Locked.

Thao tác này sẽ thay đổi Item trong các Layer này.
```

Cho phép Confirm.

Không tự Unlock Layer.

---

## 17. Generate Preview

Nếu đang có `GeneratePreviewState`:

Sau Batch Recolor:

```text
SourceRevision++
GeneratePreviewState = Outdated
```

Recommended discard preview cũ.

Không cho Apply preview dựa trên màu cũ.

---

## 18. Undo / Redo

Toàn bộ Batch Recolor phải là:

```text
1 Undo Transaction
```

Không tạo một Undo entry cho từng Item hoặc từng Tray Layer.

Flow:

```text
Begin Transaction
↓
Snapshot affected Map + Tray data
↓
Apply Atomic Mapping
↓
Normalize
↓
Refresh
↓
Commit Transaction
```

Undo phải khôi phục chính xác toàn bộ màu trước thao tác.

---

## 19. Validation sau Apply

Sau Apply:

```text
Update Item Balance
↓
Update Level Validation
```

Check:

- Map count theo màu.
- Tray demand theo màu.
- Item ID hợp lệ.
- Tray ID hợp lệ.

Không cần rebuild Path topology chỉ vì đổi màu.

---

## 20. Cache Invalidation

Không invalidate:

```text
Path Graph
Straight Runs
Region
Branch
Bridge topology
```

Chỉ invalidate:

```text
ItemBalanceCache
TrayDemandCache
DifficultyDemandCache
GenerateColorPlanningCache
```

---

## 21. Edge Cases

### Source ID không tồn tại

Disable Apply và hiển thị:

```text
Không tìm thấy Item ID này trong phạm vi đã chọn.
```

### Source ID = Target ID

Disable Apply.

Không tạo Undo transaction.

### Replace vào ID đã tồn tại

Hợp lệ.

Các group cùng ID được normalize.

### Swap

Chỉ swap đúng hai ID được chọn.

Không dùng replace tuần tự.

---

## 22. Data Flow

```text
Open Batch Color Tool
↓
Select Mode
↓
Select Source ID
↓
Select Target ID
↓
Select Scope
↓
Scan affected data
↓
Show Preview Count
↓
Confirm
↓
Begin Undo Transaction
↓
Capture Original IDs
↓
Apply Atomic Mapping
↓
Normalize Item Groups
↓
Update Tray Requirements
↓
SourceRevision++
↓
Invalidate Generate Preview
↓
Update Item Balance
↓
Update Validation
↓
Refresh Map + Tray UI
↓
Commit Transaction
```

---

## 23. Performance

Gọi:

```text
N = tổng Map Item
T = tổng Tray Layer
```

Batch replace toàn Level:

```text
O(N + T)
```

Không scan toàn Grid.

Không cần xử lý Path.

---

## 24. Implementation Plan

### Phase 1

Implement:

```text
Single Replace
+
Swap
+
Map / Tray Scope
+
Undo / Redo
+
Validation
```

### Phase 2

Implement:

```text
Multi Color Remap
+
Atomic Mapping Table
+
Advanced Layer/Tray selection
+
Live Preview
```

Backend từ Phase 1 nên dùng Atomic Mapping ngay để Phase 2 không phải viết lại.

---

## 25. Definition of Done

- Có tool `Đổi màu hàng loạt`.
- Có Replace Color.
- Có Swap Color.
- Chọn được From ID và Target ID.
- Có thể đổi Item trên Map.
- Có thể đổi Tray Requirement.
- Có thể đổi đồng thời Map + Tray.
- Có scope All Layer / Current Layer.
- Có scope All Tray / Selected Tray.
- Amount của Tray không thay đổi.
- Index Item không thay đổi.
- Layer Item không thay đổi.
- Replace vào màu đã tồn tại được normalize đúng.
- Không có cascading replace.
- Mapping hoạt động atomic.
- Locked Layer có warning nhưng Designer vẫn được phép đổi.
- Không tự Unlock Layer.
- Generate Preview cũ bị invalidate.
- Item Balance cập nhật ngay.
- Validation cập nhật ngay.
- Toàn bộ action là một Undo Transaction.
- Undo/Redo khôi phục chính xác.
- Không thay đổi JSON schema.
- Complexity khoảng `O(N + T)`.

---

## Change History

### 2026-08-21 — Implement Phase 1

- Thêm tool `Đổi màu hàng loạt` trong `LevelDes > Công cụ`.
- Thêm popup chọn mode Replace/Swap, From ID, Target ID, scope Map/Tray.
- Map scope hỗ trợ `Tất cả Layer` và `Layer hiện tại`.
- Tray scope hỗ trợ `Tất cả Khay` và `Khay đang chọn`.
- Áp dụng atomic mapping, không cascading replace.
- Map recolor chỉ đổi item color/id, không đổi layer/index.
- Tray recolor giữ nguyên amount, remap recipe theo itemId gốc.
- Locked layer hiển thị warning nhưng vẫn cho Designer apply.
- Apply tạo một undo transaction qua luồng `mutate` hiện có.
- Sau apply tăng `generateSourceRevision`, đánh dấu `generationMeta.status = Outdated`, clear Generate Preview runtime.
- Build lại `js/app.bundle.js` từ source modules.
