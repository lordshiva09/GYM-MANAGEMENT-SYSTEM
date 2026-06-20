// ===== ADMIN LOGIN =====
const DEFAULT_ADMIN_ID = 'multigym';
const DEFAULT_ADMIN_PASS = '500';

let members = [];
let payments = [];
let gymSettings = null;
let apiAvailable = true;
let currentAlerts = [];
let activeFilter = 'All';
let filterStatus = 'all';
let filterPlan = 'all';
let currentPage = 1;
const PAGE_SIZE = 10;
let editMemberId = null;

const SESSION_KEY = 'rsgym_session';
const SESSION_DURATION = 3600000;

function doLogin(id, pass) {
  return id === DEFAULT_ADMIN_ID && pass === DEFAULT_ADMIN_PASS;
}

function enterApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('appContainer').style.display = 'flex';
  scheduleSessionReset();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

function scheduleSessionReset() {
  setTimeout(() => {
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  }, SESSION_DURATION);
}

(function () {
  const session = localStorage.getItem(SESSION_KEY);
  if (session) {
    const elapsed = Date.now() - Number(session);
    if (elapsed < SESSION_DURATION) {
      enterApp();
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }
})();

document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const id = document.getElementById('adminId').value.trim();
  const pass = document.getElementById('adminPass').value.trim();
  const errorEl = document.getElementById('loginError');
  if (doLogin(id, pass)) {
    localStorage.setItem(SESSION_KEY, String(Date.now()));
    enterApp();
    errorEl.classList.remove('show');
  } else {
    errorEl.classList.add('show');
  }
});

// ===== BACKEND STATUS =====
let waQRDataURL = null;

async function checkBackendStatus() {
  try {
    const data = await API.getStatus();
    waQRDataURL = data.qrDataURL || null;
    updateStatusIndicator(data.waReady);
    return data;
  } catch (e) {
    updateStatusIndicator(false);
    return null;
  }
}

function updateStatusIndicator(ready) {
  const el = document.getElementById('waStatusIndicator');
  if (!el) return;
  if (ready) {
    el.innerHTML = '<i class="fab fa-whatsapp" style="color:#25d366;"></i> <span style="font-size:0.78rem;color:#4ade80;">WhatsApp Connected</span>';
    el.className = 'wa-status connected';
    const qrArea = el.querySelector('.wa-qr-area');
    if (qrArea) qrArea.remove();
  } else if (waQRDataURL) {
    el.innerHTML = '<i class="fab fa-whatsapp" style="color:#f59e0b;"></i> <span style="font-size:0.78rem;color:#f59e0b;">Scan QR to Connect</span><div class="wa-qr-area" style="margin-top:8px;text-align:center;"><img src="' + waQRDataURL + '" style="width:140px;border-radius:6px;background:#fff;padding:4px;" alt="WhatsApp QR"><p style="font-size:0.6rem;color:var(--text-muted);margin:4px 0 0;">Open WhatsApp > Linked Devices > Link a Device</p></div>';
    el.className = 'wa-status disconnected';
  } else {
    el.innerHTML = '<i class="fab fa-whatsapp" style="color:#666;"></i> <span style="font-size:0.78rem;color:#ef4444;">WhatsApp Disconnected</span>';
    el.className = 'wa-status disconnected';
  }
}

function initWhatsAppStatus() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer) return;
  const div = document.createElement('div');
  div.id = 'waStatusIndicator';
  div.className = 'wa-status';
  div.innerHTML = '<i class="fab fa-whatsapp"></i> <span>Connecting...</span>';
  footer.appendChild(div);
  checkBackendStatus();
  setInterval(checkBackendStatus, 15000);
}

// ===== DATA LOADING =====
async function loadMembers() {
  try {
    members = await API.getMembers();
  } catch (e) {
    console.error('Failed to load members:', e);
    members = [];
  }
}

async function loadPayments() {
  try {
    payments = await API.getPayments();
  } catch (e) {
    console.error('Failed to load payments:', e);
    payments = [];
  }
}

async function loadSettings() {
  try {
    gymSettings = await API.getSettings();
    const upi = gymSettings.upiId || 'rsmultinationalgym@upi';
    const upiDisplay = document.getElementById('upiIdDisplay');
    if (upiDisplay) upiDisplay.textContent = upi;
    const settingsUpiInput = document.getElementById('settingsUpiId');
    const settingsUpiDisplay = document.getElementById('settingsUpiDisplay');
    if (settingsUpiInput) settingsUpiInput.value = upi;
    if (settingsUpiDisplay) settingsUpiDisplay.textContent = upi;
    const gymNameInput = document.querySelector('.settings-form .form-input[value*="RS MULTI"]');
    if (gymNameInput && gymSettings.gymName) gymNameInput.value = gymSettings.gymName;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

// DOM refs
const modal = document.getElementById('memberModal');
const addBtn = document.getElementById('addMemberBtn');
const closeBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelModalBtn');
const form = document.getElementById('memberForm');
const tbody = document.querySelector('#members .data-table tbody');
const tableFooter = document.querySelector('#members .table-footer span');
const totalMembersEl = document.querySelector('#dashboard .stat-card:nth-child(1) .stat-value');
const newMembersEl = document.querySelector('#dashboard .stat-card:nth-child(2) .stat-value');
const expiringSoonEl = document.querySelector('#dashboard .stat-card:nth-child(3) .stat-value');

function showServerBanner() {
  const el = document.getElementById('serverBanner');
  if (el) return;
  const b = document.createElement('div');
  b.id = 'serverBanner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;text-align:center;padding:12px 20px;font-size:14px;font-weight:600;font-family:Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  b.innerHTML = '\u26a0\ufe0f API Server Not Running \u2014 Open terminal in <code style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;">server/</code> folder and run <code style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;">npm start</code>, then refresh';
  document.body.prepend(b);
}

// Render saved members on page load
(async function init() {
  initToastContainer();
  let apiOk = 0;
  await loadMembers().catch(() => {});
  if (members.length > 0) apiOk++;
  await loadPayments().catch(() => {});
  if (payments.length > 0) apiOk++;
  await loadSettings().catch(() => {});
  if (gymSettings) apiOk++;
  await loadTrainers().catch(() => {});
  if (trainers.length > 0) apiOk++;
  if (apiOk === 0) showServerBanner();
  renderTable();
  updateStats();
  updateFooter();
  renderPayments();
  updatePaymentStats();
  renderTrainers();
  initWhatsAppStatus();
  checkExpiryNotifications();
  setCurrentDate();
  updateRevenueChart();

  // Close mobile sidebar on link click
  document.querySelectorAll('.sidebar .nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('mobile-toggle').checked = false;
    });
  });

  if (window.location.hash === '#renew-members') {
    renderRenewalHistory();
  }
})();

// Open modal (Add mode)
addBtn.addEventListener('click', () => {
  editMemberId = null;
  document.querySelector('#memberModal .modal-header h2').textContent = 'Add New Member';
  document.querySelector('#memberModal .modal-footer .btn-gold').innerHTML = '<i class="fas fa-user-plus"></i> Add Member';
  const amtInput = document.getElementById('memAmount');
  if (amtInput) amtInput.value = '0';
  const joinInput = document.getElementById('memJoinDate');
  if (joinInput) {
    const d = new Date();
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    joinInput.value = today;
    joinInput.max = today;
  }
  validateJoinDate(joinInput);
  modal.classList.add('show');
});

// Validate join date on change/input
function validateJoinDate(input) {
  const errEl = document.getElementById('joinDateError');
  if (!errEl || !input) return;
  const val = input.value;
  if (val) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (new Date(val) > today) {
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }
  } else {
    errEl.style.display = 'none';
  }
}
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'memJoinDate') validateJoinDate(e.target);
});
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'memJoinDate') validateJoinDate(e.target);
});
document.addEventListener('focusout', (e) => {
  if (e.target && e.target.id === 'memJoinDate') validateJoinDate(e.target);
});

function closeModal() {
  modal.classList.remove('show');
  form.reset();
  editMemberId = null;
  document.querySelector('#memberModal .modal-header h2').textContent = 'Add New Member';
  document.querySelector('#memberModal .modal-footer .btn-gold').innerHTML = '<i class="fas fa-user-plus"></i> Add Member';
  const errEl = document.getElementById('joinDateError');
  if (errEl) errEl.style.display = 'none';
}

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// ===== STAT CARD CLICK HANDLERS =====
document.querySelectorAll('#dashboard .stat-card').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', function () {
    const label = this.querySelector('.stat-label')?.textContent;
    if (label === 'Total Members') {
      const list = members.map(m => {
        const memberPayments = payments.filter(p => p.member === m.name);
        const totalPaid = memberPayments.reduce((s, p) => p.status === 'Paid' ? s + p.amount : s, 0);
        return { ...m, totalPaid };
      });
      showMemberListModal('All Members', list);
    } else if (label === 'Expired Members') {
      const list = members.filter(m => {
        const m2 = minutesUntilExpiry(m.expiryDate);
        return m2 <= 0;
      }).map(m => {
        const memberPayments = payments.filter(p => p.member === m.name);
        const totalPaid = memberPayments.reduce((s, p) => p.status === 'Paid' ? s + p.amount : s, 0);
        return { ...m, totalPaid };
      });
      if (list.length === 0) {
        showToast('No expired members', 'info');
        return;
      }
      showMemberListModal('Expired Members', list);
    } else if (label === 'New Members') {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const list = members.filter(m => {
        const join = parseDate(m.joinDate);
        return join >= threeDaysAgo;
      }).map(m => {
        const memberPayments = payments.filter(p => p.member === m.name);
        const totalPaid = memberPayments.reduce((s, p) => p.status === 'Paid' ? s + p.amount : s, 0);
        return { ...m, totalPaid };
      });
      if (list.length === 0) {
        showToast('No new members in the last 3 days', 'info');
        return;
      }
      showMemberListModal('New Members (Last 3 Days)', list);
    }
  });
});

// Revenue Overview — click to go to Payments page
const revCard = document.querySelector('.chart-card.large');
if (revCard) {
  revCard.style.cursor = 'pointer';
  revCard.addEventListener('click', () => {
    window.location.hash = '#payments';
  });
}

function showMemberListModal(title, list, showActions) {
  const existing = document.getElementById('memberListModal');
  if (existing) existing.remove();

  const isExpired = title === 'Expired Members' || showActions;

  let rows = '';
  list.forEach(m => {
    const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    rows += `<tr>
      <td><div class="member-cell"><div class="mem-avatar">${initials}</div> ${m.name}</div></td>
      <td>${m.mobile}</td>
      <td>${m.plan}</td>
      <td>${m.joinDate}</td>
      <td>${m.expiryDate}</td>
      <td>\u20B9${m.totalPaid || 0}</td>
      ${isExpired ? `<td>
        <button class="btn btn-gold" style="padding:4px 10px;font-size:0.72rem;" onclick="this.closest('.modal-overlay').remove();renewMember('${m.memberId}')"><i class="fas fa-sync"></i> Renew</button>
        <a href="${getWhatsAppLink(m.mobile, `Dear ${m.name}, your ${m.plan} plan has expired. Please renew! - RS MULTI GYM`)}" target="_blank" class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-left:4px;"><i class="fab fa-whatsapp"></i></a>
      </td>` : ''}
    </tr>`;
  });

  const colCount = isExpired ? 7 : 6;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'memberListModal';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:850px;">
      <div class="modal-header">
        <h2>${title} (${list.length})</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body" style="padding:0;max-height:60vh;overflow-y:auto;">
        <table class="data-table" style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Plan</th>
              <th>Join Date</th>
              <th>Expiry Date</th>
              <th>Paid (?)</th>
              ${isExpired ? '<th>Action</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Format a Date object to "Mon DD, YYYY" string
function formatDate(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Generate member ID
function generateId() {
  let maxNum = 0;
  members.forEach(m => {
    const match = m.memberId && m.memberId.match(/#IF-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  });
  const num = String(maxNum + 1).padStart(3, '0');
  return `#IF-${num}`;
}

// Format today's date
function todayDate() {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Add expiry date (30 days from now)
function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Parse date string to Date object
function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const parts = dateStr.split(', ');
  const dateParts = parts[0].split(' ');
  const month = months[dateParts[0]];
  const day = parseInt(dateParts[1]);
  const year = parseInt(parts[1]);
  if (parts[1] && parts[1].includes(':')) {
    const timeParts = parts[1].split(' ');
    if (timeParts.length > 1) {
      const hm = timeParts[1].split(':');
      const hours = parseInt(hm[0]);
      const mins = parseInt(hm[1]);
      return new Date(year, month, day, hours, mins);
    }
  }
  return new Date(year, month, day);
}

// Calculate minutes remaining until expiry
function minutesUntilExpiry(expiryDateStr) {
  if (!expiryDateStr) return -1;
  const now = new Date();
  const exp = parseDate(expiryDateStr);
  const diff = exp - now;
  return Math.ceil(diff / (1000 * 60));
}

// Update dashboard stats
function updateStats() {
  const total = members.length;
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const newMembersCount = members.filter(m => {
    const join = parseDate(m.joinDate);
    return join >= threeDaysAgo;
  }).length;
  const expiring = members.filter(m => {
    const m2 = minutesUntilExpiry(m.expiryDate);
    return m2 > 0 && m2 <= 2880;
  }).length;
  if (totalMembersEl) totalMembersEl.textContent = total;
  if (newMembersEl) newMembersEl.textContent = newMembersCount;
  if (expiringSoonEl) expiringSoonEl.textContent = expiring;
}

// Update table footer
function updateFooter() {
  if (tableFooter) tableFooter.textContent = `Showing ${members.length} member${members.length !== 1 ? 's' : ''}`;
}

// ===== BULK SELECT / DELETE =====
let selectedMemberIds = new Set();

function toggleSelectAll(checked) {
  if (checked) {
    members.forEach(m => selectedMemberIds.add(m.memberId));
  } else {
    selectedMemberIds.clear();
  }
  renderTable();
  updateBulkDeleteBtn();
}

function toggleMemberSelect(memberId) {
  if (selectedMemberIds.has(memberId)) {
    selectedMemberIds.delete(memberId);
  } else {
    selectedMemberIds.add(memberId);
  }
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) selectAll.checked = selectedMemberIds.size === members.length;
  updateBulkDeleteBtn();
  const row = document.querySelector(`tr[data-mid="${memberId}"]`);
  if (row) row.classList.toggle('selected-row', selectedMemberIds.has(memberId));
}

function updateBulkDeleteBtn() {
  const btn = document.getElementById('bulkDeleteBtn');
  const count = document.getElementById('selectedCount');
  if (!btn || !count) return;
  if (selectedMemberIds.size > 0) {
    btn.style.display = 'inline-flex';
    count.textContent = selectedMemberIds.size;
  } else {
    btn.style.display = 'none';
  }
}

async function deleteSelectedMembers() {
  const ids = [...selectedMemberIds];
  if (ids.length === 0) return;
  if (!confirm(`Delete ${ids.length} selected member${ids.length > 1 ? 's' : ''} and all their payments? This cannot be undone.`)) return;
  const btn = document.getElementById('bulkDeleteBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; }
  let deleted = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const m = members.find(mem => mem.memberId === id);
      await API.deleteMember(id);
      members = members.filter(mem => mem.memberId !== id);
      if (m) payments = payments.filter(p => p.member !== m.name);
      deleted++;
    } catch (e) {
      failed++;
    }
  }
  selectedMemberIds.clear();
  renderTable();
  updateStats();
  updateFooter();
  renderPayments();
  updatePaymentStats();
  updateBulkDeleteBtn();
  renderRenewalHistory();
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete <span id="selectedCount">0</span>'; }
  if (failed === 0) {
    showToast(`Successfully deleted ${deleted} member${deleted > 1 ? 's' : ''} permanently`, 'success');
  } else {
    showToast(`Deleted ${deleted}, failed ${failed} member${failed > 1 ? 's' : ''}`, 'error');
  }
}

function getFilteredMembers() {
  return members.filter(m => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (filterPlan !== 'all' && m.plan !== filterPlan) return false;
    return true;
  });
}

// Render member rows with filtering + pagination
function renderTable() {
  const filtered = getFilteredMembers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  if (filtered.length === 0) {
    selectedMemberIds.clear();
    updateBulkDeleteBtn();
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.9rem;">No members found.</td></tr>`;
    document.querySelector('.table-footer').innerHTML = `<span>Showing 0 members</span>`;
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  let html = '';
  pageItems.forEach(m => {
    const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const statusClass = m.status === 'Active' ? 'active' : m.status === 'Expired' ? 'expired' : 'warning';
    const planClass = m.plan === 'Premium' ? 'premium' : m.plan === 'Standard' ? 'standard' : 'basic';
    const minsLeft = minutesUntilExpiry(m.expiryDate);
    const checked = selectedMemberIds.has(m.memberId) ? 'checked' : '';
    const rowClass = selectedMemberIds.has(m.memberId) ? 'selected-row' : '';
    html += `<tr data-mid="${m.memberId}" class="${rowClass}">
      <td><input type="checkbox" ${checked} onchange="toggleMemberSelect('${m.memberId}')"></td>
      <td><span class="member-id">${m.memberId}</span></td>
      <td><div class="member-cell"><div class="mem-avatar">${initials}</div> ${m.name}</div></td>
      <td>${m.mobile}</td>
      <td><span class="plan-badge ${planClass}">${m.plan}</span></td>
      <td>${m.joinDate}</td>
      <td>${m.expiryDate}</td>
      <td><span class="status-badge ${statusClass}">${m.status}</span></td>
      <td><div style="display:flex;gap:4px;position:relative;"><button class="action-btn" onclick="quickPay('${m.name}')" title="Make Payment"><i class="fas fa-rupee-sign"></i></button><button class="action-btn" onclick="toggleMemberMenu('${m.memberId}')" title="More"><i class="fas fa-ellipsis-v"></i></button><div class="member-menu" id="menu-${m.memberId}">${minsLeft <= 2880 ? `<button onclick="renewMember('${m.memberId}')"><i class="fas fa-sync"></i> Renew</button>` : ''}<button onclick="editMember('${m.memberId}')"><i class="fas fa-edit"></i> Edit</button><button onclick="viewFullDetails('${m.memberId}')"><i class="fas fa-info-circle"></i> View Full Details</button><button onclick="deleteMember('${m.memberId}')" class="danger"><i class="fas fa-trash"></i> Delete</button></div></div></td>
    </tr>`;
  });
  tbody.innerHTML = html;

  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) selectAll.checked = selectedMemberIds.size === filtered.length && filtered.length > 0;

  // Pagination footer
  let pagHtml = `<span>Showing ${start + 1}-${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} members</span><div class="pagination">`;
  pagHtml += `<span class="page-btn" onclick="goToPage(${currentPage - 1})" style="${currentPage <= 1 ? 'opacity:0.3;pointer-events:none;' : ''}"><i class="fas fa-chevron-left"></i></span>`;
  for (let p = 1; p <= totalPages; p++) {
    pagHtml += `<span class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</span>`;
  }
  pagHtml += `<span class="page-btn" onclick="goToPage(${currentPage + 1})" style="${currentPage >= totalPages ? 'opacity:0.3;pointer-events:none;' : ''}"><i class="fas fa-chevron-right"></i></span>`;
  pagHtml += `</div>`;
  document.querySelector('#members .table-footer').innerHTML = pagHtml;
}

function goToPage(page) {
  const filtered = getFilteredMembers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
}

function updateRevenueChart() {
  const bars = document.querySelectorAll('.bar-chart .bar');
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (!bars.length) return;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const dailyTotals = [0, 0, 0, 0, 0, 0, 0];
  payments.forEach(p => {
    if (p.status !== 'Paid') return;
    const ts = p.timestamp || new Date(p.date).getTime();
    if (ts >= weekStart.getTime()) {
      const day = new Date(ts).getDay();
      dailyTotals[day] += Number(p.amount) || 0;
    }
  });

  const maxVal = Math.max(...dailyTotals, 1);
  bars.forEach((bar, i) => {
    const pct = Math.max(3, (dailyTotals[i] / maxVal) * 100);
    bar.style.setProperty('--h', pct + '%');
    bar.querySelector('span').textContent = '\u20B9' + dailyTotals[i];
  });

  // Chart tabs
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.onclick = function () {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      if (this.textContent.trim() === 'Monthly') {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthTotals = [0,0,0,0,0,0,0,0,0,0,0,0];
        payments.forEach(p => {
          if (p.status !== 'Paid') return;
          const d = p.timestamp ? new Date(p.timestamp) : new Date(p.date);
          if (d.getFullYear() === today.getFullYear()) {
            monthTotals[d.getMonth()] += Number(p.amount) || 0;
          }
        });
        const mmax = Math.max(...monthTotals, 1);
        bars.forEach((bar, i) => {
          const pct = Math.max(3, (monthTotals[i] / mmax) * 100);
          bar.style.setProperty('--h', pct + '%');
          bar.querySelector('span').textContent = '\u20B9' + monthTotals[i];
        });
        document.querySelectorAll('.bar-item > span:last-child').forEach((s, i) => s.textContent = months[i]);
      } else if (this.textContent.trim() === 'Yearly') {
        const years = {};
        payments.forEach(p => {
          if (p.status !== 'Paid') return;
          const d = p.timestamp ? new Date(p.timestamp) : new Date(p.date);
          const y = d.getFullYear();
          years[y] = (years[y] || 0) + (Number(p.amount) || 0);
        });
        const yEntries = Object.entries(years).sort();
        bars.forEach((bar, i) => {
          if (i < yEntries.length) {
            const pct = Math.max(3, (yEntries[i][1] / Math.max(...yEntries.map(e => e[1]), 1)) * 100);
            bar.style.setProperty('--h', pct + '%');
            bar.querySelector('span').textContent = '\u20B9' + yEntries[i][1];
          } else {
            bar.style.setProperty('--h', '3%');
            bar.querySelector('span').textContent = '--';
          }
        });
        document.querySelectorAll('.bar-item > span:last-child').forEach((s, i) => {
          s.textContent = i < yEntries.length ? yEntries[i][0] : '--';
        });
      } else {
        updateRevenueChart();
      }
    };
  });
}

// Toggle member action menu
function toggleMemberMenu(id) {
  const menu = document.getElementById('menu-' + id);
  if (!menu) return;
  const isOpen = menu.classList.contains('show');
  closeAllMenus();
  if (!isOpen) menu.classList.add('show');
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('.member-menu') && !e.target.closest('.action-btn')) {
    closeAllMenus();
  }
});

function closeAllMenus() {
  document.querySelectorAll('.member-menu.show').forEach(m => m.classList.remove('show'));
}

function daysLeft(mins) {
  if (mins <= 0) return 'Expired';
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return `${Math.round(mins)}m left`;
}

function viewFullDetails(id) {
  closeAllMenus();
  const m = members.find(mem => mem.memberId === id);
  if (!m) return;
  const minsLeft = minutesUntilExpiry(m.expiryDate);
  let expiryLine = '';
  if (minsLeft > 0 && minsLeft <= 2880) {
    expiryLine = `\u26A0 Expiring in ${daysLeft(minsLeft)}`;
  } else if (minsLeft <= 0) {
    expiryLine = '\u274C Membership expired!';
  } else {
    expiryLine = '\u2705 Membership active';
  }
  showToast(`
    <div style="text-align:left;line-height:1.8;">
      <strong style="color:var(--gold);font-size:1rem;">${m.name}</strong><br>
      <span style="color:var(--text-muted);">ID:</span> ${m.memberId}<br>
      <span style="color:var(--text-muted);">Mobile:</span> ${m.mobile}<br>
      <span style="color:var(--text-muted);">Plan:</span> ${m.plan}<br>
      <span style="color:var(--text-muted);">Timing:</span> ${m.timing}<br>
      <span style="color:var(--text-muted);">Joined:</span> ${m.joinDate}<br>
      <span style="color:var(--text-muted);">Expiry:</span> ${m.expiryDate}<br>
      <span style="color:var(--text-muted);">Status:</span> ${m.status}<br>
      ${expiryLine}
    </div>
  `, 'info', 8000);
}

async function renewMember(id) {
  closeAllMenus();
  const m = members.find(mem => mem.memberId === id);
  if (!m) return;
  if (!confirm(`Renew membership for ${m.name} (${m.memberId})? This will extend expiry by 30 days.`)) return;
  const now = new Date();
  const newExpiry = new Date(now);
  newExpiry.setDate(newExpiry.getDate() + 30);
  const expiryStr = formatDate(newExpiry);
  try {
    const result = await API.updateMember(id, { expiryDate: expiryStr, status: 'Active' });
    if (result.success) {
      m.expiryDate = expiryStr;
      m.status = 'Active';
      const amount = Number(prompt(`Enter renewal amount for ${m.name}:`, '500')) || 500;
      if (amount > 0) {
        const payment = {
          txnId: generateTxnId(),
          member: m.name,
          amount,
          method: 'Cash',
          plan: m.plan,
          type: 'Renewal',
          status: 'Paid',
          date: payDate(),
          timestamp: Date.now()
        };
        const payResult = await API.createPayment(payment);
        if (payResult.success) {
          payments.unshift(payResult.payment);
          renderPayments();
          updatePaymentStats();
        }
      }
      renderTable();
      updateStats();
      updateFooter();
      renderRenewalHistory();
      showToast(`<strong>${m.name}</strong> renewed successfully! New expiry: ${expiryStr}`, 'success');
    } else {
      showToast('Failed to renew: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    showToast('Failed to renew member: ' + e.message, 'error');
  }
}

async function deleteMember(id) {
  closeAllMenus();
  const m = members.find(mem => mem.memberId === id);
  if (!m) return;
  if (!confirm(`Delete member ${m.name} (${m.memberId})? This will also delete all payments linked to this member and cannot be undone.`)) return;
  try {
    await API.deleteMember(id);
    members = members.filter(mem => mem.memberId !== id);
    payments = payments.filter(p => p.member !== m.name);
    renderTable();
    updateStats();
    updateFooter();
    renderPayments();
    updatePaymentStats();
    renderRenewalHistory();
    showToast(`Member <strong>${m.name}</strong> and all associated payments deleted permanently`, 'success');
  } catch (e) {
    showToast('Failed to delete member: ' + e.message, 'error');
  }
}

// ===== RENEWAL HISTORY =====
function loadRenewMembers() {
  window.location.hash = '#renew-members';
  renderRenewalHistory();
}

function renderRenewalHistory() {
  const todayBody = document.getElementById('todayRenewalsBody');
  const todayFooter = document.getElementById('todayRenewalsFooter');
  const prevBody = document.getElementById('previousRenewalsBody');
  const prevFooter = document.getElementById('previousRenewalsFooter');
  if (!todayBody || !prevBody) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000;

  const allRenewals = payments.filter(p => p.type === 'Renewal').sort((a, b) => {
    const ta = a.timestamp || new Date(a.date).getTime();
    const tb = b.timestamp || new Date(b.date).getTime();
    return tb - ta;
  });

  const todayRenewals = allRenewals.filter(p => {
    const ts = p.timestamp || new Date(p.date).getTime();
    return ts >= todayStart && ts < todayEnd;
  });

  const prevRenewals = allRenewals.filter(p => {
    const ts = p.timestamp || new Date(p.date).getTime();
    return ts < todayStart;
  });

  function renderRows(list) {
    if (list.length === 0) return '';
    let html = '';
    list.forEach(p => {
      const mem = members.find(m => m.name === p.member);
      const memberId = mem ? mem.memberId : '--';
      const mobile = mem ? mem.mobile : '--';
      html += `<tr>
        <td><span class="member-id">${memberId}</span></td>
        <td>${p.member}</td>
        <td>${mobile}</td>
        <td><span class="plan-badge ${(p.plan || 'basic').toLowerCase()}">${p.plan || '--'}</span></td>
        <td><strong>\u20B9${p.amount}</strong></td>
        <td>${p.date}</td>
      </tr>`;
    });
    return html;
  }

  const todayHtml = renderRows(todayRenewals);
  todayBody.innerHTML = todayHtml || `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.9rem;">No renewals today.</td></tr>`;
  if (todayFooter) todayFooter.textContent = `Showing ${todayRenewals.length} renewal${todayRenewals.length !== 1 ? 's' : ''} today`;

  const prevHtml = renderRows(prevRenewals);
  prevBody.innerHTML = prevHtml || `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.9rem;">No previous renewals.</td></tr>`;
  if (prevFooter) prevFooter.textContent = `Showing ${prevRenewals.length} previous renewal${prevRenewals.length !== 1 ? 's' : ''}`;
}

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function initToastContainer() {
  if (document.getElementById('toastContainer')) return;
  const div = document.createElement('div');
  div.id = 'toastContainer';
  div.className = 'toast-container';
  document.body.appendChild(div);
}

// ===== WHATSAPP EXPIRY NOTIFICATION SYSTEM =====
function formatWhatsAppNumber(mobile) {
  let num = mobile.replace(/\D/g, '');
  if (num.startsWith('0')) num = num.substring(1);
  if (num.length <= 10) num = '91' + num;
  return num;
}

function getWhatsAppLink(mobile, message) {
  const num = formatWhatsAppNumber(mobile);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function checkExpiryNotifications() {
  if (members.length === 0) return;
  let expiryAlerts = [];
  members.forEach(m => {
    const minsLeft = minutesUntilExpiry(m.expiryDate);
    if (minsLeft <= -1440) return;
    if (minsLeft <= 2880 && minsLeft > 1440) {
      const msg = `Dear ${m.name}, your ${m.plan} plan expires in 2 days. Please renew soon! - RS MULTI GYM`;
      const link = getWhatsAppLink(m.mobile, msg);
      expiryAlerts.push({ member: m, minutesLeft: 2880, message: msg, link, type: '2day' });
    }
    if (minsLeft <= 1440 && minsLeft > 0) {
      const msg = `Dear ${m.name}, your ${m.plan} plan expires in 1 day. Renew now to avoid interruption! - RS MULTI GYM`;
      const link = getWhatsAppLink(m.mobile, msg);
      expiryAlerts.push({ member: m, minutesLeft: 1440, message: msg, link, type: '1day' });
    }
    if (minsLeft <= 0) {
      const msg = `Dear ${m.name}, your ${m.plan} plan has expired. Please renew your membership to continue. - RS MULTI GYM`;
      const link = getWhatsAppLink(m.mobile, msg);
      expiryAlerts.push({ member: m, minutesLeft: 0, message: msg, link, type: 'expired' });
    }
  });
  const badge = document.querySelector('.nav-item[href="#notifications"] .badge');
  if (badge && expiryAlerts.length > 0) {
    const existing = parseInt(badge.textContent) || 0;
    badge.textContent = existing + expiryAlerts.length;
  }
  updateNotificationCenter(expiryAlerts);
  updateExpiryDashboard();
  return expiryAlerts;
}

function renderNotifications() {
  const notifList = document.querySelector('.notifications-list');
  if (!notifList) return;
  notifList.innerHTML = '';
  let filtered = currentAlerts;
  if (activeFilter === 'Expiry Alerts') {
    filtered = currentAlerts.filter(a => a.type === 'expired' || a.type === '2day' || a.type === '1day');
  } else if (activeFilter === 'Payment Due') {
    filtered = currentAlerts.filter(a => a.type === 'payment');
  } else if (activeFilter === 'New Members') {
    filtered = currentAlerts.filter(a => a.type === 'newmember');
  } else if (activeFilter === 'System') {
    filtered = currentAlerts.filter(a => a.type === 'system');
  }
  if (filtered.length === 0) {
    notifList.innerHTML = `<div class="notif-item info">
      <div class="notif-icon"><i class="fas fa-bell"></i></div>
      <div class="notif-content">
        <h4>No Notifications</h4>
        <p>All caught up! You have no pending notifications.</p>
        <span class="notif-time"><i class="far fa-clock"></i> Current</span>
      </div>
    </div>`;
    return;
  }
  filtered.forEach(alert => {
    const itemType = alert.type === 'expired' ? 'critical' : 'warning';
    const icon = alert.type === 'expired' ? 'fa-times-circle' : 'fa-clock';
    const title = alert.type === 'expired' ? 'Membership Expired' : `Expiring in ${alert.minutesLeft} Minutes`;
    const desc = alert.type === 'expired'
      ? `<strong>${alert.member.name}</strong> � ${alert.member.plan} plan has expired`
      : `<strong>${alert.member.name}</strong> � ${alert.member.plan} plan expires in <strong>${alert.minutesLeft} minutes</strong>`;
    const div = document.createElement('div');
    div.className = `notif-item ${itemType}`;
    div.innerHTML = `
      <div class="notif-icon"><i class="fas ${icon}"></i></div>
      <div class="notif-content">
        <h4>${title}</h4>
        <p>${desc}</p>
        <span class="notif-time"><i class="far fa-clock"></i> Just now</span>
      </div>
      <a href="${alert.link}" target="_blank" class="notif-action wa-btn"><i class="fab fa-whatsapp"></i> Send WhatsApp</a>
    `;
    notifList.prepend(div);
  });
}

function updateNotificationCenter(alerts) {
  currentAlerts = alerts;
  renderNotifications();
}

function updateExpiryDashboard() {
  const expiringList = document.querySelector('.expiring-list');
  if (!expiringList) return;
  const expired = members.filter(m => {
    const m2 = minutesUntilExpiry(m.expiryDate);
    return m2 <= 0;
  });
  if (expired.length === 0) {
    expiringList.innerHTML = `<div class="expiring-item">
      <div class="expiring-avatar">--</div>
      <div class="expiring-info">
        <strong>No members expired</strong>
        <span>All memberships are up to date</span>
      </div>
      <span class="expiring-status normal">Clear</span>
    </div>`;
    return;
  }
  let html = '';
  expired.forEach(m => {
    const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    html += `<div class="expiring-item">
      <div class="expiring-avatar">${initials}</div>
      <div class="expiring-info">
        <strong>${m.name}</strong>
        <span>${m.plan} � Expired</span>
      </div>
      <a href="${getWhatsAppLink(m.mobile, `Dear ${m.name}, your ${m.plan} plan has expired. Please renew! - RS MULTI GYM`)}" target="_blank" class="expiring-status critical" style="text-decoration:none;"><i class="fab fa-whatsapp"></i> Renew</a>
    </div>`;
  });
  expiringList.innerHTML = html;
  const expiringStat = document.querySelector('.stat-card.warning-border .stat-value');
  if (expiringStat) expiringStat.textContent = expired.length;

  const expiredHeader = document.querySelector('.upcoming-card .card-header');
  if (expiredHeader) {
    expiredHeader.style.cursor = 'pointer';
    expiredHeader.onclick = function () {
      const list = members.filter(m => {
        const m2 = minutesUntilExpiry(m.expiryDate);
        return m2 <= 0;
      }).map(m => {
        const memberPayments = payments.filter(p => p.member === m.name);
        const totalPaid = memberPayments.reduce((s, p) => p.status === 'Paid' ? s + p.amount : s, 0);
        return { ...m, totalPaid };
      });
      if (list.length === 0) {
        showToast('No expired members', 'info');
        return;
      }
      showMemberListModal('Expired Members', list);
    };
  }
}

async function fixOldMembers() {
  if (!confirm('Reset old members expiry to 30 days from today?')) return;
  const fixed = [];
  for (const m of members) {
    const mins = minutesUntilExpiry(m.expiryDate);
    if (mins < 1440 || !m.expiryDate.includes(':')) {
      const newExpiry = expiryDate();
      try {
        await API.updateMember(m.memberId, { expiryDate: newExpiry });
        m.expiryDate = newExpiry;
        fixed.push(m.name);
      } catch (e) {
        showToast(`Failed to update ${m.name}: ${e.message}`, 'error');
      }
    }
  }
  if (fixed.length === 0) {
    showToast('No old members found � all already set to 30 days', 'info');
    return;
  }
  await loadMembers();
  renderTable();
  updateStats();
  checkExpiryNotifications();
  showToast(`Fixed ${fixed.length} member${fixed.length > 1 ? 's' : ''}: ${fixed.join(', ')}`, 'success');
}

// ===== FORM SUBMIT HANDLER =====
function editMember(id) {
  closeAllMenus();
  const m = members.find(mem => mem.memberId === id);
  if (!m) return;
  editMemberId = id;

  document.getElementById('memName').value = m.name;
  document.getElementById('memMobile').value = m.mobile;
  document.getElementById('memPlan').value = m.plan;
  document.getElementById('memTiming').value = m.timing;
  document.getElementById('memStatus').value = m.status;

  // Parse join date back to YYYY-MM-DD
  const jd = parseDate(m.joinDate);
  document.getElementById('memJoinDate').value = jd.getFullYear() + '-' + String(jd.getMonth() + 1).padStart(2, '0') + '-' + String(jd.getDate()).padStart(2, '0');

  document.getElementById('memAmount').value = '0';
  document.querySelector('#memberModal .modal-header h2').textContent = 'Edit Member';
  document.querySelector('#memberModal .modal-footer .btn-gold').innerHTML = '<i class="fas fa-save"></i> Update Member';
  modal.classList.add('show');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('memName').value.trim();
  const mobile = document.getElementById('memMobile').value.trim();
  const plan = document.getElementById('memPlan').value;
  const timing = document.getElementById('memTiming').value;
  const status = document.getElementById('memStatus').value;

  if (!name || !mobile) {
    alert('Please fill in all required fields.');
    return;
  }

  const joinDateInput = document.getElementById('memJoinDate');
  validateJoinDate(joinDateInput);
  const joinDateVal = joinDateInput ? joinDateInput.value : '';
  if (joinDateVal) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (new Date(joinDateVal) > today) {
      alert('Join date cannot be in the future.');
      return;
    }
  }

  if (editMemberId) {
    // EDIT mode
    const updateData = { name, mobile, plan, timing, status };
    if (joinDateVal) {
      const jd = new Date(joinDateVal + 'T00:00:00');
      updateData.joinDate = formatDate(jd);
    }
    try {
      const result = await API.updateMember(editMemberId, updateData);
      if (result.success) {
        const idx = members.findIndex(mem => mem.memberId === editMemberId);
        if (idx !== -1) {
          Object.assign(members[idx], result.member);
        }
        await loadMembers();
        renderTable();
        updateStats();
        updateFooter();
        renderRenewalHistory();
        editMemberId = null;
        closeModal();
        showToast(`<strong>${name}</strong> updated successfully`, 'success');
      } else {
        showToast('Failed to update: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Failed to update member: ' + err.message, 'error');
    }
    return;
  }

  // ADD mode
  const joinDate = joinDateVal ? new Date(joinDateVal + 'T00:00:00') : new Date();
  const expDate = new Date(joinDate);
  expDate.setDate(expDate.getDate() + 30);

  const member = {
    memberId: generateId(),
    name,
    mobile,
    plan,
    timing,
    status,
    joinDate: formatDate(joinDate),
    expiryDate: formatDate(expDate)
  };

  const amount = Number(document.getElementById('memAmount').value) || 0;

  try {
    const result = await API.createMember(member);
    if (result.success) {
      members.push(result.member);
      if (amount > 0) {
        const payment = {
          txnId: generateTxnId(),
          member: member.name,
          amount,
          method: 'Cash',
          plan: member.plan,
          type: 'New Registration',
          status: 'Paid',
          date: payDate(),
          timestamp: Date.now()
        };
        const payResult = await API.createPayment(payment);
        if (payResult.success) {
          payments.unshift(payResult.payment);
          renderPayments();
          updatePaymentStats();
        }
      }
      renderTable();
      updateStats();
      updateFooter();
      renderRenewalHistory();
      closeModal();
      showToast(`New member <strong>${member.name}</strong> added successfully (${member.memberId})`, 'success');
    } else {
      showToast('Failed to add member: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Failed to add member: ' + err.message, 'error');
  }
});

// ===== DYNAMIC DATE =====
function setCurrentDate() {
  const el = document.getElementById('current-date');
  if (el) el.textContent = todayDate();
}
setInterval(setCurrentDate, 86400000);

// ===== SEARCH FUNCTIONALITY =====
const searchInput = document.querySelector('.search-box input');
if (searchInput) {
  searchInput.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// ===== MEMBERS FILTERS =====
document.getElementById('filterStatus')?.addEventListener('change', function () {
  filterStatus = this.value;
  currentPage = 1;
  renderTable();
});
document.getElementById('filterPlan')?.addEventListener('change', function () {
  filterPlan = this.value;
  currentPage = 1;
  renderTable();
});

// ===== NOTIFICATION FILTERS =====
document.querySelectorAll('.notif-filter').forEach(f => {
  f.addEventListener('click', function () {
    document.querySelectorAll('.notif-filter').forEach(el => el.classList.remove('active'));
    this.classList.add('active');
    activeFilter = this.textContent.trim();
    renderNotifications();
  });
});

// ===== RENEWAL SEARCH =====
document.getElementById('renewalSearch')?.addEventListener('input', function () {
  const q = this.value.toLowerCase();
  document.querySelectorAll('#todayRenewalsBody tr, #previousRenewalsBody tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
});

// ===== RENEW MEMBERS NAV CLICK =====
document.querySelector('.nav-item[href="#renew-members"]')?.addEventListener('click', function (e) {
  setTimeout(renderRenewalHistory, 50);
});

// Also handle hashchange for Renew Members
window.addEventListener('hashchange', function () {
  if (window.location.hash === '#renew-members') {
    renderRenewalHistory();
  }
});

// ===== NOTIFICATION BELL CLICK =====
document.querySelectorAll('.notification-icon').forEach(icon => {
  icon.addEventListener('click', function () {
    window.location.hash = '#notifications';
    checkExpiryNotifications();
  });
});

// ===== NOTIFICATION MARK ALL READ =====
const markAllBtn = document.querySelector('.btn-outline .fa-check-double');
if (markAllBtn) {
  markAllBtn.closest('button')?.addEventListener('click', function () {
    currentAlerts = [];
    const list = document.querySelector('.notifications-list');
    if (list) {
      list.innerHTML = `<div class="notif-item info">
        <div class="notif-icon"><i class="fas fa-bell"></i></div>
        <div class="notif-content">
          <h4>No Notifications</h4>
          <p>All caught up! You have no pending notifications.</p>
          <span class="notif-time"><i class="far fa-clock"></i> Current</span>
        </div>
      </div>`;
    }
    const badge = document.querySelector('.nav-item[href="#notifications"] .badge');
    if (badge) badge.textContent = '0';
    const dot = document.querySelector('.notification-icon .dot');
    if (dot) dot.textContent = '0';
    showToast('All notifications cleared', 'success');
  });
}

// ===== EXPORT PDF =====
function generatePDF() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === 'Active').length;
  const expiring = members.filter(m => { const m2 = minutesUntilExpiry(m.expiryDate); return m2 > 0 && m2 <= 7; }).length;
  const totalRev = payments.reduce((s, p) => p.status === 'Paid' ? s + Number(p.amount) : s, 0);

  let memberRows = '';
  if (members.length === 0) {
    memberRows = '<tr><td colspan="4" style="text-align:center;padding:8px;color:#888;">No members registered</td></tr>';
  } else {
    members.forEach(m => {
      const mins = minutesUntilExpiry(m.expiryDate);
      const expStatus = mins <= 0 ? 'Expired' : mins <= 2880 ? daysLeft(mins) : 'Active';
      memberRows += `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${m.memberId}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${m.name}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${m.plan}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${expStatus}</td></tr>`;
    });
  }

  let payRows = '';
  if (payments.length === 0) {
    payRows = '<tr><td colspan="4" style="text-align:center;padding:8px;color:#888;">No payments recorded</td></tr>';
  } else {
    payments.slice(0, 20).forEach(p => {
      payRows += `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${p.txnId}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${p.member}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">\u20B9${p.amount}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;">${p.status}</td></tr>`;
    });
  }

  const content = `
    <div id="pdfReport" style="font-family:Arial,sans-serif;padding:30px;color:#333;">
      <div style="text-align:center;margin-bottom:24px;border-bottom:3px solid #4da6ff;padding-bottom:16px;">
        <h1 style="margin:0 0 4px;font-size:22px;color:#222;">RS MULTI GYM</h1>
        <p style="margin:0 0 4px;font-size:13px;color:#666;">( UNISEX GYM ) � Gym Management Report</p>
        <p style="margin:0;font-size:11px;color:#999;">Generated: ${dateStr}</p>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="flex:1;background:#f8f6f0;border-radius:6px;padding:12px;text-align:center;border:1px solid #e0d5b8;">
          <div style="font-size:20px;font-weight:700;color:#4da6ff;">${totalMembers}</div>
          <div style="font-size:11px;color:#666;">Total Members</div>
        </div>
        <div style="flex:1;background:#f0f8f0;border-radius:6px;padding:12px;text-align:center;border:1px solid #b8e0b8;">
          <div style="font-size:20px;font-weight:700;color:#2e7d32;">${activeMembers}</div>
          <div style="font-size:11px;color:#666;">Active Members</div>
        </div>
        <div style="flex:1;background:#fff3e0;border-radius:6px;padding:12px;text-align:center;border:1px solid #ffcc80;">
          <div style="font-size:20px;font-weight:700;color:#e65100;">${expiring}</div>
          <div style="font-size:11px;color:#666;">Expiring Soon</div>
        </div>
        <div style="flex:1;background:#e8f5e9;border-radius:6px;padding:12px;text-align:center;border:1px solid #a5d6a7;">
          <div style="font-size:20px;font-weight:700;color:#2e7d32;">\u20B9${totalRev.toLocaleString()}</div>
          <div style="font-size:11px;color:#666;">Total Revenue</div>
        </div>
      </div>
      <h3 style="margin:0 0 8px;font-size:14px;color:#4da6ff;border-bottom:1px solid #ddd;padding-bottom:6px;">Members List</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:#4da6ff;color:#fff;"><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">ID</th><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Name</th><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Plan</th><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Status</th></tr></thead>
        <tbody>${memberRows}</tbody>
      </table>
      <h3 style="margin:0 0 8px;font-size:14px;color:#4da6ff;border-bottom:1px solid #ddd;padding-bottom:6px;">Recent Payments</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:#4da6ff;color:#fff;"><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Txn ID</th><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Member</th><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Amount</th><th style="padding:6px 8px;border:1px solid #4da6ff;font-size:11px;text-align:left;">Status</th></tr></thead>
        <tbody>${payRows}</tbody>
      </table>
      <div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999;">
        <p style="margin:0;">RS MULTI GYM ( UNISEX GYM ) � Powered by RS MULTI GYM v1.0</p>
      </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = content;
  document.body.appendChild(wrapper);

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `RS-MULTI-GYM-Report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(wrapper).save().then(() => {
    document.body.removeChild(wrapper);
  }).catch(() => {
    document.body.removeChild(wrapper);
    alert('Could not generate PDF. Please try again.');
  });
}

const exportBtns = document.querySelectorAll('.btn-gold .fa-download');
exportBtns.forEach(btn => {
  btn.closest('button')?.addEventListener('click', generatePDF);
});

// ===== TEST WHATSAPP FUNCTION =====
function testWhatsApp() {
  const number = '9341862473';
  const msg = 'your gym plans expiring soon - RS MULTI GYM';
  const link = `https://wa.me/91${number}?text=${encodeURIComponent(msg)}`;
  window.open(link, '_blank');
}

async function createTestMember() {
  const name = prompt('Test member name:', 'TEST-USER');
  if (!name) return;
  const mobile = prompt('Mobile number (with 10 digits):', '9341862473');
  if (!mobile) return;
  try {
    const result = await API.post('/api/create-test', { name, mobile });
    if (result.success) {
      showToast(`🧪 Test member "${name}" created — expires in 5 minutes! WhatsApp alert bheja? ${result.testMessageSent ? '✅ Haan' : '❌ Nahi (WhatsApp disconnected)'}`, result.testMessageSent ? 'success' : 'warning');
      if (result.testMessageSent) {
        showToast('📱 WhatsApp pe message check karo!', 'success');
      }
    } else {
      showToast('Error: ' + (result.error || 'Unknown'), 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

// ===== PAYMENTS SYSTEM =====
const payModal = document.getElementById('paymentModal');
const payAddBtn = document.getElementById('addPaymentBtn');
const payCloseBtn = document.getElementById('closePaymentModalBtn');
const payCancelBtn = document.getElementById('cancelPaymentModalBtn');
const payForm = document.getElementById('paymentForm');
const payTbody = document.getElementById('paymentTableBody');
const payFooter = document.getElementById('paymentFooter');
const payMemberSelect = document.getElementById('payMember');

payAddBtn?.addEventListener('click', function () {
  payMemberSelect.innerHTML = '<option value="">-- Select Member --</option>';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = `${m.name} (${m.memberId})`;
    payMemberSelect.appendChild(opt);
  });
  payModal.classList.add('show');
});

function closePayModal() {
  payModal.classList.remove('show');
  payForm.reset();
}

payCloseBtn?.addEventListener('click', closePayModal);
payCancelBtn?.addEventListener('click', closePayModal);
payModal?.addEventListener('click', (e) => {
  if (e.target === payModal) closePayModal();
});

function generateTxnId() {
  const num = String(payments.length + 1).padStart(4, '0');
  return `TXN-${num}`;
}

function payDate() {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderPayments() {
  if (payments.length === 0) {
    payTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.9rem;">No payments recorded yet. Click "Record Payment" to add the first transaction.</td></tr>`;
    if (payFooter) payFooter.textContent = 'Showing 0 payments';
    return;
  }
  let html = '';
  payments.forEach((p, i) => {
    const statusClass = p.status === 'Paid' ? 'active' : p.status === 'Pending' ? 'warning' : 'expired';
    html += `<tr>
      <td><span class="member-id">${p.txnId}</span></td>
      <td>${p.member}</td>
      <td><strong>\u20B9${p.amount}</strong></td>
      <td>${p.method}</td>
      <td><span class="plan-badge ${p.plan.toLowerCase()}">${p.plan}</span></td>
      <td>${p.date}</td>
      <td><span class="status-badge ${statusClass}">${p.status}</span></td>
      <td><button class="action-btn" onclick="alert('Txn: ${p.txnId}\\nMember: ${p.member}\\nAmount: \u20B9${p.amount}\\nMethod: ${p.method}\\nPlan: ${p.plan}\\nDate: ${p.date}\\nStatus: ${p.status}')"><i class="fas fa-ellipsis-v"></i></button></td>
    </tr>`;
  });
  payTbody.innerHTML = html;
  if (payFooter) payFooter.textContent = `Showing ${payments.length} payment${payments.length !== 1 ? 's' : ''}`;
}

function updatePaymentStats() {
  const total = payments.reduce((sum, p) => p.status === 'Paid' ? sum + Number(p.amount) : sum, 0);
  const now = new Date();
  const monthly = payments.reduce((sum, p) => {
    if (p.status !== 'Paid') return sum;
    const d = p.timestamp ? new Date(p.timestamp) : new Date(p.date);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      return sum + Number(p.amount);
    }
    return sum;
  }, 0);
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const last7 = payments.reduce((sum, p) => {
    if (p.status !== 'Paid') return sum;
    const ts = p.timestamp ? new Date(p.timestamp).getTime() : new Date(p.date).getTime();
    if (ts >= sevenDaysAgo) return sum + Number(p.amount);
    return sum;
  }, 0);
  const pending = payments.reduce((sum, p) => p.status === 'Pending' ? sum + Number(p.amount) : sum, 0);

  const totalEl = document.getElementById('totalCollected');
  const monthlyEl = document.getElementById('monthlyCollected');
  const last7El = document.getElementById('last7Collected');
  const pendingEl = document.getElementById('pendingPayments');
  if (totalEl) totalEl.textContent = `\u20B9${total.toLocaleString()}`;
  if (monthlyEl) monthlyEl.textContent = `\u20B9${monthly.toLocaleString()}`;
  if (last7El) last7El.textContent = `\u20B9${last7.toLocaleString()}`;
  if (pendingEl) pendingEl.textContent = `\u20B9${pending.toLocaleString()}`;
  const revEl = document.querySelector('#dashboard .stat-card:nth-child(4) .stat-value');
  if (revEl) revEl.textContent = `\u20B9${total.toLocaleString()}`;
  updateRevenueChart();
}

payForm?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const member = payMemberSelect.value;
  const amount = document.getElementById('payAmount').value;
  const method = document.getElementById('payMethod').value;
  const plan = document.getElementById('payPlan').value;
  const type = document.getElementById('payType').value;
  const status = document.getElementById('payStatus').value;

  if (!member) {
    alert('Please select a member.');
    return;
  }

  const payment = {
    txnId: generateTxnId(),
    member,
    amount: Number(amount),
    method,
    plan,
    type,
    status,
    date: payDate(),
    timestamp: Date.now()
  };

  try {
    const result = await API.createPayment(payment);
    if (result.success) {
      payments.unshift(result.payment);
      renderPayments();
      updatePaymentStats();
      closePayModal();
      showToast(`Payment of \u20B9${payment.amount} recorded for ${payment.member}`, 'success');
    } else {
      showToast('Failed to record payment: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Failed to record payment: ' + err.message, 'error');
  }
});

function quickPay(memberName) {
  payMemberSelect.innerHTML = '<option value="">-- Select Member --</option>';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = `${m.name} (${m.memberId})`;
    if (m.name === memberName) opt.selected = true;
    payMemberSelect.appendChild(opt);
  });
  payModal.classList.add('show');
}

function copyUPI() {
  const upiId = document.getElementById('upiIdDisplay').textContent;
  navigator.clipboard?.writeText(upiId).then(() => {
    alert('UPI ID copied: ' + upiId);
  }).catch(() => {
    alert('UPI ID: ' + upiId);
  });
}

function openUPIApp() {
  const upiId = document.getElementById('upiIdDisplay').textContent;
  const upiLink = `upi://pay?pa=${upiId}&pn=RS%20MULTI%20NATIONAL%20GYM&cu=INR`;
  window.location.href = upiLink;
  setTimeout(() => {
    window.open(`https://wa.me/919341862473?text=${encodeURIComponent('I want to pay via UPI to ' + upiId)}`, '_blank');
  }, 500);
}

function saveUPIId() {
  const input = document.getElementById('settingsUpiId');
  const display = document.getElementById('settingsUpiDisplay');
  const upiDisplay = document.getElementById('upiIdDisplay');
  const val = input?.value.trim();
  if (!val) { alert('Please enter a valid UPI ID.'); return; }
  API.saveSettings({ upiId: val }).then(() => {
    if (upiDisplay) upiDisplay.textContent = val;
    if (display) display.textContent = val;
    if (gymSettings) gymSettings.upiId = val;
    alert('UPI ID saved: ' + val);
  }).catch(err => {
    alert('Failed to save UPI ID: ' + err.message);
  });
}

// ===== TRAINERS =====
let trainers = [];

// DOM refs
const trainerModal = document.getElementById('trainerModal');
const addTrainerBtn = document.getElementById('addTrainerBtn');
const closeTrainerBtn = document.getElementById('closeTrainerModalBtn');
const cancelTrainerBtn = document.getElementById('cancelTrainerModalBtn');
const trainerForm = document.getElementById('trainerForm');
const trainersGrid = document.getElementById('trainersGrid');
const totalTrainersEl = document.getElementById('totalTrainers');
const trainerChangeEl = document.getElementById('trainerChange');

async function loadTrainers() {
  const data = await API.getTrainers();
  if (Array.isArray(data)) trainers = data;
}

function generateTrainerBio(trainer) {
  const exp = trainer.experience || 'some experience';
  const name = trainer.name || 'a trainer';
  const first = name.split(' ')[0] || name;
  const bios = [
    `Certified fitness professional with ${exp} of experience, dedicated to transforming lives through personalized training programs.`,
    `${first} is a passionate fitness coach with ${exp}, specializing in strength training and functional fitness.`,
    `With ${exp} in the fitness industry, ${first} brings expertise in bodybuilding, weight loss, and endurance training.`,
    `${first} — a highly motivated trainer with ${exp}, committed to helping members achieve their dream physique.`,
    `Fitness expert with ${exp}, known for creating customized workout plans that deliver real results for every body type.`,
    `${first} has ${exp} of hands-on experience in personal training, nutrition guidance, and motivation coaching.`,
    `Dedicated fitness professional with ${exp}, specializing in high-intensity training, flexibility, and core conditioning.`,
    `${first} combines ${exp} of fitness knowledge with a passion for helping others stay fit, healthy, and confident.`,
  ];
  return bios[Math.floor(Math.random() * bios.length)];
}

function renderTrainers() {
  if (!trainersGrid) return;
  if (trainers.length === 0) {
    trainersGrid.innerHTML = `<div class="trainer-card">
      <div class="trainer-img" style="background: linear-gradient(135deg, var(--accent-dark), var(--accent));">
        <span>--</span>
      </div>
      <div class="trainer-info">
        <h3>No Trainers Added</h3>
        <span class="trainer-spec"><i class="fas fa-info"></i> Click "Add Trainer" to register</span>
        <span class="trainer-contact"><i class="fas fa-phone"></i> No contact</span>
      </div>
    </div>`;
  } else {
    let html = '';
    trainers.forEach(t => {
      const photoHtml = t.photo
        ? `<img src="${t.photo}" alt="${t.name}" class="trainer-photo-img">`
        : `<span>${t.name.charAt(0).toUpperCase()}</span>`;
      const bio = t.bio || generateTrainerBio(t);
      html += `<div class="trainer-card">
        <div class="trainer-img">${photoHtml}</div>
        <div class="trainer-info">
          <h3>${t.name}</h3>
          <p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">${bio}</p>
          <span class="trainer-spec"><i class="fas fa-briefcase"></i> ${t.experience || 'No experience mentioned'}</span>
          <span class="trainer-contact"><i class="fas fa-phone"></i> ${t.mobile}</span>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <button class="btn btn-outline" style="flex:1;padding:6px;font-size:0.75rem;" onclick="deleteTrainer('${t._id}')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>`;
    });
    trainersGrid.innerHTML = html;
  }
  if (totalTrainersEl) totalTrainersEl.textContent = trainers.length;
  if (trainerChangeEl) trainerChangeEl.textContent = trainers.length === 0 ? 'No trainers yet' : (trainers.length === 1 ? '1 trainer' : trainers.length + ' trainers');
}

async function deleteTrainer(id) {
  if (!confirm('Delete this trainer?')) return;
  try {
    const result = await API.deleteTrainer(id);
    if (result.success) {
      trainers = trainers.filter(t => t._id !== id);
      renderTrainers();
      showToast('Trainer deleted successfully', 'success');
    } else {
      showToast('Failed to delete trainer: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Failed to delete trainer: ' + err.message, 'error');
  }
}

// Open trainer modal
addTrainerBtn?.addEventListener('click', () => {
  document.getElementById('trainerName').value = '';
  document.getElementById('trainerMobile').value = '';
  document.getElementById('trainerExperience').value = '';
  document.getElementById('trainerPhotoInput').value = '';
  const preview = document.getElementById('trainerPhotoPreview');
  if (preview) preview.innerHTML = '<i class="fas fa-user"></i>';
  trainerModal.classList.add('show');
});

function closeTrainerModal() {
  trainerModal.classList.remove('show');
  trainerForm.reset();
  const preview = document.getElementById('trainerPhotoPreview');
  if (preview) preview.innerHTML = '<i class="fas fa-user"></i>';
}

closeTrainerBtn?.addEventListener('click', closeTrainerModal);
cancelTrainerBtn?.addEventListener('click', closeTrainerModal);
trainerModal?.addEventListener('click', (e) => {
  if (e.target === trainerModal) closeTrainerModal();
});

// Photo preview
document.getElementById('trainerPhotoInput')?.addEventListener('change', function () {
  const preview = document.getElementById('trainerPhotoPreview');
  if (!preview) return;
  const file = this.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.innerHTML = `<img src="${e.target.result}" class="trainer-photo-img">`;
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = '<i class="fas fa-user"></i>';
  }
});

// Submit handler
trainerForm?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = document.getElementById('trainerName').value.trim();
  const mobile = document.getElementById('trainerMobile').value.trim();
  const experience = document.getElementById('trainerExperience').value.trim();
  if (!name || !mobile) {
    alert('Please fill in name and mobile number.');
    return;
  }

  const photoInput = document.getElementById('trainerPhotoInput');
  let photo = '';
  if (photoInput && photoInput.files[0]) {
    photo = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = function (ev) { resolve(ev.target.result); };
      reader.readAsDataURL(photoInput.files[0]);
    });
  }

  const bio = generateTrainerBio({ name, experience });
  const trainer = { name, mobile, experience, photo, bio };

  try {
    const result = await API.createTrainer(trainer);
    if (result.success) {
      trainers.unshift(result.trainer);
      renderTrainers();
      closeTrainerModal();
      showToast(`Trainer <strong>${trainer.name}</strong> added successfully`, 'success');
    } else {
      showToast('Failed to add trainer: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Failed to add trainer: ' + err.message, 'error');
  }
});
