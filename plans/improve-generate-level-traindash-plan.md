# Plan Improve Generate Level — Train Dash

## 1. Mục tiêu

Cải tiến Auto Generator để độ khó được tạo ra từ hai áp lực cốt lõi:

- **Áp lực chiều dài đuôi:** tàu ăn càng nhiều item thì đuôi càng dài, nguy cơ tự va chạm càng cao.
- **Áp lực giải phóng đuôi:** đuôi chỉ ngắn lại khi tàu tới đúng khay chứa và xả được item đúng màu.

Generator phải tạo level có thể chơi được, kiểm soát được độ khó và luôn bảo đảm đủ item theo yêu cầu tray.

## 2. Rule bất biến về số lượng item

- `TotalGeneratedItems` phải bằng chính xác `TotalTrayRequiredItems`.
- `TotalTrayRequiredItems` là tổng `amount` của tất cả item trong toàn bộ tray và layer.
- Không được sinh thiếu item.
- Không được sinh thừa item.
- Không được tự giảm `amount` trong tray để ép generate thành công.
- Không được tự thêm itemId hoặc màu không tồn tại trong tray/source data.
- Với mỗi `layerIndex`:
  - `GeneratedItems[layerIndex]` phải bằng tổng item yêu cầu của tray thuộc layer đó.
  - Item chỉ được đặt trên path cùng `layerIndex`.
- Với mỗi `itemId` trong từng layer:
  - Số item sinh ra phải bằng tổng `amount` yêu cầu của itemId đó trong các tray thuộc layer.
- Nếu không đủ slot hợp lệ, generate thất bại và không apply dữ liệu.

```text
TotalGeneratedItems == TotalTrayRequiredItems
GeneratedItems(layer, itemId) == TrayRequiredItems(layer, itemId)
```

## 3. Dữ liệu source không được thay đổi

- Path, path layer, branch, start point, priority point, delivery point, element và tray do designer thiết kế là source of truth.
- Generate chỉ quyết định vị trí đặt item trên các slot hợp lệ.
- Không thay đổi vị trí hoặc số lượng tray.
- Không thay đổi số layer, itemId, amount hoặc thứ tự source tray.
- Không thay đổi cấu trúc export JSON hiện tại.
- Generate preview phải chạy trên working copy; chỉ khi Apply thành công mới cập nhật item vào level editor.

## 4. Các yếu tố tạo độ khó

### 4.1. Số lượng và quy mô map

- Tổng số item, số loại item, số layer, số tray và số điểm dừng càng nhiều thì độ khó càng cao.
- Map càng nhỏ so với tổng số item thì mật độ tàu càng cao và nguy cơ va chạm càng lớn.
- Generator cần tính `itemDensity = totalItems / validPathCells` để phân loại mật độ.

### 4.2. Phân bổ item theo layer

- Phân bổ item tương đối đều trên các layer có source item tương ứng.
- Không dồn quá nhiều item vào một layer nếu các layer khác vẫn còn slot hợp lệ.
- Không chuyển item giữa layer để cân bằng giả tạo.
- Nếu màu cần xả nằm ở layer sau còn layer trước chứa nhiều hàng tồn kho, độ dài đuôi phải được tính là áp lực khó.
- Có thể dùng chỉ số `unreleasedInventoryRatio` để đo tỷ lệ item chưa thể xả tại từng thời điểm.

### 4.3. Khả năng giải phóng đuôi

- Ưu tiên/đánh giá khoảng cách từ item tới tray phù hợp.
- Item gần trạm xả tạo nhịp dễ hơn.
- Item ở xa tray hoặc phải đi qua nhiều đoạn ray tạo nhịp khó hơn.
- Tính `releaseDelay` dự kiến từ thời điểm item được ăn tới thời điểm có thể xả.
- Kiểm soát `avgTailLength`, `peakTailLength` và `maxUnreleasedItems` trong toàn bộ solution simulation.

### 4.4. Mật độ priority point

- Nhiều priority point làm tăng số quyết định rẽ/dừng.
- Có thể điều chỉnh độ khó bằng số priority point hoạt động trên route, nhưng không tự thêm hoặc xóa point.
- Đánh giá `decisionPointFrequency` và độ phức tạp route trước khi chấp nhận level.

### 4.5. Chuyển layer và next-layer spawn trap

- Khi layer mới xuất hiện, item mới không được tạo ngay trước mũi tàu nếu vượt ngưỡng an toàn.
- Không đặt dày item layer mới trên đoạn ray duy nhất mà tàu bắt buộc phải đi qua khi đang có đuôi dài.
- Có thể cho phép spawn gần để tạo level khó, nhưng phải kiểm soát `spawnSafetyDistance` và `maxImmediateChainCount`.
- Item layer mới ở nhánh xa, ít xung đột với đoàn tàu tạo nhịp dễ hơn.

### 4.6. Xen kẽ màu trong cùng layer

- Gom cụm theo màu tạo nhịp dễ, dễ xả theo từng loại.
- Xen kẽ nhiều màu trên cùng đoạn ray làm tăng hàng tồn kho và áp lực giải phóng đuôi.
- `clusterRatio` là ưu tiên mềm để kiểm soát mức gom cụm.
- `maxClusterSizePerBranch` là giới hạn cứng, mặc định `6` item/cụm/nhánh.
- Không tạo pattern xen kẽ khiến người chơi bắt buộc ăn một chuỗi không thể né và vượt ngưỡng tail pressure.

### 4.7. Hình dạng đường ray và vị trí item

- Đoạn thẳng hoặc loop lớn tạo không gian quay đầu, dễ hơn.
- Loop ngắn, ngõ cụt và đoạn hẹp làm tăng nguy cơ tàu tự đâm.
- Cụm item quá dày trên một đoạn ray bắt buộc tàu ăn liên tiếp phải được kiểm soát.
- Không đặt item tại giao điểm, vùng cấm, element footprint hoặc vị trí khiến route playable bị phá.

## 5. Difficulty Settings đề xuất

### Tail Pressure

- `avgTailLengthTarget` — Độ dài đuôi trung bình mục tiêu.
- `tailLengthCap` — Giới hạn độ dài đuôi tối đa.
- `tailLengthGrowthCurve` — Kiểu tăng đuôi theo tiến trình.
- `tailLengthVariance` — Mức dao động chiều dài đuôi.

### Release Pressure

- `releaseDelayTarget` — Thời gian/độ dài route mục tiêu trước khi item được xả.
- `unreleasedInventoryTarget` — Tỷ lệ item chưa thể xả mục tiêu.
- `maxUnreleasedItems` — Số item chưa xả tối đa cho phép trong simulation.
- `releaseDistanceWeight` — Mức ảnh hưởng của khoảng cách tới tray phù hợp.

### Layer & Spawn Pressure

- `layerDistributionBalance` — Mức cân bằng phân bổ item giữa các layer có source item.
- `spawnSafetyDistance` — Khoảng cách an toàn khi item layer mới xuất hiện.
- `maxImmediateChainCount` — Số item layer mới liên tiếp tối đa gần mũi tàu.
- `nextLayerTrapPressure` — Mức cho phép tạo bẫy khi chuyển layer.

### Cluster & Route Pressure

- `clusterRatio` — Tỷ lệ ưu tiên gom item cùng màu, mặc định `80%`.
- `maxClusterSizePerBranch` — Số item tối đa trong một cụm trên mỗi nhánh, mặc định `6`.
- `branchDistributionBalance` — Mức cân bằng item giữa các nhánh.
- `routeChoicePressure` — Mức độ yêu cầu người chơi cân nhắc route.
- `narrowPathUsage` — Mức sử dụng đoạn ray hẹp.
- `loopRiskPressure` — Mức sử dụng loop ngắn/ngõ cụt có rủi ro cao.

## 6. Quy trình generate cải tiến

```text
Đọc source path/tray
→ Tính tổng item bắt buộc theo layer và itemId
→ Validate slot hợp lệ
→ Phân bổ đúng quota từng layer/itemId
→ Tạo cluster và phân bổ branch
→ Áp release pressure, tail pressure và spawn safety
→ Chạy playable simulation
→ Tính difficulty metrics
→ Validate số lượng lần cuối
→ Preview
→ Apply nếu đạt tất cả điều kiện
```

## 7. Validation sau generate

Level chỉ được xem là hợp lệ khi:

- Tổng item sinh ra khớp 100% tổng item tray.
- Quota từng layer và itemId khớp source tray.
- Không có item trùng cell/pathIndex.
- Không có item nằm trong vùng cấm.
- Route vẫn playable từ start tới priority/delivery point.
- `peakTailLength` không vượt `tailLengthCap`.
- `maxUnreleasedItems` không vượt ngưỡng setting.
- Không có next-layer spawn trap vượt `spawnSafetyDistance`.
- Không có vòng lặp retry vô hạn.

## 8. Mã lỗi

- `NOT_ENOUGH_VALID_CELLS`: thiếu slot hợp lệ.
- `ITEM_QUOTA_MISMATCH`: số item sinh ra không khớp quota tray.
- `LAYER_QUOTA_MISMATCH`: quota theo layer không khớp source.
- `ITEM_ID_QUOTA_MISMATCH`: quota theo itemId không khớp source.
- `TAIL_PRESSURE_EXCEEDED`: đuôi vượt ngưỡng cho phép.
- `RELEASE_PRESSURE_EXCEEDED`: hàng tồn kho chưa xả vượt ngưỡng.
- `NEXT_LAYER_SPAWN_TRAP`: vị trí spawn layer mới không an toàn.
- `GENERATION_FAILED`: thất bại sau số lần retry tối đa.

## 9. Tiêu chí hoàn thành

- Generator luôn đảm bảo đủ và đúng số lượng item theo tổng tray.
- Không thay đổi source data hoặc export JSON schema.
- Có simulation để đo chiều dài đuôi và khả năng giải phóng đuôi.
- Có thể tạo nhiều mức độ khó từ Easy đến Expert bằng settings.
- Level lỗi không được apply/export.
- Kết quả generate có log metrics để designer kiểm tra và điều chỉnh.

## 10. Change History

- 2026-08-20: Lưu plan riêng vào `plans/improve-generate-level-traindash-plan.md`.
- 2026-08-20: Cập nhật Generate Settings theo nhóm Tail Pressure, Release Pressure, Layer/Spawn và Cluster/Route.
- 2026-08-20: Bổ sung quota validation theo tổng item, layer và itemId trước khi preview/apply.
- 2026-08-20: Bổ sung metric item density, release delay, tail pressure, unreleased inventory, spawn trap và loop risk.
- 2026-08-20: Đổi toàn bộ label/nút/thông báo hiển thị trong tab Generate sang tiếng Việt.
- 2026-08-20: Sửa pool ô hợp lệ theo layer để không tái dùng path cell khi chia requirement thành cụm.
- 2026-08-20: Mỗi lần tạo preview mới tự sinh `Mã ngẫu nhiên` mới và dùng seed đó để sinh màn.
- 2026-08-20: Cân lại release pressure: `maxUnreleasedItems` ước tính đỉnh tồn kho theo cụm/mật độ/delay thay vì lấy toàn bộ item bị trễ.
- 2026-08-20: Chuyển Tail/Release/Cluster/Spawn settings sang Auto Derived Parameters theo từng level; Designer chỉ chỉnh preset/score.
- 2026-08-20: Bỏ ràng buộc generate 1:1 theo tray layer; validate quota theo tổng itemId toàn map để cho phép noise/carry-over.
- 2026-08-20: Planner ưu tiên future tray demand trong từng map layer để layer đầu có thể chứa item phục vụ tray layer 3-4.
- 2026-08-20: Thêm spatial spread theo vùng map để tránh dồn nhiều cụm vào một phía và bỏ trống vùng còn lại.
- 2026-08-20: Hạn chế index item trùng giữa hai map layer liền kề, target overlap 10-25% tùy độ rộng map.
- 2026-08-20: Chia đều tổng item theo số layer path hợp lệ, không cố định khoảng 27-30 item mỗi layer.
- 2026-08-20: Auto Derived parameter cho phép designer override từng field và có tooltip mô tả tác dụng.
- 2026-08-20: Auto Derived chỉnh trực tiếp trên bảng chỉ số thay vì mở nhóm input riêng.
