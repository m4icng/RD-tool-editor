# Railway Dash Auto Generator — Multi-Layer Noise Window Update

## 1. Mục tiêu

Update logic Noise hiện tại.

Logic cũ:

```text
Current Tray Layer N
↓
Noise chỉ lấy từ Tray Layer N+1
```

Logic mới:

```text
Current Tray Layer N
↓
Noise có thể lấy từ nhiều Future Tray Layer
↓
N+1
N+2
N+3
...
```

Ví dụ:

```text
Current Tray Layer 1

Noise Source:
Layer 2 = 70%
Layer 3 = 30%
```

hoặc:

```text
Layer 2 = 50%
Layer 3 = 30%
Layer 4 = 20%
```

Mục tiêu:

- Tạo carry-over phong phú hơn.
- Không làm Noise quá predictable.
- Cho phép Medium/Hard Level xuất hiện màu của Tray xa hơn.
- Điều chỉnh độ khó theo khoảng cách Future Layer.
- Không phá tổng Item Balance.
- Không lấy màu từ Layer đã hoàn thành.
- Không lấy quá số demand thực tế của Future Tray Layer.

---

## 2. Noise Distance

Định nghĩa:

```text
NoiseDistance
=
FutureTrayLayerIndex - CurrentTrayLayerIndex
```

Ví dụ:

```text
Current = Layer 1

Layer 2 → Distance 1
Layer 3 → Distance 2
Layer 4 → Distance 3
```

Distance càng lớn:

- Item càng lâu mới được sử dụng.
- Carry-over càng lâu.
- Tail Pressure càng cao.

Do đó Noise Distance phải được coi là một thành phần Difficulty.

---

## 3. Noise Window

Thay logic:

```text
NextLayerOnly
```

bằng:

```text
NoiseWindow
```

Concept:

```text
noiseMinDistance
noiseMaxDistance
```

Ví dụ:

```text
Min = 1
Max = 2
```

Current Layer 1 có thể lấy:

```text
Layer 2
Layer 3
```

Không lấy:

```text
Layer 4+
```

---

## 4. Noise Weight theo Distance

Không chia đều mặc định.

Runtime concept:

```text
NoiseDistanceWeights

Distance 1 → 0.60
Distance 2 → 0.30
Distance 3 → 0.10
```

Khi cần sinh:

```text
10 Noise Item
```

Target:

```text
Distance 1 ≈ 6
Distance 2 ≈ 3
Distance 3 ≈ 1
```

Sau đó clamp theo demand thực tế.

---

## 5. UI Setting

Trong Generate → Advanced Noise:

```text
NOISE

Noise
[ Auto ▼ ]

Future Layer Range

Min Distance
[ 1 ]

Max Distance
[ 3 ]

Distribution

Layer +1    [ 60% ]
Layer +2    [ 30% ]
Layer +3    [ 10% ]
```

Hoặc UI dễ hiểu hơn:

```text
Noise từ các Layer phía sau

[x] Layer tiếp theo       60%
[x] Cách 2 Layer          30%
[x] Cách 3 Layer          10%
```

---

## 6. Preset nhanh

Có thể có:

```text
Noise Depth
[ Near ▼ ]
```

Preset:

### Near

```text
+1 = 100%
```

### Medium

```text
+1 = 70%
+2 = 30%
```

### Deep

```text
+1 = 55%
+2 = 30%
+3 = 15%
```

Các số này chỉ là preset UI.

Nếu Generator đang dùng Auto Adaptive thì hệ thống tự derive.

---

## 7. Auto Mode

Mặc định nên để:

```text
Noise Depth = Auto
```

Generator tự tính:

```text
NoiseMaxDistance
NoiseDistanceWeights
```

dựa trên:

- Difficulty.
- Tổng Tray Layer.
- Số Item Layer.
- Safe Tail Capacity.
- Release Frequency.
- Remaining Demand.
- Current Tail Pressure.
- Tray Complexity.

Designer vẫn có Advanced Override khi cần debug.

---

## 8. Difficulty Relation

Distance càng xa càng nguy hiểm.

Có thể coi:

```text
NoiseRisk
≈
NoiseAmount × NoiseDistance
```

Ví dụ:

```text
6 Item từ Layer +1
```

risk thấp hơn:

```text
6 Item từ Layer +3
```

vì +3 phải nằm trên Train lâu hơn trước khi Tray yêu cầu.

---

## 9. Future Demand Reservation

Noise không được tự tạo thêm Item.

Noise chỉ là:

```text
đưa một phần Future Demand xuất hiện sớm hơn
```

Ví dụ:

```text
Tray Layer 3 cần Green ×9
```

Current Layer lấy:

```text
Green ×3
```

làm Noise.

Sau đó Remaining Demand của Layer 3 chỉ còn:

```text
Green ×6
```

Không được sau này vẫn Generate Green ×9.

---

## 10. Future Demand Pool

Trước khi sinh:

Build:

```text
FutureDemandPool
```

Ví dụ:

```text
Current = Tray Layer 1

Distance 1:
Blue = 9

Distance 2:
Green = 9

Distance 3:
Purple = 9
```

Noise allocator lấy Item từ Pool này.

Sau mỗi allocation:

```text
remainingFutureDemand[color/layer]--
```

---

## 11. Track Noise Source theo Tray Layer

Không chỉ track:

```text
itemId
```

Nên track runtime:

```text
NoiseAllocation
- itemId
- sourceTrayId
- sourceTrayLayer
- distance
- count
```

Không cần export JSON.

Mục đích:

- tránh lấy quá demand.
- debug.
- Auto Tune.
- trả Item lại đúng demand pool khi Repair.

---

## 12. Multiple Tray

Với nhiều Tray hoạt động song song:

Không dùng một global Tray Layer index đơn giản.

Noise phải được tính theo progression của từng Tray.

Ví dụ:

```text
Tray A
Current Layer = 2

Tray B
Current Layer = 1
```

Future pool:

```text
Tray A:
A3
A4

Tray B:
B2
B3
```

Sau đó merge thành:

```text
EligibleFutureNoisePool
```

nhưng vẫn giữ source metadata.

---

## 13. Noise Distance với Multiple Tray

Distance tính riêng trong từng Tray:

```text
distance =
sourceLayerIndex - currentLayerIndex
```

Không tính global absolute layer vì các Tray có thể progress khác nhau.

---

## 14. Không lấy Noise từ Completed Demand

Nếu Future Tray demand đã được đáp ứng hoàn toàn bởi:

- Item đang carry.
- Item Locked Layer.
- Item đã được allocate ở Layer khác.

thì:

```text
AvailableNoiseDemand = 0
```

Không tiếp tục lấy màu đó.

---

## 15. Max Future Layer Preload

Ngoài global Noise Ratio, cần:

```text
MaxFutureLayerPreload
```

Concept:

```text
Tray Layer +2 cần 9 Item

Generator không nên đưa cả 9
lên quá sớm nếu Difficulty không yêu cầu.
```

Có thể derive:

```text
PreloadRatio(distance)
```

Distance càng xa:

→ maximum preload càng thấp.

---

## 16. Noise Distribution chỉ là Target

Percentage chỉ là target.

Actual allocation phải clamp theo:

```text
Available Future Demand
Safe Tail Budget
Layer Capacity
Straight Cluster Capacity
```

Ví dụ target:

```text
+1 = 70%
+2 = 30%
```

Need:

```text
10 Noise
```

Nhưng Layer +1 chỉ còn 4 Item demand.

Actual có thể:

```text
+1 = 4
+2 = 6
```

nếu +2 còn capacity và Safety cho phép.

---

## 17. Renormalize Weight

Nếu một Distance không còn demand:

```text
+1 Weight = 60%
+2 Weight = 30%
+3 Weight = 10%
```

nhưng +2 không còn Future Demand.

Normalize trên các nguồn còn hợp lệ:

```text
+1 ≈ 86%
+3 ≈ 14%
```

Không làm mất Noise Budget chỉ vì một source hết demand.

---

## 18. Dynamic Noise Window

Noise Max Distance không nên cố định.

Ví dụ Level chỉ còn:

```text
2 Future Tray Layers
```

dù Setting:

```text
Max Distance = 3
```

thì actual:

```text
Effective Max Distance = 2
```

Không báo lỗi.

---

## 19. Noise theo Item Layer

Noise Window phải tính riêng cho từng Item Layer.

Ví dụ:

```text
Item Layer 0

Current Tray Demand:
Tray Layer 1

Noise:
Layer 2-3
```

Sau gameplay progression:

```text
Item Layer 1

Current Tray:
Layer 3

Noise:
Layer 4-5
```

Không reuse một Future Pool cố định từ đầu Level.

---

## 20. Locked Layer

Locked Item Layer có thể đã chứa Deep Noise.

Generator phải Analyze trước.

Ví dụ Locked Layer đã có:

```text
Green từ Tray +2 = 5
```

Auto Layer không được tiếp tục tạo thêm Deep Noise như thể Green = 0.

Locked Items phải tính vào:

```text
ExistingFuturePreload
```

---

## 21. Total Noise Budget

Total Noise Budget của Item Layer vẫn phải tồn tại.

Ví dụ:

```text
LayerItemCount = 30
NoiseBudget = 9
```

Multi-layer logic chỉ quyết định:

```text
9 Noise này lấy từ Future Layer nào
```

Không phải mỗi Future Layer đều được thêm 9 Noise.

---

## 22. Hai tầng phân bổ

Noise Generator nên có 2 bước:

```text
STEP 1
Calculate Total Noise Count

STEP 2
Distribute Total Noise Count
across Future Distances
```

Không để từng distance tự sinh Noise độc lập.

---

## 23. Algorithm

```text
Current Gameplay / Tray State
↓
Find Future Tray Demand
↓
Filter by Noise Distance Range
↓
Subtract:
- Existing Map Allocation
- Locked Preload
- Carry Inventory
↓
Build Eligible Future Demand Pool
↓
Calculate Total Noise Budget
↓
Calculate Distance Weights
↓
Allocate Noise Count by Distance
↓
Clamp by Future Demand
↓
Renormalize unused quota
↓
Select Colors
↓
Generate Clusters
↓
Gameplay Simulation
↓
Auto Tune
```

---

## 24. Noise Color Selection

Trong cùng Distance có thể có nhiều màu.

Ví dụ:

```text
Distance +2:

Tray A = Green
Tray B = Purple
```

Generator nên phân tiếp theo:

```text
remaining demand
+
tray priority
+
existing carry
+
spatial availability
```

Không random hoàn toàn.

---

## 25. Avoid Duplicate Pressure

Nếu Train đang carry nhiều Green và Green là:

```text
Distance +3 Noise
```

Generator nên giảm score cho Green +3.

Ưu tiên Future Color khác nếu có.

Điều này tránh Deep Noise cùng màu tích tụ quá lâu.

---

## 26. Integration với Straight Cluster Generator

Sau khi Noise Allocator quyết định:

```text
Blue +1 = 4
Green +2 = 3
Purple +3 = 2
```

thì mới chuyển sang:

```text
StraightClusterGenerator
```

Input:

```text
itemId
count
noiseDistance
priority
```

Cluster generator không cần biết logic Tray phức tạp.

---

## 27. Cluster Size của Deep Noise

Deep Noise nên hạn chế tạo spike quá lớn.

Ví dụ:

```text
Distance +1
→ có thể cluster 4-6

Distance +3
→ thường cluster nhỏ hơn
```

nếu Difficulty/Safe Tail yêu cầu.

Đây là Soft Rule, không phải Hard Rule.

---

## 28. Tail Simulation bắt buộc

Deep Noise phải được kiểm tra bằng actual gameplay simulation.

Không chỉ dựa vào:

```text
Noise Ratio
```

Simulation phải đo:

```text
Time Carried
Peak Tail
Average Tail
Release Pressure
```

Distance chỉ là heuristic.

Simulation là final authority.

---

## 29. Auto Tune khi Pressure cao

Nếu:

```text
RELEASE_PRESSURE_EXCEEDED
```

Auto Tuner nên giảm Noise theo thứ tự:

```text
Deepest Noise first
```

Ví dụ:

```text
+3
↓
+2
↓
+1
```

Actions:

```text
Move +3 Noise về Item Layer sau
↓
Reduce +3 ratio
↓
Redistribute sang +2/+1
↓
Re-simulate
```

---

## 30. Auto Tune khi Level quá dễ

Nếu Tail Pressure quá thấp:

Generator có thể:

```text
Increase NoiseMaxDistance
```

Ví dụ:

```text
Current:
+1 only
```

thành:

```text
+1 +2
```

hoặc tăng weight của Deep Noise.

Chỉ khi vẫn còn Safe Tail Budget.

---

## 31. Difficulty Adaptive Profile

### Easy

```text
Noise Window:
mostly +1

Deep Noise:
rất thấp hoặc không có
```

### Normal

```text
+1
+
một phần +2
```

### Medium Hard

```text
+1
+2
+ có thể +3
```

### Hard

Có thể tăng Deep Noise nhưng vẫn phụ thuộc topology và Safe Tail.

Không hardcode các percentage này làm gameplay constants.

---

## 32. Designer Override

Advanced Setting:

```text
Noise Layer Distance

[ Auto ]

hoặc:

Custom

Min: [1]
Max: [3]

+1 [50%]
+2 [30%]
+3 [20%]
```

Designer có thể Lock setting này.

Nếu Auto:

Generator tự tune.

Nếu Custom:

Generator cố giữ intent nhưng vẫn clamp khi vi phạm Hard Safety.

---

## 33. Optional Noise Matrix

Có thể mở rộng sau này:

```text
                Future Tray
Item Layer      +1    +2    +3

Layer 0         60%   30%   10%
Layer 1         50%   35%   15%
Layer 2         70%   30%    0%
```

Không cần làm ngay v1.

V1 chỉ cần một profile chung + Auto per-layer adjustment.

---

## 34. Recommended V1

Implement:

```text
NoiseMinDistance
NoiseMaxDistance
NoiseDistanceWeights[]
```

Runtime:

```text
noiseProfile = {
    minDistance,
    maxDistance,
    weightsByDistance
}
```

Không export JSON Level.

---

## 35. Recommended V2

Thêm:

```text
PerItemLayerNoiseProfile
PerTrayNoiseProfile
MaxPreloadPerFutureLayer
```

chỉ khi Designer thực sự cần control sâu.

---

## 36. Debug Report

Generate Tab nên cho xem:

```text
NOISE REPORT

Item Layer 0

Total Items: 30
Noise: 9

Sources:

Tray +1
5 Item
56%

Tray +2
3 Item
33%

Tray +3
1 Item
11%

Weighted Noise Depth:
1.55

Peak Tail:
7
```

---

## 37. Noise Source Visualization

Optional Debug:

Click một Noise Item trên Map hiển thị:

```text
Item ID: 3 Blue

Type:
Noise

Source:
Tray 0 / Layer 3

Current Tray Layer:
1

Noise Distance:
+2
```

Runtime/debug only.

Không export.

---

## 38. Error Codes

### NOISE_FUTURE_DEMAND_EMPTY

Không còn Future Demand hợp lệ.

→ Noise Count tự giảm.

Không phải hard fail.

### NOISE_DISTANCE_UNAVAILABLE

Setting yêu cầu +3 nhưng chỉ còn +1/+2.

→ clamp range.

Không hard fail.

### NOISE_PRELOAD_EXCEEDED

Future Tray Layer bị preload quá nhiều.

→ giảm allocation.

### DEEP_NOISE_PRESSURE_EXCEEDED

Deep Noise gây Tail Pressure cao.

→ reduce deepest distance first.

---

## 39. Performance

Gọi:

```text
T = tổng Tray Layer
C = số màu
D = Noise Distance Range
```

Build Future Demand:

```text
O(T)
```

Allocate theo distance:

```text
O(D + C)
```

D thực tế rất nhỏ.

Simulation vẫn là phần đắt nhất:

```text
O(S)
```

với S = gameplay steps.

---

## 40. Final Flow

```text
Analyze Current Tray Progress
↓
Determine Future Tray Layers
↓
Determine Effective Noise Distance Range
↓
Build Future Demand Pool
↓
Subtract Existing Preload
↓
Calculate Layer Noise Budget
↓
Calculate Distance Weights
↓
Allocate Noise:
+1
+2
+3
...
↓
Allocate Colors inside each Distance
↓
Generate Straight Clusters
↓
Spatial Distribution
↓
Gameplay Simulation
↓
Pressure OK?
    YES → Accept
    NO
↓
Reduce Deep Noise first
↓
Reallocate
↓
Simulate again
```

---

## 41. Definition of Done

- Noise không còn bị giới hạn ở Tray Layer kế tiếp.
- Có thể lấy Noise từ nhiều Future Tray Layer.
- Có `Noise Min Distance`.
- Có `Noise Max Distance`.
- Có tỷ lệ Noise riêng theo từng Distance.
- Current Layer 1 có thể lấy Noise từ Layer 2 và 3.
- Total Noise Budget không bị nhân lên theo số Future Layer.
- Noise chỉ lấy từ Future Demand thật.
- Không generate dư Item.
- Existing Locked Item được tính vào Future Preload.
- Multiple Tray được hỗ trợ.
- Noise Distance tính riêng theo progression từng Tray.
- Weight được renormalize nếu một Future Layer không còn demand.
- Deep Noise có Difficulty Weight cao hơn.
- Deep Noise được giảm trước khi Tail Pressure vượt giới hạn.
- Auto Mode tự tính Noise Window theo Level.
- Designer có Custom Override.
- Straight Cluster Generator nhận output từ Noise Allocator.
- Gameplay Simulation là final validation.
- Không thay đổi Level JSON schema.

---

## Change History

### 2026-08-21

- Added V1 runtime Noise Window using `noiseMinDistance`, `noiseMaxDistance`, and per-distance weights.
- Added `noise-allocator.js` to distribute one total Noise budget across future Tray Layer distances without multiplying budget.
- Added Auto/Near/Medium/Deep/Custom Noise Depth handling in Generate settings.
- Added runtime/debug metadata for Noise source tray, source layer, and distance.
- Added Generate tab Noise Report summary.
- Kept Level JSON export schema unchanged.
