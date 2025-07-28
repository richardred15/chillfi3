/**
 * Shared file handling utilities
 */

export async function getAllFilesFromDrop(dataTransfer) {
    const files = [];
    const items = Array.from(dataTransfer.items);
    
    const promises = [];
    
    for (const item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                promises.push(traverseFileTree(entry, files));
            } else {
                files.push(item.getAsFile());
            }
        }
    }
    
    // Wait for all folders to be processed
    await Promise.all(promises);
    
    return files;
}

export function traverseFileTree(item, files) {
    return new Promise((resolve) => {
        if (item.isFile) {
            item.file((file) => {
                files.push(file);
                resolve();
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            
            const readAllEntries = async () => {
                let allEntries = [];
                let entries;
                
                // Keep reading until no more entries
                do {
                    entries = await new Promise((resolve) => {
                        dirReader.readEntries(resolve, () => resolve([]));
                    });
                    allEntries = allEntries.concat(entries);
                } while (entries.length > 0);
                
                // Process all entries
                for (const entry of allEntries) {
                    await traverseFileTree(entry, files);
                }
                resolve();
            };
            
            readAllEntries();
        } else {
            resolve();
        }
    });
}

export function getFileFromEntry(entry) {
    return new Promise(resolve => {
        entry.file(file => resolve(file), () => resolve(null));
    });
}

export async function traverseDirectory(dirEntry) {
    const reader = dirEntry.createReader();
    const entries = await readAllDirectoryEntries(reader);
    
    const filePromises = [];
    
    for (const entry of entries) {
        if (entry.isFile) {
            filePromises.push(getFileFromEntry(entry));
        } else if (entry.isDirectory) {
            const subDirFiles = await traverseDirectory(entry);
            filePromises.push(...subDirFiles);
        }
    }
    
    return filePromises;
}

export async function readAllDirectoryEntries(reader) {
    let entries = [];
    let readEntries = await readEntriesPromise(reader);
    
    while (readEntries.length > 0) {
        entries = [...entries, ...readEntries];
        readEntries = await readEntriesPromise(reader);
    }
    
    return entries;
}

export function readEntriesPromise(reader) {
    return new Promise((resolve, reject) => {
        reader.readEntries(
            entries => resolve(entries),
            error => reject(error)
        );
    }).catch(() => []);
}