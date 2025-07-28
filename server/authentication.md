# Authentication Implementation

## Overview
ChillFi3 uses token-based authentication for API requests. This document outlines how authentication is implemented and which endpoints require authentication.

## Authentication Flow

1. **Login Process**:
   - User submits credentials via `auth:login`
   - Server validates credentials and issues a JWT token
   - Token contains user ID and role information
   - Token is returned to client and stored locally

2. **Request Authentication**:
   - Client includes token in Socket.IO connection handshake
   - Server validates token on connection
   - User information is attached to socket instance
   - Subsequent requests use the authenticated socket

3. **Token Refresh**:
   - Tokens expire after 7 days
   - Client can refresh token using `auth:refresh` before expiration
   - New token is issued with reset expiration time

## Socket.IO Authentication

```javascript
// Socket.IO connection with authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      // Allow connection without authentication for public endpoints
      socket.authenticated = false;
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is expired
    if (decoded.exp < Date.now() / 1000) {
      return next(new Error('Token expired'));
    }
    
    // Get user from database
    const user = await db.getUserById(decoded.userId);
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    // Attach user to socket
    socket.user = user;
    socket.authenticated = true;
    
    next();
  } catch (error) {
    return next(new Error('Authentication failed'));
  }
});
```

## Authentication Requirements by Endpoint

### Public Endpoints
- Authentication: `auth:login`, `auth:useResetToken`
- Content: `song:list`, `song:get`, `song:play`, `song:getListens` (public only)
- User: `user:profile` (public info only)
- Playlists: `playlist:get` (public only)

### User Endpoints
- Authentication: `auth:logout`, `auth:refresh`
- User: `user:update`, `user:uploadAvatar`, `user:getStats`, `user:getUploads` (own only)
- Content: `song:upload`, `song:update`, `song:delete` (own only)
- Playlists: All playlist operations (own only)
- Player: All player operations

### Admin Endpoints
- User management: `auth:createUser`, `auth:setPassword`, `auth:resetPassword`
- Content management: Update/delete any user's content
- Access to all user profiles and statistics

## Permission Checking

```javascript
// Example permission check for updating user profile
socket.on('user:update', async (data) => {
  try {
    // Check if user is authenticated
    if (!socket.authenticated) {
      throw new Error('Authentication required');
    }
    
    const { userId, updates } = data;
    
    // Check if user has permission (own profile or admin)
    if (socket.user.id !== userId && !socket.user.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    // Proceed with update
    const updatedUser = await db.updateUser(userId, updates);
    
    socket.emit('user:update', { success: true, user: updatedUser });
  } catch (error) {
    socket.emit('error', { message: 'Failed to update profile', error: error.message });
  }
});
```