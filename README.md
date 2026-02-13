# Arena — Sports Streaming Platform

A modern sports streaming UI inspired by Rumble's design language.

## Quick Start

```bash
# Open in browser directly
open public/index.html

# Or serve locally
npx serve public -l 3000
```

## Project Structure

```
arena-sports/
├── public/
│   └── index.html          # Entry point
├── src/
│   ├── styles/
│   │   ├── variables.css    # Design tokens & CSS variables
│   │   ├── base.css         # Reset, scrollbar, typography
│   │   ├── header.css       # Top navigation bar
│   │   ├── sidebar.css      # Left filter sidebar
│   │   ├── hero.css         # Featured live match hero
│   │   ├── ticker.css       # Live scores ticker strip
│   │   ├── cards.css        # Video/stream cards grid
│   │   ├── schedule.css     # Upcoming matches table
│   │   ├── animations.css   # Keyframes & transitions
│   │   └── responsive.css   # Breakpoints & mobile
│   ├── components/
│   │   └── app.js           # Interactive JS (search, filters, etc.)
│   └── assets/              # Images, icons (add your own)
├── package.json
└── README.md
```

## Customization

- **Colors**: Edit `src/styles/variables.css`
- **Layout**: Adjust sidebar width, header height in variables
- **Content**: Update cards and data in `index.html`
- **Interactivity**: Extend `src/components/app.js`

## Tech Stack

- Pure HTML / CSS / JS — no framework dependencies
- Google Fonts (Bebas Neue, Oswald, DM Sans)
- Ready to migrate to React/Next.js/Vue
