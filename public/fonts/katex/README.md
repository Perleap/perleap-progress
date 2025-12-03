# KaTeX Fonts

This directory contains KaTeX font files copied from `node_modules/katex/dist/fonts/`.

## Why are these here?

KaTeX fonts need to be served from the public directory to work in both development and production builds. Font paths are overridden in `src/index.css` to use `/fonts/katex/` instead of the node_modules path.

## Updating Fonts

If you update the `katex` package version, you may need to refresh these font files:

```powershell
# Copy updated fonts from node_modules
Copy-Item -Path "C:\Users\dor24\node_modules\katex\dist\fonts\*" -Destination "./public/fonts/katex/" -Force
```

Or on Mac/Linux:
```bash
cp node_modules/katex/dist/fonts/* public/fonts/katex/
```

## Font Files Included

All KaTeX font variants in .woff2, .woff, and .ttf formats:
- KaTeX_Main (Regular, Bold, Italic, BoldItalic)
- KaTeX_Math (Italic, BoldItalic)
- KaTeX_AMS
- KaTeX_Size1-4
- KaTeX_Caligraphic
- KaTeX_Fraktur
- KaTeX_SansSerif
- KaTeX_Script
- KaTeX_Typewriter

## Note

These files should be committed to git to ensure LaTeX rendering works in production.

