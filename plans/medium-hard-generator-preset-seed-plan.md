# Railway Dash Auto Level Generator — Medium Hard Core Algorithm

## 1. Mục tiêu

Dựa trên JSON level Medium Hard mẫu, Generator không sinh Path hoặc Tray từ đầu mà sử dụng:

- `Path`
- `PriorityPoint`
- `Spawn`
- `Tray`
- `DeliverPoint`
- `Bridge`
- Các Element đã được designer setup

làm input cố định.

Generator tập trung sinh và phân phối:

- `itemLayers`
- màu Block
- số lượng Block theo từng Layer
- cluster Block
- vị trí Block trên các nhánh Path
- áp lực chiều dài Train / Release Pressure

Mục tiêu là tạo level có đặc tính tương tự level mẫu:

- nhiều nhánh lựa chọn
- có Block cần thiết xen Block nhiễu
- Train phải tích Block trước khi có cơ hội xả
- độ dài đuôi tăng nhưng vẫn giải được
- Item cùng màu thường đi thành cụm
- càng về Layer sau mật độ Item càng tăng

---

# 2. Core Data rút ra từ Level mẫu

## Map

Map:

`13 x 24 = 312 Cell`

Trong đó:

- Path: `125 Cell`
- PriorityPoint: `9`
- Bridge: `2`
- Spawn: `1`
- Tray: `2`
- Item Layer: `4`

Spawn nằm tại:

`PriorityPoint index 175`

Bridge nằm tại:

- 97
- 214

Hai Bridge đều nằm tại ngã 4 nhưng không được tính như PriorityPoint gameplay.

---

# 3. Item Layer Structure

Level mẫu có 4 Item Layer:

| Layer | Tổng Item |
|---|---:|
| 0 | 29 |
| 1 | 30 |
| 2 | 31 |
| 3 | 36 |

Tổng:

`126 Block`

Đây là một đặc điểm nên giữ cho preset Medium Hard:

`Layer sau có xu hướng nhiều Item hơn Layer trước`

Không cần tăng đều tuyệt đối nhưng density cuối level nên cao hơn đầu level.

Recommended distribution theo tổng số Item:

- Layer 0: ~23%
- Layer 1: ~24%
- Layer 2: ~25%
- Layer 3: ~28%

Ví dụ nếu Total Item = 126:

`29 → 30 → 31 → 36`

---

# 4. Tray Demand

Level có 2 Tray.

Tray 0:

`8 Layer x 9 Block = 72`

Tray 1:

`6 Layer x 9 Block = 54`

Tổng Tray Demand:

`72 + 54 = 126`

Khớp chính xác với tổng Item trên Map:

`Total Map Item = Total Tray Requirement = 126`

Đây phải là Hard Constraint của Generator.

---

# 5. Color Balance

Level mẫu chỉ sử dụng 4 màu:

| Item ID | Map | Tray Need |
|---|---:|---:|
| 1 | 36 | 36 |
| 3 | 27 | 27 |
| 5 | 18 | 18 |
| 6 | 45 | 45 |

Rule bắt buộc:

`TotalMapCount[itemId] == TotalTrayNeed[itemId]`

Không cho:

`Map > Tray`

và cũng không cho:

`Map < Tray`

Nếu lệch:

→ Generator phải Repair trước khi trả level.

---

# 6. Map Layer KHÔNG tương ứng 1:1 với Tray Layer

Đây là core quan trọng.

Level có:

`4 Item Layer`

nhưng có:

`14 Tray Layer`

Do đó:

`Item Layer != Tray Layer`

Item Layer là các Wave Block xuất hiện trên Map.

Tray Layer là thứ tự requirement của từng Tray.

Generator không được tạo:

`1 Map Layer = 1 Tray Layer`

Thay vào đó mỗi Map Layer phải cung cấp:

- Block cho Tray hiện tại
- Block cho Tray sắp tới
- một lượng Block nhiễu/carry-over

để tạo áp lực chiều dài Train.

---

# 7. First Layer Core

Ở Layer 0 của level mẫu:

- Red = 18
- Blue = 3
- Purple = 2
- Green = 6

Tổng:

`29`

Hai Tray đầu tiên đều cần:

`Red x9`

Tổng nhu cầu tức thời:

`Red x18`

Và Layer 0 có chính xác:

`Red x18`

Điều này cho thấy rule tốt cho đầu level:

`Initial Active Tray Demand phải được đảm bảo trong Layer đầu.`

Sau đó thêm Noise để tạo pressure.

Trong sample:

Required:

`18 / 29 ≈ 62%`

Noise:

`11 / 29 ≈ 38%`

Recommended Medium Hard:

`Required Ratio = 60% ~ 75%`

`Noise Ratio = 25% ~ 40%`

Không nên để Layer đầu chứa quá nhiều Noise khiến player chưa thể xả.

---

# 8. Item Placement Candidate

Trước khi đặt Item, tạo:

`CandidateItemCells`

từ Path.

Loại bỏ:

- Spawn
- PriorityPoint
- DeliveryPoint
- Gate
- Tunnel
- OneWay Point nếu rule không cho phép
- Count Barrier footprint nếu bị block
- Bridge footprint
- Cell đã chứa Element không cho Item

Bridge hiện tại có visual:

`3x1 Horizontal`

Nếu Bridge center tại:

`x`

thì cấm Item tại:

`x - 1`
`x`
`x + 1`

Không chỉ cấm center index.

---

# 9. Path Graph Preprocess

Convert Path thành Graph:

`Node = Path Index`

`Edge = 4-direction connection`

Mỗi Path Cell lưu:

- index
- neighbors
- degree
- branchId
- distanceFromSpawn
- distanceToPriorityPoint
- distanceToDeliveryPoint
- blockedForItem

Sau đó phân loại:

- Straight
- Corner
- Junction
- PriorityPoint
- Bridge
- Delivery area
- Branch segment

Preprocess:

`O(PathCount)`

---

# 10. Segment Path thành Branch

Dùng PriorityPoint / Junction / DeliveryPoint làm các mốc chia Path thành segment.

Ví dụ:

`Priority A → Segment → Priority B`

Mỗi segment lưu:

- danh sách index
- length
- item capacity
- element occupancy
- connected segments

Generator phân phối Item theo Segment thay vì random toàn Map.

Mục tiêu:

- tránh dồn toàn bộ Item vào một góc
- đảm bảo các nhánh đều có giá trị gameplay
- dễ kiểm soát pressure theo route

---

# 11. Build Tray Demand Queue

Từ Tray Data tạo Demand Queue.

Ví dụ:

Tray 0:

`1 → 6 → 6 → 5 → 3 → 3 → 1 → 1`

Tray 1:

`1 → 5 → 6 → 6 → 6 → 3`

Mỗi entry có:

- trayId
- trayLayer
- itemId
- count
- activeOrder

Generator không thay đổi màu Tray nếu màu đã được designer setup.

Tray Demand là source-of-truth để tạo Item Pool.

---

# 12. Build Global Item Pool

Từ Tray Requirement tạo chính xác số Block cần thiết.

Sample:

`ID1 = 36`

`ID3 = 27`

`ID5 = 18`

`ID6 = 45`

Sau bước này:

`ItemPool.Count = 126`

Không random thêm hoặc bớt Item.

---

# 13. Partition Item Pool thành Item Layers

Chia Global Item Pool thành các Map Layer.

Medium Hard preset:

`4 Layer`

Target ratio:

`23% / 24% / 25% / 28%`

Không chia màu ngẫu nhiên hoàn toàn.

Mỗi Layer phải được tính theo:

1. Active Tray Demand
2. Next Tray Demand
3. Carry-over từ Layer trước
4. Noise budget
5. Release Pressure

---

# 14. Item Cluster Core

Level mẫu có đặc tính cluster rất rõ.

Tỷ lệ Item nằm trong cluster có ít nhất 2 Block:

- Layer 0: ~86%
- Layer 1: ~83%
- Layer 2: ~87%
- Layer 3: ~92%

Cluster lớn nhất:

`6 Block`

Do đó Medium Hard preset nên dùng:

`Cluster Adjacency Target = 80% ~ 90%`

`Max Cluster Size = 6`

Recommended cluster size:

- 2 Block
- 3 Block
- 4 Block
- 5 Block
- 6 Block

Ưu tiên:

`3 ~ 6`

Chỉ giữ khoảng:

`10% ~ 20%`

Item dạng singleton/noise lẻ.

---

# 15. Cluster Placement Rule

Khi tạo cluster:

1. Chọn candidate index.
2. Expand theo Path connection.
3. Chỉ dùng các Cell liên tiếp trên cùng route/branch hợp lệ.
4. Dừng khi đạt cluster target hoặc hết candidate.
5. Không vượt quá 6.

Pseudo Flow:

`Pick Seed`

→ `Grow along Path`

→ `2-6 same-color Block`

→ `Commit Cluster`

Không grow qua:

- PriorityPoint
- Bridge
- DeliveryPoint
- blocked element

nếu rule placement không cho phép.

---

# 16. Branch Distribution

Không để toàn bộ một màu nằm trên một branch.

Ví dụ Color có 18 Block:

Không:

`18 Block → Branch A`

Nên:

`6 → Branch A`

`6 → Branch B`

`4 → Branch C`

`2 → Branch D`

Tuy nhiên vẫn giữ cluster max 6.

Recommended:

Mỗi màu lớn nên xuất hiện tại ít nhất:

`2-3 vùng/branch`

nếu Map có đủ không gian.

---

# 17. Release Pressure là Core Difficulty chính

Release Pressure chỉ tính:

`Block đã collect nhưng chưa xả được vào Tray`

Không tính:

- Item chưa collect
- Item Layer chưa spawn
- Requirement còn thiếu
- Item đã fill Tray

Runtime simulation:

`Pressure = Collected - Released`

Theo dõi:

`PeakPressure`

và:

`AveragePressure`

---

# 18. Medium Hard Pressure Target

Không nên chỉ có Hard Limit.

Sử dụng:

`Target Average Pressure`

và:

`Peak Pressure Limit`

Ví dụ preset Medium Hard:

Average:

`4 ~ 6 Block`

Peak:

`<= 7`

Có thể cho phép spike ngắn sát limit nhưng không để pressure cao liên tục.

Mục tiêu là Train có cảm giác dài và nguy hiểm nhưng vẫn có cơ hội xả đều.

---

# 19. Release Window

Chia solution route thành các khoảng:

`Release Window`

Một Release Window là đoạn giữa hai cơ hội xả tại Tray.

Ví dụ:

`Release Opportunity A`
→ collect
→ collect
→ collect
→ Priority
→ collect
→ Delivery
→ `Release Opportunity B`

Mỗi Window có:

`Pressure Budget`

Medium Hard:

`Target ~ 5`

`Maximum = 7`

Generator không được đặt Item khiến player bắt buộc vượt budget.

---

# 20. Required vs Noise Block

Trong mỗi Window chia Block thành:

### Required

Block có thể được Tray active nhận trong tương lai gần.

### Near-future

Block của Tray Layer kế tiếp.

### Noise

Block chưa thể xả trong thời gian gần.

Priority placement:

`Required > Near-future > Noise`

Medium Hard vẫn cần Noise để tạo đuôi dài.

Nhưng Noise phải có Budget.

---

# 21. Noise Budget

Recommended Medium Hard:

`Noise Ratio = 30% ~ 40%`

Nhưng Noise phải phân tán.

Không được:

`6 Noise`
→ `6 Noise`
→ `6 Noise`
→ mới có Required

Nên:

`Required Cluster`
→ `Noise Cluster`
→ `Required`
→ `Noise`

để pressure có dạng lên-xuống thay vì chỉ tăng liên tục.

---

# 22. Sawtooth Tail Pressure

Độ khó Train nên có dạng:

`Tăng → Xả → Tăng mạnh hơn → Xả`

Không:

`Tăng → Tăng → Tăng → Tăng`

Target pressure curve:

```text
Pressure

7          /\        /\
6         /  \      /  \
5        /    \    /    \
4   /\  /      \  /
3  /  \/
2
1
0
```

---

## Change History

- 2026-08-20: Lưu plan riêng vào `plans/medium-hard-generator-preset-seed-plan.md`.
- 2026-08-20: Đồng bộ preset độ khó quanh mốc Medium Hard: cluster 80-90%, cụm tối đa 6, áp lực trung bình 4-6 và peak 7.
- 2026-08-20: Ẩn trường mã seed trong UI Generate; `generatePreview` luôn tự sinh seed ngẫu nhiên mới khi tạo preview/apply.
- 2026-08-20: Sửa preset `Khó` để tránh lỗi mặc định `TAIL_PRESSURE_EXCEEDED`/`RELEASE_PRESSURE_EXCEEDED`; engine tự retry seed ngẫu nhiên theo `maxRetries` trước khi báo lỗi.
