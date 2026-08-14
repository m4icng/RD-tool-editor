---
# BẢN THẢO BRAINSTORM: Quy luật Map Size 17×28
**Ngày:** 2026-08-11
**Trạng thái:** ✅ Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- Kích thước map gốc được đề xuất là Width 17, Height 28.
- Mỗi `+1 Size` tăng Width thêm 2 và Height thêm 4.
- Cần thay hai dimension độc lập hiện tại bằng một quy luật Size có kiểm soát.
- Tỷ lệ 2.0 là tỷ lệ bước tăng `ΔHeight/ΔWidth = 4/2`, không phải aspect ratio cố định.
- UI không hiển thị số Size; chỉ có nút giảm/tăng và thông số Width × Height.
- Width và Height không được nhỏ hơn 1.
- Giảm kích thước dừng tại 5×4; nút giảm bị disable vì bước tiếp theo 3×0 không hợp lệ.
- Kích thước tối đa là 33×60 (8 bước tăng từ map gốc, 1.980 ô); nút tăng bị disable tại giới hạn.
- Sidebar dùng một stepper duy nhất `− Width × Height +`; thông số chỉ đọc và không cho chỉnh từng trục.
- Không cho giảm nếu vùng bị cắt còn path/item/element; editor cảnh báo để người dùng dọn dữ liệu trước.
- Schema chỉ lưu `mapSizeStep`; Width/Height luôn được suy ra từ công thức. Map gốc dùng step 0.
- Canvas mặc định Fit toàn map và hỗ trợ Zoom/Pan để chỉnh chính xác map lớn.
- `100%` là Fit; zoom 50%–300%, bước 25%; Ctrl+wheel để zoom, chuột giữa hoặc Space+kéo để pan.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

Nếu Size gốc là `S = 0`:

```text
Width(S)  = 17 + 2S
Height(S) = 28 + 4S
```

| Size | Width | Height | Height/Width |
|---:|---:|---:|---:|
| -2 | 13 | 20 | 1.538 |
| -1 | 15 | 24 | 1.600 |
| 0 | 17 | 28 | 1.647 |
| +1 | 19 | 32 | 1.684 |
| +2 | 21 | 36 | 1.714 |
| +3 | 23 | 40 | 1.739 |

`ΔHeight / ΔWidth = 4/2 = 2.0`, nhưng aspect ratio `Height/Width` không cố định và tiến dần về 2.0 khi Size tăng.

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | “Tỷ lệ chuẩn 2.0” áp dụng theo nghĩa nào? | Option A. | Giữ công thức +2 Width/+4 Height; aspect ratio map được phép thay đổi theo Size. |
| 2 | Kích thước gốc được hiển thị là Size nào? | Không cần hiển thị số Size; chỉ chọn tăng/giảm và hiển thị thông số, dimension không nhỏ hơn 1. | UI dùng một stepper kích thước với nhãn Width × Height; không expose size index. |
| 3 | Xử lý bước giảm gần giới hạn thế nào? | Option A. | Dừng tại 5×4 và disable nút giảm; không clamp phá vỡ bước −2/−4. |
| 4 | Kích thước tối đa ở mức nào? | Option A. | Tối đa 33×60 để giữ renderer DOM dưới khoảng 2.000 cell. |
| 5 | Control kích thước map hiển thị thế nào? | Option A. | Một stepper duy nhất; kích thước giữa chỉ đọc, mọi thay đổi đi theo chuỗi hợp lệ. |
| 6 | Xử lý dữ liệu ngoài biên khi giảm map thế nào? | Option C. | Chặn giảm và cảnh báo; không xóa hoặc giữ dữ liệu ẩn ngoài grid. |
| 7 | Schema lưu kích thước map thế nào? | Option A. | Chỉ lưu mapSizeStep; derive Width/Height từ công thức và dùng step 0 cho map gốc. |
| 8 | Hiển thị/chỉnh sửa map lớn thế nào? | Option C. | Mặc định Fit; bổ sung Zoom −/+/100% và pan/scroll. |
| 9 | Preset điều khiển Zoom/Pan nào? | Option A. | 100%=Fit; zoom 50%–300% bước 25%; Ctrl+wheel zoom, middle-drag hoặc Space+drag pan. |

## 4. [OPEN FLAGS] — Điểm chưa rõ, cần kiểm tra hoặc xác nhận thêm

- Không còn open flag blocking implementation.

## 5. Kết quả cuối phiên

### Công thức chuẩn

```text
BASE_WIDTH  = 17
BASE_HEIGHT = 28
WIDTH_STEP  = 2
HEIGHT_STEP = 4

width  = 17 + mapSizeStep × 2
height = 28 + mapSizeStep × 4
```

- `mapSizeStep` nội bộ nằm trong `[-6, 8]`.
- Step `-6` → `5 × 4` (kích thước nhỏ nhất).
- Step `0` → `17 × 28` (kích thước gốc/mặc định).
- Step `8` → `33 × 60` (kích thước lớn nhất, 1.980 cell).
- Tỷ lệ `2.0` là `ΔHeight/ΔWidth = 4/2`, không phải aspect ratio map cố định.

### UI kích thước

- Thay hai input Width/Height bằng một stepper: `−  Width × Height  +`.
- Thông số ở giữa chỉ đọc; không hiển thị `mapSizeStep` cho người dùng.
- Disable `−` tại `5 × 4`; disable `+` tại `33 × 60`.
- Mỗi lần tăng/giảm là một history action, hỗ trợ Undo/Redo.

### Quy tắc giảm map

- Trước khi giảm, tính vùng cột/hàng sẽ bị cắt.
- Nếu vùng đó còn path, fruit, snake, tray slot hoặc element bất kỳ: chặn thao tác và hiển thị cảnh báo.
- Không tự xóa và không giữ dữ liệu ẩn ngoài grid.

### Schema và validation

- Schema chỉ lưu `mapSizeStep`; Width/Height luôn được derive.
- Validator yêu cầu step nguyên trong `[-6, 8]`.
- Export JSON có thể kèm `computedSize` chỉ để đọc, nhưng không dùng làm nguồn dữ liệu.

### Fit, Zoom và Pan

- Mặc định `100% = Fit` toàn map trong canvas.
- Zoom từ `50%` đến `300%`, mỗi bước `25%` tương đối với Fit.
- Control: `Zoom −`, `100%/Fit`, `Zoom +`.
- `Ctrl + wheel` zoom quanh vùng con trỏ.
- Giữ chuột giữa hoặc `Space + kéo` để pan.
- Khi zoom lớn hơn Fit, canvas cho phép overflow/pan; thao tác vẽ và chuột phải xóa vẫn map đúng cell.
---
