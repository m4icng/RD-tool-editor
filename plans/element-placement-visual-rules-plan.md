# Railway Dash Level Des - Element Placement & Visual Rules Plan

## Source Logic

Bridge, Gate va Tunnel phai chan placement sai ngay khi GD dat Element.

- Bridge chi duoc dat tai nga 4 co du Up / Down / Left / Right.
- Bridge visual luon Horizontal, footprint 3x1, `bridgeElement.index` la center.
- Bridge JSON giu nguyen `{ index, axis }`; khong them index trai/phai, khong migration data.
- Item Block khong duoc nam trong 3 cell visual Bridge.
- Gate chi duoc dat tren Path ngay truoc PriorityPoint lien ke.
- Gate direction tu dong huong ve PriorityPoint.
- Tunnel Point chi duoc dat tai Dead End co dung 1 Path connection.
- Tunnel direction tu dong huong ve Path connection duy nhat.
- Path edit sau placement khong tu xoa, move hay sua data Bridge/Gate/Tunnel; chi Level Check danh dau Invalid.
- Validation chi canh bao/bao loi, khong block Save.

## Current Implementation Scope

- Them module rule chung `js/objects/element-placement-rules.js`.
- Bridge placement check nga 4, boundary 3x1 va Item Block overlap.
- Bridge render editor thanh visual 3 cell ngang tu center index, khong doi JSON Bridge.
- Gate placement auto detect PriorityPoint lien ke va auto set direction.
- Tunnel placement auto detect Dead End va auto set direction cho Point A/B, khong can direction picker khi tao moi.
- Fruit placement bi chan neu index nam trong footprint Bridge 3x1.
- Path delete/toggle khong xoa Tunnel da dat; Gate/Bridge data cung duoc giu de validator danh dau invalid.
- Level Check bo sung rule Bridge/Gate/Tunnel theo plan.
- Serializer giu Tunnel invalid khi save/export; import Gate/Tunnel invalid khong bi reject chi vi thieu Path.
- Grid hover khi cam Bridge/Gate/Tunnel hien valid/invalid placement bang highlight va tooltip ly do.

## Change History

- 2026-08-19: Tao plan Element Placement & Visual Rules cho Bridge/Gate/Tunnel.
- 2026-08-19: Implement placement blocking, auto direction, Bridge footprint visual 3x1 va Level Check invalid rules.
- 2026-08-19: Cap nhat Bridge visual thanh glyph `🟰` khong border/background, render tai center va scale ngang phu 3 o index.
- 2026-08-19: Doi Bridge visual sang 3 glyph `🟰` ghep lien trong container 3 cell, neo tam tai `bridgeElement.index`, khong dung scaleX.
