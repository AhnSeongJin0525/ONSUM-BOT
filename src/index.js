import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import * as ping from './commands/ping.js';   // ← 파일명 맞추기
import * as wonjeongdae from './commands/wonjeongdae.js';     // ← 추가
import * as profile from './commands/profile.js';
import { setAuth } from './utils/lostark.js';          

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
client.commands.set(ping.data.name, ping);
client.commands.set(wonjeongdae.data.name, wonjeongdae);
client.commands.set(profile.data.name, profile);

setAuth(process.env.LOSTARK_API_KEY);

client.once(Events.ClientReady, c => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log('profile keys:', Object.keys(profile));
});


client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (e) {
    console.error('command error', e);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('명령 실행 중 오류가 발생했어요.');
    } else {
      await interaction.reply({ content: '명령 실행 중 오류가 발생했어요.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
