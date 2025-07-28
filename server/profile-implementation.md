# User Profile Implementation

## Overview
This document outlines the server-side implementation details for user profiles in ChillFi3.

## Profile Data Storage
- User profile data is stored in the `users` table
- Profile images are stored in the S3 bucket under `profiles/` directory
- Listen statistics are calculated from the `song_listens` table

## API Endpoints

### Profile Retrieval
```javascript
// Get user profile with statistics
socket.on('user:profile', async (data) => {
  try {
    const { userId } = data;
    
    // Get user data
    const user = await db.getUserById(userId);
    
    // Get user statistics
    const stats = await db.getUserStats(userId);
    
    // Get recent uploads
    const recentUploads = await db.getUserRecentUploads(userId, 5);
    
    socket.emit('user:profile', { user, stats, recentUploads });
  } catch (error) {
    socket.emit('error', { message: 'Failed to retrieve profile', error: error.message });
  }
});
```

### Profile Updates
```javascript
// Update user profile
socket.on('user:update', async (data) => {
  try {
    const { userId, updates } = data;
    
    // Validate user has permission
    if (socket.user.id !== userId && !socket.user.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    // Update user data
    const updatedUser = await db.updateUser(userId, updates);
    
    socket.emit('user:update', { success: true, user: updatedUser });
  } catch (error) {
    socket.emit('error', { message: 'Failed to update profile', error: error.message });
  }
});
```

### Avatar Upload
```javascript
// Upload profile image
socket.on('user:uploadAvatar', async (data) => {
  try {
    const { userId, imageFile } = data;
    
    // Validate user has permission
    if (socket.user.id !== userId && !socket.user.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    // Process and upload image
    const filename = `${userId}-${Date.now()}.jpg`;
    const profileImageUrl = await uploadToS3(imageFile, 'profiles/' + filename);
    
    // Update user record
    await db.updateUser(userId, { profile_image_url: profileImageUrl });
    
    socket.emit('user:uploadAvatar', { success: true, profileImageUrl });
  } catch (error) {
    socket.emit('error', { message: 'Failed to upload avatar', error: error.message });
  }
});
```

## Listen Tracking

### Record Listen
```javascript
// Record a song listen
socket.on('song:recordListen', async (data) => {
  try {
    const { songId } = data;
    const userId = socket.user ? socket.user.id : null;
    
    // Record listen in database
    await db.recordSongListen(songId, userId);
    
    // Get updated listen count
    const listenCount = await db.getSongListenCount(songId);
    
    socket.emit('song:recordListen', { success: true, listenCount });
  } catch (error) {
    socket.emit('error', { message: 'Failed to record listen', error: error.message });
  }
});
```

### Get Listen Statistics
```javascript
// Get listen statistics for a song
socket.on('song:getListens', async (data) => {
  try {
    const { songId } = data;
    
    // Get total listen count
    const total = await db.getSongListenCount(songId);
    
    // Get recent listens
    const recentListens = await db.getRecentSongListens(songId, 10);
    
    socket.emit('song:getListens', { total, recentListens });
  } catch (error) {
    socket.emit('error', { message: 'Failed to get listen statistics', error: error.message });
  }
});
```

## Database Functions

### User Statistics
```javascript
// Get user statistics
async function getUserStats(userId) {
  // Get upload count
  const uploadCount = await db.query(
    'SELECT COUNT(*) as count FROM songs WHERE uploaded_by = ?',
    [userId]
  );
  
  // Get total listens for user's uploads
  const totalListens = await db.query(
    'SELECT COUNT(*) as count FROM song_listens sl ' +
    'JOIN songs s ON sl.song_id = s.id ' +
    'WHERE s.uploaded_by = ?',
    [userId]
  );
  
  // Get top songs by listen count
  const topSongs = await db.query(
    'SELECT s.id, s.title, COUNT(sl.id) as listen_count ' +
    'FROM songs s ' +
    'LEFT JOIN song_listens sl ON s.id = sl.song_id ' +
    'WHERE s.uploaded_by = ? ' +
    'GROUP BY s.id ' +
    'ORDER BY listen_count DESC ' +
    'LIMIT 5',
    [userId]
  );
  
  return {
    uploadCount: uploadCount[0].count,
    totalListens: totalListens[0].count,
    topSongs
  };
}
```