class APIEvents {
    constructor() {
        this.validEvents = ['authenticated', 'logout', 'connection', 'error', 'upload'];
        this.events = new Map();
    }

    fire(event, ...args) {
        const handlers = this.events.get(event) || [];
        for (let handler of handlers) {
            try {
                if (typeof handler !== "function") {
                    console.error(
                        `Event handler for ${event} is not a function`
                    );
                    continue;
                }
                handler(...args);
            } catch (error) {
                console.error(
                    `Error executing handler for event ${event}:`,
                    error
                );
                continue;
            }
        }
    }

    on(event, handler) {
        console.log(`Registering handler for event: ${event}`);
        console.log(`Handler type: ${typeof handler}`);
        if (typeof event !== "string" || typeof handler !== "function") {
            console.error(
                "on() requires a string event name and a function handler"
            );
            return;
        }
        
        if (!this.validEvents.includes(event)) {
            console.warn(`Event '${event}' is not in the list of valid events. Adding anyway.`);
        }
        
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(handler);
    }

    once(event, handler) {
        if (typeof event !== "string" || typeof handler !== "function") {
            console.error(
                "once() requires a string event name and a function handler"
            );
            return;
        }
        
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    off(event, handler) {
        if (typeof event !== "string" || typeof handler !== "function") {
            console.error(
                "off() requires a string event name and a function handler"
            );
            return;
        }
        
        if (!this.events.has(event)) {
            console.error(`Event ${event} has no registered handlers`);
            return;
        }
        
        const handlers = this.events.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
            if (handlers.length === 0) {
                this.events.delete(event);
            }
        } else {
            console.error(`Handler not found for event ${event}`);
        }
    }

    // Clear all handlers for an event
    clear(event) {
        if (typeof event !== "string") {
            console.error("clear() requires a string event name");
            return;
        }
        this.events.delete(event);
    }

    // Get list of events with handlers
    getEvents() {
        return Array.from(this.events.keys());
    }

    // Get handler count for an event
    getHandlerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }
}

export default APIEvents;