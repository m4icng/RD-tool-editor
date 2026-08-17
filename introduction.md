# Introduction: Luong Logic Chuc Nang Trong Editor

Tai lieu nay tom tat cac luong logic chinh cua `snacky-level-editor`, giup nguoi moi doc code nam nhanh editor dang van hanh nhu the nao va nen bat dau tu dau khi sua tinh nang.

## 1. Tong Quan Kien Truc

Editor duoc tach thanh cac nhom module ro rang:

- `js/app.js`: entry point cua ung dung. File nay gom DOM element, khoi tao state, dang ky event listener, goi render, validate, import/export va playable.
- `js/core`: quan ly state, event bus, history undo/redo va hang so dung chung.
- `js/editor`: xu ly thao tac tren grid nhu ve path, dat object, xoa, select cell, drag input va render grid.
- `js/objects`: khai bao object registry va factory cho snake, fruit, tray, path, obstacle.
- `js/ui`: cac panel giao dien nhu toolbar, palette, inspector, level settings, tray editor, data summary.
- `js/data`: serializer, deserializer, migration, validator va file manager.
- `js/gameplay`: runtime playable doc lap voi editor DOM, dung de test level nhu mot man choi that.
- `js/utils`: helper tinh toa do grid, index, cell key, file JSON va math.

`app.js` la noi noi cac module lai voi nhau: nguoi dung thao tac UI -> event listener goi ham nghiep vu -> state thay doi -> event `change` -> render lai toan bo UI -> persist vao `localStorage`.

## 2. State Trung Tam

State chinh nam trong `EditorState` tai `js/core/editor-state.js`.

State mac dinh duoc tao boi `createInitialState()` voi cac field quan trong:

- `grid`: kich thuoc map, gom `columns` va `rows`.
- `sharedCells`: du lieu dung chung cho moi layer, gom Path, snake, tray, truck, element.
- `grassCells`: cac o Grass rieng theo terrain.
- `priorityPoints`: cac diem dung/uu tien chon huong tren Path.
- `layers`: danh sach layer fruit. Moi layer chi luu fruit trong `cells`.
- `activeLayerId`: layer fruit dang chinh sua.
- `selectedCell`: o dang duoc chon tren grid.
- `selectedAssetId`: object/terrain dang duoc chon tu palette.
- `tool`: cong cu hien tai, vi du `path`, `item`, `terrain`, `select`, `erase`.
- `eraseMode`: kieu xoa, mac dinh la `smart`.
- `tab`: workspace hien tai, gom `level`, `playable`, `json`.
- `fileName`, `sourceFileName`, `fileDirty`: trang thai file JSON.

`EditorState.mutate()` la cong vao chinh de sua state. Moi lan mutate se:

1. Push snapshot vao `HistoryManager` neu khong nam trong transaction.
2. Chay ham thay doi state.
3. Emit event `change`.

`app.js` lang nghe `editor.events.on("change", renderAll)`, nen moi thay doi state se keo theo render lai UI va luu vao `localStorage`.

## 3. Luong Khoi Dong Editor

Khi mo `index.html`, `js/app.js` chay theo thu tu:

1. Lay DOM elements bang `document.getElementById`.
2. Goi `loadSavedState()` de doc `localStorage`.
3. Neu co state moi hop le, deserialize bang `deserializeEditorState`.
4. Neu gap data cu, thu migrate bang `migrateLevel`.
5. Neu khong co data, tao state moi bang `createInitialState`.
6. Khoi tao `EditorState`, `LevelFileManager`, `PlayableController`, panel resizer va grid index tooltip.
7. Dang ky tat ca event listener cho toolbar, palette, grid, layer, tray, JSON, playable.
8. Goi `renderAll()`.
9. Goi `switchTab(...)` de hien tab cu neu hop le, nguoc lai ve `level`.

Luong nay dam bao editor co the tiep tuc tu lan lam viec truoc, nhung van co fallback ve map moi neu storage loi.

## 4. Luong Render Tong

Ham trung tam la `renderAll()` trong `js/app.js`.

Moi lan render, editor thuc hien:

1. Lay active layer hien tai.
2. Render palette object theo category dang chon.
3. Render grid bang `renderGrid(elements.gridBoard, editor.data)`.
4. Render danh sach layer fruit.
5. Render tray editor.
6. Render inspector cho selected cell.
7. Render data summary.
8. Render toolbar.
9. Validate level bang `validateLevel`.
10. Cap nhat cac chi so Path, Grass, PriorityPoint, Item, Fruit, Tray, Capacity.
11. Dong bo input Width/Height va metadata grid.
12. Render workspace JSON bang `renderJsonWorkspace()`.
13. Fit board vao canvas.
14. Persist editor state vao `localStorage`.

Vi `renderAll()` lam nhieu viec, cac module render con nen giu thuan UI va tranh tu mutate state truc tiep neu khong can.

## 5. Luong Input Tren Grid

Input grid duoc dieu phoi boi `InputController` trong `js/editor/input-controller.js`, nhung logic nghiep vu nam trong callback khai bao tai `app.js`.

Khi nguoi dung click hoac drag tren grid:

1. `InputController` bat pointer event va tinh toa do cell.
2. Khi bat dau stroke, goi `editor.beginTransaction()` de gom nhieu cell drag thanh mot undo step.
3. Voi moi cell, callback `onCell(x, y, options)` duoc goi.
4. Neu click vao visual cua tray, editor route ve checkpoint goc cua tray.
5. Neu tool la `select`, goi `selectCell`.
6. Neu tool khac, goi `applyTool(state, x, y, toolOverride)`.
7. Neu `applyTool` tra ve reason loi, UI hien notification tuong ung.
8. Khi ket thuc stroke, goi `editor.endTransaction()`.

Shortcut chinh:

- `Z`: undo.
- `Shift+Z` hoac `Y`: redo.
- `Delete`/`Backspace`: smart erase selected cell.
- `1`, `2`, `3`, `4`: doi nhanh tool path/item/select/erase.

## 6. Luong Dat Path, Terrain Va PriorityPoint

Logic nam trong `applyTool()` tai `js/editor/object-placement.js`.

Khi tool la `path`:

1. Cell duoc danh dau `shared.path = true`.
2. Cell do bi xoa khoi `grassCells`.
3. Editor tinh lai cac turnpoint tu dong.
4. PriorityPoint auto duoc them o cac diem re/nga ba va xoa khi khong con hop le.

Khi tool la `terrain`:

- Chon Grass: chi duoc dat tren o khong co Path.
- Chon Empty: chi duoc dat tren o khong co Path.
- Chon PriorityPoint: chi duoc dat tren Path, va duoc luu voi source `manual`.

Quy tac quan trong:

- Path va Grass khong duoc trung nhau.
- PriorityPoint bat buoc thuoc Path.
- Xoa Path se tra o do ve Grass va xoa PriorityPoint tai o do.

## 7. Luong Dat Item

Khi tool la `item`, `applyTool()` lay object bang `findObject(state.selectedAssetId)`.

Neu object la fruit:

1. Cell duoc ep thanh Path.
2. Fruit duoc luu trong `activeLayer.cells`.
3. Fruit khong duoc trung voi shared item nhu snake/tray.

Neu object la snake:

1. Snake duoc luu trong `sharedCells`.
2. Object co `uniqueOnMap` nen moi map chi co mot dau ran.
3. Khi da co snake o noi khac, editor tra reason `unique-object-exists`.

Neu object la tray/truck:

1. Checkpoint bat buoc nam tren Path.
2. Visual tray mac dinh nam o o phia tren checkpoint.
3. Visual tray phai nam trong grid.
4. Visual tray phai trong: khong Path, khong item, khong element, khong fruit, khong trung visual tray khac.
5. Tray duoc gan `trayId` nho nhat chua dung.
6. `trayPosition` duoc luu de export ra `trays[].trayPosition.index`.

Neu object la item shared khac:

1. Khong duoc dat trung shared item khac.
2. Khong duoc dat len o dang co fruit o bat ky layer nao.
3. Thuong se ep cell thanh Path.

## 8. Luong Xoa Du Lieu

Xoa cell duoc xu ly boi `eraseAtPosition(state, position, mode)`.

Co cac mode chinh:

- `smart`: xoa theo thu tu uu tien PriorityPoint -> fruit layer hien tai -> shared item -> element -> Path.
- `item`: chi xoa fruit layer hien tai hoac shared item.
- `element`: chi xoa element.
- `path`: chi xoa Path.

Trong smart erase, neu o Path co fruit o layer khac, editor khong xoa Path ngay va tra reason `fruit-on-other-layer`. Muc dich la tranh lam hong cac layer fruit an khac.

`clearEntireMap()` xoa toan bo:

- `sharedCells`
- `priorityPoints`
- tat ca fruit trong moi layer
- dat lai full `grassCells`
- clear `selectedCell`

## 9. Luong Layer Fruit

Editor tach du lieu thanh:

- `sharedCells`: map dung chung cho moi layer, gom Path, snake, tray, element.
- `layers[].cells`: chi chua fruit cua tung layer.

Khi render grid, `createMergedLayer(editorData)` tron shared data voi active fruit layer. Neu layer dang chon bi an, grid van hien shared item/path nhung khong hien fruit cua layer do.

Them layer:

1. `addLayer()` goi `createLayer(nextNumber)`.
2. Push vao `state.layers`.
3. Dat layer moi thanh active.
4. Re-render va persist.

Xoa layer:

1. Chi cho xoa khi co hon mot layer.
2. Xoa toan bo fruit cua layer do.
3. Giu nguyen Path, snake, tray va cac shared object.
4. Reindex lai ten/layer number bang `reindexLayers`.

Doi active layer chi thay `activeLayerId`, khong lam thay doi map dung chung.

## 10. Luong Tray Va Recipe

Tray editor nam trong `js/ui/tray-editor.js`.

Danh sach tray duoc doc tu `sharedCells`, vi tray la object dung chung. Khi chon mot tray, panel hien:

- `deliverPoint`: checkpoint nam tren Path.
- `trayPosition`: vi tri visual nam lien ke checkpoint.
- danh sach `trayLayers`.
- recipe cua tung tray layer.

Them tray layer:

1. `addTrayLayer()` tao layer moi cho tray dang chon.
2. Recipe ban dau rong, capacity muc tieu la 9.

Sua recipe:

1. `changeTrayLayerRecipe()` tang/giam so luong tung fruit type.
2. Tong moi layer khong duoc vuot `TRAY_CAPACITY = 9`.
3. Recipe hop le khi tong bang 9.

Chon nhanh fruit type:

1. `selectTrayLayerFruit()` them mot loai fruit chua co.
2. Loai fruit moi nhan toan bo capacity con lai.

Doi huong visual tray:

1. `setTrayVisualDirection()` tinh position moi tu checkpoint.
2. Kiem tra nam trong grid.
3. Kiem tra o visual khong bi chiem boi Path, item, element, fruit hoac visual tray khac.
4. Neu hop le, cap nhat `item.trayPosition`.

Ke thua truck cu:

- `convertLegacyTruckToTray()` chuyen truck cu thanh tray moi capacity 9, giu huong visual va tao recipe tu fruit type cu.

## 11. Luong Validation

Validation chinh nam trong `js/data/validator.js`.

`validateLevel(level)` tra ve:

- `valid`: khong co error cau truc nghiem trong.
- `exportable`: khong co error va warning.
- `errors`: loi lam state khong hop le.
- `warnings`: canh bao gameplay/export.
- `stats`: thong ke Path, fruit, snake, tray, capacity.

Cac rule quan trong:

- Grid phai co width/height nguyen duong.
- Level phai co it nhat mot layer.
- Tat ca cell phai nam trong grid.
- Grass khong duoc trung Path.
- PriorityPoint phai thuoc Path.
- Can dung 1 snake start.
- Can co fruit.
- Can co tray.
- Moi tray layer can recipe du 9 item.
- Tong fruit tren cac layer phai khop tong recipe cua cac tray.
- Spawn, fruit va checkpoint tray nen nam tren Path.
- Visual tray phai nam trong grid va khong bi chiem.
- Unknown item lam level chua san sang export/playable.

`renderValidation()` trong `app.js` dung report nay de cap nhat checklist UI va bat/tat nut export.

## 12. Luong Import JSON

Import duoc bat dau tu nut Import trong toolbar hoac DataJson tab:

1. Neu file hien tai dang dirty, `canReplaceCurrentLevel()` hoi xac nhan.
2. File input doc JSON bang `readJsonFile`.
3. `openImportedData(raw, fileName)` goi `deserializeLevel`.
4. `deserializeLevel` validate cau truc JSON game format:
   - `map.width`, `map.height`
   - `Path.index`
   - `Grass.index`
   - `PriorityPoint.index`
   - `spawns`
   - `itemLayers`
   - `trays`
   - `elements`
5. Index zero-based row-major duoc doi sang toa do bang `indexToPosition`.
6. Path/Grass/PriorityPoint duoc nap vao state noi bo.
7. Fruit duoc gom vao `layers`.
8. Tray duoc nap vao `sharedCells`, gom `deliverPoint`, `trayPosition` va `trayLayers`.
9. History duoc clear, fileDirty = false.
10. Editor chuyen ve tab `level`, render lai va hien notification.

Serializer co ho tro normalize format tray cu dang gom `positions` va `layers` bang `normalizeTrayGroups`.

## 13. Luong Export JSON

Export duoc xu ly boi `serializeLevel(editorData)` trong `js/data/serializer.js`.

Truoc khi export:

1. `validateLevel(editor.data)` phai co `exportable = true`.
2. File name duoc normalize bang `normalizeFileName`.

Khi serialize:

1. `sharedCells` co `path` duoc doi thanh `Path.index`.
2. `grassCells` duoc doi thanh `Grass.index`.
3. `priorityPoints` duoc doi thanh `PriorityPoint.index`.
4. Snake duoc doi thanh `spawns`.
5. Fruit trong tung `layers[].cells` duoc gom theo `itemId` thanh `itemLayers`.
6. Tray trong `sharedCells` duoc doi thanh `trays`, gom:
   - `trayId`
   - `deliverPoint.index`
   - `trayPosition.index`
   - `layers[].items[]`
7. `elements` hien tai export la object rong.

Download dung `downloadJson()`. Neu editor dang quan ly thu muc qua File System Access API, nut Save trong danh sach file co the ghi de file JSON hien co.

## 14. Luong Quan Ly File Trong Tab DataJson

`LevelFileManager` trong `js/data/file-manager.js` boc File System Access API cua trinh duyet.

Neu trinh duyet ho tro `window.showDirectoryPicker`:

1. Nguoi dung chon folder level.
2. `listFiles()` liet ke cac file `.json`.
3. UI hien danh sach file voi cac action: Mo, Luu de, Doi ten, Xoa.

Chi tiet action:

- `open`: doc JSON trong folder va import vao editor.
- `save`: validate level, serialize va ghi de file.
- `rename`: tao file moi voi ten moi, copy noi dung cu, xoa file cu.
- `delete`: xoa file khoi folder.

Neu API khong kha dung, editor van cho Import va Download binh thuong.

## 15. Luong Playable

Playable nam trong `js/gameplay/playable-controller.js`.

Khi chuyen sang tab `playable`:

1. `switchTab("playable")` goi `playable.enter()`.
2. Playable clone level hien tai thanh `previewLevel`.
3. Goi `validatePlayableLevel(previewLevel)`.
4. Neu khong hop le, hien blocker va khong tao session.
5. Neu hop le, tao session bang `createPlayableSession`.

Playable session gom:

- `grid`
- `layer`: merged layer dung de choi.
- `grassCells`
- `priorityPoints`
- `fruitLayers`: snapshot tat ca layer fruit.
- `activeFruitLayerIndex`
- `snake.body`
- `trays`: runtime tray, gom delivered count va active tray layer.
- `remainingFruits`
- `mode`: `continuous` hoac `step`
- `speed`
- `status`

Khi nguoi choi chon huong:

1. `chooseDirection(direction)` chi chap nhan khi status la `READY` hoac `WAITING`.
2. Kiem tra huong hop le bang `availableDirections`.
3. Goi `movePlayableSession`.
4. Neu gap fruit, snake them cargo va xoa fruit khoi layer runtime.
5. Neu layer fruit hien tai het fruit, `advanceFruitLayerIfCleared` chuyen sang layer tiep theo.
6. Neu dau ran dung checkpoint tray, bat dau delivery.
7. Neu dang continuous mode va khong gap PriorityPoint/nga re can input, timer tu tiep tuc di chuyen.

Khi delivery:

1. `beginCheckpointDelivery` chon tray tai checkpoint.
2. `deliverNextCargo` tim cargo dau tien phu hop recipe layer dang active cua tray.
3. Cargo duoc xoa khoi than ran.
4. Counter delivered cua tray layer tang len.
5. Khi layer tray du recipe, tray chuyen sang layer tiep theo.
6. Khi delivery xong, status ve `WAITING`, `WON` hoac `LOST`.

Dieu kien win:

- Tat ca fruit layer da clear.
- Tat ca tray da hoan thanh moi layer recipe.

Dieu kien lose:

- Khong con huong di hop le.
- Bi chan tai PriorityPoint/nga re/ngoc cut tuy mode va trang thai than ran.

Playable la snapshot doc lap, nen viec choi khong mutate state editor goc.

## 16. Luong Undo/Redo

Undo/redo duoc quan ly boi `HistoryManager` thong qua `EditorState`.

- Moi `mutate()` binh thuong tao mot snapshot undo.
- Khi drag tren grid, `beginTransaction()` tao mot snapshot duy nhat truoc stroke.
- Cac cell duoc thay doi trong stroke khong tao them snapshot rieng.
- `endTransaction()` ket thuc stroke.
- `undo()` va `redo()` replace state bang snapshot tu history va emit `change`.

Trong `app.js`, click Undo/Redo cung danh dau `fileDirty = true` vi noi dung file hien tai da khac ban tren dia.

## 17. Luong Persist Local

Editor tu luu state vao `localStorage` trong `persist()`.

Moi `renderAll()` se goi:

```js
localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeEditorState(editor.data)));
```

Du lieu luu local la editor state day du, khac voi JSON export game format. Khi mo lai editor, `loadSavedState()` uu tien `STORAGE_KEY`, sau do thu cac key cu trong `LEGACY_STORAGE_KEYS`.

## 18. Quy Tac Du Lieu Can Nho

- Index export/import la zero-based row-major: `index = y * width + x`.
- `Path.index`, `Grass.index`, `PriorityPoint.index` la bat buoc trong format moi.
- Path va Grass khong duoc trung.
- PriorityPoint phai nam tren Path.
- Fruit chi nam trong fruit layer, khong nam trong `sharedCells`.
- Snake, tray, truck, element va Path nam trong `sharedCells`.
- Tray co hai vi tri:
  - `deliverPoint`: checkpoint tren Path, noi ran dung de giao hang.
  - `trayPosition`: o visual lien ke checkpoint, phai trong.
- Moi tray layer co capacity 9.
- Tong fruit tren map phai khop tong recipe cua tray de export/playable hop le.

## 19. Khi Muon Sua Tinh Nang Nen Bat Dau Tu Dau

- Sua hanh vi click/drag grid: bat dau tu `js/app.js` callback `InputController`, sau do xem `js/editor/object-placement.js`.
- Sua cach ve grid: xem `js/editor/grid-renderer.js`.
- Sua state, undo/redo: xem `js/core/editor-state.js` va `js/core/history-manager.js`.
- Sua import/export JSON: xem `js/data/serializer.js`.
- Sua rule hop le level: xem `js/data/validator.js`.
- Sua UI khay/recipe: xem `js/ui/tray-editor.js`.
- Sua logic choi playable: xem `js/gameplay/playable-controller.js`.
- Sua quy doi index/toa do, merged layer, PriorityPoint auto: xem `js/utils/grid-utils.js`.

