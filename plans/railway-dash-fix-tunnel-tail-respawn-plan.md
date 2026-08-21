# Railway Dash — Fix Tunnel Tail Respawn Logic

## 1. Bug hiện tại

Sau khi Head teleport qua Tunnel:

```text
Head ra khỏi Tunnel
↓
System rebuild toàn bộ Tail
↓
Tail bị dựng thành một đường thẳng theo exitDirection
```

Ví dụ:

```text
Tunnel Exit → 🚂 ■ ■ ■ ■ ■ ■
```

Điều này sai vì:

- Toàn bộ Tail xuất hiện ngay lập tức.
- Tail bị dựng thành đường thẳng.
- Không follow đường mà Head thực tế vừa đi.
- Nếu Head vừa ra Tunnel rồi rẽ, Tail vẫn bị dựng thẳng.
- Visual không có cảm giác đoàn tàu đang lần lượt đi ra khỏi Tunnel.

---

## 2. Logic đúng

Khi Head đi vào Tunnel:

```text
Head enters Tunnel
↓
Teleport Head
↓
Toàn bộ Body / Item Body chuyển sang Hidden
↓
Không tạo position mới cho Tail
```

Khi Head xuất hiện tại cổng Tunnel bên kia:

```text
Tunnel Exit
🚂
```

Tail vẫn chưa xuất hiện.

Chỉ khi Head bắt đầu di chuyển khỏi cổng:

```text
Step 1

■ 🚂
↑
Tunnel Exit
```

Segment đầu tiên xuất hiện tại chính `Tunnel Exit`.

Head đi tiếp:

```text
Step 2

■ ■ 🚂
↑
Tunnel Exit
```

Head đi tiếp:

```text
Step 3

■ ■ ■ 🚂
↑
Tunnel Exit
```

Tail lần lượt đi ra khỏi Tunnel.

---

## 3. Điểm spawn Tail

Tail phải bắt đầu tại:

`exitPortalIndex`

Trong đó:

`exitPortalIndex`

là `entryPoint` của Tunnel pair nơi Head vừa xuất hiện sau teleport.

Không spawn Tail tại:

```text
headIndex - direction * tailLength
```

Không dựng Tail bằng:

```text
exitDirection
```

Không generate:

```text
exitIndex
exitIndex - direction
exitIndex - direction * 2
...
```

---

## 4. Sử dụng Head Trail

Sau khi Head ra khỏi Tunnel cần tạo một trail mới:

```text
postTunnelTrail
```

Ban đầu:

```text
postTunnelTrail = [
    exitPortalIndex
]
```

Ví dụ:

```text
Head Exit:
E
```

Trail:

```text
[E]
```

---

## 5. Mỗi bước Head cập nhật Trail

Nếu Head đi:

```text
E → A → B → C
```

Trail lần lượt:

```text
Exit:
[E]

Step 1:
[A, E]

Step 2:
[B, A, E]

Step 3:
[C, B, A, E]
```

Index đầu tiên luôn là vị trí Head hiện tại.

---

## 6. Body position lấy trực tiếp từ Trail

Với:

```text
segmentIndex = 0
```

là Body gần Head nhất.

Position:

```text
body[0] = trail[1]
body[1] = trail[2]
body[2] = trail[3]
...
```

Nếu:

```text
trail.length <= segmentIndex + 1
```

thì segment đó:

`Hidden`

---

## 7. Example hoàn chỉnh

Train trước Tunnel:

```text
🚂 A B C D
```

Có:

```text
4 Body Segment
```

Head teleport đến:

```text
E
```

State:

```text
Trail:
[E]

Visible:
🚂

Hidden:
A B C D
```

### Head move Step 1

```text
E → P1
```

Trail:

```text
[P1, E]
```

Render:

```text
E   P1
A   🚂
```

A xuất hiện tại Tunnel Exit.

B/C/D vẫn Hidden.

### Step 2

```text
P1 → P2
```

Trail:

```text
[P2, P1, E]
```

Render:

```text
E   P1   P2
B   A    🚂
```

### Step 3

Trail:

```text
[P3, P2, P1, E]
```

Render:

```text
E   P1   P2   P3
C   B    A    🚂
```

### Step 4

Trail:

```text
[P4, P3, P2, P1, E]
```

Render:

```text
E   P1   P2   P3   P4
D   C    B    A    🚂
```

Lúc này toàn bộ Tail đã ra khỏi Tunnel.

---

## 8. Quan trọng — Follow cả đường rẽ

Đây là lý do phải dùng Trail thay vì Direction.

Ví dụ Head ra Tunnel rồi đi:

```text
E ── A ── B
         │
         C
         │
         D
```

Tail phải follow:

```text
E ── ■ ── ■
         │
         ■
         │
         🚂
```

Không được dựng:

```text
E ── ■ ── ■ ── ■ ── 🚂
```

Tail phải follow chính xác từng `index` mà Head đã đi.

---

## 9. Runtime State đề xuất

Không thay đổi Level JSON.

Chỉ thêm runtime state:

```text
TunnelTransitState
{
    active

    tunnelId

    enterPortalIndex
    exitPortalIndex

    hiddenBodyCount

    postTunnelTrail[]

    fullyExited
}
```

Có thể không cần lưu `enterPortalIndex` nếu runtime khác đã có.

---

## 10. Khi Head Enter Tunnel

Flow:

```text
Head reaches Tunnel Entry
↓
Find paired Exit
↓
Save current body/item order
↓
Set all body segments Hidden
↓
Remove hidden body positions khỏi occupancy
↓
Teleport Head → exitPortalIndex
↓
Clear old body trail
↓
postTunnelTrail = [exitPortalIndex]
↓
TunnelTransit.active = true
```

Không rebuild Tail tại thời điểm này.

---

## 11. Khi Head vừa Exit Tunnel

Sau teleport:

```text
Head = exitPortalIndex
```

State phải là:

```text
Head visible
Body hidden
```

Không được gọi:

```text
rebuildTail()
```

Không gọi logic kiểu:

```text
buildStraightTailFromHead()
```

---

## 12. Khi Head Move sau Tunnel

Mỗi lần Head move từ:

```text
previousHeadIndex → newHeadIndex
```

Update:

```text
postTunnelTrail.unshift(newHeadIndex)
```

Sau đó render Body từ Trail.

Concept:

```text
for each segment i:

    trailIndex = i + 1

    if trailIndex < postTunnelTrail.length:
        segment.visible = true
        segment.index = postTunnelTrail[trailIndex]
    else:
        segment.visible = false
```

---

## 13. Không spawn toàn bộ Body cùng lúc

Cấm logic:

```text
for every body segment
    visible = true
```

ngay khi teleport kết thúc.

Visible Body Count phải bằng:

```text
min(
    bodyCount,
    postTunnelTrail.length - 1
)
```

Ví dụ:

```text
Body = 8

Head đã đi 3 Cell sau Tunnel

Visible Body = 3
Hidden Body = 5
```

---

## 14. Khi Tail ra hoàn toàn

Điều kiện:

```text
postTunnelTrail.length >= bodyCount + 1
```

Khi đó:

```text
TunnelTransit.active = false
TunnelTransit.fullyExited = true
```

Sau đó train quay về movement system bình thường.

Có thể trim trail về đúng:

```text
Head + BodyLength
```

để không tăng memory vô hạn.

---

## 15. Body Order phải giữ nguyên

Ví dụ trước Tunnel:

```text
Head
↓
Red
Blue
Green
Purple
```

Sau Tunnel vẫn phải:

```text
Head
↓
Red
Blue
Green
Purple
```

Không reverse body order.

Không sort theo ItemId.

Không rebuild lại Item list.

Tunnel chỉ thay đổi:

`Visual / Position State`

không thay đổi:

`Logical Carried Item Order`

---

## 16. Item mới được Collect khi Tail chưa ra hết

Logical Inventory và Visual Position phải tách nhau.

Nếu Head collect thêm Item khi đang có Tail hidden:

```text
Old Body:
A B C

Collect:
D
```

Order trở thành:

```text
A B C D
```

D nằm cuối train.

Nếu chưa đủ Trail để render D:

→ D tiếp tục Hidden.

Sau khi Head đi đủ xa:

→ D mới xuất hiện từ Tunnel Exit theo đúng thứ tự.

Không spawn D trực tiếp phía sau Head.

---

## 17. Item được Release khi Tail chưa ra hết

Tray logic vẫn dùng:

`Logical carried items`

không phụ thuộc segment đang Visible hay Hidden.

Nếu một Item Hidden được release:

→ remove nó khỏi logical body.

Sau đó renderer rebuild visible segment assignment dựa trên:

```text
currentBodyOrder
+
postTunnelTrail
```

Không để ghost segment tồn tại.

---

## 18. Collision trong Tunnel Transit

Hidden Body:

```text
không tham gia occupancy
không self-collision
```

Visible Body đã đi ra khỏi Tunnel:

```text
tham gia occupancy bình thường
```

Do đó occupancy phải chỉ chứa:

```text
Head
+
Visible Body
```

Không chứa Hidden Body.

---

## 19. Reverse / Dead End Rule

Trong lúc:

```text
TunnelTransit.active == true
```

không được dùng Hidden Tail để trigger:

```text
cannot reverse because train has tail
```

Chỉ tính Body đã thực sự visible nếu gameplay cần kiểm tra collision.

Giữ rule hiện tại:

Tunnel transition không được tạo false lose.

---

## 20. Tunnel Exit Direction

`direction` của Tunnel chỉ dùng để:

- xác định orientation cổng
- hỗ trợ visual/runtime portal direction

Sau khi Head ra Tunnel:

Movement tiếp theo phải dựa trên:

`Path thực tế`

Không dùng `Tunnel.direction` để dựng Tail.

Đây là nguyên nhân chính cần loại bỏ trong logic cũ.

---

## 21. Không dùng Linear Tail Reconstruction

Cần tìm và bỏ các logic dạng:

```text
for (i = 0; i < bodyLength; i++)
{
    index = exitIndex - directionVector * (i + 1);
}
```

hoặc:

```text
rebuildBodyFromDirection(exitDirection)
```

Tunnel không được dùng kiểu reconstruction này.

Thay bằng:

```text
Body Position
=
Recorded Head Trail
```

---

## 22. State Flow hoàn chỉnh

```text
NORMAL
↓
Head enters Tunnel
↓
ENTERING_TUNNEL
↓
Hide Body
↓
Teleport Head
↓
Head appears at Exit Portal
↓
TAIL_EMERGING
↓
Head moves 1 cell
→ reveal 1 body segment from Exit Portal
↓
Head moves again
→ move previous segment
→ reveal next segment from Exit Portal
↓
...
↓
All Body visible
↓
NORMAL
```

---

## 23. Recommended State Enum

```text
TrainMovementState

Normal
TunnelTeleport
TunnelTailEmerging
```

Không nên chỉ dùng:

```text
isTeleporting = true/false
```

vì cần phân biệt:

```text
Head đang teleport
```

với:

```text
Head đã ra nhưng Tail chưa ra hết
```

---

## 24. Important Difference

### TunnelTeleport

```text
Head chưa hoàn tất teleport
Body hidden
Input/movement đặc biệt
```

### TunnelTailEmerging

```text
Head đã gameplay bình thường
Body đang lần lượt xuất hiện
```

Hai phase khác nhau.

---

## 25. Rendering Rule

Renderer không tự suy luận vị trí Tail.

Simulation phải cung cấp:

```text
segment.visible
segment.index
```

Renderer chỉ:

```text
visible
→ render tại index

hidden
→ không render
```

Không để Renderer tự dựng Body theo `direction`.

---

## 26. Data Flow

```text
Train Runtime State
↓
Tunnel Transit Logic
↓
postTunnelTrail
↓
Body Position Resolver
↓
Collision Occupancy
↓
Renderer
```

Không:

```text
Renderer
↓
tự đoán Tail Position
```

---

## 27. Edge Case — Head đứng tại Exit

Nếu Head vừa teleport xong nhưng chưa move:

```text
postTunnelTrail = [exitPortal]
```

Expected:

```text
Visible Body = 0
```

Toàn bộ Body vẫn ở trong Tunnel.

Không spawn Body chồng lên Head.

---

## 28. Edge Case — Head rẽ ngay sau Exit

Ví dụ:

```text
Exit → Right → Down
```

Tail phải follow Trail.

Không tiếp tục Right theo exit direction.

---

## 29. Edge Case — Long Tail

Ví dụ:

```text
BodyLength = 20
```

Head phải đi đủ:

```text
20 Cell
```

để toàn bộ Body ra khỏi Tunnel.

Không spawn 20 segment cùng lúc.

---

## 30. Edge Case — Enter Tunnel khi Body rất dài

Khi Head enter:

Không cần lưu toàn bộ old body position để rebuild sau exit.

Chỉ cần giữ:

```text
Body logical order
Body payload/items
```

Old world positions có thể clear khỏi visible occupancy.

New position được tạo hoàn toàn từ:

`postTunnelTrail`

sau Exit.

---

## 31. Edge Case — Tunnel gần Corner

Nếu cổng thoát ngay trước Corner:

```text
Exit → Cell → Turn
```

Trail tự xử lý được.

Không cần special case.

Đây là ưu điểm chính của trail-based reconstruction.

---

## 32. Edge Case — Tunnel → PriorityPoint

Nếu Head ra Tunnel và đến PriorityPoint:

Các gameplay trigger vẫn xử lý theo Head bình thường.

Tail emergence không được:

- trigger PriorityPoint
- trigger Layer Spawn
- trigger Delivery

Chỉ Head trigger các logic đó theo rule hiện tại.

---

## 33. Complexity

Gọi:

```text
B = Body Length
```

Cách đơn giản update toàn body mỗi movement:

```text
O(B)
```

Với Railway Dash hiện tại thường vẫn rất nhẹ.

Nếu muốn tối ưu:

sử dụng:

```text
Deque / Ring Buffer
```

cho Head Trail.

Push movement:

```text
O(1)
```

Trim:

```text
O(1)
```

Body position lookup:

```text
O(1) / segment
```

Không cần pathfinding để rebuild Tail.

---

## 34. Recommended Implementation

Nên dùng:

```text
HeadTrail Ring Buffer
```

thay vì generate position từ direction.

Core:

```text
onTunnelExit(exitIndex):
    transit.active = true
    trail.clear()
    trail.pushFront(exitIndex)
    hideAllBody()

onHeadMoved(newIndex):
    trail.pushFront(newIndex)

    maxTrailLength = bodyCount + 1

    if trail.length > maxTrailLength:
        trail.popBack()

    resolveBodyFromTrail()

    if trail.length >= bodyCount + 1:
        transit.active = false
```

---

## 35. Body Resolve Concept

```text
resolveBodyFromTrail():

for i = 0 → bodyCount - 1:

    trailIndex = i + 1

    if trailIndex < trail.length:

        body[i].visible = true
        body[i].index = trail[trailIndex]

    else:

        body[i].visible = false
```

Không dùng Direction.

---

## 36. Test Cases

### TC01 — Tail 5, Straight Exit

Body = 5.

Head đi 1 Cell.

Expected:

```text
Visible = 1
Hidden = 4
```

Head đi 5 Cell.

Expected:

```text
Visible = 5
Hidden = 0
```

### TC02 — Exit rồi rẽ

Head:

```text
Exit → Right → Right → Down → Down
```

Expected:

Tail follow đúng chuỗi này.

Không dựng Horizontal line.

### TC03 — Head chưa move

Teleport hoàn tất.

Expected:

```text
Body Visible = 0
```

### TC04 — Long Tail

Body = 15.

Head move 4.

Expected:

```text
Visible = 4
Hidden = 11
```

### TC05 — Body Item Order

Before:

```text
Red
Blue
Green
Purple
```

After toàn bộ ra Tunnel:

```text
Red
Blue
Green
Purple
```

Order không đổi.

### TC06 — Collect khi emerging

Body = 4.

Head mới đi 2 Cell.

Collect thêm Yellow.

Expected:

Logical Body = 5.

Yellow nằm cuối queue.

Không spawn Yellow trực tiếp sau Head.

### TC07 — Collision

Hidden segment không collision.

Segment đã emerge collision bình thường.

### TC08 — Tunnel Exit Corner

Tail follow Head qua Corner chính xác.

### TC09 — PriorityPoint sau Tunnel

Head trigger PriorityPoint.

Tail không trigger.

### TC10 — Full Exit

Khi toàn bộ Tail đã visible:

Expected:

```text
TrainMovementState = Normal
```

Train tiếp tục sử dụng movement logic thông thường.

---

## 37. Definition of Done

- Head teleport qua Tunnel bình thường.
- Tail không xuất hiện toàn bộ ngay sau teleport.
- Tail không bị dựng thành một đường thẳng.
- Tail bắt đầu xuất hiện từ `exitPortalIndex`.
- Mỗi Cell Head di chuyển làm thêm một segment có khả năng xuất hiện.
- Body follow đúng Head Trail.
- Tail follow được Corner và Branch route thực tế.
- Không dùng `exitDirection` để rebuild Tail.
- Body Item Order giữ nguyên.
- Hidden Body không self-collision.
- Visible Body collision bình thường.
- Head chưa move sau Exit thì Body vẫn Hidden.
- Collect Item trong lúc emerging hoạt động đúng.
- Tray Release trong lúc emerging không tạo ghost Body.
- PriorityPoint/Delivery/Layer Spawn vẫn chỉ do Head trigger.
- Khi toàn bộ Body ra khỏi Tunnel thì chuyển về Normal State.
- Không thay đổi Tunnel JSON.
- Không cần thay đổi Level Data schema.
- Runtime xử lý dựa trên Head Trail thay vì linear reconstruction.

---

## 38. Change History

- 2026-08-21: Lưu plan vào repo theo chủ đề `railway-dash-fix-tunnel-tail-respawn-plan.md`.
- 2026-08-21: Thêm runtime `TunnelTransitState` dựa trên `postTunnelTrail` để Head teleport trước, Body ẩn và reveal dần từ `exitPortalIndex`.
- 2026-08-21: Bỏ logic rebuild Tail tuyến tính theo `exitDirection` trong simulator/playable, Body position lấy từ Head Trail.
- 2026-08-21: Đồng bộ collect/release khi Tail chưa ra hết để giữ logical body order và không tạo ghost segment.
