import axios from 'axios';

const client = axios.create({
  baseURL: 'https://developer-lostark.game.onstove.com',
  timeout: 12000,
});

export function setAuth(key) {
  client.defaults.headers.common.Authorization = `bearer ${key}`;
}

// 원정대 캐릭터 목록
export async function getSiblings(nickname) {
  const url = `/characters/${encodeURI(nickname)}/siblings`;
  const { data } = await client.get(url);
  return Array.isArray(data) ? data : [];
}

// 아이템 레벨 숫자화
export function toLevelNumber(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  return parseFloat(String(v).replace(/,/g, '')) || 0;
}

// === 캐릭터 상세 조회 ===
export async function getProfile(name) {
  const { data } = await client.get(`/armories/characters/${encodeURI(name)}/profiles`);
  return data || {};
}

export async function getEngravings(name) {
  const { data } = await client.get(`/armories/characters/${encodeURI(name)}/engravings`);
  return data || {};
}

export async function getGems(name) {
  const { data } = await client.get(`/armories/characters/${encodeURI(name)}/gems`);
  return data || {};
}

export async function getCards(name) {
  const { data } = await client.get(`/armories/characters/${encodeURI(name)}/cards`);
  return data || {};
}

// (이미 있는) 숫자화, 기본 클라이언트 export는 그대로 두기
// export function toLevelNumber(v) { ... }
export default client;

