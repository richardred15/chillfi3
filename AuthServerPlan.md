# Authentication Server Separation Plan

## 🏗️ Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ChillFi3      │    │   ChillFi3      │    │   ChillFi3      │
│   Instance #1   │    │   Instance #2   │    │   Instance #N   │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │Music Data │  │    │  │Music Data │  │    │  │Music Data │  │
│  │Database   │  │    │  │Database   │  │    │  │Database   │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │         HTTPS + JWT Token Validation        │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Authentication Server   │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   User Database     │  │
                    │  │   - users           │  │
                    │  │   - sessions        │  │
                    │  │   - permissions     │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

## 📁 New Project Structure
```
chillfi3-ecosystem/
├── chillfi3-auth/              # New authentication server
│   ├── server.js
│   ├── config.js
│   ├── database.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── tokens.js
│   ├── middleware/
│   │   ├── validation.js
│   │   └── serverAuth.js
│   ├── services/
│   │   ├── tokenService.js
│   │   └── userService.js
│   └── package.json
│
├── chillfi3-server/            # Modified main server
│   ├── server.js               # Remove auth routes
│   ├── middleware/
│   │   └── authProxy.js        # New: proxy to auth server
│   ├── services/
│   │   └── authClient.js       # New: auth server client
│   └── [existing files...]
│
└── shared/                     # Shared utilities
    ├── crypto.js              # Shared encryption
    └── constants.js           # Shared constants
```

## 🔐 Authentication Server Features

### Core Endpoints:
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout  
- `POST /auth/register` - User registration (admin only)
- `GET /auth/validate` - Token validation for main servers
- `POST /auth/refresh` - Token refresh
- `GET /users/:id` - User profile data
- `PUT /users/:id` - Update user profile
- `DELETE /users/:id` - Delete user (admin only)

### Server-to-Server Authentication:
- **API Keys**: Each ChillFi3 instance has unique API key
- **Request Signing**: HMAC-SHA256 signed requests
- **Rate Limiting**: Per-server rate limits
- **IP Whitelisting**: Restrict access to known servers

### Database Schema:
```sql
-- Users table (moved from main server)
users (id, username, password, email, is_admin, created_at, updated_at)

-- Server instances (new)
server_instances (id, name, api_key, api_secret, ip_whitelist, created_at)

-- Sessions (enhanced)
sessions (id, user_id, server_instance_id, token, expires_at, created_at)

-- Audit log (new)
auth_audit (id, user_id, server_id, action, ip_address, timestamp)
```

## 🔄 Main Server Modifications

### Remove from Main Server:
- `auth.js` routes
- `users.js` routes  
- User-related database tables
- JWT generation/validation
- Password hashing logic
- Session management

### Add to Main Server:
- **AuthClient Service**: HTTP client for auth server
- **AuthProxy Middleware**: Intercepts auth requests
- **Token Cache**: Redis cache for validated tokens
- **Fallback Logic**: Handle auth server downtime

### New AuthProxy Middleware:
```javascript
// Pseudo-code structure
class AuthProxy {
    async validateToken(token) {
        // 1. Check Redis cache first
        // 2. If not cached, call auth server
        // 3. Cache result with TTL
        // 4. Return user data
    }
    
    async authenticateSocket(socket) {
        // 1. Extract token from socket
        // 2. Validate via auth server
        // 3. Attach user to socket
    }
}
```

## 🚀 Migration Strategy

### Phase 1: Setup Auth Server
1. Create new `chillfi3-auth` project
2. Setup database and basic endpoints
3. Implement server-to-server authentication
4. Add comprehensive testing

### Phase 2: Dual Mode
1. Modify main server to support both local and remote auth
2. Add feature flag: `USE_REMOTE_AUTH=true/false`
3. Test with single instance

### Phase 3: Migration
1. Export user data from main server
2. Import to auth server
3. Switch main server to remote auth mode
4. Remove local auth code

### Phase 4: Multi-Instance
1. Deploy multiple ChillFi3 instances
2. Configure all to use central auth server
3. Test load balancing and failover

## 🛡️ Security Considerations

### Network Security:
- **TLS 1.3**: All communication encrypted
- **Certificate Pinning**: Prevent MITM attacks
- **VPN/Private Network**: Auth server not public-facing
- **Firewall Rules**: Restrict access to known IPs

### Authentication Security:
- **API Key Rotation**: Regular key rotation
- **Request Signing**: Prevent replay attacks
- **Rate Limiting**: Prevent brute force
- **Audit Logging**: Track all auth events

### Token Security:
- **Short TTL**: 15-minute access tokens
- **Refresh Tokens**: Longer-lived, revocable
- **Token Blacklisting**: Immediate revocation
- **Secure Storage**: HttpOnly cookies for web

## 📊 Configuration Management

### Auth Server Config:
```env
# Database
AUTH_DB_HOST=localhost
AUTH_DB_NAME=chillfi3_auth

# Server
AUTH_PORT=3001
AUTH_SECRET_KEY=super_secret_key

# Security
JWT_SECRET=jwt_secret_key
API_KEY_SALT=api_key_salt
TOKEN_TTL=900  # 15 minutes
REFRESH_TTL=604800  # 7 days

# Rate Limiting
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=300  # 5 minutes
```

### Main Server Config:
```env
# Auth Server
AUTH_SERVER_URL=https://auth.internal:3001
AUTH_API_KEY=main_server_api_key
AUTH_API_SECRET=main_server_secret

# Fallback
AUTH_CACHE_TTL=300  # 5 minutes
AUTH_TIMEOUT=5000   # 5 seconds
```

## 🧪 Testing Strategy

### Auth Server Tests:
- Unit tests for all endpoints
- Integration tests with database
- Load testing for concurrent requests
- Security penetration testing

### Main Server Tests:
- Mock auth server responses
- Test fallback scenarios
- Integration tests with real auth server
- Multi-instance coordination tests

### End-to-End Tests:
- Full user journey across servers
- Failover scenarios
- Performance under load
- Security vulnerability scanning

## 📈 Benefits of This Architecture

### Scalability:
- **Horizontal Scaling**: Add ChillFi3 instances easily
- **Centralized Users**: Single user database
- **Load Distribution**: Auth server handles all auth load

### Security:
- **Centralized Security**: Single point for security updates
- **Audit Trail**: Complete auth activity logging
- **Access Control**: Fine-grained permissions

### Maintenance:
- **Independent Updates**: Update auth without touching main servers
- **Specialized Monitoring**: Dedicated auth server monitoring
- **Backup Strategy**: Separate backup for critical auth data

### Multi-Tenancy Ready:
- **Organization Support**: Add org-level permissions
- **Instance Isolation**: Separate music data per instance
- **Shared Users**: Users can access multiple instances

This architecture provides a robust, scalable foundation for multi-instance ChillFi3 deployments while maintaining security and performance.