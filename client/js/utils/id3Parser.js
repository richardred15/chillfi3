/**
 * Shared ID3 tag parsing utilities
 */

export function parseID3Tags(buffer) {
    const view = new DataView(buffer);
    const tags = {};
    
    // Check for ID3v2 header
    if (view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
        const majorVersion = view.getUint8(3);
        const minorVersion = view.getUint8(4);
        const flags = view.getUint8(5);
        
        // Calculate tag size (synchsafe integer)
        const size = ((view.getUint8(6) & 0x7f) << 21) | ((view.getUint8(7) & 0x7f) << 14) | ((view.getUint8(8) & 0x7f) << 7) | (view.getUint8(9) & 0x7f);
        
        let offset = 10;
        
        // Skip extended header if present (ID3v2.3+)
        if (flags & 0x40) {
            const extHeaderSize = view.getUint32(offset, false);
            offset += extHeaderSize;
        }
        
        const endOffset = 10 + size;
        
        while (offset < endOffset - 10) {
            let frameId, frameSize, frameFlags = 0;
            
            // Handle different ID3 versions
            if (majorVersion >= 3) {
                // ID3v2.3 and v2.4
                frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
                
                if (majorVersion === 4) {
                    // ID3v2.4 uses synchsafe integers for frame size
                    frameSize = ((view.getUint8(offset + 4) & 0x7f) << 21) | ((view.getUint8(offset + 5) & 0x7f) << 14) | ((view.getUint8(offset + 6) & 0x7f) << 7) | (view.getUint8(offset + 7) & 0x7f);
                } else {
                    // ID3v2.3 uses regular 32-bit integer
                    frameSize = view.getUint32(offset + 4, false);
                }
                
                frameFlags = view.getUint16(offset + 8, false);
                offset += 10;
            } else {
                // ID3v2.2
                frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2));
                frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
                offset += 6;
            }
            
            if (frameSize === 0 || frameSize > endOffset - offset || !frameId.match(/^[A-Z0-9]+$/)) break;
            
            try {
                const frameData = new Uint8Array(buffer, offset, frameSize);
                
                // Handle compressed/encrypted frames (skip for now)
                if (frameFlags & 0x0080 || frameFlags & 0x0040) {
                    offset += frameSize;
                    continue;
                }
                
                // Parse text frames
                if (frameId.startsWith('T') && frameId !== 'TXXX') {
                    const text = parseTextFrame(frameData);
                    
                    switch (frameId) {
                        case 'TIT2': case 'TT2': if (text) tags.title = text; break;
                        case 'TPE1': case 'TP1': if (text) tags.artist = text; break;
                        case 'TALB': case 'TAL': if (text) tags.album = text; break;
                        case 'TCON': case 'TCO': if (text) tags.genre = parseGenre(text); break;
                        case 'TYER': case 'TYE': case 'TDRC': 
                            const year = text.match(/\d{4}/);
                            if (year) tags.year = year[0];
                            break;
                        case 'TRCK': case 'TRK': 
                            const track = text.split('/')[0].match(/\d+/);
                            if (track) tags.track = track[0];
                            break;
                    }
                }
                // Parse picture frames
                else if (frameId === 'APIC' || frameId === 'PIC') {
                    const picture = parsePictureFrame(frameData, frameId === 'PIC');
                    if (picture) tags.picture = picture;
                }
            } catch (e) {
                console.warn('Error parsing frame', frameId, e);
            }
            
            offset += frameSize;
        }
    }
    
    return tags;
}

function parseTextFrame(frameData) {
    if (frameData.length === 0) return '';
    
    const encoding = frameData[0];
    let textData = frameData.slice(1);
    let text = '';
    
    try {
        switch (encoding) {
            case 0: // ISO-8859-1
                text = new TextDecoder('latin1').decode(textData);
                break;
            case 1: // UTF-16 with BOM
                // Check for BOM and handle accordingly
                if (textData.length >= 2) {
                    if (textData[0] === 0xFF && textData[1] === 0xFE) {
                        text = new TextDecoder('utf-16le').decode(textData.slice(2));
                    } else if (textData[0] === 0xFE && textData[1] === 0xFF) {
                        text = new TextDecoder('utf-16be').decode(textData.slice(2));
                    } else {
                        text = new TextDecoder('utf-16le').decode(textData);
                    }
                }
                break;
            case 2: // UTF-16BE without BOM
                text = new TextDecoder('utf-16be').decode(textData);
                break;
            case 3: // UTF-8
            default:
                text = new TextDecoder('utf-8').decode(textData);
                break;
        }
    } catch (e) {
        // Fallback to latin1 if decoding fails
        text = new TextDecoder('latin1').decode(textData);
    }
    
    return text.replace(/\0/g, '').trim();
}

function parsePictureFrame(frameData, isV22 = false) {
    if (frameData.length < 10) return null;
    
    let offset = 0;
    const encoding = frameData[offset++];
    
    let mimeType, pictureType;
    
    if (isV22) {
        // ID3v2.2 PIC frame - 3 byte image format
        const format = String.fromCharCode(frameData[offset], frameData[offset + 1], frameData[offset + 2]);
        mimeType = format === 'JPG' ? 'image/jpeg' : format === 'PNG' ? 'image/png' : 'image/jpeg';
        offset += 3;
        pictureType = frameData[offset++];
    } else {
        // ID3v2.3+ APIC frame - null-terminated MIME type
        const mimeEnd = findNullByte(frameData, offset);
        if (mimeEnd === -1) return null;
        
        mimeType = new TextDecoder('latin1').decode(frameData.slice(offset, mimeEnd));
        offset = mimeEnd + 1;
        pictureType = frameData[offset++];
    }
    
    // Skip description (null-terminated)
    const descEnd = findNullByte(frameData, offset);
    if (descEnd !== -1) {
        offset = descEnd + 1;
    }
    
    // Extract image data
    const imageData = frameData.slice(offset);
    
    if (imageData.length > 0) {
        return {
            format: mimeType,
            data: imageData
        };
    }
    
    return null;
}

function parseGenre(genreText) {
    // Handle numeric genre codes in parentheses
    const match = genreText.match(/^\((\d+)\)(.*)/);
    if (match) {
        const genreCode = parseInt(match[1]);
        const genreNames = [
            'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
            'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock',
            'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
            'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
            'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
            'Alternative Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop',
            'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic',
            'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta',
            'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native US', 'Cabaret', 'New Wave',
            'Psychadelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk',
            'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock'
        ];
        
        if (genreCode < genreNames.length) {
            return match[2] ? match[2].trim() : genreNames[genreCode];
        }
    }
    
    return genreText;
}

export function findNullByte(data, startIndex = 0) {
    for (let i = startIndex; i < data.length; i++) {
        if (data[i] === 0) return i;
    }
    return -1;
}