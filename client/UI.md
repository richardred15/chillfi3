# ChillFi3 UI Design System

## Theme System
ChillFi3 features a dynamic theme system with 5 built-in themes:

### Default Theme
- **Background Primary**: `#121212` (Dark background)
- **Background Secondary**: `#181818` (Slightly lighter background)
- **Background Elevated**: `#282828` (Elevated elements)
- **Text Primary**: `#ffffff` (White text)
- **Text Secondary**: `#b3b3b3` (Light gray text)
- **Accent Primary**: `#8c67ef` (Purple accent)
- **Accent Secondary**: `#4f9eff` (Blue accent)
- **Glass Background**: `rgba(30, 30, 30, 0.7)` (Semi-transparent dark)
- **Glass Border**: `rgba(255, 255, 255, 0.1)` (Subtle white border)

### Additional Themes
- **Spotify**: Green and black color scheme
- **Sunset**: Orange to pink gradients
- **Ocean**: Blue to teal gradients  
- **Synthwave**: Pink to cyan retro colors

### Theme Implementation
- CSS custom properties for dynamic color switching
- SVG icon theming with blob URL generation
- Theme persistence in localStorage
- Real-time theme switching without page reload

## Typography
- **Primary Font**: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
- **Headings**: 24px, bold
- **Subheadings**: 18px, semi-bold
- **Body Text**: 14px, regular
- **Small Text**: 12px, regular
- **Micro Text**: 10px (for ultra-narrow screens)

## Components

### Upload Modal
- Glassy background with backdrop blur
- Drag and drop for files and folders with recursive directory traversal
- Client-side MP3 metadata extraction using Web Workers
- Automatic ID3v2 tag parsing (title, artist, album, genre, year, track)
- Album art extraction and preview from embedded APIC frames
- Real-time processing indicators with loading states
- Upload button management (disabled during processing)
- Sequential processing with 10ms delays for smooth DOM updates
- Skip/cancel/clear options for flexible file management
- Success indicators with checkmark icons (16x16px, white, bold)
- Accessible via upload button in header

### Audio Visualizer
- Full-screen canvas overlay with close button
- Real-time frequency analysis using Web Audio API
- Particle system synchronized to music (50 particles, dimmed opacity)
- Waveform display with gradient colors and trails
- Retro synthwave mountain landscape with moving camera
- Sun image positioned at horizon with fade effect
- Scanlines and retro effects for aesthetic appeal
- FPS counter for performance monitoring
- Escape key support for quick exit

### Theme Selector
- Integrated into user menu dropdown
- 5 theme options with color previews
- Active theme indication with checkmark
- Click-to-switch functionality
- Theme persistence across sessions

### User Profile
- User avatar with first letter of username (default)
- Option for custom profile picture upload
- Edit buttons with pencil icons for editable fields
- User bio section for personal information
- Statistics for uploaded songs and listens
- Recent uploads list with listen counts
- Accessible via user menu dropdown

### User Menu
- Avatar with first letter of username
- Username display
- Dropdown with profile and logout options
- Positioned in header area

### Popups & Modals
- **Unified Modal System**: Generic Modal class for consistent behavior
- Glassy background with backdrop blur
- Desktop: Compact size (320px) appearing from right side
- Mobile: Full-width sliding up from bottom
- Visible header with title and close buttons
- Content area with relevant information
- Toggle behavior with hamburger/queue buttons
- **Click Outside Behavior**: Clicking outside any modal closes it without triggering underlying page elements
- **Close Validation**: Optional validation functions to prevent closing during operations
- **Custom Events**: Emits modal:show and modal:hide events for integration

### Share Modal
- Displays item information (song/album/playlist)
- Generated shareable URL with meta tags
- Copy-to-clipboard functionality
- Social media preview support

### Cards
- Glassy background with subtle border
- Hover effect: slight elevation and background change
- Album art with gradient overlay
- Play button appears on hover (desktop) and touch (mobile)
- **Mobile Touch Behavior**: Single active card with play button visibility
- **Touch Outside**: Tapping outside cards hides active play button
- Truncated text with ellipsis

### Buttons
- **Primary**: Gradient background (purple to blue)
- **Secondary**: Dark background with border
- **Icon Buttons**: Circular with centered icon
- **Play Button**: Larger, with accent gradient
- **Icon Visibility**: Icons use brightness filters for contrast against gradient backgrounds

### Navigation
- Collapsible sidebar with icon and text
- Active state with glassy background
- Mobile: Icon-only with hamburger toggle

### Media Player
- Fixed bottom bar with backdrop blur
- Progress bar with gradient fill
- Desktop: Three-column layout (now playing, controls, options)
  - Queue button in options column opens Now Playing popup
- Mobile: Simplified with centered controls
  - Now Playing button positioned on right side
  - Button has higher z-index to ensure clickability
  - Touch-optimized with proper event handling

### Context Menu
- Glassy background with subtle border
- Icon + text items with hover state
- Separator lines between groups

## Responsive Behavior

### Desktop (>1024px)
- Full sidebar (240px)
- Three-column player layout
- Full context menu

### Laptop (768px-1024px)
- Narrower sidebar (200px)
- Maintained three-column player

### Tablet (576px-768px)
- Collapsed sidebar (icons only, 70px)
- Expandable on click
- Maintained player layout

### Mobile (400px-576px)
- Horizontal navigation bar at top
- Simplified player with centered controls
- Now playing popup button integrated with player controls
- Full-width search bar
- Two-column card grid

### Ultra-narrow (344px-400px)
- Minimal UI with reduced spacing
- Smaller controls and text
- Hidden secondary elements
- Optimized touch targets

## Animations & Effects
- Subtle hover transitions (0.2s)
- Smooth sidebar expansion
- Popup elements with appropriate animations:
  - Desktop: Fade in/out with slight scale
  - Mobile: Slide up/down from bottom
- Card hover elevation with play button reveal
- Progress bar gradient animation
- Volume slider interactive handle

## Interaction Guidelines
- All interactive elements should have appropriate hover states
- Touch targets should be at least 44×44px on mobile
- Use `touch-action: manipulation` for better touch response
- Prevent tap highlight with `-webkit-tap-highlight-color: transparent`
- Ensure proper z-index layering for overlapping elements
- Use `pointer-events: none` for invisible elements that shouldn't block interaction
- **Custom Scrollbars**: 8px width with glass border styling and hover effects
- **Web Worker Integration**: Heavy processing moved off main thread for UI responsiveness
- **Loading States**: Visual indicators during async operations with disabled controls
- **Theme Switching**: Instant visual feedback with SVG icon updates
- **Navigation States**: Active states for current section/playlist
- **Upload Feedback**: Progress indicators and success checkmarks
- **Performance Optimization**: Image preloading for LCP improvement
- **DOM Batching**: 10ms delays between DOM updates for smooth rendering
- **CLS Prevention**: Min-height on sections to prevent layout shifts