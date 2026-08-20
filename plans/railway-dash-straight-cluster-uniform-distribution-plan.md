# Railway Dash Auto Generator — Straight Cluster Placement & Uniform Map Distribution Plan

## 1. Mục tiêu

Refactor phần `Generate Item` trong từng `itemLayer` để xử lý 2 vấn đề chính:

1. Các Item cùng màu phải được sinh thành cụm liên tiếp đúng theo chiều của Path:
   - Horizontal
   - Vertical

2. Các cụm Item phải được trải tương đối đồng đều trên toàn bộ Map/Path khả dụng, thay vì Generator hiện tại chọn một vùng tốt rồi dồn gần như toàn bộ Item của Layer vào:
   - giữa Map
   - góc trên
   - góc dưới
   - hoặc một Branch duy nhất

Core mới:

`Path → Straight Runs → Cluster Candidates → Spatial Distribution → Color Assignment → Simulation → Repair`

Không Generate theo kiểu:

`Pick một seed → tiếp tục tìm Cell gần seed → fill gần hết Layer quanh khu vực đó`

---

## 2. Phạm vi thay đổi

Chỉ refactor logic phân bố Item trong Generator.

Không thay đổi JSON Level hiện tại:

```text
itemLayers
→ layer
→ items
→ itemId
→ index[]
```

Không thêm cluster data vào JSON.

Các data như:

- StraightRun
- ClusterCandidate
- Region
- Branch
- Cluster ownership
- Distribution score

chỉ tồn tại trong Generator Runtime.

---

## 3. Các rule Item hiện tại cần giữ

Generator mới vẫn phải tuân thủ các rule hiện tại:

- Item chỉ được đặt trên Path hợp lệ.
- Không đặt tại PriorityPoint.
- Không đặt tại DeliveryPoint.
- Không đặt tại index các ngã rẽ
- Không đặt tại các Element/vùng cấm.
- Không đặt trong Bridge footprint.
- Không đặt tại Spawn theo restriction hiện tại.
- Không duplicate index trong cùng Item Layer.
- Cùng một index có thể reuse ở Layer khác nếu gameplay cho phép.
- Item cùng màu ưu tiên nằm thành cụm.
- Một cụm tối đa `6 Item`.
- Không dồn toàn bộ Item cùng màu vào một vùng Map.
- Locked Item Layer không được Generator thay đổi.
- Auto Tune chỉ được sửa các Layer `AUTO`.

Hard Constraint luôn ưu tiên các rule visual/distribution mềm.

---

## 4. Thay đổi đơn vị Generate

### Logic cũ cần loại bỏ

Không Generate theo từng Item:

```text
For each Item
→ Pick Candidate Cell
→ ưu tiên Cell gần Item vừa đặt
→ đặt Item
```

Cách này dễ tạo:

```text
■■■■■■
■■■■■■
■■■■■■
```

tập trung tại một vùng nhỏ.

### Logic mới

Đơn vị Generate là:

`Cluster`

Flow:

```text
Calculate Item Count
↓
Split thành Cluster Sizes
↓
Tìm Straight Cluster Candidate
↓
Phân Cluster lên nhiều Region / Branch
↓
Commit toàn Cluster
```

Ví dụ cần sinh:

`30 Red`

có thể chia thành:

```text
6 + 5 + 5 + 4 + 4 + 3 + 3 = 30
```

Sau đó từng cluster được đặt ở các vùng khác nhau.

---

## 5. Path Preprocessing

Trước khi Generate bất kỳ Layer nào:

Build `ValidItemCellSet`.

Bắt đầu từ:

`Path.index`

Loại bỏ:

- PriorityPoint
- DeliveryPoint
- Spawn restricted cell
- Bridge visual footprint
- Gate restricted cell
- Tunnel restricted cell
- OneWay restricted cell nếu rule hiện tại cấm
- Count Barrier restricted cell nếu có
- Element khác không cho Item
- Cell invalid ngoài Map

Sử dụng:

`Set<int>`

để lookup index hợp lệ gần `O(1)`.

---

## 6. Split Path thành Straight Runs

Không Generate Cluster trực tiếp trên Graph.

Trước tiên chia Path thành các đoạn thẳng liên tục:

`StraightRun`

Mỗi StraightRun chỉ có một orientation:

```text
Horizontal
```

hoặc:

```text
Vertical
```

Concept:

```text
Horizontal Run

───────1─2─3─4─5─6─7──────
```

```text
Vertical Run

1
│
2
│
3
│
4
│
5
```

---

## 7. StraightRun Boundary

StraightRun phải kết thúc khi gặp:

- Corner
- Junction
- PriorityPoint
- DeliveryPoint
- Bridge footprint
- Element blocked
- Path không còn tiếp tục thẳng

Không cho một StraightRun tự đi qua góc.

Ví dụ:

```text
──────┐
      │
      │
```

phải được tách thành:

```text
Run A = Horizontal

──────
```

và:

```text
Run B = Vertical

│
│
```

---

## 8. Rule Cluster không được bẻ góc

Một cluster bắt buộc nằm hoàn toàn trên một StraightRun.

Valid:

```text
Horizontal

■ ■ ■ ■ ■
```

Valid:

```text
Vertical

■
■
■
■
```

Invalid:

```text
■ ■ ■
    ■
    ■
```

Trường hợp bẻ góc phải được hiểu là:

```text
Cluster A = Horizontal
Cluster B = Vertical
```

Không phải một Cluster.

---

## 9. StraightRun Runtime Data

Recommended runtime structure concept:

```text
StraightRun
- id
- orientation
- indices[]
- length
- branchId
- regionId
- usableIndices[]
```

Không cần export.

---

## 10. Build Cluster Candidate

Sau khi có StraightRun:

Sinh tất cả candidate window khả dụng cho cluster size:

`2 → MaxClusterSize`

Ví dụ Run:

```text
[1,2,3,4,5,6,7,8]
```

Cluster size 4:

```text
[1,2,3,4]
[2,3,4,5]
[3,4,5,6]
[4,5,6,7]
[5,6,7,8]
```

Cluster size 6:

```text
[1,2,3,4,5,6]
[2,3,4,5,6,7]
[3,4,5,6,7,8]
```

Mỗi candidate phải:

- cùng StraightRun
- contiguous
- cùng orientation
- không chứa invalid index
- chưa bị Item khác trong cùng Layer chiếm

---

## 11. Cluster Candidate Runtime Data

```text
ClusterCandidate
- straightRunId
- orientation
- indices[]
- size
- centerX
- centerY
- regionId
- branchId
```

Có thể precompute một phần trước khi Generate.

---

## 12. Max Cluster Rule

Hard limit hiện tại:

`MaxClusterSize = 6`

Generator không được tạo một cluster > 6.

Preferred size:

```text
3 → 6
```

Có thể tạo:

```text
2
```

nếu:

- StraightRun ngắn
- Remaining Demand nhỏ
- cần rebalance distribution

Singleton chỉ nên dùng khi thật sự cần.

---

## 13. Tránh Mega Cluster cùng màu

Hai cluster cùng màu không được đặt liền sát nhau nếu kết quả visual trở thành một chuỗi dài vượt MaxClusterSize.

Ví dụ:

```text
Cluster A Red = 6
Cluster B Red = 5
```

Nếu đặt:

```text
RRRRRRRRRRR
```

thực tế thành cluster 11.

Phải reject hoặc chọn candidate khác.

Rule:

```text
ResultingContiguousSameColor <= MaxClusterSize
```

---

## 14. Spatial Distribution Problem

Không được dùng khoảng cách tới Map Center làm tiêu chí chính.

Không được chọn một Region rồi fill đến gần đầy mới chuyển vùng.

Generator cần kiểm soát distribution theo:

1. Spatial Region
2. Branch
3. Distance giữa Cluster
4. Local Density

---

## 15. Chia Map thành Spatial Region

Chia Map thành grid logic phục vụ Generator.

Recommended ban đầu:

```text
3 cột × 4 hàng
```

Ví dụ:

```text
┌─────┬─────┬─────┐
│ A1  │ A2  │ A3  │
├─────┼─────┼─────┤
│ B1  │ B2  │ B3  │
├─────┼─────┼─────┤
│ C1  │ C2  │ C3  │
├─────┼─────┼─────┤
│ D1  │ D2  │ D3  │
└─────┴─────┴─────┘
```

Region chỉ dùng runtime.

Không liên quan JSON.

---

## 16. Region không chia Item bằng nhau tuyệt đối

Không áp dụng:

```text
Mỗi Region = cùng số Item
```

vì số Path hợp lệ trong từng vùng khác nhau.

Thay vào đó tính:

```text
RegionCapacity
=
số Valid Item Cell trong Region
```

Sau đó:

```text
TargetRegionWeight
=
RegionCapacity / TotalCapacity
```

Ví dụ:

```text
Region A Capacity = 30
Region B Capacity = 10
Region C Capacity = 20
```

A có thể nhận nhiều Cluster hơn B.

Nhưng không cho A ăn gần hết toàn bộ Layer.

---

## 17. Region Runtime Data

```text
Region
- id
- validCellCount
- availableCellCount
- currentItemCount
- currentClusterCount
- targetItemCount
- saturation
```

Trong đó:

```text
saturation =
currentItemCount / targetItemCount
```

Region có saturation thấp được ưu tiên hơn.

---

## 18. Coverage First

Placement phase đầu phải ưu tiên phủ Map.

Ví dụ Layer có:

`8 Cluster`

và có:

`6 Region khả dụng`

Ưu tiên:

```text
Cluster 1 → Region A
Cluster 2 → Region B
Cluster 3 → Region C
Cluster 4 → Region D
Cluster 5 → Region E
Cluster 6 → Region F
```

sau đó mới:

```text
Cluster 7 → Region cần thêm
Cluster 8 → Region cần thêm
```

Không:

```text
A
A
A
A
B
C
...
```

chỉ vì A có nhiều candidate tốt.

---

## 19. Branch Distribution

Region chưa đủ để chống dồn.

Cần chia Path thành `Branch/Segment`.

Mỗi Branch lưu:

```text
branchId
itemCapacity
currentItemCount
currentClusterCount
```

Generator phải tránh việc:

```text
Branch A = 25 Item
Branch B = 2 Item
Branch C = 1 Item
```

nếu B/C vẫn còn candidate hợp lệ.

---

## 20. Branch Quota

Tương tự Region:

```text
BranchTarget
∝
ValidCapacity của Branch
```

Candidate trên branch đang underfilled:

→ tăng score.

Candidate trên branch đang quá đầy:

→ giảm score.

---

## 21. Farthest Cluster Distribution

Sau khi đặt cluster đầu tiên:

Cluster tiếp theo nên ưu tiên xa các cluster hiện tại.

Không chọn:

```text
■■■■ ■■■■ ■■■■
```

tập trung thành một dải nhỏ.

Ưu tiên:

```text
■■■■

                 ■■■■

        ■■■
```

nếu topology cho phép.

---

## 22. Distance Metric

Khoảng cách có thể tính bằng:

### Option A — Grid Manhattan Distance

```text
|x1 - x2| + |y1 - y2|
```

Nhanh và dễ implement.

### Option B — Path Distance

Khoảng cách thật trên Graph.

Chính xác hơn với Railway Dash nhưng đắt hơn.

Recommended v1:

`Grid Distance + Branch/Region penalty`

Không cần shortest-path cho mọi candidate.

---

## 23. Local Density

Mỗi candidate cần kiểm tra mật độ Item xung quanh.

Ví dụ bán kính:

`R = adaptive theo Map hoặc khoảng 3-5 Cell`

Tính:

```text
NearbyItemCount
```

Nếu khu vực đã nhiều Item:

→ tăng penalty.

Điều này chống việc Cluster nằm sát nhau dù thuộc Region khác nhau.

---

## 24. Candidate Scoring

Không random toàn bộ.

Tính Weighted Score cho mỗi Cluster Candidate.

Concept:

```text
CandidateScore =
    RegionNeedScore
  + BranchNeedScore
  + DistanceScore
  + OrientationFitScore
  + DifficultyScore
  + ClusterFitScore
  - LocalDensityPenalty
  - SaturationPenalty
  - SameColorMergePenalty
```

Không cần sử dụng weight cố định hard-code.

Weight có thể được Auto Tune theo Level Analysis hiện tại.

---

## 25. Priority của Distribution

Khi chọn Candidate, priority tổng quát:

```text
1. Hard Validity
2. Coverage
3. Region Balance
4. Branch Balance
5. Cluster Distance
6. Difficulty / Tail Pressure
7. Random variation
```

Random chỉ dùng cuối cùng để phá tie.

Không để Random quyết định distribution chính.

---

## 26. Cluster Size Selection

Không chọn size cố định.

Dựa trên:

- Remaining Item Count
- Remaining Color Demand
- StraightRun Length
- Region Capacity
- Branch Capacity
- Current Density
- Difficulty Target

Concept:

```text
Long empty Run
→ ưu tiên 4-6

Medium Run
→ 3-5

Short Run
→ 2-3

Dense Region
→ giảm cluster size
```

---

## 27. Split Item Demand thành Cluster

Ví dụ:

```text
Remaining Red = 18
```

Có thể split:

```text
6 + 5 + 4 + 3
```

hoặc:

```text
5 + 5 + 4 + 4
```

Không bắt buộc luôn tối đa 6.

Variation phải deterministic theo Seed.

---

## 28. Color Placement Strategy

Không nên hoàn toàn:

```text
Place tất cả Red
→ tất cả Blue
→ tất cả Green
```

vì màu đầu tiên có thể chiếm hết candidate tốt.

Nên sử dụng:

`Interleaved Cluster Placement`

Ví dụ:

```text
Red Cluster
Green Cluster
Blue Cluster
Red Cluster
Purple Cluster
Green Cluster
...
```

theo demand + Tray timing.

Điều này giúp distribution giữa màu tự nhiên hơn.

---

## 29. Required / Noise Priority vẫn phải giữ

Spatial Distribution không được phá Difficulty Generator.

Candidate phải vẫn xét:

- Active Tray Color
- Near-future Color
- Noise
- Tail Pressure
- Release Window

Nếu một Region rất trống nhưng đặt Noise tại đó làm solution vượt Tail Pressure:

→ không chọn candidate đó.

Priority:

```text
Gameplay Validity
>
Difficulty Safety
>
Spatial Beauty
```

---

## 30. Integrate với Tail Curve

Sau khi đặt Cluster:

Generator có thể estimate ảnh hưởng tới:

- Tail Growth
- Release Pressure
- Continuous Growth
- Tray Completion

Nếu Candidate làm:

```text
Peak Tail vượt Safe Tail
```

→ giảm score hoặc reject.

Không đợi đến cuối mới phát hiện tất cả vấn đề.

---

## 31. Locked Layer Integration

Nếu Layer:

`LOCKED`

→ không chạy Generate Cluster cho Layer đó.

Chỉ Analyze:

- distribution
- cluster
- difficulty
- demand usage

Nếu Layer:

`AUTO`

→ Generator có quyền sử dụng thuật toán mới.

Locked Layer vẫn được dùng làm Difficulty Anchor cho các Layer sau.

---

## 32. Layer Generate Flow

Cho mỗi Layer AUTO:

```text
Read Remaining Demand
↓
Build/Reuse Valid Cell Set
↓
Build Straight Runs
↓
Calculate Region Capacity
↓
Calculate Branch Capacity
↓
Split Item Demand into Clusters
↓
Interleave Color Cluster Queue
↓
Coverage First Placement
↓
Weighted Candidate Placement
↓
Validate Spatial Distribution
↓
Simulate Gameplay
↓
Repair nếu cần
```

---

## 33. Spatial Distribution Validation

Sau khi sinh xong Layer, tính các metric.

### Coverage Ratio

```text
OccupiedRegions / AvailableRegions
```

Nếu Layer có đủ cluster nhưng chỉ dùng 1-2 Region:

→ Fail/Repair.

### Largest Region Share

```text
MaxRegionItems / TotalLayerItems
```

Nếu một Region chiếm tỷ lệ quá lớn trong khi Map còn nhiều capacity khác:

→ Concentration Warning.

Không dùng threshold cố định tuyệt đối.

Threshold phải adapt theo:

- số Region khả dụng
- số Cluster
- capacity distribution

### Branch Imbalance

Đánh giá lệch Item giữa Branch so với capacity.

Không chỉ so raw count.

### Average Cluster Distance

Đo khoảng cách trung bình giữa các cluster.

Quá thấp:

→ cluster đang co vào cùng khu vực.

### Local Concentration

Tìm khu vực nhỏ có lượng Item quá cao.

Dùng để bắt trường hợp nhiều Region có Item nhưng vẫn dồn sát ranh giới giữa các Region.

---

## 34. Distribution Score

Có thể tạo:

`SpatialDistributionScore`

từ:

```text
Coverage
Region Balance
Branch Balance
Cluster Distance
Local Density
```

Không dùng score thay Hard Rules.

Score chỉ phục vụ:

- Candidate comparison
- Auto Repair
- Debug UI

---

## 35. Local Repair

Nếu distribution không đạt:

Không regenerate toàn Layer ngay.

Tìm:

`Overfilled Region / Branch`

sau đó chọn một Cluster movable.

Ví dụ:

```text
Region A = 18 Item
Region B = 2
Region C = 5
```

Move:

```text
Cluster size 5
A → B
```

Result:

```text
A = 13
B = 7
C = 5
```

Repair theo Cluster, không move từng Item.

---

## 36. Cluster Repair Candidate

Khi move Cluster:

Candidate mới phải:

- cùng orientation phù hợp với StraightRun mới
- đủ size
- không overlap
- không vượt Same Color Cluster limit
- không phá Tray/Release logic
- nằm tại Region/Branch cần bổ sung

Sau Move:

→ re-run distribution metric.

---

## 37. Repair Order

Nếu Layer bị dồn Item:

```text
1. Move Cluster từ Region quá đầy sang Region thiếu
2. Move Cluster sang Branch thiếu
3. Tăng khoảng cách giữa các Cluster
4. Split Cluster nếu vùng khác chỉ có run ngắn
5. Swap vị trí hai Cluster
6. Regenerate Layer nếu Repair thất bại
```

Không bắt đầu bằng regenerate toàn bộ.

---

## 38. Bound Repair

Không dùng:

```text
while (!balanced)
```

không giới hạn.

Phải có:

```text
MaxDistributionRepairIterations
```

Giá trị có thể adapt theo:

- Layer Item Count
- Cluster Count
- Path Size

nhưng luôn phải có Hard Cap.

Nếu vượt cap:

→ regenerate candidate Layer bằng sub-seed khác.

---

## 39. Candidate Search Optimization

Không scan toàn bộ candidate từ đầu cho mỗi cluster nếu không cần.

Recommended index:

```text
candidatesBySize
candidatesByRegion
candidatesByBranch
candidatesByOrientation
```

Có thể lọc nhanh:

```text
desiredSize
+
underfilledRegion
```

rồi mới score subset candidate.

---

## 40. Occupancy

Mỗi Layer sử dụng:

```text
occupiedIndexSet
```

Check cluster overlap:

```text
for each index in candidate.indices
→ occupiedIndexSet.has(index)
```

Cluster max 6 nên check gần:

`O(6) ≈ O(1)`

rất rẻ.

---

## 41. StraightRun Cache

Path không thay đổi giữa các lần Generate Item.

Do đó có thể cache:

```text
StraightRuns
RegionMapping
BranchMapping
BaseClusterCandidates
```

Invalidate khi:

- Path thay đổi
- PriorityPoint thay đổi
- Element làm thay đổi valid Item Cell
- Map resize

Không rebuild toàn bộ khi chỉ đổi Seed.

---

## 42. Debug Visualization

Generate Tab nên có Debug Overlay tùy chọn:

```text
[ ] Show Regions
[ ] Show Straight Runs
[ ] Show Cluster Bounds
[ ] Show Branch ID
```

Khi bật:

- Region hiển thị nhẹ.
- StraightRun có ID.
- Cluster được outline.
- Có thể inspect Score Candidate.

Chỉ phục vụ Editor.

Không ảnh hưởng JSON.

---

## 43. Debug Report

Sau Generate có thể hiển thị:

```text
LAYER 2 DISTRIBUTION

Items:             31
Clusters:           7
Regions Used:       7 / 9
Branches Used:      6 / 7

Largest Region:    19%
Avg Cluster Size:  4.4
Avg Distance:      8.2

Distribution:
PASS
```

Nếu Fail:

```text
ITEM_CONCENTRATION_HIGH

Layer: 2

Region C2:
14 / 31 Item

Other usable regions still have capacity.

Repair:
Move Cluster #5 from C2 → A3
```

---

## 44. Error / Warning Codes

### ITEM_CLUSTER_TURN_INVALID

Cluster bị bẻ góc.

### ITEM_CLUSTER_TOO_LARGE

Cluster cùng màu vượt MaxClusterSize.

### ITEM_REGION_CONCENTRATION_HIGH

Quá nhiều Item nằm trong một Spatial Region.

### ITEM_BRANCH_CONCENTRATION_HIGH

Quá nhiều Item nằm trên một Branch.

### ITEM_CLUSTER_DISTANCE_TOO_LOW

Các Cluster nằm quá sát nhau.

### ITEM_DISTRIBUTION_REPAIR_FAILED

Không thể rebalance Layer trong giới hạn Repair.

---

## 45. Hai phương án implementation

### Option A — Region Quota + Straight Runs

Flow:

```text
StraightRun
+
Region Capacity
+
Branch Capacity
```

Sau đó phân Cluster theo quota.

Ưu điểm:

- Dễ implement.
- Deterministic.
- Dễ debug.
- Giải quyết trực tiếp lỗi dồn Item.
- Performance tốt.

Nhược điểm:

- Distribution có thể hơi grid-like.
- Region boundary có thể ảnh hưởng placement.

Recommended làm trước.

### Option B — Pure Farthest Point Distribution

Không dùng Region quota mạnh.

Mỗi Cluster mới:

→ chọn Candidate xa các Cluster hiện tại nhất.

Ưu điểm:

- Trải tự nhiên.
- Không phụ thuộc chia Map.

Nhược điểm:

- Có thể bỏ qua capacity.
- Có thể tập trung trên một Branch dài.
- Difficulty integration khó hơn.

Không nên dùng độc lập.

---

## 46. Recommended Production Solution

Dùng Hybrid:

```text
Straight Runs
+
Region Capacity
+
Branch Capacity
+
Coverage First
+
Farthest Candidate
+
Local Density Penalty
```

Flow:

```text
Coverage First
↓
Underfilled Region
↓
Underfilled Branch
↓
Select candidate far from existing clusters
↓
Check Difficulty
↓
Commit
```

Đây là hướng triển khai chính.

---

## 47. Final Algorithm

```text
START AUTO LAYER
↓
Get Valid Item Cells
↓
Build / Read Cached Straight Runs
↓
Build Spatial Regions
↓
Build Branch Capacity
↓
Calculate Remaining Color Demand
↓
Split Colors into Cluster Sizes <= 6
↓
Build Interleaved Cluster Queue
↓
FOR EACH CLUSTER
    ↓
    Find Candidate Regions with lowest saturation
    ↓
    Find underfilled Branches
    ↓
    Filter Straight Cluster Candidates
    ↓
    Reject:
        occupied
        invalid
        same-color mega cluster
        difficulty violation
    ↓
    Score remaining Candidates:
        RegionNeed
        BranchNeed
        Distance
        LocalDensity
        Difficulty
    ↓
    Pick best Candidate
    ↓
    Commit whole Cluster
    ↓
    Update:
        occupiedIndexSet
        RegionStats
        BranchStats
        ClusterList
↓
END
↓
Spatial Validation
↓
Gameplay Simulation
↓
PASS?
    YES → Preview
    NO
↓
Local Cluster Repair
↓
Revalidate
↓
Still Fail?
    → Generate new candidate/sub-seed
```

---

## 48. Performance

Gọi:

```text
P = số Path Cell
R = số Straight Run
C = số Cluster Candidate
K = số Cluster cần đặt
```

Build Path/StraightRun:

```text
O(P)
```

Build basic candidates:

```text
O(P × MaxClusterSize)
```

với:

`MaxClusterSize = 6`

nên gần:

`O(P)`

Placement nếu scan toàn bộ Candidate:

```text
O(K × C)
```

Có thể tối ưu bằng:

```text
candidatesByRegion
candidatesBySize
candidatesByBranch
```

để chỉ score subset cần thiết.

Occupancy check mỗi cluster:

```text
O(clusterSize)
```

với max 6 nên coi gần `O(1)`.

Không cần Quadtree với Map hiện tại.

Region + Set/Map lookup đủ nhanh và đơn giản hơn.

---

## 49. Implementation Priority

### Phase 1 — Fix Core Cluster Direction

Implement:

- StraightRun detection
- Horizontal/Vertical cluster
- Stop cluster tại corner
- Max Cluster = 6

Mục tiêu:

Item cluster nhìn đúng chiều Path.

### Phase 2 — Fix Spatial Concentration

Implement:

- Spatial Region
- Region Capacity
- Region Saturation
- Coverage First

Mục tiêu:

không còn dồn gần hết Item vào một vùng.

### Phase 3 — Branch Balance

Implement:

- Branch ID
- Branch Capacity
- Branch Saturation

Mục tiêu:

không dồn Item vào một branch dài.

### Phase 4 — Distance & Density

Implement:

- Cluster distance
- Local density penalty
- Farthest candidate preference

Mục tiêu:

distribution tự nhiên hơn.

### Phase 5 — Local Repair

Implement:

- detect overfilled region
- move cluster
- split cluster
- rebalance

Mục tiêu:

giảm regenerate toàn Layer.

### Phase 6 — Difficulty Integration

Integrate candidate score với:

- Tail Curve
- Release Pressure
- Active Tray Demand
- Noise Budget
- Locked Layer Anchor

Mục tiêu:

Spatial Balance không phá solvability/difficulty.

---

## 50. Test Cases bắt buộc

### TC01 — Horizontal Path

Input:

```text
────────────
```

Expected:

Item cluster chỉ:

```text
■■■■
```

theo chiều ngang.

### TC02 — Vertical Path

Expected:

```text
■
■
■
■
```

### TC03 — Corner

Input:

```text
────┐
    │
```

Expected:

Không có một Cluster đi qua corner.

### TC04 — Long Path

Một StraightRun rất dài.

Expected:

Không đặt toàn bộ Cluster của Layer trên Run này nếu các Region/Branch khác còn capacity.

### TC05 — Map nhiều vùng

Expected:

Cluster được trải trên nhiều Region khả dụng.

### TC06 — Unequal Region Capacity

Region A có 30 Cell.
Region B có 5 Cell.

Expected:

A có thể có nhiều Item hơn B nhưng B vẫn được sử dụng nếu có candidate hợp lệ.

### TC07 — Same Color Cluster

Hai cluster cùng màu cạnh nhau.

Expected:

Không tạo chuỗi > 6.

### TC08 — Locked Layer

Layer Locked có Item dồn tại một vùng.

Expected:

Generator không sửa Layer đó.

Layer Auto sau phải cân distribution/difficulty dựa trên Locked Anchor.

### TC09 — Difficulty Conflict

Candidate rất tốt về Distribution nhưng gây Tail Pressure vượt limit.

Expected:

Reject Candidate.

Gameplay Safety ưu tiên Distribution.

### TC10 — Deterministic Seed

Cùng:

- Level Data
- Lock State
- Difficulty
- Seed

Expected:

Generate cùng kết quả.

---

## 51. Definition of Done

- Item cùng cluster luôn nằm thẳng Horizontal hoặc Vertical.
- Cluster không bao giờ bẻ góc.
- Max Cluster Size vẫn = 6.
- StraightRun được detect chính xác.
- Cluster Candidate chỉ dùng valid Path Cell.
- Generator không còn chọn một seed rồi fill gần hết Layer quanh seed.
- Map được chia thành Spatial Region runtime.
- Distribution tính theo usable capacity chứ không chia đều cứng.
- Coverage First hoạt động.
- Region underfilled được ưu tiên.
- Branch underfilled được ưu tiên.
- Cluster mới ưu tiên cách xa Cluster hiện tại.
- Có Local Density Penalty.
- Không tạo mega-cluster cùng màu > 6.
- Item được trải gần đều trên toàn Map trong giới hạn topology.
- Không dồn gần toàn bộ Item vào giữa/góc trên/góc dưới Map.
- Không dồn gần toàn bộ Item vào một Branch nếu Branch khác còn capacity.
- Locked Layer không bị thay đổi.
- Tail/Release Pressure vẫn được validate.
- Spatial Repair thực hiện theo Cluster, không từng Item.
- Có giới hạn Repair để tránh infinite loop.
- Generator deterministic theo Seed.
- Không thay đổi JSON Level.
- Performance phù hợp browser tool.

---

## Change History

- 2026-08-20: Implemented runtime straight-run cluster placement, region/branch weighted distribution, distance/local-density scoring, same-color max cluster guard, bounded cluster split repair, and preserved existing item layer JSON output.

