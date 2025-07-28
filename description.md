# ChillFi3 - Private Music Library

## Overview
ChillFi3 is a sleek and modern private music library with rich features including the ability to upload songs, their album art, and extensive metadata. The application features a dark theme with a glassy look overall, using abstract colors and subtle animations throughout the interface while maintaining performance.

## Recent Major Improvements
- **Enhanced Performance**: Database indexes and optimized queries for faster loading
- **Better Architecture**: Modular services, middleware, and utilities for maintainability
- **Improved Security**: Rate limiting, input validation, and error handling
- **Mobile Optimization**: Fixed navbar and player positioning for better mobile experience
- **Enhanced ID3 Support**: Better metadata extraction supporting ID3v2.2, v2.3, and v2.4
- **Memory Management**: Fixed upload memory leaks for large file batches
- **Media Session API**: Android notification support with album art display
- **Global Error Handling**: Comprehensive error boundaries and centralized logging
- **Theme System**: Dynamic theme switching with 5 built-in themes and SVG icon theming
- **Audio Visualizer**: Real-time frequency analysis with particle effects and retro mountain landscape
- **Share System**: URL-based sharing for songs, albums, playlists, and user libraries with meta tags
- **Navigation System**: URL-based routing with proper browser history and active state management
- **Upload Optimization**: Batch processing with 10ms delays, progress tracking, and success indicators
- **Performance Optimization**: Image preloading, bfcache support, and CLS improvements

## Design Philosophy
- **Aesthetic**: Dark theme with glassy/frosted glass UI elements
- **Color Scheme**: Purple to blue gradients with abstract accents
- **Animations**: Subtle transitions and hover effects
- **Performance**: Optimized for smooth playback and navigation

## Responsive Design
The website is fully responsive and works well on all devices:
- **Desktop**: Full sidebar and three-column player layout
- **Tablet**: Collapsible sidebar with expandable navigation
- **Mobile**: Hamburger menu and simplified player controls
- **Ultra-narrow**: Support for screens down to 344px wide (Samsung Z Fold)

## Key Features

### User Profiles
- Personalized user profiles with customizable avatars
- Default avatar shows first letter of username
- Inline editing capabilities with pencil icon buttons
- Editable fields: avatar, username, and bio
- User bio for personal information
- Statistics tracking for uploaded songs and listens
- Recent uploads display with listen counts
- Accessible via user menu dropdown in header

### Media Player
- Classic media player bar fixed at the bottom of the page
- On desktop: Shows album art, song info, and full controls
- On mobile: Simplified controls with playlist popup button
- Progress tracking with interactive seeking
- Audio visualizer with real-time frequency analysis
- Particle effects synchronized to music
- Retro synthwave mountain landscape with moving camera
- FPS counter for performance monitoring

### Song Management
- Advanced upload system with drag-and-drop folder/directory support
- Recursive folder traversal for nested directory structures
- Client-side MP3 metadata extraction (ID3v2 tags)
- Automatic album art extraction and preview
- Web Worker-based processing to prevent UI blocking
- Real-time processing indicators and upload button management
- Sequential processing with 10ms delays for smooth DOM updates
- Skip/cancel/clear options for flexible file management
- Success indicators with checkmark icons
- Context menus for playlist and queue management

### Theme System
- 5 built-in themes: Default, Spotify, Sunset, Ocean, Synthwave
- Dynamic SVG icon theming with gradient colors
- Theme persistence across sessions
- Accessible via user menu dropdown
- Real-time theme switching without page reload

### Navigation & Sharing
- URL-based routing with browser history support
- Share songs, albums, playlists, and user libraries via URL
- Rich meta tags for social media previews
- Active navigation state management
- Back/forward cache optimization

### Playlist Features
- Create public and private playlists
- Share public playlists with other authenticated users via URL
- Drag and drop song organization
- Dynamic playlist icon theming
- Edit playlist metadata and remove songs

### Content Access
- All songs uploaded will be available to all users
- No content restrictions between users
- Listen statistics tracked for user uploads
- User profiles show upload history and statistics
- Search functionality with pagination
- Recently played tracking

## Technical Implementation
- **Client**: Vanilla JavaScript with modular component structure and Web Workers
- **UI Framework**: Custom CSS component system with unified modal management
- **Metadata Processing**: Enhanced ID3v2 tag parsing with Web Worker optimization
- **Theme System**: Dynamic CSS variable manipulation with SVG blob URL generation
- **Audio Visualization**: Canvas-based real-time frequency analysis with particle systems
- **Navigation**: URL-based routing with URLManager utility and browser history
- **Performance**: Image preloading, bfcache optimization, CLS prevention, DOM batching
- **Server**: NodeJS with modular architecture, services, and middleware
- **Real-time Communication**: Socket.io with rate limiting and error handling
- **Storage**: AWS S3 for audio files, MySQL with performance indexes
- **Authentication**: JWT-based with rate limiting and admin-controlled user management
- **Sharing**: PHP-based meta tag generation for social media previews
- **Caching**: Private cache headers for bfcache support
- **Testing**: Jest framework with unit tests for core services

## Reference Implementation
The `sample.html` file provides a comprehensive reference implementation of the UI, demonstrating the responsive design, component structure, and interaction patterns.