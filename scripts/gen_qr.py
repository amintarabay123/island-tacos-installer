import qrcode, shutil
from PIL import Image, ImageDraw, ImageFont

URL = "https://orders.islandtacosbvi.com"
BLACK = (0, 0, 0); WHITE = (255, 255, 255)
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

print("start", flush=True)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=2)
qr.add_data(URL); qr.make(fit=True)
qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
W, H = qr_img.size
print("qr", qr_img.size, flush=True)

wm = Image.open("artifacts/island-tacos/public/logo-wordmark.png").convert("RGBA")
target_w = int(W * 0.55)
ratio = target_w / wm.width
wm = wm.resize((target_w, int(wm.height * ratio)), Image.LANCZOS)
print("wm resized", wm.size, flush=True)
alpha = wm.split()[-1]
black_wm = Image.new("RGBA", wm.size, (0, 0, 0, 0))
black_wm.paste(Image.new("RGBA", wm.size, BLACK + (255,)), (0, 0), alpha)
wm = black_wm
print("wm blackened", flush=True)

side_pad = 60; top_pad = 50; gap = 60; bottom_pad = 80; text_block_h = 200
card_w = W + side_pad * 2
total_h = top_pad + wm.height + gap + H + text_block_h + bottom_pad

canvas = Image.new("RGBA", (card_w, total_h), WHITE + (255,))
draw = ImageDraw.Draw(canvas)
canvas.paste(wm, ((card_w - wm.width) // 2, top_pad), wm)
qr_x = (card_w - W) // 2
qr_y = top_pad + wm.height + gap
canvas.paste(qr_img, (qr_x, qr_y), qr_img)
qr_bottom = qr_y + H

tf = ImageFont.truetype(FB, 64)
sf = ImageFont.truetype(FR, 36)
t = "Scan to Order"; s = "orders.islandtacosbvi.com"
ty = qr_bottom + 50; sy = ty + 100
tb = draw.textbbox((0, 0), t, font=tf); sb = draw.textbbox((0, 0), s, font=sf)
draw.text(((card_w - (tb[2]-tb[0])) / 2, ty), t, fill=BLACK, font=tf)
draw.text(((card_w - (sb[2]-sb[0])) / 2, sy), s, fill=BLACK, font=sf)

out = "exports/island-tacos-order-qr.png"
canvas.convert("RGB").save(out, "PNG")
shutil.copy(out, "artifacts/island-tacos/public/island-tacos-order-qr.png")
print("DONE", canvas.size, flush=True)
