#!/usr/bin/env python3
"""
Generate app icon using Gemini API.
Creates a 1024x1024px icon suitable for macOS app packaging.
"""

import os
import sys
import base64
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from core.gemini.client import GeminiClient


async def generate_icon():
    """Generate a pen plotter app icon."""

    # Get API key from environment
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY not found in environment")
        print("Please set it: export GEMINI_API_KEY=your_key_here")
        sys.exit(1)

    client = GeminiClient(api_key)

    # Prompt for a clean, iconic app icon
    prompt = """Create a minimalist app icon for a pen plotter application.

Design requirements:
- Simple, iconic design that works at small sizes (down to 16x16 pixels)
- Central focus on a robotic pen/plotter mechanism
- Clean geometric shapes and lines
- Professional, modern aesthetic
- Suitable for macOS app icon (rounded square background)
- Limited color palette (2-3 colors maximum)
- High contrast for visibility
- No text or letters

Style: Flat design, vector-like, iconic, similar to Apple's app icon aesthetic.

The icon should instantly communicate "pen plotter" or "precision drawing machine"."""

    print("🎨 Generating app icon with Gemini 2.5 Flash Image...")
    print(f"   Prompt: {prompt[:100]}...")

    try:
        # Generate 1024x1024 square image for app icon
        # Don't use plotter style for app icons - we want colorful icons
        image_data = await client.generate_image_for_icon(
            prompt=prompt,
            width=1024,
            height=1024
        )

        # Save as PNG
        icon_path = Path(__file__).parent / "assets" / "icon.png"
        icon_path.parent.mkdir(exist_ok=True)

        with open(icon_path, "wb") as f:
            f.write(image_data)

        print(f"✅ Icon generated: {icon_path}")
        print(f"   Size: {len(image_data)} bytes")

        return icon_path

    except Exception as e:
        print(f"❌ Error generating icon: {e}")
        sys.exit(1)


async def generate_dmg_background():
    """Generate DMG installer background image."""

    api_key = os.getenv("GEMINI_API_KEY")
    client = GeminiClient(api_key)

    # Prompt for DMG background
    prompt = """Create a clean, professional background image for a macOS DMG installer.

Design requirements:
- Dimensions: 540x380 pixels (landscape orientation)
- Simple gradient or subtle pattern
- Professional and minimal
- Light background suitable for dark text and icons
- Space in the center for app icon and instructions
- Modern, tech-focused aesthetic
- Conveys precision and creativity

Style: Clean, minimal, professional, similar to modern software installers.
Colors: Cool tones (blues, grays) or warm minimal palette."""

    print("\n🎨 Generating DMG background with Gemini 2.5 Flash Image...")

    try:
        image_data = await client.generate_image(
            prompt=prompt,
            style="minimal",
            width=540,
            height=380
        )

        # Save as PNG
        bg_path = Path(__file__).parent / "assets" / "dmg-background.png"

        with open(bg_path, "wb") as f:
            f.write(image_data)

        print(f"✅ DMG background generated: {bg_path}")
        print(f"   Size: {len(image_data)} bytes")

        return bg_path

    except Exception as e:
        print(f"⚠️  Warning: Could not generate DMG background: {e}")
        return None


def convert_to_icns(png_path):
    """Convert PNG to ICNS format for macOS."""
    import subprocess

    print(f"\n🔄 Converting {png_path} to ICNS format...")

    icns_path = png_path.parent / "icon.icns"
    iconset_path = png_path.parent / "icon.iconset"

    # Create iconset directory
    iconset_path.mkdir(exist_ok=True)

    # Generate all required icon sizes
    sizes = [
        (16, "16x16"),
        (32, "16x16@2x"),
        (32, "32x32"),
        (64, "32x32@2x"),
        (128, "128x128"),
        (256, "128x128@2x"),
        (256, "256x256"),
        (512, "256x256@2x"),
        (512, "512x512"),
        (1024, "512x512@2x"),
    ]

    try:
        for size, name in sizes:
            output = iconset_path / f"icon_{name}.png"
            subprocess.run(
                ["sips", "-z", str(size), str(size), str(png_path), "--out", str(output)],
                check=True,
                capture_output=True
            )
            print(f"   ✓ Generated {name}")

        # Convert iconset to icns
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset_path), "-o", str(icns_path)],
            check=True,
            capture_output=True
        )

        print(f"✅ ICNS file created: {icns_path}")

        # Clean up iconset directory
        import shutil
        shutil.rmtree(iconset_path)

        return icns_path

    except subprocess.CalledProcessError as e:
        print(f"❌ Error converting to ICNS: {e}")
        print("Make sure you're on macOS with 'sips' and 'iconutil' available")
        return None
    except FileNotFoundError:
        print("❌ 'sips' or 'iconutil' command not found")
        print("These tools are included with macOS by default")
        return None


if __name__ == "__main__":
    import asyncio

    print("🚀 Generating app assets for Pen Plotter\n")

    async def main():
        # Generate icon
        icon_path = await generate_icon()

        # Generate DMG background
        await generate_dmg_background()

        # Convert to ICNS if on macOS
        if sys.platform == "darwin":
            icns_path = convert_to_icns(icon_path)
            if icns_path:
                print(f"\n🎉 All assets generated successfully!")
                print(f"   - PNG icon: {icon_path}")
                print(f"   - ICNS icon: {icns_path}")
                print(f"   - DMG background: {icon_path.parent / 'dmg-background.png'}")
        else:
            print(f"\n⚠️  Skipping ICNS conversion (not on macOS)")
            print(f"   PNG icon saved: {icon_path}")

    asyncio.run(main())
