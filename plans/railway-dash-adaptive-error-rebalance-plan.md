# Railway Dash Auto Generator — Adaptive Error Rebalance Plan

## 1. Goal

Khi Auto Generator sinh Level nhưng gặp lỗi, hệ thống không dừng ngay hoặc chỉ báo lỗi cho Designer.

Generator phải:

```text
Generate
↓
Validate
↓
Detect Error
↓
Phân tích nguyên nhân
↓
Tự tính lại các thông số phù hợp với Level hiện tại
↓
Repair / Regenerate phần bị lỗi
↓
Simulation lại
↓
Lặp cho tới khi PASS hoặc đạt giới hạn an toàn
```

Các thông số Generator không được phụ thuộc vào một bộ giá trị cố định dùng cho mọi Level.

Hệ thống phải tự thích ứng theo:

- Diện tích Map.
- Số Path hợp lệ.
- Mật độ Path.
- Số Branch.
- Chiều dài Straight Run.
- Số Item Layer.
- Layer đang Locked.
- Layer đang Auto.
- Số Tray.
- Tổng số Tray Layer.
- Requirement từng màu.
- Số Item cần sinh.
- Release Opportunity.
- Tail Pressure.
- Capacity thực tế của từng Layer.

Mục tiêu:

`Mỗi Level tự có một Generate Profile phù hợp với chính topology và demand của Level đó.`

---

## 2. Không dùng Map Width × Height làm Capacity chính

Không nên đánh giá Level chỉ bằng:

`MapArea = width × height`

Ví dụ:

Map:

`13 × 24 = 312 Cell`

nhưng chỉ có:

`125 Path Cell`

thì Generator không được coi capacity là 312.

Phải tính:

`UsablePathCapacity`

từ các Path Cell thực sự có thể đặt Item.

---

## 3. Effective Map Capacity

Tính:

```text
EffectiveItemCells
=
Path Cells
-
PriorityPoint
-
DeliveryPoint
-
Spawn Restricted Cells
-
Bridge Footprint
-
Element Restricted Cells
-
Invalid Cells
```

Đây mới là Capacity cơ bản của Generator.

Ví dụ:

```text
Path Cell = 125
Restricted = 20

EffectiveItemCells = 105
```

Generator sử dụng `105`, không sử dụng toàn bộ diện tích Map.

---

## 4. Layer Capacity

Mỗi Item Layer có thể reuse cùng Path Index với Layer khác.

Vì vậy:

```text
TotalLayerCapacity
=
EffectiveItemCells × NumberOfAutoLayers
```

Ví dụ:

```text
EffectiveItemCells = 105

Auto Layers = 3
```

→ theoretical capacity:

`315 Item Slot`

Nhưng không được fill tới 100%.

Cần để khoảng trống để:

- cluster phân bố đẹp
- tránh concentration
- giữ flexibility cho Auto Repair
- tránh Item phủ gần hết Path

Do đó Generator tự tính:

`PracticalLayerCapacity`

thấp hơn theoretical capacity.

---

## 5. Capacity Utilization

Tính:

```text
RequiredDensity
=
RemainingItemCount
/
TotalAvailableAutoLayerCells
```

Ví dụ:

```text
Remaining Item = 90
Available Auto Layer Capacity = 300

RequiredDensity = 30%
```

Generator dựa vào tỷ lệ này để tự điều chỉnh:

- cluster size
- region coverage
- item per layer
- spacing
- noise
- number of clusters

Không dùng một Density cố định.

---

## 6. Phân loại mật độ tự động

Không cần Designer setup threshold cụ thể.

Generator tự đánh giá tương đối.

Concept:

```text
Low Density
→ rất nhiều Cell trống so với Item cần sinh

Medium Density
→ Item sử dụng một phần đáng kể Path

High Density
→ Item cần sử dụng phần lớn Candidate Cell
```

Khi Density thấp:

- spread rộng hơn
- cluster cách xa nhau hơn
- dùng nhiều Region hơn

Khi Density cao:

- giảm minimum spacing
- tăng cluster size
- chấp nhận Region saturation cao hơn
- vẫn giữ Hard Constraint

---

## 7. Tray Demand Analysis

Tính tổng Item cần có từ tất cả Tray Layer.

Ví dụ:

```text
Tray 0
8 Layer × 9 = 72

Tray 1
6 Layer × 9 = 54

Total Demand = 126
```

Generator phải derive toàn bộ Item Count từ:

`Tray Demand`

Không tự sinh số lượng Item độc lập.

---

## 8. Color Demand

Tính theo từng màu:

```text
ColorDemand[itemId]
=
Sum tất cả Tray Layer requirement của màu đó
```

Sau đó trừ Item của Locked Layers:

```text
RemainingColorDemand
=
TotalTrayColorDemand
-
LockedLayerColorCount
```

Generator chỉ sinh phần còn thiếu.

---

## 9. Item Layer Analysis

Tính:

```text
TotalItemLayers
LockedLayers
AutoLayers
```

Ví dụ:

```text
Total Layers = 4

Locked:
Layer 0

Auto:
Layer 1
Layer 2
Layer 3
```

Generator chỉ được phân:

`Remaining Demand`

vào:

`3 Auto Layers`

---

## 10. Auto Layer Load

Tính tải trung bình ban đầu:

```text
BaseLayerLoad
=
RemainingItemCount
/
AutoLayerCount
```

Ví dụ:

```text
Remaining = 90
Auto Layer = 3

Base ≈ 30 Item / Layer
```

Nhưng đây chỉ là điểm bắt đầu.

Không chia cứng:

`30 / 30 / 30`

---

## 11. Adaptive Layer Distribution

Layer Item Count phải tự điều chỉnh dựa trên:

- Capacity Layer.
- Locked Layer xung quanh.
- Tray Progress.
- Tail Curve.
- Release Opportunity.
- Difficulty progression.
- Straight Run availability.

Ví dụ Generator có thể chọn:

```text
Layer 1 = 27
Layer 2 = 30
Layer 3 = 33
```

thay vì:

```text
30 / 30 / 30
```

---

## 12. Tray Layer Complexity

Không chỉ tính số Item Layer.

Phải tính:

```text
TotalTrayLayers
```

Ví dụ:

```text
Item Layers = 4
Tray Layers = 14
```

Điều này có nghĩa một Item Layer phải phục vụ nhiều bước Tray progression.

Generator cần tính:

```text
TrayLayerPerItemLayerRatio
=
TotalTrayLayers / ItemLayerCount
```

Ví dụ:

`14 / 4 = 3.5`

Một Item Layer trung bình đang hỗ trợ khoảng 3-4 bước Tray.

Tỷ lệ càng cao:

→ Color sequencing càng quan trọng.

---

## 13. Demand Complexity

Tính Complexity dựa trên:

- số màu
- số Tray
- số Tray Layer
- màu lặp liên tục
- màu đổi liên tục
- số Tray hoạt động song song

Demand Complexity cao:

→ giảm Noise tự động.

---

## 14. Release Opportunity Analysis

Tìm các điểm Player có khả năng xả Item.

Dựa trên:

- DeliveryPoint.
- Route tới DeliveryPoint.
- PriorityPoint.
- Layer Transition.
- Tray State.

Build:

`ReleaseWindow[]`

Mỗi Window lưu:

```text
routeLength
candidateItemCount
expectedCollect
possibleRelease
tailRisk
```

---

## 15. Auto Tail Capacity

Không dùng:

`Max Tail = 7`

cứng cho mọi Level.

Generator phải estimate:

`SafeTailCapacity`

dựa trên topology.

Các yếu tố:

- khoảng cách giữa Junction.
- chiều dài corridor.
- khả năng loop.
- số branch escape.
- self-collision risk.
- turn density.
- release frequency.

Map hẹp:

→ Safe Tail thấp.

Map rộng/nhiều branch:

→ Safe Tail cao hơn.

---

## 16. Target Tail tự động

Từ:

`SafeTailCapacity`

và:

`Difficulty`

tính:

```text
TargetAverageTail
TargetPeakTail
HighPressureZone
```

Không lưu cố định trong Setting.

---

## 17. Adaptive Cluster Size

Cluster size tự tính từ:

- Item density.
- Straight Run Length.
- Remaining Demand.
- Region Capacity.
- Number of clusters needed.

Hard Rule:

`Cluster Size <= 6`

Nhưng preferred size thay đổi.

Map rộng, Density thấp:

```text
Preferred:
2-4
```

Map nhỏ, Density cao:

```text
Preferred:
4-6
```

---

## 18. Adaptive Cluster Count

Tính:

```text
EstimatedClusterCount
≈
LayerItemCount / AdaptiveAverageClusterSize
```

Nếu Map có nhiều Region:

→ giảm Avg Cluster Size để tạo thêm Cluster nhằm phủ Map.

Nếu Map ít Straight Run:

→ tăng Avg Cluster Size.

---

## 19. Adaptive Region Count

Không bắt buộc mọi Map dùng một Region Grid cố định.

Generator tự tính Region Grid dựa trên:

- Map Width/Height.
- Path bounding box.
- Effective Path Size.

Map nhỏ:

`2 × 2`

Map vừa:

`3 × 3`

Map dài theo chiều dọc:

`3 × 4`

Map rất lớn:

`4 × 4`

Không tạo quá nhiều Region đến mức mỗi Region chỉ có 1-2 Path Cell.

---

## 20. Region Capacity

Mỗi Region tính:

```text
RegionCapacity
=
Valid Item Cell trong Region
```

Region không có Path:

→ bỏ khỏi distribution.

Generator chỉ cân bằng giữa:

`Usable Regions`

---

## 21. Target Region Distribution

Không chia Item đều tuyệt đối.

Tính:

```text
RegionTargetShare
=
RegionCapacity / TotalUsableCapacity
```

Nhưng thêm anti-concentration rule.

Generator phải ưu tiên:

`Coverage First`

trước khi tối ưu tỷ lệ capacity.

---

## 22. Adaptive Coverage

Target Coverage tự tính từ:

```text
NumberOfClusters
UsableRegionCount
```

Expected coverage phải theo số Cluster thực tế.

---

## 23. Adaptive Branch Distribution

Generator tính:

```text
BranchCapacity
BranchTargetShare
BranchSaturation
```

Nếu Layer ít Cluster:

→ không ép dùng mọi Branch.

Nếu Layer nhiều Cluster:

→ tăng yêu cầu Branch coverage.

---

## 24. Error Classification

Khi Generate lỗi, đầu tiên phải phân loại.

```text
HARD_SOURCE_ERROR
CAPACITY_ERROR
DISTRIBUTION_ERROR
DIFFICULTY_ERROR
SOLVABILITY_ERROR
GENERATION_SEARCH_ERROR
```

---

## 25. HARD_SOURCE_ERROR

Ví dụ:

- Locked Layer chứa nhiều màu hơn Tray cần.
- Item Locked nằm ở vị trí invalid.
- Tray Demand malformed.
- Không có Spawn.
- Path bị disconnect nghiêm trọng.

Không tự cân bằng bằng cách thay đổi data Designer.

→ báo lỗi.

---

## 26. CAPACITY_ERROR

Generator cần tự thử rebalance trước:

```text
1. Recalculate Effective Capacity
2. Reduce spacing target
3. Increase average Cluster Size
4. Redistribute Layer Load
5. Use currently underused Straight Runs
6. Recalculate Auto Layer density
```

Nếu vẫn không đủ physical capacity:

→ mới báo lỗi thật.

---

## 27. ITEM_DISTRIBUTION_ERROR

Generator tự:

```text
Reduce preference cho Region hiện tại
↓
Increase Region Spread Weight
↓
Increase Distance Weight
↓
Move Cluster sang Region thiếu
↓
Revalidate
```

Không Generate lại toàn Level ngay.

---

## 28. CLUSTER_PLACEMENT_ERROR

Nếu Generator không tìm đủ Straight Cluster Candidate theo size mong muốn:

Fallback:

```text
6 → 4 + 2
5 → 3 + 2
4 → 2 + 2
```

Singleton chỉ là fallback cuối.

Không phá tổng Item.

---

## 29. RELEASE_PRESSURE_EXCEEDED

Generator tự:

```text
Identify Problem Release Window
↓
Decrease Noise Budget tại Window
↓
Move Required Color sớm hơn
↓
Push Near-future/Noise về sau
↓
Reduce Cluster spike
↓
Re-simulate
```

Không tự tăng Safe Limit để che lỗi.

---

## 30. TAIL_PRESSURE_TOO_HIGH

Generator:

- giảm Noise.
- tăng Required Color.
- giảm Continuous Growth.
- tăng Relief.
- split pressure cluster.
- move Required Cluster gần Release Opportunity.

---

## 31. TAIL_PRESSURE_TOO_LOW

Generator:

- tăng Near-future Color.
- tăng Noise tại Safe Window.
- delay một phần Required Cluster.
- tăng cluster size tại vùng an toàn.
- tăng carry-over.

Chỉ làm nếu vẫn đảm bảo solvability.

---

## 32. LAYER_IMBALANCE

Generator tự redistribute Item giữa Auto Layers dựa trên:

- capacity
- progression
- tray timing
- difficulty

Không chỉnh Locked Layer.

---

## 33. TRAY_LAYER_TIMING_ERROR

Nếu Item cần cho Tray xuất hiện quá muộn:

```text
Reserve Required Demand
↓
Move một phần màu cần lên Auto Layer sớm hơn
↓
Move màu Near-future xuống Layer sau
```

Không thay Tray.

---

## 34. Layer Demand Reservation

Trước khi Generate từng Layer:

Generator phải reserve màu cho:

- Locked Layers phía sau.
- Required Tray Layer sắp tới.
- Near-future Tray Layers.

Không dùng hết một Color quá sớm.

---

## 35. Auto Rebalance Profile

Mỗi lần Generate tạo runtime object:

`AutoGenerateProfile`

Concept:

```text
Map:
- effectiveCapacity
- density
- usableRegions
- branchCount

Layer:
- totalLayers
- lockedLayers
- autoLayers
- targetLoad[]

Tray:
- trayCount
- trayLayerCount
- colorDemand
- demandComplexity

Cluster:
- adaptiveMinSize
- adaptivePreferredSize
- expectedClusterCount

Difficulty:
- safeTail
- targetAverageTail
- targetPeakTail
- noiseBudget
- releaseTargets
```

Các thông số này không save vào Level JSON.

---

## 36. Profile Recalculation

Khi lỗi xảy ra:

```text
Current Profile
↓
Error Feedback
↓
Update Derived Parameters
↓
New Profile
```

Không chỉ tính Profile một lần.

---

## 37. Không chỉnh tất cả Parameter cùng lúc

Mỗi Error Type chỉ được phép chỉnh nhóm Parameter liên quan.

Ví dụ Distribution Error chỉ chỉnh:

- Region weight
- Branch weight
- Distance
- Cluster position

Tail Error chỉ chỉnh:

- Noise
- Required timing
- Cluster timing

Điều này giúp Generator ổn định và dễ debug.

---

## 38. Local Parameters thay vì Global Parameters

Không dùng một giá trị Noise Ratio cho cả Level.

Adaptive Parameter nên ưu tiên theo:

- từng Layer
- từng Release Window
- từng Branch nếu cần

---

## 39. Error Feedback Loop

```text
Generate Candidate
↓
Validate
↓
Error List
↓
Rank Errors
↓
Fix Highest Priority Error
↓
Re-simulate
↓
Validate lại
```

Không sửa nhiều lỗi cùng lúc nếu chúng có dependency với nhau.

---

## 40. Error Priority

```text
1. Hard Data Invalid
2. Solvability / Deadlock
3. Capacity
4. Tray Balance
5. Tail / Release Pressure
6. Layer Distribution
7. Spatial Distribution
8. Visual Cluster Quality
```

Không hy sinh solution để đạt distribution đẹp.

---

## 41. Local Repair trước Global Regenerate

Thứ tự:

```text
Local Cluster Repair
↓
Local Layer Repair
↓
Parameter Retune
↓
Regenerate Auto Layer
↓
Regenerate all Auto Layers
```

Không regenerate toàn bộ ngay khi chỉ một Region lỗi.

---

## 42. Locked Layer Rule

Locked Layer tuyệt đối không bị Auto Rebalance sửa.

Generator chỉ được:

- đọc.
- analyze.
- simulate.
- dùng làm anchor.

Nếu lỗi nằm trong Locked Layer:

→ cân bằng Auto Layer xung quanh nếu có thể.

Nếu không thể:

→ báo lỗi Designer.

---

## 43. Example — Map nhỏ nhưng nhiều Item

Input:

```text
Effective Path = 50
Auto Layers = 2
Remaining Item = 80
```

Generator tự:

```text
Increase Cluster Size
↓
Reduce Cluster Spacing
↓
Increase per-layer utilization
↓
Allow more candidate reuse across different Layers
↓
Reduce Region spread requirement
```

---

## 44. Example — Map lớn nhưng ít Item

Input:

```text
Effective Path = 150
Auto Layers = 4
Remaining Item = 60
```

Generator tự:

```text
Reduce Cluster Size
↓
Increase Cluster Count
↓
Increase Coverage
↓
Increase Distance preference
↓
Spread across more Regions / Branches
```

---

## 45. Example — Nhiều Tray Layer

Input:

```text
Item Layers = 4
Tray Layers = 16
```

Generator tự:

```text
Increase Tray Timing importance
↓
Reserve màu theo future demand
↓
Reduce uncontrolled Noise
↓
Increase Carry-over analysis
```

---

## 46. Example — Ít Tray Layer

Input:

```text
Item Layers = 4
Tray Layers = 4
```

Generator có thể:

- cho cluster lớn hơn.
- tăng spatial freedom.
- tăng Noise nếu topology an toàn.

---

## 47. Auto Retry

Mỗi lỗi có Repair Budget riêng.

Các số cụ thể có thể derive từ Level Size nhưng phải luôn có:

`Hard Max`

để tránh browser treo.

---

## 48. Không dùng Infinite Loop

Cấm:

```text
while (!pass) {
    generateAgain();
}
```

Phải dùng:

```text
attempt
repairIteration
candidateIteration
```

có giới hạn.

Nếu hết Budget:

→ return best candidate + error report.

---

## 49. Best Candidate Fallback

Trong quá trình Generate giữ:

```text
BestCandidate
BestScore
BestErrorCount
```

Nếu không candidate nào PASS hoàn toàn:

→ trả Candidate gần nhất.

Nhưng trạng thái phải:

`INVALID / NEED REVIEW`

không tự coi là PASS.

---

## 50. Adaptive Score

Candidate Score nên gồm:

```text
Solvability
Item Balance
Tail Difficulty
Release Pressure
Layer Balance
Region Distribution
Branch Distribution
Cluster Quality
```

Hard Fail không được bù bằng Soft Score.

---

## 51. Generate Button Flow mới

Khi bấm:

`Sinh xem trước`

hoặc:

`Sinh & áp dụng`

Flow:

```text
Analyze Level
↓
Build Adaptive Profile
↓
Generate Candidate
↓
Validate
↓
Auto Rebalance
↓
Validate
↓
Auto Rebalance
↓
PASS?
    YES
    → Preview / Apply
↓
NO
↓
Try New Candidate
↓
Final Result
```

---

## 52. UI trạng thái Auto Balance

Generate Tab có thể hiển thị read-only:

```text
AUTO BALANCE

Map Capacity
105 usable cells

Auto Layers
3

Remaining Items
90

Density
28.6%

Tray Layers
14

Adaptive Cluster
3-5

Safe Tail
8

Current Attempt
2

Auto Repair
Release Pressure
```

Designer không cần nhập các thông số này.

---

## 53. Error UI sau Auto Repair

Nếu lỗi đã sửa:

```text
✓ RELEASE_PRESSURE_EXCEEDED
Auto balanced

Before: Peak 11
After:  Peak 8
```

Nếu không sửa được:

```text
✕ LOCKED_LAYER_PRESSURE_EXCEEDED

Không thể tự cân bằng vì nguồn lỗi nằm trong Layer đang Locked.
```

---

## 54. Auto Settings không cần Designer chỉnh

Generate Tab chỉ nên để Designer điều khiển:

```text
Difficulty
Seed
Layer Lock
Generate
```

Các thông số:

- density
- cluster
- noise
- tail
- distribution
- coverage
- repair

được Generator tự tính.

---

## 55. Architecture đề xuất

```text
LevelState
↓
LevelAnalyzer
↓
AdaptiveProfileBuilder
↓
ItemLayerPlanner
↓
StraightClusterGenerator
↓
SpatialDistributor
↓
GameplaySimulator
↓
ErrorAnalyzer
↓
AutoRebalanceController
↓
LocalRepair
↓
FinalValidator
```

Tách rõ Analysis, Generation và Simulation.

---

## 56. Hai phương án triển khai

### Option A — Rule-Based Adaptive Rebalance

Mỗi loại lỗi map tới một nhóm action cụ thể.

Ưu điểm:

- Dễ implement.
- Dễ debug.
- Deterministic.
- Performance tốt.
- Phù hợp tool hiện tại.

Nhược điểm:

- Có thể cần bổ sung rule khi xuất hiện error mới.

Recommended cho version hiện tại.

### Option B — Multi-Candidate Optimizer

Generator sinh nhiều bộ parameter khác nhau và chọn candidate tốt nhất sau Simulation.

Ưu điểm:

- Có thể tìm kết quả tốt hơn.
- Ít phụ thuộc rule thủ công.

Nhược điểm:

- CPU cao.
- Khó debug hơn.
- Dễ chậm trên browser.

Nên dùng sau khi Option A ổn định.

---

## 57. Recommended Hybrid

Production nên dùng:

```text
Adaptive Rule-Based Profile
+
Local Repair
+
Small Candidate Search
```

Không brute-force.

---

## 58. Performance

Gọi:

```text
P = Path Cell
N = Item Count
S = Simulation Step
R = Repair Iteration
C = Candidate Count
```

Level Analysis:

`O(P + N)`

Generation:

`O(N + CandidateClusterSearch)`

Simulation:

`O(S)`

Auto Repair:

`O(R × S)`

Candidate Search:

`O(C × R × S)`

Cần giới hạn R, C và branch search để browser không bị treo.

---

## 59. Final Adaptive Generate Flow

```text
READ LEVEL
↓
Analyze:
- Map
- Effective Path Capacity
- Item Layers
- Locked Layers
- Auto Layers
- Tray Count
- Tray Layers
- Color Demand
- Release Opportunities
↓
Calculate:
- Remaining Demand
- Required Density
- Auto Layer Load
- Adaptive Cluster Size
- Region Layout
- Branch Targets
- Tail Safety
- Noise Budget
↓
GENERATE
↓
SIMULATE
↓
VALIDATE
↓
ERROR?
    NO
    → PASS
↓
YES
↓
CLASSIFY ERROR
↓
Can Local Repair?
    YES
    → Adjust local parameters
    → Repair
    → Simulate
↓
NO / Repair Failed
↓
Recalculate Adaptive Profile
↓
Regenerate affected Auto Layer
↓
Simulate
↓
Still Fail?
↓
Try Limited Candidate Variants
↓
PASS
or
RETURN BEST INVALID CANDIDATE + ERROR REPORT
```

---

## 60. Definition of Done

- Generator tự tính thông số dựa trên diện tích Path thực tế.
- Không dùng Width × Height làm Item Capacity chính.
- Số Item Layer ảnh hưởng Layer Load.
- Locked Layer được reserve trước.
- Auto Layer nhận Remaining Demand.
- Tổng Tray Layer ảnh hưởng Color Timing.
- Tray Demand là source-of-truth số Item.
- Cluster Size tự scale theo Density.
- Cluster Count tự scale theo Map.
- Region Count tự scale theo Map.
- Coverage tự scale theo Cluster Count.
- Branch Distribution tự scale theo Capacity.
- Tail Target tự scale theo topology.
- Noise Budget tự scale theo Release Opportunity.
- Lỗi Capacity được Auto Rebalance trước khi Fail.
- Lỗi Distribution được Local Repair.
- Lỗi Tail/Release Pressure tự điều chỉnh Item timing.
- Lỗi Layer imbalance tự redistribute Auto Layer.
- Locked Layer không bị chỉnh.
- Auto Tune không sửa Tray Designer.
- Không tự tăng Hard Limit để che lỗi.
- Mọi retry có giới hạn.
- Không có infinite loop.
- Có Best Candidate fallback.
- Auto Profile không lưu vào Level JSON.
- Generate Tab không cần Designer setup các thông số kỹ thuật cố định.
- Mỗi Level tự sinh ra một bộ parameter phù hợp với Map, Item Layers và Tray Layers của chính Level đó.

---

## Current Implementation Scope

- Them runtime `AutoGenerateProfile` cho map capacity, auto layer load, tray/color demand, cluster target, release window va tail target.
- Them error classification theo group/priority va retry budget rieng cho capacity, distribution, difficulty, layer, tray timing va search.
- Generate loop giu `BestCandidate`, tra ve `INVALID / NEED REVIEW` neu khong PASS nhung co candidate gan nhat.
- Capacity khong dung `width x height`; source analyzer dung Path usable thuc te va total auto layer slots.
- Locked Layer chi doc/tru quota; item locked o vi tri invalid hoac vuot demand duoc bao hard source error.
- Cluster size hard cap ve `<= 6`; singleton chi xuat hien qua fallback split khi khong con candidate lon hon.
- Region grid tu tinh theo bounding box va so cell usable thay vi co dinh 3x4 cho moi map.
- Generate Tab hien `Auto Balance` read-only; cac thong so ky thuat auto-derived khong con la input chinh tay.
- Best candidate chua PASS chi cho xem truoc, khong cho apply tu dong.

## Change History

- 2026-08-20: Luu plan vao `snacky-level-editor/plans/railway-dash-adaptive-error-rebalance-plan.md`.
- 2026-08-20: Them `auto-generate-profile.js`, `error-analyzer.js`, `auto-rebalance-controller.js`.
- 2026-08-20: Cap nhat generator retry loop sang adaptive profile + classified rebalance + best candidate fallback.
- 2026-08-20: Cap nhat region distribution adaptive, cluster hard cap 6 va Generate UI Auto Balance read-only.
