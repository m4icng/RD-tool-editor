# Railway Dash Editor — Shared Map Data Across Tabs Plan

## Goal

Toàn bộ data của Map phải được đồng bộ giữa tất cả các tab trong Editor.

Khi chuyển tab:

- Không reset Map.
- Không reload lại data từ đầu.
- Không tạo bản copy riêng cho từng tab.
- Giữ nguyên toàn bộ chỉnh sửa hiện tại.
- Tab mới chỉ thay đổi cách hiển thị và công cụ thao tác trên cùng một Level Data.

Các tab như:

- Level Des
- Generate
- Playable
- Các tab mở rộng sau này

đều phải dùng chung một `LevelState`.

---

## 1. Single Source of Truth

Chỉ tồn tại một Level Data đang active:

`LevelState`

Tất cả tab cùng đọc và ghi vào object này.

Flow:

```text
LevelState
   ↓
Level Des
Generate
Playable
Other Tabs
```

## 2. Change History

- 2026-08-20: Lưu plan riêng vào `plans/shared-map-data-across-tabs-plan.md`.
- 2026-08-20: Playable preview đọc trực tiếp `LevelState` đang active thay vì giữ snapshot riêng khi chuyển tab.
- 2026-08-20: Giữ Generate preview là working copy tạm thời chỉ để xem trước; Apply mới ghi vào `LevelState`, đúng flow preview/apply hiện có.
