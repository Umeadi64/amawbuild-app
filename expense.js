const EXP_API = 'https://6637daed288fedf6938184f2.mockapi.io/amawbuild_expense';

function q(sel) { return document.querySelector(sel); }

function show(msg, type = 'success') {
    const ph = q('#alert-placeholder');
    const el = document.createElement('div'); el.className = `alert alert-${type}`; el.textContent = msg; ph.appendChild(el); setTimeout(() => el.remove(), 3000);
}

function calcTotal() {
    const qty = parseFloat(q('#quantity').value) || 0;
    const unit = parseFloat(q('#unitcost').value) || 0;
    q('#totalcost').value = (qty * unit) || '';
}

document.addEventListener('DOMContentLoaded', () => {
    // common handlers
    if (q('#quantity')) q('#quantity').addEventListener('input', calcTotal);
    if (q('#unitcost')) q('#unitcost').addEventListener('input', calcTotal);

    // Expense entry form
    if (q('#expense-form')) {
        const form = q('#expense-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                item: q('#item').value,
                quantity: parseFloat(q('#quantity').value) || 0,
                stage: q('#stage').value,
                unitcost: parseFloat(q('#unitcost').value) || 0,
                totalcost: parseFloat(q('#totalcost').value) || 0,
                date: q('#date').value
            };
            try {
                const res = await fetch(EXP_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Save failed ' + res.status);
                show('Expense saved');
                form.reset(); q('#totalcost').value = '';
            } catch (err) { show(err.message, 'danger'); }
        });
    }

    // Expense list page
    if (q('#expenses-table')) {
        (async function loadList() {
            try {
                const res = await fetch(EXP_API); if (!res.ok) throw new Error('Fetch failed');
                const items = await res.json();
                const tbody = q('#expenses-table tbody'); tbody.innerHTML = '';
                items.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(it => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${it.date || ''}</td><td>${escape(it.item || '')}</td><td>${it.quantity || ''}</td><td>${it.unitcost || ''}</td><td>${it.totalcost || ''}</td><td>${escape(it.stage || '')}</td><td><a class="btn btn-sm btn-primary" href="expense_detail.html?id=${it.id}">View/Edit</a></td>`;
                    tbody.appendChild(tr);
                });
            } catch (e) { show('Load failed: ' + e.message, 'danger'); }
        })();
    }

    // Expense detail page
    if (q('#expense-detail-form')) {
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        const form = q('#expense-detail-form');
        if (id) {
            // fetch and populate
            (async () => {
                try { const res = await fetch(EXP_API + '/' + encodeURIComponent(id)); if (!res.ok) throw new Error('Fetch failed'); const data = await res.json();['id', 'item', 'quantity', 'unitcost', 'totalcost', 'date', 'stage'].forEach(k => { const el = q('#' + k); if (el) el.value = data[k] ?? ''; }); q('#form-title').textContent = 'Edit Expense'; } catch (e) { show('Load failed: ' + e.message, 'danger'); }
            })();
        }

        // calc handlers
        if (q('#quantity')) q('#quantity').addEventListener('input', calcTotal);
        if (q('#unitcost')) q('#unitcost').addEventListener('input', calcTotal);

        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const payload = { item: q('#item').value, quantity: parseFloat(q('#quantity').value) || 0, unitcost: parseFloat(q('#unitcost').value) || 0, totalcost: parseFloat(q('#totalcost').value) || 0, date: q('#date').value, stage: q('#stage').value };
            try { if (id) { const res = await fetch(EXP_API + '/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error('Save failed'); show('Updated'); } else { const res = await fetch(EXP_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error('Save failed'); show('Created'); } } catch (e) { show(e.message, 'danger'); }
        });

        // delete
        const delBtn = q('#delete-expense'); if (delBtn) { delBtn.addEventListener('click', async () => { if (!confirm('Delete this expense?')) return; try { const res = await fetch(EXP_API + '/' + encodeURIComponent(id), { method: 'DELETE' }); if (!res.ok) throw new Error('Delete failed'); show('Deleted'); setTimeout(() => location.href = 'expense_list.html', 600); } catch (e) { show(e.message, 'danger'); } }); }
    }
});

function escape(s) { return String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'); }

