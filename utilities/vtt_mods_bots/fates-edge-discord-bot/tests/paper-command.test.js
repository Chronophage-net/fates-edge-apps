const { test } = require('node:test');
const assert = require('node:assert/strict');
const command = require('../commands/paper-import');
function interaction(customId) {
    return {
        customId, guildId: 'g', channelId: 'c', user: { id: 'u' }, memberPermissions: { has: () => true },
        isModalSubmit: () => customId === 'paper-import:input',
        fields: { getTextInputValue: () => '=== Character ===\nName: Rowan' },
        async showModal(value) { this.modal = value.toJSON(); },
        async deferReply() { this.deferred = true; },
        async editReply(value) { this.result = value; },
        async reply(value) { this.result = value; },
        async update(value) { this.replied = true; this.result = value; }
    };
}
function client() {
    const sent = [];
    return { sent, vtt: { connected: true, roomCode: 'ROOM', clientId: 'conn', config: { serverUrl: 'ws://test' },
        async sendPaperOperation(op) { sent.push(op); } } };
}
function confirmId(preview) { return preview.result.components[0].toJSON().components[0].custom_id; }

test('slash command opens a private form; permission is checked at runtime', async () => {
    const user = interaction('');
    await command.execute(user, client());
    assert.equal(user.modal.custom_id, 'paper-import:input');
    const denied = interaction(''); denied.memberPermissions.has = () => false;
    await command.execute(denied, client());
    assert.match(denied.result.content, /Manage Server/);
    assert.equal(denied.result.ephemeral, true);
});

test('preview sends nothing, owner confirmation sends once, repeated click fails', async () => {
    const bot = client();
    const preview = interaction('paper-import:input');
    await command.handleInteraction(preview, bot);
    assert.equal(bot.sent.length, 0);
    assert.equal(preview.result.files.length, 1);
    const id = confirmId(preview);
    const stranger = interaction(id); stranger.user.id = 'stranger';
    await command.handleInteraction(stranger, bot);
    assert.equal(bot.sent.length, 0);
    const owner = interaction(id);
    await command.handleInteraction(owner, bot);
    assert.equal(bot.sent.length, 1);
    assert.match(owner.result.content, /acknowledged all 1/);
    await command.handleInteraction(interaction(id), bot);
    assert.equal(bot.sent.length, 1);
});

test('cancel and loss of permission do not mutate the campaign', async () => {
    const bot = client();
    const preview = interaction('paper-import:input');
    await command.handleInteraction(preview, bot);
    const id = confirmId(preview);
    const denied = interaction(id); denied.memberPermissions.has = () => false;
    await command.handleInteraction(denied, bot);
    assert.equal(bot.sent.length, 0);
    const cancel = interaction(id.replace(':confirm:', ':cancel:'));
    await command.handleInteraction(cancel, bot);
    assert.match(cancel.result.content, /cancelled/);
    assert.equal(bot.sent.length, 0);
});
