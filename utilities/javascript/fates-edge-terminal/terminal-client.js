const WebSocket = require('ws');
const readline = require('readline');

// ANSI color codes for a MUD-like feel
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

let ws = null;
let clientName = 'Terminal Player';
let campaignCode = 'ABC123';
let serverUrl = 'ws://localhost:3000';
let password = 'password123'; // Replace with actual hashed password logic if needed

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.gray}>${colors.reset} `
});

function printSystemMessage(msg) {
    // Overwrite the current prompt line, print message, and re-display prompt
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.gray}[System] ${msg}${colors.reset}`);
    rl.prompt(true);
}

function printChatMessage(sender, text) {
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.cyan}[${sender}]: ${colors.reset}${text}`);
    rl.prompt(true);
}

function printRollResult(sender, formula, result) {
    process.stdout.write('\r\x1b[K');
    console.log(`${colors.yellow}🎲 ${sender} rolled ${formula}: ${colors.bold}${result}${colors.reset}`);
    rl.prompt(true);
}

function connectToServer() {
    printSystemMessage(`Connecting to ${serverUrl}/${campaignCode}...`);
    
    ws = new WebSocket(`${serverUrl}/${campaignCode}`);

    ws.on('open', () => {
        printSystemMessage('Connected! Sending handshake...');
        const handshake = {
            type: 'handshake',
            campaignCode,
            password,
            clientName,
            role: 'player',
            version: '3.0.0'
        };
        ws.send(JSON.stringify(handshake));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(message);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    ws.on('close', () => {
        printSystemMessage('Disconnected from server.');
    });

    ws.on('error', (err) => {
        printSystemMessage(`Connection error: ${err.message}`);
    });
}

function handleMessage(message) {
    switch (message.type) {
        case 'handshake_ack':
            printSystemMessage(`Handshake successful! You are connected as ${clientName}.`);
            if (message.activeClients && message.activeClients.length > 0) {
                printSystemMessage(`Players online: ${message.activeClients.map(c => c.name).join(', ')}`);
            }
            break;
        case 'chat_message':
            printChatMessage(message.value.sender || message.sender, message.value.text || message.text);
            break;
        case 'roll_result':
            printRollResult(
                message.value.sender || message.sender, 
                message.value.formula || 'dice', 
                message.value.result || message.value.total
            );
            break;
        case 'presence':
            printSystemMessage(`Presence update: ${(message.clients || []).map(c => c.name).join(', ')}`);
            break;
        case 'error':
            printSystemMessage(`Server Error: ${message.message}`);
            break;
        default:
            // Log unhandled message types for debugging
            process.stdout.write('\r\x1b[K');
            console.log(`${colors.gray}[Data] ${JSON.stringify(message)}${colors.reset}`);
            rl.prompt(true);
            break;
    }
}

function rollDice(formula) {
    // Very basic dice roller (e.g., 1d20, 3d6)
    const match = formula.match(/(\d+)d(\d+)/);
    if (!match) return { formula, result: 'Invalid roll' };

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    let total = 0;
    let rolls = [];

    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }

    return {
        formula: formula,
        rolls: rolls,
        total: total
    };
}

// Command processor
rl.on('line', (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
        rl.prompt();
        return;
    }

    if (trimmed.startsWith('/')) {
        const [cmd, ...args] = trimmed.slice(1).split(' ');
        const argStr = args.join(' ');

        switch (cmd.toLowerCase()) {
            case 'connect':
                if (ws && ws.readyState === WebSocket.OPEN) {
                    printSystemMessage('Already connected. Disconnect first.');
                } else {
                    if (argStr) serverUrl = argStr;
                    connectToServer();
                }
                break;
            case 'name':
                clientName = argStr || 'Terminal Player';
                printSystemMessage(`Name set to: ${clientName}`);
                break;
            case 'roll':
            case 'r':
                const rollData = rollDice(argStr || '1d20');
                const rollMessage = {
                    type: 'roll_result',
                    value: {
                        sender: clientName,
                        ...rollData
                    }
                };
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(rollMessage));
                    printRollResult(clientName, rollData.formula, rollData.total);
                } else {
                    printSystemMessage('Not connected to server.');
                }
                break;
            case 'who':
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'sync_request', entity: 'presence' }));
                } else {
                    printSystemMessage('Not connected to server.');
                }
                break;
            case 'help':
                printSystemMessage('Commands: /connect <url>, /name <name>, /roll <dice>, /who, /quit');
                break;
            case 'quit':
            case 'exit':
                if (ws) ws.close();
                process.exit(0);
                break;
            default:
                printSystemMessage(`Unknown command: /${cmd}`);
        }
    } else {
        // Treat as chat message
        if (ws && ws.readyState === WebSocket.OPEN) {
            const chatMsg = {
                type: 'chat_message',
                value: {
                    sender: clientName,
                    text: trimmed,
                    timestamp: Date.now()
                }
            };
            ws.send(JSON.stringify(chatMsg));
            printChatMessage(clientName, trimmed);
        } else {
            printSystemMessage('Not connected. Use /connect <url> to join.');
        }
    }
    rl.prompt();
});

// Initial welcome
console.log(`${colors.magenta}========================================${colors.reset}`);
console.log(`${colors.magenta} Fate's Edge Terminal Client${colors.reset}`);
console.log(`${colors.magenta}========================================${colors.reset}`);
console.log(`Type ${colors.yellow}/help${colors.reset} for commands.`);
console.log(`Set your name with ${colors.yellow}/name <Your Name>${colors.reset}`);
console.log(`Connect with ${colors.yellow}/connect ws://localhost:3000${colors.reset} (or just /connect if default)`);
console.log(`Type anything else to send a chat message.`);
console.log('');

rl.prompt();

