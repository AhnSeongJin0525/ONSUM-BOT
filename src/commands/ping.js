import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')                       // ← 영문 소문자
  .setDescription('봇 반응 테스트 (pong!으로 응답)')
  .setNameLocalizations({ ko: '핑' })    // ← 선택: 한글 표시명(클라이언트가 지원 시)

export async function execute(interaction) {
  console.log('[PING]', interaction.user?.tag, '명령 받음');
  await interaction.reply('pong!');
}
