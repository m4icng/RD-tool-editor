# Railway Dash Auto Generator - Adaptive Auto-Tuning Parameters Plan

## 1. Goal

Thay đổi hệ thống `Generate Settings` từ dạng:

`Designer nhập cố định hàng loạt thông số`

sang:

`Generator tự phân tích Level -> tự tính thông số phù hợp -> Generate -> Simulation -> tự cân bằng lại`

Mỗi Level có topology, số Tray, số Item, số nhánh và khoảng cách xả khác nhau nên không dùng chung các giá trị cố định như:

- Average Tail = 4-5
- Peak Tail = 7
- Noise Ratio = 35%
- Cluster Size = 4
- Max Continuous Growth = 6
- Release Window = 7

Các thông số này trở thành `Derived Parameters` và được tính riêng cho từng Level.

## 2. System Principles

### A. Hard Rules

Hard Rules là rule gameplay không được Auto Tune phá vỡ.

- Tổng Item Map phải bằng tổng Tray Demand.
- Count từng màu Map = Tray.
- Item chỉ nằm trên Path hợp lệ.
- Không đặt Item tại vị trí cấm.
- Không duplicate Item cùng Layer.
- Cluster không vượt giới hạn thiết kế tuyệt đối nếu core rule yêu cầu.
- Level phải có ít nhất một solution.
- Không tạo deadlock.
- Không tự thay đổi Tray requirement của Designer.

Hard Rules không được nới lỏng chỉ để Generator PASS.

### B. Designer Intent

Designer chỉ cung cấp mục tiêu tổng quát:

- Preset Difficulty.
- Difficulty Score.
- Max Retry.
- Multi Branch Mode.
- Các Element / Path / Tray đã thiết kế.

Designer không cần tự nhập:

- Noise Ratio.
- Average Tail.
- Peak Tail.
- Release Pressure.
- Cluster Density.
- Continuous Growth.
- Release Cycle.
- First Release Distance.
- Branch Distribution.

### C. Auto Derived Parameters

Generator tự tính:

- Target Average Tail.
- Target Peak Tail.
- Safe Tail Limit.
- Noise Ratio.
- Required Color Ratio.
- Carry-over Ratio.
- Cluster Size Distribution.
- Cluster Adjacency Ratio.
- High Pressure Ratio.
- Continuous Growth Target.
- Release Amount Target.
- Release Cycle Count.
- Relief Duration.
- Item Density từng Layer.
- Branch Distribution.
- First Tray Safety.
- Repair Intensity.
- Search Depth / Beam Width.

Các giá trị này thay đổi theo từng Level.

## 3. Architecture

```text
Level Data
-> Level Analyzer
-> Topology Metrics
-> Demand Metrics
-> Release Opportunity Analysis
-> Difficulty Target
-> Parameter Estimator
-> Derived Generator Parameters
-> Generate Candidate
-> Gameplay Simulation
-> Difficulty Evaluator
-> Auto Tuner
-> Repair / Adjust Parameters
-> Re-simulate
-> PASS
```

## Current Implementation Scope

- Thêm module `js/generate/adaptive-parameters.js` để phân tích topology, demand, release opportunity và tính `Derived Parameters`.
- `Generate Settings` UI chỉ còn Designer Intent: preset, difficulty score, retry và multi-branch mode.
- Các thông số Tail / Release / Cluster / Spawn cũ được giữ làm fallback nội bộ, không còn là input designer chỉnh tay.
- `generator-engine.js` dùng derived parameters cho từng level trước mỗi attempt.
- Auto Tuner cập nhật `repairIntensity` theo lỗi retryable: tail pressure, release pressure, spawn trap và quota mismatch.
- Generation meta lưu `derivedParameters`, `autoTuningAttempt` và `autoTuningProfile` để panel kết quả hiển thị.
- Generate preview dùng đúng danh sách layer của preview state, nên xem được các layer item sinh ra thay vì chỉ layer nguồn đầu tiên.
- Generator partition `Global Item Pool` sang các Map Item Layer riêng; không map tuyến tính `Tray Layer -> Item Layer`.
- Noise/carry-over được tạo bằng cách đưa một phần demand của tray layer tương lai vào map layer sớm hơn, trong khi tổng itemId toàn map vẫn khớp tray.
- Mỗi Map Item Layer không bắt buộc phải chứa đủ item để fill tray hiện tại; layer có thể chủ yếu phục vụ tray layer 3-4 hoặc xa hơn.
- Demand planner chọn `future -> near-future -> anchor` từ toàn bộ tray queue, với future/carry-over ratio cao hơn để tạo thân dài.
- Placement planner chia map thành vùng 3x3 và cộng penalty cho vùng đã dày item, giúp các cụm rải đều toàn map thay vì tập trung nhiều vào một phía.
- Placement layer sau né index item của layer liền trước; overlap chỉ nằm khoảng 10-25% theo độ rộng map, và map càng rộng càng giảm trùng.
- Số item mỗi map/path layer được chia đều theo số layer hợp lệ; không dùng heuristic cố định khoảng 27-30 item/layer.
- Auto Derived mặc định tự tính theo level nhưng designer có thể override từng thông số; field đã chỉnh được khóa theo giá trị designer nhập cho lần generate.
- Mỗi field Auto Derived có tooltip giải thích thông số đó dùng để kiểm soát phần nào của generator.
- Các chỉ số chính của Auto Derived được chỉnh trực tiếp ngay trên summary grid, không tách thành nhóm input riêng bên dưới.
- Không thay đổi Path, Tray, Element, schema export JSON hoặc hard rule quota hiện có.

## Change History

- 2026-08-20: Lưu plan riêng vào `plans/adaptive-auto-tuning-parameters-plan.md`.
- 2026-08-20: Chuyển Generate Settings từ các thông số cố định sang Designer Intent + Auto Derived Parameters.
- 2026-08-20: Thêm adaptive analyzer/estimator/tuner và nối vào retry loop của Generator.
- 2026-08-20: Panel Generate hiển thị tham số dẫn xuất đọc-only cho từng level và kết quả tuning sau generate.
- 2026-08-20: Sửa Generate preview layer picker đọc từ preview state để xem được toàn bộ layer đã sinh.
- 2026-08-20: Sửa generator không còn sinh tuyến tính theo tray layer; thêm global demand partition với noise/carry-over từ future tray demand.
- 2026-08-20: Tăng tỷ lệ noise/carry-over và đổi layer planner sang chọn future demand trước, không ép layer hiện tại đủ fill tray hiện tại.
- 2026-08-20: Thêm spatial spread penalty theo vùng 3x3 để cụm item phân bổ đều hơn trên toàn map.
- 2026-08-20: Thêm adjacent layer overlap budget 10-25% để hạn chế item layer sau trùng index layer trước.
- 2026-08-20: Bỏ heuristic `totalItem / 32`; layer budget chia đều theo số layer path hợp lệ.
- 2026-08-20: Cho designer chỉnh từng Auto Derived parameter, lưu override key và thêm tooltip mô tả ý nghĩa field.
- 2026-08-20: Chuyển Auto Derived sang chỉnh trực tiếp trên summary grid.
