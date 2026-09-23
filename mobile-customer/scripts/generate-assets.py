from pathlib import Path
from PIL import Image

APP_ROOT = Path(__file__).resolve().parents[1]
SITE_ROOT = APP_ROOT.parent
SOURCE = SITE_ROOT / "images" / "app-icon-512.png"
BLACK = (11, 11, 12, 255)
RESAMPLE = Image.Resampling.LANCZOS


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def save(image: Image.Image, path: Path) -> None:
    ensure_parent(path)
    image.save(path, "PNG", optimize=True)


def square_logo(size: int, logo_size: int | None = None) -> Image.Image:
    logo_size = logo_size or size
    canvas = Image.new("RGBA", (size, size), BLACK)
    logo = SOURCE_IMAGE.resize((logo_size, logo_size), RESAMPLE)
    offset = (size - logo_size) // 2
    canvas.alpha_composite(logo, (offset, offset))
    return canvas.convert("RGB")


SOURCE_IMAGE = Image.open(SOURCE).convert("RGBA")

# Android legacy and adaptive launcher icons.
android_res = APP_ROOT / "android" / "app" / "src" / "main" / "res"
densities = {
    "ldpi": (36, 81),
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}
for density, (legacy, adaptive) in densities.items():
    folder = android_res / f"mipmap-{density}"
    icon = square_logo(legacy)
    save(icon, folder / "ic_launcher.png")
    save(icon, folder / "ic_launcher_round.png")
    save(square_logo(adaptive, round(adaptive * 0.72)), folder / "ic_launcher_foreground.png")
    save(Image.new("RGB", (adaptive, adaptive), BLACK[:3]), folder / "ic_launcher_background.png")

save(square_logo(960, 610), android_res / "drawable" / "splash.png")

# iPhone App Store icon and light/dark launch screens.
ios_assets = APP_ROOT / "ios" / "App" / "App" / "Assets.xcassets"
save(square_logo(1024), ios_assets / "AppIcon.appiconset" / "AppIcon-512@2x.png")
splash = square_logo(2732, 1500)
for name in [
    "Default@1x~universal~anyany.png",
    "Default@2x~universal~anyany.png",
    "Default@3x~universal~anyany.png",
    "Default@1x~universal~anyany-dark.png",
    "Default@2x~universal~anyany-dark.png",
    "Default@3x~universal~anyany-dark.png",
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
]:
    save(splash, ios_assets / "Splash.imageset" / name)

print("Android- en iPhone-appafbeeldingen zijn gegenereerd.")
