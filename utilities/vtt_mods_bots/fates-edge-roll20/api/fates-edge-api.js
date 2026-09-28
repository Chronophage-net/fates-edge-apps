/** Fate's Edge local Roll20 Mod. No network/Node/browser APIs are available here. */
(function () {
    'use strict';
    var name = "Fate's Edge";
    var escape = function (value) { return String(value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    function reply(text) { sendChat(name, '/w gm ' + escape(text), null, { noarchive: true }); }
    function store() {
        state.FatesEdge = state.FatesEdge || { deck: [], history: [], timers: {} };
        return state.FatesEdge;
    }
    function shuffle() {
        var deck = [];
        ['Clubs', 'Diamonds', 'Hearts', 'Spades'].forEach(function (suit) {
            ['Ace','2','3','4','5','6','7','8','9','10','Jack','Queen','King'].forEach(function (rank) { deck.push(rank + ' of ' + suit); });
        });
        deck.push('Red Joker', 'Black Joker');
        for (var i = deck.length - 1; i > 0; i--) { var j = randomInteger(i + 1) - 1, card = deck[i]; deck[i] = deck[j]; deck[j] = card; }
        store().deck = deck; store().history = [];
    }
    on('ready', function () {
        store();
        log("Fate's Edge local Mod ready. Use !fates-edge help. External live sync is not available in the Roll20 sandbox.");
        on('chat:message', function (msg) {
            if (msg.type !== 'api' || !/^!fates-edge(?:\s|$)/.test(msg.content)) return;
            if (!playerIsGM(msg.playerid)) return; // Shared deck, character exports and timers are GM tools.
            var args = msg.content.trim().split(/\s+/).slice(1), command = args.shift() || 'help', data = store();
            if (command === 'roll') {
                var expression = args[0] || '1d10';
                if (!/^(?:[1-9]|[1-9][0-9]|100)d(?:[2-9]|[1-9][0-9]|100)(?:[+-][0-9]{1,3})?$/.test(expression)) return reply('Use !fates-edge roll NdS[+modifier], at most 100 dice with 100 sides.');
                return sendChat(name, '/roll ' + expression);
            }
            if (command === 'shuffle') { shuffle(); return reply('Local 54-card deck shuffled. This deck is independent of the web client.'); }
            if (command === 'draw' || command === 'crown') {
                var count = command === 'crown' ? 5 : Number(args[0] || 1);
                if (!Number.isInteger(count) || count < 1 || count > 5) return reply('Draw between 1 and 5 cards.');
                if (data.deck.length < count) return reply('Not enough cards. Use !fates-edge shuffle first.');
                var cards = data.deck.splice(0, count); data.history.push(cards); data.history = data.history.slice(-50);
                return sendChat(name, escape('Local draw: ' + cards.join(', ') + ' · ' + data.deck.length + ' remaining'));
            }
            if (command === 'timer') {
                var action = args.shift(), timerName = args.shift();
                if (action === 'list') return reply(JSON.stringify(data.timers));
                if (!timerName || !/^[A-Za-z0-9_-]{1,40}$/.test(timerName) || ['__proto__','constructor','prototype'].indexOf(timerName) >= 0) return reply('Use a short timer name containing letters, numbers, - or _.');
                if (action === 'add') {
                    var segments = Number(args[0]);
                    if (!Number.isInteger(segments) || segments < 1 || segments > 20) return reply('Timer segments must be 1–20.');
                    data.timers[timerName] = { current: 0, segments: segments };
                } else if (action === 'tick' && Object.prototype.hasOwnProperty.call(data.timers, timerName)) {
                    var amount = Number(args[0] || 1);
                    if (!Number.isInteger(amount) || Math.abs(amount) > 20) return reply('Tick amount must be an integer from -20 to 20.');
                    var timer = data.timers[timerName]; timer.current = Math.max(0, Math.min(timer.segments, timer.current + amount));
                } else if (action === 'remove') delete data.timers[timerName];
                else return reply('Use timer add NAME SEGMENTS, tick NAME [AMOUNT], remove NAME, or list.');
                return reply(JSON.stringify(data.timers));
            }
            if (command === 'export') {
                var character = getObj('character', args[0]);
                if (!character) return reply('Use !fates-edge export CHARACTER_ID (select a token in the example macro).');
                var result = { name: character.get('name'), attributes: {}, skills: {} };
                ['body','wits','spirit','presence'].forEach(function (key) { result.attributes[key[0].toUpperCase()+key.slice(1)] = Number(getAttrByName(character.id,key)) || 0; });
                ['melee','ranged','stealth','sway','command','insight'].forEach(function (key) { result.skills[key[0].toUpperCase()+key.slice(1)] = Number(getAttrByName(character.id,key)) || 0; });
                ['harm','fatigue','boons','tier'].forEach(function (key) { result[key] = Number(getAttrByName(character.id,key)) || 0; });
                return reply(JSON.stringify(result));
            }
            if (['connect','disconnect','sync'].indexOf(command) >= 0) return reply('Live network sync is unavailable in Roll20 Mods. Use export for a manual character copy, or the Foundry/Discord bridge for live connections.');
            reply('Local commands: roll NdS, shuffle, draw [1–5], crown (five local cards), timer add NAME SEGMENTS, timer tick NAME [AMOUNT], timer remove NAME, timer list, export CHARACTER_ID. GM only.');
        });
    });
}());
