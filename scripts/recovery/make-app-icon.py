"""画 resources/icon.png：超椭圆瓦片 + 叶形标记，色值取自渲染层 token。

不用位图生成结果是因为它带平台水印；这里全部是解析式几何，可重跑。
用法：python3 scripts/recovery/make-app-icon.py [输出路径]
"""

import math
import sys

from PIL import Image, ImageDraw

SIZE = 1024
# 与 tokens.css 对齐：--brand-500 (#007aff) 到深一档的同色系
TOP = (10, 132, 255)
BOTTOM = (0, 58, 122)
LEAF = (127, 216, 176)
VEIN = (201, 242, 221)


def squircle_mask(n: int, radius_ratio: float = 0.2237, power: float = 5.0) -> Image.Image:
    """Apple 风格连续曲率圆角方形（超椭圆近似，逐像素判定）"""
    r = n * radius_ratio
    limit = n / 2 - r
    m = Image.new('L', (n, n), 0)
    px = m.load()
    for y in range(n):
        ny = abs(y - (n - 1) / 2) / limit
        for x in range(n):
            nx = abs(x - (n - 1) / 2) / limit
            if nx**power + ny**power <= 1.0:
                px[x, y] = 255
    return m


def vertical_gradient(n: int) -> Image.Image:
    g = Image.new('RGB', (n, n), TOP)
    d = ImageDraw.Draw(g)
    for y in range(n):
        t = y / (n - 1)
        col = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM))
        d.line([(0, y), (n, y)], fill=col)
    return g


def bezier(p0, p1, p2, steps: int = 90):
    out = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
        y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
        out.append((x, y))
    return out


def leaf_polygon(cx: float, cy: float, length: float, width: float, angle_deg: float):
    """两片二次贝塞尔夹出的叶身：尖端在两端，腹部鼓出 width"""
    a = angle_deg * 3.141592653589793 / 180
    tip1 = (cx - length / 2 * math.cos(a), cy - length / 2 * math.sin(a))
    tip2 = (cx + length / 2 * math.cos(a), cy + length / 2 * math.sin(a))
    mx, my = (tip1[0] + tip2[0]) / 2, (tip1[1] + tip2[1]) / 2
    # 法线方向
    dx, dy = tip2[0] - tip1[0], tip2[1] - tip1[1]
    ln = (dx * dx + dy * dy) ** 0.5
    nx, ny = -dy / ln, dx / ln
    upper = bezier(tip1, (mx + nx * width, my + ny * width), tip2)
    lower = bezier(tip2, (mx - nx * width * 0.85, my - ny * width * 0.85), tip1)
    return upper + lower


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else 'resources/icon.png'
    img = vertical_gradient(SIZE)
    tile = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    tile.paste(img, (0, 0), squircle_mask(SIZE))

    d = ImageDraw.Draw(tile)
    cx, cy = SIZE * 0.5, SIZE * 0.52
    d.polygon(leaf_polygon(cx, cy, SIZE * 0.52, SIZE * 0.155, -38), fill=LEAF + (255,))
    # 主脉：沿叶轴偏上的一条细弧
    spine = bezier((cx - SIZE * 0.165, cy + SIZE * 0.132), (cx, cy - SIZE * 0.02), (cx + SIZE * 0.165, cy - SIZE * 0.142))
    d.line(spine, fill=VEIN + (255,), width=int(SIZE * 0.022), joint='curve')

    tile.save(out)
    print('wrote', out, tile.size)


if __name__ == '__main__':
    main()
