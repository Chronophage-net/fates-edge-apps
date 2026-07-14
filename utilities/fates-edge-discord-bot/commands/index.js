/**
 * Command Registration
 * Exports all commands for the bot
 */

module.exports = {
    vtt: require('./vtt'),
    dice: require('./dice'),
    chat: require('./chat'),
    character: require('./character'),
    timer: require('./timer'),
    admin: require('./admin')
};
