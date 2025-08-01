#!/usr/bin/env node

/**
 * ChillFi3 CLI - Standalone command line interface
 * Use this to manage ChillFi3 without conflicting with the running server
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const readline = require("readline");
const database = require("./database");
const logger = require("./utils/logger");
const CLICommands = require("./utils/cliCommands");

async function main() {
    // Initialize database and Redis connections
    try {
        await database.init();
        logger.info("Database connected");
    } catch (error) {
        console.error("Failed to initialize services:", error.message);
        process.exit(1);
    }

    const cliCommands = new CLICommands();

    // Check if command was passed as argument
    const args = process.argv.slice(2);
    if (args.length > 0) {
        // Non-interactive mode - execute single command
        const [command, ...commandArgs] = args;
        try {
            await cliCommands.executeCommand(command, commandArgs);
            // Add small delay to ensure async operations complete
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Command failed:', error.message);
        }
        await cleanup();
        return;
    }

    // Interactive mode
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${process.env.APP_NAME || "ChillFi3"}> `,
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
                "exit",
            ];
            const hits = commands.filter((cmd) => cmd.startsWith(line));
            return [hits.length ? hits : commands, line];
        },
    });

    console.log(
        'ChillFi3 CLI - Type "help" for available commands or "exit" to quit'
    );
    rl.prompt();

    rl.on("line", async (line) => {
        const [command, ...commandArgs] = line.trim().split(" ");

        if (command === "exit") {
            console.log("Goodbye!");
            rl.close();
            return;
        }

        await cliCommands.executeCommand(command, commandArgs);
        
        // If input is piped (not a TTY), exit after command
        if (!process.stdin.isTTY) {
            rl.close();
            return;
        }
        
        rl.prompt();
    });

    rl.on("close", async () => {
        await cleanup();
    });

    // Handle process termination
    process.on("SIGINT", async () => {
        console.log("\nReceived SIGINT, shutting down gracefully...");
        rl.close();
    });

    process.on("SIGTERM", async () => {
        console.log("\nReceived SIGTERM, shutting down gracefully...");
        rl.close();
    });
}

async function cleanup() {
    try {
        await database.cleanup();
        console.log("CLI shutdown complete");
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
    process.exit(0);
}

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    cleanup();
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start the CLI
main().catch((error) => {
    console.error("CLI startup failed:", error);
    process.exit(1);
});
