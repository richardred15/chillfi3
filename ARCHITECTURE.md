# ChillFi3 Technical Architecture

## System Overview

ChillFi3 is a modern web-based private music library built with a client-server architecture using vanilla JavaScript on the frontend and Node.js on the backend. The system emphasizes performance, user experience, and maintainability through modular design patterns.

## Frontend Architecture

### Technology Stack
- **Framework**: Vanilla JavaScript (ES6+ modules)
- **Styling**: Custom CSS with CSS custom properties
- **Build Process**: None (direct ES6 module loading)
- **Audio Processing**: Web Audio API
- **Background Processing**: Web Workers
- **Real-time Communication**: Socket.IO client

### Component Architecture

```
Client Application
├── Core Modules
│   ├── app.js (Application entry point)
│   ├── api.js (API communication layer)
│   ├── auth.js (Authentication management)
│   └── content.js (Content rendering)
├── Components
│   ├── themeSwitcher.js (Dynamic theme system)
│   ├── visualizer.js (Audio visualization)
│   ├── shareManager.js (URL sharing system)
│   ├── playlistManager.js (Playlist operations)
│   ├── uploadManager.js (File upload handling)
│   └── mountainRenderer.js (3D landscape rendering)
├── Utilities
│   ├── urlManager.js (Browser history management)
│   ├── fileHandlers.js (File processing utilities)
│   └── id3Parser.js (Metadata extraction)
└── Workers
    ├── id3Worker.js (Background metadata parsing)
    └── id3Parser-worker.js (Legacy worker)
```

### State Management
- **Global State**: Managed through singleton classes and module exports
- **Component State**: Local state within component classes
- **Persistence**: localStorage for user preferences and authentication
- **Real-time Updates**: Socket.IO event-driven updates

### Performance Optimizations

#### Image Loading
- **Preloading**: First 3 album art images preloaded for better LCP
- **Lazy Loading**: Images loaded as needed during scrolling
- **Caching**: Browser cache leveraged with proper headers

#### DOM Optimization
- **Batched Updates**: 10ms delays between DOM manipulations
- **CLS Prevention**: Min-height on sections to prevent layout shifts
- **Virtual Scrolling**: Planned for large lists

#### Memory Management
- **Blob URL Cleanup**: Automatic cleanup of generated blob URLs
- **Event Listener Management**: Proper cleanup on component destruction
- **Web Worker Lifecycle**: Workers terminated when not needed

## Backend Architecture

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js with Socket.IO
- **Database**: MySQL with connection pooling
- **File Storage**: AWS S3
- **Authentication**: JWT tokens
- **Security**: Helmet, CORS, rate limiting

### Service Architecture

```
Server Application
├── Core Services
│   ├── server.js (Main server entry point)
│   ├── database.js (Database connection & schema)
│   ├── auth.js (Authentication & authorization)
│   └── api.js (RESTful API endpoints)
├── Domain Services
│   ├── users.js (User management)
│   ├── songs.js (Music library operations)
│   ├── playlists.js (Playlist management)
│   └── player.js (Queue management)
├── Utilities
│   ├── logger.js (Centralized logging)
│   ├── response.js (Standardized responses)
│   └── validation.js (Input validation)
└── Middleware
    ├── rateLimiter.js (Rate limiting)
    ├── sqlSecurity.js (SQL injection prevention)
    └── validation.js (Request validation)
```

### Database Schema

#### Core Tables
- **users**: User accounts and profiles
- **songs**: Music metadata and file references
- **albums**: Album information and artwork
- **artists**: Artist information
- **playlists**: User-created playlists
- **playlist_songs**: Playlist-song relationships
- **song_listens**: Listen tracking and statistics

#### Indexes
- Performance indexes on frequently queried columns
- Composite indexes for complex queries
- Full-text search indexes for metadata

### File Storage Architecture

#### AWS S3 Structure
```
chillfi/
├── songs/ (Audio files - MP3 format)
├── album_art/ (Album artwork - JPEG/PNG)
└── profiles/ (User profile images)
```

#### File Processing Pipeline
1. **Client Upload**: Files selected via drag-and-drop or file picker
2. **Metadata Extraction**: ID3 tags parsed client-side using Web Workers
3. **Server Processing**: Audio conversion to MP3, header stripping
4. **S3 Upload**: Files stored with randomized hash filenames
5. **Database Storage**: Metadata and file references stored in MySQL

## Theme System Architecture

### Dynamic Theming
- **CSS Custom Properties**: Theme colors defined as CSS variables
- **Theme Files**: Separate CSS files for each theme
- **Runtime Switching**: JavaScript-based theme loading and switching
- **SVG Processing**: Dynamic gradient application to SVG icons

### Theme Implementation
```javascript
// Theme structure
{
  'default': 'Default',
  'spotify': 'Spotify', 
  'sunset': 'Sunset',
  'ocean': 'Ocean',
  'synthwave': 'Synthwave'
}
```

### SVG Icon Theming
1. **Detection**: Icons marked with `data-theme-svg="true"`
2. **Processing**: SVG content fetched and colors replaced
3. **Blob Generation**: Modified SVG converted to blob URL
4. **Application**: Blob URL applied to image src

## Audio Visualization Architecture

### Visualization Pipeline
1. **Audio Analysis**: Web Audio API frequency analysis
2. **Data Processing**: Frequency data smoothing and normalization
3. **Particle System**: 50 particles with physics simulation
4. **Waveform Rendering**: Canvas-based waveform with trails
5. **3D Landscape**: Procedural mountain generation with camera movement

### Performance Considerations
- **Animation Frame Management**: RequestAnimationFrame for smooth rendering
- **Canvas Optimization**: Efficient drawing operations
- **Memory Management**: Cleanup of animation resources
- **FPS Monitoring**: Built-in performance tracking

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with 7-day expiration
- **Password Security**: bcrypt hashing with salt rounds
- **Session Management**: Multiple concurrent sessions supported
- **Admin Controls**: Restricted user management operations

### Input Validation
- **Client-side**: Basic validation for user experience
- **Server-side**: Comprehensive validation and sanitization
- **SQL Injection Prevention**: Parameterized queries and validation
- **File Upload Security**: Type validation and size limits

### Network Security
- **HTTPS**: TLS encryption for all communications
- **CORS**: Configured for specific origins
- **Rate Limiting**: Protection against abuse
- **Helmet**: Security headers for common vulnerabilities

## Performance Architecture

### Client-side Performance
- **Code Splitting**: Modular loading of components
- **Asset Optimization**: Compressed images and optimized SVGs
- **Caching Strategy**: Aggressive caching with cache busting
- **Bundle Size**: No build process, direct ES6 modules

### Server-side Performance
- **Database Optimization**: Indexed queries and connection pooling
- **Caching**: In-memory caching for frequently accessed data
- **File Streaming**: Efficient audio file delivery
- **Resource Management**: Proper cleanup and memory management

### Network Performance
- **CDN Ready**: Static assets optimized for CDN delivery
- **Compression**: Gzip compression for text assets
- **HTTP/2**: Modern protocol support
- **Preloading**: Critical resource preloading

## Deployment Architecture

### Production Environment
- **Server**: AWS EC2 instance
- **Database**: AWS RDS MySQL
- **Storage**: AWS S3 bucket
- **SSL**: Let's Encrypt certificates
- **Reverse Proxy**: Nginx for static file serving

### Development Environment
- **Local Server**: Node.js development server
- **Database**: Local MySQL or Docker container
- **Storage**: Local S3 compatible storage (MinIO)
- **Hot Reload**: Manual refresh (no build process)

## Monitoring & Logging

### Application Monitoring
- **Error Tracking**: Centralized error logging
- **Performance Metrics**: Response time and throughput monitoring
- **User Analytics**: Usage patterns and feature adoption
- **System Health**: Server resource monitoring

### Debugging Tools
- **Console Logging**: Structured logging with levels
- **Network Inspection**: Socket.IO event monitoring
- **Performance Profiling**: Browser dev tools integration
- **Database Queries**: Query performance analysis

## Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: No server-side session storage
- **Database Scaling**: Read replicas and sharding potential
- **File Storage**: S3 provides unlimited scalability
- **Load Balancing**: Architecture supports multiple server instances

### Vertical Scaling
- **Resource Optimization**: Efficient memory and CPU usage
- **Database Tuning**: Query optimization and indexing
- **Caching Layers**: Multiple levels of caching
- **Connection Pooling**: Efficient database connection management

## Future Architecture Considerations

### Microservices Migration
- **Service Separation**: Auth, media, user services
- **API Gateway**: Centralized API management
- **Message Queues**: Asynchronous processing
- **Container Orchestration**: Docker and Kubernetes

### Progressive Web App
- **Service Workers**: Offline functionality
- **App Manifest**: Native app-like experience
- **Push Notifications**: Real-time user engagement
- **Background Sync**: Offline operation support

### Advanced Features
- **Real-time Collaboration**: Shared playlist editing
- **Machine Learning**: Music recommendation engine
- **Analytics Platform**: Advanced usage analytics
- **Plugin System**: Third-party integrations