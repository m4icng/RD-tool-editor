# Railway Dash Generator - Lock Item Layer Plan

## Goal

Bo sung chuc nang `Lock Layer` cho `itemLayers` trong Generate Tab.

- Designer co the khoa mot hoac nhieu Item Layer da thiet ke san.
- Generator khong duoc sinh de hoac thay doi Item trong Layer da Lock.
- Generator su dung cac Layer da Lock lam du lieu dau vao.
- Phan Item con thieu duoc tu dong sinh vao cac Layer chua Lock.
- Auto Tune va Repair chi duoc phep chinh cac Layer chua Lock.
- Khong thay doi cau truc JSON Level hien tai.

## Core Rule

Moi Item Layer co 2 trang thai:

- `LOCKED`: Designer owns.
- `AUTO`: Generator owns.

Neu Layer la `LOCKED`:

- Giu nguyen toan bo Item.
- Khong them Item.
- Khong xoa Item.
- Khong doi `itemId`.
- Khong doi `index`.
- Khong thay doi cluster.
- Khong thay doi distribution.
- Khong Auto Repair Layer do.

Neu Layer la `AUTO`:

- Generator duoc phep clear Item cu.
- Sinh Item moi.
- Thay doi mau.
- Thay doi Index.
- Auto Tune.
- Local Repair.

## UI Lock Layer

Trong Generate Tab, moi Item Layer co control Lock rieng:

```text
ITEM LAYERS

Layer 0    29 Items    [Locked]
Layer 1    30 Items    [Auto]
Layer 2    31 Items    [Locked]
Layer 3    36 Items    [Auto]
```

## Current Implementation Scope

- Them module `js/generate/item-layer-locks.js` de quan ly `LOCKED/AUTO`, dem item layer va tinh quota item da khoa.
- Generate UI hien danh sach Item Layer, so item va nut toggle `Locked/Auto`.
- Source analyzer tru quota item da khoa khoi tong demand cua Tray theo `itemId`.
- Neu locked layer co item vuot demand cua Tray, generator bao loi `LOCKED_ITEM_QUOTA_EXCEEDED`.
- Neu con item thieu nhung tat ca layer deu locked, generator bao loi `ALL_ITEM_LAYERS_LOCKED`.
- Generator chi clear/sinh item moi trong cac layer `AUTO`.
- Mystery Fruit reference cua layer `LOCKED` duoc giu lai; reference cua layer `AUTO` duoc clear khi sinh lai.
- Preview/apply giu nguyen layer `LOCKED` va sinh item vao dung layer index that cua cac layer `AUTO`.
- `itemLayerLocks` chi nam trong editor state noi bo, khong serialize vao JSON Level.

## Change History

- 2026-08-20: Luu plan rieng vao `plans/lock-item-layer-plan.md`.
- 2026-08-20: Them Lock Layer control trong Generate Tab cho tung Item Layer.
- 2026-08-20: Cap nhat generator de locked layer la input quota va chi layer Auto duoc clear/sinh/repair.
- 2026-08-20: Giu nguyen schema JSON Level, lock state khong export vao `itemLayers`.
