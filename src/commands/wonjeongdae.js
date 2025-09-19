import { SlashCommandBuilder } from 'discord.js';
import { getSiblings, toLevelNumber } from '../utils/lostark.js';

export const data = new SlashCommandBuilder()
  .setName('wonjeongdae')
  .setDescription('원정대 캐릭터를 아이템 레벨순으로 표시')
  .addStringOption(o =>
    o.setName('nickname').setDescription('대표(검색 기준) 캐릭터 닉네임').setRequired(true)
  )
  .addIntegerOption(o =>
    o.setName('count').setDescription('표시할 캐릭터 수 (기본 10, 최대 20)').setMinValue(1).setMaxValue(20)
  );

export async function execute(interaction) {
  const nickname = interaction.options.getString('nickname');
  const limit = interaction.options.getInteger('count') ?? 10;

  await interaction.deferReply();

  try {
    // ✅ 먼저 호출해서 변수에 담고, 그 다음에 로그 찍기
    const list = await getSiblings(nickname);

    // 디버그: 실제 응답 구조 확인
    console.log('[DEBUG siblings 1~2]', JSON.stringify(list.slice(0, 2), null, 2));

    const sorted = list
      .map(c => {
        // Max가 없으면 Avg 사용 (문자열/숫자/이상 케이스 모두 대비)
        const lvl =
          toLevelNumber(c?.ItemMaxLevel) ||
          toLevelNumber(c?.ItemAvgLevel) ||
          0;

        return {
          name: c?.CharacterName,
          cls: c?.CharacterClassName,
          server: c?.ServerName,
          level: lvl,
        };
      })
      .sort((a, b) => b.level - a.level)
      .slice(0, limit);

    if (sorted.length === 0) {
      return interaction.editReply('원정대 캐릭터를 찾지 못했습니다. 닉네임(대소문자)과 공개 여부를 확인해 주세요.');
    }

    const lines = sorted.map((c, i) =>
      `**${i + 1}. ${c.name}** (${c.cls}) — ${c.level ? c.level.toFixed(2) : 'N/A'} / ${c.server}`
    );

    await interaction.editReply(`원정대 Top ${sorted.length} — ${nickname}\n${lines.join('\n')}`);
  } catch (e) {
    console.error('[wonjeongdae] error', e?.response?.status, e?.response?.data || e);
    const msg = e?.response?.status === 429
      ? '요청이 많아 잠시 후 다시 시도해 주세요. (API 제한)'
      : '데이터를 불러오지 못했어요. 닉네임과 API 키를 확인해 주세요.';
    await interaction.editReply(msg);
  }
}
