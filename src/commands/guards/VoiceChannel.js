"use strict";
exports.__esModule = true;
exports.BotMustBeDisconnected = exports.MemberMustBeInVoiceChannel = exports.MemberMustBeInSameVoiceChannel = void 0;
var voice_1 = require("@discordjs/voice");
function MemberMustBeInSameVoiceChannel(allowDisconnected) {
    if (allowDisconnected === void 0) { allowDisconnected = false; }
    return function (bot, interaction) {
        var _a;
        var member = interaction.member;
        console.log(member.nickname, member.guild, member.guild.id);
        var connection = (0, voice_1.getVoiceConnection)(member.guild.id);
        console.log(connection, connection === null || connection === void 0 ? void 0 : connection.joinConfig.channelId, member.voice.channelId);
        if (allowDisconnected && !((_a = member === null || member === void 0 ? void 0 : member.voice) === null || _a === void 0 ? void 0 : _a.channel) && !connection) {
            console.log('both member and bot are disconnected, so we are allowing the command');
            return;
        }
        if (connection && connection.joinConfig.channelId !== member.voice.channelId) {
            return 'You must be in the same voice channel as the bot to use this command';
        }
    };
}
exports.MemberMustBeInSameVoiceChannel = MemberMustBeInSameVoiceChannel;
function MemberMustBeInVoiceChannel(bot, interaction) {
    var _a;
    var member = interaction.member;
    if (!((_a = member === null || member === void 0 ? void 0 : member.voice) === null || _a === void 0 ? void 0 : _a.channel)) {
        return 'You must be in a voice channel to use this command';
    }
}
exports.MemberMustBeInVoiceChannel = MemberMustBeInVoiceChannel;
function BotMustBeDisconnected(bot, interaction) {
    var member = interaction.member;
    var connection = (0, voice_1.getVoiceConnection)(member.guild.id);
    if (connection) {
        return 'Bot is already in a channel';
    }
}
exports.BotMustBeDisconnected = BotMustBeDisconnected;
