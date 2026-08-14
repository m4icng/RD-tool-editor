# Snacky Level Editor

Phiên bản module hóa của `snacky-level-editor.html`. `index.html` sử dụng bundle đã được tạo sẵn nên có thể mở trực tiếp bằng trình duyệt hoặc chạy qua static HTTP server.

```powershell
cd snacky-level-editor
npm run serve
```

Sau khi thay đổi source trong `js/`, tạo lại bundle dùng bởi `index.html`:

```powershell
npm run build
```

Chạy kiểm thử logic thuần:

```powershell
npm test
```

## Phân lớp

- `core`: state, event bus, history và hằng số dùng chung.
- `editor`: render grid, input và các thao tác chỉnh sửa.
- `objects`: registry cùng factory của từng loại object.
- `data`: schema, migration, serializer và validation.
- `gameplay`: runtime mô phỏng độc lập với DOM.
- `ui`: các view/controller nhỏ của giao diện.
- `utils`: helper không giữ state.

`levels/sample-level.json` là dữ liệu mẫu theo RailwayDash Level Format v1. Import/Export chỉ nhận format mới với ba field bắt buộc `Path.index`, `Grass.index` và `PriorityPoint.index`; format `road/turnpoint` cũ không còn được migration. Tất cả index, spawn, fruit, `trays[].deliverPoint.index` và `trays[].trayPosition.index` đều dùng zero-based row-major (`index = y × width + x`). Path và Grass không được trùng nhau; PriorityPoint bắt buộc thuộc Path. `deliverPoint` là checkpoint nằm trên Path; `trayPosition` là ô visual liền kề và có thể đặt ở trên, dưới, trái hoặc phải. Không chỉnh sửa `js/app.bundle.js` trực tiếp vì đây là file được sinh tự động từ các module.

Tab DataJson có thể quản lý trực tiếp các file JSON trong thư mục do người dùng cấp quyền trên trình duyệt hỗ trợ File System Access. File mới luôn được tải xuống; khi API thư mục không khả dụng, Import và Download vẫn hoạt động bình thường.
