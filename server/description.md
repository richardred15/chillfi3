Origin: https://chillfi.richard.works

The server will be NodeJS based and will need a package.json with its dependencies

The server will be deployed to an AWS EC2 instance in real time as you write the code
The client will be served by nginx, the NodeJS server should only handle API functionality

We'll need safe and secure user authentication with tokens to persist sessions
User profile, login and session data will be stored in the SQL server
Passwords should be hashed using bcrypt and transmitted securely from the client
Users should be allowed multiple sessions in multiple locations
Tokens should expire after 7 days if they are not refresh, this should be checked and administrated server side
Adding users should only be done from an admin panel that's accesible by only admin accounts

The server will need to check for the chillfi3 database and create it if it does not exist
We will need tables for users, songs, albums, artists, playlists, and song_listens
The server should be able to detect missing columns and tables and add them if/when needed

User profiles should include:
- Username (unique identifier)
- Bio text (optional)
- Profile image (optional, with default first-letter avatar)
- Statistics on uploaded songs and listens
- Ability to edit profile information

Song metadata should be stored in the SQL database
Song files themselves will be store in an s3 bucket
The song files will need public permissions and the URL to the audio file will be passed to the client by the server when the user clicks play on a song

Song listen events should be tracked in the database:
- Each listen should be recorded with timestamp and user (if authenticated)
- Listen counts should be aggregated for statistics
- User profiles should display statistics about their uploaded content
- The server should provide APIs to retrieve listen statistics

We'll want them to go into the songs/ directory within the bucket
Profile images should be stored in the profiles/ directory within the same bucket
Album art should be stored in the album_art/ directory within the same bucket
The bucket's name is "chillfi"

All uploaded audio should be converted to mp3 and have the headers stripped off before it is stored in the s3 bucket with a unique randomized hashed filename that is associated with the song in the SQL database

The upload process should handle sequential processing with progress tracking and support skip/cancel/clear operations

Client-side metadata extraction should be implemented using Web Workers to prevent UI blocking:
- ID3v2 tag parsing for title, artist, album, genre, year, track number
- Album art extraction from APIC frames
- Duration calculation using HTML5 audio elements
- Real-time processing indicators and upload button state management
- Drag-and-drop folder support with recursive directory traversal

The server should expose a standardized API that could be used by other client apps in the future.

The server should use socket.io for realtime communication with the server, port 3005 at the same URL as the page

HTTPs certification info for server:
key: /etc/letsencrypt/live/chillfi.richard.works/privkey.pem
cert: /etc/letsencrypt/live/chillfi.richard.works/cert.pem
ca: /etc/letsencrypt/live/chillfi.richard.works/chain.pem

sql {
    port: 3306,
    host: "database-1.cclphij7unzp.us-west-2.rds.amazonaws.com",
    user: "admin",
    password: process.env.SQL_PASS,
    database: "chillfi3"
}

We should keep the code modular, breaking out various related functions into their own files for ease of editing and organization

The client should implement a unified modal system for consistent behavior across all popups and modals, with proper click-outside handling and close validation