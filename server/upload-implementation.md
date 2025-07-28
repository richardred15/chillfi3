# Upload Implementation

## Overview
This document outlines the server-side implementation details for the sequential upload system in ChillFi3.

## Upload Process Flow

1. **Client-Side Preparation**
   - User selects files/folders; client traverses directories recursively
   - Metadata extraction and editing before upload

2. **Upload Initialization**
   - Client sends file count/size; server generates tracking ID

3. **Sequential Processing**
   - One-by-one upload to optimize bandwidth
   - Process: temp storage → convert → optimize → permanent storage → database

4. **Progress Tracking**
   - Server maintains state and pushes updates to client

5. **Cancellation Support**
   - Skip individual files or cancel entire batch
   - Server handles cleanup of temporary resources

## Server Implementation

### Upload Manager
```javascript
// Upload manager to track and control uploads
class UploadManager {
  constructor() {
    this.uploads = new Map(); // Map of uploadId -> upload state
  }
  
  // Initialize a new upload batch
  initUpload(userId, fileCount) {
    const uploadId = generateUniqueId();
    
    this.uploads.set(uploadId, {
      userId,
      fileCount,
      filesProcessed: 0,
      currentFile: null,
      progress: 0,
      status: 'initialized',
      startTime: Date.now(),
      shouldSkip: false
    });
    
    return uploadId;
  }
  
  // Update upload progress
  updateProgress(uploadId, fileIndex, fileName, progress) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return false;
    
    upload.currentFile = {
      index: fileIndex,
      name: fileName
    };
    upload.progress = progress;
    
    return true;
  }
  
  // Mark file as processed
  fileProcessed(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return false;
    
    upload.filesProcessed++;
    upload.currentFile = null;
    
    // Check if all files are processed
    if (upload.filesProcessed >= upload.fileCount) {
      upload.status = 'completed';
      upload.progress = 100;
      
      // Clean up after some time
      setTimeout(() => {
        this.uploads.delete(uploadId);
      }, 3600000); // Keep for 1 hour
    }
    
    return true;
  }
  
  // Skip current file
  skipFile(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return false;
    
    upload.shouldSkip = true;
    
    return true;
  }
  
  // Cancel upload
  cancelUpload(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return false;
    
    upload.status = 'cancelled';
    
    // Clean up after some time
    setTimeout(() => {
      this.uploads.delete(uploadId);
    }, 60000); // Keep for 1 minute
    
    return true;
  }
  
  // Get upload status
  getStatus(uploadId) {
    return this.uploads.get(uploadId) || { status: 'not_found' };
  }
}
```

### Socket.IO Handlers

```javascript
// Initialize upload manager
const uploadManager = new UploadManager();

// Handle upload initialization
socket.on('song:uploadInit', async (data) => {
  try {
    const { fileCount, totalSize } = data;
    
    // Check if user is authenticated
    if (!socket.authenticated) {
      throw new Error('Authentication required');
    }
    
    // Initialize upload
    const uploadId = uploadManager.initUpload(socket.user.id, fileCount);
    
    socket.emit('song:uploadInit', { 
      success: true, 
      uploadId
    });
  } catch (error) {
    socket.emit('error', { message: 'Failed to initialize upload', error: error.message });
  }
});

// Handle file upload
socket.on('song:upload', async (data) => {
  try {
    const { uploadId, fileIndex, file, metadata } = data;
    
    // Check if user is authenticated
    if (!socket.authenticated) {
      throw new Error('Authentication required');
    }
    
    // Get upload state
    const upload = uploadManager.getStatus(uploadId);
    if (upload.status === 'not_found') {
      throw new Error('Upload not found');
    }
    
    // Check if upload was cancelled
    if (upload.status === 'cancelled') {
      return socket.emit('song:upload', { 
        success: false, 
        cancelled: true,
        uploadId
      });
    }
    
    // Update status to processing
    uploadManager.updateProgress(uploadId, fileIndex, metadata.title, 0);
    
    // Process file (in a real implementation, this would be async)
    // 1. Save file to temporary storage
    // 2. Convert to MP3 if needed
    // 3. Strip headers
    // 4. Save to S3
    // 5. Create database record
    
    // Simulate processing with progress updates
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      
      // Check if skipped
      if (uploadManager.getStatus(uploadId).shouldSkip) {
        clearInterval(progressInterval);
        return socket.emit('song:upload', { 
          success: false, 
          skipped: true,
          uploadId,
          fileIndex
        });
      }
      
      // Check if cancelled
      if (uploadManager.getStatus(uploadId).status === 'cancelled') {
        clearInterval(progressInterval);
        return socket.emit('song:upload', { 
          success: false, 
          cancelled: true,
          uploadId
        });
      }
      
      // Update progress
      uploadManager.updateProgress(uploadId, fileIndex, metadata.title, progress);
      
      // Emit progress update
      socket.emit('song:uploadProgress', {
        uploadId,
        fileIndex,
        progress
      });
      
      // When complete
      if (progress >= 100) {
        clearInterval(progressInterval);
        
        // Mark file as processed
        uploadManager.fileProcessed(uploadId);
        
        // In a real implementation, we would return the actual song ID
        socket.emit('song:upload', {
          success: true,
          uploadId,
          fileIndex,
          songId: generateUniqueId()
        });
      }
    }, 500);
  } catch (error) {
    socket.emit('error', { message: 'Failed to upload song', error: error.message });
  }
});

// Handle skip request
socket.on('song:skipUpload', (data) => {
  try {
    const { uploadId } = data;
    
    // Skip current file
    const success = uploadManager.skipFile(uploadId);
    
    socket.emit('song:skipUpload', { success });
  } catch (error) {
    socket.emit('error', { message: 'Failed to skip upload', error: error.message });
  }
});

// Handle cancel request
socket.on('song:cancelUpload', (data) => {
  try {
    const { uploadId } = data;
    
    // Cancel upload
    const success = uploadManager.cancelUpload(uploadId);
    
    socket.emit('song:cancelUpload', { success });
  } catch (error) {
    socket.emit('error', { message: 'Failed to cancel upload', error: error.message });
  }
});
```