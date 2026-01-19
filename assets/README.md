# App Icons and Assets

This directory should contain:

## Required Files

### icon.icns (macOS app icon)
- 1024x1024px icon in ICNS format
- Represents your app in the Dock, Finder, and Launchpad

You can create this using:
1. Create a 1024x1024px PNG image
2. Use an online converter (e.g., https://cloudconvert.com/png-to-icns)
3. Or use the `iconutil` command on macOS:
   ```bash
   # Create iconset folder
   mkdir icon.iconset

   # Create different sizes (example sizes shown)
   sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
   sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
   sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
   sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
   sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
   sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

   # Convert to ICNS
   iconutil -c icns icon.iconset
   ```

### dmg-background.png (DMG installer background)
- 540x380px background image
- Shown when users open the DMG installer
- Should have a professional, branded look

## Temporary Placeholder

Until you create custom icons, the build will use Electron's default icon.

## Icon Design Tips

For a pen plotter app, consider icons featuring:
- A pen/pencil drawing
- A robotic arm or plotter mechanism
- Geometric patterns or line art
- Simple, recognizable silhouette at small sizes
