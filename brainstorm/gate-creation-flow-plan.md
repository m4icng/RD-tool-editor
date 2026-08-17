# Gate Creation Flow Plan

## Source Plan

1. Chọn `Gate Tool`.
2. Click vị trí cần đặt Gate.
3. Hiển thị `Direction Picker` ngay cạnh ô vừa đặt.
4. Chọn hướng Gate.
5. Hoàn thành Gate.

Flow:

Gate Tool
→ Place Gate
→ Open Direction Picker
→ Select Direction
→ Complete Gate

## Direction Picker

Ngay sau khi đặt Gate, hiển thị popup/dropdown tại chính Grid Cell:

- ↑ Up
- ↓ Down
- → Right
- ← Left

Bỏ các button trong `gate-direction-picker` của palette.

## Change History

- 2026-08-17: Tạo plan từ yêu cầu Gate Creation Flow. Chốt Gate dùng popup direction sau khi đặt, không chọn hướng bằng button hover trong palette.
- 2026-08-17: Implement flow Gate Tool → Place Gate → Direction Picker tại grid cell → Select Direction. Đã bỏ UI `gate-direction-picker` trong palette.
