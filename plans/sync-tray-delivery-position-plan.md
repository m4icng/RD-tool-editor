# Railway Dash Editor - Sync TrayPosition & DeliverPoint Plan

## Source Logic

- `trayPosition` va `deliverPoint` khong con doc lap.
- `trayPosition` luon nam ngay phia tren `deliverPoint`.
- Neu grid co Y tang tu tren xuong duoi:
  - `deliverPoint.x = trayPosition.x`
  - `deliverPoint.y = trayPosition.y + 1`
  - `trayPosition.x = deliverPoint.x`
  - `trayPosition.y = deliverPoint.y - 1`
- Move Tray tu `trayPosition` moi phai tu dong tinh `deliverPoint` xuong 1 o.
- Move Delivery Point tu `deliverPoint` moi phai tu dong tinh `trayPosition` len 1 o.
- Moi update la mot transaction duy nhat de Undo/Redo restore ca cap.
- Preview/render sau confirm phai hien lai Tray visual, `trayPosition` va Delivery Point `⭕` theo cap moi.
- Validation khong cho confirm neu `trayPosition`, `deliverPoint` hoac Tray visual 3x3/3x4 vuot map.
- Khong cho ton tai trang thai hai point lech cot hoac tach roi nhau.

## Current Implementation Scope

- Them module `js/objects/tray-position-sync.js` lam source helper cho cap `trayPosition`/`deliverPoint`.
- Move bang input `trayPosition` trong Tray editor tu dong doi cell luu `deliverPoint`.
- Them input `deliverPoint` trong Tray editor; khi doi se tu dong cap nhat `trayPosition` len tren.
- Placement Tray moi validate ca cap `trayPosition`/`deliverPoint`.
- Resize map giu rule sync va xoa Tray neu cap/footprint khong con hop le.
- Validator va import structure bat loi khi `trayPosition` khong nam ngay tren `deliverPoint`.
- Undo/Redo giu ca cap trong cung snapshot vi moi move di qua `mutate()`.

## Change History

- 2026-08-19: Luu plan sync `trayPosition` va `deliverPoint`.
- 2026-08-19: Them helper chung MoveByTrayPosition / MoveByDeliverPoint, update Tray editor, placement, resize, validator va import.
