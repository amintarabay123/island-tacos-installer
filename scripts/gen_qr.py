import qrcode, shutil
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image, ImageDraw, ImageFont

URL = "https://orders.islandtacosbvi.com"
RED   = (208, 16, 0)        # logo red
DARK  = (26, 12, 0)
CREAM = (255, 248, 235)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

print("start", flush=True)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=20, border=2)
qr.add_data(URL); qr.make(fit=True)

qr_img = qr.make_image(
    image_factory=StyledPilImage,
    module_drawer=RoundedModuleDrawer(radius_ratio=1),
    color_mask=SolidFillColorMask(back_color=RED, front_color=DARK),
).convert("RGBA")
print("qr", qr_img.size, flush=True)

# Embed center logo
logo = Image.open("exports/logo_no_bg.png").convert("RGBA")
W, H = qr_img.size
ls = int(W * 0.26)
logo.thumbnail((ls, ls), Image.LANCZOS)
# Clear a red square under the logo so QR modules don't show through
clear_pad = 18
clear_w = logo.width + clear_pad * 2
clear_h = logo.height + clear_pad * 2
clear = Image.new("RGBA", (clear_w, clear_h), RED + (255,))
qr_img.paste(clear, ((W-clear_w)//2, (H-clear_h)//2), clear)
qr_img.paste(logo, ((W-logo.width)//2, (H-logo.height)//2), logo)
print("logo embedded", flush=True)

# Wordmark on top
wm = Image.open("artifacts/island-tacos/public/logo-wordmark.png").convert("RGBA")
target_w = int(W * 0.95)
ratio = target_w / wm.width
wm = wm.resize((target_w, int(wm.height * ratio)), Image.LANCZOS)
print("wordmark sized", wm.size, flush=True)

# Layout: red card with wordmark on top, white QR card below, text under
side_pad = 60
top_pad = 50
card_pad = 40   # white space around the QR inside white card
gap = 50
text_block_h = 200
bottom_pad = 60

inner_w = W
card_w = inner_w + side_pad * 2

wm_h = wm.height + 30
white_card_h = H + card_pad * 2

total_h = top_pad + wm_h + gap + white_card_h + text_block_h + bottom_pad

canvas = Image.new("RGBA", (card_w, total_h), RED + (255,))
draw = ImageDraw.Draw(canvas)

# Wordmark centered
wm_x = (card_w - wm.width) // 2
wm_y = top_pad
canvas.paste(wm, (wm_x, wm_y), wm)

# QR directly on red background (no white card)
qr_x = (card_w - W) // 2
qr_y = top_pad + wm_h + gap
canvas.paste(qr_img, (qr_x, qr_y), qr_img)
card_y1 = qr_y + H

# Text under QR
tf = ImageFont.truetype(FB, 70)
sf = ImageFont.truetype(FR, 38)
t = "Scan to Order"
s = "orders.islandtacosbvi.com"
ty = card_y1 + 50
sy = ty + 105

tb = draw.textbbox((0,0), t, font=tf)
sb = draw.textbbox((0,0), s, font=sf)
draw.text(((card_w - (tb[2]-tb[0]))/2, ty), t, fill=CREAM, font=tf)
draw.text(((card_w - (sb[2]-sb[0]))/2, sy), s, fill=(255,230,200), font=sf)
print("text done", flush=True)

out = "exports/island-tacos-order-qr.png"
canvas.save(out, "PNG")
shutil.copy(out, "artifacts/island-tacos/public/island-tacos-order-qr.png")
print("DONE", canvas.size, flush=True)
