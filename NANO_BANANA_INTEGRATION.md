# Nano Banana Integration (Gemini Image Generation)

## What is Nano Banana?

**Nano Banana** is Google's name for Gemini's native image generation capabilities. It uses advanced AI models to generate and edit images directly.

## Models Used

### Gemini 3 Pro Image Preview (`gemini-3-pro-image-preview`) ✅
- **Also known as**: Nano Banana Pro
- **Purpose**: Professional-quality image generation and editing
- **Status**: Currently used in this app
- **Features**:
  - Advanced reasoning ("Thinking") for complex instructions
  - High-fidelity text rendering in images
  - 2K/4K output support
  - Multi-image composition (up to 14 reference images)
  - Character consistency (up to 5 people)
  - 65k token input window, 32k output tokens
- **Used for**: Both text-to-image and image-to-image conversion

### Other Available Models

#### Gemini 2.5 Flash Image (`gemini-2.5-flash-image`)
- **Purpose**: Fast, efficient image generation
- **Use Case**: High-volume, low-latency when speed is priority
- **Note**: Not currently used, but available as alternative

## Implementation in Zagreb Plotter

### Text-to-Image Generation
```typescript
// Uses: gemini-3-pro-image-preview
// Function: generateImage()
// Purpose: Generate plotter-friendly line art from text descriptions
```

**How it works:**
1. User provides text description (e.g., "a simple flower")
2. App enhances prompt with plotter-specific instructions
3. Gemini generates black line art on white background
4. Image is suitable for pen plotter drawing

### Image-to-Image Processing
```typescript
// Uses: gemini-3-pro-image-preview
// Function: processImageForPlotter()
// Purpose: Convert photos/images to line art for plotting
```

**How it works:**
1. User uploads an image (photo, drawing, etc.)
2. App sends image with conversion instructions to Gemini
3. Gemini analyzes the image and generates line art version
4. Output is optimized for pen plotter (black lines, white background)

## Plotter-Specific Optimizations

All prompts are enhanced with pen plotter requirements:
- **Only black lines on white background** - No color, no fills
- **Vector-style line drawing** - Not raster/pixelated
- **No gradients or solid areas** - Everything must be drawable with a pen
- **Line-based shading** - Uses hatching, cross-hatching, stippling
- **Clear, continuous lines** - Physically drawable by a pen
- **Preserved key features** - Maintains recognizability

## API Key Configuration

The app supports multiple ways to provide your Gemini API key:

1. **Bundled in build** (`.env` file) - For internal releases
2. **User-provided via UI** - For public releases
3. **Environment variable** - For development

See `BUILD_GUIDE.md` for setup instructions.

## Network Requirements

- Requires internet connection for image generation
- API calls go directly to Google's Gemini API
- No backend/proxy required
- CORS-friendly (works in browser and Tauri desktop app)

## Error Handling

Common errors and solutions:

### "Gemini API key not configured"
**Solution**: Add your API key in Settings or build with `.env` file

### "No image generated" or "No image data in response"
**Solution**:
- Check your API key is valid
- Ensure you have API quota/credits
- Try a simpler prompt
- Check internet connection

### "Network error" or "Failed to fetch"
**Solution**:
- Verify internet connection
- Check if API endpoint is accessible
- Ensure API key has proper permissions
- Check Google AI Studio status

## Resources

- [Nano Banana Documentation](https://ai.google.dev/gemini-api/docs/nanobanana)
- [Image Generation Guide](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Build with Nano Banana Pro](https://blog.google/technology/developers/gemini-3-pro-image-developers/)

## Current Quality

The app uses **Gemini 3 Pro Image Preview** which provides:
- ✅ Highest quality image generation available
- ✅ Advanced reasoning for complex plotter instructions
- ✅ High-fidelity line rendering
- ✅ Professional-quality output

## Future Enhancements

Potential additional features:
- Add support for 2K/4K resolution exports (model supports it)
- Multi-image composition for complex designs (up to 14 images)
- Character consistency for portrait series (up to 5 people)
- Configurable thinking levels (low/high)
- Advanced style transfer options

## Testing

To test the integration:
1. Open the app (web or desktop)
2. Create a new project
3. Click "Generate with AI" in the editor
4. Try both text-to-image and image processing features
5. Verify generated images are plotter-friendly line art
