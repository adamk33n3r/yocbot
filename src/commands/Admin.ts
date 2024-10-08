import { ChatInputCommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { Bot } from 'src/Bot';
import logger from 'src/Logger';
import { SlashCommand, SlashCommandGroup, SlashCommandOption } from 'src/types/CommandDecorators';

@SlashCommandGroup()
export abstract class Admin {
    @SlashCommand({
        description: 'Move all members in your voice channel to the specified channel',
        adminOnly: true,
    })
    public async moveAll(
        @SlashCommandOption({
            name: 'channel',
            description: 'Channel to move to',
            required: true,
        })
        channel: VoiceChannel,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        logger.debug('moveAll command', channel);
        const member = interaction.member as GuildMember;
        logger.debug('member voice channel', member.voice.channel);
        if (!member?.voice?.channel) {
            return interaction.followUp('You must be in a voice channel to use this command');
        }

        await Promise.all(member.voice.channel.members.map(vMem => {
            logger.debug(`running setChannel for ${vMem.nickname}`, { vMem, channel });
            return vMem.voice.setChannel(channel.id);
        }).filter(m => m));

        return interaction.followUp('All Moved');
    }

    @SlashCommand({
        description: 'Reload command',
        adminOnly: true,
    })
    public async reloadCommand(
        @SlashCommandOption({
            name: 'command',
            description: 'Command to reload',
            required: true,
            autocomplete: async (interaction) => {
                const partialName = interaction.options.getFocused().toLowerCase();
                const data = Bot.getInstance().commands
                    .filter(cmd => cmd.fullName.toLowerCase().startsWith(partialName))
                    .map(m => ({ name: m.fullName, value: m.fullName }));
                return interaction.respond(data);
            },
        })
        commandName: string,
        bot: Bot,
        interaction: ChatInputCommandInteraction,
    ) {
        logger.debug('reloadCommand:', commandName);
        const command = bot.commands.get(commandName);
        if (!command) {
            return interaction.followUp(`Could not find command: ${commandName}`);
        }
        if (!command.parent) {
            return interaction.followUp(`Command parent not set: ${commandName}`);
        }

        if (bot.reloadCommand(command.parent.className)) {
            return interaction.followUp(`Reloaded command: ${commandName}`);
        } else {
            return interaction.followUp(`Could not reload command: ${commandName}`);
        }
    }
}
