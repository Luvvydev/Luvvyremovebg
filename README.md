# Luvvy removebg

A private, browser based background remover and cutout editor built for GitHub Pages.

## What works

- Local automatic background removal in the browser
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

The first background removal downloads the model and WebAssembly runtime required by `@imgly/background-removal`. The browser caches those resources for later use.

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

This project uses `@imgly/background-removal`, which is distributed under the GNU Affero General Public License v3. This repository is therefore distributed under AGPL 3.0. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
