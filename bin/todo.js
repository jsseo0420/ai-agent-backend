#!/usr/bin/env node
// 터미널용 todo 명령: 웹 앱과 같은 Supabase 저장소·RPC 함수를 그대로 쓰는 얇은 진입점.
// 관리자 키 없이 .env 의 테스트 계정으로 로그인하므로 RLS가 웹과 똑같이 적용된다.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {} // .env 가 없으면 이미 설정된 환경변수 사용

// supabase.js 는 불러올 때 환경변수를 읽으므로 .env 를 먼저 읽은 뒤 불러온다.
const { newClient } = await import('../server/supabase.js');

const USAGE = `사용법:
  todo add <할 일> [--due YYYY-MM-DD] [--tags 공부,집] [--memo 메모]
  todo list [--active | --done | --today | --overdue] [--tag 태그]
  todo done <id>
  todo summary`;

const todayStr = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD (로컬 시간)

function fail(message) {
  console.error(message);
  process.exit(1);
}

// "--due 2026-11-05" 같은 옵션과 나머지 단어를 나눈다. flags 에 있는 옵션은 값 없이 쓴다.
function parseArgs(args, flags = []) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) rest.push(a);
    else if (flags.includes(a.slice(2))) opts[a.slice(2)] = true;
    else if (i + 1 < args.length) opts[a.slice(2)] = args[++i];
    else fail(`${a} 뒤에 값이 필요합니다.`);
  }
  return { opts, rest };
}

async function login() {
  const email = process.env.TODO_EMAIL;
  const password = process.env.TODO_PASSWORD;
  if (!email || !password) fail('.env 에 TODO_EMAIL / TODO_PASSWORD (테스트 계정)를 넣어 주세요. (.env.example 참고)');
  const supabase = newClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(`로그인 실패: ${error.message}`);
  return supabase;
}

async function rpc(supabase, fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(`오류: ${error.message}`);
  return data;
}

function formatTodo(t) {
  const today = todayStr();
  const parts = [`${String(t.id).padStart(4)}  [${t.is_done ? 'x' : ' '}] ${t.title}`];
  if (t.due_date) {
    if (!t.is_done && t.due_date < today) parts.push(`(마감 지남 ${t.due_date})`);
    else if (t.due_date === today) parts.push('(오늘 마감)');
    else parts.push(`(마감 ${t.due_date})`);
  }
  if (t.tags.length) parts.push(t.tags.map((tag) => `#${tag}`).join(' '));
  return parts.join('  ');
}

const commands = {
  async add(args) {
    const { opts, rest } = parseArgs(args);
    const title = rest.join(' ').trim();
    if (!title) fail('할 일 내용을 입력하세요.\n' + USAGE);
    const supabase = await login();
    const id = await rpc(supabase, 'create_todo', {
      p_title: title,
      p_memo: opts.memo?.trim() || null,
      p_due_date: opts.due || null,
      p_tags: (opts.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    });
    console.log(`추가했습니다: #${id} ${title}`);
  },

  async list(args) {
    const filters = ['active', 'done', 'today', 'overdue'];
    const { opts } = parseArgs(args, filters);
    const todos = await rpc(await login(), 'list_todos', {
      p_filter: filters.find((f) => opts[f]) ?? 'all',
      p_tag: opts.tag || null,
      p_today: todayStr(),
    });
    if (!todos.length) return console.log('할 일이 없습니다.');
    for (const t of todos) console.log(formatTodo(t));
  },

  async done(args) {
    const id = Number(args[0]);
    if (!Number.isInteger(id) || id <= 0) fail('완료할 할 일의 id를 입력하세요. (todo list 로 확인)');
    const ok = await rpc(await login(), 'update_todo', { p_todo_id: id, p_patch: { is_done: true } });
    if (!ok) fail(`#${id} 할 일을 찾을 수 없습니다.`);
    console.log(`완료했습니다: #${id}`);
  },

  async summary() {
    const today = todayStr();
    const supabase = await login();
    const done = await rpc(supabase, 'list_todos', { p_filter: 'done', p_today: today });
    const active = await rpc(supabase, 'list_todos', { p_filter: 'active', p_today: today });
    const doneToday = done.filter((t) => new Date(t.completed_at).toLocaleDateString('sv') === today);
    const overdue = active.filter((t) => t.due_date && t.due_date < today);

    console.log(`${today} 요약`);
    console.log(`  오늘 완료 ${doneToday.length}개 · 남은 할 일 ${active.length}개 · 마감 지남 ${overdue.length}개`);
    for (const t of doneToday) console.log(formatTodo(t));
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) fail(USAGE);
await commands[cmd](args);
