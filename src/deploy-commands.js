require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId  = process.env.DISCORD_GUILD_ID;

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const full = path.join(commandsPath, file);
  const cmd = require(full);
  if (!cmd?.data?.toJSON) {
    console.warn(`⚠️ 스킵: ${file} (data.toJSON 없음)`);
    continue;
  }
  commands.push(cmd.data.toJSON());
  console.log(`✅ 로드: ${file} → /${cmd.data.name}`);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔑 clientId:', clientId);
    console.log('🛡️ guildId :', guildId || '(글로벌)');
    console.log('📦 올릴 명령 수:', commands.length);

    if (!guildId) {
      console.log('❗ 테스트는 길드 등록이 안전합니다. DISCORD_GUILD_ID 를 .env에 넣어주세요.');
    }

    // 1) 현재 길드 명령 전부 삭제 (꼬임 방지)
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log('🧹 길드 명령 전체 삭제 완료');
    }

    // 2) 재배포
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('✅ 길드 등록 완료 (즉시 반영)');
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ 글로벌 등록 완료 (반영까지 시간 걸릴 수 있음)');
    }

    // 3) 목록 확인
    const list = guildId
      ? await rest.get(Routes.applicationGuildCommands(clientId, guildId))
      : await rest.get(Routes.applicationCommands(clientId));
    console.log('🧾 현재 등록된 명령:', list.map(c => `/${c.name}`).join(', ') || '(없음)');
  } catch (err) {
    console.error('❌ 등록 실패:', err);
  }
})();
