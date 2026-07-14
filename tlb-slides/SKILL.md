---
name: tlb-slides
metadata:
  version: 1.0.0
description: Talabat-branded slide design system for creating professional presentations — provides colors, fonts, layouts, and brand assets to use alongside the pptx skill. Use when creating slides, decks, or presentations for talabat, or when the user mentions talabat slides, talabat presentation, talabat deck, or talabat branding for slides. Do not use for coding tasks, code review, or non-presentation work
---

# Talabat Slide Design System

This skill contains the complete talabat brand design system for presentations, including colors, typography, layout patterns, brand assets (logo, patches, stickers, icons), and reference screenshots of every slide type.

**How this skill works with the pptx skill:**
- This skill = WHAT (design rules, colors, fonts, layouts, assets)
- The pptx skill = HOW (tools to create .pptx files)

Always read this skill first for design direction, then use the pptx skill's tooling (pptxgenjs for from-scratch, or editing workflow for template-based) to build the actual slides.

## Quick Start

1. Read the design system below for colors, fonts, and rules
2. Check `references/slide-patterns.md` for specific slide type layouts and code patterns
3. Use assets from `assets/` directory (logo, patches, icons, etc.)
4. Look at screenshots in `assets/screenshots/` for visual reference of each slide type

> **Screenshot Note:** All reference screenshots were rendered by LibreOffice from the original PPTX files. They show the correct **layout structure, positioning, and color usage**, but may differ from Google Slides / PowerPoint in font rendering and decorative element placement. When in doubt, trust the documented specs (font names, sizes, colors, positions) over the screenshot appearance. For pixel-perfect reference, open the original `.pptx` files in Google Slides or PowerPoint.

---

## Slide Dimensions

| Property | Value |
|----------|-------|
| Width | 10.00 inches |
| Height | 5.63 inches |
| Aspect Ratio | 16:9 |

For pptxgenjs: `pptx.defineLayout({ name: 'TALABAT', width: 10, height: 5.63 });`

---

## Brand Color Palette

### Primary Colors (use these 90% of the time)

| Name | Hex | CSS | Usage |
|------|-----|-----|-------|
| **Warm Orange** | `#FF5900` | `rgb(255,89,0)` | Primary brand color. Titles, accent bars, backgrounds, CTAs |
| **Dark Burgundy** | `#411517` | `rgb(65,21,23)` | Body text, dark backgrounds, contrast on orange |
| **Warm Cream** | `#F4EDE3` | `rgb(244,237,227)` | Default slide background, text on orange |
| **White** | `#FFFFFF` | `rgb(255,255,255)` | Clean backgrounds, text on dark |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Electric Lime** | `#CFFF00` | Highlight keywords on orange/dark backgrounds |
| **Vivid Purple** | `#8318D8` | Alternate accent, purple-theme titles, schedule backgrounds |
| **Soft Lavender** | `#EBE8FC` | Alternate light background (purple theme variant) |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Dark Gray** | `#343B46` | Secondary text in org charts |
| **Medium Gray** | `#595959` | Timeline elements, subtle labels |

### Orange Tint Scale (for data visualizations, org charts, gradients)

| Hex | Usage |
|-----|-------|
| `#B34700` | Darker orange for emphasis |
| `#D24803` | Evaluation table fills |
| `#FA6E22` | Data bar fills |
| `#FF944D` | Org chart nodes |
| `#FCA06F` | Lighter data bars |
| `#FFD1B3` | Light diagram fills |
| `#FDC3A4` | Roadmap fills |
| `#F9CB9C` | Phase fills |

### Background Rules

| Background | When to Use | Text Colors |
|------------|-------------|-------------|
| `#F4EDE3` Cream | Default for all content slides | Titles: `#FF5900`, Body: `#411517` |
| `#FF5900` Orange | Section dividers, covers, statements, thank-you | Text: `#F4EDE3`, Accents: `#CFFF00`, Contrast: `#411517` |
| `#FFFFFF` White | Multi-column layouts, chart slides | Titles: `#FF5900`, Body: `#411517` |
| `#411517` Dark Burgundy | Agenda dark theme only | Titles: `#FF5900`, Hidden items: `#411517` |
| `#EBE8FC` Lavender | Purple theme variant | Titles: `#8318D8`, Body: `#8318D8` |
| `#8318D8` Purple | Schedule, numbered cards (purple variant) | Accents: `#CFFF00`, Text: `#EBE8FC` |

### Color Rules

1. Orange dominates — it's the brand. Use it for titles, accent bars, and backgrounds
2. Never use cold/harsh white as a primary background — use warm cream (`#F4EDE3`) instead
3. Lime (`#CFFF00`) is ONLY for accents/highlights on dark or orange backgrounds, never as a primary color
4. Purple is an approved alternate theme, not a competitor to orange
5. Data visualizations can use the orange tint scale for graduated values

---

## Typography

### Font Hierarchy

| Font | Role | Notes |
|------|------|-------|
| **Poppins** | Primary for everything | Available in Regular, Medium, SemiBold, ExtraBold, Black |
| **DM Sans** | Secondary body text | Regular and Bold |
| **DM Sans Black** | Large decorative numbers | 100pt numbered list numbers |
| **Open Sans** | Org charts only | Regular and SemiBold |

TTF font files are bundled in `assets/fonts/`:
- **Poppins**: Regular, Medium, SemiBold, Bold, ExtraBold, Black (6 static TTF files)
- **DM Sans**: Variable font (includes all weights from Thin to Black)
- **Open Sans**: Variable font (includes all weights and widths)

Install these fonts on your system so that pptxgenjs-generated slides render correctly. When using pptxgenjs, specify the font family name (e.g., `fontFace: "Poppins"`).

### Typography Scale

| Element | Font | Weight | Size | Color (Cream bg) | Color (Orange bg) |
|---------|------|--------|------|-------------------|-------------------|
| Hero Title | Poppins | ExtraBold | 125pt | — | `#F4EDE3` + `#CFFF00` |
| Game Over Title | Poppins | Bold | 109pt | — | `#F4EDE3` + `#411517` |
| Cover Title | Poppins | Black | 50-62pt | `#FF5900` + `#411517` | `#F4EDE3` + `#411517` |
| Section Header | Poppins | Black | 70pt | — | `#F4EDE3` + `#CFFF00` |
| Section Divider | Poppins | Black | 50pt | — | `#F4EDE3` |
| Statement Text | Poppins | Bold | 30-50pt | `#FF5900` + `#411517` | `#F4EDE3` + `#CFFF00` |
| Slide Title | Poppins | SemiBold | 25pt | `#FF5900` | varies |
| Body Text (lg) | Poppins | Regular | 13pt | `#411517` | — |
| Body Text | Poppins | Regular | 10-11pt | `#411517` | `#F4EDE3` |
| Card Title | Poppins | Black | 20pt | `#411517` | `#F4EDE3` |
| Small Text | Poppins | Medium | 6-8pt | `#411517` | `#F4EDE3` |
| Big Number | Poppins | ExtraBold | 35pt | `#FF5900` | `#CFFF00` |
| Quote | Poppins | SemiBold | 10-15pt | `#411517` | — |

### Text Rules

- Titles: LEFT aligned (some cover variants use RIGHT)
- Body text: LEFT or JUSTIFY for columns
- Chart labels: CENTER
- Thank You text: LEFT, rotated -3.24 degrees
- Always use Poppins. Fall back to Arial only if Poppins unavailable

---

## Layout System

### Standard Content Slide Layout

```
+------------------------------------------+
| [Accent Bar 1.20"x0.07"]     [LOGO]     |  top=0.00"
| [Title - orange 25pt]                    |  top=0.18"
|                                          |
| [Content area]                           |  top=1.00"
|                                          |
|                                          |
+------------------------------------------+
```

### Key Measurements

| Element | Value |
|---------|-------|
| Left margin | 0.35-0.42" |
| Top margin | 0.18-0.28" |
| Content area width | ~9.25-9.41" |
| Content start Y | ~1.00-1.17" |
| Title height | ~0.68" |

### Logo Positions

The talabat logo file is at `assets/logo/talabat-logo.png`.

| Context | Left | Top | Width | Height | Rotation |
|---------|------|-----|-------|--------|----------|
| Standard (content slides) | 8.29" | 0.24" | 1.39" | 0.46" | 4.7deg |
| Cover (top-right, large) | 7.09" | 0.40" | 2.52" | 0.84" | 4.7deg |
| Cover (bottom-right) | 6.63" | 4.31" | 2.99" | 1.00" | — |
| Bottom-left | 0.50" | 4.85" | 1.39" | 0.46" | — |

**The logo is always slightly rotated (~4.7 degrees) for a playful brand feel.**

### Accent Bar

Every content slide has a small orange accent bar at the top-left:
- Shape: rounded rectangle (round2SameRect)
- Position: left=0.42", top=0.00"
- Size: 1.20" x 0.07"
- Fill: `#FF5900`
- Rotation: 180 degrees

For pptxgenjs, create this with a small filled rectangle shape.

---

## Brand Devices

### Patches
Organic blob/circle shapes used as decorative elements, bullet markers, number containers, and quote backgrounds.
Files: `assets/patches/`

### Stickers
Eye-catching callout shapes for highlighting info.
Files: `assets/stickers/`

### Icons
Flat icon set for use in grids, bullets, and visual indicators.
Files: `assets/icons/`

### Illustrations
Decorative supporting visuals in various color variants.
Files: `assets/illustrations/`

---

## Slide Types Catalog

See `references/slide-patterns.md` for detailed layout specs and pptxgenjs code for each type.

Reference screenshots are in `assets/screenshots/template/` and `assets/screenshots/example-bff/`.

> **About the screenshots:** These were rendered by LibreOffice and have known rendering differences:
> - **Font substitution**: Some text may appear in a fallback font (e.g., sans-serif instead of Poppins) — font weight and size are still correct
> - **Decorative elements**: Patches, clock images, and stickers may render with slightly different shapes or outlines
> - **Text overlap**: A few slides show minor text overflow that doesn't occur in the original (e.g., numbered cards)
> - **Background rendering**: The dark agenda slide (`#411517`) shows cream background because the decorative overlay images dominate
>
> The screenshots are reliable for **layout structure, element positioning, and color usage**. Always defer to the exact specs in the documentation.

### Cover Slides (7 variants)

| Variant | Background | Screenshot | Key Features |
|---------|-----------|------------|--------------|
| Full Image | Image | `cover-01-full-image.jpg` | Full-bleed photo |
| Title on Image | Image | `cover-02-title.jpg` | Title + date overlay on texture |
| Orange + Image | `#FF5900` | `cover-03-orange-with-image.jpg` | Two-tone title, image right |
| White + Image | White | `cover-04-white.jpg` | Clean, image right |
| Purple/Lavender | `#EBE8FC` | `cover-05-purple.jpg` | Purple theme |
| Orange Large Text | `#FF5900` | `cover-06-orange-large-text.jpg` | Big bold text |
| Cream Right-Aligned | `#F4EDE3` | `cover-07-cream-right-aligned.jpg` | Right-aligned title + subtitle |

### Section Dividers (3 variants)

| Variant | Background | Screenshot | Key Features |
|---------|-----------|------------|--------------|
| Bold + Lime Accent | `#FF5900` | `section-01-orange-bold.jpg` | 70pt, accent word in lime |
| Simple | `#FF5900` | `section-02-orange-simple.jpg` | 50pt, clean |
| With Background Images | `#FF5900` | `section-03-orange-images.jpg` | Decorative image overlays |

### Statement Slide

| Screenshot | Key Features |
|------------|--------------|
| `statement-hero-text.jpg` | 125pt hero text, lime accent, supporting text |

### Content Slides (8 variants)

| Variant | Background | Screenshot |
|---------|-----------|------------|
| Standard Cream | `#F4EDE3` | `content-01-cream.jpg` |
| Purple Theme | `#EBE8FC` | `content-02-purple.jpg` |
| Orange + Images | `#FF5900` | `content-03-orange.jpg` |
| White + Sections | White | `content-04-white-sections.jpg` |
| White + Images | White | `content-05-white-images.jpg` |
| Orange + Image | `#FF5900` | `content-06-orange-image.jpg` |
| Creative Freeform | `#FF5900` | `content-07-creative.jpg` |
| Numbered Cards | `#F4EDE3` | `content-08-numbered-cards.jpg` |

### Multi-Column Layouts (4 variants)

| Variant | Screenshot |
|---------|------------|
| 2-Column | `column-2col.jpg` |
| 3-Column | `column-3col.jpg` |
| 4-Column | `column-4col.jpg` |
| Column + Image Split | `column-split.jpg` |

### Agenda Slides (3 variants)

| Variant | Background | Screenshot |
|---------|-----------|------------|
| Dark Theme | `#411517` | `agenda-dark.jpg` |
| Orange Theme | `#FF5900` | `agenda-orange.jpg` |
| Cream (Clean) | `#F4EDE3` | `agenda-cream.jpg` |

### Data & Chart Slides

| Type | Screenshot |
|------|------------|
| Horizontal Bar (Orange bg) | `chart-bar-horizontal-orange.jpg` |
| Horizontal Bar (Cream bg) | `chart-bar-horizontal-cream.jpg` |
| Roadmap/Gantt | `chart-roadmap-gantt.jpg` |
| Roadmap Phase | `chart-roadmap-phase.jpg` |
| Process Flow/Swimlane | `chart-roadmap-swimlane.jpg` |
| Org Chart | `chart-org-chart.jpg` |
| Evaluation Table | `chart-evaluation-table.jpg` |
| Competitor (Simple) | `chart-competitor-simple.jpg` |
| Competitor (Complex) | `chart-competitor-complex.jpg` |
| Market Grid (8-country) | `chart-market-grid.jpg` |
| 2x2 Matrix (Orange) | `chart-matrix-orange.jpg` |
| 2x2 Matrix (Cream) | `chart-matrix-cream.jpg` |
| Column Chart | `chart-column.jpg` |
| Line Chart | `chart-line.jpg` |
| Pie Chart | `chart-pie.jpg` |
| Donut Chart | `chart-donut.jpg` |
| Bar Chart Paired | `chart-bar-paired.jpg` |
| Multi-Panel 50-50 | `chart-multi-panel-50-50.jpg` |
| Multi-Panel 33-33-33 | `chart-multi-panel-33-33-33.jpg` |

### Special Content Slides

| Type | Screenshot |
|------|------------|
| Icon Grid (2x3) | `special-icon-grid.jpg` |
| Schedule (Cream) | `special-schedule-cream.jpg` |
| Schedule (Orange) | `special-schedule-orange.jpg` |
| Schedule (Purple) | `special-schedule-purple.jpg` |
| Info Cards (Cream) | `special-info-cards-cream.jpg` |
| Info Cards (Orange) | `special-info-cards-orange.jpg` |
| Numbered Cards (Cream) | `special-numbered-cards-cream.jpg` |
| Numbered Cards (Orange) | `special-numbered-cards-orange.jpg` |
| Quotes & Callouts | `special-quotes.jpg` |
| Table Style 1 | `special-table-1.jpg` |
| Timeline/Gantt | `special-timeline.jpg` |
| Before/After (Cream) | `special-before-after-cream.jpg` |
| Before/After (Orange) | `special-before-after-orange.jpg` |
| Text Boxes (2-col) | `special-text-boxes.jpg` |
| Text Box Cards | `special-text-boxes-cards.jpg` |
| Text Boxes + Images | `special-text-boxes-images.jpg` |
| Text Boxes Numbered | `special-text-boxes-numbered.jpg` |
| Numbered List (Cream) | `numbered-list-cream.jpg` |
| Numbered List (Orange) | `numbered-list-orange.jpg` |

### Thank You / Closing (3 variants)

| Variant | Screenshot | Key Features |
|---------|------------|--------------|
| "Game Over" | `thankyou-game-over.jpg` | Two-tone 109pt, contact info |
| Repeated Rotated | `thankyou-repeated.jpg` | 4x "THANK YOU" at 125pt, -3.24deg |
| Simple | `thankyou-simple.jpg` | "Thank you!" + end message |

### Brand Reference

| Screenshot | Shows |
|------------|-------|
| `ref-color-usage.jpg` | How to use brand colors |
| `ref-patches.jpg` | Patch examples and usage |
| `ref-stickers.jpg` | Sticker examples |
| `ref-illustrations.jpg` | Available illustrations |
| `ref-icons.jpg` | Available icons |

---

## Design Patterns

### Two-Tone Title Pattern
Cover/statement slides use alternating colors per line:
- Line 1: burgundy `#411517`
- Line 2: orange `#FF5900` or cream `#F4EDE3`
- Creates visual hierarchy and brand recognition

### Keyword Highlighting
Within titles and statements, highlight key words:
- On orange bg: key word in lime `#CFFF00`
- On cream bg: key word in orange `#FF5900`

### Decorative Image Overlays
Orange/dark slides layer 2-3 semi-transparent decorative images behind content for depth.

### Presentation Structure

1. **Cover** - Branded title slide
2. **Agenda** - Table of contents
3. **Section Dividers** - Between major topics
4. **Content Slides** - Main body
5. **Data/Charts** - Supporting evidence
6. **Thank You** - Closing slide

### Do's
- Keep it minimalist
- Use brand colors exclusively
- Answer the key question first ("Answer First" principle)
- Use visuals over text
- Use the accent bar on every content slide

### Don'ts
- Never use cold/harsh white backgrounds
- Don't overcrowd slides
- Don't use non-brand colors
- Don't skip the logo

---

## Working with the PPTX Skill

For detailed pptxgenjs code patterns for each slide type, read `references/slide-patterns.md`.

### From-Scratch Workflow (pptxgenjs)

1. Read this skill for design rules
2. Read `references/slide-patterns.md` for the specific slide type you need
3. Use the pptx skill's `pptxgenjs.md` guide for the pptxgenjs API
4. Load brand assets from `assets/` directory
5. Follow QA process from the pptx skill

### Template-Based Workflow

1. Use the pptx skill's editing workflow (unpack, edit XML, repack)
2. Reference the slide index in `references/slide-patterns.md` to find the right template slide
