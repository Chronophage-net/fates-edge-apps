/**
 * Command Registration
 * Exports all commands for the bot
 */

module.exports = {
    vtt: require('./vtt'),
    vttdeck: require('./vttdeck'),
    dice: require('./dice'),
    chat: require('./chat'),
    character: require('./character'),
    timer: require('./timer'),
    adventure: require('./adventure.js'),
    admin: require('./admin')
};
