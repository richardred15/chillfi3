# Library Sharing Plan

## 🎫 Self-Contained JWT Library Access Tokens

### JWT Token Structure:
```javascript
{
  // Standard JWT claims
  "iss": "https://alice.chillfi.com",     // Issuer (Alice's instance)
  "sub": "library-access",                // Subject
  "iat": 1642694400,                     // Issued at
  "exp": 1735689600,                     // Expires (optional, can be years)
  
  // Custom claims
  "instance_url": "https://alice.chillfi.com",
  "library_name": "Alice's Music Collection",
  "permissions": ["browse", "stream"],
  "token_name": "Bob's Access",
  "user_id": "alice_user_123"            // Token creator
}
```

### User Flow:

#### Alice (Library Owner):
1. **Generate Token**: Creates JWT in settings with her instance URL embedded
2. **Share Token**: Gives Bob just the JWT string
3. **Token Contains Everything**: URL, permissions, expiry all in the token

#### Bob (Library Consumer):
1. **Add Library**: Pastes JWT token (no URL needed!)
2. **Auto-Discovery**: Client extracts URL from JWT
3. **Browse**: Uses embedded URL to access Alice's library

## Implementation:

### Token Generation (Alice's instance):
```javascript
// POST /api/library-access/create-token
{
  "name": "Bob's Access",
  "permissions": ["browse", "stream"],
  "expires_in_days": 365  // Optional, default to no expiry
}

// Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FsaWNlLmNoaWxsZmkuY29tIiwic3ViIjoibGlicmFyeS1hY2Nlc3MiLCJpYXQiOjE2NDI2OTQ0MDAsImV4cCI6MTczNTY4OTYwMCwiaW5zdGFuY2VfdXJsIjoiaHR0cHM6Ly9hbGljZS5jaGlsbGZpLmNvbSIsImxpYnJhcnlfbmFtZSI6IkFsaWNlJ3MgTXVzaWMgQ29sbGVjdGlvbiIsInBlcm1pc3Npb25zIjpbImJyb3dzZSIsInN0cmVhbSJdLCJ0b2tlbl9uYW1lIjoiQm9iJ3MgQWNjZXNzIiwidXNlcl9pZCI6ImFsaWNlX3VzZXJfMTIzIn0.signature"
}
```

### Token Validation (Alice's instance):
```javascript
// GET /api/library-access/validate
// Authorization: Bearer <jwt-token>

// Alice validates with her own JWT secret
// Returns user permissions and library info
```

### Adding Library (Bob's instance):
```javascript
class RemoteLibraryManager {
  async addLibraryFromToken(jwtToken) {
    // 1. Decode JWT (without verification)
    const payload = jwt.decode(jwtToken);
    
    // 2. Extract instance URL
    const instanceUrl = payload.instance_url;
    const libraryName = payload.library_name;
    
    // 3. Test connection
    const response = await fetch(`${instanceUrl}/api/library-access/validate`, {
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    
    // 4. Store if valid
    if (response.ok) {
      await this.storeRemoteLibrary({
        name: libraryName,
        url: instanceUrl,
        token: jwtToken
      });
    }
  }
}
```

## Database Schema:

### Alice's side: Track issued tokens
```sql
library_access_tokens (
  id, token_name, token_hash, permissions, 
  expires_at, created_by, created_at, last_used
)
```

### Bob's side: Store remote libraries
```sql
remote_libraries (
  id, name, url, token, added_at, last_sync
)
```

## User Experience:

### Alice Creates Token:
```
Settings → Library Sharing → Create Access Token

┌─────────────────────────────────────┐
│ Token Name: Bob's Access            │
│ Permissions: ☑ Browse ☑ Stream      │
│ Expires: Never ▼                    │
│                                     │
│ [Generate Token]                    │
└─────────────────────────────────────┘

Generated Token:
┌─────────────────────────────────────┐
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9│
│ .eyJpc3MiOiJodHRwczovL2FsaWNlLmNoaW│
│ xsZmkuY29tIiwic3ViIjoibGlicmFyeS1h│
│ Y2Nlc3MiLCJpYXQiOjE2NDI2OTQ0MDAi│
│                                     │
│ [Copy Token] [Share via QR]         │
└─────────────────────────────────────┘
```

### Bob Adds Library:
```
Settings → Remote Libraries → Add Library

┌─────────────────────────────────────┐
│ Paste Access Token:                 │
│ ┌─────────────────────────────────┐ │
│ │ eyJhbGciOiJIUzI1NiIsInR5cCI6Ik │ │
│ │ pXVCJ9.eyJpc3MiOiJodHRwczovL2F │ │
│ │ saWNlLmNoaWxsZmkuY29tIiwic3Vi │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Add Library]                       │
└─────────────────────────────────────┘

✓ Connected to "Alice's Music Collection"
```

### UI Changes:
```
Sidebar:
├── My Library
├── Recently Played
├── Playlists
├── ─────────────
├── Alice's Library    ← New
├── Carol's Library    ← New
└── + Add Library      ← New
```

## Security Benefits:

### Self-Contained:
- **No URL Spoofing**: URL is cryptographically signed in JWT
- **Tamper Proof**: Any modification invalidates the signature
- **Revocable**: Alice can revoke by token hash
- **Auditable**: Alice sees all token usage

### Long-Term Tokens:
- **No Refresh Needed**: Tokens can last years
- **Offline Friendly**: No need to refresh when Alice's instance is down
- **Simple Sharing**: Just copy/paste the token string

## Token Management:

### Alice's Token Dashboard:
```
Active Library Access Tokens:

┌─────────────────────────────────────┐
│ Bob's Access                        │
│ Created: Jan 15, 2024               │
│ Last Used: 2 hours ago              │
│ Permissions: Browse, Stream         │
│ [Revoke] [View Usage]               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Carol's Access                      │
│ Created: Dec 1, 2023                │
│ Last Used: Never                    │
│ Permissions: Browse only            │
│ [Revoke] [View Usage]               │
└─────────────────────────────────────┘
```

## API Implementation:

### New Endpoints:
```javascript
// Generate access token (library owner)
POST /api/library-access/create-token
{
  name: "Bob's Access",
  permissions: ["browse", "stream"],
  expires_in_days: 365
}

// Validate token (called by remote instances)
GET /api/library-access/validate
Headers: { Authorization: "Bearer <jwt-token>" }

// Browse remote library (existing endpoints with token auth)
GET /api/songs?genre=rock
Headers: { Authorization: "Bearer <jwt-token>" }

// Stream from remote library (existing endpoint with token auth)
GET /api/songs/:id/stream
Headers: { Authorization: "Bearer <jwt-token>" }

// Revoke token (library owner)
DELETE /api/library-access/tokens/:tokenHash
```

### Client-Side Implementation:
```javascript
class RemoteLibraryManager {
  async addLibraryFromToken(jwtToken) {
    // Decode and validate token, store remote library
  }
  
  async browseRemoteLibrary(libraryId, filters) {
    // Use stored token to browse remote library
  }
  
  async streamRemoteSong(libraryId, songId) {
    // Get streaming URL from remote instance
  }
}
```

## API Flow Example:

### 1. Bob adds Alice's library:
```javascript
// Bob's instance decodes JWT
const payload = jwt.decode(jwtToken);
// payload.instance_url = "https://alice.chillfi.com"

// Test connection
GET https://alice.chillfi.com/api/library-access/validate
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Alice's instance responds
{
  "valid": true,
  "library_name": "Alice's Music Collection",
  "permissions": ["browse", "stream"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### 2. Bob browses Alice's library:
```javascript
// Bob's UI calls remote library
GET https://alice.chillfi.com/api/songs?genre=rock
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Returns Alice's songs with source attribution
{
  "songs": [...],
  "source": "Alice's Library",
  "total": 150
}
```

### 3. Bob streams Alice's song:
```javascript
// Bob requests stream
GET https://alice.chillfi.com/api/songs/123/stream
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Alice returns signed S3 URL or proxy stream
{
  "stream_url": "https://alice-bucket.s3.amazonaws.com/songs/...",
  "expires_in": 3600
}
```

## Implementation Benefits:

- **Single token contains everything** (URL + permissions + identity)
- **No separate URL input** needed
- **Cryptographically secure** URL binding
- **Long-term tokens** that don't need refresh
- **Simple sharing** via copy/paste or QR codes
- **Completely decentralized** - no central servers
- **Revocable access** by token hash
- **Auditable usage** tracking