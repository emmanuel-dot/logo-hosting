/* ============================================================
   MEDIPOINT – ULTRASOUND SYSTEM  |  app.js
   ============================================================ */

/* ── DATA LAYER ── */
const DB = {
  getPatients() { return JSON.parse(localStorage.getItem('mp_patients') || '[]'); },
  savePatients(p) { localStorage.setItem('mp_patients', JSON.stringify(p)); },
  getFindings() { return JSON.parse(localStorage.getItem('mp_findings') || '{}'); },
  saveFindings(f) { localStorage.setItem('mp_findings', JSON.stringify(f)); },

  addPatient(pt) {
    const patients = this.getPatients();
    pt.id = 'MP' + String(Date.now()).slice(-6);
    pt.createdAt = new Date().toISOString();
    patients.unshift(pt);
    this.savePatients(patients);
    return pt;
  },

  updateFindings(pid, data) {
    const all = this.getFindings();
    all[pid] = data;
    this.saveFindings(all);
  },

  getPatientById(id) { return this.getPatients().find(p => p.id === id); },

  deletePatient(id) {
    const patients = this.getPatients().filter(p => p.id !== id);
    this.savePatients(patients);
    const all = this.getFindings();
    delete all[id];
    this.saveFindings(all);
  }
};

/* ── NAVIGATION ── */
const pageTitles = { dashboard: 'Dashboard', register: 'Register Patient', findings: 'Findings Entry', reports: 'Reports' };

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[name];

  if (name === 'dashboard') renderDashboard();
  if (name === 'findings')  populateFindingsSelect();
  if (name === 'reports')   renderReports();

  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ── TOAST ── */
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

/* ── DATE ── */
function initDate() {
  const d = new Date();
  document.getElementById('currentDate').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  document.getElementById('ptScanDate').value = d.toISOString().slice(0, 10);
  document.getElementById('fReportDate').value = d.toISOString().slice(0, 10);
}

/* ── GENDER FIELDS ── */
function toggleGenderFields() {
  // used when showing findings – see loadPatientForFindings
}

/* ── REGISTER PATIENT ── */
function savePatient(e) {
  e.preventDefault();
  const pt = {
    name:        document.getElementById('ptName').value.trim(),
    dob:         document.getElementById('ptDob').value,
    age:         document.getElementById('ptAge').value,
    sex:         document.getElementById('ptSex').value,
    phone:       document.getElementById('ptPhone').value.trim(),
    address:     document.getElementById('ptAddress').value.trim(),
    refPhysician:document.getElementById('ptRefPhysician').value.trim(),
    refHospital: document.getElementById('ptRefHospital').value.trim(),
    scanType:    document.getElementById('ptScanType').value,
    scanDate:    document.getElementById('ptScanDate').value,
    clinical:    document.getElementById('ptClinical').value.trim(),
    status:      'Pending'
  };
  const saved = DB.addPatient(pt);
  toast(`Patient ${saved.name} registered successfully (${saved.id})`);
  document.getElementById('registerForm').reset();
  document.getElementById('ptScanDate').value = new Date().toISOString().slice(0,10);
  showPage('findings');
  setTimeout(() => {
    populateFindingsSelect();
    document.getElementById('findingsPatientSelect').value = saved.id;
    loadPatientForFindings();
  }, 100);
}

/* ── DASHBOARD ── */
function renderDashboard() {
  const patients = DB.getPatients();
  const findings = DB.getFindings();
  const today = new Date().toISOString().slice(0, 10);

  const complete = patients.filter(p => findings[p.id]).length;
  const pending  = patients.length - complete;
  const todayCount = patients.filter(p => p.scanDate === today).length;

  document.getElementById('statTotal').textContent   = patients.length;
  document.getElementById('statComplete').textContent= complete;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statToday').textContent   = todayCount;

  const tbody = document.getElementById('dashboardTableBody');
  if (!patients.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No patients registered yet.</td></tr>';
    return;
  }
  tbody.innerHTML = patients.slice(0, 10).map(p => `
    <tr>
      <td><strong>${p.id}</strong></td>
      <td>${p.name}</td>
      <td>${p.age}y / ${p.sex}</td>
      <td>${fmtDate(p.scanDate)}</td>
      <td>${p.scanType}</td>
      <td><span class="badge ${findings[p.id] ? 'badge-complete' : 'badge-pending'}">${findings[p.id] ? 'Complete' : 'Pending'}</span></td>
      <td>
        <div class="action-btns">
          ${!findings[p.id] ? `<button class="btn btn-primary btn-sm" onclick="goToFindings('${p.id}')">Add Findings</button>` : ''}
          <button class="btn btn-outline btn-sm" onclick="printReport('${p.id}')">Print</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ── REPORTS TABLE ── */
function renderReports(filter = '') {
  let patients = DB.getPatients();
  const findings = DB.getFindings();
  if (filter) {
    const q = filter.toLowerCase();
    patients = patients.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }
  const tbody = document.getElementById('reportsTableBody');
  if (!patients.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No records found.</td></tr>';
    return;
  }
  tbody.innerHTML = patients.map(p => `
    <tr>
      <td><strong>${p.id}</strong></td>
      <td>${p.name}</td>
      <td>${p.age}y / ${p.sex}</td>
      <td>${p.scanType}</td>
      <td>${fmtDate(p.scanDate)}</td>
      <td><span class="badge ${findings[p.id] ? 'badge-complete' : 'badge-pending'}">${findings[p.id] ? 'Complete' : 'Pending'}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-primary btn-sm" onclick="goToFindings('${p.id}')">Edit Findings</button>
          <button class="btn btn-success btn-sm" onclick="printReport('${p.id}')">Print</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterReports() {
  renderReports(document.getElementById('reportSearch').value);
}

/* ── FINDINGS ── */
function populateFindingsSelect() {
  const sel = document.getElementById('findingsPatientSelect');
  const patients = DB.getPatients();
  sel.innerHTML = '<option value="">-- Select a registered patient --</option>' +
    patients.map(p => `<option value="${p.id}">${p.id} – ${p.name} (${p.scanType})</option>`).join('');
}

function goToFindings(pid) {
  showPage('findings');
  setTimeout(() => {
    populateFindingsSelect();
    document.getElementById('findingsPatientSelect').value = pid;
    loadPatientForFindings();
  }, 80);
}

function loadPatientForFindings() {
  const pid = document.getElementById('findingsPatientSelect').value;
  const strip = document.getElementById('findingsPatientInfo');
  const form  = document.getElementById('findingsForm');

  if (!pid) {
    strip.style.display = 'none';
    form.style.display  = 'none';
    return;
  }

  const pt = DB.getPatientById(pid);
  if (!pt) return;

  strip.style.display = 'flex';
  strip.innerHTML = [
    ['Patient', pt.name],
    ['ID', pt.id],
    ['Age/Sex', `${pt.age}y / ${pt.sex}`],
    ['Scan Type', pt.scanType],
    ['Scan Date', fmtDate(pt.scanDate)],
    ['Referring Dr', pt.refPhysician || '—'],
  ].map(([k,v]) => `<div class="info-chip"><span>${k}:</span><span>${v}</span></div>`).join('');

  document.getElementById('prostateField').style.display = pt.sex === 'Male' ? '' : 'none';
  document.getElementById('uterusField').style.display   = pt.sex === 'Female' ? '' : 'none';

  const scanType = (pt.scanType || '').toLowerCase();
  document.getElementById('abdominalFindings').style.display = 'block';
  document.getElementById('obstetricFindings').style.display = 'none';
  document.getElementById('thyroidFindings').style.display   = 'none';
  document.getElementById('breastFindings').style.display    = 'none';

  if (scanType.includes('obstetric')) {
    document.getElementById('obstetricFindings').style.display = 'block';
  }
  if (scanType.includes('thyroid') || scanType.includes('neck')) {
    document.getElementById('abdominalFindings').style.display = 'none';
    document.getElementById('thyroidFindings').style.display   = 'block';
  }
  if (scanType.includes('breast')) {
    document.getElementById('abdominalFindings').style.display = 'none';
    document.getElementById('breastFindings').style.display    = 'block';
  }

  form.style.display = 'block';
  document.getElementById('findingsPid').value = pid;

  const existing = DB.getFindings()[pid];
  if (existing) {
    const fields = ['fLiver','fGallbladder','fSpleen','fPancreas','fRightKidney','fLeftKidney',
      'fBladder','fUterus','fProstate','fAorta','fOther','fImpression','fRecommendation',
      'fRadiologist','fReportDate','fGA','fEDD','fPresentation','fFHR','fPlacenta','fAFI',
      'fBPD','fHC','fAC','fFL','fEFW','fFetuses','fAnatomy','fObsOther',
      'fThyroidR','fThyroidL','fThyroidIst','fThyroidLN','fBreastR','fBreastL','fBreastLN'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el && existing[id] !== undefined) el.value = existing[id];
    });
  } else {
    document.getElementById('findingsForm').reset();
    document.getElementById('findingsPid').value = pid;
    document.getElementById('fReportDate').value = new Date().toISOString().slice(0,10);
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
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value;
  });

  DB.updateFindings(pid, data);

  const patients = DB.getPatients();
  const idx = patients.findIndex(p => p.id === pid);
  if (idx > -1) { patients[idx].status = 'Complete'; DB.savePatients(patients); }

  toast('Findings saved successfully!');
}

/* ── PRINT REPORT ── */
function printReport(pid) {
  const pt = DB.getPatientById(pid);
  const f  = DB.getFindings()[pid] || {};
  if (!pt) { toast('Patient not found', 'error'); return; }

  const scanType = (pt.scanType || '').toLowerCase();
  const isObs    = scanType.includes('obstetric');
  const isThyroid= scanType.includes('thyroid') || scanType.includes('neck');
  const isBreast = scanType.includes('breast');

  let findingRows = '';

  if (!isThyroid && !isBreast) {
    const fields = [
      ['Liver', f.fLiver],
      ['Gallbladder & Biliary', f.fGallbladder],
      ['Spleen', f.fSpleen],
      ['Pancreas', f.fPancreas],
      ['Right Kidney', f.fRightKidney],
      ['Left Kidney', f.fLeftKidney],
      ['Urinary Bladder', f.fBladder],
      pt.sex === 'Female' ? ['Uterus & Adnexa', f.fUterus] : ['Prostate', f.fProstate],
      ['Aorta & IVC', f.fAorta],
      ['Other / Ascites', f.fOther],
    ];
    findingRows = fields.filter(([,v]) => v && v.trim()).map(([k,v]) => `
      <tr><td>${k}</td><td>${escHtml(v)}</td></tr>`).join('');
  }

  if (isThyroid) {
    const fields = [['Right Lobe', f.fThyroidR], ['Left Lobe', f.fThyroidL],
      ['Isthmus', f.fThyroidIst], ['Cervical Lymph Nodes', f.fThyroidLN]];
    findingRows = fields.filter(([,v]) => v && v.trim()).map(([k,v]) => `
      <tr><td>${k}</td><td>${escHtml(v)}</td></tr>`).join('');
  }

  if (isBreast) {
    const fields = [['Right Breast', f.fBreastR], ['Left Breast', f.fBreastL],
      ['Axillary Lymph Nodes', f.fBreastLN]];
    findingRows = fields.filter(([,v]) => v && v.trim()).map(([k,v]) => `
      <tr><td>${k}</td><td>${escHtml(v)}</td></tr>`).join('');
  }

  let obsRows = '';
  if (isObs) {
    const obsFields = [
      ['Gestational Age', f.fGA], ['EDD', f.fEDD ? fmtDate(f.fEDD) : ''],
      ['Presentation', f.fPresentation], ['FHR', f.fFHR],
      ['Placenta', f.fPlacenta], ['Amniotic Fluid', f.fAFI],
      ['No. of Fetuses', f.fFetuses],
      ['BPD', f.fBPD], ['HC', f.fHC], ['AC', f.fAC], ['FL', f.fFL], ['EFW', f.fEFW],
      ['Fetal Anatomy', f.fAnatomy], ['Other Notes', f.fObsOther],
    ];
    obsRows = obsFields.filter(([,v]) => v && v.trim()).map(([k,v]) => `
      <tr><td>${k}</td><td>${escHtml(v)}</td></tr>`).join('');
  }

  const reportDate = f.fReportDate ? fmtDate(f.fReportDate) : fmtDate(new Date().toISOString().slice(0,10));

  document.getElementById('printContent').innerHTML = `
  <div class="print-header">
    <div class="print-logo">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
        <path d="M14 24 Q18 14 22 24 Q26 34 30 24 Q34 14 34 24" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <circle cx="24" cy="24" r="3" fill="white"/>
      </svg>
    </div>
    <div style="flex:1">
      <div class="print-clinic-name">MediPoint Diagnostic Centre</div>
      <div class="print-clinic-sub">Comprehensive Ultrasound &amp; Imaging Services</div>
      <div class="print-clinic-contact">Tel: 0800-MEDIPOINT &nbsp;|&nbsp; Email: info@medipoint.ng &nbsp;|&nbsp; www.medipoint.ng</div>
    </div>
    <div style="text-align:right;opacity:.8;font-size:12px">
      <div style="font-weight:700;font-size:14px">${pt.id}</div>
      <div>Report Date</div>
      <div style="font-weight:700">${reportDate}</div>
    </div>
  </div>

  <div class="print-report-title">Ultrasound Report &nbsp;&mdash;&nbsp; ${pt.scanType}</div>

  <table class="print-patient-table">
    <tr><td>Patient Name</td><td><strong>${escHtml(pt.name)}</strong></td><td>Age / Sex</td><td>${pt.age} years / ${pt.sex}</td></tr>
    ${pt.dob ? `<tr><td>Date of Birth</td><td>${fmtDate(pt.dob)}</td><td>Scan Date</td><td>${fmtDate(pt.scanDate)}</td></tr>` : `<tr><td>Scan Date</td><td colspan="3">${fmtDate(pt.scanDate)}</td></tr>`}
    ${pt.phone ? `<tr><td>Phone</td><td>${escHtml(pt.phone)}</td><td>Address</td><td>${escHtml(pt.address || '—')}</td></tr>` : ''}
    ${pt.refPhysician ? `<tr><td>Referring Physician</td><td>${escHtml(pt.refPhysician)}</td><td>Referring Hospital</td><td>${escHtml(pt.refHospital || '—')}</td></tr>` : ''}
    ${pt.clinical ? `<tr><td>Clinical History</td><td colspan="3">${escHtml(pt.clinical)}</td></tr>` : ''}
  </table>

  ${findingRows ? `
  <div class="print-section-title">Findings</div>
  <table class="print-findings-table">${findingRows}</table>` : ''}

  ${obsRows ? `
  <div class="print-section-title">Obstetric Measurements</div>
  <table class="print-findings-table">${obsRows}</table>` : ''}

  ${f.fImpression ? `
  <div class="print-impression">
    <div class="print-impression-title">Impression / Conclusion</div>
    <div class="print-impression-text">${escHtml(f.fImpression)}</div>
  </div>` : ''}

  ${f.fRecommendation ? `
  <div class="print-recommendation">
    <strong>Recommendation:</strong> ${escHtml(f.fRecommendation)}
  </div>` : ''}

  <div class="print-signature-row">
    <div class="print-sig-block">
      <div class="print-sig-line">${escHtml(f.fRadiologist || '_______________________')}</div>
      <div class="print-sig-label">Radiologist / Sonographer</div>
    </div>
    <div class="print-sig-block">
      <div class="print-sig-line">&nbsp;</div>
      <div class="print-sig-label">Signature &amp; Stamp</div>
    </div>
  </div>

  <div class="print-footer">
    <div>This report is based on the ultrasound examination performed on the date stated and should be correlated clinically.</div>
    <div class="print-id">${pt.id}</div>
  </div>`;

  document.getElementById('printModal').style.display = 'flex';
}

function closePrintModal(e) {
  if (e.target === document.getElementById('printModal')) {
    document.getElementById('printModal').style.display = 'none';
  }
}

/* ── DELETE ── */
let pendingDeleteId = null;

function confirmDelete(pid) {
  pendingDeleteId = pid;
  document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal(e) {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none';
  }
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (pendingDeleteId) {
    DB.deletePatient(pendingDeleteId);
    pendingDeleteId = null;
    document.getElementById('deleteModal').style.display = 'none';
    toast('Patient record deleted', 'error');
    renderDashboard();
    renderReports();
  }
});

/* ── HELPERS ── */
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

/* ── INIT ── */
initDate();
renderDashboard();
