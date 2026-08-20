# Railway Dash Editor - Delete All Items Option Plan

## Source Logic

- Delete menu bo sung action `Xoa toan bo Item tren Map`.
- Action nay clear tat ca item trong moi `itemLayers`.
- Khong xoa Path.
- Khong xoa Tray.
- Khong xoa PriorityPoint.
- Khong xoa Element.
- Khong doi cau truc JSON hoac xoa layer.
- Xoa toan bo Mystery Fruit reference vi Item source da bi clear.
- Moi thay doi di qua `mutate()` de ho tro Undo/Redo.
- Phai confirm truoc khi chay vi day la thao tac destructive.

## Current Implementation Scope

- Them option `Xoa toan bo Item tren Map` vao Delete menu.
- Them option `Xoa Item Layer hien tai` vao Delete menu, dung lai flow xoa layer hien co.
- Them action `Xoa theo thao tac hien tai` de quay ve tool Xoa voi mode hien tai.
- Them `clearAllItemLayers()` trong `js/editor/object-placement.js` de clear item trong tat ca layer va reset `mysteryFruitElement`.
- Giu nguyen action `Xoa toan bo map` hien co.

## Change History

- 2026-08-20: Tao plan va implement Delete menu option xoa toan bo Item tren Map, co confirm va Undo/Redo qua mutate.
