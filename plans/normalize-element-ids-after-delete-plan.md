# Railway Dash Editor — Normalize Element IDs After Delete Plan

## 1. Goal

Update rule quản lý ID của các Element dạng group trong Level JSON.

Mục tiêu:

- Sau khi xóa một Element group, toàn bộ ID còn lại phải được normalize lại liên tục.
- ID luôn theo thứ tự:

```text
0 → 1 → 2 → 3 → ... → n-1
```

- Không giữ gap sau khi xóa.
- Không tiếp tục dùng bộ đếm `nextId` tăng vô hạn.
- ID mới luôn dựa trên số group hiện có sau normalize.
- Áp dụng thống nhất cho các Element dùng group ID.

---

## 2. Element áp dụng

Rule này áp dụng cho các Element có ID dạng group:

```text
tunnelId
oneWayId
barrierId
```

Và các Element tương lai nếu có cùng kiểu:

```text
groupId
pairId
segmentId
```

Không áp dụng cho các field chỉ là index của Map Cell.

---

## 3. Rule ID mới

ID của Element group luôn phải liên tục.

Valid:

```text
0
1
2
3
```

Invalid:

```text
0
2
5
```

Sau bất kỳ thao tác thay đổi cấu trúc group, cần normalize về:

```text
0
1
2
```

---

## 4. Example — Tunnel

Before:

```json
"tunnelElement": [
  {
    "tunnelId": 0,
    "entryPoints": [...]
  },
  {
    "tunnelId": 1,
    "entryPoints": [...]
  },
  {
    "tunnelId": 2,
    "entryPoints": [...]
  },
  {
    "tunnelId": 3,
    "entryPoints": [...]
  }
]
```

Designer xóa:

```text
tunnelId = 1
```

Không được giữ:

```text
0, 2, 3
```

Phải normalize thành:

```text
0, 1, 2
```

Mapping:

```text
old 0 → new 0
old 2 → new 1
old 3 → new 2
```

---

## 5. Example — One Way

Before:

```json
"oneWayElement": [
  {
    "oneWayId": 0,
    "entryPoints": [...]
  },
  {
    "oneWayId": 1,
    "entryPoints": [...]
  },
  {
    "oneWayId": 2,
    "entryPoints": [...]
  }
]
```

Xóa:

```text
oneWayId = 0
```

After:

```text
old 1 → new 0
old 2 → new 1
```

Final:

```json
"oneWayElement": [
  {
    "oneWayId": 0,
    "entryPoints": [...]
  },
  {
    "oneWayId": 1,
    "entryPoints": [...]
  }
]
```

---

## 6. Example — Count Barrier

Before:

```json
"countBarrierElement": [
  {
    "barrierId": 0,
    "count": 2,
    "startIndex": 233,
    "endIndex": 304,
    "index": [...]
  },
  {
    "barrierId": 1,
    "count": 3,
    "startIndex": 120,
    "endIndex": 160,
    "index": [...]
  },
  {
    "barrierId": 2,
    "count": 1,
    "startIndex": 90,
    "endIndex": 110,
    "index": [...]
  }
]
```

Xóa:

```text
barrierId = 1
```

After normalize:

```text
old 0 → new 0
old 2 → new 1
```

Final:

```json
"countBarrierElement": [
  {
    "barrierId": 0,
    "count": 2,
    "startIndex": 233,
    "endIndex": 304,
    "index": [...]
  },
  {
    "barrierId": 1,
    "count": 1,
    "startIndex": 90,
    "endIndex": 110,
    "index": [...]
  }
]
```

---

## 7. Re-index theo Group, không theo Entry Point

Đây là rule bắt buộc.

Tunnel và OneWay có cấu trúc:

```text
Group
→ entryPoints[]
```

Re-index phải làm theo Group.

Ví dụ:

```text
Tunnel Group old ID 3
```

có:

```text
entryPoint A
entryPoint B
```

Nếu remap:

```text
old 3 → new 2
```

thì cả group phải thành:

```text
tunnelId = 2
```

Không re-index từng entry point độc lập.

---

## 8. Delete Flow mới

Flow:

```text
User Delete Element Group
↓
Remove đúng Group cần xóa
↓
Normalize Element IDs
↓
Build oldId → newId mapping
↓
Update toàn bộ reference liên quan
↓
Refresh Editor State
↓
Refresh Inspector
↓
Refresh Map Visual
↓
Update Validation
↓
Update JSON
```

---

## 9. Normalize Function

Recommended tạo helper dùng chung:

```text
normalizeElementIds(elementArray, idField)
```

Concept:

```text
Read current groups
↓
Sort theo current ID hoặc preserve group order
↓
Assign:
group[0].id = 0
group[1].id = 1
group[2].id = 2
...
↓
Return oldId → newId mapping
```

---

## 10. Không dùng nextId tăng vô hạn

Logic cũ dạng:

```text
nextBarrierId++
nextTunnelId++
nextOneWayId++
```

không nên dùng làm source-of-truth sau Delete.

Thay bằng:

```text
newId = currentGroupCount
```

sau khi data đã normalize.

Ví dụ hiện có:

```text
0, 1, 2
```

thì Element mới:

```text
id = 3
```

Nếu xóa ID1:

```text
0, 2
```

normalize thành:

```text
0, 1
```

Element mới tiếp theo:

```text
id = 2
```

---

## 11. Create New Element Rule

Trước khi tạo group mới:

```text
Normalize IDs
↓
newId = currentGroupCount
```

Ví dụ:

```text
Current Groups = 4
```

ID mới:

```text
4
```

Không cần đọc `maxId + 1` nếu data đã được normalize.

---

## 12. Import Rule

Khi Import JSON:

Có thể gặp data cũ:

```text
0
2
5
```

Recommended:

```text
Import
↓
Validate
↓
Normalize ID
```

Final Editor State:

```text
0
1
2
```

Nếu cần debug migration:

có thể log:

```text
ELEMENT_ID_NORMALIZED

Tunnel:
0 → 0
2 → 1
5 → 2
```

Không cần thay đổi JSON schema.

---

## 13. Duplicate Rule

Khi Duplicate một Element group:

```text
Normalize current IDs
↓
Clone source group
↓
newId = currentGroupCount
↓
Append clone
```

Ví dụ:

```text
0,1,2
```

Duplicate ID1:

→ clone mới:

```text
ID3
```

Final:

```text
0,1,2,3
```

---

## 14. Undo / Redo

Normalize ID phải nằm trong cùng transaction với Delete / Duplicate.

Ví dụ Delete:

```text
Before:
0,1,2,3

Delete 1

After:
0,1,2
```

Undo phải restore chính xác:

```text
0,1,2,3
```

và restore đúng group data tương ứng.

Không tạo một Undo transaction riêng chỉ cho normalize.

---

## 15. Reference Update

Nếu trong Editor Runtime có reference theo group ID như:

```text
activeTunnelId
selectedTunnelId
activeOneWayId
selectedBarrierId
```

thì sau normalize phải remap theo:

```text
oldId → newId
```

Ví dụ:

```text
selectedTunnelId = 3
```

mapping:

```text
3 → 2
```

sau normalize:

```text
selectedTunnelId = 2
```

Nếu selected ID chính là group vừa bị xóa:

```text
selectedTunnelId = null
```

---

## 16. Không remap Map Index

Chỉ remap group ID.

Không thay đổi:

```text
entryPoints[].index
startIndex
endIndex
index[]
direction
axis
count
```

Ví dụ Count Barrier:

```text
barrierId
```

được remap.

Nhưng:

```text
startIndex
endIndex
index[]
```

giữ nguyên.

---

## 17. JSON Output Rule

Trước Save / Export nên đảm bảo:

```text
normalizeAllElementIds()
```

đã được chạy hoặc state đã luôn normalized.

Expected JSON:

```text
Tunnel IDs:
0,1,2,...

OneWay IDs:
0,1,2,...

Barrier IDs:
0,1,2,...
```

Không export gap.

---

## 18. Validation

Bổ sung validation:

```text
ELEMENT_ID_SEQUENCE_INVALID
```

Trigger nếu phát hiện:

```text
0,2,3
```

Expected:

```text
0,1,2
```

Editor có thể auto-normalize trước Save.

Nếu không auto-normalize vì lý do debug, Validation phải báo rõ.

---

## 19. Normalize Timing

Recommended normalize ngay sau các thao tác:

```text
Delete
Import
Duplicate
Restore
Undo
Redo
```

Và verify thêm trước:

```text
Save
Export
```

Mục tiêu:

Editor State gần như luôn ở trạng thái normalized.

---

## 20. Shared LevelState

Sau normalize phải update trực tiếp:

```text
LevelState
```

Các tab khác đọc cùng data mới.

Không giữ:

```text
displayId
```

khác với:

```text
jsonId
```

ID hiển thị và ID JSON phải là một.

---

## 21. UI Refresh

Sau Delete + Normalize:

- Refresh label ID.
- Refresh Inspector.
- Refresh pair color nếu visual phụ thuộc ID.
- Refresh active group selector.
- Refresh Debug Data.
- Refresh Validation.

Ví dụ trước:

```text
Tunnel 0
Tunnel 1
Tunnel 2
Tunnel 3
```

xóa Tunnel 1.

UI sau:

```text
Tunnel 0
Tunnel 1
Tunnel 2
```

Không hiển thị:

```text
Tunnel 0
Tunnel 2
Tunnel 3
```

---

## 22. Pair Visual Color

Nếu Tunnel / OneWay đang dùng color theo ID để phân biệt pair:

```text
color = palette[id % palette.length]
```

sau normalize cần refresh visual color theo ID mới.

Ví dụ:

```text
old Tunnel 3
→ new Tunnel 2
```

visual pair color phải update theo ID2.

Data gameplay không đổi ngoài group ID.

---

## 23. Atomic Operation

Delete + Normalize + Reference Remap phải là một operation atomic.

Không để UI có frame trung gian:

```text
0,2,3
```

rồi mới thành:

```text
0,1,2
```

Recommended:

```text
clone current state
↓
apply delete
↓
normalize clone
↓
commit state một lần
```

Giúp tránh component khác đọc state chưa normalize.

---

## 24. Generic Normalization API

Recommended:

```text
normalizeGroupedElementIds({
    collection,
    idField,
    selectedId,
    activeId
})
```

Return:

```text
{
    normalizedCollection,
    idMap,
    normalizedSelectedId,
    normalizedActiveId
}
```

Có thể reuse cho:

```text
Tunnel
OneWay
CountBarrier
```

---

## 25. Không phụ thuộc Array Position nếu chưa Normalize

Trước normalize không được giả định:

```text
arrayIndex === groupId
```

Sau normalize có thể đạt:

```text
array[0].id = 0
array[1].id = 1
...
```

nhưng code nên vẫn đọc field ID rõ ràng để tránh coupling mạnh.

---

## 26. Performance

Gọi:

```text
N = số Element Group
```

Nếu collection đã giữ theo thứ tự:

```text
O(N)
```

Có thể remap trực tiếp theo array order.

Nếu cần sort:

```text
O(N log N)
```

Với số Element của một Level hiện tại chi phí không đáng kể.

Recommended:

- preserve array order
- normalize theo array order
- tránh sort nếu không cần

→ `O(N)`.

---

## 27. Test Cases

### TC01 — Delete Middle ID

Before:

```text
0,1,2,3
```

Delete:

```text
1
```

Expected:

```text
0,1,2
```

Mapping:

```text
0→0
2→1
3→2
```

---

### TC02 — Delete First ID

Before:

```text
0,1,2
```

Delete:

```text
0
```

Expected:

```text
0,1
```

Mapping:

```text
1→0
2→1
```

---

### TC03 — Delete Last ID

Before:

```text
0,1,2
```

Delete:

```text
2
```

Expected:

```text
0,1
```

Không cần remap group trước đó.

---

### TC04 — Delete All

Before:

```text
0,1,2
```

Delete toàn bộ.

Expected:

```text
[]
```

Element mới tiếp theo:

```text
ID0
```

---

### TC05 — Add sau Delete

Before:

```text
0,1,2
```

Delete ID1.

Normalize:

```text
0,1
```

Add New.

Expected:

```text
0,1,2
```

---

### TC06 — Tunnel Pair

Tunnel ID2 có 2 entry point.

Sau normalize:

```text
old 2 → new 1
```

Expected:

- group ID = 1
- cả 2 entry point vẫn thuộc cùng group
- index/direction giữ nguyên

---

### TC07 — OneWay Pair

Same rule như Tunnel.

---

### TC08 — Count Barrier

Remap chỉ:

```text
barrierId
```

Không thay:

```text
count
startIndex
endIndex
index[]
```

---

### TC09 — Import Gap

Import:

```text
0,3,7
```

Expected normalized:

```text
0,1,2
```

---

### TC10 — Undo

Before:

```text
0,1,2
```

Delete ID1.

After:

```text
0,1
```

Undo.

Expected:

```text
0,1,2
```

với đúng group data ban đầu.

---

## 28. Definition of Done

- Tunnel ID luôn liên tục từ 0.
- OneWay ID luôn liên tục từ 0.
- Barrier ID luôn liên tục từ 0.
- Xóa group sẽ normalize các ID còn lại.
- Không giữ gap ID.
- Không dùng nextId tăng vô hạn làm source-of-truth.
- ID mới = số group hiện tại sau normalize.
- Pair Element được normalize theo group, không theo entry point.
- Map index không bị thay đổi.
- Direction không bị thay đổi.
- Count Barrier data khác không bị thay đổi.
- Selected/Active ID được remap đúng.
- Xóa selected group sẽ reset selection hợp lý.
- Duplicate dùng ID tiếp theo đúng sequence.
- Import data gap được normalize.
- Undo/Redo giữ đúng sequence và data.
- Save/Export không xuất gap ID.
- Delete + Normalize là một Undo Transaction.
- Không thay đổi JSON schema.
- Complexity mục tiêu `O(N)`.

---

## Change History

### 2026-08-21 — Normalize group element IDs

- Added shared grouped element ID normalization helper.
- Updated Tunnel, One Way, and Count Barrier group IDs to normalize by group order after delete/import/save.
- Updated new group ID rule to use current normalized group count.
- Added active/drawing/draft ID remap during state normalization and delete flows.
- Added `ELEMENT_ID_SEQUENCE_INVALID` validation message for stale gap IDs.
