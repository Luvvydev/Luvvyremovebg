# Luvvy removebg

A private, browser based background remover and cutout editor built for GitHub Pages.

## What works

- Quality automatic background removal with BRIA RMBG 2.0 in the browser
- Fast IMG.LY IS-Net fallback engine
- Full resolution editable alpha mask
- Erase and restore brushes with hardness and size controls
- Undo and redo
- Reset and rerun automatic cutout
- Edge feather, 1 px expand, and 1 px shrink
- Zoom, pan, and fit controls
- Transparent, white, black, custom color, or uploaded image backgrounds
- Background blur and configurable drop shadow
- Brightness, contrast, and saturation adjustments
- Subject scale and positioning
- PNG, WebP, and JPG exports
- Original, 1080p, 1440p, 4K, and custom export sizes
- Aspect ratio lock
- Trim transparent pixels
- Light and dark themes

## Privacy

Image processing happens in the browser. Luvvy removebg does not upload the user's image to an application server.

Quality mode downloads the quantized BRIA RMBG 2.0 web model on first use, then the browser cache is reused. The quality model is roughly 366 MB. Fast mode uses the smaller IMG.LY IS-Net stack. Both run locally in the browser.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`, build the Vite application, and deploy the `dist` directory to GitHub Pages.

The Vite base path is configured for:

`/Luvvyremovebg/`

## License

The application code is distributed under AGPL 3.0 because it includes `@imgly/background-removal`. Quality mode also loads BRIA RMBG 2.0 model weights under CC BY-NC 4.0 for personal, non-commercial use. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
