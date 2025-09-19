import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import {
  getProfile, getEngravings, getGems, getCards, toLevelNumber
} from '../utils/lostark.js';

// 전투 특성 뽑기
const pickStat = (arr, key, d = 0) => Number(arr?.find?.(s => s?.Type === key)?.Value ?? d);

// 보석 타입 분류: 겁화(=멸화), 작열(=홍염)
const kindOfGem = (name = '') => {
  const n = String(name);
  if (/(멸화|겁화)/.test(n)) return '겁화';
  if (/(홍염|작열)/.test(n)) return '작열';
  if (/광휘/.test(n)) return '광휘';
  return '기타';
};

// ----- 장착 각인 파싱 (Effects 우선 → Engravings.Tooltip → ArkPassiveEffects) -----
function parseEquippedEngravings(e) {
  let found = [];

  // 1) ArkPassiveEffects 우선
  const effects = e?.ArkPassiveEffects || [];
  for (const it of effects) {
    let name = it?.Name?.trim() || '';
    if (name) {
      name = name.replace(/\s*Lv\.\d+/, '').trim(); // "Lv.x" 제거
      found.push(name);
    }
  }

  // 2) Effects가 비면 Engravings[].Tooltip 참고
  if (found.length === 0 && Array.isArray(e?.Engravings) && e.Engravings.length) {
    for (const it of e.Engravings) {
      let name = String(it?.Name || '').trim();
      if (!name) continue;
      name = name.replace(/\s*Lv\.\d+/, '').trim();
      found.push(name);
    }
  }

  // 중복 제거 + 이름순 정렬
  const unique = [...new Set(found)];
  return unique.sort((a, b) => a.localeCompare(b));
}


  // 3) 최신 응답: ArkPassiveEffects에 각인이 들어오는 경우 (지금 네 케이스)
  if (found.length === 0 && Array.isArray(e?.ArkPassiveEffects) && e.ArkPassiveEffects.length) {
    for (const it of e.ArkPassiveEffects) {
      const name = String(it?.Name || '').trim(); // 예: "아드레날린", "예리한 둔기"
      if (!name) continue;
      // 레벨 후보: AbilityStoneLevel > Level > Description 파싱
      let level = Number(it?.AbilityStoneLevel ?? 0) || Number(it?.Level ?? 0) || 0;
      if (!level) {
        const desc = String(it?.Description || '');
        const m = desc.match(/활성\s*레벨\s*(\d)|Lv\.?\s*(\d)|레벨\s*(\d)/i);
        level = m ? Number(m[1] || m[2] || m[3]) || 0 : 0;
      }
      found.push({ name, level });
    }
  }

  // 4) 이름 기준 병합(최대 레벨), 정렬: 레벨 내림차순 → 이름 오름차순
  const byName = new Map();
  for (const { name, level } of found) {
    byName.set(name, Math.max(byName.get(name) || 0, level));
  }
  return [...byName.entries()]
    .map(([name, level]) => ({ name, level }))
    .sort((a, b) => (b.level - a.level) || a.name.localeCompare(b.name, 'ko'));
}

// 긴 텍스트를 임베드 필드(1024자)로 자동 분할
function splitToEmbedFields(label, text, max = 1024) {
  if ((text ?? '').length <= max) return [{ name: label, value: text || '-', inline: false }];
  const out = [];
  let chunk = '';
  for (const line of String(text).split('\n')) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > max) {
      out.push({ name: label + (out.length ? ` (${out.length + 1})` : ''), value: chunk, inline: false });
      chunk = line;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) out.push({ name: label + (out.length ? ` (${out.length + 1})` : ''), value: chunk, inline: false });
  return out;
}

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('캐릭터 상세 프로필을 보여줍니다')
  .setNameLocalizations({ ko: '프로필' })
  .addStringOption(o => o.setName('nickname').setDescription('캐릭터 닉네임').setRequired(true));

export async function execute(interaction) {
  const name = interaction.options.getString('nickname');

  // 응답 보장용 defer
  let deferred = false;
  try { await interaction.deferReply(); deferred = true; } catch {}

  try {
    // 데이터 병렬 수집
    const [p, e, g, c] = await Promise.all([
      getProfile(name),
      getEngravings(name),
      getGems(name),
      getCards(name),
    ]);
    console.log('[DEBUG ENGRAVINGS]', JSON.stringify(e).slice(0, 500));


    // 기본 정보
    const cls = p?.CharacterClassName || 'Unknown';
    const server = p?.ServerName || '-';
    const ilvl = toLevelNumber(p?.ItemMaxLevel || p?.ItemAvgLevel);
    const expLv = p?.ExpeditionLevel ?? '-';

    // 전투 특성
    const stats = Array.isArray(p?.Stats) ? p.Stats : [];
    const crit = pickStat(stats, '치명');
    const spec = pickStat(stats, '특화');
    const swift = pickStat(stats, '신속');
    const dom = pickStat(stats, '제압');
    const end = pickStat(stats, '인내');
    const exp = pickStat(stats, '숙련');

    // 장착 각인(전부)
    const equippedEng = parseEquippedEngravings(e);
    const engrItems = equippedEng.map(x => `• ${x.name}${x.level ? ` Lv.${x.level}` : ''}`.trim());
    const engrText = engrItems.length ? engrItems.join('\n') : '-';

    // 보석 상세(요약 없이, 레벨×타입 집계)
    const gemList = Array.isArray(g?.Gems) && g.Gems.length ? g.Gems :
                    (Array.isArray(g?.gems) ? g.gems : []);
    const countsByLvl = new Map(); // level -> { 겁화, 작열, 광휘, 기타, total }
    for (const x of gemList) {
      const lvl = Number(x?.Level || 0);
      if (!lvl) continue;
      const k = kindOfGem(x?.Name || x?.Tooltip || '');
      const bucket = countsByLvl.get(lvl) || { 겁화: 0, 작열: 0, 광휘: 0, 기타: 0, total: 0 };
      bucket[k] = (bucket[k] ?? 0) + 1;
      bucket.total += 1;
      countsByLvl.set(lvl, bucket);
    }

const gemDetailLines = [...countsByLvl.entries()]
  .sort((a, b) => b[0] - a[0])
  .map(([lvl, c]) =>
    `Lv${lvl}: 겁화 ${c.겁화 || 0} · 작열 ${c.작열 || 0} · 광휘 ${c.광휘 || 0}${c.기타 ? ` · 기타 ${c.기타}` : ''}`
  );
const gemDetail = gemDetailLines.length ? gemDetailLines.join('\n') : '-';


    // 카드
    const cards = Array.isArray(c?.Cards) ? c.Cards : [];
    const awakeningSum = cards.reduce((acc, it) => acc + (Number(it?.AwakeCount || 0)), 0);
    const setName = c?.Effects?.[0]?.Items?.[0]?.Name || '-';

    // 임베드
    const embed = new EmbedBuilder()
      .setTitle(`${name} — ${cls}`)
      .setDescription(`서버: **${server}**\n아이템 레벨: **${ilvl.toFixed(2)}**  |  원정대 레벨: **${expLv}**`)
      .addFields(
        { name: '전투 특성', value: `치명 **${crit}** · 특화 **${spec}** · 신속 **${swift}**\n제압 **${dom}** · 인내 **${end}** · 숙련 **${exp}**` },
        ...splitToEmbedFields('장착 각인', engrText),  // 전부 표기(길면 자동 분할)
        { name: '보석 상세', value: gemDetail, inline: false },
        { name: '카드', value: `${setName} / 각성 합 ${awakeningSum}`, inline: false },
      )
      .setFooter({ text: '출처: Lost Ark Open API' })
      .setTimestamp(new Date());

    if (p?.CharacterImage) embed.setThumbnail(p.CharacterImage);

    const response = { embeds: [embed] };
    if (deferred) await interaction.editReply(response);
    else await interaction.reply(response);

  } catch (err) {
    console.error('[profile] error', err?.response?.status, err?.response?.data || err);
    const msg = err?.response?.status === 404
      ? '캐릭터를 찾을 수 없습니다. 닉네임(대소문자)과 공개 여부를 확인해 주세요.'
      : err?.response?.status === 429
      ? '요청이 많아 잠시 후 다시 시도해 주세요. (API 제한)'
      : '데이터를 불러오지 못했어요. API 키/닉네임을 확인해 주세요.';

    try {
      if (deferred) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    } catch {}
  }
}
