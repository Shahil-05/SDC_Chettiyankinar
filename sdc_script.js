document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------- ROUTING ---------------- */
function goTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('nav.primary button').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  document.getElementById('primaryNav').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});
  if(page==='notices') renderNotices();
  if(page==='admin') refreshAdminIfLoggedIn();
}

/* ---------------- STORAGE HELPERS ---------------- */
async function getData(key, fallback){
  try{
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : fallback;
  }catch(e){ return fallback; }
}
async function setData(key, value){
  try{ await window.storage.set(key, JSON.stringify(value), true); }
  catch(e){ console.error('storage set failed', e); }
}

/* seed a first notice so the page never looks empty */
async function ensureSeed(){
  const notices = await getData('notices', null);
  if(notices === null){
    await setData('notices', [{
      id: 'n_seed',
      title: 'Admission open for the upcoming batch',
      category: 'Admission',
      body: 'SDC GVHSS Chettiyankinar is now accepting applications for Cloud Computing and Graphic Designing. Interested Plus One / Plus Two students can apply on the Admission page.',
      date: new Date().toISOString().slice(0,10),
      pinned: true
    }]); 
  }
  const settings = await getData('settings', null);
  if(settings === null){
    await setData('settings', { admissionOpen: true });
  }
}

/* ---------------- NOTICES PAGE ---------------- */
async function renderNotices(){
  const settings = await getData('settings', {admissionOpen:true});
  const bannerEl = document.getElementById('admissionBanner');
  bannerEl.innerHTML = settings.admissionOpen
    ? `<div class="admission-banner"><strong>Admission is currently open.</strong>&nbsp;Head to the Admission page to apply.</div>`
    : `<div class="admission-banner closed"><strong>Admission is currently closed.</strong>&nbsp;Check back here for the next opening.</div>`;

  const notices = await getData('notices', []);
  const sorted = [...notices].sort((a,b)=> (b.pinned - a.pinned) || (b.date.localeCompare(a.date)));
  const listEl = document.getElementById('noticesList');
  if(sorted.length===0){
    listEl.innerHTML = `<div class="empty-state">No notices yet. Check back soon.</div>`;
    return;
  }
  listEl.innerHTML = `<div class="card">` + sorted.map(n => `
    <div class="notice-item">
      <div class="notice-date">${n.date}</div>
      <div>
        <span class="tag tag-${n.category}">${n.category}</span>
        <h4>${escapeHtml(n.title)}</h4>
        <p class="body">${escapeHtml(n.body)}</p>
      </div>
      <div class="pin-flag">${n.pinned ? '📌 Pinned' : ''}</div>
    </div>
  `).join('') + `</div>`;
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* ---------------- ADMISSION FORM ---------------- */
document.getElementById('admissionForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const courseInput = document.querySelector('input[name="course"]:checked');
  const record = {
    id: 'a_' + Date.now(),
    name: document.getElementById('stuName').value.trim(),
    guardian: document.getElementById('stuGuardian').value.trim(),
    cls: document.getElementById('stuClass').value,
    phone: document.getElementById('stuPhone').value.trim(),
    email: document.getElementById('stuEmail').value.trim(),
    course: courseInput ? courseInput.value : '',
    note: document.getElementById('stuNote').value.trim(),
    status: 'Pending',
    date: new Date().toISOString().slice(0,10)
  };
  const list = await getData('admissions', []);
  list.push(record);
  await setData('admissions', list);

  document.getElementById('admissionFormArea').querySelector('.card').style.display = 'none';
  document.getElementById('admissionConfirm').innerHTML = `
    <div class="confirm-box">
      <strong>Application received.</strong>
      <p style="margin:8px 0 0 0;">Your reference ID is <span class="ref">${record.id}</span>. The coordinator will contact you at ${escapeHtml(record.phone)} about next steps.</p>
    </div>`;
});

/* ---------------- ADMIN AUTH ---------------- */
const ADMIN_CODE = 'sdc-admin-2026';
let adminSession = false;

function adminLogin(){
  const val = document.getElementById('adminPass').value;
  const msg = document.getElementById('adminLoginMsg');
  if(val === ADMIN_CODE){
    adminSession = true;
    document.getElementById('adminGateArea').style.display = 'none';
    document.getElementById('adminShellArea').style.display = 'block';
    loadAdminData();
  }else{
    msg.innerHTML = `<div class="msg-inline msg-err">Incorrect access code.</div>`;
  }
}
function adminLogout(){
  adminSession = false;
  document.getElementById('adminGateArea').style.display = 'block';
  document.getElementById('adminShellArea').style.display = 'none';
  document.getElementById('adminPass').value = '';
}
function refreshAdminIfLoggedIn(){
  if(adminSession) loadAdminData();
}
function adminPane(name){
  document.querySelectorAll('.admin-side button[data-pane]').forEach(b=>b.classList.toggle('active', b.dataset.pane===name));
  document.querySelectorAll('.admin-pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('pane-'+name).classList.add('active');
}

/* ---------------- ADMIN DATA ---------------- */
async function loadAdminData(){
  const notices = await getData('notices', []);
  const admissions = await getData('admissions', []);
  const settings = await getData('settings', {admissionOpen:true});

  document.getElementById('kpiNotices').textContent = notices.length;
  document.getElementById('kpiApplications').textContent = admissions.length;
  document.getElementById('kpiPending').textContent = admissions.filter(a=>a.status==='Pending').length;
  document.getElementById('admissionToggle').checked = !!settings.admissionOpen;

  document.getElementById('adminNoticeTable').innerHTML = notices.length ? notices.map(n => `
    <tr>
      <td class="mono">${n.date}</td>
      <td><span class="tag tag-${n.category}">${n.category}</span></td>
      <td>${escapeHtml(n.title)}</td>
      <td><button class="small-btn danger" onclick="deleteNotice('${n.id}')">Delete</button></td>
    </tr>`).join('') : `<tr><td colspan="4" style="color:var(--ink-soft);">No notices yet.</td></tr>`;

  document.getElementById('adminAdmTable').innerHTML = admissions.length ? admissions.map(a => `
    <tr>
      <td class="mono">${a.date}</td>
      <td>${escapeHtml(a.name)}<br><span style="color:var(--ink-soft); font-size:12px;">${escapeHtml(a.guardian)}</span></td>
      <td>${escapeHtml(a.cls)}</td>
      <td>${escapeHtml(a.course)}</td>
      <td class="mono">${escapeHtml(a.phone)}</td>
      <td>
        <select class="status-select" onchange="setAdmissionStatus('${a.id}', this.value)">
          ${['Pending','Approved','Rejected'].map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="small-btn danger" onclick="deleteAdmission('${a.id}')">Delete</button></td>
    </tr>`).join('') : `<tr><td colspan="7" style="color:var(--ink-soft);">No applications yet.</td></tr>`;
}

async function addNotice(){
  const title = document.getElementById('noticeTitle').value.trim();
  const body = document.getElementById('noticeBody').value.trim();
  const category = document.getElementById('noticeCategory').value;
  const msg = document.getElementById('noticeFormMsg');
  if(!title){
    msg.innerHTML = `<div class="msg-inline msg-err">Give the notice a title before posting.</div>`;
    return;
  }
  const notices = await getData('notices', []);
  notices.push({ id:'n_'+Date.now(), title, body, category, date:new Date().toISOString().slice(0,10), pinned:false });
  await setData('notices', notices);
  document.getElementById('noticeTitle').value = '';
  document.getElementById('noticeBody').value = '';
  msg.innerHTML = `<div class="msg-inline msg-ok">Notice posted.</div>`;
  loadAdminData();
}
async function deleteNotice(id){
  const notices = await getData('notices', []);
  await setData('notices', notices.filter(n=>n.id!==id));
  loadAdminData();
}
async function setAdmissionStatus(id, status){
  const admissions = await getData('admissions', []);
  const rec = admissions.find(a=>a.id===id);
  if(rec) rec.status = status;
  await setData('admissions', admissions);
  loadAdminData();
}
async function deleteAdmission(id){
  const admissions = await getData('admissions', []);
  await setData('admissions', admissions.filter(a=>a.id!==id));
  loadAdminData();
}
async function toggleAdmission(){
  const checked = document.getElementById('admissionToggle').checked;
  await setData('settings', { admissionOpen: checked });
}

/* ---------------- INIT ---------------- */
ensureSeed().then(renderNotices);