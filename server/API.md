# ChillFi3 API Documentation

## HTTP REST Endpoints

### Public Endpoints (No Authentication Required)

#### OpenGraph Metadata
- `GET /api/og/song/:id` - Get song metadata for social sharing
  - Response: `{ title, artist, album, image }`
- `GET /api/og/album?name=:name&artist=:artist` - Get album metadata by name
- `GET /api/og/album?id=:id` - Get album metadata by ID
  - Response: `{ album, artist, image, songCount }`
- `GET /api/og/library/:username` - Get user library metadata
  - Response: `{ username, songCount, albumCount, image }`
- `GET /api/og/artist/:name` - Get artist metadata
  - Response: `{ artist, songCount, albumCount, image }`

#### System
- `GET /api/health` - Health check endpoint
  - Response: `{ status: "ok", timestamp }`

### Upload Endpoints
- `POST /api/upload/*` - File upload endpoints (see routes/upload.js)

### Rate Limiting
- OpenGraph endpoints: 60 requests per minute per IP
- Upload endpoints: 2 requests per second per IP
- General API: 10 requests per second per IP

## Socket.IO Events

### Connection
All Socket.IO communication requires authentication except for initial connection.

#### Authentication Required
Most Socket.IO events require a valid JWT token passed during connection or via authentication events.

### Connection Events
- `connect`: Emitted when client connects to server
- `disconnect`: Emitted when client disconnects  
- `error`: Emitted on connection error

### Lazy Loading
Socket.IO handlers are loaded on-demand when first accessed to improve performance.

### Authentication Events
- `auth:login`: Authenticate user
  - Request: `{ username, password }`
  - Response: `{ success, token, user }`
- `auth:createUser`: Create new user (admin only)
  - Request: `{ username, password, isAdmin }`
  - Response: `{ success, message, resetToken }`
- `auth:setPassword`: Admin sets user password (admin only)
  - Request: `{ userId, password }`
  - Response: `{ success }`
- `auth:resetPassword`: Admin generates reset token (admin only)
  - Request: `{ userId }`
  - Response: `{ success, resetToken }`
- `auth:useResetToken`: User sets password with reset token
  - Request: `{ resetToken, newPassword }`
  - Response: `{ success }`
- `auth:logout`: Logout user
  - Request: `{ token }`
  - Response: `{ success }`
- `auth:refresh`: Refresh authentication token
  - Request: `{ token }`
  - Response: `{ success, newToken }`

### User Events
- `user:profile`: Get user profile
  - Request: `{ userId }`
  - Response: `{ user, stats, recentUploads }`
- `user:update`: Update user profile
  - Request: `{ userId, updates }` (updates can include username, bio)
  - Response: `{ success, user }`
- `user:uploadAvatar`: Upload profile picture
  - Request: `{ userId, imageFile }`
  - Response: `{ success, profileImageUrl }`
- `user:getStats`: Get user statistics
  - Request: `{ userId }`
  - Response: `{ uploadCount, totalListens, topSongs }`
- `user:getUploads`: Get user uploaded songs
  - Request: `{ userId, page, limit }`
  - Response: `{ songs, total, page }`

### Song Events
- `song:list`: Get list of songs
  - Request: `{ filters, page, limit }`
  - Response: `{ songs, total, page }`
- `song:get`: Get song details
  - Request: `{ songId }`
  - Response: `{ song }`
- `song:uploadInit`: Initialize upload session
  - Request: `{ fileCount, totalSize }`
  - Response: `{ success, uploadId }`
- `song:upload`: Upload new song
  - Request: `{ uploadId, fileIndex, file, metadata }`
  - Response: `{ success, songId, progress }`
- `song:uploadProgress`: Server push progress updates
  - Response: `{ uploadId, fileIndex, progress }`
- `song:uploadControl`: Control upload process
  - Request: `{ uploadId, action }` (action: 'skip' or 'cancel')
  - Response: `{ success }`
- `song:update`: Update song metadata
  - Request: `{ songId, metadata }`
  - Response: `{ success, song }`
- `song:delete`: Delete song
  - Request: `{ songId }`
  - Response: `{ success }`
- `song:play`: Get playback URL and record listen
  - Request: `{ songId }`
  - Response: `{ url, metadata }`
- `song:recordListen`: Record a song listen event
  - Request: `{ songId }`
  - Response: `{ success, listenCount }`
- `song:getListens`: Get listen statistics for a song
  - Request: `{ songId }`
  - Response: `{ total, recentListens }`

### Playlist Events
- `playlist:list`: Get user playlists
  - Request: `{ userId }`
  - Response: `{ playlists }`
- `playlist:get`: Get playlist details
  - Request: `{ playlistId }`
  - Response: `{ playlist, songs }`
- `playlist:create`: Create new playlist
  - Request: `{ name, isPublic }`
  - Response: `{ success, playlistId }`
- `playlist:update`: Update playlist
  - Request: `{ playlistId, updates }`
  - Response: `{ success, playlist }`
- `playlist:delete`: Delete playlist
  - Request: `{ playlistId }`
  - Response: `{ success }`
- `playlist:addSong`: Add song to playlist
  - Request: `{ playlistId, songId }`
  - Response: `{ success }`
- `playlist:removeSong`: Remove song from playlist
  - Request: `{ playlistId, songId }`
  - Response: `{ success }`
- `playlist:share`: Get shareable link for playlist
  - Request: `{ playlistId }`
  - Response: `{ url }`

### Player Events
- `player:queue`: Get current queue
  - Response: `{ queue }`
- `player:addToQueue`: Add song to queue
  - Request: `{ songId }`
  - Response: `{ success, queue }`
- `player:removeFromQueue`: Remove song from queue
  - Request: `{ index }`
  - Response: `{ success, queue }`
- `player:status`: Get current player status
  - Response: `{ playing, currentSong, position }`

## Error Handling

### HTTP Endpoints
HTTP endpoints return standard status codes:
- `200` - Success
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

### Socket.IO Events
Socket.IO events can return error objects:
```javascript
{
  error: true,
  code: 400-500,
  message: "Error description"
}
```

## Security Features

### Rate Limiting
- IP-based rate limiting on all endpoints
- Different limits for different endpoint types
- Automatic cleanup of rate limit data

### Authentication
- JWT-based authentication for Socket.IO
- Session management with database storage
- Password hashing with bcrypt

### CORS
- Configurable CORS origins
- Credentials support for authenticated requests

### Headers
- Security headers via Helmet.js
- Content Security Policy
- XSS Protection

## Database Schema
See `server/schema.json` for complete database schema definition.

## Database Management
The database schema is automatically created when the server starts. No manual setup required.

## Admin User Creation
The first user created through the web interface automatically becomes an admin. No CLI commands needed.