# Block Turnpoint & Natural Layer Budget Plan

## Source Logic

- Auto Generator khong sinh Block tai index la diem re huong cua Path.
- Diem re huong gom junction 3/4 connection va corner 2 connection khong doi dien.
- Duong thang 2 connection doi dien van la valid item cell neu khong bi rule cam khac chan.
- Chia tong item vao cac AUTO layer khong bat buoc bang nhau tuyet doi.
- Budget layer duoc tao bang weight co jitter theo seed de co chenh lech nhe, van giu tong quota item va khong vuot capacity tung layer.
- Neu random/rounding tao ra tat ca layer bang nhau trong khi co the chenh lech, generator dich 1 item giua hai layer de tao phan bo tu nhien.
- Locked layer giu nguyen, logic budget chi ap dung cho AUTO layer.

## Change History

- 2026-08-20: Loai turnpoint khoi valid item cell cho Auto Generator va thay chia budget layer bang weighted jitter deterministic theo seed.
