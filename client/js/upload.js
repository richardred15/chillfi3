/**
 * Upload Manager - Handles file uploads to server
 */

class UploadManager {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
        this.uploadQueue = [];
        this.currentUpload = null;
        this.isUploading = false;
        this.uploadId = null;
        this.failedUploads = [];
        this.currentUploadIndex = 0;

        // Set up connection restore handler
        this.setupConnectionHandler();
    }

    // Initialize upload functionality
    init() {
        this.setupUploadModal();
    }

    // Setup connection handler for upload resumption
    setupConnectionHandler() {
        // Store reference to this upload manager
        if (!window.uploadManager) {
            window.uploadManager = this;
        }

        // The connection handler will be called from app.js when connection is restored
        this.onConnectionRestored = () => {
            if (this.failedUploads.length > 0) {
                this.resumeFailedUploads();
            }
        };
    }

    // Setup upload modal handlers
    setupUploadModal() {
        const submitButton = document.getElementById("submitUploadButton");
        const cancelButton = document.getElementById("cancelUploadButton");
        const skipButton = document.getElementById("cancelCurrentUploadButton");
        const progressCancelButton = document.getElementById(
            "cancelCurrentUploadButton"
        );
        const closeButton = document.getElementById("closeUploadButton");
        const clearButton = document.getElementById("clearUploadButton");
        const fileInput = document.getElementById("fileInput");
        const folderInput = document.getElementById("folderInput");
        const dropzone = document.getElementById("uploadDropzone");

        if (submitButton) {
            submitButton.addEventListener("click", () => this.startUpload());
        }

        if (cancelButton) {
            cancelButton.addEventListener("click", () => this.cancelUpload());
        }

        if (skipButton) {
            skipButton.addEventListener("click", () => this.cancelUpload());
        }

        if (closeButton) {
            closeButton.addEventListener("click", () => this.closeModal());
        }

        if (clearButton) {
            clearButton.addEventListener("click", () => this.clearAll());
        }

        // File input handlers - replace elements to remove old listeners
        if (fileInput) {
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            newFileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files);
                }
                e.target.value = "";
            });
        }

        if (folderInput) {
            const newFolderInput = folderInput.cloneNode(true);
            folderInput.parentNode.replaceChild(newFolderInput, folderInput);
            newFolderInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files);
                }
                e.target.value = "";
            });
        }

        // Drag and drop - completely replace element to remove all listeners
        if (dropzone) {
            const parent = dropzone.parentNode;
            const newDropzone = dropzone.cloneNode(true);
            parent.replaceChild(newDropzone, dropzone);

            newDropzone.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.stopPropagation();
                newDropzone.classList.add("dragover");
            });

            newDropzone.addEventListener("dragleave", (e) => {
                e.preventDefault();
                e.stopPropagation();
                newDropzone.classList.remove("dragover");
            });

            newDropzone.addEventListener("drop", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                newDropzone.classList.remove("dragover");
                const allFiles = await window.getAllFilesFromDrop(
                    e.dataTransfer
                );
                this.handleFileSelect(allFiles);
            });
        }
    }

    // Handle file selection
    handleFileSelect(files) {
        console.log("Handling file selection:", files.length, "files");

        // Set processing flag to prevent button from enabling prematurely
        this.isProcessingFiles = true;

        // Separate audio files and images
        const audioFiles = [];
        const imageFiles = new Map(); // Map folder path to image files

        Array.from(files).forEach((file) => {
            console.log(
                "File:",
                file.name,
                "Type:",
                file.type,
                "Size:",
                file.size
            );

            // Check for audio files
            const isAudio =
                (file.type && file.type.startsWith("audio/")) ||
                [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma"].some(
                    (ext) => file.name.toLowerCase().endsWith(ext)
                );

            // Check for album art images
            const isAlbumArt =
                (file.type && file.type.startsWith("image/")) ||
                [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].some((ext) =>
                    file.name.toLowerCase().endsWith(ext)
                );

            if (isAudio) {
                console.log("Detected audio file:", file.name);
                audioFiles.push(file);
            } else if (isAlbumArt) {
                // Get folder path from webkitRelativePath or use root
                const folderPath = file.webkitRelativePath
                    ? file.webkitRelativePath.split("/").slice(0, -1).join("/")
                    : "";

                if (!imageFiles.has(folderPath)) {
                    imageFiles.set(folderPath, []);
                }
                imageFiles.get(folderPath).push(file);
                console.log(
                    "Found album art:",
                    file.name,
                    "in folder:",
                    folderPath
                );
            }
        });

        // Store image files for later use
        this.folderImages = imageFiles;

        console.log("Found", audioFiles.length, "audio files");

        // Initialize pending files counter
        this.pendingFiles = this.pendingFiles || new Map();

        // Add files with delay for smoother DOM updates
        audioFiles.forEach((file, index) => {
            setTimeout(() => {
                this.addFileToUI(file);
            }, index * 10);
        });

        // Clear processing flag after all files are added (with delay for last file)
        setTimeout(() => {
            this.isProcessingFiles = false;
        }, audioFiles.length * 10 + 50);
    }

    // Add file to UI
    addFileToUI(file) {
        console.log("addFileToUI called for:", file.name);
        const template = document.getElementById("fileItemTemplate");
        const uploadFiles = document.getElementById("uploadFiles");

        if (!template || !uploadFiles) {
            console.log("Template or uploadFiles not found");
            return;
        }

        const fileItem = template.content.cloneNode(true).firstElementChild;
        fileItem.dataset.file = file.name;

        // Set basic info
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const titleInput = fileItem.querySelector(".file-title");
        const titleElement = fileItem.querySelector(".file-item-title");

        if (titleInput) titleInput.value = fileName;
        if (titleElement) titleElement.textContent = fileName;

        // Store file reference
        fileItem._fileObject = file;

        // Remove button
        const removeButton = fileItem.querySelector(".file-item-remove");
        if (removeButton) {
            removeButton.addEventListener("click", () => {
                fileItem.remove();
                if (uploadFiles.children.length === 0) {
                    uploadFiles.style.display = "none";
                }
                this.updateUploadButtonStatus();
            });
        }

        uploadFiles.appendChild(fileItem);
        uploadFiles.style.display = "flex";
        console.log(
            "File item added to DOM, total items:",
            uploadFiles.children.length
        );

        // Initialize pending files counter and disable button immediately
        this.pendingFiles = this.pendingFiles || new Map();
        const submitButton = document.getElementById("submitUploadButton");
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Processing files...";
        }

        // Extract metadata
        this.extractFileMetadata(file, fileItem);
    }

    // Extract file metadata using web worker
    extractFileMetadata(file, fileItem) {
        const artistInput = fileItem.querySelector(".file-artist");
        const albumInput = fileItem.querySelector(".file-album");
        const genreInput = fileItem.querySelector(".file-genre");
        const yearInput = fileItem.querySelector(".file-year");
        const trackInput = fileItem.querySelector(".file-track");
        const durationInput = fileItem.querySelector(".file-duration");
        const titleInput = fileItem.querySelector(".file-title");

        // Extract duration
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);

        audio.addEventListener("loadedmetadata", () => {
            const duration = audio.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            if (durationInput) {
                durationInput.value = `${minutes}:${seconds
                    .toString()
                    .padStart(2, "0")}`;
            }
            URL.revokeObjectURL(audio.src);
        });

        // Extract ID3 tags using web worker
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileId = Date.now() + Math.random();

            if (!this.id3Worker) {
                this.id3Worker = new Worker("client/js/workers/id3Worker.js");
                this.id3Worker.onmessage = (event) =>
                    this.handleWorkerMessage(event);
            }

            // Store file item reference for later use
            this.pendingFiles = this.pendingFiles || new Map();
            this.pendingFiles.set(fileId, fileItem);

            this.id3Worker.postMessage({
                fileBuffer: e.target.result,
                fileName: file.name,
                fileId,
            });
        };

        reader.readAsArrayBuffer(file);
    }

    // Handle web worker messages
    handleWorkerMessage(event) {
        const { success, fileId, tags, error } = event.data;
        const fileItem = this.pendingFiles?.get(fileId);

        if (!fileItem) return;

        this.pendingFiles.delete(fileId);

        if (success && tags) {
            const titleInput = fileItem.querySelector(".file-title");
            const artistInput = fileItem.querySelector(".file-artist");
            const albumInput = fileItem.querySelector(".file-album");
            const genreInput = fileItem.querySelector(".file-genre");
            const yearInput = fileItem.querySelector(".file-year");
            const trackInput = fileItem.querySelector(".file-track");

            // Apply extracted metadata or defaults
            if (titleInput)
                titleInput.value =
                    tags.title ||
                    fileItem._fileObject.name.replace(/\.[^/.]+$/, "");
            if (artistInput)
                artistInput.value = tags.artist || "Unknown Artist";
            if (albumInput) albumInput.value = tags.album || "Unknown Album";
            if (genreInput) genreInput.value = tags.genre || "Electronic";
            if (yearInput)
                yearInput.value = tags.year || new Date().getFullYear();
            if (trackInput) trackInput.value = tags.track || "1";

            // Update title display
            const titleElement = fileItem.querySelector(".file-item-title");
            if (titleElement)
                titleElement.textContent =
                    tags.title ||
                    fileItem._fileObject.name.replace(/\.[^/.]+$/, "");

            // Handle album art - try embedded first, then folder images
            let artworkSet = false;
            if (tags.picture) {
                const artworkPreview = fileItem.querySelector(
                    ".file-item-artwork-preview"
                );
                const blob = new Blob([tags.picture.data], {
                    type: tags.picture.format,
                });
                const imageUrl = URL.createObjectURL(blob);
                artworkPreview.style.backgroundImage = `url(${imageUrl})`;
                artworkSet = true;
            }

            // If no embedded art, look for folder-based album art
            if (!artworkSet) {
                this.setFolderAlbumArt(fileItem);
            }
        }

        // Update upload button status
        this.updateUploadButtonStatus();
    }

    // Set folder-based album art for a file
    setFolderAlbumArt(fileItem) {
        if (!this.folderImages || !fileItem._fileObject) return;

        // Get folder path from the audio file
        const audioFile = fileItem._fileObject;
        const folderPath = audioFile.webkitRelativePath
            ? audioFile.webkitRelativePath.split("/").slice(0, -1).join("/")
            : "";

        const folderImages = this.folderImages.get(folderPath) || [];

        // Look for common album art filenames (prioritized)
        const artPriority = [
            "folder.jpg",
            "albumart.jpg",
            "cover.jpg",
            "front.jpg",
            "album.jpg",
        ];
        let selectedImage = null;

        // First, try to find prioritized filenames
        for (const priority of artPriority) {
            selectedImage = folderImages.find(
                (img) => img.name.toLowerCase() === priority
            );
            if (selectedImage) break;
        }

        // If no prioritized image found, use the first available image
        if (!selectedImage && folderImages.length > 0) {
            selectedImage = folderImages[0];
        }

        if (selectedImage) {
            const artworkPreview = fileItem.querySelector(
                ".file-item-artwork-preview"
            );
            const imageUrl = URL.createObjectURL(selectedImage);
            artworkPreview.style.backgroundImage = `url(${imageUrl})`;
            console.log(
                "Set folder album art:",
                selectedImage.name,
                "for",
                audioFile.name
            );
        }
    }

    // Update upload button status based on pending files
    updateUploadButtonStatus() {
        const submitButton = document.getElementById("submitUploadButton");
        if (!submitButton) return;

        const pendingCount = this.pendingFiles?.size || 0;
        const totalFiles = document.querySelectorAll(".file-item").length;

        if (pendingCount > 0) {
            submitButton.disabled = true;
            submitButton.textContent = `Processing ${pendingCount} of ${totalFiles} files...`;
        } else if (totalFiles > 0) {
            // Only enable if we're not in the middle of adding more files
            if (!this.isProcessingFiles) {
                submitButton.disabled = false;
                submitButton.textContent = "Upload All";
            }
        } else {
            submitButton.disabled = true;
            submitButton.textContent = "Upload All";
        }
    }

    // Start upload process
    async startUpload() {
        const fileItems = document.querySelectorAll(".file-item");
        if (fileItems.length === 0) {
            this.toast.show("No files to upload");
            return;
        }

        // Collect upload data
        this.uploadQueue = [];

        for (const item of fileItems) {
            const file = item._fileObject;
            if (file) {
                const metadata = await this.extractMetadataFromItem(item);
                this.uploadQueue.push({ file, metadata, element: item });
            }
        }

        if (this.uploadQueue.length === 0) {
            this.toast.show("No valid files found");
            return;
        }

        try {
            this.isUploading = true;
            this.showUploadProgress();

            // Process queue
            await this.processUploadQueue();
        } catch (error) {
            console.error("Upload failed:", error);
            this.toast.show("Upload failed to start");
        }
    }

    // Generate SHA-256 hash of file
    async generateFileHash(file) {
        const isSecure =
            window.location.protocol === "https:" ||
            window.location.hostname === "localhost";

        if (isSecure && window.crypto && window.crypto.subtle) {
            // Use crypto.subtle for HTTPS/localhost
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        } else {
            // Use pure JS implementation for HTTP
            const buffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);
            const binaryString = Array.from(uint8Array)
                .map((byte) => String.fromCharCode(byte))
                .join("");
            return sha256(binaryString);
        }
    }

    // Extract metadata from file item
    async extractMetadataFromItem(item) {
        const artwork = await this.extractArtworkFromItem(item);
        return {
            title: item.querySelector(".file-title")?.value || "Unknown Title",
            artist:
                item.querySelector(".file-artist")?.value || "Unknown Artist",
            album: item.querySelector(".file-album")?.value || "Unknown Album",
            genre: item.querySelector(".file-genre")?.value || null,
            year: parseInt(item.querySelector(".file-year")?.value) || null,
            trackNumber:
                parseInt(item.querySelector(".file-track")?.value) || null,
            duration: this.parseDuration(
                item.querySelector(".file-duration")?.value
            ),
            artwork: artwork,
        };
    }

    // Extract artwork from item
    extractArtworkFromItem(item) {
        const preview = item.querySelector(".file-item-artwork-preview");
        if (preview && preview.style.backgroundImage) {
            const url = preview.style.backgroundImage.slice(5, -2); // Remove url(\" and \")
            if (url.startsWith("blob:")) {
                // Convert blob URL to base64
                return this.blobUrlToBase64(url);
            } else if (url.startsWith("data:")) {
                return url.split(",")[1]; // Return base64 part
            }
        }
        return null;
    }

    // Convert blob URL to base64
    async blobUrlToBase64(blobUrl) {
        try {
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(",")[1];
                    resolve(base64);
                };
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Failed to convert blob to base64:", error);
            return null;
        }
    }

    // Parse duration string to seconds
    parseDuration(durationStr) {
        if (!durationStr) return null;
        const parts = durationStr.split(":");
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return null;
    }

    // Process upload queue one file at a time with progress
    async processUploadQueue() {
        const token = localStorage.getItem("chillfi_token");

        for (let i = 0; i < this.uploadQueue.length; i++) {
            if (!this.isUploading) break;

            const { file, metadata, element } = this.uploadQueue[i];

            try {
                this.updateUploadProgress(
                    i + 1,
                    this.uploadQueue.length,
                    file.name,
                    0
                );

                // Generate hash and check if file already exists
                const fileHash = await this.generateFileHash(file);
                const hashCheck = await window.api.checkFileHash(fileHash);

                if (hashCheck.exists) {
                    element.classList.add("skipped");
                    this.showFileError(
                        element,
                        "File already exists (duplicate)"
                    );
                    continue;
                }

                const result = await this.uploadFileWithProgress(
                    file,
                    metadata,
                    token,
                    (progress) => {
                        this.updateUploadProgress(
                            i + 1,
                            this.uploadQueue.length,
                            file.name,
                            progress
                        );
                    }
                );

                if (result.results[0].success) {
                    element.classList.add("uploaded");
                    this.showUploadSuccess(element);
                } else {
                    element.classList.add("failed");
                    this.showFileError(element, result.results[0].error);
                }
            } catch (error) {
                console.error("File upload failed:", error);

                // Check if it's a network error that could be resumed
                if (this.isNetworkError(error)) {
                    this.failedUploads.push({
                        file,
                        metadata,
                        element,
                        index: i,
                    });
                    element.classList.add("paused");
                    this.showFileError(
                        element,
                        "Upload paused - will resume when connection restored"
                    );
                } else {
                    element.classList.add("failed");
                    this.showFileError(element, error.message);
                }
            }
        }

        // Only finish if no failed uploads to resume
        if (this.failedUploads.length === 0) {
            this.finishUpload();
        }
    }

    // Check if error is network-related and resumable
    isNetworkError(error) {
        const networkErrors = [
            "Failed to fetch",
            "Network request failed",
            "Upload failed",
            "ERR_NETWORK",
            "Bad Gateway",
            "502",
        ];
        return networkErrors.some((msg) => error.message.includes(msg));
    }

    // Resume failed uploads when connection is restored
    async resumeFailedUploads() {
        if (this.failedUploads.length === 0 || this.isUploading) return;

        console.log("Resuming failed uploads:", this.failedUploads.length);
        this.toast.show("Resuming uploads...");

        const uploadsToRetry = [...this.failedUploads];
        this.failedUploads = [];

        for (const upload of uploadsToRetry) {
            const { file, metadata, element, index } = upload;

            try {
                element.classList.remove("paused", "failed");
                this.updateUploadProgress(
                    index + 1,
                    this.uploadQueue.length,
                    file.name,
                    0
                );

                const result = await this.uploadFileWithProgress(
                    file,
                    metadata,
                    localStorage.getItem("chillfi_token"),
                    (progress) => {
                        this.updateUploadProgress(
                            index + 1,
                            this.uploadQueue.length,
                            file.name,
                            progress
                        );
                    }
                );

                if (result.results[0].success) {
                    element.classList.add("uploaded");
                    this.showUploadSuccess(element);
                    // Clear any error messages
                    const errorDiv = element.querySelector(
                        ".file-error-message"
                    );
                    if (errorDiv) errorDiv.remove();
                } else {
                    element.classList.add("failed");
                    this.showFileError(element, result.results[0].error);
                }
            } catch (error) {
                console.error("Resume upload failed:", error);
                if (this.isNetworkError(error)) {
                    // Still network issues, keep in failed list
                    this.failedUploads.push(upload);
                    element.classList.add("paused");
                } else {
                    element.classList.add("failed");
                    this.showFileError(element, error.message);
                }
            }
        }

        if (this.failedUploads.length === 0) {
            this.finishUpload();
        }
    }

    // Upload file with progress tracking
    uploadFileWithProgress(file, metadata, token, onProgress) {
        const uploadId = `upload-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;

        console.log("Starting file upload", {
            uploadId,
            filename: file.name,
            size: file.size,
            mimetype: file.type,
            metadata: {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
            },
        });

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();

            formData.append("files", file);
            formData.append("metadata", JSON.stringify([metadata]));

            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    const progress = (e.loaded / e.total) * 100;
                    console.log("Upload progress", {
                        uploadId,
                        filename: file.name,
                        progress: Math.round(progress),
                        loaded: e.loaded,
                        total: e.total,
                    });
                    onProgress(progress);
                }
            });

            xhr.addEventListener("load", () => {
                console.log("Upload completed", {
                    uploadId,
                    filename: file.name,
                    status: xhr.status,
                    statusText: xhr.statusText,
                    responseLength: xhr.responseText?.length || 0,
                });

                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        console.log("Upload result parsed", {
                            uploadId,
                            filename: file.name,
                            success: result.success,
                            resultCount: result.results?.length || 0,
                            requestId: result.requestId,
                        });
                        resolve(result);
                    } catch (error) {
                        console.error("Failed to parse upload response", {
                            uploadId,
                            filename: file.name,
                            error: error.message,
                            responseText: xhr.responseText?.substring(0, 500),
                        });
                        reject(
                            new Error(
                                "Invalid response format: " + error.message
                            )
                        );
                    }
                } else {
                    console.error("Upload failed with HTTP error", {
                        uploadId,
                        filename: file.name,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        responseText: xhr.responseText?.substring(0, 500),
                    });
                    reject(
                        new Error(
                            `Upload failed (${xhr.status}): ${xhr.statusText}`
                        )
                    );
                }
            });

            xhr.addEventListener("error", (e) => {
                console.error("Upload network error", {
                    uploadId,
                    filename: file.name,
                    error: e,
                    readyState: xhr.readyState,
                    status: xhr.status,
                });
                reject(new Error("Network error during upload"));
            });

            xhr.addEventListener("timeout", () => {
                console.error("Upload timeout", {
                    uploadId,
                    filename: file.name,
                    timeout: xhr.timeout,
                });
                reject(new Error("Upload timeout"));
            });

            xhr.addEventListener("abort", () => {
                console.warn("Upload aborted", {
                    uploadId,
                    filename: file.name,
                });
                reject(new Error("Upload aborted"));
            });

            xhr.timeout = 300000; // 5 minute timeout
            xhr.open("POST", "/api/upload/songs");
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);

            console.log("Sending upload request", {
                uploadId,
                filename: file.name,
                url: "/api/upload/songs",
                hasToken: !!token,
            });

            xhr.send(formData);
        });
    }

    // Show upload progress UI
    showUploadProgress() {
        const progressSection = document.getElementById("uploadProgress");
        const uploadActions = document.getElementById("uploadActions");

        if (progressSection) progressSection.classList.add("active");
        if (uploadActions) uploadActions.classList.add("uploading");
    }

    // Update upload progress
    updateUploadProgress(current, total, fileName, chunkProgress = 0) {
        const currentFileNum = document.getElementById("currentFileNum");
        const totalFileNum = document.getElementById("totalFileNum");
        const currentFileName = document.getElementById("currentFileName");
        const progressBar = document.getElementById("uploadProgressBar");

        if (currentFileNum) currentFileNum.textContent = current;
        if (totalFileNum) totalFileNum.textContent = total;
        if (currentFileName) currentFileName.textContent = fileName;

        if (progressBar) {
            const completedFiles = current - 1;
            const currentFileProgress = chunkProgress / 100;
            const totalProgress =
                ((completedFiles + currentFileProgress) / total) * 100;
            progressBar.style.width = `${Math.max(0, totalProgress)}%`;
        }
    }

    // Skip current file
    async skipCurrentFile() {
        if (this.currentUpload && this.uploadId) {
            try {
                await this.api.controlUpload(this.uploadId, "skip");
                this.currentUpload.element.classList.add("skipped");
            } catch (error) {
                console.error("Skip failed:", error);
            }
        }
    }

    // Cancel upload
    async cancelUpload() {
        if (this.uploadId) {
            try {
                await this.api.controlUpload(this.uploadId, "cancel");
            } catch (error) {
                console.error("Cancel failed:", error);
            }
        }

        this.isUploading = false;
        this.finishUpload();
    }

    // Finish upload process
    finishUpload() {
        this.isUploading = false;
        this.currentUpload = null;
        this.uploadId = null;

        // Hide progress UI
        const progressSection = document.getElementById("uploadProgress");
        const uploadActions = document.getElementById("uploadActions");
        const progressBar = document.getElementById("uploadProgressBar");

        if (progressSection) progressSection.classList.remove("active");
        if (uploadActions) uploadActions.classList.remove("uploading");
        if (progressBar) progressBar.style.width = "0%";

        // Count results
        const uploaded = document.querySelectorAll(
            ".file-item.uploaded"
        ).length;
        const failed = document.querySelectorAll(".file-item.failed").length;
        const skipped = document.querySelectorAll(".file-item.skipped").length;

        let message = "";
        if (uploaded > 0) {
            message = `${uploaded} files uploaded successfully`;
            if (failed > 0) message += `, ${failed} failed`;
            if (skipped > 0) message += `, ${skipped} skipped (duplicates)`;

            // Refresh content to show new songs
            if (window.contentManager) {
                window.contentManager.loadAllSongs();
            }
        } else if (skipped > 0 && failed === 0) {
            message = `${skipped} files skipped (duplicates)`;
        } else if (failed > 0) {
            message = `${failed} files failed to upload`;
            if (skipped > 0) message += `, ${skipped} skipped (duplicates)`;
        } else {
            message = "Upload cancelled";
        }

        this.toast.show(message);

        // Refresh content to show new songs after a brief delay
        if (uploaded > 0 && window.contentManager) {
            setTimeout(() => {
                window.contentManager.loadAllSongs();
                window.contentManager.loadAlbums();
                window.contentManager.renderHomeSections();
            }, 500);
        }

        // Clear and close modal faster for successful uploads
        if (uploaded > 0 && failed === 0 && skipped === 0) {
            setTimeout(() => {
                this.clearUploadQueue();
            }, 1000);
        }
    }

    // Show error message on file item
    showFileError(fileItem, errorMessage) {
        const isPaused = fileItem.classList.contains("paused");
        fileItem.style.border = isPaused
            ? "2px solid #ffa500"
            : "2px solid #ff4444";

        // Add error message
        let errorDiv = fileItem.querySelector(".file-error-message");
        if (!errorDiv) {
            errorDiv = document.createElement("div");
            errorDiv.className = "file-error-message";
            errorDiv.style.cssText = `color: ${
                isPaused ? "#ffa500" : "#ff4444"
            }; font-size: 12px; margin-top: 8px; padding: 4px;`;
            fileItem.appendChild(errorDiv);
        }
        errorDiv.textContent = isPaused
            ? errorMessage
            : `Error: ${errorMessage}`;
    }

    // Show upload success and replace close button with checkmark
    showUploadSuccess(fileItem) {
        const removeButton = fileItem.querySelector(".file-item-remove");
        if (removeButton) {
            removeButton.innerHTML = `<img src="client/icons/check.svg" alt="Success" width="16" height="16">`;
            removeButton.style.cursor = "default";
            removeButton.onclick = null; // Remove click handler
        }
    }

    // Close modal
    closeModal() {
        const uploadModal = document.getElementById("uploadModal");
        if (uploadModal) {
            uploadModal.classList.remove("show");
        }
    }

    // Clear all uploads (cancel active uploads and clear queue)
    clearAll() {
        if (
            !confirm(
                "Are you sure you want to clear all uploads? This will cancel any uploads in progress."
            )
        ) {
            return;
        }

        if (this.isUploading) {
            this.cancelUpload();
        }

        const uploadFiles = document.getElementById("uploadFiles");
        if (uploadFiles) {
            uploadFiles.innerHTML = "";
            uploadFiles.style.display = "none";
        }

        this.uploadQueue = [];
        this.toast.show("Upload queue cleared");
    }

    // Clear upload queue
    clearUploadQueue() {
        const uploadFiles = document.getElementById("uploadFiles");
        if (uploadFiles) {
            uploadFiles.innerHTML = "";
            uploadFiles.style.display = "none";
        }

        this.uploadQueue = [];

        // Close modal
        this.closeModal();
    }
}

export default UploadManager;
