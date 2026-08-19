# Snacky Level Editor

Web tool editor dùng để tạo và chỉnh level Railway Dash theo `RailwayDash Level Format v1`. Tool chạy bằng HTML/CSS/JavaScript thuần, state được module hóa trong `js/`, còn `index.html` dùng `js/app.bundle.js` đã build sẵn.

## Chạy editor

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy static server:

## Cách sử dụng nhanh

- Chọn tab `Level` để vẽ map, đặt item, đặt element và chỉnh layer fruit.
- Chọn tool trong toolbar: vẽ Path, chỉnh Terrain, đặt Item/Element, Select hoặc Erase.
- Click/drag trên grid để đặt nội dung. Một số element mở popup chọn hướng ngay tại cell sau khi đặt.
- Dùng panel bên phải để chỉnh thông tin ô đang chọn, khay chứa, layer fruit và thông số level.
- Chọn tab `DataJson` để import/export JSON hoặc kết nối thư mục level nếu trình duyệt hỗ trợ File System Access.
- Tất cả index trong JSON dùng zero-based row-major: `index = y * width + x`.

## Cách editor lưu dữ liệu

- `Path.index`: ô đường tàu có thể đi.
- `Grass.index`: ô nền grass, không được trùng Path.
- `PriorityPoint.index`: điểm ưu tiên, bắt buộc nằm trên Path.
- `itemLayers`: fruit theo từng layer.
- `trays`: khay chứa, gồm điểm giao hàng và vị trí hiển thị khay.
- `bridgeElement`, `gateElement`, `countBarrierElement`, `tunnelElement`, `oneWayElement`, `mysteryFruitElement`: element gameplay ở root JSON.

## Item và element

- `Snake Start`: đầu rắn, chỉ có một trên map.
- `Fruit`: apple, banana, grape, eggplant; được đặt theo layer fruit.
- `Tray`: khay nhận fruit, setup trong panel khay.
- `Bridge`: cầu cho hai tuyến cắt cùng cell nhưng không tạo giao lộ. `axis = 0` là ngang, `axis = 1` là dọc.
- `Gate`: cổng một chiều theo hướng chọn sau khi đặt. `direction`: `0 Up`, `1 Down`, `2 Right`, `3 Left`.
- `Count Barrier`: vùng Path có `count`; chỉ mở/được xử lý khi đạt số lượng yêu cầu.
- `Tunnel`: nối hai điểm Path. Quy trình đặt: chọn Point A, chọn hướng A, chọn Point B, chọn hướng B.
- `One Way`: nối hai điểm Path với hướng di chuyển bắt buộc. Quy trình đặt giống Tunnel.
- `Mystery Fruit`: element ẩn/đánh dấu fruit thật trong layer, có chế độ debug để xem trực tiếp.

## Module chính

- `core`: state, constants, event bus, history.
- `editor`: grid renderer, input, camera, placement/erase.
- `objects`: định nghĩa item/element và helper normalize.
- `data`: schema, serializer, validator, import/export file.
- `gameplay`: playable preview, simulation, collision, win condition.
- `ui`: toolbar, palette, inspector, tray editor, data summary.
- `utils`: helper grid, id, file, math.

Không sửa trực tiếp `js/app.bundle.js` nếu thay đổi logic. Sửa module trong `js/`, sau đó chạy `npm run build`.
