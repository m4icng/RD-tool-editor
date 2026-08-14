---
# BẢN THẢO BRAINSTORM: RailwayDash Level Format v1
**Ngày:** 2026-08-13
**Trạng thái:** ✅ Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- Format đích dùng các nhóm: `levelId`, `map`, `road`, `spawns`, `itemLayers`, `trays`, `elements`.
- Editor hiện dùng tọa độ chuỗi `"x,y"`, còn format game dùng một số nguyên `index`; phải chốt công thức quy đổi trước khi tích hợp.
- `road.index` sẽ ánh xạ đường đi dùng chung; `spawns` ánh xạ đầu rắn; `itemLayers` ánh xạ các global fruit layer; `trays.positions` và `trays.layers` ánh xạ vị trí cùng queue recipe của từng khay.
- Fruit `itemId` hiện có mapping: Táo `1`, Chuối `2`, Nho `3`, Cà tím `4`.
- Sức chứa mỗi tray layer trong Editor cố định là `9`, phù hợp với các recipe mẫu của format game.
- Import/export cần giữ nguyên logic Editor hiện tại: map/path/snake/tray dùng chung, chỉ fruit thay đổi theo layer.
- Mọi `index` là zero-based row-major: `index = y × map.width + x`; chiều ngược lại `x = index % width`, `y = floor(index / width)`.
- `road.index` liệt kê đầy đủ từng ô có thể di chuyển; fruit hợp lệ bắt buộc phải nằm trên một index thuộc road.
- Import không được âm thầm thêm road cho fruit ngoài đường. Dữ liệu vẫn được nạp để sửa nhưng validator/Playable phải báo lỗi.
- `map.width` và `map.height` chấp nhận mọi số nguyên dương. Editor không còn khóa kích thước theo preset gốc 17×28 hoặc quy luật bước ±2/±4.
- UI kích thước dùng hai control độc lập `Width` và `Height`, mỗi control có `−/+`, minimum `1`. Giảm map vẫn bị chặn nếu vùng bị cắt còn dữ liệu.
- Không dùng `levelId` trong JSON hoặc UI. Tên file là định danh duy nhất của level; quyết định này thay thế quyết định Câu 5.
- Tab `DataJson` quản lý các JSON đã tồn tại trong một thư mục ổ đĩa do người dùng chọn và cấp quyền. File mới không tự ghi vào thư mục; phải tải xuống qua trình duyệt.
- File hiện có trong thư mục hỗ trợ `Mở`, `Lưu đè`, `Đổi tên`, `Xóa`; đổi tên và xóa luôn yêu cầu xác nhận.
- Mở/import một JSON thay toàn bộ level hiện tại, không merge. Nếu có thay đổi chưa lưu ra file hoặc chưa download, Editor phải hỏi xác nhận.
- `itemLayers[].layer` là số thứ tự zero-based, được phép khuyết. Chỉ tạo các layer tồn tại, sắp xếp tăng dần và giữ nguyên số khi export.
- `trays.layers[].layer` dùng cùng quy tắc zero-based, được phép khuyết riêng theo từng `trayId`; tray queue độc lập với global item layer.
- `trays.positions[].index` là checkpoint gameplay và phải thuộc road. Visual khay được suy ra tại `index - map.width`, tức ô ngay phía trên. Trong Editor, thao tác đặt khay nhắm vào checkpoint trên đường và tự tạo visual phía trên.
- Mỗi level bắt buộc có đúng một spawn; `spawns.length === 1` và Editor chỉ cho phép một đầu rắn.
- Biên import/export file chuyển hoàn toàn sang RailwayDash Level Format v1. Không nhận hoặc xuất schema backup nội bộ cũ.
- `elements` hiện chỉ là field dự phòng và luôn export `{}`. Import gặp object không rỗng phải báo chưa hỗ trợ, không âm thầm xóa dữ liệu.
- `itemId` ngoài registry 1–4 được giữ bằng placeholder `Unknown #ID`, bao gồm ID, vị trí hoặc count để round-trip. Playable bị khóa khi còn unknown item.
- File có cấu trúc hợp lệ được import dù có lỗi gameplay để người dùng sửa; lỗi gameplay khóa Playable và Export. JSON hỏng, thiếu map, sai kiểu field hoặc index ngoài phạm vi bị từ chối import.
- Tab DataJson có ô `Tên file`; Editor tự thêm/chuẩn hóa `.json` và ghi nhớ tên. Nếu trùng file trong thư mục đang quản lý, cảnh báo và đề xuất dùng `Lưu đè`.
- `trayId` là ID ổn định, zero-based. Import giữ nguyên; khay mới dùng số nhỏ nhất chưa sử dụng; reorder hoặc di chuyển không đổi ID.
- Checkpoint khay bắt buộc xuất hiện trong `road.index`. Import không tự thêm road; file thiếu road được nạp để sửa nhưng khóa Playable/Export.
- Khi File System Access không khả dụng, vẫn cho Import file và Download; disable quản lý thư mục cùng thông báo tương thích, không giả lập bằng local storage.
- `road.index` là tập hợp ô không có thứ tự gameplay; kết nối suy ra từ bốn ô kề. Export loại trùng và sắp index tăng dần.
- Global item layer rỗng bị bỏ khỏi `itemLayers` khi export; layer number được phép khuyết nên không tạo phase rỗng.
- `Tạo level mới` sinh map trắng 17×28, một item layer số 0, không road/spawn/tray, tên `untitled-level.json`; hỏi xác nhận nếu level hiện tại chưa lưu/download.
- Layer mới dùng `max(layer) + 1`. Khi reorder, giữ tập số layer hiện có nhưng gán lại các số đó theo thứ tự UI mới, nên khoảng số khuyết vẫn được bảo toàn.
- `trays` chuyển thành mảng tray group. Mỗi group có `{ trayId, positions, layers }`, khai báo `trayId` đúng một lần; `positions` có đúng một checkpoint và các layer bên trong không lặp lại `trayId`. Import vẫn nhận cấu trúc phẳng cũ để chuyển tiếp, nhưng export chỉ sinh cấu trúc grouped mới.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

| RailwayDash v1 | Editor hiện tại | Trạng thái mapping |
|---|---|---|
| `levelId` | không sử dụng | Loại khỏi JSON import/export; tên file là định danh level |
| `map.width/height` | `grid.columns/rows` | Mapping trực tiếp, nhưng format mẫu 15×20 không thuộc chuỗi size hiện tại |
| `road.index[]` | `sharedCells[key].path` | Cần xác nhận công thức `index ↔ (x,y)` |
| `spawns[].index` | shared item `snake` | Cần xác nhận chỉ một spawn hay nhiều spawn |
| `itemLayers[].layer` | thứ tự/id global fruit layer | Cần xác nhận zero-based và xử lý layer bị khuyết |
| `items[].itemId/index[]` | fruit type tại nhiều cell | `itemId` 1–4 đã có mapping |
| `trays.positions[]` | shared tray item tại tọa độ | `trayId` dùng để join với `trays.layers` |
| `trays.layers[]` | `trayLayers[].recipe` | Cần xác nhận zero-based và thứ tự spawn |
| `elements` | `sharedCells[].element` | Chưa có format con mẫu, để pass-through hoặc bổ sung sau |

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | Công thức chuyển `index` thành tọa độ có phải row-major, bắt đầu từ 0? | Option A. | Dùng `index = y × width + x` cho toàn bộ format. |
| 2 | `road.index` là đầy đủ ô di chuyển hay chỉ waypoint? | Option B. | Road liệt kê đầy đủ; fruit bắt buộc nằm trên road. Fruit ngoài road trong file mẫu là dữ liệu chưa hợp lệ và phải được cảnh báo. |
| 3 | Kích thước map có bị giới hạn theo chuỗi preset Editor? | Mọi data đều dùng được miễn là số nguyên dương; về sau không cố định theo mẫu hiện tại. | `width/height` là hai số nguyên dương tự do; bỏ ràng buộc preset 17×28 và bước ±2/±4. |
| 4 | UI chỉnh kích thước tự do hoạt động thế nào? | Option A. | Dùng hai stepper Width/Height độc lập, minimum 1; giữ bảo vệ dữ liệu khi giảm map. |
| 5 | `levelId` được quản lý thế nào? | Ban đầu chọn Option A, sau đó yêu cầu bỏ ID và chỉ dùng tên file. | Quyết định cuối: không có `levelId`; tên file là định danh level. DataJson có khu vực quản lý file. |
| 6 | Hàng quản lý file DataJson dùng storage nào? | Option B; file mới yêu cầu tải xuống. | File đã có được quản lý trực tiếp trên ổ đĩa sau khi chọn thư mục; file mới chỉ download, không tự tạo trong thư mục. |
| 7 | File hiện có được phép thực hiện thao tác nào? | Option A. | Hỗ trợ Mở, Lưu đè, Đổi tên, Xóa; xác nhận trước đổi tên/xóa. |
| 8 | Import xử lý level đang chỉnh thế nào? | Option A. | Thay toàn bộ; hỏi xác nhận nếu có thay đổi chưa lưu; không merge. |
| 9 | `itemLayers.layer` có zero-based và được phép khuyết? | Option B. | Zero-based, được khuyết; chỉ tạo layer có trong file, gameplay theo thứ tự tăng dần, export giữ số gốc. |
| 10 | `trays.layers.layer` có cùng quy tắc và quan hệ nào với item layer? | Option A. | Zero-based, được khuyết theo từng tray; queue độc lập với item layer; giữ số gốc khi export. |
| 11 | `trays.positions.index` là ô visual hay checkpoint? | Ban đầu chọn Option A, sau đó làm rõ index là điểm `index + width` theo cách lưu visual cũ. | Quyết định cuối: JSON lưu checkpoint; visual được render ở `index - width`. Editor đặt khay tại checkpoint trên road và tự tạo visual phía trên. |
| 12 | Một level có bao nhiêu spawn? | Chỉ có 1 điểm spawn. | Bắt buộc `spawns.length === 1`, ánh xạ đúng một đầu rắn trong Editor. |
| 13 | Import/export chính hỗ trợ format nào? | Option A. | Chỉ dùng RailwayDash Level Format v1; bỏ file schema nội bộ cũ tại biên import/export. |
| 14 | Xử lý `elements` khi chưa có thiết kế? | Tạm thời chỉ là hàng chờ vì game chưa thiết kế element. | Export `{}`; chưa có UI element; import dữ liệu element không rỗng phải báo chưa hỗ trợ. |
| 15 | Xử lý `itemId` chưa có trong registry? | Option B. | Import placeholder Unknown, giữ nguyên ID/vị trí/count để export; khóa Playable đến khi được hỗ trợ hoặc thay thế. |
| 16 | File có lỗi gameplay nhưng cấu trúc đọc được có được import? | Option A. | Vẫn nạp để sửa; khóa Playable và Export; chỉ từ chối lỗi cấu trúc nghiêm trọng. |
| 17 | Tên file mới khi download được xác định thế nào? | Option A. | Có input Tên file trong DataJson, tự thêm `.json`, ghi nhớ tên; cảnh báo nếu trùng file đang quản lý. |
| 18 | `trayId` được sinh và giữ thế nào? | Option A. | ID ổn định, zero-based; import giữ nguyên; khay mới lấy số nhỏ nhất còn trống; reorder/move không đổi ID. |
| 19 | File mẫu có tray ở hàng cuối được xử lý thế nào? | Làm rõ rằng index JSON là checkpoint, không phải visual. | Không còn lỗi hàng cuối: visual nằm phía trên checkpoint. Quyết định vị trí ở Câu 11 được thay thế. |
| 20 | Checkpoint khay có bắt buộc thuộc `road.index`? | Option A. | Bắt buộc thuộc road; file mẫu thiếu 285/289 là lỗi có thể import để sửa; không tự thêm road. |
| 21 | Fallback khi trình duyệt không hỗ trợ quản lý thư mục? | Option A. | Giữ Import/Download; disable Chọn thư mục/Lưu đè/Đổi tên/Xóa và báo tương thích. |
| 22 | Thứ tự `road.index` có ý nghĩa gameplay? | Option A. | Không; road là tập ô, nối theo adjacency; export unique và sort tăng dần. |
| 23 | Global item layer rỗng được export thế nào? | Option A. | Bỏ khỏi `itemLayers`; không tạo phase gameplay và không round-trip layer rỗng. |
| 24 | Dữ liệu mặc định khi tạo level/file mới? | Option A. | Map trắng 17×28, layer 0, không road/spawn/tray, tên untitled-level.json; xác nhận nếu có thay đổi chưa lưu. |
| 25 | Thêm/reorder thay đổi số `layer` thế nào? | Option A. | Layer mới dùng max+1; reorder giữ tập số hiện có và gán lại theo thứ tự mới, bảo toàn gap nhưng đổi thứ tự gameplay. |
| 26 | Giảm lặp `trayId` trong dữ liệu tray thế nào? | Xác nhận dùng `trays[]`, mỗi object gồm `trayId`, `positions[]`, `layers[]`. | Mỗi tray ID chỉ khai báo một lần ở group; position/layer không chứa lại `trayId`; một group có đúng một checkpoint. |

## 4. [OPEN FLAGS] — Điểm chưa rõ, cần kiểm tra hoặc xác nhận thêm

- Không còn open flag blocking implementation.
- `itemLayers.layer` và `trays.layers.layer` có bắt buộc zero-based, liên tục và duy nhất không.
- Import có thay toàn bộ dữ liệu Editor hiện tại hay merge.
- Export mặc định chỉ dùng format game, hay cần giữ thêm lựa chọn schema nội bộ để round-trip toàn bộ metadata Editor.
- `elements` có cấu trúc cụ thể nào và element có dùng `index` giống các phần khác không.
- Tray visual trong format game đang ở `index` riêng; checkpoint delivery dưới khay là quy ước runtime suy ra hay cần xuất riêng.

## 5. Kết quả cuối phiên

Đã chốt đầy đủ mapping RailwayDash v1, validation/import policy, checkpoint khay, layer numbering, kích thước tự do và quản lý file ổ đĩa tại DataJson. Sẵn sàng tích hợp vào code và tài liệu chính.
---
