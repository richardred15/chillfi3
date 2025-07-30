/**
 * ChillFi3 Server - Main Entry Point
 */
require("dotenv").config();
const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");

// Import modules
const config = require("./config");
const database = require("./database");
const logger = require("./utils/logger");
const redisService = require("./services/redisService");
const auth = require("./auth");
const songs = require("./songs");
const users = require("./users");
const playlists = require("./playlists");
const player = require("./player");
const artists = require("./artists");
const albums = require("./albums");
const versionManager = require("./version");

const app = express();
const PORT = config.server.port;

// HTTPS enforcement in production
if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (req.header("x-forwarded-proto") !== "https") {
            res.redirect(`https://${req.header("host")}${req.url}`);
        } else {
            next();
        }
    });
}

// Security middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "cdn.socket.io"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "wss:", "https:"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'", "https:"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    })
);

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (mobile apps, etc.)
            if (!origin) return callback(null, true);

            const allowedOrigins = [config.client.url];
            if (process.env.NODE_ENV === "development") {
                allowedOrigins.push(
                    process.env.DEV_CLIENT_URL || "http://localhost:3005"
                );
            }
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                logger.warn("CORS blocked origin", { origin });
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
        optionsSuccessStatus: 200,
    })
);

// Add request timeout and size limits
app.use((req, res, next) => {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000);
    next();
});

// Reduce payload limits for security
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.raw({ limit: "100mb", type: "application/octet-stream" }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, "../")));

// Simple HTTP rate limiter for OG endpoints
const ogRateLimit = new Map();
const OG_RATE_LIMIT = { requests: 60, window: 60000 }; // 60 requests per minute

function ogRateLimiter(req, res, next) {
    const clientIp =
        req.ip ||
        req.connection.remoteAddress ||
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        "unknown";
    const now = Date.now();
    const windowStart = now - OG_RATE_LIMIT.window;

    if (!ogRateLimit.has(clientIp)) {
        ogRateLimit.set(clientIp, []);
    }

    const requests = ogRateLimit.get(clientIp);
    const validRequests = requests.filter(
        (timestamp) => timestamp > windowStart
    );

    if (validRequests.length >= OG_RATE_LIMIT.requests) {
        return res.status(429).json({ error: "Rate limit exceeded" });
    }

    validRequests.push(now);
    ogRateLimit.set(clientIp, validRequests);
    next();
}

app.get("/api/og/song/:id", ogRateLimiter, async (req, res) => {
    logger.info("OG song request", { songId: req.params.id, ip: req.ip });
    try {
        const songId = req.params.id;
        const songs = await database.query(
            `
            SELECT s.title, a.name as artist, al.title as album, al.cover_art_url
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE s.id = ?
        `,
            [songId]
        );

        if (songs.length === 0) {
            return res.status(404).json({ error: "Song not found" });
        }

        const song = songs[0];

        // Import secureImageUrl function
        const { generateSecureUrl } = require("./services/uploadService");
        const extractS3Key = (url) =>
            url ? url.split("/").slice(-2).join("/") : null;
        const secureImageUrl = async (url) => {
            const key = extractS3Key(url);
            return key ? await generateSecureUrl(key, 3600) : url;
        };

        const securedImageUrl = song.cover_art_url
            ? await secureImageUrl(song.cover_art_url)
            : null;

        res.json({
            title: song.title,
            artist: song.artist,
            album: song.album,
            image: securedImageUrl,
        });
    } catch (error) {
        logger.error("Get song OG error", {
            error: error.message,
            songId: req.params.id,
        });
        res.status(500).json({ error: "Failed to get song" });
    }
});

app.get("/api/og/album", ogRateLimiter, async (req, res) => {
    console.log("OG album request:", req.query);
    try {
        const { name, artist, id } = req.query;
        let query, params;

        if (id) {
            query = `
                SELECT al.title as album, a.name as artist, al.cover_art_url, COUNT(s.id) as song_count
                FROM albums al
                LEFT JOIN artists a ON al.artist_id = a.id
                LEFT JOIN songs s ON al.id = s.album_id
                WHERE al.id = ?
                GROUP BY al.id
            `;
            params = [id];
        } else {
            query = `
                SELECT al.title as album, a.name as artist, al.cover_art_url, COUNT(s.id) as song_count
                FROM albums al
                LEFT JOIN artists a ON al.artist_id = a.id
                LEFT JOIN songs s ON al.id = s.album_id
                WHERE al.title = ? ${artist ? "AND a.name = ?" : ""}
                GROUP BY al.id
                LIMIT 1
            `;
            params = artist ? [name, artist] : [name];
        }

        const albums = await database.query(query, params);

        if (albums.length === 0) {
            return res.status(404).json({ error: "Album not found" });
        }

        const album = albums[0];

        // Secure the image URL
        const { generateSecureUrl } = require("./services/uploadService");
        const extractS3Key = (url) =>
            url ? url.split("/").slice(-2).join("/") : null;
        const secureImageUrl = async (url) => {
            const key = extractS3Key(url);
            return key ? await generateSecureUrl(key, 3600) : url;
        };

        const securedImageUrl = album.cover_art_url
            ? await secureImageUrl(album.cover_art_url)
            : null;

        res.json({
            album: album.album,
            artist: album.artist,
            image: securedImageUrl,
            songCount: album.song_count,
        });
    } catch (error) {
        console.error("Get album OG error:", error);
        res.status(500).json({ error: "Failed to get album" });
    }
});

app.get("/api/og/library/:username", ogRateLimiter, async (req, res) => {
    console.log("OG library request:", req.params.username);
    try {
        const username = req.params.username;
        const songs = await database.query(
            `
            SELECT COUNT(DISTINCT s.id) as song_count, 
                   COUNT(DISTINCT s.album_id) as album_count,
                   al.cover_art_url
            FROM songs s
            LEFT JOIN users u ON s.uploaded_by = u.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE u.username = ?
            GROUP BY u.id
            LIMIT 1
        `,
            [username]
        );

        if (songs.length === 0) {
            return res.status(404).json({ error: "Library not found" });
        }

        const library = songs[0];

        // Secure the image URL
        const { generateSecureUrl } = require("./services/uploadService");
        const extractS3Key = (url) =>
            url ? url.split("/").slice(-2).join("/") : null;
        const secureImageUrl = async (url) => {
            const key = extractS3Key(url);
            return key ? await generateSecureUrl(key, 3600) : url;
        };

        const securedImageUrl = library.cover_art_url
            ? await secureImageUrl(library.cover_art_url)
            : null;

        res.json({
            username: username,
            songCount: library.song_count,
            albumCount: library.album_count,
            image: securedImageUrl,
        });
    } catch (error) {
        console.error("Get library OG error:", error);
        res.status(500).json({ error: "Failed to get library" });
    }
});

app.get("/api/og/artist/:name", ogRateLimiter, async (req, res) => {
    console.log("OG artist request:", req.params.name);
    try {
        const artistName = req.params.name;
        const songs = await database.query(
            `
            SELECT COUNT(DISTINCT s.id) as song_count,
                   COUNT(DISTINCT s.album_id) as album_count,
                   al.cover_art_url
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
            WHERE a.name = ?
            GROUP BY a.id
            LIMIT 1
        `,
            [artistName]
        );

        if (songs.length === 0) {
            return res.status(404).json({ error: "Artist not found" });
        }

        const artist = songs[0];

        // Secure the image URL
        const { generateSecureUrl } = require("./services/uploadService");
        const extractS3Key = (url) =>
            url ? url.split("/").slice(-2).join("/") : null;
        const secureImageUrl = async (url) => {
            const key = extractS3Key(url);
            return key ? await generateSecureUrl(key, 3600) : url;
        };

        const securedImageUrl = artist.cover_art_url
            ? await secureImageUrl(artist.cover_art_url)
            : null;

        res.json({
            artist: artistName,
            songCount: artist.song_count,
            albumCount: artist.album_count,
            image: securedImageUrl,
        });
    } catch (error) {
        console.error("Get artist OG error:", error);
        res.status(500).json({ error: "Failed to get artist" });
    }
});

// API routes
app.use("/api/upload", require("./routes/upload"));

// File serving route for local storage
app.use("/files", require("./routes/files"));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// HTTPS server setup
const httpsOptions = config.server.httpsKey
    ? {
          key: fs.readFileSync(config.server.httpsKey),
          cert: fs.readFileSync(config.server.httpsCert),
          ca: fs.readFileSync(config.server.httpsCa),
      }
    : null;

const server = httpsOptions
    ? https.createServer(httpsOptions, app)
    : require("http").createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: config.client.url,
        methods: ["GET", "POST"],
    },
});

// Initialize database, Redis, and storage
database
    .init()
    .then(() => {
        logger.info("Database initialized successfully");
        return redisService.connect();
    })
    .then((redisConnected) => {
        if (redisConnected) {
            logger.info("Redis initialized successfully");
        } else {
            logger.warn("Redis not available, running without cache");
        }
        // Initialize storage service
        const storageService = require('./services/storageService');
        return storageService.initialize();
    })
    .then(() => {
        logger.info(`Storage service initialized (${config.storage.type})`);
    })
    .catch((err) => {
        logger.error("Service initialization failed", { error: err.message });
        process.exit(1);
    });

// Socket.IO authentication middleware
io.use(auth.authenticateSocket);

// Socket.IO connection handling with lazy-loading handler registry
io.on("connection", (socket) => {
    logger.info("Client connected", {
        socketId: socket.id,
        authenticated: socket.authenticated,
        username: socket.user?.username || "anonymous",
    });

    // Handler registry for lazy loading
    const handlerRegistry = {
        auth: () => auth.handleSocket(socket, io),
        user: () => users.handleSocket(socket, io),
        song: () => songs.handleSocket(socket, io),
        playlist: () => playlists.handleSocket(socket, io),
        player: () => player.handleSocket(socket, io),
        artist: () => artists.handleSocket(socket, io),
        albums: () => albums.handleSocket(socket, io),
        version: () => versionManager.handleSocket(socket),
    };

    // Track loaded handlers to avoid duplicate loading
    socket.loadedHandlers = new Set();

    // Lazy load handlers on first event of each namespace
    socket.onAny((eventName, ..._args) => {
        const namespace = eventName.split(":")[0];

        if (
            handlerRegistry[namespace] &&
            !socket.loadedHandlers.has(namespace)
        ) {
            handlerRegistry[namespace]();
            socket.loadedHandlers.add(namespace);
            logger.debug("Loaded socket handlers", {
                namespace,
                socketId: socket.id,
            });
        }
    });

    socket.on("disconnect", () => {
        logger.info("Client disconnected", { socketId: socket.id });
        // Clean up socket resources
        if (socket.loadedHandlers) {
            socket.loadedHandlers.clear();
            delete socket.loadedHandlers;
        }
        // Remove any socket-specific timers or intervals
        if (socket.timers) {
            socket.timers.forEach((timer) => clearTimeout(timer));
            delete socket.timers;
        }
    });
});

// Error handling and graceful shutdown
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function gracefulShutdown(signal) {
    console.log(`Received ${signal}, starting graceful shutdown...`);

    // Close server
    server.close(() => {
        console.log("HTTP server closed");
    });

    // Close Socket.IO
    io.close(() => {
        console.log("Socket.IO server closed");
    });

    // Close database connections
    try {
        await database.cleanup();
    } catch (error) {
        console.error("Error during database cleanup:", error);
    }

    // Close Redis connection
    try {
        await redisService.disconnect();
    } catch (error) {
        console.error("Error during Redis cleanup:", error);
    }

    // Cleanup upload service
    try {
        const uploadService = require("./services/uploadService");
        uploadService.cleanup();
    } catch (error) {
        console.error("Error during upload service cleanup:", error);
    }

    // Force exit after timeout
    setTimeout(() => {
        console.log("Force exit");
        process.exit(1);
    }, 10000);

    process.exit(0);
}

// Start server
server.listen(PORT, () => {
    logger.info("ChillFi3 server started", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        https: !!httpsOptions,
    });

    // Start interactive CLI
    startCLI();
});

// Interactive CLI
function startCLI() {
    const readline = require("readline");
    const bcrypt = require("bcrypt");

    let imageUploadSessions;
    try {
        const uploadService = require("./services/uploadService");
        // uploadSessions = uploadService.uploadSessions;
        imageUploadSessions = uploadService.imageUploadSessions;
    } catch (error) {
        console.log("Upload service not available");
        // uploadSessions = new Map();
        imageUploadSessions = new Map();
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${process.env.APP_NAME || "musiclib"}> `,
        completer: (line) => {
            const commands = [
                "help",
                "setup-database",
                "migrate",
                "backup",
                "restore",
                "create-admin",
                "add-user",
                "list-users",
                "reset-password",
                "make-admin",
                "status",
                "uploads",
                "clear",
                "debug-users",
            ];
            const hits = commands.filter((cmd) => cmd.startsWith(line));
            return [hits.length ? hits : commands, line];
        },
    });

    // Override console methods to maintain prompt
    // const originalLog = console.log;
    // const originalError = console.error;
    // const originalWarn = console.warn;

    function writeWithPrompt(...args) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        const formatted = args
            .map((arg) => {
                if (typeof arg === "object" && arg !== null) {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            })
            .join(" ");

        process.stdout.write(formatted + "\n");
        rl.prompt(true);
    }

    // Override console methods for CLI only
    console.log = (...args) => writeWithPrompt(...args);
    console.error = (...args) => writeWithPrompt("ERROR:", ...args);
    console.warn = (...args) => writeWithPrompt("WARN:", ...args);

    rl.prompt();

    rl.on("line", async (line) => {
        const [command, ...args] = line.trim().split(" ");

        try {
            switch (command) {
                case "help":
                    console.log("\nDatabase Commands:");
                    console.log(
                        "  setup-database                          - Initialize database with schema"
                    );
                    console.log(
                        "  migrate                                  - Migrate database to latest schema"
                    );
                    console.log(
                        "  backup [filename]                       - Create database backup"
                    );
                    console.log(
                        "  restore <filename>                      - Restore database from backup"
                    );
                    console.log("\nUser Management:");
                    console.log(
                        "  create-admin <username> <password>      - Create admin user"
                    );
                    console.log(
                        "  add-user <username> [password] [admin]  - Add user"
                    );
                    console.log(
                        "  list-users                              - List users"
                    );
                    console.log(
                        "  reset-password <username> <password>    - Reset password"
                    );
                    console.log(
                        "  make-admin <username> [true|false]      - Toggle admin"
                    );
                    console.log("\nSystem Information:");
                    console.log(
                        "  status                                   - Server status"
                    );
                    console.log(
                        "  uploads                                  - Active uploads"
                    );
                    console.log(
                        "  clear                                    - Clear screen"
                    );
                    console.log(
                        "  debug-users                              - Debug user table"
                    );
                    console.log(
                        "  help                                     - Show this help"
                    );
                    break;

                case "add-user":
                    await addUser(args[0], args[1], args[2]);
                    break;

                case "list-users":
                    await listUsers();
                    break;

                case "reset-password":
                    await resetPassword(args[0], args[1]);
                    break;

                case "make-admin":
                    await makeAdmin(args[0], args[1]);
                    break;

                case "status":
                    await showStatus();
                    break;

                case "uploads":
                    showUploads();
                    break;

                case "clear":
                    console.clear();
                    break;

                case "setup-database":
                    await setupDatabase();
                    break;

                case "migrate":
                    await migrateDatabase();
                    break;

                case "backup":
                    await backupDatabase(args[0]);
                    break;

                case "restore":
                    await restoreDatabase(args[0]);
                    break;

                case "create-admin":
                    await createAdmin(args[0], args[1]);
                    break;

                case "debug-users":
                    await debugUsers();
                    break;

                case "":
                    break;

                default:
                    console.log(
                        `Unknown command: ${command}. Type "help" for available commands.`
                    );
            }
        } catch (error) {
            console.error(error.message);
        }

        rl.prompt();
    });

    async function addUser(username, password, isAdmin = "false") {
        if (!username) {
            console.log("Usage: add-user <username> [password] [admin]");
            return;
        }

        const existing = await database.query(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );
        if (existing.length > 0) {
            console.log("User already exists");
            return;
        }

        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const result = await database.query(
            "INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)",
            [username, passwordHash, isAdmin === "true"]
        );

        console.log(`User '${username}' created with ID ${result.insertId}`);
        if (!password) {
            console.log(
                "No password set - user must set password via web interface"
            );
        }
    }

    async function listUsers() {
        const users = await database.query(`
            SELECT u.id, u.username, u.display_name, u.is_admin, u.created_at, u.last_login,
                   COUNT(s.id) as song_count
            FROM users u
            LEFT JOIN songs s ON u.id = s.uploaded_by
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        console.log("\n=== Users ===");
        console.log(
            "ID | Username | Display Name | Admin | Songs | Created | Last Login"
        );
        console.log(
            "---|----------|--------------|-------|-------|---------|------------"
        );

        users.forEach((user) => {
            const created = new Date(user.created_at).toLocaleDateString();
            const lastLogin = user.last_login
                ? new Date(user.last_login).toLocaleDateString()
                : "Never";
            const admin = user.is_admin ? "Yes" : "No";

            console.log(
                `${user.id.toString().padEnd(2)} | ${user.username.padEnd(
                    8
                )} | ${(user.display_name || "").padEnd(12)} | ${admin.padEnd(
                    5
                )} | ${user.song_count.toString().padEnd(5)} | ${created.padEnd(
                    9
                )} | ${lastLogin}`
            );
        });
    }

    async function resetPassword(username, newPassword) {
        if (!username || !newPassword) {
            console.log("Usage: reset-password <username> <new-password>");
            return;
        }

        const users = await database.query(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );
        if (users.length === 0) {
            console.log("User not found");
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await database.query(
            "UPDATE users SET password = ? WHERE username = ?",
            [passwordHash, username]
        );

        // Clear all sessions for this user
        await database.query("DELETE FROM sessions WHERE user_id = ?", [
            users[0].id,
        ]);

        console.log(`Password reset for user '${username}'`);
    }

    async function makeAdmin(username, isAdmin = "true") {
        if (!username) {
            console.log("Usage: make-admin <username> [true|false]");
            return;
        }

        const result = await database.query(
            "UPDATE users SET is_admin = ? WHERE username = ?",
            [isAdmin === "true", username]
        );

        if (result.affectedRows === 0) {
            console.log("User not found");
            return;
        }

        console.log(
            `User '${username}' ${
                isAdmin === "true" ? "granted" : "revoked"
            } admin privileges`
        );
    }

    async function showStatus() {
        const [userCount] = await database.query(
            "SELECT COUNT(*) as count FROM users"
        );
        const [songCount] = await database.query(
            "SELECT COUNT(*) as count FROM songs"
        );
        const [albumCount] = await database.query(
            "SELECT COUNT(*) as count FROM albums"
        );
        const [artistCount] = await database.query(
            "SELECT COUNT(*) as count FROM artists"
        );
        const [playlistCount] = await database.query(
            "SELECT COUNT(*) as count FROM playlists"
        );
        const [listenCount] = await database.query(
            "SELECT COUNT(*) as count FROM song_listens"
        );

        console.log("\n=== ChillFi3 Server Status ===");
        console.log(`Users: ${userCount.count}`);
        console.log(`Songs: ${songCount.count}`);
        console.log(`Albums: ${albumCount.count}`);
        console.log(`Artists: ${artistCount.count}`);
        console.log(`Playlists: ${playlistCount.count}`);
        console.log(`Total Listens: ${listenCount.count}`);

        let activeUploads;
        try {
            const uploadService = require("./services/uploadService");
            activeUploads = uploadService.getActiveUploads();
        } catch (error) {
            activeUploads = new Map();
        }

        console.log(
            `Active Song Uploads: ${activeUploads ? activeUploads.size : 0}`
        );
        console.log(
            `Active Image Uploads: ${
                imageUploadSessions ? imageUploadSessions.size : 0
            }`
        );

        // Memory usage
        const memUsage = process.memoryUsage();
        console.log(
            `Memory Usage: ${Math.round(
                memUsage.rss / 1024 / 1024
            )}MB RSS, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB Heap`
        );
    }

    function showUploads() {
        console.log("\n=== Active Song Uploads ===");

        let activeUploads;
        try {
            const uploadService = require("./services/uploadService");
            activeUploads = uploadService.getActiveUploads();
        } catch (error) {
            activeUploads = new Map();
        }

        if (!activeUploads || activeUploads.size === 0) {
            console.log("No active song uploads");
        } else {
            console.log("ID | User | Files | Progress | Current File");
            console.log("---|------|-------|----------|-------------");

            for (const [uploadId, session] of activeUploads.entries()) {
                const shortId = uploadId.substring(0, 8);
                const progress = `${session.processedFiles}/${session.totalFiles}`;
                const currentFile = session.currentFile || "Processing...";
                const elapsed = Math.round(
                    (Date.now() - session.startTime) / 1000
                );

                console.log(
                    `${shortId} | ${session.username.padEnd(
                        8
                    )} | ${session.totalFiles
                        .toString()
                        .padEnd(5)} | ${progress.padEnd(
                        8
                    )} | ${currentFile} (${elapsed}s)`
                );
            }
        }

        console.log("\n=== Active Image Uploads ===");

        if (!imageUploadSessions || imageUploadSessions.size === 0) {
            console.log("No active image uploads");
        } else {
            console.log("ID | User | Chunks | Progress");
            console.log("---|------|--------|----------");

            for (const [uploadId, session] of imageUploadSessions.entries()) {
                const shortId = uploadId.substring(0, 8);
                const progress = `${session.receivedCount}/${session.totalChunks}`;

                console.log(
                    `${shortId} | ${session.userId
                        .toString()
                        .padEnd(4)} | ${session.totalChunks
                        .toString()
                        .padEnd(6)} | ${progress}`
                );
            }
        }
    }

    async function debugUsers() {
        try {
            const users = await database.query(
                "SELECT id, username, password IS NOT NULL as has_password, is_admin, created_at FROM users"
            );
            console.log("\n=== User Debug Info ===");
            console.log("Total users:", users.length);

            if (users.length > 0) {
                console.log("ID | Username | Has Password | Admin | Created");
                console.log("---|----------|--------------|-------|--------");
                users.forEach((user) => {
                    const created = new Date(
                        user.created_at
                    ).toLocaleDateString();
                    console.log(
                        `${user.id} | ${user.username} | ${
                            user.has_password ? "Yes" : "No"
                        } | ${user.is_admin ? "Yes" : "No"} | ${created}`
                    );
                });
            } else {
                console.log("No users found. Creating test user...");
                await addUser("admin", "password", "true");
            }
        } catch (error) {
            console.error("Debug users error:", error);
        }
    }

    async function setupDatabase() {
        console.log("Setting up database with schema...");
        try {
            const { generateSchemaSQL } = require("./database");
            const schema = require("./schema.json");
            const sql = generateSchemaSQL(schema);
            await database.query(sql);
            console.log("✅ Database setup completed!");
        } catch (error) {
            console.error("❌ Database setup failed:", error.message);
        }
    }

    async function migrateDatabase() {
        console.log("Migrating database...");
        try {
            // Check current version
            let currentVersion = "0.0.0";
            try {
                const result = await database.query(
                    "SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1"
                );
                if (result.length > 0) currentVersion = result[0].version;
            } catch (error) {
                await database.query(
                    "CREATE TABLE IF NOT EXISTS schema_version (id INT AUTO_INCREMENT PRIMARY KEY, version VARCHAR(20) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
                );
            }

            const schema = require("./schema.json");
            if (currentVersion === schema.version) {
                console.log("✅ Database is up to date!");
                return;
            }

            const { generateSchemaSQL } = require("./database");
            const sql = generateSchemaSQL(schema);
            await database.query(sql);
            await database.query(
                "INSERT INTO schema_version (version) VALUES (?)",
                [schema.version]
            );
            console.log("✅ Database migration completed!");
        } catch (error) {
            console.error("❌ Migration failed:", error.message);
        }
    }

    async function backupDatabase(filename) {
        const { spawnSync } = require("child_process");
        const fs = require("fs");
        const backupFile =
            filename ||
            `chillfi3_backup_${new Date().toISOString().slice(0, 10)}.sql`;
        console.log(`Creating backup: ${backupFile}`);
        try {
            const mysqldumpArgs = [
                "-h",
                config.database.host,
                "-u",
                config.database.user,
                `-p${config.database.password}`,
                "--single-transaction",
                "--set-gtid-purged=OFF",
                config.database.database,
            ];
            const out = fs.openSync(backupFile, "w");
            const dump = spawnSync("mysqldump", mysqldumpArgs, {
                stdio: ["ignore", out, "ignore"],
            });
            fs.closeSync(out);
            if (dump.error) throw dump.error;
            if (dump.status !== 0) throw new Error("mysqldump failed");
            console.log("✅ Backup completed!");
        } catch (error) {
            console.error("❌ Backup failed:", error.message);
        }
    }

    async function restoreDatabase(filename) {
        const { execSync } = require("child_process");
        if (!filename) {
            console.log("Usage: restore <filename>");
            return;
        }
        console.log(`Restoring from: ${filename}`);
        try {
            execSync(
                `mysql -h ${config.database.host} -u ${config.database.user} -p${config.database.password} ${config.database.database} < ${filename} 2>/dev/null`
            );
            console.log("✅ Restore completed!");
        } catch (error) {
            console.error("❌ Restore failed:", error.message);
        }
    }

    async function createAdmin(username, password) {
        if (!username || !password) {
            console.log("Usage: create-admin <username> <password>");
            return;
        }

        try {
            const existing = await database.query(
                "SELECT id FROM users WHERE username = ?",
                [username]
            );
            if (existing.length > 0) {
                console.log("❌ User already exists!");
                return;
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const result = await database.query(
                "INSERT INTO users (username, password, is_admin) VALUES (?, ?, TRUE)",
                [username, passwordHash]
            );
            console.log(
                `✅ Admin user '${username}' created with ID ${result.insertId}`
            );
        } catch (error) {
            console.error("❌ Error creating admin:", error.message);
        }
    }
}

module.exports = { app, io };
