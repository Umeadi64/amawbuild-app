/* AmawBuild tracking - vanilla JS client (restored)
   Uses MockAPI at https://6637daed288fedf6938184f2.mockapi.io/amawbuild-tracking
   NOTE: 'remaining_stock' field removed across UI and exports.
*/
const API_BASE = 'https://6637daed288fedf6938184f2.mockapi.io/amawbuild-tracking';

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

async function apiGet(path = '') { const res = await fetch(API_BASE + path); if (!res.ok) throw new Error('API GET failed: ' + res.status); return res.json(); }
async function apiPost(data) { const res = await fetch(API_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!res.ok) throw new Error('API POST failed: ' + res.status); return res.json(); }
async function apiPut(id, data) { const res = await fetch(API_BASE + '/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!res.ok) throw new Error('API PUT failed: ' + res.status); return res.json(); }
async function apiDelete(id) { const res = await fetch(API_BASE + '/' + encodeURIComponent(id), { method: 'DELETE' }); if (!res.ok) throw new Error('API DELETE failed: ' + res.status); return res.json(); }

function showAlert(message, type = 'success', timeout = 3000) {
    const ph = qs('#alert-placeholder');
    const el = document.createElement('div');
    el.className = `alert alert-${type} alert-fixed`;
    el.textContent = message;
    ph.appendChild(el);
    setTimeout(() => el.remove(), timeout);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); }

// Render list (no remaining_stock column)
async function renderList() {
    const tbody = qs('#entries-table tbody');
    tbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
    try {
        const items = await apiGet('');
        if (!Array.isArray(items) || items.length === 0) { tbody.innerHTML = '<tr><td colspan="7">No entries yet.</td></tr>'; return; }
        tbody.innerHTML = '';
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
        items.forEach(it => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${it.date || ''}</td>
                <td>${escapeHtml(it.material_name || '')}</td>
                <td>${it.quantity_used || ''}</td>
                <td>${escapeHtml(it.unit || '')}</td>
                <td>${escapeHtml(it.stage || '')}</td>
                <td>${escapeHtml(it.supervisor || '')}</td>
                <td><a class="btn btn-sm btn-primary" href="detail.html?id=${it.id}">View/Edit</a></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan="7">Error loading: ${e.message}</td></tr>`; console.error(e); }
}

// Export CSV without remaining_stock
async function exportToCsv() {
    try {
        const items = await apiGet('');
        if (!Array.isArray(items) || items.length === 0) { showAlert('No data to export', 'warning'); return; }
        const cols = ['id', 'date', 'material_name', 'quantity_used', 'unit', 'stage', 'task_description', 'supervisor', 'remark'];
        const rows = [cols.join(',')];
        items.forEach(it => {
            const vals = cols.map(c => {
                let v = it[c] ?? '';
                v = String(v).replace(/"/g, '""');
                if (v.search(/[,"\n]/) >= 0) v = '"' + v + '"';
                return v;
            });
            rows.push(vals.join(','));
        });
        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'amawbuild-export-' + (new Date().toISOString().slice(0, 10)) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { showAlert('Export failed: ' + e.message, 'danger'); }
}

// Detail page handlers
async function initDetailPage() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const action = params.get('action');
    const form = qs('#entry-form');
    const deleteBtn = qs('#delete-btn');
    const title = qs('#form-title');

    if (id) { title.textContent = 'Edit Entry'; deleteBtn.classList.remove('d-none'); try { const data = await apiGet('/' + id); populateForm(data); } catch (e) { showAlert('Failed to fetch entry: ' + e.message, 'danger'); } }
    else if (action === 'new') { title.textContent = 'New Entry'; } else { title.textContent = 'New Entry'; }

    form.addEventListener('submit', async (ev) => { ev.preventDefault(); const values = getFormValues(form); try { if (values.id) { await apiPut(values.id, values); showAlert('Updated successfully'); } else { await apiPost(values); showAlert('Created successfully'); } setTimeout(() => location.href = 'index.html', 800); } catch (e) { showAlert('Save failed: ' + e.message, 'danger'); } });

    deleteBtn.addEventListener('click', async () => { const idv = qs('#id').value; if (!idv) return; if (!confirm('Delete this entry?')) return; try { await apiDelete(idv); showAlert('Deleted'); setTimeout(() => location.href = 'index.html', 600); } catch (e) { showAlert('Delete failed: ' + e.message, 'danger'); } });
}

function populateForm(data) {
    ['id', 'date', 'material_name', 'quantity_used', 'unit', 'stage', 'task_description', 'supervisor', 'remark'].forEach(k => { const el = qs('#' + k); if (!el) return; el.value = data[k] ?? ''; });
}

function getFormValues(form) { const fd = new FormData(form); const out = {}; for (const [k, v] of fd.entries()) out[k] = v; if (out.quantity_used === '') delete out.quantity_used; else out.quantity_used = parseFloat(out.quantity_used); return out; }

// Summary handles (aggregate) - ignoring remaining_stock
async function initSummaryPage() { const btn = qs('#compute-week'); const input = qs('#week-start'); const out = qs('#summary-results'); btn.addEventListener('click', async () => { const start = input.value; if (!start) { showAlert('Pick a week start date', 'warning'); return; } const startDt = new Date(start); const endDt = new Date(startDt); endDt.setDate(startDt.getDate() + 6); out.innerHTML = '<p>Loading...</p>'; try { const items = await apiGet(''); const filtered = items.filter(it => { if (!it.date) return false; const d = new Date(it.date); return d >= startDt && d <= endDt; }); if (filtered.length === 0) { out.innerHTML = '<p>No entries for that week.</p>'; return; } const map = {}; filtered.forEach(it => { const key = (it.material_name || '') + '||' + (it.unit || ''); if (!map[key]) map[key] = { material_name: it.material_name || '', unit: it.unit || '', total_used: 0, entries: [] }; map[key].total_used += parseFloat(it.quantity_used || 0); map[key].entries.push(it); }); let html = '<div class="table-responsive"><table class="table table-bordered"><thead><tr><th>Material</th><th>Unit</th><th>Total Used</th><th>Entries</th></tr></thead><tbody>'; Object.values(map).forEach(g => { html += `<tr><td>${escapeHtml(g.material_name)}</td><td>${escapeHtml(g.unit)}</td><td>${g.total_used}</td><td>${g.entries.length}</td></tr>`; }); html += '</tbody></table></div>'; out.innerHTML = html; } catch (e) { out.innerHTML = '<p class="text-danger">Error: ' + e.message + '</p>'; } }); }

// Router
window.addEventListener('DOMContentLoaded', () => {
    const path = location.pathname.replace(/^.*\\/, '');
    if (path === '' || path.endsWith('index.html')) { renderList(); const exportBtn = qs('#export-btn'); if (exportBtn) exportBtn.addEventListener('click', exportToCsv); }
    else if (path.endsWith('detail.html')) initDetailPage();
    else if (path.endsWith('summary.html')) initSummaryPage();
    else if (path.endsWith('dashboard.html')) initDashboardPage();
});

window._amaw = { apiGet, apiPost, apiPut, apiDelete };

// Dashboard initializer
async function initDashboardPage() {
    try {
        const items = await apiGet('');
        const total = items.length;
        qs('#card-total-entries').textContent = total;
        const materials = new Set(items.map(i => i.material_name).filter(Boolean));
        qs('#card-materials').textContent = materials.size;
        const supervisors = new Set(items.map(i => i.supervisor).filter(Boolean));
        qs('#card-supervisors').textContent = supervisors.size;

        // this week count
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday as start
        startOfWeek.setHours(0, 0, 0, 0);
        const weekCount = items.filter(it => { if (!it.date) return false; const d = new Date(it.date); return d >= startOfWeek; }).length;
        qs('#card-week').textContent = weekCount;

        // recent entries
        const recent = items.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
        const recentList = qs('#recent-list'); recentList.innerHTML = '';
        recent.forEach(it => { const el = document.createElement('a'); el.className = 'list-group-item list-group-item-action'; el.href = `detail.html?id=${it.id}`; el.innerHTML = `<div class="d-flex w-100 justify-content-between"><h5 class="mb-1">${escapeHtml(it.material_name || '')}</h5><small>${it.date || ''}</small></div><p class="mb-1">${escapeHtml(it.task_description || '')}</p><small>Qty: ${it.quantity_used || ''} ${escapeHtml(it.unit || '')} — ${escapeHtml(it.supervisor || '')}</small>`; recentList.appendChild(el); });

        // top materials
        const matMap = {};
        items.forEach(it => { const key = it.material_name || 'Unknown'; matMap[key] = (matMap[key] || 0) + parseFloat(it.quantity_used || 0); });
        const top = Object.entries(matMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const topEl = qs('#top-materials'); topEl.innerHTML = '';
        top.forEach(([mat, total]) => { const e = document.createElement('div'); e.className = 'list-group-item'; e.textContent = `${mat} — ${total}`; topEl.appendChild(e); });
    } catch (e) { showAlert('Dashboard load failed: ' + e.message, 'danger'); }
}
