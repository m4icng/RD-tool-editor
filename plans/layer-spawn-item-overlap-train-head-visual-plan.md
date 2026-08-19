# Railway Dash Playable - Layer Spawn Delay + Item Overlap + Train Head Visual Plan

## Source Logic

- Khi Head collect item cuối của layer hiện tại, runtime mark layer clear nhưng không spawn layer tiếp theo ngay.
- Nếu còn layer tiếp theo, runtime vào trạng thái `WaitingNextLayerSpawn` bằng cờ session và train vẫn tiếp tục gameplay bình thường.
- Layer tiếp theo chỉ spawn khi Head đi tới `PriorityPoint` hoặc `DeliveryPoint`; tail/block trên thân không trigger.
- Mỗi layer chỉ spawn đúng một lần; layer cuối không tạo waiting state thừa.
- Item layer mới spawn trùng Head/Tail/Block không đổi `item.index`, không bị xóa, không dời data sang index khác.
- Item overlap chỉ có visual offset tạm thời khoảng 0.3-0.4 cell và tự restore khi train rời khỏi index đó.
- Item spawn dưới Head không auto collect trong cùng frame spawn; chỉ collect ở movement/check tiếp theo.
- Train Head trong Playable dùng icon `🚂`, không border/frame/background, visual size `1.3x` cell và vẫn anchor center cell.
- Gameplay footprint của Head vẫn là 1 grid index; không đổi collision, trigger, movement, path hay level JSON.

## Current Implementation Scope

- Thêm module `js/gameplay/layer-spawn-runtime.js` để quản lý waiting spawn, occupied index map, temporary item offset và restore offset.
- Cập nhật `js/gameplay/playable-controller.js` để đổi flow clear layer thành wait-trigger-spawn.
- PriorityPoint/DeliveryPoint chỉ trigger spawn từ vị trí Head sau khi move.
- Layer mới spawn được check overlap với train visible occupancy và ghi visual offset runtime theo từng item.
- Khi train rời index item đang offset, item tự restore về center.
- Cập nhật render playable để item offset nhận class tạm thời và Head render bằng `🚂` không frame, size 130%.
- Không thay đổi format level JSON.

## Change History

- 2026-08-19: Tạo plan riêng cho layer spawn delay, item overlap visual offset và Train Head visual.
- 2026-08-19: Thêm runtime waiting next layer spawn; bỏ auto spawn ngay sau khi clear layer.
- 2026-08-19: Spawn next layer khi Head tới PriorityPoint/DeliveryPoint và chặn collect item vừa spawn dưới Head trong cùng step.
- 2026-08-19: Thêm temporary visual offset cho item spawn trùng train và restore độc lập khi cell được giải phóng.
- 2026-08-19: Cập nhật visual Head playable `🚂` size 1.3x cell, không border/frame/background.
