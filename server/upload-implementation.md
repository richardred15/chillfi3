# Upload Implementation

## Overview
ChillFi3 uses HTTP multipart uploads for all file uploads (songs and images) with progress tracking via XHR events.

## Upload Process Flow

### Song Uploads

1. **Client-Side Preparation**
   - User selects files/folders; client traverses directories recursively
   - Metadata extraction using Web Workers (ID3 tags)
   - Client-side editing of metadata before upload

2. **HTTP Multipart Upload**
   - Files uploaded via `POST /api/upload/songs`
   - Uses multer middleware with memory storage
   - Progress tracking via XHR upload progress events

3. **Server Processing**
   - File validation and duplicate detection (SHA-256 hash)
   - Metadata processing and artist/album creation
   - S3 upload with secure file naming
   - Database record creation

4. **Progress Tracking**
   - Real-time progress via XHR progress events
   - Client displays per-file progress and overall batch progress

### Image Uploads

1. **Profile Images**
   - Endpoint: `POST /api/upload/profile-image`
   - Updates user profile_image_url in database
   - Returns secure pre-signed URL

2. **Album Art**
   - Endpoint: `POST /api/upload/album-art`
   - Stores in S3 album_art folder
   - Returns public S3 URL

## Server Implementation

### Upload Routes (`routes/upload.js`)

```javascript
// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Profile image upload
router.post('/profile-image', authenticateToken, upload.single('image'), async (req, res) => {
    // Permission check, S3 upload, database update
});

// Album art upload  
router.post('/album-art', authenticateToken, upload.single('image'), async (req, res) => {
    // S3 upload, return URL
});
```

### Upload Service (`services/uploadService.js`)

Key functions:
- `processFile(file, metadata, userId)` - Process song uploads
- `uploadImage(file, folder)` - Process image uploads
- `createSongFromMetadata()` - Create database records
- `generateSecureUrl()` - Generate pre-signed S3 URLs

### File Processing Pipeline

1. **Hash Generation**: SHA-256 hash for duplicate detection
2. **S3 Upload**: Files stored with hash-based naming
3. **Database Records**: Songs, artists, albums created/linked
4. **Artwork Handling**: Embedded artwork extracted and stored separately

## Client Implementation

### Upload Manager (`client/js/upload.js`)

- File selection and metadata extraction
- Progress tracking with XHR
- Error handling and retry logic
- Batch upload processing

### Progress Tracking

```javascript
xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        onProgress(progress);
    }
});
```

## Security Features

- JWT authentication required for all uploads
- File size limits (50MB for images, 100MB for songs)
- Content type validation
- Hash-based duplicate detection
- Secure S3 file naming (prevents conflicts)

## Error Handling

- Network error detection and retry logic
- Duplicate file detection
- Invalid file format handling
- Storage quota management
- Graceful degradation for connection issues

## Storage Structure

```
S3 Bucket:
├── songs/           # Audio files (hash-named)
├── song_art/        # Individual song artwork  
├── album_art/       # Album artwork
├── artist_images/   # Artist profile images
└── profiles/        # User profile pictures
```

## Performance Optimizations

- Memory-based multer storage for faster processing
- Pre-signed URL caching (10 minute cache)
- Batch processing with progress feedback
- Efficient duplicate detection via hashing