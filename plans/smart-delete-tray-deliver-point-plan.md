# Railway Dash Editor - Smart Delete Tray Deliver Point Plan

## Source Logic

- Khi xoa Tray bang Smart Delete hoac Select Delete, cell click hop le la `deliverPoint`.
- Khong xoa Tray khi click `trayPosition` hoac cac cell footprint visual cua Tray.
- Handler xoa Tray phai tim item Tray theo key shared cell dang luu `deliverPoint`.
- Khong thay doi schema JSON, logic sync `trayPosition`/`deliverPoint`, visual Tray hay gameplay.

## Current Implementation Scope

- Cap nhat `js/editor/delete-resolver.js` de resolve target Tray theo `deliverPoint`.
- Cap nhat `js/editor/object-placement.js` de mode `tray` xoa Tray theo `deliverPoint`.
- Build lai `js/app.bundle.js`.

## Change History

- 2026-08-20: Tao plan va doi Smart/Delete Select Tray sang chon `deliverPoint` thay vi `trayPosition`.
