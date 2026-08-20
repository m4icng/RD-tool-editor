# Plan triển khai tab Generate — Railway Dash Level Editor

## 1. Mục tiêu ## Goal

Tạo một tab `Generate` mới trong sidebar để quản lý riêng chức năng Auto Generator Level. Tab này sử dụng data level đã được designer chuẩn bị trong `Level Des`, cho phép cấu hình rule/độ khó, sinh item tự động, xem kết quả, kiểm tra lỗi và vẫn có đầy đủ thao tác chỉnh sửa/xóa level tương đương tab `Level Des`.

Generator chỉ sinh hoặc cập nhật danh sách item; không tự thay đổi path, path layer, tray, start point, delivery point, priority point hay element do designer vẽ sẵn.

## 2. Phạm vi chức năng

### 2.1. Sidebar

- Thêm menu `Generate` bên cạnh `Level Des`.
- Menu có trạng thái active, giữ layout/navigation convention hiện tại.
- Khi chuyển tab, giữ level đang chọn và trạng thái chỉnh sửa chưa lưu.
- Nếu có thay đổi chưa lưu, hiển thị confirmation trước khi chuyển level/tab.

### 2.2. Danh sách level trong tab Generate

- Hiển thị các level đã load từ folder/file hiện tại.
- Cho phép tìm kiếm, lọc, sắp xếp theo level ID/tên/trạng thái generate.
- Hiển thị trạng thái:
  - `Not Generated`: chưa có item generated.
  - `Generated`: generate thành công.
  - `Modified`: đã chỉnh sửa sau lần generate gần nhất.
  - `Error`: generate hoặc validate thất bại.
- Có thể chọn một hoặc nhiều level nếu cần hỗ trợ batch generate về sau.

### 2.3. Thao tác level tương đương Level Des

Tab Generate phải hỗ trợ tối thiểu các thao tác đang có ở `Level Des`:

- Reload/revert về data đã lưu cuối cùng.
- Undo/redo nếu `Level Des` đã có history stack.

Các thao tác trên phải dùng chung service/state với `Level Des`, tránh tạo hai nguồn dữ liệu khác nhau.

## 3. Layout tab Generate

### 3.2. Khu vực cấu hình generator

Nhóm `Source Data`:

- Path layer được đọc từ level design.
- Tray/item requirement được đọc từ data designer.
- Hiển thị số layer, số tray, tổng item cần sinh và số slot hợp lệ.
- Không cho chỉnh trực tiếp path/tray tại khu vực này; muốn sửa source phải mở `Level Des`.

Nhóm `Distribution Settings`:

- Tỉ lệ gom cụm cùng màu = `clusterRatio`, mặc định `80%`.
- Số item tối đa trong một nhóm`maxClusterSizePerBranch`, mặc định `6`.
- Mức độ cân bằng phân bổ item giữa các layer path = layerDistributionBalance.
- Mức độ cân bằng phân bổ item giữa các nhánh = branchDistributionBalance.
- Chế độ phân bổ nhiều nhánh.
- Seed ngẫu nhiên để tái lập kết quả = seed.
- Số lần thử lại tối đa khi phân bổ thất bại = maxRetries

Rule phân bổ item theo layer path
- Tổng số item yêu cầu trong các tray phải được phân bổ tương đối đều trên toàn bộ các layerIndex của path.
- Không dồn quá nhiều item vào một layer duy nhất nếu các layer khác vẫn còn slot hợp lệ.
- Item chỉ được đặt trên path thuộc đúng layerIndex tương ứng.
- Không tự chuyển item giữa các layer.
- Không tự thay đổi itemId hoặc amount trong tray.
- Trong mỗi layer, item tiếp tục được phân bổ tương đối đều giữa các branch hợp lệ.
- Nếu một layer không đủ slot hợp lệ, báo lỗi NOT_ENOUGH_VALID_CELLS.
- layerDistributionBalance là ưu tiên mềm; tổng số item thực tế của từng layer vẫn phải tuân theo dữ liệu tray do designer thiết kế.

Nhóm `Difficulty Settings`:

Các thông tin về **tray, số slot và item yêu cầu trong tray** được lấy trực tiếp từ dữ liệu map do designer thiết kế trong `Level Des`. Generator không cho phép thay đổi các giá trị này trong phần Difficulty Settings.

Difficulty Settings chỉ điều chỉnh cách phân bổ item và áp lực gameplay:

#### Tail Pressure

- `avgTailLengthTarget` — Độ dài đuôi tàu trung bình.
- `tailLengthGrowthCurve` — Kiểu tăng độ dài đuôi theo tiến trình level.
- `tailLengthCap` — Giới hạn độ dài đuôi tối đa.
- `tailLengthVariance` — Mức dao động độ dài đuôi giữa các đoạn.

#### Progression Pressure

- `progressionPressure` — Mức áp lực tổng thể theo tiến trình level.
- `pressureCurve` — Đường cong độ khó: `Flat`, `Ramp`, `Sawtooth`, `PeakLate`.
- `reliefSegmentRatio` — Tỷ lệ đoạn giảm áp lực giữa các đoạn khó.

#### Noise Pressure

- `noiseClusterCountBeforeTarget` — Số cụm item nhiễu trước item mục tiêu.
- `noiseItemCountPerCluster` — Số item trong mỗi cụm nhiễu.
- `noiseBeforeTargetRatio` — Tỷ lệ item nhiễu trước mục tiêu.
- `noiseSpacingMin` — Khoảng cách tối thiểu giữa các cụm nhiễu.
- `noiseColorDiversity` — Độ đa dạng itemId trong vùng nhiễu.

#### Item & Route Pressure

- `itemDensityTarget` — Mật độ item trên path hợp lệ.
- `clusterCompactness` — Mức độ gom các item cùng itemId.
- `branchDistributionBalance` — Độ cân bằng item giữa các nhánh.
- `routeChoicePressure` — Mức độ buộc người chơi cân nhắc lựa chọn nhánh.
- `decisionPointFrequency` — Tần suất xuất hiện điểm cần quyết định.

#### Collision Pressure

- `bodyCollisionPressure` — Mức nguy cơ đầu tàu va vào thân tàu.
- `narrowPathUsage` — Mức sử dụng các đoạn path hẹp.
- `obstacleProximity` — Khoảng cách item tới element hoặc vùng hạn chế.

Generator phải giữ nguyên tổng số item, itemId, amount, layer và thứ tự tray từ source data. Nếu setting khiến không thể phân bổ hợp lệ, hệ thống báo lỗi và không tự giảm số lượng item.

- Preset `Easy`, `Normal`, `Hard`, `Expert` để điền nhanh các giá trị mặc định.

Mỗi setting cần có tooltip mô tả, min/max, giá trị mặc định và cảnh báo khi cấu hình có khả năng làm generate thất bại.

### 3.3. Khu vực thao tác

- `Validate Source` — kiểm tra path/tray/element trước khi generate.
- `Generate Preview` — sinh thử trên bản copy trong memory, chưa ghi đè data.
- `Apply Generated Items` — ghi kết quả preview vào level hiện tại.
- `Generate & Apply` — validate, generate và apply liên tiếp.
- `Reset Generated Items` — xóa item generated, khôi phục trạng thái trước lần apply gần nhất.
- `Save` / `Save As` / `Export JSON`.

### 3.4. Khu vực preview

- Tái sử dụng canvas/renderer của `Level Des`.
- Hiển thị path, layer, tray, element và item generated theo màu/itemId.
- Có filter bật/tắt từng layer, từng itemId, item nhiễu và vùng cấm.
- Hiển thị cluster boundary, pathIndex, branch ID và sourceTrayId nếu có.
- Cho phép click item để xem metadata; không cho kéo item làm thay đổi source rule trong preview nếu chưa bật chế độ chỉnh sửa.
- Có toggle `Compare Before/After`.

### 3.5. Khu vực kết quả và lỗi

- Tổng số item yêu cầu / đã sinh / còn thiếu.
- Số cluster, số branch sử dụng, tỷ lệ clustering thực tế.
- Tail length trung bình, min/max và sai lệch so với target.
- Danh sách warning/error theo mã lỗi.
- Nút focus tới cell/path/tray gây lỗi.

## 4. Luồng xử lý chính

```text
Chọn level
  → Load source data từ Level Des
  → Validate path/tray/element
  → Đọc Generate Settings
  → Tạo working copy trong memory
  → Phân bổ item theo layer/branch/pathIndex
  → Áp difficulty settings và noise pressure
  → Chạy post-validation
  → Preview kết quả
  → Apply hoặc hủy
  → Save/Export JSON
```

## 5. Quy tắc generator bắt buộc

- Giữ nguyên data path/tray/element gốc.
- Xử lý từng `layerIndex` độc lập.
- Chỉ đặt item trên rail mà train thực sự đi qua.
- Không đặt lên start point, delivery point kết thúc, priority point, giao điểm, gate, bridge, tunnel hoặc block footprint.
- Layer 1 không đặt trong 2 `pathIndex` đầu sau start point.
- Không trùng cell/pathIndex.
- Item cùng `itemId` ưu tiên clustering theo `clusterRatio`, tối đa 6 item/cụm/nhánh.
- Được rải trên nhiều branch nhưng không dồn toàn bộ vào một branch.
- Không tự giảm `amount` trong tray khi thiếu slot.
- Nếu clustering không đạt, được giảm mức gom cụm nhưng phải giữ đủ tổng item.
- Giới hạn retry để tránh treo trình duyệt.

## 6. Validate và mã lỗi

Các nhóm validate:

- `SOURCE_INVALID`: thiếu path layer, route không playable hoặc pathIndex không hợp lệ.
- `TRAY_INVALID`: tray thiếu itemId/amount hoặc amount không dương.
- `NOT_ENOUGH_VALID_CELLS`: tổng item lớn hơn slot hợp lệ.
- `BRANCH_DISTRIBUTION_FAILED`: không thể phân bổ đúng rule branch/cluster.
- `GENERATION_FAILED`: thất bại sau số retry tối đa.
- `DIFFICULTY_OUT_OF_RANGE`: setting vượt giới hạn cho phép.
- `UNSAVED_CHANGES`: ngăn xóa/chuyển level khi còn thay đổi chưa lưu.

Mỗi lỗi phải có `code`, `message`, `severity`, `levelId`, `layerIndex` hoặc `trayId` nếu xác định được, cùng gợi ý xử lý.

## 7. Data model đề xuất

```json
{
  "generateSettings": {
    "seed": 12345,
    "clusterRatio": 0.8,
    "maxClusterSizePerBranch": 6,
    "maxRetries": 50,
    "difficultyPreset": "Normal",
    "avgTailLengthTarget": 8,
    "tailLengthGrowthCurve": "linear",
    "tailLengthCap": 14,
    "firstTrayItemCount": 3,
    "firstTrayAppearIndex": 4,
    "firstTrayUnlockDelay": 0,
    "noiseClusterCountBeforeTray": 1,
    "noiseItemCountPerCluster": 2,
    "noiseBeforeTrayRatio": 0.2,
    "noiseSpacingMin": 3
  },
  "generatedItems": [
    {
      "id": "item_001",
      "itemId": "red",
      "layerIndex": 1,
      "gridX": 4,
      "gridY": 2,
      "pathIndex": 8,
      "branchId": "branch_a",
      "sourceTrayId": "tray_01"
    }
  ],
  "generationMeta": {
    "status": "Generated",
    "generatedAt": 0,
    "generatorVersion": "1.0.0",
    "actualClusterRatio": 0.78,
    "avgTailLength": 7.9
  }
}
```

Nếu schema hiện tại không cho phép thêm top-level field, lưu settings/meta trong namespace riêng hoặc file sidecar; tuyệt đối không làm hỏng JSON gameplay cũ. Không làm thay đổi đến phần export data json

## 8. Kiến trúc triển khai

### Giai đoạn 1 — Tách module dùng chung

- Chuẩn hóa `LevelStore`, `LevelSelectionStore`, `SaveService`, `DeleteService` dùng cho cả hai tab.
- Tách `GeneratorEngine` khỏi UI.
- Tạo `GenerateSettings` schema và migration mặc định.

### Giai đoạn 2 — Sidebar và CRUD

- Thêm route/tab `Generate`.
- Tái sử dụng component danh sách level, confirmation dialog, toolbar và history.
- Kiểm tra đồng bộ selection/state khi chuyển qua lại `Level Des` ↔ `Generate`.

### Giai đoạn 3 — Generator UI và preview

- Xây dựng form settings, preset, validation inline.
- Kết nối preview với renderer hiện tại.
- Thêm compare before/after và highlight lỗi.

### Giai đoạn 4 — Generate/apply/save/export

- Implement working copy, preview, apply, reset.
- Bảo đảm generate thất bại không ghi đè data gốc.
- Bổ sung autosave draft nếu editor hiện tại có cơ chế draft.

### Giai đoạn 5 — QA và tối ưu

- Test toàn bộ rule IN/PL/TR/IT/DS/LY/EL/OUT/RT/DF.
- Test CRUD, reload folder, duplicate, delete, undo/redo và unsaved guard.
- Đo thời gian generate theo số layer/item; chạy generator ngoài main thread bằng Web Worker nếu cần.

## 9. Test scenario chính

| ID | Scenario | Expected |
|---|---|---|
| GEN-S01 | Mở tab Generate với level hợp lệ | Load đúng source data và settings mặc định |
| GEN-S02 | Validate level thiếu slot | Không generate, báo `NOT_ENOUGH_VALID_CELLS` |
| GEN-S03 | Generate preview thành công | Preview hiển thị item, data gốc chưa đổi |
| GEN-S04 | Hủy preview | Level giữ nguyên trước generate |
| GEN-S05 | Apply rồi Save | Chỉ generatedItems/settings/meta được cập nhật |
| GEN-S06 | Chuyển sang Level Des | Thấy đúng item đã apply và cùng level selection |
| GEN-S07 | Xóa level trong Generate | Level bị xóa theo cùng service của Level Des |
| GEN-S08 | Generate thất bại sau retry | Không treo tool, có reason và suggestion |
| GEN-S09 | Reload folder/file | Tab Generate mở lại đúng folder và danh sách level |
| GEN-S10 | Chỉnh preset/setting ngoài range | Chặn hoặc cảnh báo trước khi generate |

## 10. Tiêu chí hoàn thành

- Có tab `Generate` trong sidebar và điều hướng ổn định.
- CRUD level trong Generate có hành vi giống `Level Des`.
- Preview không làm thay đổi data gốc trước khi Apply.
- Generator tuân thủ toàn bộ rule đã chốt và trả lỗi có mã rõ ràng.
- Generate thành công không làm thay đổi path/tray/element designer đặt sẵn.
- Save/Export JSON tương thích schema Unity hiện tại.
- Không có vòng lặp vô hạn; retry có giới hạn và UI không bị treo.
- Có test cho happy path, boundary, error và high-risk scenario.

## 11. Rủi ro và phương án xử lý

| Rủi ro | Tác động | Xử lý |
|---|---|---|
| Hai tab giữ state riêng | Dữ liệu lệch giữa Level Des và Generate | Dùng chung LevelStore và immutable working copy |
| Generate ghi đè level lỗi | Mất dữ liệu designer | Preview/apply hai bước, backup trước khi save |
| Level lớn làm UI treo | Tool khó sử dụng | Web Worker, batch validation, giới hạn retry |
| Settings khó hiểu | Designer tạo level lỗi | Preset, tooltip, min/max, warning realtime |
| Schema cũ không có generatedItems | Unity parse lỗi | Versioned schema/migration và fallback field |

## 12. Change History

- 2026-08-20: Lưu plan riêng vào `plans/generate-tab-railway-dash-plan.md`.
- 2026-08-20: Thêm tab `Generate`, sidebar settings/source summary, topbar action Generate và panel kết quả.
- 2026-08-20: Tách module `generate-settings`, `generate-source`, `generator-engine`, `generate-panel`.
- 2026-08-20: Implement validate source, generate preview trong memory, apply generated items qua history hiện có và reset về backup trước lần apply gần nhất.
- 2026-08-20: Generator giữ nguyên path/tray/element, sinh item theo tray requirement trên valid path cells và không thay đổi schema export JSON.
