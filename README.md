# Luvvy removebg

A private, browser based background remover and cutout editor built for GitHub Pages.

## What works

- Smart automatic mode that analyzes the image and picks the most promising free cutout method
- General photo engine with BRIA RMBG 2.0
- Anime and artwork engine with browser compatible IS-Net Anime
- Edge aware flat background solver for simple and mostly white backgrounds
- Fast IMG.LY IS-Net fallback engine
- Automatic candidate scoring and local edge cleanup
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

## Smart mode

Smart mode runs completely in the browser. It first looks at image characteristics such as border uniformity, flat color regions, line density, and saturation. It then tests the most relevant local methods and scores the candidate masks before choosing a result.

The original ToonOut model was evaluated for the anime path, but its published weights are PyTorch only and are not directly usable by Transformers.js on GitHub Pages. The deployed site therefore uses `BritishWerewolf/IS-Net-Anime`, which provides browser compatible ONNX weights, while keeping the same anime specific routing idea.

## Privacy

Image processing happens in the browser. Luvvy removebg does not upload the user's image to an application server. Model files download to the browser on first use and are reused from cache when possible.

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

The application code is distributed under AGPL 3.0 because it includes `@imgly/background-removal`. BRIA RMBG 2.0 is used under its non commercial model license for this personal project. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
