const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const CAT = { General:'Umum', Work:'Pekerjaan', Personal:'Pribadi', Ideas:'Ide' };
const PAL = ['#FFC8DD','#FFE3A3','#C6EBD0','#D9CCFF','#BFE3FF'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate = s => { const [y,m,d] = s.split('-'); return `${+d} ${MONTHS[m-1]} ${y}`; };
const isoLocal = d => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Bersihkan HTML (aman dari script/atribut berbahaya, terutama untuk file impor)
function clean(html) {
  const d = new DOMParser().parseFromString(html || '', 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,img,svg').forEach(e => e.remove());
  d.body.querySelectorAll('*').forEach(e => [...e.attributes].forEach(a => e.removeAttribute(a.name)));
  return d.body.innerHTML;
}

function norm(n, i = 0) {
  const t = new Date(n.date);
  return {
    id: n.id || Date.now() + i,
    title: n.title || '',
    content: clean(n.content),
    category: CAT[n.category] ? n.category : 'General',
    color: PAL.includes(n.color) ? n.color : PAL[0],
    date: /^\d{4}-\d\d-\d\d$/.test(n.date) ? n.date : ymd(isNaN(t) ? new Date() : t),
    alarm: n.alarm || '',
    alarmDone: !!n.alarmDone,
    pinned: !!n.pinned,
    archived: !!n.archived
  };
}

let notes = [];
try { notes = JSON.parse(localStorage.getItem('kucatat-notes') || localStorage.getItem('notes') || '[]').map(norm); } catch { notes = []; }
let editId = null, color = PAL[0], view = 'notes', cal = new Date(), selDay = ymd(new Date());
const save = () => localStorage.setItem('kucatat-notes', JSON.stringify(notes));
const editor = $('#note-content');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Render ---------- */
const cardHTML = n => `
<article class="note-card ${n.pinned ? 'pinned' : ''}" draggable="true" data-id="${n.id}" style="--c:${n.color}">
  <div class="tape"></div>
  <div class="nh"><h3>${esc(n.title) || 'Tanpa judul'}</h3>
    <div class="acts">
      <button data-act="pin" title="Sematkan" class="${n.pinned ? 'on' : ''}"><i class="uil uil-star"></i></button>
      <button data-act="edit" title="Ubah"><i class="uil uil-edit"></i></button>
      <button data-act="arc" title="${n.archived ? 'Pulihkan' : 'Arsipkan'}"><i class="uil uil-archive"></i></button>
      <button data-act="del" title="Hapus"><i class="uil uil-trash-alt"></i></button>
    </div></div>
  <div class="meta"><span class="chip">${CAT[n.category]}</span><span class="chip">📅 ${fmtDate(n.date)}</span>
    ${n.alarm ? `<span class="chip alarm">⏰ ${n.alarm.split('T')[1]}${n.alarmDone ? ' ✓' : ''}</span>` : ''}</div>
  <div class="nb">${n.content || '<p><em>Catatan kosong</em></p>'}</div>
  <button class="more" data-act="view">Baca selengkapnya 🐾</button>
</article>`;

function visible() {
  const q = $('#search').value.trim().toLowerCase(), f = $('#filter').value;
  return notes.filter(n => {
    if (f === 'Archived' ? !n.archived : n.archived) return false;
    if (f !== 'All' && f !== 'Archived' && n.category !== f) return false;
    if (!q) return true;
    const tmp = document.createElement('div'); tmp.innerHTML = n.content;
    return (n.title + ' ' + tmp.textContent).toLowerCase().includes(q);
  }).sort((a, b) => b.pinned - a.pinned);
}

function renderNotes() {
  const list = visible(), f = $('#filter').value;
  $('#grid').innerHTML = (f === 'Archived' ? '' : '<button class="add-card" id="add-card"><span>＋</span>Tambah catatan baru</button>')
    + (list.length ? list.map(cardHTML).join('') : `<div class="empty">${f === 'Archived' ? 'Arsip masih kosong 📦' : 'Belum ada catatan. Yuk, tulis yang pertama! 🐱'}</div>`);
}

function renderCal() {
  const y = cal.getFullYear(), m = cal.getMonth(), today = ymd(new Date());
  $('#cal-title').textContent = `${MONTHS[m]} ${y}`;
  let h = DAYS.map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) h += '<div></div>';
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
    const s = `${y}-${pad(m+1)}-${pad(d)}`, ns = notes.filter(n => n.date === s && !n.archived);
    h += `<button class="day ${s === today ? 'today' : ''} ${s === selDay ? 'sel' : ''}" data-day="${s}">${d}<span class="dots">${ns.slice(0,3).map(n => `<i style="background:${n.color}"></i>`).join('')}${ns.some(n => n.alarm) ? '⏰' : ''}</span></button>`;
  }
  $('#cal-grid').innerHTML = h;
  $('#day-title').textContent = `Catatan · ${fmtDate(selDay)}`;
  const list = notes.filter(n => n.date === selDay && !n.archived);
  $('#day-list').innerHTML = list.length ? list.map(cardHTML).join('') : '<div class="empty">Tidak ada catatan di tanggal ini 🌸</div>';
}

const render = () => view === 'notes' ? renderNotes() : renderCal();

/* ---------- Form ---------- */
function buildColors() {
  $('#colors').innerHTML = PAL.map(c => `<button type="button" class="dot" data-color="${c}" style="background:${c}" aria-label="Warna ${c}"></button>`).join('');
}
function setColor(c) { color = c; $$('.dot').forEach(d => d.classList.toggle('sel', d.dataset.color === c)); }

function openForm(note, date) {
  editId = note ? note.id : null;
  $('#popup-title').textContent = note ? '✏️ Ubah catatan' : '✨ Catatan baru';
  $('#note-title').value = note ? note.title : '';
  $('#category').value = note ? note.category : 'General';
  $('#note-date').value = note ? note.date : (date || ymd(new Date()));
  editor.innerHTML = note ? note.content : '';
  const has = !!(note && note.alarm);
  $('#alarm-on').checked = has;
  $('#alarm-time').disabled = !has;
  $('#alarm-time').value = has ? note.alarm.split('T')[1] : '';
  setColor(note ? note.color : PAL[0]);
  $('#popup').classList.add('active');
  $('#note-title').focus();
}
const closeAll = () => $$('.overlay').forEach(o => o !== $('#alarm-modal') && o.classList.remove('active'));

function saveNote(e) {
  e.preventDefault();
  const title = $('#note-title').value.trim();
  if (!title && !editor.textContent.trim()) return toast('Isi judul atau catatan dulu ya 🐾');
  let alarm = '';
  if ($('#alarm-on').checked) {
    const t = $('#alarm-time').value;
    if (!t) return toast('Pilih jam alarmnya dulu ⏰');
    alarm = `${$('#note-date').value}T${t}`;
    if (new Date(alarm) <= new Date()) return toast('Waktu alarm sudah lewat, pilih yang akan datang ⏰');
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }
  const data = { title, content: clean(editor.innerHTML), category: $('#category').value, color, date: $('#note-date').value, alarm, alarmDone: false };
  if (editId) Object.assign(notes.find(n => n.id === editId), data);
  else notes.unshift({ id: Date.now(), pinned: false, archived: false, ...data });
  save(); closeAll(); selDay = data.date; render();
  toast(alarm ? 'Tersimpan, alarm aktif ⏰' : 'Catatan tersimpan 💖');
}

/* ---------- Aksi kartu ---------- */
function openDetail(n) {
  $('#detail-box').style.background = `color-mix(in srgb, ${n.color} 55%, var(--surface))`;
  $('#detail-box').innerHTML = `<div class="m-head"><h2>${esc(n.title) || 'Tanpa judul'}</h2><button class="x" data-close>✕</button></div>
  <div class="meta"><span class="chip">${CAT[n.category]}</span><span class="chip">📅 ${fmtDate(n.date)}</span>${n.alarm ? `<span class="chip alarm">⏰ ${n.alarm.split('T')[1]}</span>` : ''}</div>
  <div class="d-body">${n.content || '<em>Catatan kosong</em>'}</div>`;
  $('#detail').classList.add('active');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) {
    const n = notes.find(x => x.id == b.closest('.note-card').dataset.id);
    const a = b.dataset.act;
    if (a === 'view') return openDetail(n);
    if (a === 'edit') return openForm(n);
    if (a === 'pin') n.pinned = !n.pinned;
    if (a === 'arc') { n.archived = !n.archived; toast(n.archived ? 'Dipindah ke arsip 📦' : 'Dipulihkan ✨'); }
    if (a === 'del') { if (!confirm('Hapus catatan ini?')) return; notes = notes.filter(x => x !== n); toast('Catatan dihapus 🗑️'); }
    save(); return render();
  }
  if (e.target.closest('#add-card,#fab')) return openForm();
  if (e.target.closest('[data-close]') || e.target.classList.contains('overlay') && e.target.id !== 'alarm-modal') return closeAll();
  const day = e.target.closest('[data-day]');
  if (day) { selDay = day.dataset.day; return renderCal(); }
  const dot = e.target.closest('.dot'); if (dot) return setColor(dot.dataset.color);
  const cmd = e.target.closest('[data-cmd]');
  if (cmd) { document.execCommand(cmd.dataset.cmd); return editor.focus(); }
  if (!e.target.closest('.menu-wrap')) $('#menu').classList.remove('open');
});

/* ---------- Drag & drop ---------- */
let dragId = null;
document.addEventListener('dragstart', e => { const c = e.target.closest?.('.note-card'); if (c) { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { const c = e.target.closest?.('.note-card'); if (c && dragId) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', e => {
  const c = e.target.closest?.('.note-card'); if (!c || !dragId) return;
  e.preventDefault();
  const from = notes.findIndex(n => n.id == dragId), to = notes.findIndex(n => n.id == c.dataset.id);
  if (from > -1 && to > -1 && from !== to) { notes.splice(to, 0, notes.splice(from, 1)[0]); save(); }
});
document.addEventListener('dragend', () => { dragId = null; render(); });

/* ---------- Alarm ---------- */
let actx, beepTimer, queue = [], current = null;
document.addEventListener('click', () => { try { actx = actx || new AudioContext(); actx.resume(); } catch {} });
function beep() {
  try {
    actx = actx || new AudioContext();
    [880, 1175, 880].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * .25;
      o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
      o.start(t); o.stop(t + .22);
    });
  } catch {}
}
function showAlarm(n) {
  current = n;
  $('#alarm-title').textContent = n.title || 'Tanpa judul';
  const tmp = document.createElement('div'); tmp.innerHTML = n.content;
  $('#alarm-body').textContent = tmp.textContent.slice(0, 140);
  $('#alarm-modal').classList.add('active');
  beep(); beepTimer = setInterval(beep, 1500);
  if ('Notification' in window && Notification.permission === 'granted') new Notification('⏰ kucatat: ' + (n.title || 'Pengingat'), { body: tmp.textContent.slice(0, 100) });
}
function endAlarm() { clearInterval(beepTimer); $('#alarm-modal').classList.remove('active'); current = null; }
function checkAlarms() {
  const now = new Date();
  notes.forEach(n => {
    if (n.alarm && !n.alarmDone && !n.archived && new Date(n.alarm) <= now) { n.alarmDone = true; queue.push(n); save(); render(); }
  });
  if (!current && queue.length) showAlarm(queue.shift());
}
$('#stop').onclick = endAlarm;
$('#snooze').onclick = () => {
  current.alarm = isoLocal(new Date(Date.now() + 5 * 60000)); current.alarmDone = false;
  current.date = current.alarm.split('T')[0]; save(); endAlarm(); render(); toast('Alarm ditunda 5 menit 😴');
};

/* ---------- Jam ---------- */
function tick() {
  const d = new Date();
  $('#clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('#today-label').textContent = `${['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()]}, ${fmtDate(ymd(d))}`;
  checkAlarms();
}

/* ---------- Event lain ---------- */
$('#form').addEventListener('submit', saveNote);
$('#alarm-on').onchange = e => { $('#alarm-time').disabled = !e.target.checked; if (e.target.checked && !$('#alarm-time').value) $('#alarm-time').focus(); };
$('#search').oninput = render;
$('#filter').onchange = () => { $('#arc-view').innerHTML = `<i class="uil uil-archive"></i> ${$('#filter').value === 'Archived' ? 'Lihat catatan' : 'Lihat arsip'}`; render(); };
$('#arc-view').onclick = () => { $('#filter').value = $('#filter').value === 'Archived' ? 'All' : 'Archived'; $('#filter').onchange(); $('#menu').classList.remove('open'); };
$('#menu-btn').onclick = () => $('#menu').classList.toggle('open');
$$('.tab').forEach(t => t.onclick = () => {
  view = t.dataset.view; $$('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('#view-notes').hidden = view !== 'notes'; $('#view-cal').hidden = view !== 'cal'; render();
});
$('#prev').onclick = () => { cal = new Date(cal.getFullYear(), cal.getMonth() - 1, 1); renderCal(); };
$('#next').onclick = () => { cal = new Date(cal.getFullYear(), cal.getMonth() + 1, 1); renderCal(); };
$('#goto-today').onclick = () => { cal = new Date(); selDay = ymd(cal); renderCal(); };
$('#add-day').onclick = () => openForm(null, selDay);

function setTheme(t) { document.body.className = t; $('#theme').textContent = t === 'dark' ? '☀️' : '🌙'; localStorage.setItem('kucatat-theme', t); }
$('#theme').onclick = () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark');

$('#export').onclick = () => {
  if (!notes.length) return toast('Belum ada catatan untuk diekspor');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' }));
  a.download = `kucatat-${ymd(new Date())}.json`; a.click(); URL.revokeObjectURL(a.href);
  $('#menu').classList.remove('open');
};
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const arr = JSON.parse(r.result);
      if (!Array.isArray(arr)) throw new Error('Format file tidak sesuai');
      if (confirm(`Impor ${arr.length} catatan? Catatan saat ini akan diganti.`)) { notes = arr.map(norm); save(); render(); toast('Impor berhasil 🎉'); }
    } catch (err) { toast('Gagal impor: ' + err.message); }
  };
  r.readAsText(f); e.target.value = ''; $('#menu').classList.remove('open');
};
$('#notif').onclick = () => {
  if (!('Notification' in window)) return toast('Browser tidak mendukung notifikasi');
  Notification.requestPermission().then(p => toast(p === 'granted' ? 'Notifikasi aktif 🔔' : 'Notifikasi tidak diizinkan'));
  $('#menu').classList.remove('open');
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAll();
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openForm(); }
});

/* ---------- Mulai ---------- */
buildColors();
setTheme(localStorage.getItem('kucatat-theme') || 'light');
save(); render(); tick(); setInterval(tick, 1000);
