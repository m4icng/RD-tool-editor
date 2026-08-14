---
# BẢN THẢO BRAINSTORM: Tab Playable màn chơi
**Ngày:** 2026-08-12
**Trạng thái:** 🟢 Hoàn tất tra khảo

## 1. Tóm tắt & Quyết định cốt lõi

- Tạo thêm một tab riêng để chơi thử level đang thiết kế.
- Play mode sử dụng trực tiếp dữ liệu level hiện tại nhưng không sửa dữ liệu editor.
- Có thể tái sử dụng logic movement, collision, collection, delivery và win-condition hiện có sau khi điều chỉnh theo schema khay mới.
- Rắn di chuyển liên tục trên đường.
- Khi tới điểm lựa chọn ở ngã rẽ, rắn dừng và chờ người chơi chọn hướng lên/xuống/trái/phải rồi mới tiếp tục.
- Rắn dừng tại mọi ô cần đổi hướng, kể cả góc cua hai nhánh; đoạn thẳng tự động tiếp tục.
- Cho phép quay đầu 180° khi rắn chỉ có đầu; khóa hướng ngược khi rắn đang kéo theo hàng/đuôi.
- Trái cây được thu biến mất khỏi map và nối ngay vào cuối hàng; mỗi đốt đuôi giữ loại fruit và thứ tự thu thập.
- Khi đầu rắn chạm khay, khay tự lấy mọi trái cây trong hàng phù hợp với phần còn thiếu của layer hiện tại, không phụ thuộc vị trí; các trái không được lấy giữ nguyên thứ tự tương đối.
- Khi bắt đầu lượt chơi, rắn đứng yên tại điểm xuất phát và chờ người chơi chọn một hướng hợp lệ; sau đó mới di chuyển liên tục.
- Playable có ba mức tốc độ: Chậm `2 ô/giây`, Thường `4 ô/giây`, Nhanh `6 ô/giây`; mặc định là Thường và lựa chọn này không sửa dữ liệu level.
- Người chơi thua khi đầu rắn đâm vật cản, đâm vào hàng của chính mình, hoặc đến ngõ cụt mà không còn hướng hợp lệ; input hướng không hợp lệ chỉ bị bỏ qua.
- Người chơi thắng ngay khi tất cả layer của mọi khay chứa đã nhận đủ recipe.
- Khi rời tab Playable, phiên chơi tự pause và giữ nguyên snapshot; chỉnh sửa editor chỉ được nạp vào phiên sau khi Restart.
- Playable chỉ khởi tạo khi level hợp lệ; nếu không, hiển thị danh sách lỗi cụ thể và không tự sửa snapshot.
- Tab Playable dùng map lớn làm khu vực chính; HUD bên phải hiển thị tiến độ khay/layer, hàng đang kéo, tốc độ, Pause và Restart; công cụ chỉnh sửa được ẩn.
- Tab Simulator hiện tại được gộp thành Playable; trong tab có công tắc giữa chế độ chơi liên tục và mô phỏng từng bước.
- Điều khiển hướng hỗ trợ `WASD`, phím mũi tên và thao tác vuốt chuột sang trái/phải/lên/xuống trên map.
- Input hướng chỉ được nhận khi rắn đã dừng tại decision point; input nhập trong lúc rắn đang chạy bị bỏ qua và không được buffer.
- Pause/Resume chỉ được điều khiển bằng nút trên HUD; khi pause, input hướng bị bỏ qua.
- HUD luôn có nút Restart; khi thua, Playable hiển thị hộp thoại hỏi người chơi có muốn chơi lại.
- Hộp thoại thua có hai lựa chọn: `Chơi lại` để tạo lượt mới và `Về Editor` để đóng phiên chơi.

## 2. Sơ đồ Logic / Core Mechanics / Bảng số

```text
Editor State
    ↓ snapshot + validate
Play Session
    ↓ input/tick
Snake Movement → Collision → Fruit Collection → Tray Delivery/Queue → Win/Lose
    ↓
Restart / Exit Play (editor state không đổi)
```

## 3. Nhật ký Hỏi Đáp (Q&A Log)

| # | Câu hỏi | Câu trả lời | Quyết định chốt |
|---|---|---|---|
| 1 | Người chơi điều khiển rắn theo mô hình nào? | Di chuyển liên tục; tới điểm ở ngã rẽ thì đợi user chọn hướng lên/xuống/trái/phải. | Runtime tự chạy giữa các decision point và pause tại decision point để nhận hướng. |
| 2 | Những ô nào là điểm phải dừng chọn hướng? | Option B. | Dừng tại mọi ô cần đổi hướng, kể cả corner hai nhánh; straight segment không dừng. |
| 3 | Có được quay đầu 180° tại điểm dừng không? | Chỉ khi rắn đang có đầu; nếu đang kéo theo hàng/có đuôi thì không. | Reverse hợp lệ khi body length = 1 và bị khóa khi body length > 1. |
| 4 | Trái cây gia nhập hàng thế nào? | Option A. | Fruit nối vào cuối hàng dưới dạng typed tail segment; queue order là collection order. |
| 5 | Khi đầu rắn chạm khay, khay nhận trái cây trong hàng theo quy tắc nào? | Option B. | Khay quét toàn bộ hàng và lấy các fruit phù hợp với phần recipe còn thiếu; thứ tự trong hàng không chặn giao hàng. |
| 6 | Rắn khởi hành như thế nào khi bắt đầu lượt chơi? | Option A. | Đứng yên tại spawn và chờ input hướng hợp lệ đầu tiên; không cần lưu hướng xuất phát trong level. |
| 7 | Tốc độ di chuyển trong Playable được thiết lập thế nào? | Option B. | Có ba mức 2/4/6 ô mỗi giây, mặc định 4; đây là setting của play session. |
| 8 | Điều kiện thua trong Playable là gì? | Option B. | Thua do va chạm vật cản, tự va chạm hoặc bị kẹt tại ngõ cụt; input sai không gây thua. |
| 9 | Điều kiện thắng màn chơi là gì? | Option A. | Thắng ngay khi toàn bộ layer của mọi khay hoàn thành recipe. |
| 10 | Khi rời tab Playable, phiên chơi được xử lý thế nào? | Option B. | Tự pause và giữ trạng thái; thay đổi editor chỉ áp dụng sau Restart. |
| 11 | Level không hợp lệ khi mở Playable được xử lý thế nào? | Option A. | Chặn tạo phiên và hiển thị lỗi validator cụ thể; không auto-repair. |
| 12 | Bố cục tab Playable được tổ chức thế nào? | Option A. | Map lớn ở khu vực chính, runtime HUD bên phải và ẩn editor tools. |
| 13 | Quan hệ giữa Simulator hiện tại và Playable mới là gì? | Option C. | Gộp thành một tab Playable với hai chế độ Continuous Play và Step Simulation. |
| 14 | Người chơi chọn hướng bằng những cách nào? | WASD, phím mũi tên và chuột lướt sang các phía. | Chuẩn hóa ba nguồn input thành bốn lệnh hướng dùng chung; mouse swipe chỉ hoạt động trên map Playable. |
| 15 | Input nhập sớm khi rắn còn đang chạy được xử lý thế nào? | Option A. | Chỉ nhận hướng khi rắn đã dừng; không input buffer hoặc command queue. |
| 16 | Pause/Resume trực tiếp trong Playable được điều khiển thế nào? | Option B. | Chỉ dùng nút HUD; không có keyboard shortcut và không nhận input hướng khi pause. |
| 17 | Restart cần xuất hiện khi nào? | Có thêm nút và hỏi khi thua. | Luôn có nút Restart trên HUD và mở lose prompt sau khi thua. |
| 18 | Hộp thoại sau khi thua có lựa chọn nào? | Option A. | Có `Chơi lại` và `Về Editor`. |

## 4. Đặc tả triển khai đã chốt

### Runtime và dữ liệu

- Playable chạy trên snapshot tách biệt với editor state.
- Mỗi vị trí khay xử lý layer đầu tiên chưa hoàn thành trong queue độc lập của chính nó; layer đủ `9` tự chuyển sang layer kế tiếp.
- Khi khay nhận fruit, hệ thống quét toàn bộ hàng, lấy các loại còn thiếu và tự khép các đốt còn lại nhưng giữ nguyên thứ tự tương đối.
- Restart lấy snapshot mới nhất từ editor; rời tab chỉ pause và không âm thầm đồng bộ vào phiên đang chạy.

### Movement và input

- State machine tối thiểu: `READY`, `MOVING`, `WAITING_DIRECTION`, `PAUSED`, `WON`, `LOST`.
- Chỉ nhận `WASD`, phím mũi tên hoặc mouse swipe khi ở `READY`/`WAITING_DIRECTION`.
- Rắn tự chạy trên đoạn thẳng; dừng ở mọi ô phải chọn hoặc đổi hướng.
- Reverse chỉ hợp lệ khi không có đốt hàng; va chạm và ngõ cụt áp dụng luật thua đã chốt.

### UI

- Gộp Simulator thành tab Playable với hai chế độ `Chơi liên tục` và `Từng bước`.
- Map là vùng chính; HUD bên phải chứa tiến độ khay/layer, hàng đang kéo, tốc độ 2/4/6 ô mỗi giây, Pause/Resume và Restart.
- Khi level invalid, thay runtime bằng danh sách lỗi có khả năng dẫn người dùng về editor để sửa.
- Khi thắng hoặc thua, runtime dừng hoàn toàn; khi thua hiển thị `Chơi lại` và `Về Editor`.

## 5. [OPEN FLAGS]

Không còn điểm thiết kế bắt buộc nào chưa được xác nhận. Chi tiết hình ảnh, spacing và animation có thể kế thừa design system hiện tại khi triển khai.

## 6. Kết quả cuối phiên

Đã đủ thông tin để cập nhật tài liệu kỹ thuật, triển khai tab Playable và viết test cho movement state machine, delivery recipe mix, win/lose và snapshot isolation.

## 7. Trạng thái triển khai (2026-08-12)

- Đã thay nút `Simulator` bằng tab `Playable` thực sự; tab có workspace riêng thay vì tiếp tục hiển thị Level Design.
- Đã thêm map snapshot và HUD bên phải gồm mode Continuous/Step, tốc độ 2/4/6, Pause/Resume, Restart, hàng đang kéo và tiến độ khay.
- Level invalid vẫn mở được tab để xem map và danh sách lỗi; runtime/input chỉ được bật khi snapshot hợp lệ.
- Đã nối state `READY`, `MOVING`, `WAITING`, `PAUSED`, `WON`, `LOST`, keyboard WASD/mũi tên và mouse swipe.
- Đã hỗ trợ recipe mix, fruit typed-tail, giao các fruit phù hợp không phụ thuộc thứ tự và khép lại hàng sau khi giao.
- Chuyển khỏi Playable tự pause phiên; Restart lấy snapshot mới nhất từ editor.
- Đã bổ sung cache version cho CSS/JS để trình duyệt không giữ giao diện Simulator cũ sau build.
---
