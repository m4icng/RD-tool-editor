# Railway Dash Editor - Tray 3x3 Visual All Tabs Plan

## Source Logic

- Tray 3x3 slot color visual phai dung chung tren cac tab co hien map.
- LevelDes va Generate dung chung `renderGrid()` nen visual Tray phai nam trong renderer chung.
- Playable tiep tuc dung runtime active layer progress de slot da fill hien full mau.
- LevelDes/Generate khong co runtime delivered nen slot requirement cua active layer hien border mau va ben trong rong.
- Neu active layer chua co Tray requirement tuong ung, hien 9 slot placeholder rong de GD thay layer chua setup.
- Khong thay doi schema JSON, `trayPosition`, `deliverPoint`, collect/fill/complete logic.

## Current Implementation Scope

- Chuyen module slot visual sang `js/core/tray-slot-visual.js` de Editor, Generate va Playable dung chung.
- Cap nhat `js/editor/grid-renderer.js` de render 9 slot mau tren Tray footprint main.
- Generate tab nhan visual moi thong qua renderer chung `renderGrid()`.
- Playable giu logic fill runtime hien co, chi doi import helper sang module core.

## Change History

- 2026-08-20: Luu plan rieng cho Tray 3x3 visual all tabs.
- 2026-08-20: Ap dung visual slot mau cho LevelDes va Generate qua renderer chung; Playable tiep tuc dung runtime fill progress.
