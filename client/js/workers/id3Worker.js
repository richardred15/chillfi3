/**
 * ID3 Parser Web Worker
 */
importScripts('id3Parser-worker.js');

self.onmessage = function(e) {
    const { fileBuffer, fileName, fileId } = e.data;
    
    try {
        const tags = parseID3Tags(fileBuffer);
        
        self.postMessage({
            success: true,
            fileId,
            fileName,
            tags
        });
    } catch (error) {
        self.postMessage({
            success: false,
            fileId,
            fileName,
            error: error.message
        });
    }
};