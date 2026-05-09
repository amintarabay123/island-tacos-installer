import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image, ImageDraw, ImageFont
import glob, shutil, sys

print("start", flush=True)

URL = "https://orders.islandtacosbvi.com"
ORANGE = (245, 166, 35); DARK = (26, 12, 0); DEEP = (180, 100, 20)

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=20, border=3)
qr.add_data(URL); qr.make(fit=True)
print("qr made", flush=True)

img = qr.make_image(
    image_factory=StyledPilImage,
    module_drawer=RoundedModuleDrawer(radius_ratio=1),
    color_mask=SolidFillColorMask(back_color=(255,255,255), front_color=DARK),
).convert("RGBA")
print("img made", img.size, flush=True)

logo = Image.open("artifacts/island-tacos/public/logo.png").convert("RGBA")
W, H = img.size
ls = int(W * 0.22)
logo.thumbnail((ls, ls), Image.LANCZOS)
pad = 12
bd = Image.new("RGBA", (logo.width+pad*2, logo.height+pad*2), (255,255,255,255))
img.paste(bd, ((W-bd.width)//2, (H-bd.height)//2), bd)
img.paste(logo, ((W-logo.width)//2, (H-logo.height)//2), logo)
print("logo embedded", flush=True)

canvas = Image.new("RGBA", (W+100, H+280), (255,255,255,255))
print("canvas created", flush=True)
draw = ImageDraw.Draw(canvas)
draw.rectangle([(20,20),(W+80,H+260)], outline=ORANGE, width=8)
print("border drawn", flush=True)
canvas.paste(img.convert("RGB"), (50,50))
print("img pasted", flush=True)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
tf = ImageFont.truetype(FB, 64)
sf = ImageFont.truetype(FR, 36)
print("fonts loaded", flush=True)

t = "Scan to Order"; s = "orders.islandtacosbvi.com"
tb = draw.textbbox((0,0), t, font=tf); sb = draw.textbbox((0,0), s, font=sf)
draw.text(((W+100-(tb[2]-tb[0]))/2, H+75), t, fill=DARK, font=tf)
draw.text(((W+100-(sb[2]-sb[0]))/2, H+205), s, fill=DEEP, font=sf)

canvas.save("exports/island-tacos-order-qr.png", "PNG", optimize=False)
shutil.copy("exports/island-tacos-order-qr.png", "artifacts/island-tacos/public/island-tacos-order-qr.png")
print("DONE", canvas.size, flush=True)
