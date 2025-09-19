import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as ping from './commands/ping.js';   // ← 파일명 맞추기
import * as wonjeongdae from './commands/wonjeongdae.js';
import * as profile from './commands/profile.js';

console.log('--- DEBUG START ---');
console.log('TOKEN set? ', !!process.env.DISCORD_TOKEN);
console.log('CLIENT_ID: ', process.env.DISCORD_CLIENT_ID);

const commands = [ping.data.toJSON(), wonjeongdae.data.toJSON(), profile.data.toJSON(),]; 
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('Register done.');
  } catch (e) {
    console.error('Register failed:', e?.status || e?.code || e);
    if (e?.rawError) console.error('rawError:', e.rawError);
  }
}

main();
