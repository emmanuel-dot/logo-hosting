/* ==============================================
   MEDIPOINT ULTRASOUND SYSTEM — app.js
   ============================================== */

const DB = {
  patients()  { return JSON.parse(localStorage.getItem('mp_pts')  || '[]'); },
  findings()  { return JSON.parse(localStorage.getItem('mp_fnd')  || '{}'); },
  savePts(d)  { localStorage.setItem('mp_pts',  JSON.stringify(d)); },
  saveFnd(d)  { localStorage.setItem('mp_fnd',  JSON.stringify(d)); },

  addPatient(pt) {
    const list = this.patients();
    pt.id = 'MP' + String(Date.now()).slice(-6);
    pt.createdAt = new Date().toISOString();
    list.unshift(pt);
    this.savePts(list);
    return pt;
  },

  setFindings(pid, data) {
    const all = this.findings();
    all[pid] = data;
    this.saveFnd(all);
  },

  getById(id) { return this.patients().find(p => p.id === id); },

  remove(id) {
    this.savePts(this.patients().filter(p => p.id !== id));
    const all = this.findings();
    delete all[id];
    this.saveFnd(all);
  }
};

const PAGE_TITLES = { dashboard:'Dashboard', register:'Register Patient', findings:'Findings Entry', reports:'Reports' };

function showPage(name) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item, .bnav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll(`[data-page="${name}"]`).forEach(el => el.classList.add('active'));
  document.getElementById('pageTitle').textContent = PAGE_TITLES[name];
  if (name === 'dashboard') renderDashboard();
  if (name === 'findings')  populateFindingsSel();
  if (name === 'reports')   renderReports();
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
}

function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function openModal(id)  { document.getElementById(id).classList.add('open');    document.getElementById(id).style.display='flex'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.getElementById(id).style.display='none'; }
function closePrintModal(e)  { if (e.target.id === 'printModal')  closeModal('printModal');  }
function closeDeleteModal(e) { if (e.target.id === 'deleteModal') closeModal('deleteModal'); }

function initDates() {
  const now = new Date();
  document.getElementById('currentDate').textContent =
    now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  const today = now.toISOString().slice(0, 10);
  document.getElementById('ptScanDate').value = today;
  document.getElementById('fReportDate').value = today;
}

function savePatient(e) {
  e.preventDefault();
  const pt = {
    name: v('ptName'), dob: v('ptDob'), age: v('ptAge'), sex: v('ptSex'),
    phone: v('ptPhone'), address: v('ptAddress'),
    refPhysician: v('ptRefPhysician'), refHospital: v('ptRefHospital'),
    scanType: v('ptScanType'), scanDate: v('ptScanDate'), clinical: v('ptClinical'), status: 'Pending'
  };
  const saved = DB.addPatient(pt);
  toast(`${saved.name} registered (${saved.id})`);
  document.getElementById('registerForm').reset();
  document.getElementById('ptScanDate').value = new Date().toISOString().slice(0, 10);
  showPage('findings');
  setTimeout(() => {
    populateFindingsSel();
    document.getElementById('findingsPatientSelect').value = saved.id;
    loadPatientForFindings();
  }, 80);
}

function renderDashboard() {
  const pts = DB.patients(), fnd = DB.findings();
  const today = new Date().toISOString().slice(0, 10);
  const complete = pts.filter(p => fnd[p.id]).length;
  document.getElementById('statTotal').textContent    = pts.length;
  document.getElementById('statComplete').textContent = complete;
  document.getElementById('statPending').textContent  = pts.length - complete;
  document.getElementById('statToday').textContent    = pts.filter(p => p.scanDate === today).length;
  const tbody = document.getElementById('dashboardTableBody');
  if (!pts.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No patients registered yet. Click <strong>New Patient</strong> to begin.</td></tr>`; return; }
  tbody.innerHTML = pts.slice(0, 15).map(p => rowHtml(p, fnd)).join('');
}

function renderReports(q = '') {
  let pts = DB.patients();
  const fnd = DB.findings();
  if (q) { const lq = q.toLowerCase(); pts = pts.filter(p => p.name.toLowerCase().includes(lq) || p.id.toLowerCase().includes(lq)); }
  const tbody = document.getElementById('reportsTableBody');
  if (!pts.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No records found.</td></tr>`; return; }
  tbody.innerHTML = pts.map(p => rowHtml(p, fnd)).join('');
}

function filterReports() { renderReports(document.getElementById('reportSearch').value.trim()); }

function rowHtml(p, fnd) {
  const done = !!fnd[p.id];
  return `<tr>
    <td><strong style="color:var(--primary)">${p.id}</strong></td>
    <td>${esc(p.name)}</td>
    <td>${p.age}y / ${p.sex}</td>
    <td>${fmtDate(p.scanDate)}</td>
    <td>${esc(p.scanType)}</td>
    <td><span class="badge ${done ? 'badge-complete' : 'badge-pending'}">${done ? 'Complete' : 'Pending'}</span></td>
    <td><div class="act-btns">
      <button class="btn btn-primary btn-sm" onclick="goToFindings('${p.id}')">${done ? 'Edit' : 'Add Findings'}</button>
      <button class="btn btn-ghost btn-sm" onclick="printReport('${p.id}')">Print</button>
      <button class="btn btn-danger btn-sm" onclick="askDelete('${p.id}')">Delete</button>
    </div></td>
  </tr>`;
}

function populateFindingsSel() {
  const sel = document.getElementById('findingsPatientSelect');
  const pts = DB.patients();
  sel.innerHTML = '<option value="">— Choose a registered patient —</option>' +
    pts.map(p => `<option value="${p.id}">${p.id} — ${esc(p.name)} (${p.scanType})</option>`).join('');
}

function goToFindings(pid) {
  showPage('findings');
  setTimeout(() => { populateFindingsSel(); document.getElementById('findingsPatientSelect').value = pid; loadPatientForFindings(); }, 80);
}

function loadPatientForFindings() {
  const pid  = document.getElementById('findingsPatientSelect').value;
  const strip = document.getElementById('findingsPatientInfo');
  const card  = document.getElementById('findingsCard');
  if (!pid) { strip.style.display = 'none'; card.style.display = 'none'; return; }
  const pt = DB.getById(pid);
  if (!pt) return;

  strip.style.display = 'flex';
  strip.innerHTML = [['Patient',pt.name],['ID',pt.id],['Age/Sex',`${pt.age}y / ${pt.sex}`],
    ['Scan Type',pt.scanType],['Date',fmtDate(pt.scanDate)],['Referring Dr',pt.refPhysician||'—']]
    .map(([k,v2]) => `<div class="pt-chip"><b>${k}:</b><span>${esc(v2)}</span></div>`).join('');

  document.getElementById('findingsScanBadge').textContent = pt.scanType;

  const st = (pt.scanType||'').toLowerCase();
  const isObs = st.includes('obstetric'), isThyroid = st.includes('thyroid'), isBreast = st.includes('breast');
  const isAbdom = !isThyroid && !isBreast;

  show('abdominalFindings', isAbdom);
  show('obstetricFindings', isObs);
  show('thyroidFindings',   isThyroid);
  show('breastFindings',    isBreast);
  show('uterusField',   isAbdom && pt.sex === 'Female');
  show('prostateField', isAbdom && pt.sex === 'Male');

  card.style.display = 'block';
  document.getElementById('findingsPid').value = pid;

  const existing = DB.findings()[pid];
  const FIELDS = ['fLiver','fGallbladder','fSpleen','fPancreas','fRightKidney','fLeftKidney',
    'fBladder','fUterus','fProstate','fAorta','fOther','fImpression','fRecommendation',
    'fRadiologist','fReportDate','fGA','fEDD','fPresentation','fFHR','fPlacenta','fAFI',
    'fBPD','fHC','fAC','fFL','fEFW','fFetuses','fAnatomy','fObsOther',
    'fThyroidR','fThyroidL','fThyroidIst','fThyroidLN','fBreastR','fBreastL','fBreastLN'];
  if (existing) {
    FIELDS.forEach(id => { const el = document.getElementById(id); if (el && existing[id] !== undefined) el.value = existing[id]; });
  } else {
    document.getElementById('findingsForm').reset();
    document.getElementById('findingsPid').value = pid;
    document.getElementById('fReportDate').value = new Date().toISOString().slice(0, 10);
  }
}

function saveFindings(e) {
  e.preventDefault();
  const pid = document.getElementById('findingsPid').value;
  const data = {};
  ['fLiver','fGallbladder','fSpleen','fPancreas','fRightKidney','fLeftKidney',
   'fBladder','fUterus','fProstate','fAorta','fOther','fImpression','fRecommendation',
   'fRadiologist','fReportDate','fGA','fEDD','fPresentation','fFHR','fPlacenta','fAFI',
   'fBPD','fHC','fAC','fFL','fEFW','fFetuses','fAnatomy','fObsOther',
   'fThyroidR','fThyroidL','fThyroidIst','fThyroidLN','fBreastR','fBreastL','fBreastLN'
  ].forEach(id => { const el = document.getElementById(id); if (el) data[id] = el.value; });
  DB.setFindings(pid, data);
  const pts = DB.patients(), idx = pts.findIndex(p => p.id === pid);
  if (idx > -1) { pts[idx].status = 'Complete'; DB.savePts(pts); }
  toast('Findings saved successfully!', 'ok');
}

function printReport(pid) {
  const pt = DB.getById(pid);
  const f  = DB.findings()[pid] || {};
  if (!pt) { toast('Patient not found','err'); return; }
  const st = (pt.scanType||'').toLowerCase();
  const isObs = st.includes('obstetric'), isThyroid = st.includes('thyroid'), isBreast = st.includes('breast');

  let findRows = '';
  if (!isThyroid && !isBreast) {
    [['Liver',f.fLiver],['Gallbladder & Biliary',f.fGallbladder],['Spleen',f.fSpleen],['Pancreas',f.fPancreas],
     ['Right Kidney',f.fRightKidney],['Left Kidney',f.fLeftKidney],['Urinary Bladder',f.fBladder],
     pt.sex==='Female'?['Uterus & Adnexa',f.fUterus]:['Prostate',f.fProstate],
     ['Aorta & IVC',f.fAorta],['Other / Ascites',f.fOther]
    ].filter(([,vv])=>vv&&vv.trim()).forEach(([k,vv])=>{ findRows+=`<tr><td>${k}</td><td>${esc(vv)}</td></tr>`; });
  }
  if (isThyroid) [['Right Lobe',f.fThyroidR],['Left Lobe',f.fThyroidL],['Isthmus',f.fThyroidIst],['Cervical LN',f.fThyroidLN]]
    .filter(([,vv])=>vv&&vv.trim()).forEach(([k,vv])=>{ findRows+=`<tr><td>${k}</td><td>${esc(vv)}</td></tr>`; });
  if (isBreast) [['Right Breast',f.fBreastR],['Left Breast',f.fBreastL],['Axillary LN',f.fBreastLN]]
    .filter(([,vv])=>vv&&vv.trim()).forEach(([k,vv])=>{ findRows+=`<tr><td>${k}</td><td>${esc(vv)}</td></tr>`; });

  let obsRows = '';
  if (isObs) [['Gestational Age',f.fGA],['EDD',f.fEDD?fmtDate(f.fEDD):''],['No. of Fetuses',f.fFetuses],
    ['Presentation',f.fPresentation],['FHR',f.fFHR],['Placenta',f.fPlacenta],['AFI',f.fAFI],
    ['BPD',f.fBPD],['HC',f.fHC],['AC',f.fAC],['FL',f.fFL],['EFW',f.fEFW],['Fetal Anatomy',f.fAnatomy],['Notes',f.fObsOther]
  ].filter(([,vv])=>vv&&vv.trim()).forEach(([k,vv])=>{ obsRows+=`<tr><td>${k}</td><td>${esc(vv)}</td></tr>`; });

  const rDate = f.fReportDate ? fmtDate(f.fReportDate) : fmtDate(new Date().toISOString().slice(0,10));

  document.getElementById('printContent').innerHTML = `
<div class="rpt-header">
  <div class="rpt-logo"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/><path d="M14 24 Q18 14 22 24 Q26 34 30 24 Q34 14 34 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="white"/></svg></div>
  <div>
    <div class="rpt-clinic">MediPoint Diagnostic Centre</div>
    <div class="rpt-sub">Comprehensive Ultrasound &amp; Imaging Services</div>
    <div class="rpt-contact">Tel: 0800-MEDIPOINT &nbsp;|&nbsp; info@medipoint.ng &nbsp;|&nbsp; www.medipoint.ng</div>
  </div>
  <div class="rpt-id-box"><strong>${pt.id}</strong>Report Date<br>${rDate}</div>
</div>
<div class="rpt-title">Ultrasound Report &mdash; ${esc(pt.scanType)}</div>
<table class="rpt-info-table">
  <tr><td>Patient Name</td><td><strong>${esc(pt.name)}</strong></td><td>Age / Sex</td><td>${pt.age} years / ${pt.sex}</td></tr>
  ${pt.dob?`<tr><td>Date of Birth</td><td>${fmtDate(pt.dob)}</td><td>Scan Date</td><td>${fmtDate(pt.scanDate)}</td></tr>`:`<tr><td>Scan Date</td><td colspan="3">${fmtDate(pt.scanDate)}</td></tr>`}
  ${pt.phone?`<tr><td>Phone</td><td>${esc(pt.phone)}</td><td>Address</td><td>${esc(pt.address||'—')}</td></tr>`:''}
  ${pt.refPhysician?`<tr><td>Referring Physician</td><td>${esc(pt.refPhysician)}</td><td>Hospital</td><td>${esc(pt.refHospital||'—')}</td></tr>`:''}
  ${pt.clinical?`<tr><td>Clinical History</td><td colspan="3">${esc(pt.clinical)}</td></tr>`:''}
</table>
${findRows?`<div class="rpt-section-head">Findings</div><table class="rpt-findings-table">${findRows}</table>`:''}
${obsRows?`<div class="rpt-section-head">Obstetric Measurements</div><table class="rpt-findings-table">${obsRows}</table>`:''}
${f.fImpression?`<div class="rpt-impression"><div class="rpt-impression-title">Impression / Conclusion</div><div class="rpt-impression-text">${esc(f.fImpression)}</div></div>`:''}
${f.fRecommendation?`<div class="rpt-recommend"><strong>Recommendation:</strong> ${esc(f.fRecommendation)}</div>`:''}
<div class="rpt-sigs">
  <div class="rpt-sig"><div class="rpt-sig-line">${esc(f.fRadiologist||'&nbsp;')}</div><div class="rpt-sig-sub">Radiologist / Sonographer</div></div>
  <div class="rpt-sig"><div class="rpt-sig-line">&nbsp;</div><div class="rpt-sig-sub">Signature &amp; Stamp</div></div>
</div>
<div class="rpt-footer"><div>This report is based on the ultrasound examination performed on the date stated and should be correlated clinically.</div><div class="rpt-pid">${pt.id}</div></div>`;

  openModal('printModal');
}

let _deletePid = null;
function askDelete(pid) { _deletePid = pid; openModal('deleteModal'); }

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (_deletePid) {
    DB.remove(_deletePid); _deletePid = null;
    closeModal('deleteModal');
    toast('Patient record deleted','err');
    renderDashboard(); renderReports();
  }
});

function v(id)  { return (document.getElementById(id)?.value||'').trim(); }
function show(id, visible) { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

initDates();
renderDashboard();
