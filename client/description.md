# Client-Side Implementation

This folder contains assets and support files for the client-side implementation of ChillFi3.

## Technology Stack
- **Framework**: Vanilla JavaScript (no external frameworks)
- **Styling**: Custom CSS with variables for theming
- **Icons**: Custom SVG icons with dynamic gradient theming
- **Audio Processing**: Web Audio API for visualization
- **Workers**: Web Workers for ID3 parsing and heavy processing

## Design Principles
- Dark theme with glassy UI elements
- Responsive design supporting screens from 344px (Z Fold) to desktop
- Abstract color gradients (purple/blue) and subtle animations
- Card-based content display
- Fixed media player with collapsible playlist on mobile
- Dynamic theme system with 5 built-in themes

## File Organization
- `js/app.js`: Core application entry point
- `js/content.js`: Content management and rendering
- `js/upload.js`: File upload handling
- `js/api.js`: API communication layer
- `js/auth.js`: Authentication management
- `css/main.css`: Main stylesheet with imports
- `css/theme/`: Theme-specific CSS files
- `css/components/`: Component-specific styles
- `icons/`: SVG icons with gradient effects
- `js/components/`: Modular UI components
- `js/utils/`: Helper functions and utilities
- `js/workers/`: Web Workers for background processing

## Responsive Breakpoints
- Desktop: > 1024px (full sidebar, three-column player)
- Laptop: 768px - 1024px (narrower sidebar)
- Tablet: 576px - 768px (collapsed sidebar with icons)
- Mobile: 400px - 576px (hidden sidebar with hamburger menu)
- Ultra-narrow: 344px - 400px (Z Fold support)

## Key Features
- Custom context menus for song interactions
- Playlist management with public/private options
- Media player with progress tracking
- Mobile-optimized controls with playlist popup
- Touch-friendly interactions
- Real-time audio visualizer with particle effects
- Dynamic theme switching with SVG icon theming
- URL-based navigation and sharing
- Upload progress tracking with success indicators
- Performance optimizations (image preloading, DOM batching)

## Component Architecture
- **ThemeSwitcher**: Dynamic theme management with SVG processing
- **Visualizer**: Canvas-based audio visualization with particle systems
- **ShareManager**: URL-based sharing with meta tag support
- **URLManager**: Browser history and navigation management
- **PlaylistManager**: Playlist CRUD operations with theming
- **UploadManager**: File processing with Web Workers and progress tracking
- **ContentManager**: Content rendering and section management

We should keep the code modular, breaking out various related functions into their own files for easy editing and organization.