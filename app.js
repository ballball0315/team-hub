(() => {
const SUPABASE_URL = 'https://fwuwowtqqvtnbkxwrwpn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jCcL_uYUYrobyi4qhk2LNg_kmEut0tz';

let sessionToken = localStorage.getItem('teamhub_token') || null;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers || {});
      if (sessionToken) headers.set('x-session-token', sessionToken);
      return fetch(input, { ...init, headers });
    }
  }
});

const LINES = [
  { id: 'app', name: '老板食神 APP', subs: [
    { id: 'overall', name: '整体数据' },
    { id: 'shenshen', name: '食神概况' },
    { id: 'pengyouquan', name: '烹友圈概况' },
    { id: 'meishi', name: '美食概况' },
    { id: 'shebei', name: '设备概况' },
    { id: 'mine', name: '我的概况' }
  ]},
  { id: 'miniApp', name: '老板食神小程序', subs: [] },
  { id: 'robamMini', name: '老板电器小程序', subs: [] }
];
const LINK_PALETTE = ['#0071e3', '#af52de', '#34a853', '#e75480', '#f97316', '#0ea5e9', '#8e44ad', '#16a085', '#d35400', '#e67e22'];
const BIRTHDAYS = [
  { name: '楠楠', lunarMonth: 7, lunarDay: 25 }
];

let currentAccount = null;
let membersById = {};
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selISO = todayISO();
let restDays = new Set();
let monthMessages = [];
let monthLikes = {};
let monthDailyTodos = [];
let longTodos = [];
let links = [];
let myModules = [];
let allModules = [];
let accountList = [];
let editMid = null;
let editTodoId = null;
let editLongId = null;
let editModId = null;
let dragId = null;
let dragKind = null;
let csvModuleId = null;
let csvColumns = [];
let csvRows = [];
let csvDateIdx = 0;
let csvSelected = {};
let csvTargets = {};
let moduleFilters = {};
let editingTableModuleId = null;
let tableDraft = null;
let rangeOpenModuleId = null;
let scaleOpenModuleId = null;
let chartPrefs = {};
try { chartPrefs = JSON.parse(localStorage.getItem('teamhub_chart_prefs') || '{}'); } catch (e) {}
let tablePage = {};
let showLunar = false;

/* ---------- 基础工具 ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function todayISO() { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()); }
function weekday(iso) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseISO(iso).getDay()]; }
function todayCN() { const d = new Date(); return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; }
function lunarText(iso) {
  try {
    const d = parseISO(iso);
    const lunar = window.Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate()).getLunar();
    return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  } catch (e) {
    return '';
  }
}
function lunarMd(iso) {
  try {
    const d = parseISO(iso);
    const lunar = window.Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate()).getLunar();
    return { month: lunar.getMonth(), day: lunar.getDay() };
  } catch (e) {
    return null;
  }
}
function birthdayText(iso) {
  const md = lunarMd(iso);
  if (!md) return '';
  return BIRTHDAYS.filter(b => b.lunarMonth === md.month && b.lunarDay === md.day)
    .map(b => b.name)
    .join('、');
}
function shortDate(iso) { if (!iso) return ''; const d = parseISO(iso.slice(0, 10)); return `${d.getMonth() + 1}/${d.getDate()}`; }
function fmtTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function initial(name) { return (name || '?').trim().charAt(0) || '?'; }
function lineName(id) { return (LINES.find(l => l.id === id) || {}).name || id; }
function subName(line, sub) { const l = LINES.find(x => x.id === line); return (l && sub) ? ((l.subs.find(s => s.id === sub) || {}).name || sub) : ''; }
function memberColor(uid) { return membersById[uid]?.color || '#0071e3'; }
function memberName(uid) { return membersById[uid]?.name || '新同事'; }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(text, isError) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${isError ? '#d6443c' : '#1d1d1f'};color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:80%;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function toastError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    toast('网络请求失败，请稍后重试', true);
  } else {
    toast((err && err.message) || '操作失败', true);
  }
}
function friendlyText(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    return '网络请求失败，请稍后重试';
  }
  return (err && err.message) || '操作失败';
}

/* ---------- 弹窗 ---------- */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-x').forEach(b => b.onclick = () => closeModal(b.dataset.close));

/* ---------- 登录 / 退出 ---------- */
function showLogin() {
  document.getElementById('login').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function showApp() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-msg');
  const submit = document.getElementById('auth-submit');
  msg.textContent = '';
  msg.className = 'auth-msg';
  submit.disabled = true;
  try {
    const { data, error } = await supabase.rpc('login', { p_username: username, p_password: password });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    sessionToken = data.token;
    currentAccount = data.account;
    localStorage.setItem('teamhub_token', sessionToken);
    localStorage.setItem('teamhub_account', JSON.stringify(data.account));
    document.getElementById('auth-password').value = '';
    await enterApp();
  } catch (err) {
    msg.textContent = friendlyText(err);
    msg.className = 'auth-msg err';
  } finally {
    submit.disabled = false;
  }
});
document.getElementById('u-out').onclick = async () => {
  if (sessionToken) { try { await supabase.rpc('logout', { p_token: sessionToken }); } catch (e) {} }
  sessionToken = null;
  localStorage.removeItem('teamhub_token');
  localStorage.removeItem('teamhub_account');
  currentAccount = null;
  resetState();
  showLogin();
};

function resetState() {
  currentAccount = null;
  membersById = {};
  restDays = new Set();
  monthMessages = [];
  monthLikes = {};
  monthDailyTodos = [];
  longTodos = [];
  links = [];
  myModules = [];
  allModules = [];
  editMid = null;
  editTodoId = null;
  editLongId = null;
  editModId = null;
}

/* ---------- 修改密码 ---------- */
document.getElementById('u-password').onclick = () => {
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-new2').value = '';
  document.getElementById('pw-msg').textContent = '';
  document.getElementById('pw-msg').className = 'modal-msg';
  openModal('password-modal');
};
document.getElementById('pw-cancel').onclick = () => closeModal('password-modal');
document.getElementById('pw-save').onclick = async () => {
  const oldP = document.getElementById('pw-old').value;
  const newP = document.getElementById('pw-new').value;
  const newP2 = document.getElementById('pw-new2').value;
  const msg = document.getElementById('pw-msg');
  msg.textContent = '';
  msg.className = 'modal-msg';
  if (!oldP || !newP) { msg.textContent = '请填写完整'; msg.className = 'modal-msg err'; return; }
  if (newP.length < 6) { msg.textContent = '新密码至少 6 位'; msg.className = 'modal-msg err'; return; }
  if (newP !== newP2) { msg.textContent = '两次新密码不一致'; msg.className = 'modal-msg err'; return; }
  const { data, error } = await supabase.rpc('change_password', { p_token: sessionToken, p_old: oldP, p_new: newP });
  if (error) { msg.textContent = error.message; msg.className = 'modal-msg err'; return; }
  if (data && data.error) { msg.textContent = data.error; msg.className = 'modal-msg err'; return; }
  msg.textContent = '密码已修改';
  msg.className = 'modal-msg ok';
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-new2').value = '';
  setTimeout(() => closeModal('password-modal'), 700);
};

/* ---------- 账号管理 ---------- */
document.getElementById('u-accounts').onclick = () => openAccountPage();
document.getElementById('acct-back').onclick = () => closeAccountPage();
document.getElementById('acct-add').onclick = addAccount;
async function openAccountPage() {
  document.getElementById('acct-name').value = '';
  document.getElementById('acct-username').value = '';
  document.getElementById('acct-password').value = '';
  document.getElementById('acct-is-admin').checked = false;
  document.getElementById('acct-color').value = '#0071e3';
  setAcctMsg('', '');
  document.getElementById('main-tabs').style.display = 'none';
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('account-page').style.display = 'block';
  await loadAccounts();
}
function closeAccountPage() {
  document.getElementById('account-page').style.display = 'none';
  document.getElementById('main-tabs').style.display = 'flex';
  goTab('t1');
}
function setAcctMsg(text, cls) {
  const el = document.getElementById('acct-msg');
  el.textContent = text;
  el.className = 'modal-msg' + (cls ? ' ' + cls : '');
}
async function loadAccounts() {
  const { data, error } = await supabase.rpc('list_accounts', { p_token: sessionToken });
  if (error) { setAcctMsg(friendlyText(error), 'err'); document.getElementById('account-list').innerHTML = ''; return; }
  if (data && data.error) { setAcctMsg(data.error, 'err'); document.getElementById('account-list').innerHTML = ''; return; }
  renderAccountList(data.accounts || []);
}
function renderAccountList(list) {
  accountList = list;
  const box = document.getElementById('account-list');
  if (!list.length) { box.innerHTML = '<div class="empty" style="padding:14px 4px;">暂无账号</div>'; return; }
  box.innerHTML = list.map(a => {
    const self = a.id === currentAccount.id;
    const badge = self
      ? '<span class="badge self">我</span>'
      : (a.is_admin ? '<span class="badge">管理员</span>' : '');
    const toggleText = a.is_admin ? '取消管理' : '设为管理';
    return `<div class="acct-row" data-id="${a.id}">
      <div class="av" style="background:${a.color || '#0071e3'}">${escapeHtml(initial(a.name))}</div>
      <span class="an">${escapeHtml(a.name)}</span>
      <span class="un">${escapeHtml(a.username)}</span>
      ${badge}
      <input type="color" class="acct-color" data-color="${a.id}" value="${a.color || '#0071e3'}" title="设置颜色">
      <div class="acts">
        <button data-toggle="${a.id}" data-now="${a.is_admin}">${toggleText}</button>
        <button data-reset="${a.id}">重置密码</button>
        <button class="del" data-del="${a.id}" ${self ? 'disabled style="opacity:.4;cursor:default;"' : ''}>删除</button>
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => toggleAdmin(Number(b.dataset.toggle), b.dataset.now === 'true'));
  box.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => resetPassword(Number(b.dataset.reset)));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteAccount(Number(b.dataset.del)));
  box.querySelectorAll('[data-color]').forEach(input => input.onchange = () => setAccountColor(Number(input.dataset.color), input.value));
}
async function addAccount() {
  const name = document.getElementById('acct-name').value.trim();
  const username = document.getElementById('acct-username').value.trim();
  const password = document.getElementById('acct-password').value;
  const isAdmin = document.getElementById('acct-is-admin').checked;
  const color = document.getElementById('acct-color').value || '#0071e3';
  if (!name || !username || !password) { setAcctMsg('请填写姓名、账号和初始密码', 'err'); return; }
  if (password.length < 6) { setAcctMsg('初始密码至少 6 位', 'err'); return; }
  const { data, error } = await supabase.rpc('create_account', {
    p_token: sessionToken, p_username: username, p_name: name, p_password: password, p_is_admin: isAdmin, p_color: color
  });
  if (error) { setAcctMsg(friendlyText(error), 'err'); return; }
  if (data && data.error) { setAcctMsg(data.error, 'err'); return; }
  setAcctMsg('账号已添加', 'ok');
  document.getElementById('acct-name').value = '';
  document.getElementById('acct-username').value = '';
  document.getElementById('acct-password').value = '';
  document.getElementById('acct-is-admin').checked = false;
  document.getElementById('acct-color').value = '#0071e3';
  await loadAccounts();
  await loadMembers();
}
async function toggleAdmin(id, current) {
  const account = accountList.find(a => a.id === id);
  if (!account) return;
  const { data, error } = await supabase.rpc('update_account', {
    p_token: sessionToken, p_id: id, p_username: account.username, p_name: account.name,
    p_is_admin: !current, p_password: null
  });
  if (error) { setAcctMsg(friendlyText(error), 'err'); return; }
  if (data && data.error) { setAcctMsg(data.error, 'err'); return; }
  setAcctMsg('权限已更新', 'ok');
  await loadAccounts();
  await loadMembers();
}
async function setAccountColor(id, color) {
  const account = accountList.find(a => a.id === id);
  if (!account) return;
  const { data, error } = await supabase.rpc('update_account', {
    p_token: sessionToken, p_id: id, p_username: account.username, p_name: account.name,
    p_is_admin: account.is_admin, p_password: null, p_color: color
  });
  if (error) { setAcctMsg(friendlyText(error), 'err'); return; }
  if (data && data.error) { setAcctMsg(data.error, 'err'); return; }
  if (id === currentAccount.id) {
    currentAccount.color = color;
    localStorage.setItem('teamhub_account', JSON.stringify(currentAccount));
    renderHeader();
  }
  setAcctMsg('颜色已更新', 'ok');
  await loadAccounts();
  await loadMembers();
}
async function resetPassword(id) {
  const pwd = prompt('输入新密码（至少 6 位）');
  if (pwd == null) return;
  if (pwd.length < 6) { setAcctMsg('新密码至少 6 位', 'err'); return; }
  const account = accountList.find(a => a.id === id);
  if (!account) return;
  const { data, error } = await supabase.rpc('update_account', {
    p_token: sessionToken, p_id: id, p_username: account.username, p_name: account.name,
    p_is_admin: account.is_admin, p_password: pwd
  });
  if (error) { setAcctMsg(friendlyText(error), 'err'); return; }
  if (data && data.error) { setAcctMsg(data.error, 'err'); return; }
  setAcctMsg('密码已重置', 'ok');
}
async function deleteAccount(id) {
  if (!confirm('确认删除该账号？')) return;
  const { data, error } = await supabase.rpc('delete_account', { p_token: sessionToken, p_id: id });
  if (error) { setAcctMsg(friendlyText(error), 'err'); return; }
  if (data && data.error) { setAcctMsg(data.error, 'err'); return; }
  setAcctMsg('账号已删除', 'ok');
  await loadAccounts();
  await loadMembers();
}

/* ---------- 数据加载 ---------- */
async function loadMembers() {
  const { data, error } = await supabase.rpc('list_members', { p_token: sessionToken });
  if (error) { toastError(error); return; }
  if (data && data.error) { toast(data.error, true); return; }
  membersById = {};
  (data.members || []).forEach(m => { membersById[m.id] = m; });
}
async function loadCalendarData() {
  await Promise.all([loadRestDays(), loadMonthMessages(), loadMonthDailyTodos()]);
}
async function loadRestDays() {
  const r = await supabase.from('rest_days').select('day');
  if (r.error) toast(r.error.message, true);
  restDays = new Set((r.data || []).map(x => x.day));
}
async function loadMonthMessages() {
  const first = toISO(viewYear, viewMonth, 1);
  const last = toISO(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
  const m = await supabase.from('messages').select('*').gte('day', first).lte('day', last).order('created_at', { ascending: true });
  if (m.error) toast(m.error.message, true);
  monthMessages = m.data || [];
  monthLikes = {};
  const ids = monthMessages.map(x => x.id);
  if (ids.length) {
    const l = await supabase.from('message_likes').select('*').in('message_id', ids);
    if (l.error) toast(l.error.message, true);
    (l.data || []).forEach(like => {
      if (!monthLikes[like.message_id]) monthLikes[like.message_id] = [];
      monthLikes[like.message_id].push(like.user_id);
    });
  }
}
async function loadMonthDailyTodos() {
  const first = toISO(viewYear, viewMonth, 1);
  const last = toISO(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
  const t = await supabase.from('todos').select('*').eq('kind', 'daily').gte('day', first).lte('day', last);
  if (t.error) toast(t.error.message, true);
  monthDailyTodos = t.data || [];
}
async function loadLongTodos() {
  const { data, error } = await supabase.from('todos').select('*').eq('kind', 'long').order('created_at', { ascending: true });
  if (error) { toastError(error); return; }
  longTodos = data || [];
}
async function loadLinks() {
  const { data, error } = await supabase.from('links').select('*').order('created_at', { ascending: true });
  if (error) { toastError(error); return; }
  links = data || [];
}
async function loadModules() {
  const { data, error } = await supabase.from('data_modules').select('*').order('created_at', { ascending: true });
  if (error) { toastError(error); return; }
  allModules = data || [];
  myModules = allModules.filter(m => m.user_id === currentAccount.id);
}

/* ---------- 进入应用 ---------- */
async function enterApp() {
  renderAppShell();
  await loadAppData();
}
function renderAppShell() {
  showApp();
  renderHeader();
  updateSubVisibility();
}
async function loadAppData() {
  try {
    await Promise.all([loadMembers(), loadCalendarData(), loadLongTodos(), loadLinks(), loadModules()]);
  } catch (e) {
    toastError(e);
  }
  renderAll();
  saveSnapshot();
}
function renderAll() {
  renderCalendar();
  renderDayPanel();
  renderMessages();
  renderLong();
  renderLinks();
  renderMods();
  renderAdminBtn();
}
function saveSnapshot() {
  if (!currentAccount) return;
  try {
    localStorage.setItem('teamhub_snapshot_' + currentAccount.id, JSON.stringify({
      membersById,
      restDays: [...restDays],
      monthMessages,
      monthLikes,
      monthDailyTodos,
      longTodos,
      links,
      allModules,
      myModules,
      viewYear,
      viewMonth,
      selISO
    }));
  } catch (e) {}
}
function loadSnapshot() {
  if (!currentAccount) return false;
  try {
    const raw = localStorage.getItem('teamhub_snapshot_' + currentAccount.id);
    if (!raw) return false;
    const s = JSON.parse(raw);
    membersById = s.membersById || {};
    restDays = new Set(s.restDays || []);
    monthMessages = s.monthMessages || [];
    monthLikes = s.monthLikes || {};
    monthDailyTodos = s.monthDailyTodos || [];
    longTodos = s.longTodos || [];
    links = s.links || [];
    allModules = s.allModules || [];
    myModules = s.myModules || [];
    viewYear = s.viewYear || new Date().getFullYear();
    viewMonth = (s.viewMonth ?? new Date().getMonth());
    selISO = s.selISO || todayISO();
    return true;
  } catch (e) {
    return false;
  }
}
function renderHeader() {
  document.getElementById('u-av').textContent = initial(currentAccount.name);
  document.getElementById('u-av').style.background = currentAccount.color || '#0071e3';
  document.getElementById('u-name').textContent = currentAccount.name;
  document.getElementById('u-accounts').style.display = currentAccount.is_admin ? 'inline-block' : 'none';
  document.getElementById('header-sub').textContent = `食神 APP 产品组 · ${todayCN()} ${weekday(todayISO())}`;
}

/* ---------- 日历 ---------- */
function renderCalendar() {
  document.getElementById('cal-month').textContent = `${viewYear}年${viewMonth + 1}月`;
  const grid = document.getElementById('cal-grid');
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const offset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cal-cell dim"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(viewYear, viewMonth, d);
    const msgs = monthMessages.filter(m => m.day === iso);
    const done = monthDailyTodos.filter(t => t.day === iso && t.done).length;
    const uids = [...new Set(msgs.map(m => m.user_id))];
    const cls = ['cal-cell'];
    if (iso === todayISO()) cls.push('today');
    if (iso === selISO) cls.push('sel');
    const restHtml = restDays.has(iso) ? '<span class="cal-rest">休</span>' : '';
    const doneHtml = done ? `<span class="cal-done">${done}项</span>` : '';
    const dotsHtml = uids.length ? `<div class="cal-dots">${uids.map(u => `<span class="cal-dot" style="background:${memberColor(u)}"></span>`).join('')}</div>` : '';
    const lunar = showLunar ? lunarText(iso) : '';
    const lunarHtml = lunar ? `<span class="cal-lunar">${lunar}</span>` : '';
    const birthday = birthdayText(iso);
    const birthdayHtml = birthday ? `<span class="cal-birthday" title="生日">${birthday}</span>` : '';
    html += `<div class="${cls.join(' ')}" data-day="${iso}"><div class="cal-d">${d}</div>${lunarHtml}${birthdayHtml}${restHtml}${dotsHtml}${doneHtml}</div>`;
  }
  const tail = (7 - ((offset + daysInMonth) % 7)) % 7;
  for (let i = 0; i < tail; i++) html += '<div class="cal-cell dim"></div>';
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-cell[data-day]').forEach(el => {
    el.onclick = () => {
      selISO = el.dataset.day;
      renderCalendar();
      renderDayPanel();
      renderMessages();
      renderAdminBtn();
    };
  });
}
function renderAdminBtn() {
  const btn = document.getElementById('cal-admin');
  if (!currentAccount.is_admin || !selISO) { btn.style.display = 'none'; return; }
  btn.style.display = 'inline-flex';
  const marked = restDays.has(selISO);
  btn.textContent = marked ? '取消休息' : '标记休息';
  btn.classList.toggle('on', marked);
}
async function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  selISO = null;
  await loadCalendarData();
  renderCalendar();
  renderDayPanel();
  renderMessages();
  renderAdminBtn();
}
document.getElementById('cal-prev').onclick = () => changeMonth(-1);
document.getElementById('cal-next').onclick = () => changeMonth(1);
document.getElementById('lunar-toggle').onclick = () => {
  showLunar = !showLunar;
  document.getElementById('lunar-toggle').textContent = showLunar ? '隐藏农历' : '显示农历';
  renderCalendar();
};
document.getElementById('cal-admin').onclick = async () => {
  if (!selISO) return;
  if (restDays.has(selISO)) {
    await supabase.from('rest_days').delete().eq('day', selISO);
  } else {
    await supabase.from('rest_days').insert({ day: selISO, created_by: currentAccount.id });
  }
  await loadRestDays();
  renderCalendar();
  renderDayPanel();
  renderAdminBtn();
};

/* ---------- 每日待办 ---------- */
function renderDayPanel() {
  const box = document.getElementById('day-panel');
  if (!selISO) {
    box.innerHTML = `<div class="stitle">${viewYear}年${viewMonth + 1}月待办</div><div class="empty">选择左侧日期查看</div>`;
    return;
  }
  const list = monthDailyTodos
    .filter(t => t.day === selISO)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const done = list.filter(t => t.done).length;
  const rest = restDays.has(selISO);
  const title = selISO === todayISO() ? '今日待办' : `${viewMonth + 1}月${parseISO(selISO).getDate()}日 待办`;
  let html = `<div class="stitle"><span>${title}</span><span class="stitle-right"><span class="cnt">完成 ${done} 项${rest ? ' · <span style="color:var(--green)">休</span>' : ''}</span><button class="flow-btn" id="flow-btn">未完成转入长期待办</button></span></div>`;
  html += `<div class="side-scroll">`;
  html += `<div class="todo-input"><input id="today-text" placeholder="添加该日待办，回车"><button id="today-add">+</button></div>`;
  html += `<div id="today-list"></div>`;
  html += `</div>`;
  box.innerHTML = html;
  renderTodayList(list);
  const ti = document.getElementById('today-text');
  const addToday = async () => {
    const v = ti.value.trim();
    if (!v) return;
    const tempId = Date.now();
    monthDailyTodos.push({ id: tempId, user_id: currentAccount.id, kind: 'daily', day: selISO, text: v, done: false, position: 0, created_at: new Date().toISOString() });
    ti.value = '';
    renderCalendar();
    renderDayPanel();
    const { data, error } = await supabase.from('todos').insert({ user_id: currentAccount.id, kind: 'daily', day: selISO, text: v, done: false, position: 0 }).select().single();
    if (error) {
      monthDailyTodos = monthDailyTodos.filter(t => t.id !== tempId);
      toastError(error);
    } else if (data) {
      const idx = monthDailyTodos.findIndex(t => t.id === tempId);
      if (idx >= 0) monthDailyTodos[idx] = data;
    }
    renderCalendar();
    renderDayPanel();
  };
  ti.onkeydown = e => { if (e.key === 'Enter') addToday(); };
  document.getElementById('today-add').onclick = addToday;
  document.getElementById('today-list').onclick = todayListClick;
  document.getElementById('flow-btn').onclick = flowToLong;
}
function renderTodayList(list) {
  const box = document.getElementById('today-list');
  if (!list.length) { box.innerHTML = '<div class="empty" style="padding:14px 4px;">该日暂无待办</div>'; return; }
  box.innerHTML = list.map(x => {
    const editing = x.id === editTodoId;
    const txt = editing
      ? `<input class="todo-edit" id="todo-edit-input" value="${escapeHtml(x.text)}">`
      : `<div class="txt">${escapeHtml(x.text)}</div>`;
    const acts = editing
      ? `<button class="mx" data-tsave="${x.id}">保存</button><button class="mx" data-tcancel="1">取消</button>`
      : `<button class="mx" data-tedit="${x.id}">编辑</button><button class="mx del" data-del="${x.id}">×</button>`;
    return `<div class="todo-item${x.done ? ' done' : ''}" data-id="${x.id}"><span class="grip" draggable="true" title="拖拽排序"><i></i><i></i><i></i></span><div class="cb${x.done ? ' on' : ''}"></div>${txt}${acts}</div>`;
  }).join('');
  const editInput = document.getElementById('todo-edit-input');
  if (editInput) editInput.onkeydown = e => {
    if (e.key === 'Enter') {
      const saveBtn = box.querySelector('[data-tsave]');
      if (saveBtn) saveBtn.click();
    }
  };
  bindDrag(box, 'daily');
}
async function todayListClick(e) {
  const item = e.target.closest('.todo-item');
  if (!item) return;
  const id = Number(item.dataset.id);
  const t = e.target;
  if (t.dataset.tedit) { editTodoId = id; renderDayPanel(); return; }
  if (t.dataset.tcancel) { editTodoId = null; renderDayPanel(); return; }
  if (t.dataset.tsave) {
    const v = document.getElementById('todo-edit-input').value.trim();
    const todo = monthDailyTodos.find(x => x.id === id);
    editTodoId = null;
    if (todo && v) {
      todo.text = v;
      supabase.from('todos').update({ text: v }).eq('id', id).then(({ error }) => {
        if (error) { toastError(error); loadMonthDailyTodos().then(() => { renderCalendar(); renderDayPanel(); }); }
      });
    }
    renderCalendar();
    renderDayPanel();
    return;
  }
  if (t.dataset.del) {
    monthDailyTodos = monthDailyTodos.filter(x => x.id !== id);
    supabase.from('todos').delete().eq('id', id).then(({ error }) => {
      if (error) { toastError(error); loadMonthDailyTodos().then(() => { renderCalendar(); renderDayPanel(); }); }
    });
    renderCalendar();
    renderDayPanel();
    return;
  }
  if (t.classList.contains('cb') || t.classList.contains('txt')) {
    const todo = monthDailyTodos.find(x => x.id === id);
    if (todo) {
      todo.done = !todo.done;
      supabase.from('todos').update({ done: todo.done }).eq('id', id).then(({ error }) => {
        if (error) { toastError(error); loadMonthDailyTodos().then(() => { renderCalendar(); renderDayPanel(); }); }
      });
    }
    renderCalendar();
    renderDayPanel();
  }
}
async function flowToLong() {
  const undone = monthDailyTodos.filter(t => t.day === selISO && !t.done);
  if (!undone.length) return;
  const ids = undone.map(t => t.id);
  undone.forEach(t => { t.kind = 'long'; t.day = null; });
  monthDailyTodos = monthDailyTodos.filter(t => !ids.includes(t.id));
  longTodos = [...longTodos, ...undone];
  renderCalendar();
  renderDayPanel();
  renderLong();
  const { error } = await supabase.from('todos').update({ kind: 'long', day: null }).in('id', ids);
  if (error) {
    toastError(error);
    await Promise.all([loadMonthDailyTodos(), loadLongTodos()]);
    renderCalendar();
    renderDayPanel();
    renderLong();
  }
}
function bindDrag(listEl, kind) {
  listEl.querySelectorAll('.todo-item').forEach(item => {
    const grip = item.querySelector('.grip');
    if (grip) {
      grip.draggable = true;
      grip.addEventListener('dragstart', e => {
        item.classList.add('dragging');
        dragId = Number(item.dataset.id);
        dragKind = kind;
        e.dataTransfer.effectAllowed = 'move';
      });
      grip.addEventListener('dragend', () => item.classList.remove('dragging'));
    }
    item.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = listEl.querySelector('.dragging');
      if (!dragging || dragging === item) return;
      const rect = item.getBoundingClientRect();
      const before = (e.clientY - rect.top) / rect.height < 0.5;
      listEl.insertBefore(dragging, before ? item : item.nextSibling);
    });
  });
  listEl.ondrop = async e => {
    e.preventDefault();
    if (dragId == null) return;
    const ids = [...listEl.querySelectorAll('.todo-item')].map(el => Number(el.dataset.id));
    await applyReorder(kind, ids);
    dragId = null;
    dragKind = null;
  };
}
async function applyReorder(kind, ids) {
  if (kind === 'daily') {
    if (!selISO) return;
    const ordered = ids.map(id => monthDailyTodos.find(t => t.id === id)).filter(Boolean);
    const other = monthDailyTodos.filter(t => t.day !== selISO);
    ordered.forEach((t, i) => { t.position = i; });
    monthDailyTodos = [...other, ...ordered];
    renderCalendar();
    renderDayPanel();
    Promise.all(ordered.map((t, i) => supabase.from('todos').update({ position: i }).eq('id', t.id)))
      .then(results => { const err = results.find(r => r.error); if (err) toast(err.error.message, true); });
  } else {
    const ordered = ids.map(id => longTodos.find(t => t.id === id)).filter(Boolean);
    ordered.forEach((t, i) => { t.position = i; });
    longTodos = ordered;
    renderLong();
    Promise.all(ordered.map((t, i) => supabase.from('todos').update({ position: i }).eq('id', t.id)))
      .then(results => { const err = results.find(r => r.error); if (err) toast(err.error.message, true); });
  }
}

/* ---------- 长期待办 ---------- */
async function addLongTodo() {
  const input = document.getElementById('long-text');
  const v = input.value.trim();
  if (!v) return;
  const tempId = Date.now();
  const position = longTodos.length;
  longTodos.push({ id: tempId, user_id: currentAccount.id, kind: 'long', day: null, text: v, done: false, position, created_at: new Date().toISOString() });
  input.value = '';
  renderLong();
  const { data, error } = await supabase.from('todos').insert({
    user_id: currentAccount.id, kind: 'long', day: null, text: v, done: false, position
  }).select().single();
  if (error) {
    longTodos = longTodos.filter(t => t.id !== tempId);
    toastError(error);
  } else if (data) {
    const idx = longTodos.findIndex(t => t.id === tempId);
    if (idx >= 0) longTodos[idx] = data;
  }
  renderLong();
}
document.getElementById('long-add').onclick = addLongTodo;
document.getElementById('long-text').onkeydown = e => { if (e.key === 'Enter') addLongTodo(); };
function renderLong() {
  const box = document.getElementById('long-list');
  document.getElementById('long-cnt').textContent = longTodos.filter(x => !x.done).length;
  if (!longTodos.length) { box.innerHTML = '<div class="empty" style="padding:14px 4px;">暂无长期待办</div>'; return; }
  box.innerHTML = longTodos.map(x => {
    const editing = x.id === editLongId;
    const txt = editing
      ? `<input class="todo-edit" id="long-edit-input" value="${escapeHtml(x.text)}">`
      : `<div class="txt">${escapeHtml(x.text)}</div>`;
    const acts = editing
      ? `<button class="mx" data-lsave="${x.id}">保存</button><button class="mx" data-lcancel="1">取消</button>`
      : `<button class="mx" data-ledit="${x.id}">编辑</button><button class="mx del" data-del="${x.id}">×</button>`;
    return `<div class="todo-item${x.done ? ' done' : ''}" data-id="${x.id}"><span class="grip" draggable="true" title="拖拽排序"><i></i><i></i><i></i></span><div class="cb${x.done ? ' on' : ''}"></div>${txt}<span class="meta">${shortDate(x.created_at)}</span>${acts}</div>`;
  }).join('');
  box.onclick = longListClick;
  const editInput = document.getElementById('long-edit-input');
  if (editInput) editInput.onkeydown = e => {
    if (e.key === 'Enter') {
      const saveBtn = box.querySelector('[data-lsave]');
      if (saveBtn) saveBtn.click();
    }
  };
  bindDrag(box, 'long');
}
async function longListClick(e) {
  const item = e.target.closest('.todo-item');
  if (!item) return;
  const id = Number(item.dataset.id);
  const t = e.target;
  if (t.dataset.ledit) { editLongId = id; renderLong(); return; }
  if (t.dataset.lcancel) { editLongId = null; renderLong(); return; }
  if (t.dataset.lsave) {
    const v = document.getElementById('long-edit-input').value.trim();
    const todo = longTodos.find(x => x.id === id);
    editLongId = null;
    if (todo && v) {
      todo.text = v;
      supabase.from('todos').update({ text: v }).eq('id', id).then(({ error }) => {
        if (error) { toastError(error); loadLongTodos().then(renderLong); }
      });
    }
    renderLong();
    return;
  }
  if (t.dataset.del) {
    longTodos = longTodos.filter(x => x.id !== id);
    supabase.from('todos').delete().eq('id', id).then(({ error }) => {
      if (error) { toastError(error); loadLongTodos().then(renderLong); }
    });
    renderLong();
    return;
  }
  if (t.classList.contains('cb')) {
    const todo = longTodos.find(x => x.id === id);
    if (todo) {
      longTodos = longTodos.filter(x => x.id !== id);
      const tempId = Date.now();
      const doneTodo = { id: tempId, user_id: currentAccount.id, kind: 'daily', day: todayISO(), text: todo.text, done: true, position: 0, created_at: new Date().toISOString() };
      monthDailyTodos.push(doneTodo);
      renderLong();
      renderCalendar();
      if (selISO === todayISO()) renderDayPanel();
      const { data: inserted, error: insErr } = await supabase.from('todos').insert({
        user_id: currentAccount.id, kind: 'daily', day: todayISO(), text: todo.text, done: true, position: 0
      }).select().single();
      if (insErr) {
        monthDailyTodos = monthDailyTodos.filter(t => t.id !== tempId);
        longTodos.push(todo);
        toast(insErr.message, true);
      } else {
        const idx = monthDailyTodos.findIndex(t => t.id === tempId);
        if (idx >= 0) monthDailyTodos[idx] = inserted;
        await supabase.from('todos').delete().eq('id', id);
      }
      renderLong();
      renderCalendar();
      if (selISO === todayISO()) renderDayPanel();
    }
  }
}

/* ---------- 贺电留言 ---------- */
function renderMessages() {
  const list = document.getElementById('msg-list');
  const cnt = document.getElementById('msg-cnt');
  if (!selISO) {
    list.innerHTML = '<div class="empty">选择日期查看</div>';
    cnt.innerHTML = `0 条 <button class="refresh" id="msg-refresh" title="刷新">刷新</button>`;
    bindRefresh();
    return;
  }
  const ms = monthMessages.filter(m => m.day === selISO).slice().reverse();
  cnt.innerHTML = `${ms.length} 条 <button class="refresh" id="msg-refresh" title="刷新">刷新</button>`;
  bindRefresh();
  if (!ms.length) {
    list.innerHTML = '<div class="empty" style="padding:14px 4px;">还没有贺电，来抢沙发</div>';
    return;
  }
  list.innerHTML = ms.map(m => {
    const u = membersById[m.user_id] || { name: '新同事', color: '#0071e3' };
    const mine = m.user_id === currentAccount.id;
    const likes = monthLikes[m.id] || [];
    const liked = likes.includes(currentAccount.id);
    const likeNames = likes.map(id => memberName(id)).join('、');
    let body;
    if (editMid === m.id) {
      body = `<div class="mrow"><span class="mname" style="color:${u.color}">${escapeHtml(u.name)}</span></div><input class="mtext-edit" id="edit-input" value="${escapeHtml(m.text)}">`;
    } else {
      body = `<div class="mrow"><span class="mname" style="color:${u.color}">${escapeHtml(u.name)}</span><span class="mtime">${fmtTime(m.created_at)}</span></div><div class="mtext">${escapeHtml(m.text)}</div>`;
    }
    let acts = '<div class="msg-acts">';
    if (mine && editMid !== m.id) acts += `<button class="act" data-medit="${m.id}">编辑</button><button class="act del" data-mdel="${m.id}">删除</button>`;
    if (editMid === m.id) acts += `<button class="act save" data-msave="${m.id}">保存</button><button class="act" data-mcancel="1">取消</button>`;
    if (editMid !== m.id) {
      acts += `<button class="like-btn${liked ? ' on' : ''}" data-like="${m.id}">${liked ? '♥' : '♡'} ${likes.length || ''}</button>`;
      if (likes.length) {
        acts += `<span class="likes"><span class="like-avs">${likes.map(id => `<span class="like-av" style="background:${memberColor(id)}" title="${escapeHtml(memberName(id))}"></span>`).join('')}</span><span class="like-n">${likeNames}赞过</span></span>`;
      }
    }
    acts += '</div>';
    return `<div class="msg-item"><div class="mav" style="background:${u.color}">${escapeHtml(initial(u.name))}</div><div class="mbody">${body}${acts}</div></div>`;
  }).join('');
  list.onclick = msgListClick;
}
function bindRefresh() {
  const rb = document.getElementById('msg-refresh');
  if (rb) rb.onclick = async () => { await loadMonthMessages(); renderCalendar(); renderMessages(); };
}
async function msgListClick(e) {
  const t = e.target;
  if (t.dataset.medit) { editMid = Number(t.dataset.medit); renderMessages(); return; }
  if (t.dataset.mcancel) { editMid = null; renderMessages(); return; }
  if (t.dataset.msave) {
    const v = document.getElementById('edit-input').value.trim();
    const mid = Number(t.dataset.msave);
    const m = monthMessages.find(x => x.id === mid);
    editMid = null;
    if (m && v) {
      m.text = v;
      m.updated_at = new Date().toISOString();
      supabase.from('messages').update({ text: v, updated_at: m.updated_at }).eq('id', mid).then(({ error }) => {
        if (error) { toastError(error); loadMonthMessages().then(() => { renderMessages(); renderCalendar(); }); }
      });
    }
    renderCalendar();
    renderMessages();
    return;
  }
  if (t.dataset.mdel) {
    const mid = Number(t.dataset.mdel);
    monthMessages = monthMessages.filter(m => m.id !== mid);
    delete monthLikes[mid];
    supabase.from('messages').delete().eq('id', mid).then(({ error }) => {
      if (error) { toastError(error); loadMonthMessages().then(() => { renderMessages(); renderCalendar(); }); }
    });
    renderCalendar();
    renderMessages();
    return;
  }
  if (t.dataset.like) {
    const mid = Number(t.dataset.like);
    const liked = (monthLikes[mid] || []).includes(currentAccount.id);
    if (liked) {
      monthLikes[mid] = (monthLikes[mid] || []).filter(uid => uid !== currentAccount.id);
      supabase.from('message_likes').delete().eq('message_id', mid).eq('user_id', currentAccount.id).then(({ error }) => { if (error) toastError(error); });
    } else {
      if (!monthLikes[mid]) monthLikes[mid] = [];
      monthLikes[mid].push(currentAccount.id);
      supabase.from('message_likes').insert({ message_id: mid, user_id: currentAccount.id }).then(({ error }) => { if (error) toastError(error); });
    }
    renderMessages();
  }
}
async function sendMsg() {
  const input = document.getElementById('msg-text');
  const v = input.value.trim();
  if (!v || !selISO) return;
  const tempId = Date.now();
  monthMessages.push({ id: tempId, day: selISO, user_id: currentAccount.id, text: v, created_at: new Date().toISOString() });
  monthLikes[tempId] = [];
  input.value = '';
  renderCalendar();
  renderMessages();
  const { data, error } = await supabase.from('messages').insert({ day: selISO, user_id: currentAccount.id, text: v }).select().single();
  if (error) {
    monthMessages = monthMessages.filter(m => m.id !== tempId);
    delete monthLikes[tempId];
    toastError(error);
  } else if (data) {
    const idx = monthMessages.findIndex(m => m.id === tempId);
    if (idx >= 0) monthMessages[idx] = data;
    delete monthLikes[tempId];
    monthLikes[data.id] = [];
  }
  renderCalendar();
  renderMessages();
}
document.getElementById('msg-send').onclick = sendMsg;
document.getElementById('msg-text').onkeydown = e => { if (e.key === 'Enter') sendMsg(); };

/* ---------- 任意门 ---------- */
function renderLinks() {
  const grid = document.getElementById('links-grid');
  if (!links.length) {
    grid.style.display = 'block';
    grid.innerHTML = '<div class="empty">暂无快捷入口，添加一个吧</div>';
    return;
  }
  grid.style.display = 'grid';
  const sorted = [...links].sort((a, b) => {
    const aName = (a.name || '').trim();
    const bName = (b.name || '').trim();
    const aLatin = /^[A-Za-z]/.test(aName);
    const bLatin = /^[A-Za-z]/.test(bName);
    if (aLatin !== bLatin) return aLatin ? -1 : 1;
    return aName.localeCompare(bName, 'zh-Hans-CN');
  });
  grid.innerHTML = sorted.map((l, i) => {
    const canDel = currentAccount.is_admin || l.user_id === currentAccount.id;
    const del = canDel ? `<button class="lx" data-ldel="${l.id}" onclick="event.preventDefault();event.stopPropagation();">×</button>` : '';
    const color = LINK_PALETTE[i % LINK_PALETTE.length];
    return `<a class="link-card" href="${escapeHtml(l.url)}" target="_blank" rel="noopener"><span class="link-icon" style="background:${color}">${escapeHtml(initial(l.name))}</span><span class="link-body"><span class="link-name">${escapeHtml(l.name)}</span><span class="link-url">${escapeHtml(l.url)}</span></span>${del}</a>`;
  }).join('');
  grid.querySelectorAll('[data-ldel]').forEach(b => {
    b.onclick = () => {
      if (!confirm('确认删除该快捷入口？')) return;
      const id = Number(b.dataset.ldel);
      links = links.filter(l => l.id !== id);
      renderLinks();
      supabase.from('links').delete().eq('id', id).then(({ error }) => {
        if (error) { toastError(error); loadLinks().then(renderLinks); }
      });
    };
  });
}
document.getElementById('link-trigger').onclick = () => {
  const f = document.getElementById('link-form');
  f.style.display = f.style.display === 'none' ? 'flex' : 'none';
  if (f.style.display === 'flex') document.getElementById('link-name').focus();
};
document.getElementById('link-cancel').onclick = () => {
  document.getElementById('link-form').style.display = 'none';
  document.getElementById('link-name').value = '';
  document.getElementById('link-url').value = '';
};
document.getElementById('link-confirm').onclick = async () => {
  const name = document.getElementById('link-name').value.trim();
  const url = document.getElementById('link-url').value.trim();
  if (!name || !url) return;
  const tempId = Date.now();
  links.push({ id: tempId, name, url, user_id: currentAccount.id, created_at: new Date().toISOString() });
  document.getElementById('link-name').value = '';
  document.getElementById('link-url').value = '';
  document.getElementById('link-form').style.display = 'none';
  renderLinks();
  const { data, error } = await supabase.from('links').insert({ name, url, user_id: currentAccount.id }).select().single();
  if (error) {
    links = links.filter(l => l.id !== tempId);
    toastError(error);
  } else if (data) {
    const idx = links.findIndex(l => l.id === tempId);
    if (idx >= 0) links[idx] = data;
  }
  renderLinks();
};

/* ---------- 数据模块 ---------- */
function updateSubVisibility() {
  const sub = document.getElementById('m-sub');
  sub.style.display = document.getElementById('m-line').value === 'app' ? 'inline-block' : 'none';
}
document.getElementById('m-line').onchange = updateSubVisibility;
document.getElementById('m-add').onclick = async () => {
  const name = document.getElementById('m-name').value.trim();
  const source = document.getElementById('m-source').value.trim();
  const line = document.getElementById('m-line').value;
  const sub = line === 'app' ? document.getElementById('m-sub').value : '';
  if (!name || !source) return;
  const tempId = Date.now();
  allModules.push({ id: tempId, user_id: currentAccount.id, name, source, line, sub, chart: 'line', data: { series: [], points: [] }, created_at: new Date().toISOString() });
  myModules = allModules.filter(m => m.user_id === currentAccount.id);
  document.getElementById('m-name').value = '';
  document.getElementById('m-source').value = '';
  renderMods();
  const { data, error } = await supabase.from('data_modules').insert({
    user_id: currentAccount.id, name, source, line, sub, chart: 'line', data: { series: [], points: [] }
  }).select().single();
  if (error) {
    allModules = allModules.filter(m => m.id !== tempId);
    myModules = allModules.filter(m => m.user_id === currentAccount.id);
    toastError(error);
  } else if (data) {
    const idx = allModules.findIndex(m => m.id === tempId);
    if (idx >= 0) allModules[idx] = data;
    myModules = allModules.filter(m => m.user_id === currentAccount.id);
  }
  renderMods();
};
function renderMods() {
  const list = document.getElementById('mod-list');
  if (!myModules.length) { list.innerHTML = '<div class="empty">暂无数据模块，新建一个开始追踪</div>'; return; }
  list.innerHTML = myModules.map(m => {
    const editing = m.id === editModId;
    let head, meta;
    if (editing) {
      const subShow = m.line === 'app' ? 'inline-block' : 'none';
      head = `<input id="em-name" value="${escapeHtml(m.name)}" placeholder="模块名" style="flex:1;min-width:120px;"><button class="del" data-msave="${m.id}">保存</button><button class="del" data-mcancel="1">取消</button>`;
      meta = `来源：<input id="em-source" value="${escapeHtml(m.source)}" placeholder="如 友盟" style="width:110px;"> 归属：<select id="em-line"><option value="app" ${m.line === 'app' ? 'selected' : ''}>老板食神 APP</option><option value="miniApp" ${m.line === 'miniApp' ? 'selected' : ''}>老板食神小程序</option><option value="robamMini" ${m.line === 'robamMini' ? 'selected' : ''}>老板电器小程序</option></select><select id="em-sub" style="display:${subShow};margin-left:4px;">${['overall', 'shenshen', 'pengyouquan', 'meishi', 'shebei', 'mine'].map(s => `<option value="${s}" ${m.sub === s ? 'selected' : ''}>${subName('app', s)}</option>`).join('')}</select>`;
    } else {
      const own = `${lineName(m.line)}${m.sub ? ' · ' + subName(m.line, m.sub) : ''}`;
      head = `<span class="name">${escapeHtml(m.name)}</span><span style="margin-left:auto;display:flex;gap:6px;"><button class="del" data-medit="${m.id}">编辑</button><button class="del" data-mdel="${m.id}">删除</button></span>`;
      meta = `来源：<span class="tag">${escapeHtml(m.source)}</span>归属：${own}`;
    }
    const seriesList = moduleSeries(m);
    const valueInputs = seriesList.map(s => `<input class="di-v" placeholder="${escapeHtml(s.label)}" data-vkey="${s.key}" data-vimp="${m.id}">`).join('');
    const filter = moduleFilters[m.id] || {};
    const isTable = m.chart === 'table';
    const pref = chartPref(m.id);
    const editingTable = m.id === editingTableModuleId;
    const headerRight = isTable
      ? (editingTable
          ? `<div class="table-toolbar"><button data-table-save="${m.id}">保存</button><button data-table-cancel="1">取消</button></div>`
          : `<div class="table-toolbar"><button data-table-edit="${m.id}">编辑</button></div>`)
      : `<div class="chart-header-actions"><div class="chart-controls"><div class="seg"><button class="${m.chart === 'line' ? 'on' : ''}" data-type="line" data-mid="${m.id}">折线图</button><button class="${m.chart === 'bar' ? 'on' : ''}" data-type="bar" data-mid="${m.id}">柱状图</button></div><label class="check"><input type="checkbox" data-trend="${m.id}" ${pref.trend ? 'checked' : ''}>趋势线</label><label class="check"><input type="checkbox" data-labels="${m.id}" ${pref.labels ? 'checked' : ''}>数据标签</label></div><div class="scale-filter"><button class="scale-trigger" data-scale-toggle="${m.id}">刻度</button><div class="scale-pop ${scaleOpenModuleId === m.id ? 'open' : ''}" data-scale-pop="${m.id}"><input type="number" data-scale-max="${m.id}" placeholder="最大值" value="${pref.max ?? ''}"><input type="number" data-scale-min="${m.id}" placeholder="最小值" value="${pref.min ?? ''}"><input type="number" data-scale-step="${m.id}" placeholder="间隔" value="${pref.step ?? ''}"></div></div><div class="range-filter"><button class="range-trigger" data-range-toggle="${m.id}">${rangeLabel(filter)}</button><div class="range-pop ${rangeOpenModuleId === m.id ? 'open' : ''}" data-range-pop="${m.id}"><div class="range-shortcuts"><button data-range-shortcut="${m.id}" data-days="7">最近一周</button><button data-range-shortcut="${m.id}" data-days="30">最近一个月</button><button data-range-shortcut="${m.id}" data-days="90">最近三个月</button><button data-range-shortcut="${m.id}" data-days="0">全部</button></div><div class="range-row"><input type="date" data-range-from="${m.id}" value="${filter.from || ''}"><span>至</span><input type="date" data-range-to="${m.id}" value="${filter.to || ''}"></div></div></div></div>`;
    const chartArea = isTable ? (m.id === editingTableModuleId ? renderTableEdit(m) : renderReadonlyTable(m)) : renderChart(m);
    const importArea = isTable ? `<div class="data-import"><input type="date" class="di-d" data-dimp="${m.id}">${valueInputs}<button data-iadd="${m.id}">单条录入</button><button data-csv="${m.id}">导入表格</button></div>` : '';
    return `<div class="mod-card" data-mid="${m.id}">
      <div class="mod-head">${head}</div>
      <div class="mod-meta">${meta}</div>
      <div class="chart-header"><div class="chart-tabs"><button class="ct${m.chart === 'table' ? ' on' : ''}" data-mode="table" data-mid="${m.id}">表格</button><button class="ct${m.chart !== 'table' ? ' on' : ''}" data-mode="chart" data-mid="${m.id}">图表</button></div>${headerRight}</div>
      <div class="chart-area">${chartArea}</div>
      ${importArea}
    </div>`;
  }).join('');
  const eml = document.getElementById('em-line');
  if (eml) eml.onchange = e => { document.getElementById('em-sub').style.display = e.target.value === 'app' ? 'inline-block' : 'none'; };
}
document.getElementById('mod-list').addEventListener('click', async e => {
  const t = e.target;
  if (t.dataset.medit) { editModId = Number(t.dataset.medit); renderMods(); return; }
  if (t.dataset.mcancel) { editModId = null; renderMods(); return; }
  if (t.dataset.msave) {
    const m = myModules.find(x => x.id === Number(t.dataset.msave));
    if (m) {
      const name = document.getElementById('em-name').value.trim() || m.name;
      const source = document.getElementById('em-source').value.trim() || m.source;
      const line = document.getElementById('em-line').value;
      const sub = line === 'app' ? document.getElementById('em-sub').value : '';
      Object.assign(m, { name, source, line, sub });
      supabase.from('data_modules').update({ name, source, line, sub }).eq('id', m.id).then(({ error }) => {
        if (error) { toastError(error); loadModules().then(() => { renderMods(); }); }
      });
    }
    editModId = null;
    renderMods();
    return;
  }
  if (t.dataset.mdel) {
    const id = Number(t.dataset.mdel);
    allModules = allModules.filter(m => m.id !== id);
    myModules = allModules.filter(m => m.user_id === currentAccount.id);
    supabase.from('data_modules').delete().eq('id', id).then(({ error }) => {
      if (error) { toastError(error); loadModules().then(() => { renderMods(); }); }
    });
    renderMods();
    return;
  }
  if (t.dataset.mode) {
    const id = Number(t.dataset.mid);
    const m = allModules.find(x => x.id === id);
    if (m) {
      m.chart = t.dataset.mode === 'table' ? 'table' : (m.chart === 'table' ? 'line' : m.chart);
      supabase.from('data_modules').update({ chart: m.chart }).eq('id', id).then(({ error }) => {
        if (error) { toastError(error); loadModules().then(() => { renderMods(); }); }
      });
    }
    renderMods();
    return;
  }
  if (t.dataset.type) {
    const id = Number(t.dataset.mid);
    const m = allModules.find(x => x.id === id);
    if (m) {
      m.chart = t.dataset.type;
      supabase.from('data_modules').update({ chart: m.chart }).eq('id', id).then(({ error }) => {
        if (error) { toastError(error); loadModules().then(() => { renderMods(); }); }
      });
    }
    renderMods();
    return;
  }
  if (t.dataset.csv) {
    openCsvImport(Number(t.dataset.csv));
    return;
  }
  if (t.dataset.iadd) {
    const mid = Number(t.dataset.iadd);
    const card = t.closest('.mod-card');
    const d = card.querySelector(`[data-dimp="${mid}"]`).value.trim();
    if (!d) return;
    const entries = [];
    card.querySelectorAll(`[data-vimp="${mid}"]`).forEach(inp => {
      const raw = inp.value.trim();
      if (raw === '') return;
      const num = Number(raw);
      if (Number.isNaN(num)) { toast('请输入有效数值', true); return; }
      entries.push({ key: inp.dataset.vkey, value: num });
    });
    if (!entries.length) return;
    const m = myModules.find(x => x.id === mid);
    const md = moduleData(m);
    const series = md.series.length ? md.series : [{ key: 'value', label: '数值' }];
    entries.forEach(e => {
      if (!series.some(s => s.key === e.key)) series.push({ key: e.key, label: e.key });
    });
    const points = md.points.slice();
    let p = points.find(x => x.date === d);
    if (!p) { p = { date: d }; points.push(p); }
    entries.forEach(e => { p[e.key] = e.value; });
    points.sort((a, b) => a.date < b.date ? -1 : 1);
    const dataObj = { series, points };
    m.data = dataObj;
    supabase.from('data_modules').update({ data: dataObj }).eq('id', mid).then(({ error }) => {
      if (error) { toastError(error); loadModules().then(() => { renderMods(); }); }
    });
    renderMods();
  }
});
document.getElementById('mod-list').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.tableEdit) {
    const m = myModules.find(x => x.id === Number(t.dataset.tableEdit));
    if (m) enterTableEdit(m);
    return;
  }
  if (t.dataset.tableSave) { exitTableEdit(true); return; }
  if (t.dataset.tableCancel) { exitTableEdit(false); return; }
  if (t.dataset.delcol) { deleteTableSeries(t.dataset.delcol); return; }
  if (t.dataset.delrow) {
    if (tableDraft) tableDraft.points.splice(Number(t.dataset.delrow), 1);
    renderMods();
    return;
  }
  if (t.dataset.pagePrev) {
    const mid = Number(t.dataset.pagePrev);
    tablePage[mid] = Math.max(0, (tablePage[mid] || 0) - 1);
    renderMods();
    return;
  }
  if (t.dataset.pageNext) {
    const mid = Number(t.dataset.pageNext);
    tablePage[mid] = (tablePage[mid] || 0) + 1;
    renderMods();
    return;
  }
  if (t.dataset.rangeToggle) {
    const mid = Number(t.dataset.rangeToggle);
    rangeOpenModuleId = rangeOpenModuleId === mid ? null : mid;
    renderMods();
    return;
  }
  if (t.dataset.rangeShortcut) {
    applyShortcut(Number(t.dataset.rangeShortcut), Number(t.dataset.days));
    return;
  }
  if (t.dataset.scaleToggle) {
    const mid = Number(t.dataset.scaleToggle);
    scaleOpenModuleId = scaleOpenModuleId === mid ? null : mid;
    renderMods();
    return;
  }
});
document.getElementById('mod-list').addEventListener('input', e => {
  const t = e.target;
  if (t.classList.contains('th-input')) {
    const s = tableDraft && tableDraft.series.find(x => x.key === t.dataset.key);
    if (s) s.label = t.value;
  } else if (t.classList.contains('cell-date')) {
    const p = tableDraft && tableDraft.points[Number(t.dataset.row)];
    if (p) p.date = t.value;
  } else if (t.classList.contains('cell-val')) {
    const p = tableDraft && tableDraft.points[Number(t.dataset.row)];
    if (p) p[t.dataset.key] = t.value;
  }
});
document.getElementById('mod-list').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.filterFrom) {
    const mid = Number(t.dataset.filterFrom);
    moduleFilters[mid] = { from: t.value, to: (moduleFilters[mid] || {}).to || '' };
    renderMods();
  } else if (t.dataset.filterTo) {
    const mid = Number(t.dataset.filterTo);
    moduleFilters[mid] = { from: (moduleFilters[mid] || {}).from || '', to: t.value };
    renderMods();
  } else if (t.dataset.rangeFrom || t.dataset.rangeTo) {
    const mid = Number(t.dataset.rangeFrom || t.dataset.rangeTo);
    const pop = document.querySelector(`[data-range-pop="${mid}"]`);
    if (pop) {
      moduleFilters[mid] = {
        from: pop.querySelector('[data-range-from]').value,
        to: pop.querySelector('[data-range-to]').value
      };
      renderMods();
    }
  } else if (t.dataset.trend !== undefined) {
    setChartPref(Number(t.dataset.trend), 'trend', t.checked);
    renderMods();
  } else if (t.dataset.labels !== undefined) {
    setChartPref(Number(t.dataset.labels), 'labels', t.checked);
    renderMods();
  } else if (t.dataset.scaleMin !== undefined) {
    setChartPref(Number(t.dataset.scaleMin), 'min', t.value);
    renderMods();
  } else if (t.dataset.scaleMax !== undefined) {
    setChartPref(Number(t.dataset.scaleMax), 'max', t.value);
    renderMods();
  } else if (t.dataset.scaleStep !== undefined) {
    setChartPref(Number(t.dataset.scaleStep), 'step', t.value);
    renderMods();
  }
});

/* ---------- CSV 导入 ---------- */
function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(x => x !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function setCsvMsg(text, cls) {
  const el = document.getElementById('csv-msg');
  el.textContent = text;
  el.className = 'modal-msg' + (cls ? ' ' + cls : '');
}
function openCsvImport(moduleId) {
  csvModuleId = moduleId;
  csvColumns = [];
  csvRows = [];
  csvDateIdx = 0;
  csvSelected = {};
  csvTargets = {};
  document.getElementById('csv-file').value = '';
  document.getElementById('csv-step1').style.display = 'block';
  document.getElementById('csv-preview').style.display = 'none';
  setCsvMsg('', '');
  openModal('csv-modal');
}
function toDateValue(v) {
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function renderCsvPreview() {
  csvDateIdx = 0;
  csvSelected = { 0: true };
  csvTargets = {};
  csvColumns.forEach((c, i) => { if (i !== 0) csvSelected[i] = false; });
  const table = document.getElementById('csv-preview-table');
  const head = `<tr>${csvColumns.map((c, i) => {
    if (i === 0) return `<th><input type="checkbox" checked disabled title="日期列">${escapeHtml(c || '日期')}</th>`;
    return `<th><input type="checkbox" data-csvcol="${i}" ${csvSelected[i] ? 'checked' : ''}>${escapeHtml(c || `第${i + 1}列`)}</th>`;
  }).join('')}</tr>`;
  const body = csvRows.slice(0, 8).map(r => `<tr>${csvColumns.map((_, i) => `<td>${escapeHtml(r[i] != null ? r[i] : '')}</td>`).join('')}</tr>`).join('');
  table.innerHTML = head + body;
  table.querySelectorAll('[data-csvcol]').forEach(cb => cb.onchange = () => {
    csvSelected[Number(cb.dataset.csvcol)] = cb.checked;
    renderCsvMappingList();
  });
  renderCsvMappingList();
  setCsvMsg('', '');
}
function renderCsvMappingList() {
  const box = document.getElementById('csv-mapping-list');
  const m = myModules.find(x => x.id === csvModuleId);
  const existing = m ? moduleData(m).series : [];
  const selected = Object.entries(csvSelected).filter(([i, checked]) => Number(i) !== 0 && checked).map(([i]) => Number(i));
  if (!selected.length) { box.innerHTML = ''; return; }
  box.innerHTML = selected.map(i => {
    const header = csvColumns[i] || `第${i + 1}列`;
    const match = existing.find(s => s.label === header);
    const target = csvTargets[i] || (match ? match.key : 'new');
    csvTargets[i] = target;
    const options = existing.map(s => `<option value="${s.key}" ${s.key === target ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('') +
      `<option value="new" ${target === 'new' ? 'selected' : ''}>新建列（${escapeHtml(header)}）</option>`;
    return `<div class="csv-map-item"><span>${escapeHtml(header)}</span><select data-csvtarget="${i}">${options}</select></div>`;
  }).join('');
  box.querySelectorAll('[data-csvtarget]').forEach(sel => sel.onchange = () => { csvTargets[Number(sel.dataset.csvtarget)] = sel.value; });
}
document.getElementById('csv-file').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  const reader = new FileReader();
  reader.onload = () => {
    let rows;
    try {
      if (name.endsWith('.csv')) {
        rows = parseCSV(reader.result);
      } else {
        const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      }
    } catch (err) {
      setCsvMsg('文件解析失败：' + (err.message || '未知错误'), 'err');
      return;
    }
    if (!rows || !rows.length) { setCsvMsg('文件内容为空', 'err'); return; }
    csvColumns = rows[0].map(c => String(c == null ? '' : c).trim());
    csvRows = rows.slice(1).filter(r => r.some(c => String(c == null ? '' : c).trim() !== ''));
    if (!csvColumns.length) { setCsvMsg('没有识别到表头', 'err'); return; }
    const firstCol = csvRows.map(r => String(r[0] == null ? '' : r[0]).trim()).filter(Boolean);
    if (!firstCol.length || firstCol.some(v => !toDateValue(v))) { setCsvMsg('第一列不是日期，无法导入', 'err'); return; }
    document.getElementById('csv-step1').style.display = 'none';
    document.getElementById('csv-preview').style.display = 'block';
    renderCsvPreview();
  };
  if (name.endsWith('.csv')) reader.readAsText(file, 'utf-8');
  else reader.readAsArrayBuffer(file);
});
document.getElementById('csv-cancel').onclick = () => closeModal('csv-modal');
document.getElementById('csv-confirm').onclick = async () => {
  const m = myModules.find(x => x.id === csvModuleId);
  if (!m) return;
  const sel = Object.entries(csvSelected).filter(([i, checked]) => Number(i) !== 0 && checked).map(([i]) => Number(i));
  if (!sel.length) { setCsvMsg('请选择至少一列要导入的数据', 'err'); return; }
  const md = moduleData(m);
  const seriesMap = new Map(md.series.map(s => [s.key, s]));
  const columnKey = {};
  sel.forEach(i => {
    const header = (csvColumns[i] || `第${i + 1}列`).trim();
    const target = csvTargets[i];
    let key, label;
    if (target && target !== 'new' && seriesMap.has(target)) {
      key = target;
      label = seriesMap.get(target).label;
    } else {
      key = 's' + i;
      label = header;
    }
    columnKey[i] = key;
    seriesMap.set(key, { key, label });
  });
  const mergedSeries = [...seriesMap.values()];
  const points = md.points.slice();
  for (const r of csvRows) {
    const d = toDateValue(r[0]);
    if (!d) continue;
    let p = points.find(x => x.date === d);
    if (!p) { p = { date: d }; points.push(p); }
    sel.forEach(i => {
      const raw = String(r[i] == null ? '' : r[i]).trim();
      if (raw === '') return;
      const num = Number(raw);
      if (!Number.isNaN(num)) p[columnKey[i]] = num;
    });
  }
  points.sort((a, b) => a.date < b.date ? -1 : 1);
  const dataObj = { series: mergedSeries, points };
  m.data = dataObj;
  renderMods();
  const { error } = await supabase.from('data_modules').update({ data: dataObj }).eq('id', m.id);
  if (error) { setCsvMsg(friendlyText(error), 'err'); return; }
  setCsvMsg('导入完成', 'ok');
  await loadModules();
  renderMods();
  setTimeout(() => closeModal('csv-modal'), 600);
};

/* ---------- 数据模块多序列 ---------- */
function moduleData(m) {
  const d = m && m.data;
  if (Array.isArray(d)) {
    return { series: [{ key: 'value', label: '数值' }], points: d.map(x => ({ date: x.date, value: x.value })) };
  }
  if (d && Array.isArray(d.points)) {
    return { series: d.series || [], points: d.points };
  }
  return { series: [], points: [] };
}
function moduleSeries(m) {
  const s = moduleData(m).series;
  return s.length ? s : [{ key: 'value', label: '数值' }];
}
function filterPoints(points, filter) {
  if (!filter || (!filter.from && !filter.to)) return points;
  return points.filter(p => {
    if (filter.from && p.date < filter.from) return false;
    if (filter.to && p.date > filter.to) return false;
    return true;
  });
}
function seriesColor(i) {
  return LINK_PALETTE[i % LINK_PALETTE.length];
}
function chartPref(mid) {
  return chartPrefs[mid] || {};
}
function setChartPref(mid, key, val) {
  chartPrefs[mid] = { ...chartPrefs[mid], [key]: val };
  localStorage.setItem('teamhub_chart_prefs', JSON.stringify(chartPrefs));
}
function fmtNum(v) {
  const n = Number(v);
  if (Number.isInteger(n)) return n.toLocaleString();
  return String(Math.round(n * 100) / 100);
}
function niceTicks(max) {
  if (!(max > 0)) max = 1;
  const rawStep = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const ticks = [];
  for (let v = 0; v < max + step; v += step) ticks.push(v);
  return ticks;
}
function niceStep(range, target) {
  const raw = range / (target || 4);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm < 1.5) return 1 * mag;
  if (norm < 3) return 2 * mag;
  if (norm < 7) return 5 * mag;
  return 10 * mag;
}
function resolveScale(series, points, pref) {
  const vals = series.flatMap(s => points.map(p => Number(p[s.key]))).filter(v => !Number.isNaN(v));
  if (!vals.length) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const cMin = pref.min != null && pref.min !== '' ? Number(pref.min) : null;
  const cMax = pref.max != null && pref.max !== '' ? Number(pref.max) : null;
  const cStep = pref.step != null && pref.step !== '' ? Number(pref.step) : null;
  if (cMin != null && !Number.isNaN(cMin)) min = cMin;
  if (cMax != null && !Number.isNaN(cMax)) max = cMax;
  if (cMin == null) min = min - (max - min) * 0.1;
  if (cMax == null) max = max + (max - min) * 0.1;
  if (min > max) { const t = min; min = max; max = t; }
  const step = cStep != null && cStep > 0 ? cStep : niceStep(max - min, 4);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
  return { min, max, step, ticks };
}
function rangeLabel(filter) {
  if (filter && filter.from && filter.to) return `${filter.from} 至 ${filter.to}`;
  if (filter && filter.from) return `${filter.from} 起`;
  if (filter && filter.to) return `至 ${filter.to}`;
  return '全部日期';
}
function applyShortcut(mid, days) {
  if (!days) {
    moduleFilters[mid] = { from: '', to: '' };
  } else {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    moduleFilters[mid] = {
      from: toISO(start.getFullYear(), start.getMonth(), start.getDate()),
      to: toISO(end.getFullYear(), end.getMonth(), end.getDate())
    };
  }
  rangeOpenModuleId = null;
  renderMods();
}

/* ---------- 图表 ---------- */
function chartLegend(series, opts) {
  if (!series.length && !(opts && opts.trend)) return '';
  const items = series.map((s, i) => `<span class="legend-item"><i style="background:${seriesColor(i)}"></i>${escapeHtml(s.label)}</span>`).join('');
  const trend = (opts && opts.trend) ? series.map(s => `<span class="legend-item trend"><i></i>${escapeHtml(s.label)}趋势线</span>`).join('') : '';
  return `<div class="chart-legend">${items}${trend}</div>`;
}
function chartAxisX(points, w, h, padL, padR, padB) {
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const x = i => padL + i * (w - padL - padR) / Math.max(1, points.length - 1);
  return points.map((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return '';
    return `<text x="${x(i)}" y="${h - 8}" font-size="9" fill="#86868b" text-anchor="middle">${shortDate(p.date)}</text>`;
  }).join('');
}
function chartGrid(ticks, scale, w, h, padL, padR, padT, padB) {
  const y = v => padT + (1 - (v - scale.min) / Math.max(1e-9, scale.max - scale.min)) * (h - padT - padB);
  return ticks.map(t => {
    const gy = y(t);
    return `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="rgba(0,0,0,0.07)"/><text x="${padL - 6}" y="${gy + 3}" font-size="9" fill="#86868b" text-anchor="end">${fmtNum(t)}</text>`;
  }).join('');
}
function chartTrend(series, points, x, y) {
  return series.map((s, si) => {
    const vals = points.map(p => Number(p[s.key]));
    const n = vals.length;
    if (n < 2) return '';
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    vals.forEach((v, i) => { if (Number.isNaN(v)) return; sx += i; sy += v; sxx += i * i; sxy += i * v; });
    const den = n * sxx - sx * sx;
    if (!den) return '';
    const slope = (n * sxy - sx * sy) / den;
    const inter = (sy - slope * sx) / n;
    return `<line x1="${x(0)}" y1="${y(inter)}" x2="${x(n - 1)}" y2="${y(inter + slope * (n - 1))}" stroke="${seriesColor(si)}" stroke-width="1.5" stroke-dasharray="4 3" opacity=".65"/>`;
  }).join('');
}
function chartLine(points, series, opts) {
  if (!points || points.length < 2) return '<div class="empty">数据不足</div>';
  opts = opts || {};
  const w = 360, h = 220, padL = 46, padR = 12, padT = 12, padB = 30;
  const values = series.flatMap(s => points.map(p => Number(p[s.key]))).filter(v => !Number.isNaN(v));
  if (!values.length) return '<div class="empty">无数据</div>';
  const scale = resolveScale(series, points, opts);
  const x = i => padL + i * (w - padL - padR) / (points.length - 1);
  const y = v => padT + (1 - (v - scale.min) / Math.max(1e-9, scale.max - scale.min)) * (h - padT - padB);
  const grid = chartGrid(scale.ticks, scale, w, h, padL, padR, padT, padB);
  const polylines = series.map((s, si) => {
    const pts = [];
    for (let i = 0; i < points.length; i++) {
      const v = points[i][s.key];
      if (v == null || Number.isNaN(Number(v))) continue;
      pts.push(`${x(i)},${y(Number(v))}`);
    }
    if (pts.length < 2) return '';
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${seriesColor(si)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  const dots = series.flatMap((s, si) => points.map((p, i) => {
    const v = p[s.key];
    if (v == null || Number.isNaN(Number(v))) return '';
    return `<circle cx="${x(i)}" cy="${y(Number(v))}" r="2" fill="${seriesColor(si)}"/>`;
  }).join('')).join('');
  const trend = opts.trend ? chartTrend(series, points, x, y) : '';
  const labels = opts.labels ? points.map((p, i) => series.map((s, si) => {
    const v = p[s.key];
    if (v == null || Number.isNaN(Number(v))) return '';
    return `<text x="${x(i)}" y="${y(Number(v)) - 5}" font-size="8" fill="${seriesColor(si)}" text-anchor="middle">${fmtNum(v)}</text>`;
  }).join('')).join('') : '';
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:220px;display:block;">${grid}${polylines}${dots}${trend}${labels}${chartAxisX(points, w, h, padL, padR, padB)}</svg>${chartLegend(series, opts)}`;
}
function chartBar(points, series, opts) {
  if (!points || !points.length) return '<div class="empty">无数据</div>';
  opts = opts || {};
  const w = 360, h = 220, padL = 46, padR = 12, padT = 12, padB = 30;
  const scale = resolveScale(series, points, opts);
  const y = v => padT + (1 - (v - scale.min) / Math.max(1e-9, scale.max - scale.min)) * (h - padT - padB);
  const grid = chartGrid(scale.ticks, scale, w, h, padL, padR, padT, padB);
  const groupW = (w - padL - padR) / points.length;
  const barGap = 4;
  const barW = Math.max(1, (groupW - barGap * (series.length + 1)) / Math.max(1, series.length) * 0.68);
  const bars = points.map((p, pi) => {
    const gx = padL + pi * groupW;
    return series.map((s, si) => {
      const val = Number(p[s.key]) || 0;
      const bx = gx + barGap + si * (barW + barGap);
      const by = y(val);
      const bh = y(scale.min) - by;
      return `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${seriesColor(si)}" rx="1"/>`;
    }).join('');
  }).join('');
  const labels = opts.labels ? points.map((p, pi) => {
    const gx = padL + pi * groupW;
    return series.map((s, si) => {
      const val = Number(p[s.key]) || 0;
      const bx = gx + barGap + si * (barW + barGap);
      return `<text x="${bx + barW / 2}" y="${y(val) - 4}" font-size="8" fill="${seriesColor(si)}" text-anchor="middle">${fmtNum(val)}</text>`;
    }).join('');
  }).join('') : '';
  const trend = opts.trend ? chartTrend(series, points, (i) => padL + i * groupW + groupW / 2, y) : '';
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:220px;display:block;">${grid}${bars}${labels}${trend}${chartAxisX(points, w, h, padL, padR, padB)}</svg>${chartLegend(series, opts)}`;
}
function chartTable(points, series) {
  if (!points || !points.length) return '<div class="empty">无数据</div>';
  const head = `<tr><th>日期</th>${series.map(s => `<th>${escapeHtml(s.label)}</th>`).join('')}</tr>`;
  const body = points.map(p => `<tr><td>${shortDate(p.date)}</td>${series.map(s => `<td>${p[s.key] != null ? p[s.key] : ''}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table class="data-table">${head}${body}</table></div>`;
}
function renderReadonlyTable(m) {
  const { series, points } = moduleData(m);
  const sorted = [...points].sort((a, b) => a.date < b.date ? -1 : 1);
  if (!sorted.length) return '<div class="empty">无数据</div>';
  const info = pageInfo(m, sorted.length);
  const slice = sorted.slice(info.start, info.end);
  const head = `<tr><th>日期</th>${series.map(s => `<th>${escapeHtml(s.label)}</th>`).join('')}</tr>`;
  const body = slice.map(p => `<tr><td>${shortDate(p.date)}</td>${series.map(s => `<td>${p[s.key] != null ? p[s.key] : ''}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table class="data-table mod-data-table">${head}${body}</table></div>${renderPagination(m, info)}`;
}
function enterTableEdit(m) {
  editingTableModuleId = m.id;
  const md = moduleData(m);
  tableDraft = {
    series: md.series.map(s => ({ ...s })),
    points: md.points.map(p => ({ ...p })).sort((a, b) => a.date < b.date ? -1 : 1)
  };
  renderMods();
}
function renderTableEdit(m) {
  const d = tableDraft || { series: [], points: [] };
  const info = pageInfo(m, d.points.length);
  const slice = d.points.slice(info.start, info.end);
  const head = `<tr><th>日期</th>${d.series.map(s => `<th><div class="th-edit"><input class="th-input" data-key="${s.key}" value="${escapeHtml(s.label)}"><button class="del-col" data-delcol="${s.key}">×</button></div></th>`).join('')}</tr>`;
  const body = slice.map((p, ri) => {
    const realRow = info.start + ri;
    return `<tr><td><input class="cell-date" data-row="${realRow}" value="${escapeHtml(p.date)}"></td>${d.series.map(s => `<td><input class="cell-val" data-row="${realRow}" data-key="${s.key}" value="${escapeHtml(p[s.key] != null ? p[s.key] : '')}"></td>`).join('')}<td><button class="del-row" data-delrow="${realRow}">×</button></td></tr>`;
  }).join('');
  return `<div class="table-scroll"><table class="data-table mod-data-table table-edit">${head}${body}</table></div>${renderPagination(m, info)}`;
}
function pageInfo(m, total) {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  let page = tablePage[m.id] || 0;
  if (page >= pageCount) page = pageCount - 1;
  tablePage[m.id] = page;
  return { page, pageSize, pageCount, start: page * pageSize, end: Math.min(total, page * pageSize + pageSize) };
}
function renderPagination(m, info) {
  if (info.pageCount <= 1) return '';
  return `<div class="pagination"><button data-page-prev="${m.id}" ${info.page === 0 ? 'disabled' : ''}>‹</button><span>第 ${info.page + 1} / ${info.pageCount} 页</span><button data-page-next="${m.id}" ${info.page >= info.pageCount - 1 ? 'disabled' : ''}>›</button></div>`;
}
function exitTableEdit(save) {
  if (save && tableDraft && editingTableModuleId != null) {
    const m = myModules.find(x => x.id === editingTableModuleId);
    if (m) {
      const keys = tableDraft.series.map(s => s.key);
      const points = [];
      for (const p of tableDraft.points) {
        const date = toDateValue(p.date);
        if (!date) continue;
        const np = { date };
        keys.forEach(k => {
          const v = p[k];
          if (v === '' || v == null) return;
          const num = Number(v);
          np[k] = Number.isNaN(num) ? v : num;
        });
        points.push(np);
      }
      points.sort((a, b) => a.date < b.date ? -1 : 1);
      const dataObj = { series: tableDraft.series.filter(s => s.label.trim()), points };
      m.data = dataObj;
      supabase.from('data_modules').update({ data: dataObj }).eq('id', m.id).then(({ error }) => {
        if (error) { toastError(error); loadModules().then(() => { renderMods(); }); }
      });
      loadModules().then(() => { renderMods(); });
    }
  }
  editingTableModuleId = null;
  tableDraft = null;
  renderMods();
}
function deleteTableSeries(key) {
  if (!tableDraft) return;
  tableDraft.series = tableDraft.series.filter(s => s.key !== key);
  tableDraft.points.forEach(p => { delete p[key]; });
  renderMods();
}
function renderChart(mod, overrideFilter) {
  const { series, points } = moduleData(mod);
  const filtered = filterPoints(points, overrideFilter || moduleFilters[mod.id]);
  const sorted = [...filtered].sort((a, b) => a.date < b.date ? -1 : 1);
  const pref = chartPref(mod.id);
  if (mod.chart === 'line') return chartLine(sorted, series, pref);
  if (mod.chart === 'bar') return chartBar(sorted, series, pref);
  return chartTable(sorted, series);
}
/* ---------- Tab 切换 ---------- */
function goTab(t) {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === t));
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => goTab(t.dataset.tab));

document.addEventListener('click', e => {
  if (!e.target.closest('.range-filter') && rangeOpenModuleId != null) {
    rangeOpenModuleId = null;
    renderMods();
  }
  if (!e.target.closest('.scale-filter') && scaleOpenModuleId != null) {
    scaleOpenModuleId = null;
    renderMods();
  }
});

/* ---------- 启动 ---------- */
(async function boot() {
  sessionToken = localStorage.getItem('teamhub_token') || null;
  let savedAccount = null;
  try { savedAccount = JSON.parse(localStorage.getItem('teamhub_account')); } catch (e) {}
  if (sessionToken) {
    currentAccount = savedAccount || { name: '加载中', color: '#0071e3', is_admin: false };
    renderAppShell();
    if (loadSnapshot()) renderAll();
    const { data, error } = await supabase.rpc('get_session', { p_token: sessionToken });
    if (!error && data && data.account) {
      currentAccount = data.account;
      localStorage.setItem('teamhub_account', JSON.stringify(data.account));
      renderHeader();
      await loadAppData();
      return;
    }
    sessionToken = null;
    currentAccount = null;
    localStorage.removeItem('teamhub_token');
    localStorage.removeItem('teamhub_account');
  }
  showLogin();
})();
})();
