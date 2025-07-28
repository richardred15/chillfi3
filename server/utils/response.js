/**
 * Standardized API Response Utilities
 */

function success(socket, event, data = null, message = null) {
    socket.emit(event, {
        success: true,
        data,
        message,
        timestamp: new Date().toISOString()
    });
}

function error(socket, event, message, code = null, details = null) {
    socket.emit(event, {
        success: false,
        error: {
            message,
            code,
            details
        },
        timestamp: new Date().toISOString()
    });
}

function paginated(socket, event, items, total, page, limit) {
    socket.emit(event, {
        success: true,
        data: {
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        },
        timestamp: new Date().toISOString()
    });
}

module.exports = { success, error, paginated };