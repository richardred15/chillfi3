# ChillFi3 Component Structure

## Core Components

### Layout Components
- **AppContainer**: Main application wrapper
- **Sidebar**: Navigation and playlists sidebar with dynamic theming
- **Header**: Search and user profile with theme selector
- **MainContent**: Content area with scrolling and section management
- **Player**: Fixed media player bar with visualizer integration

### Navigation Components
- **NavItem**: Individual navigation item with active state management
- **NavSection**: Grouped navigation items
- **PlaylistItem**: Individual playlist in sidebar with themed icons
- **UserMenu**: User profile and options with theme selector

### Content Components
- **CardGrid**: Grid layout for albums/playlists with image preloading
- **Card**: Individual album/playlist card with hover effects
- **SongList**: List of songs with context menus
- **SongItem**: Individual song in list with playback controls

### Player Components
- **NowPlaying**: Currently playing song info
- **PlayerControls**: Play/pause/skip controls
- **ProgressBar**: Song progress indicator
- **VolumeControl**: Volume slider
- **PlaylistPopup**: Mobile playlist popup
- **Visualizer**: Real-time audio visualization with particle effects

### Theme Components
- **ThemeSwitcher**: Dynamic theme management and SVG processing
- **ThemeSelector**: Theme selection UI in user menu

### Utility Components
- **ShareManager**: URL-based sharing with meta tag generation
- **URLManager**: Browser history and navigation management
- **UploadManager**: File upload with Web Workers and progress tracking
- **PlaylistManager**: Playlist CRUD operations with theming
- **ContentManager**: Content rendering and section management

### Interactive Components
- **ContextMenu**: Right-click/long-press menu
- **SearchBar**: Search input with icon
- **ModalDialog**: Popup dialogs with unified behavior
- **Toast**: Notification messages

## Component Hierarchy

```
AppContainer
├── Sidebar
│   ├── Logo (themed)
│   ├── NavSection
│   │   └── NavItem (with active state)
│   └── PlaylistSection
│       └── PlaylistItem (themed icons)
├── Header
│   ├── SearchBar
│   └── UserMenu
│       └── ThemeSelector
├── MainContent
│   ├── Section (with min-height for CLS prevention)
│   │   ├── SectionHeader
│   │   └── CardGrid (with image preloading)
│   │       └── Card
│   └── SongList
│       └── SongItem (with context menu)
├── Player
│   ├── NowPlaying
│   ├── PlayerControls
│   │   └── ProgressBar
│   ├── PlayerOptions
│   │   ├── VolumeControl
│   │   └── VisualizerButton
│   └── Visualizer (overlay)
│       ├── Canvas (particles & waveform)
│       ├── MountainRenderer
│       └── FPS Counter
├── PlaylistPopup
│   ├── PlaylistHeader
│   └── PlaylistItems
├── ContextMenu
│   └── ContextMenuItem
├── UploadModal
│   ├── FileDropzone
│   ├── FileList (with progress indicators)
│   └── UploadProgress
├── ShareModal
│   └── URLDisplay
└── ThemeSwitcher (global utility)
```

## State Management

### Global State
- Current user
- Playback state
- Current playlist
- Queue
- Active theme
- Navigation state (URL parameters)
- Upload progress

### Component State
- UI visibility toggles
- Form inputs
- Hover/active states
- Theme switching state
- Visualizer animation state
- Upload file processing state

## Event Handling

### User Interactions
- Click/tap events
- Right-click/long-press for context menu
- Drag and drop for playlist management and file upload
- Scroll events for content navigation
- Theme selection events
- URL navigation events

### Playback Events
- Play/pause/skip
- Progress updates
- Volume changes
- Queue management
- Visualizer frequency data updates

### System Events
- File upload progress
- Theme change propagation
- URL state changes
- Web Worker message handling

## Responsive Behavior

Components will adapt based on screen size:
- **Sidebar**: Collapses to icons or hides on mobile
- **Player**: Simplifies on mobile with popup for details
- **CardGrid**: Adjusts columns based on available width
- **ContextMenu**: Positions based on available space