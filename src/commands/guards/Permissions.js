"use strict";
exports.__esModule = true;
exports.OnlyRoles = void 0;
function OnlyRoles() {
    var roles = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        roles[_i] = arguments[_i];
    }
    if (roles.length === 0) {
        throw new Error('Must supply at least one role to the OnlyRoles guard');
    }
    return function (bot, interaction) {
        var member = interaction.member;
        if (!roles.some(function (r) { return member.roles.cache.find(function (gr) { return gr.name === r; }); })) {
            return 'You do not have permission to use this command';
        }
    };
}
exports.OnlyRoles = OnlyRoles;
