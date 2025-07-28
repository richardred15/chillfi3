# Client-Server Interactions

This document outlines how the client and server components of ChillFi3 interact with each other.

## Communication Protocol

ChillFi3 uses Socket.io for real-time bidirectional communication between client and server. This enables:

- Real-time updates to playlists and song metadata
- Immediate notification of new uploads
- Efficient event-based communication

## Authentication Flow

1. **Login Request**:
   - Client sends username/password to server
   - Server validates credentials and returns JWT token
   - Client stores token for subsequent requests

2. **Token Validation**:
   - Client includes token in all Socket.io connections
   - Server validates token on connection and for privileged events
   - Server refreshes token before expiration (7 days)

3. **Admin User Management**:
   - Admins can create new users (with or without password)
   - If no password set, admin receives reset token to share
   - Users can set password using reset token

## Data Flow

### Song Playback
1. Client requests song URL via `song:play` event
2. Server generates temporary S3 URL for the requested song
3. Client receives URL and begins playback
4. Server records play count and history

### Song Upload
1. Client sends file and metadata via Socket.io (chunked if large)
2. Server processes audio:
   - Converts to MP3 format
   - Strips headers
   - Generates unique hash filename
3. Server uploads to S3 bucket in `songs/` directory
4. Server stores metadata in SQL database
5. Server broadcasts new song availability to all connected clients

### Playlist Management
1. Client creates/modifies playlist via Socket.io events
2. Server updates database with changes
3. Server generates shareable URL for public playlists
4. Server notifies relevant users of shared playlists

### Metadata Editing
1. Client sends updated metadata via context menu
2. Server validates and stores changes in database
3. Server broadcasts changes to all connected clients

## Error Handling

- Network disconnections trigger automatic reconnection attempts
- Failed uploads are retried with exponential backoff
- Validation errors return descriptive messages to the client
- Server logs all errors for monitoring

## Performance Considerations

- Large file transfers are chunked to prevent memory issues
- Metadata is cached on the client to reduce server load
- Connection state is monitored and displayed to the user
- Batch operations are used when possible to reduce round trips