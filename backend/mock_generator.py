import base64
import hashlib
import math
import struct
import zlib


PALETTES = {
    "fire": ((239, 80, 45), (128, 31, 24), (255, 191, 76), (255, 122, 45)),
    "ice": ((92, 211, 255), (31, 111, 155), (229, 251, 255), (160, 238, 255)),
    "lightning": ((127, 99, 255), (52, 32, 111), (255, 238, 92), (255, 226, 80)),
    "poison": ((105, 207, 83), (36, 107, 49), (217, 255, 118), (184, 255, 98)),
    "holy": ((244, 201, 93), (143, 100, 33), (255, 243, 182), (255, 236, 132)),
    "shadow": ((123, 92, 255), (34, 19, 63), (207, 189, 255), (169, 140, 255)),
    "arcane": ((80, 190, 205), (26, 74, 91), (231, 245, 255), (255, 196, 91)),
}


def _hash_int(*parts):
    data = "|".join(str(part) for part in parts).encode("utf-8")
    return int(hashlib.sha256(data).hexdigest()[:16], 16)


def _blank(size):
    return bytearray([0, 0, 0, 0] * size * size)


def _put(px, size, x, y, color):
    if 0 <= x < size and 0 <= y < size:
        offset = (y * size + x) * 4
        src_a = color[3] / 255
        dst_a = px[offset + 3] / 255
        out_a = src_a + dst_a * (1 - src_a)
        if out_a <= 0:
            return
        for i in range(3):
            src = color[i] / 255
            dst = px[offset + i] / 255
            out = (src * src_a + dst * dst_a * (1 - src_a)) / out_a
            px[offset + i] = max(0, min(255, int(out * 255)))
        px[offset + 3] = max(0, min(255, int(out_a * 255)))


def _circle(px, size, cx, cy, radius, color):
    min_x = max(0, int(cx - radius))
    max_x = min(size - 1, int(cx + radius))
    min_y = max(0, int(cy - radius))
    max_y = min(size - 1, int(cy + radius))
    r2 = radius * radius
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            dist = (x - cx) ** 2 + (y - cy) ** 2
            if dist <= r2:
                edge = max(0.0, min(1.0, (r2 - dist) / max(1, r2 * 0.18)))
                alpha = int(color[3] * min(1, 0.55 + edge))
                _put(px, size, x, y, (*color[:3], alpha))


def _line(px, size, x1, y1, x2, y2, width, color):
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for i in range(int(steps) + 1):
        t = i / steps
        x = x1 + (x2 - x1) * t
        y = y1 + (y2 - y1) * t
        _circle(px, size, x, y, width / 2, color)


def _polygon(px, size, points, color, outline=None, outline_width=4):
    if outline:
        for index, point in enumerate(points):
            next_point = points[(index + 1) % len(points)]
            _line(px, size, point[0], point[1], next_point[0], next_point[1], outline_width, outline)

    min_y = max(0, int(min(y for _, y in points)))
    max_y = min(size - 1, int(max(y for _, y in points)))
    for y in range(min_y, max_y + 1):
        intersections = []
        for i, (x1, y1) in enumerate(points):
            x2, y2 = points[(i + 1) % len(points)]
            if (y1 <= y < y2) or (y2 <= y < y1):
                intersections.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        intersections.sort()
        for start, end in zip(intersections[0::2], intersections[1::2]):
            for x in range(max(0, int(start)), min(size - 1, int(end)) + 1):
                _put(px, size, x, y, color)


def _rect(px, size, x, y, w, h, color, outline=None):
    if outline:
      _rect(px, size, x - 4, y - 4, w + 8, h + 8, outline)
    for yy in range(max(0, y), min(size, y + h)):
        for xx in range(max(0, x), min(size, x + w)):
            _put(px, size, xx, yy, color)


def _draw_vfx(px, size, seed, palette, tier, style):
    main, dark, light, glow = palette
    rng = _hash_int(seed, "vfx", tier)
    count = 16 if tier == 1 else 30
    for index in range(count):
        angle = ((rng >> (index % 32)) & 255) / 255 * math.tau + index * 0.83
        radius = 86 + ((rng >> ((index * 5) % 40)) & 63)
        x = int(size / 2 + math.cos(angle) * radius)
        y = int(size / 2 + math.sin(angle) * radius)
        dot = 3 + (index % (5 if tier == 1 else 8))
        if style == "pixel":
            _rect(px, size, x - dot, y - dot, dot * 2, dot * 2, (*glow, 170))
        else:
            _circle(px, size, x, y, dot, (*glow, 135))


def _draw_icon(px, size, asset_type, palette, tier, seed, text, style):
    main, dark, light, glow = palette
    edge = (12, 18, 27, 255)
    metal = (223, 230, 238)
    wood = (142, 88, 48)

    if tier > 1:
        _line(px, size, 90, 164, 166, 164, 5, (*glow, 160))
        _line(px, size, 166, 164, 238, 164, 5, (*glow, 160))

    if asset_type == "sword":
        _polygon(px, size, [(128, 22), (151, 148), (128, 186), (105, 148)], (*metal, 255), edge, 8)
        _line(px, size, 124, 42, 124, 142, 4, (255, 255, 255, 180))
        _rect(px, size, 70, 180, 116, 22, (*main, 255), edge)
        _rect(px, size, 112, 198, 32, 76, (*wood, 255), edge)
    elif asset_type == "axe":
        _rect(px, size, 118, 95, 28, 166, (*wood, 255), edge)
        _polygon(px, size, [(50, 62), (142, 38), (178, 88), (152, 140), (72, 124)], (*main, 255), edge, 8)
        _polygon(px, size, [(150, 70), (219, 90), (178, 143)], (*metal, 255), edge, 8)
    elif asset_type == "hammer":
        _rect(px, size, 116, 104, 28, 156, (*wood, 255), edge)
        _rect(px, size, 48, 56, 160, 68, (*main, 255), edge)
        _line(px, size, 70, 74, 184, 74, 5, (255, 255, 255, 170))
    elif asset_type == "staff":
        _rect(px, size, 120, 92, 22, 166, (*wood, 255), edge)
        _circle(px, size, 131, 66, 44 if tier == 1 else 54, (*main, 240))
        _circle(px, size, 131, 66, 18, (255, 255, 255, 180))
        _rect(px, size, 80, 114, 102, 20, (*dark, 255), edge)
    elif asset_type == "bow":
        _line(px, size, 101, 38, 74, 128, 14, edge)
        _line(px, size, 74, 128, 101, 218, 14, edge)
        _line(px, size, 104, 44, 84, 128, 7, (*main, 255))
        _line(px, size, 84, 128, 104, 212, 7, (*main, 255))
        _line(px, size, 104, 44, 104, 212, 2, (245, 245, 245, 220))
        _line(px, size, 96, 128, 192, 128, 8, edge)
        _polygon(px, size, [(207, 128), (174, 112), (184, 128), (174, 144)], (*glow, 255), edge, 4)
    elif asset_type == "shield":
        _polygon(px, size, [(128, 38), (204, 70), (196, 154), (128, 232), (60, 154), (52, 70)], (*main, 255), edge, 8)
        _polygon(px, size, [(128, 62), (176, 84), (168, 150), (128, 198)], (*dark, 170))
        _line(px, size, 128, 72, 128, 194, 7, (*glow, 230))
    elif asset_type == "potion":
        _rect(px, size, 104, 38, 48, 46, (*metal, 255), edge)
        _polygon(px, size, [(88, 86), (168, 86), (204, 150), (170, 228), (86, 228), (52, 150)], (*main, 230), edge, 8)
        _circle(px, size, 102, 124, 13, (255, 255, 255, 150))
        _circle(px, size, 150, 154, 9, (*glow, 170))
    elif asset_type == "coin":
        _circle(px, size, 128, 128, 76, (*main, 255))
        _circle(px, size, 128, 128, 56, (*dark, 80))
        _polygon(px, size, [(128, 78), (144, 112), (181, 116), (152, 138), (162, 174), (128, 154), (94, 174), (104, 138), (75, 116), (112, 112)], (*glow, 255), edge, 5)
    else:
        sides = 6 + (_hash_int(text, seed) % 3)
        points = []
        for index in range(sides):
            angle = -math.pi / 2 + index * math.tau / sides
            radius = 78 if index % 2 == 0 else 58
            points.append((128 + math.cos(angle) * radius, 132 + math.sin(angle) * radius))
        _polygon(px, size, points, (*main, 255), edge, 8)
        _circle(px, size, 128, 132, 30, (*glow, 210))
        glyph_seed = _hash_int(text)
        for index in range(4):
            a = (glyph_seed >> (index * 7)) % 120
            _line(px, size, 88 + a % 70, 96 + index * 18, 112 + (a * 3) % 72, 110 + index * 18, 4, (*light, 220))

    _circle(px, size, 128, 183 if asset_type in ("sword", "axe", "hammer") else 128, 11 if tier == 1 else 16, (*glow, 240))
    if tier > 1:
        for dx, dy in [(-46, -28), (46, -28), (-32, 44), (32, 44)]:
            _circle(px, size, 128 + dx, 128 + dy, 5, (*glow, 210))
            _line(px, size, 128 + dx - 8, 128 + dy, 128 + dx + 8, 128 + dy, 2, (*light, 210))


def _png_bytes(rgba, size):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        start = y * stride
        raw.extend(rgba[start : start + stride])

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def generate_png(text, asset_type, element, style, seed, tier=1, variant=0, size=256):
    px = _blank(size)
    palette = PALETTES.get(element, PALETTES["arcane"])
    variant_seed = _hash_int(text, seed, asset_type, element, variant)
    _draw_vfx(px, size, variant_seed, palette, tier, style)
    _draw_icon(px, size, asset_type, palette, tier, variant_seed, text, style)
    if tier > 1:
        _draw_vfx(px, size, variant_seed + 13, palette, tier, style)
    return _png_bytes(px, size)


def data_url(png_bytes):
    encoded = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"
