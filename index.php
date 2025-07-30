<?php
// Allow bfcache with reasonable caching
header('Cache-Control: private, max-age=300');
header('Pragma: cache');

// Load client configuration
if (file_exists('.env.client')) {
    $lines = file('.env.client', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

// Load server configuration for environment variables
$serverEnv = [];
if (file_exists('server/.env')) {
    $lines = file('server/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $serverEnv[trim($key)] = trim($value);
        }
    }
}

// Configuration
$appName = $_ENV['APP_NAME'] ?? 'MusicLib';
$apiUrl = $_ENV['API_URL'] ?? 'http://localhost:3005/api';
$nodeEnv = $serverEnv['NODE_ENV'] ?? 'production';
$forceHttps = $serverEnv['FORCE_HTTPS'] ?? 'false';

// Default meta tags
$pageTitle = "{$appName} - Private Music Library";
$pageDescription = "Private music streaming platform";
$pageImage = null;

function makeApiRequest($endpoint)
{
    $url = $GLOBALS['apiUrl'] . $endpoint;
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'ignore_errors' => true
        ]
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        error_log("API request failed: {$url}");
        return null;
    }

    $decoded = json_decode($response, true);
    if ($decoded === null) {
        error_log("JSON decode failed for: {$response}");
    }

    return $decoded;
}

// Debug info for troubleshooting
$debugInfo = [];

// Handle different URL parameters
if (isset($_GET['album'])) {
    $albumId = $_GET['album'];
    $artist = $_GET['artist'] ?? null;

    if (is_numeric($albumId)) {
        $endpoint = "/og/album?id=" . urlencode($albumId);
    } else {
        $endpoint = "/og/album?name=" . urlencode($albumId);
        if ($artist) {
            $endpoint .= "&artist=" . urlencode($artist);
        }
    }

    $debugInfo['endpoint'] = $apiUrl . $endpoint;
    $response = makeApiRequest($endpoint);
    $debugInfo['response'] = $response;

    if ($response && !isset($response['error'])) {
        $pageTitle = "{$response['album']} by {$response['artist']} - {$appName}";
        $pageDescription = "Listen to {$response['album']} by {$response['artist']} on {$appName} - {$response['songCount']} songs.";
        $pageImage = $response['image'] ?? null;
    }
} elseif (isset($_GET['song'])) {
    $songId = $_GET['song'];
    $endpoint = "/og/song/" . urlencode($songId);
    $debugInfo['endpoint'] = $apiUrl . $endpoint;
    $response = makeApiRequest($endpoint);
    $debugInfo['response'] = $response;

    if ($response && !isset($response['error'])) {
        $pageTitle = "{$response['title']} by {$response['artist']} - {$appName}";
        $pageDescription = "Listen to {$response['title']} by {$response['artist']} from the album {$response['album']} on {$appName}.";
        $pageImage = $response['image'] ?? null;
    }
} elseif (isset($_GET['library'])) {
    $username = $_GET['library'];
    $endpoint = "/og/library/" . urlencode($username);
    $debugInfo['endpoint'] = $apiUrl . $endpoint;
    $response = makeApiRequest($endpoint);
    $debugInfo['response'] = $response;

    if ($response && !isset($response['error'])) {
        $pageTitle = "{$response['username']}'s Library - {$appName}";
        $pageDescription = "Browse {$response['username']}'s music library on {$appName} - {$response['songCount']} songs, {$response['albumCount']} albums.";
        $pageImage = $response['image'] ?? null;
    }
} elseif (isset($_GET['artist'])) {
    $artistName = $_GET['artist'];
    $endpoint = "/og/artist/" . urlencode($artistName);
    $debugInfo['endpoint'] = $apiUrl . $endpoint;
    $response = makeApiRequest($endpoint);
    $debugInfo['response'] = $response;

    if ($response && !isset($response['error'])) {
        $pageTitle = "{$response['artist']} - {$appName}";
        $pageDescription = "Listen to {$response['artist']} on {$appName} - {$response['songCount']} songs, {$response['albumCount']} albums.";
        $pageImage = $response['image'] ?? null;
    }
}

// Escape HTML
function escapeHtml($text)
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo escapeHtml($pageTitle); ?></title>

    <!-- Meta tags for link previews -->
    <meta name="description" content="<?php echo escapeHtml($pageDescription); ?>">
    <meta property="og:title" content="<?php echo escapeHtml($pageTitle); ?>">
    <meta property="og:description" content="<?php echo escapeHtml($pageDescription); ?>">
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo escapeHtml('https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']); ?>">
    <meta property="og:site_name" content="<?php echo escapeHtml($appName); ?>">

    <?php if (isset($_GET['debug'])): ?>
        <!-- Debug Info: <?php echo json_encode($debugInfo); ?> -->
    <?php endif; ?>
    <?php if ($pageImage): ?>
        <meta property="og:image" content="<?php echo escapeHtml($pageImage); ?>">
        <meta property="og:image:width" content="400">
        <meta property="og:image:height" content="400">
    <?php endif; ?>

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo escapeHtml($pageTitle); ?>">
    <meta name="twitter:description" content="<?php echo escapeHtml($pageDescription); ?>">
    <?php if ($pageImage): ?>
        <meta name="twitter:image" content="<?php echo escapeHtml($pageImage); ?>">
    <?php endif; ?>

    <style>
        /* Inline critical loading screen CSS */
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }

        .loading-content {
            text-align: center;
            color: white;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid #8C67EF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% {
                transform: rotate(0deg);
            }

            100% {
                transform: rotate(360deg);
            }
        }

        .loading-content h2 {
            margin: 0 0 10px;
            font-size: 24px;
            font-weight: 600;
        }

        .loading-status {
            font-size: 14px;
            opacity: 0.8;
        }
    </style>
    <link rel="stylesheet" href="client/css/main.css">
    <link rel="stylesheet" href="client/css/visualizer.css">
    <link rel="stylesheet" href="client/css/components/empty-states.css">
    <script>
        // Pass environment variables to client
        window.APP_ENV = '<?php echo $nodeEnv; ?>';
        window.FORCE_HTTPS = '<?php echo $forceHttps; ?>';
        
        // Load theme immediately to prevent flash
        (function() {
            const appName = '<?php echo strtolower($appName); ?>';
            const savedTheme = localStorage.getItem(`${appName}-theme`);
            if (savedTheme && savedTheme !== 'default') {
                const link = document.createElement('link');
                link.id = 'theme-css';
                link.rel = 'stylesheet';
                link.href = `client/css/theme/${savedTheme}.css`;
                document.head.appendChild(link);
            }
        })();
    </script>
</head>

<body>
    <div id="appContainer" class="app-container">
        <div id="mainContent" class="main-content">
            <!-- Sidebar -->
            <div id="sidebar" class="sidebar">
                <div id="logo" class="logo">
                    <img src="client/icons/logo.svg" alt="<?php echo escapeHtml($appName); ?> Logo" width="32" height="32">
                    <h1><?php echo escapeHtml($appName); ?></h1>
                </div>

                <div class="nav-section">
                    <div class="nav-section-title">Menu</div>
                    <div class="nav-item active">
                        <img src="client/icons/home.svg" alt="Home" class="nav-item-icon">
                        <span class="nav-item-text">Home</span>
                    </div>
                    <div class="nav-item">
                        <img src="client/icons/search.svg" alt="Search" class="nav-item-icon">
                        <span class="nav-item-text">Search</span>
                    </div>
                    <div class="nav-item" id="libraryNavItem">
                        <img src="client/icons/library.svg" alt="My Library" class="nav-item-icon">
                        <span class="nav-item-text">My Library</span>
                    </div>
                    <!-- Mobile actions will be moved here via JavaScript -->
                </div>

                <div class="nav-section playlist-section">
                    <div class="nav-section-title">Playlists</div>
                    <div class="playlist-empty">No playlists yet</div>
                </div>
            </div>

            <!-- Content Area -->
            <div id="content" class="content">
                <div id="header" class="header">
                    <div id="searchBar" class="search-bar">
                        <img src="client/icons/search.svg" alt="Search" width="16" height="16">
                        <input id="searchInput" type="text" placeholder="Search for songs, artists, or albums">
                    </div>
                    <div class="header-actions">
                        <button class="upload-button" id="uploadButton">
                            <img src="client/icons/upload.svg" alt="Upload" width="20" height="20">
                        </button>
                        <div class="user-menu" id="userMenu">
                            <div class="user-avatar">U</div>
                            <div class="user-name">User</div>
                            <div class="user-dropdown">
                                <div class="user-dropdown-item" id="viewProfileButton">
                                    <img src="client/icons/user.svg" alt="Profile" class="user-dropdown-icon">
                                    <span>View Profile</span>
                                </div>
                                <div class="user-dropdown-item" id="resetPasswordButton">
                                    <img src="client/icons/edit.svg" alt="Reset Password" class="user-dropdown-icon">
                                    <span>Reset Password</span>
                                </div>
                                <div class="user-dropdown-item" id="adminPanelButton" style="display: none;">
                                    <img src="client/icons/edit.svg" alt="Admin" class="user-dropdown-icon">
                                    <span>Admin Panel</span>
                                </div>
                                <div class="user-dropdown-item" id="logoutButton">
                                    <img src="client/icons/logout.svg" alt="Logout" class="user-dropdown-icon">
                                    <span>Logout</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="recentlyPlayedSection" class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recently Played</h2>
                        <div class="section-action">See All</div>
                    </div>
                    <div id="recentlyPlayedGrid" class="card-grid">
                        <!-- Dynamic content will be loaded here -->
                    </div>
                </div>

                <div id="topAlbumsSection" class="section">
                    <div class="section-header">
                        <h2 class="section-title">Top Albums</h2>
                        <div class="section-action">See All</div>
                    </div>
                    <div id="topAlbumsGrid" class="card-grid">
                        <!-- Dynamic content will be loaded here -->
                    </div>
                </div>

                <div id="recentlyAddedSection" class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recently Added</h2>
                    </div>
                    <div class="song-list">
                        <div class="song-list-header">
                            <div class="song-list-header-item">#</div>
                            <div class="song-list-header-item">Title</div>
                            <div class="song-list-header-item">Artist</div>
                            <div class="song-list-header-item">Duration</div>
                        </div>
                        <div id="recentSongsList">
                            <!-- Dynamic content will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Player -->
        <div id="player" class="player">
            <button class="now-playing-button" id="nowPlayingButton">
                <img src="client/icons/menu.svg" alt="Menu" width="24" height="24">
            </button>
            <div class="now-playing">
                <div class="now-playing-image"></div>
                <div class="now-playing-info">
                    <div class="now-playing-title">Select a song</div>
                    <div class="now-playing-artist">No artist</div>
                </div>
            </div>

            <div class="player-controls">
                <div class="player-buttons">
                    <button class="player-button">
                        <img src="client/icons/shuffle.svg" alt="Shuffle" width="16" height="16">
                    </button>
                    <button class="player-button">
                        <img src="client/icons/previous.svg" alt="Previous" width="20" height="20">
                    </button>
                    <button class="player-button primary">
                        <img src="client/icons/play_white.svg" alt="Play" width="24" height="24">
                    </button>
                    <button class="player-button">
                        <img src="client/icons/next.svg" alt="Next" width="20" height="20">
                    </button>
                    <button class="player-button">
                        <img src="client/icons/repeat.svg" alt="Repeat" width="16" height="16">
                    </button>
                </div>

                <div class="progress-bar">
                    <div class="progress-time">0:00</div>
                    <div class="progress-track">
                        <div class="progress-current"></div>
                        <div class="progress-handle"></div>
                    </div>
                    <div class="progress-time">0:00</div>
                </div>
            </div>

            <div class="player-options">
                <div class="volume-control">
                    <div class="volume-icon">
                        <img src="client/icons/volume.svg" alt="Volume" width="16" height="16">
                    </div>
                    <div class="volume-track">
                        <div class="volume-current"></div>
                        <div class="volume-handle"></div>
                    </div>
                </div>
                <div class="queue-button" id="queueButton">
                    <img src="client/icons/queue.svg" alt="Queue" width="16" height="16">
                </div>
                <button class="player-button" id="visualizerButton" title="Visualizer">
                    <img src="client/icons/activity.svg" alt="Visualizer" width="16" height="16">
                </button>
            </div>
        </div>

        <!-- Now Playing Popup -->
        <div class="now-playing-popup" id="nowPlayingPopup">
            <div class="now-playing-popup-header">
                <div class="now-playing-popup-title">Now Playing</div>
            </div>
            <div class="now-playing-popup-content">
                <div class="now-playing-popup-image"></div>
                <div class="now-playing-popup-info">
                    <div class="now-playing-popup-song">Select a song</div>
                    <div class="now-playing-popup-artist">No artist</div>
                    <div class="now-playing-popup-album">Album: None</div>
                </div>
            </div>
            <div class="queue-section">
                <div class="queue-header">Up Next</div>
                <div class="queue-list"></div>
            </div>
        </div>

        <!-- Context Menu -->
        <div class="context-menu" id="songContextMenu">
            <div class="context-menu-item" data-action="play">
                <img src="client/icons/play.svg" alt="Play" class="context-menu-icon">
                <div class="context-menu-text">Play</div>
            </div>
            <div class="context-menu-item" data-action="queue">
                <img src="client/icons/queue.svg" alt="Add to Queue" class="context-menu-icon">
                <div class="context-menu-text">Add to Queue</div>
            </div>
            <div class="context-menu-item" data-action="share">
                <img src="client/icons/share.svg" alt="Share" class="context-menu-icon">
                <div class="context-menu-text">Share</div>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="edit">
                <img src="client/icons/edit.svg" alt="Edit" class="context-menu-icon">
                <div class="context-menu-text">Edit Metadata</div>
            </div>
        </div>

        <!-- User Profile Popup -->
        <div class="profile-popup" id="profilePopup">
            <div class="profile-popup-header">
                <div class="profile-popup-title">User Profile</div>
                <button class="profile-popup-close" id="closeProfileButton" data-modal-close>
                    <img src="client/icons/close.svg" alt="Close" width="16" height="16">
                </button>
            </div>
            <div class="profile-popup-content">
                <div class="profile-section">
                    <div class="profile-avatar-container">
                        <div class="profile-avatar">U</div>
                        <button class="profile-edit-button" id="editAvatarButton">
                            <img src="client/icons/pencil.svg" alt="Edit" width="16" height="16">
                        </button>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name-container">
                            <div class="profile-name">Username</div>
                            <button class="profile-edit-button" id="editNameButton">
                                <img src="client/icons/pencil.svg" alt="Edit" width="16" height="16">
                            </button>
                        </div>
                        <div class="profile-stats">
                            <div class="profile-stat">
                                <div class="profile-stat-value">0</div>
                                <div class="profile-stat-label">Uploads</div>
                            </div>
                            <div class="profile-stat">
                                <div class="profile-stat-value">0</div>
                                <div class="profile-stat-label">Listens</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="profile-bio">
                    <div class="profile-bio-header">
                        <h3>Bio</h3>
                        <button class="profile-edit-button" id="editBioButton">
                            <img src="client/icons/pencil.svg" alt="Edit" width="16" height="16">
                        </button>
                    </div>
                    <p>Welcome to <?php echo escapeHtml($appName); ?>! Upload your music and start building your library.</p>
                </div>
                <div class="profile-uploads">
                    <h3>Recent Uploads</h3>
                    <div class="profile-song-list" id="profileSongList">
                        <!-- Dynamic content will be loaded here -->
                    </div>
                </div>
            </div>
        </div>

        <!-- Upload Modal -->
        <div class="upload-modal" id="uploadModal">
            <div class="upload-modal-header">
                <div class="upload-modal-title">Upload Music</div>
                <button class="upload-modal-close" id="closeUploadButton" data-modal-close>
                    <img src="client/icons/close.svg" alt="Close" width="16" height="16">
                </button>
            </div>
            <div class="upload-modal-content">
                <div class="upload-dropzone" id="uploadDropzone">
                    <img src="client/icons/upload.svg" alt="Upload" width="48" height="48">
                    <div class="upload-dropzone-text">
                        <p>Drag and drop audio files or folders here</p>
                        <p>or</p>
                        <div class="upload-buttons">
                            <label class="upload-button-label">
                                Browse Files
                                <input type="file" id="fileInput" multiple accept="audio/*" style="display: none;">
                            </label>
                            <label class="upload-button-label">
                                Select Folder
                                <input type="file" id="folderInput" webkitdirectory directory multiple accept="" style="display: none;">
                            </label>
                        </div>
                    </div>
                </div>

                <div class="upload-files" id="uploadFiles">
                    <!-- File items will be added here dynamically -->
                </div>
            </div>
            <div class="upload-actions" id="uploadActions">
                <button class="upload-cancel" id="cancelUploadButton">Cancel</button>
                <button class="upload-cancel" id="clearUploadButton">Clear</button>
                <button class="upload-submit" id="submitUploadButton">Upload All</button>

                <div class="upload-progress" id="uploadProgress">
                    <div class="upload-progress-info">
                        <div class="upload-progress-text">Uploading <span id="currentFileNum">0</span> of <span id="totalFileNum">0</span></div>
                        <div class="upload-progress-filename" id="currentFileName">Preparing...</div>
                    </div>
                    <div class="upload-progress-bar-container">
                        <div class="upload-progress-bar" id="uploadProgressBar"></div>
                    </div>
                    <div class="upload-progress-actions">
                        <button class="upload-progress-cancel" id="cancelCurrentUploadButton">Cancel Upload</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- File Item Template -->
        <template id="fileItemTemplate">
            <div class="file-item">
                <div class="file-item-header">
                    <div class="file-item-title">Song Title</div>
                    <div class="file-item-actions">
                        <button class="file-item-remove">
                            <img src="client/icons/close.svg" alt="Remove" width="12" height="12">
                        </button>
                    </div>
                </div>
                <div class="file-item-content">
                    <div class="file-item-artwork">
                        <div class="file-item-artwork-preview"></div>
                        <label class="file-item-artwork-upload">
                            <img src="client/icons/pencil.svg" alt="Edit" width="16" height="16">
                            <input type="file" accept="image/*" style="display: none;">
                        </label>
                    </div>
                    <div class="file-item-form">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" class="file-title" placeholder="Song title">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Artist</label>
                                <input type="text" class="file-artist" placeholder="Artist name">
                            </div>
                            <div class="form-group">
                                <label>Album</label>
                                <input type="text" class="file-album" placeholder="Album name">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Genre</label>
                                <input type="text" class="file-genre" placeholder="Genre">
                            </div>
                            <div class="form-group">
                                <label>Year</label>
                                <input type="number" class="file-year" placeholder="Year">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Track #</label>
                                <input type="number" class="file-track" placeholder="Track number">
                            </div>
                            <div class="form-group">
                                <label>Duration</label>
                                <input type="text" class="file-duration" placeholder="Duration" readonly>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- Share Modal -->
        <div class="share-modal" id="shareModal">
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h3>Share</h3>
                    <button class="share-modal-close" id="shareModalClose">
                        <img src="client/icons/close.svg" alt="Close" width="16" height="16">
                    </button>
                </div>
                <div class="share-modal-body">
                    <div class="share-item-info">
                        <div class="share-item-artwork"></div>
                        <div class="share-item-details">
                            <div class="share-item-title"></div>
                            <div class="share-item-subtitle"></div>
                        </div>
                    </div>
                    <div class="share-url-section">
                        <label>Share URL:</label>
                        <div class="share-url-container">
                            <input type="text" id="shareUrlInput" readonly>
                            <button class="btn-copy" id="copyShareUrl">Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Reset Password Modal -->
        <div class="reset-password-modal" id="resetPasswordModal">
            <div class="reset-password-modal-content">
                <div class="reset-password-modal-header">
                    <h3>Reset Password</h3>
                    <button class="reset-password-modal-close" id="resetPasswordModalClose" data-modal-close>
                        <img src="client/icons/close.svg" alt="Close" width="16" height="16">
                    </button>
                </div>
                <div class="reset-password-modal-body">
                    <form id="resetPasswordForm" autocomplete="on">
                        <input type="hidden" name="username" id="hiddenUsername" autocomplete="username">
                        <div class="form-group">
                            <label for="currentPassword">Current Password</label>
                            <input type="password" id="currentPassword" name="current-password" autocomplete="current-password" required>
                        </div>
                        <div class="form-group">
                            <label for="newPassword">New Password</label>
                            <input type="password" id="newPassword" name="new-password" autocomplete="new-password" required>
                        </div>
                        <div class="form-group">
                            <label for="confirmPassword">Confirm New Password</label>
                            <input type="password" id="confirmPassword" name="confirm-password" autocomplete="new-password" required>
                        </div>
                        <div class="reset-password-actions">
                            <button type="button" class="btn-cancel" data-modal-close>Cancel</button>
                            <button type="submit" class="btn-primary">Reset Password</button>
                        </div>
                    </form>
                    <div class="reset-password-error" id="resetPasswordError" style="display: none;"></div>
                </div>
            </div>
        </div>

        <!-- Toast Notification -->
        <div class="toast" id="toast">
            <div class="toast-icon">
                <img src="client/icons/add.svg" alt="Added" width="16" height="16">
            </div>
            <div class="toast-message">Welcome to <?php echo escapeHtml($appName); ?></div>
        </div>

        <!-- Loading Overlay -->
        <div class="loading-overlay" id="loadingOverlay">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <h2>Loading...</h2>
                <div class="loading-status" id="loadingStatus">Connecting to server...</div>
            </div>
        </div>

        <!-- Offline Notification -->
        <div class="offline-overlay" id="offlineOverlay">
            <div class="offline-content">
                <div class="offline-icon">
                    <img src="client/icons/close.svg" alt="Offline" width="64" height="64">
                </div>
                <h2>Server Offline</h2>
                <p><?php echo escapeHtml($appName); ?> server is currently unavailable.</p>
                <p>Attempting to reconnect...</p>
                <div class="offline-status" id="offlineStatus">Checking connection...</div>
            </div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script type="module" src="client/js/app.js"></script>
</body>

</html>