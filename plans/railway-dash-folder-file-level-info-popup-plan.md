# Railway Dash Editor — Folder & File Level Info Popup Plan

## 1. Goal

Bổ sung chức năng `Xem thông tin` tại mục `Folder & File`.

Khi Designer chọn một file Level và bấm `Xem thông tin`, Editor hiển thị popup ngay tại khu vực Folder & File để xem nhanh thông tin Level mà không cần load Level đó vào `LevelState`.

Mục tiêu:
- Xem nhanh cấu trúc Level.
- So sánh nhanh nhiều file Level.
- Không ảnh hưởng Level đang edit.
- Không reset Undo/Redo.
- Không thay đổi Dirty State.
- Không làm mất Generate Preview.
- Dùng chung logic Difficulty từ Generate.
- Không thay đổi Level JSON schema.

---

## 2. Vị trí chức năng

Tại từng file Level:

```text
Level_25.json

[ Mở ]
[ Xem thông tin ]
[ ... ]
```

Hoặc trong context menu:

```text
Level_25.json
├─ Mở
├─ Xem thông tin
├─ Đổi tên
└─ Xóa
```

Recommended: hiển thị `Xem thông tin` ngay cạnh `Mở`.

---

## 3. Popup Level Info

Ví dụ:

```text
┌──────────────────────────────────────┐
│ LEVEL INFO — Level_25.json        ×  │
├──────────────────────────────────────┤
│ Map                                  │
│ 13 × 24                              │
│                                      │
│ Số khay                              │
│ 2                                    │
│                                      │
│ Số Layer khay                        │
│ 14                                   │
│                                      │
│ Loại Item                            │
│ ● Đỏ  ● Xanh biển  ● Tím  ● Xanh lá  │
│ 4 loại                               │
│                                      │
│ Độ khó                               │
│ Medium Hard                          │
│                                      │
│ Difficulty Score                     │
│ 72 / 100                             │
├──────────────────────────────────────┤
│ [ Đóng ]                             │
└──────────────────────────────────────┘
```

Popup hiển thị ngay trong khu vực quản lý Folder & File, không chuyển tab.

---

## 4. Thông tin hiển thị

| Field | Nội dung |
|---|---|
| Map Size | Width × Height |
| Số khay | Tổng số Tray |
| Số Layer khay | Tổng Tray Layer của tất cả Tray |
| Số loại Item | Tổng số Item ID unique |
| Màu Item sử dụng | Danh sách màu đang xuất hiện trong Level |
| Số Layer Item | Tổng số `itemLayers` |
| Difficulty Label | Easy / Normal / Medium / Medium Hard / Hard |
| Difficulty Score | Điểm difficulty dùng cùng logic Generate |

---

## 5. Map Size

Đọc:

```text
width
height
```

Hiển thị:

```text
13 × 24
```

Không cần show tổng cell mặc định.

---

## 6. Số khay

Đọc:

```text
trayCount = trays.length
```

Ví dụ:

```text
Số khay
2
```

---

## 7. Số Layer khay

Tính tổng số Layer của tất cả Tray.

Ví dụ:

```text
Tray 0 = 8 Layer
Tray 1 = 6 Layer
```

Kết quả:

```text
Số Layer khay
14
```

Concept:

```text
trayLayerCount =
sum(tray.layers.length)
```

Có thể thêm tooltip chi tiết theo từng Tray sau này.

---

## 8. Số loại Item

Scan toàn bộ Item ID đang được sử dụng.

Recommended tính từ cả:

```text
Map Items
+
Tray Requirements
```

Ví dụ:

```text
Map:
ID 1
ID 3
ID 5

Tray:
ID 1
ID 3
ID 5
ID 6
```

Unique:

```text
1,3,5,6
```

Kết quả:

```text
Số loại Item
4
```

---

## 9. Màu Item sử dụng

Mapping hiện tại:

```text
1 = Đỏ
2 = Vàng
3 = Xanh biển
4 = Hồng
5 = Tím
6 = Xanh lá
7 = Cam
```

Popup hiển thị bằng Color Chip:

```text
● Đỏ
● Xanh biển
● Tím
● Xanh lá
```

Không show raw array trừ Debug Mode.

Nếu gặp ID không hợp lệ:

```text
Unknown ID 12
```

và có warning nhẹ.

---

## 10. Số Layer Item

Đọc:

```text
itemLayers.length
```

Ví dụ:

```text
Số Layer Item
4
```

Layer rỗng vẫn được tính nếu tồn tại trong Level Data.

---

## 11. Difficulty Score

Difficulty phải sử dụng cùng logic đã có trong Generate.

Không tạo calculator riêng cho Folder & File.

Recommended dùng shared service:

```text
DifficultyEvaluator
```

được dùng chung bởi:

```text
Generate
Folder & File
Level Check
```

---

## 12. Difficulty Data Flow

```text
Selected Level JSON
↓
Parse thành TemporaryLevelData
↓
LevelAnalyzer
↓
Topology Analysis
↓
Tray / Item Analysis
↓
DifficultyEvaluator
↓
Difficulty Score
↓
Difficulty Label
↓
Show Popup
```

Không load file vào `LevelState`.

---

## 13. Difficulty Components

Nếu Generate hiện tại đang đánh giá:

```text
Topology Difficulty
Tail Pressure
Release Pressure
Tray Complexity
Noise / Carry
Item Distribution
Element Complexity
```

thì popup phải dùng đúng kết quả tổng hợp đó.

Không tự suy ra Difficulty chỉ từ Map Size, Item Count hoặc Tray Count.

---

## 14. Difficulty Label

Hiển thị cả:

```text
Difficulty Label
+
Difficulty Score
```

Ví dụ:

```text
Độ khó
Medium Hard

72 / 100
```

Label phải dùng cùng threshold/range với Generate.

---

## 15. Invalid Level

Nếu Level thiếu data cần thiết để tính Difficulty:

```text
No Spawn
Broken Path
Malformed Tray
Missing Required Data
```

không hiển thị Score = 0.

Hiển thị:

```text
Độ khó
Không thể đánh giá

⚠ Level data chưa hợp lệ
```

Các field parse được vẫn hiển thị bình thường.

---

## 16. Không thay đổi Level đang mở

Rule bắt buộc.

Ví dụ đang edit:

```text
Level_15.json
```

Xem info:

```text
Level_80.json
```

Không được:

```text
LevelState = Level80
```

Không trigger:

```text
Load Level
Reset Undo
Reset Dirty State
Reset Selection
Reset Generate Preview
```

Thay vào đó:

```text
tempLevelData = parse(fileContent)
```

Analyze trên object tạm.

Sau khi đóng popup:

```text
tempLevelData → discard
```

Level đang edit giữ nguyên.

---

## 17. Temporary Read-Only Data

Recommended:

```text
const temporaryLevel = parseLevelJSON(fileContent);

const levelInfo =
    LevelInfoAnalyzer.analyze(temporaryLevel);
```

Không dispatch temporary level vào Editor Store.

Không trigger shared `LevelState` events.

---

## 18. Runtime LevelInfo Model

```text
LevelInfo
{
    fileName

    mapWidth
    mapHeight

    trayCount
    trayLayerCount

    itemLayerCount

    itemIds[]
    itemTypeCount

    difficultyScore
    difficultyLabel

    validationStatus
}
```

Runtime only.

Không export vào Level JSON.

---

## 19. LevelInfoAnalyzer

Recommended tạo module:

```text
LevelInfoAnalyzer
```

Module này tổng hợp basic info và gọi shared Difficulty service.

Concept:

```text
LevelInfoAnalyzer
├─ getMapInfo()
├─ getTrayInfo()
├─ getItemInfo()
├─ validateBasicData()
└─ DifficultyEvaluator.evaluate()
```

---

## 20. Separation of Responsibility

### LevelInfoAnalyzer
Phụ trách:
- Map Size
- Tray Count
- Tray Layer Count
- Item Layer Count
- Item Types

### DifficultyEvaluator
Phụ trách:
- Difficulty Score
- Difficulty Label

### Folder & File UI
Phụ trách:
- Open popup
- Render data
- Close popup

Không đặt logic phân tích Level trực tiếp trong UI component.

---

## 21. Popup State

```text
LevelInfoPopupState
{
    isOpen
    filePath
    anchorElement
    loading
    levelInfo
    error
}
```

Thuộc `EditorUIState`, không thuộc `LevelState`.

---

## 22. Loading State

Nếu Difficulty Analyzer cần thời gian:

```text
LEVEL INFO

Đang phân tích Level...
```

Popup mở ngay rồi update kết quả.

Không block toàn Editor.

---

## 23. Cache Level Info

Nếu xem cùng một file nhiều lần, không parse + analyze lại nếu file không thay đổi.

Recommended:

```text
LevelInfoCache
```

Key:

```text
filePath + modifiedTime
```

hoặc:

```text
filePath + contentHash
```

---

## 24. Cache Flow

```text
Click Xem thông tin
↓
Check LevelInfoCache
↓
Cache valid?
├─ YES → Show Popup
└─ NO
   ↓
   Read File
   ↓
   Parse JSON
   ↓
   Analyze
   ↓
   Cache Result
   ↓
   Show Popup
```

---

## 25. Cache Invalidation

Invalidate khi:

```text
File Save
File Replace
File Rename
File Delete
External File Modified
```

---

## 26. UI Layout Recommended

Giữ popup compact:

```text
LEVEL INFO
────────────────────

Map
13 × 24

Khay
2

Layer khay
14

Item
● Đỏ ● Xanh biển
● Tím ● Xanh lá

4 loại

Item Layer
4

Difficulty
Medium Hard
72 / 100
```

Không show thông số debug Generate mặc định.

---

## 27. Không hiển thị quá nhiều thông tin

Không nên đưa vào popup chính:

```text
Straight Run Count
Region Count
Noise Ratio
Safe Tail
Peak Tail
Release Window
Branch Count
Candidate Cells
```

Các thông tin này thuộc Generate Debug.

---

## 28. Optional Expand

Có thể bổ sung sau:

```text
[ Xem chi tiết ▼ ]
```

Expanded có thể show:

```text
Path Cells
Priority Point Count
Element Count
Validation Status
Total Item
```

Không cần implement v1.

---

## 29. Popup Position

Popup anchor theo file row đã click.

Nếu popup vượt viewport:

- Flip lên trên.
- Clamp trong panel.
- Không che toàn màn hình.

---

## 30. Close Behavior

Đóng khi:

```text
Click X
Click Đóng
Click file khác
Click Xem thông tin của Level khác
```

Optional: click ngoài popup để đóng.

---

## 31. Một Popup tại một thời điểm

Không mở nhiều Level Info Popup cùng lúc.

Nếu đang xem Level25 rồi click Level30:

```text
Popup Level25
↓
Replace Content
↓
Popup Level30
```

---

## 32. File Error

Nếu JSON lỗi:

```text
LEVEL INFO

⚠ Không thể đọc Level

JSON không hợp lệ
```

Không crash Folder panel.

Không load LevelState.

---

## 33. Missing Fields

Nếu file thiếu field:

Ví dụ không có `itemLayers`.

Không crash.

Hiển thị:

```text
Item Layer
0

⚠ Missing itemLayers
```

hoặc `—` tùy validation rule hiện tại.

---

## 34. Performance

Gọi:

```text
P = số Path Cell
N = tổng Item
T = tổng Tray Layer
S = gameplay simulation steps
```

Basic Level Info:

```text
O(N + T)
```

Topology Analysis:

```text
O(P)
```

Nếu Difficulty cần full simulation:

```text
O(S)
```

Do đó nên cache kết quả.

---

## 35. Consistency với Generate

Nếu shared DifficultyEvaluator có Quick/Full mode:

- Nếu Generate dùng Full → Folder Info cũng dùng Full.
- Nếu Generate dùng cached/static score → reuse đúng score đó.

Không tạo `Quick Difficulty Score` riêng có thể lệch kết quả với Generate.

Consistency ưu tiên hơn tốc độ.

---

## 36. Suggested Architecture

```text
FolderFileManager
↓
Read Selected Level JSON
↓
TemporaryLevelParser
↓
LevelInfoAnalyzer
├─ BasicInfoAnalyzer
│  ├─ Map
│  ├─ Tray
│  └─ Items
│
└─ Shared DifficultyEvaluator
↓
LevelInfoCache
↓
LevelInfoPopup
```

---

## 37. Data Flow

```text
User chọn Level File
↓
Click Xem thông tin
↓
Get filePath
↓
Check Cache
↓
Read JSON nếu cần
↓
Parse Temporary Level
↓
Analyze Basic Info
↓
Run Shared Difficulty Logic
↓
Build LevelInfo
↓
Cache
↓
Open Popup
```

Không có bước:

```text
Set Current Level
```

---

## 38. Test Cases

### TC01 — Basic Level

```text
10 × 10
1 Tray
5 Tray Layers
3 Item Types
2 Item Layers
```

Expected popup hiển thị đúng.

### TC02 — Multiple Tray

```text
Tray 0 = 8 Layers
Tray 1 = 6 Layers
```

Expected:

```text
Số khay = 2
Số Layer khay = 14
```

### TC03 — Unique Item Color

Map:

```text
ID1, ID3
```

Tray:

```text
ID1, ID3, ID6
```

Expected:

```text
Số loại Item = 3

Đỏ
Xanh biển
Xanh lá
```

### TC04 — Level đang edit

Current:

```text
Level15
```

Xem info:

```text
Level80
```

Expected:
- Level15 vẫn đang edit.
- Undo/Redo giữ nguyên.
- Dirty State giữ nguyên.
- Selection giữ nguyên.
- Generate Preview giữ nguyên.

### TC05 — Difficulty

Generate đánh giá:

```text
72 / 100
Medium Hard
```

Folder Info phải hiển thị đúng:

```text
72 / 100
Medium Hard
```

### TC06 — Invalid Level

Thiếu Spawn.

Expected:

```text
Độ khó
Không thể đánh giá

⚠ Level data chưa hợp lệ
```

### TC07 — Invalid JSON

Expected:

```text
Không thể đọc Level
JSON không hợp lệ
```

Editor không crash.

### TC08 — Cache

Xem cùng file hai lần, file không đổi.

Expected lần 2 dùng cache.

### TC09 — Save rồi xem lại

File Save thay đổi data.

Expected cache invalidate và analyze lại.

### TC10 — Popup khác

Đang xem Level25, click Level30.

Expected chỉ còn một popup và hiển thị Level30.

---

## 39. Definition of Done

- Folder & File có nút `Xem thông tin`.
- Mỗi Level file có thể mở Level Info Popup.
- Popup xuất hiện ngay trong khu vực Folder & File.
- Hiển thị Map Size.
- Hiển thị số Tray.
- Hiển thị tổng Tray Layer.
- Hiển thị số Item Type.
- Hiển thị các màu Item đang sử dụng.
- Hiển thị số Item Layer.
- Hiển thị Difficulty Score.
- Hiển thị Difficulty Label.
- Difficulty dùng đúng shared logic từ Generate.
- Không có Difficulty calculator riêng trong Folder.
- Không load file vào current LevelState.
- Không ảnh hưởng Level đang edit.
- Không reset Undo/Redo.
- Không reset Dirty State.
- Không invalidate Generate Preview chỉ vì xem info.
- Invalid Level vẫn xem được thông tin parse được.
- Invalid JSON không crash Editor.
- Có Loading State.
- Có LevelInfo Cache.
- Cache invalidate khi file thay đổi.
- Một thời điểm chỉ có một Level Info Popup.
- Không thay đổi Level JSON schema.

---

## 40. Change History

### 2026-08-21

- Added shared `DifficultyEvaluator` for score/label evaluation from Generate analysis flow.
- Added `LevelInfoAnalyzer` for temporary read-only level info parsing.
- Added `Xem thông tin` action in Folder & file rows.
- Added compact one-popup UI with loading, invalid JSON handling, item color chips, warnings, and cache by file modified time/size.
- Added cache invalidation on folder refresh, save, overwrite, rename, delete, and folder change.
