/* =====================================================================
   Shared logic for Purchase > Material Request / Service Request.
   Each page defines window.PR_CONFIG (see the <script> block in the page)
   with the bits that differ between Material and Service:
     kind, itemWord, classification, catalog, history, lineChecklists
   Everything else (budgets, vendors, checklists, grid, rich text ...) lives here.
   ===================================================================== */
(function () {
    'use strict';
    const CFG = window.PR_CONFIG;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtINR = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const nowStamp = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    /* ---------------------------------------------------------------
       Reference data (mock - in the real system these come from SAP)
       --------------------------------------------------------------- */
    const USER = { name: 'R. Venkatesh', id: 'EMP10234', dept: 'Engineering & Maintenance' };

    const PURCHASE_GROUPS = {
        'Asset': ['PG-01 Engineering', 'PG-03 Quality / Lab', 'PG-05 IT & Infrastructure', 'PG-06 Facilities'],
        'Non-Asset': ['PG-02 Production', 'PG-03 Quality / Lab', 'PG-04 Admin & Housekeeping', 'PG-06 Facilities']
    };

    // Asset PR -> CAPEX only. Non-Asset PR -> OPEX only.
    const BUDGET_TYPE_BY_PR = { 'Asset': 'CAPEX', 'Non-Asset': 'OPEX' };
    const BUDGET_TYPE_LABEL = { 'CAPEX': 'CAPEX (Capital)', 'OPEX': 'OPEX (Revenue)' };

    // Budget master - each Ref Budget ID belongs to a department and carries its
    // Internal Order No / SAP Budget Number, which bind automatically on selection.
    const BUDGETS = [
        { id: 'ML11BEF0001', type: 'CAPEX', dept: 'Engineering & Maintenance', available: 500000, io: 'IO-2026-0031', sap: 'SAP-CAPEX-ENG-01' },
        { id: 'ML11BEF0002', type: 'CAPEX', dept: 'Engineering & Maintenance', available: 250000, io: 'IO-2026-0032', sap: 'SAP-CAPEX-ENG-02' },
        { id: 'ML11BEF0003', type: 'CAPEX', dept: 'Production', available: 750000, io: 'IO-2026-0033', sap: 'SAP-CAPEX-PRD-01' },
        { id: 'ML11BEF0004', type: 'CAPEX', dept: 'Quality Control', available: 300000, io: 'IO-2026-0034', sap: 'SAP-CAPEX-QC-01' },
        { id: 'ML11BEF0101', type: 'OPEX', dept: 'Engineering & Maintenance', available: 140000, io: 'IO-2026-0101', sap: 'SAP-OPEX-ENG-01' },
        { id: 'ML11BEF0102', type: 'OPEX', dept: 'Quality Assurance', available: 95000, io: 'IO-2026-0102', sap: 'SAP-OPEX-QA-01' },
        { id: 'ML11BEF0103', type: 'OPEX', dept: 'Engineering & Maintenance', available: 60000, io: 'IO-2026-0103', sap: 'SAP-OPEX-ENG-02' },
        { id: 'ML11BEF0104', type: 'OPEX', dept: 'Production', available: 120000, io: 'IO-2026-0104', sap: 'SAP-OPEX-PRD-01' }
    ];

    const DEPARTMENTS = ['Engineering & Maintenance', 'Production', 'Quality Assurance', 'Quality Control', 'IT & Infrastructure',
        'Stores & Warehouse', 'Administration', 'Projects', 'R&D / Formulation Development'];

    const VENDORS = [ // SAP vendor master
        { code: '100234', name: 'Shimadzu Analytical (India) Pvt Ltd' },
        { code: '100587', name: 'Sigma-Aldrich (Merck Life Science)' },
        { code: '100912', name: 'Sri Balaji Engineering Works' },
        { code: '101145', name: 'Kirloskar Electric Company Ltd' },
        { code: '101302', name: 'Chennai Lubricants & Allied Products' },
        { code: '101478', name: 'Rajesh Tools & Dies' },
        { code: '101655', name: 'Apex Power Systems Pvt Ltd' },
        { code: '101821', name: 'Labindia Instruments Pvt Ltd' },
        { code: '102006', name: 'National Office Solutions' },
        { code: '102218', name: 'Thermax Service & Maintenance' }
    ];

    const ASSET_CODES = [ // SAP asset master
        'AST-00456 – HPLC Machine (QC Lab)', 'AST-00457 – HPLC Machine (R&D)', 'AST-00512 – Centrifugal Pump Motor (Utility)',
        'AST-00640 – UPS System (Server Room)', 'AST-00701 – Analytical Balance (QC)', 'AST-00788 – Tablet Compression Machine (Line 2)',
        'AST-00815 – Dissolution Apparatus (QC)'
    ];

    const STORAGE_AREAS = [ // SAP storage areas
        'SL01 – Main Store', 'SL02 – Engineering Store', 'SL03 – QC Lab Store', 'SL04 – Production Store'
    ];

    const QMS_TYPES = ['Change Control', 'Deviation', 'CAPA'];

    // Header checklists: Type -> GxP (Yes/No) -> checklist names. GxP = Yes has a different set.
    const HEADER_CHECKLISTS = {
        'Purchase Group': {
            'Yes': ['Quality & Procurement Compliance Verification', 'GxP Impact Assessment Checklist'],
            'No': ['Purchase Requisition Compliance Checklist', 'Budget & Vendor Verification Checklist']
        }
    };
    const HEADER_TASKS = {
        'Quality & Procurement Compliance Verification': [
            'Vendor qualification status verified', 'Quotation compared against at least 2 vendors', 'Technical specification matches requirement'],
        'GxP Impact Assessment Checklist': [
            'GxP impact of the requirement assessed and documented', 'QA has reviewed the requirement / specification',
            'Applicable QMS record (Change Control / Deviation / CAPA) identified', 'Vendor is on the approved vendor list (AVL)'],
        'Purchase Requisition Compliance Checklist': [
            'Unique item / asset identification confirmed', 'Budget availability verified against request', 'Vendor recommendation supported with justification'],
        'Budget & Vendor Verification Checklist': [
            'Correct budget type and reference selected', 'Budget balance is sufficient for the requested value', 'Preferred vendor exists in the SAP vendor master']
    };
    // Line-item checklists come from the page config: { Yes: {name: [tasks]}, No: {name: [tasks]} }
    // a task is a string, or { task, photo:true } when a photo can be captured (line-level only).

    /* ---------------------------------------------------------------
       Small helpers
       --------------------------------------------------------------- */
    function fillSelect(sel, options, placeholder) {
        sel.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = ''; ph.textContent = placeholder;
        sel.appendChild(ph);
        options.forEach((o) => {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            sel.appendChild(opt);
        });
    }
    const taskText = (t) => (typeof t === 'string' ? t : t.task);

    /* ---------------------------------------------------------------
       Element refs - header
       --------------------------------------------------------------- */
    const prType = $('prType');
    const purchaseGroup = $('purchaseGroup');
    const gxpRelevant = $('gxpRelevant');
    const budgetTypeInp = $('budgetType');
    const classification = $('classification');
    const classificationHint = $('classificationHint');

    const itemsCard = $('itemsCard');
    const itemsLockedNote = $('itemsLockedNote');
    const itemsLockedText = $('itemsLockedText');
    const lineGrid = $('lineGrid');

    const saveDraftBtn = $('saveDraftBtn');
    const saveSubmitBtn = $('saveSubmitBtn');

    /* ---------------------------------------------------------------
       State
       --------------------------------------------------------------- */
    let headerChecklists = []; let hcSeq = 1;
    let lines = []; let seq = 1; let editingId = null;
    const entry = { material: null, vendor: null, history: null, checklist: null };
    let prevPrType = ''; let prevGxp = '';

    /* ---------------------------------------------------------------
       Search-as-you-type dropdown (single floating panel, shared)
       --------------------------------------------------------------- */
    const panel = document.createElement('div');
    panel.className = 'pr-combo-panel';
    document.body.appendChild(panel);
    let activeCombo = null;

    function closePanel() { panel.style.display = 'none'; activeCombo = null; }
    panel.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keep focus in the input
        const o = e.target.closest('[data-i]');
        if (o && activeCombo) activeCombo.choose(activeCombo.list[Number(o.dataset.i)]);
    });
    // Keep the panel attached to its input while the modal / grid scrolls; close it only if the input scrolls out of view.
    window.addEventListener('scroll', (e) => {
        if (!activeCombo || panel.contains(e.target)) return;
        const r = activeCombo.input.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) closePanel();
        else placePanel(activeCombo.input);
    }, true);
    window.addEventListener('resize', closePanel);

    function placePanel(inp) {
        const r = inp.getBoundingClientRect();
        panel.style.minWidth = Math.max(r.width, 340) + 'px';
        panel.style.left = Math.max(4, Math.min(r.left, window.innerWidth - panel.offsetWidth - 8)) + 'px';
        const h = panel.offsetHeight;
        panel.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(4, r.top - h - 2) : r.bottom + 2) + 'px';
    }

    /* cfg: { input, items(), search(item), label(item), pick(item), clear(), current() } */
    function makeCombo(cfg) {
        const inp = cfg.input;
        const combo = { input: inp, list: [], idx: -1, typed: false, choose(item) { if (!item) return; cfg.pick(item); inp.value = cfg.current(); closePanel(); } };

        function highlight(text, q) {
            const safe = esc(text);
            if (!q) return safe;
            const i = text.toLowerCase().indexOf(q);
            if (i < 0) return safe;
            return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
        }
        function render() {
            const q = combo.typed ? inp.value.trim().toLowerCase() : '';
            combo.list = cfg.items().filter((it) => !q || cfg.search(it).includes(q)).slice(0, 60);
            combo.idx = combo.list.length ? 0 : -1;
            panel.innerHTML = combo.list.length
                ? combo.list.map((it, i) => `<div class="opt${i === 0 ? ' active' : ''}" data-i="${i}">${cfg.label(it, (t) => highlight(t, q))}</div>`).join('')
                : '<div class="empty">No matching records</div>';
            panel.style.display = 'block';
            activeCombo = combo;
            placePanel(inp);
        }
        function move(d) {
            if (!combo.list.length) return;
            combo.idx = (combo.idx + d + combo.list.length) % combo.list.length;
            panel.querySelectorAll('.opt').forEach((n, i) => n.classList.toggle('active', i === combo.idx));
            const a = panel.querySelector('.opt.active'); if (a) a.scrollIntoView({ block: 'nearest' });
        }
        inp.addEventListener('focus', () => { combo.typed = false; inp.select(); render(); });
        inp.addEventListener('input', () => { combo.typed = true; render(); });
        inp.addEventListener('click', () => { if (activeCombo !== combo) { combo.typed = false; inp.select(); render(); } }); // re-open when the input already has focus
        inp.addEventListener('keydown', (e) => {
            const open = panel.style.display === 'block' && activeCombo === combo;
            if (e.key === 'ArrowDown') { e.preventDefault(); open ? move(1) : render(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) move(-1); }
            else if (e.key === 'Enter' && open) { e.preventDefault(); combo.choose(combo.list[combo.idx]); }
            else if (e.key === 'Escape' && open) { e.stopPropagation(); closePanel(); }
        });
        inp.addEventListener('blur', () => {
            closePanel();
            if (!inp.value.trim()) cfg.clear(); else inp.value = cfg.current();
        });
        return combo;
    }

    /* ---------------------------------------------------------------
       Rich-text Justification
       --------------------------------------------------------------- */
    const rte = $('justification');
    const rteToolbar = $('rteToolbar');
    rteToolbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    rteToolbar.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-cmd]');
        if (!b) return;
        rte.focus();
        if (b.dataset.cmd === 'createLink') {
            const url = prompt('Enter the link URL (https://…)');
            if (url) document.execCommand('createLink', false, url);
        } else {
            document.execCommand(b.dataset.cmd, false, null);
        }
        syncToolbar(); refreshSaveState();
    });
    function syncToolbar() {
        rteToolbar.querySelectorAll('button[data-state]').forEach((b) => {
            let on = false; try { on = document.queryCommandState(b.dataset.cmd); } catch (_) { /* ignore */ }
            b.classList.toggle('active', on);
        });
    }
    document.addEventListener('selectionchange', () => { if (document.activeElement === rte) syncToolbar(); });
    rte.addEventListener('input', () => { if (!rte.textContent.trim() && !rte.querySelector('li,a')) rte.innerHTML = ''; refreshSaveState(); });
    rte.addEventListener('paste', (e) => { // paste as plain text so no foreign styling sneaks in
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });

    /* ---------------------------------------------------------------
       Header: PR Type / Purchase Group / GxP / Classification
       --------------------------------------------------------------- */
    function headerComplete() { return !!(prType.value && purchaseGroup.value && gxpRelevant.value && classification.value); }

    function updateLock() {
        const ok = headerComplete();
        itemsCard.style.display = ok ? 'block' : 'none';
        itemsLockedNote.style.display = ok ? 'none' : 'flex';
        if (!ok) {
            const miss = [];
            if (!prType.value) miss.push('PR Type');
            if (!purchaseGroup.value) miss.push('Purchase Group');
            if (!gxpRelevant.value) miss.push('GxP Relevant');
            if (!classification.value) miss.push('Classification');
            itemsLockedText.textContent = 'Complete ' + miss.join(', ') + ' in the Header Details tab to add line items.';
        }
    }

    function budgetType() { return BUDGET_TYPE_BY_PR[prType.value] || ''; }

    prType.addEventListener('change', () => {
        if (lines.length && prevPrType && prType.value !== prevPrType) {
            if (!confirm('Changing the PR Type changes the Budget Type (Asset = CAPEX, Non-Asset = OPEX), so the ' + lines.length +
                ' line item(s) already added will be removed. Continue?')) { prType.value = prevPrType; return; }
            lines = []; resetEntry();
        }
        prevPrType = prType.value;

        purchaseGroup.innerHTML = '<option value="">Select PR type first</option>'; purchaseGroup.disabled = true;
        if (prType.value) { fillSelect(purchaseGroup, PURCHASE_GROUPS[prType.value], 'Select purchase group'); purchaseGroup.disabled = false; }

        // Budget type is fixed by the PR type - shown but not editable
        budgetTypeInp.value = budgetType() ? BUDGET_TYPE_LABEL[budgetType()] : '';
        $('itemsBudgetType').value = budgetTypeInp.value;

        // Classification list (Material: same list for Asset and Non-Asset)
        const prevClass = classification.value;
        const conf = CFG.classification[prType.value];
        if (conf) {
            fillSelect(classification, conf.options, 'Select classification');
            classification.disabled = false;
            if (conf.options.includes(prevClass)) classification.value = prevClass;
            else if (conf.options.length === 1) classification.value = conf.options[0];
        } else {
            classification.innerHTML = '<option value="">Select PR type first</option>'; classification.disabled = true;
        }
        onClassificationChange();

        lineGrid.classList.toggle('hide-asset', prType.value !== 'Asset');
        rebuildBudgetOptions();
        renderLines(); updateLock(); refreshSaveState();
    });

    purchaseGroup.addEventListener('change', () => { updateLock(); refreshSaveState(); });

    function onClassificationChange() {
        const conf = CFG.classification[prType.value];
        const hint = conf && conf.hints && conf.hints[classification.value];
        classificationHint.textContent = hint || '';
        classificationHint.style.display = hint ? 'block' : 'none';
    }
    classification.addEventListener('change', () => { onClassificationChange(); updateLock(); refreshSaveState(); });

    gxpRelevant.addEventListener('change', () => {
        const next = gxpRelevant.value;
        const hasWork = headerChecklists.length || entry.checklist || lines.some((l) => l.checklist || l.qmsType);
        if (prevGxp && next !== prevGxp && hasWork) {
            if (!confirm('The checklists and QMS references depend on GxP Relevant. Changing it will clear the checklists already executed ' +
                '(header and line items) and the QMS references. Continue?')) { gxpRelevant.value = prevGxp; return; }
            headerChecklists = [];
            lines.forEach((l) => { l.checklist = null; l.qmsType = ''; l.qmsRef = ''; });
        }
        prevGxp = next;
        entry.checklist = null;
        applyGxp();
    });

    function applyGxp() {
        const gxp = gxpRelevant.value;
        lineGrid.classList.toggle('hide-qms', gxp !== 'Yes');

        // header checklist controls
        const badge = $('checklistSetBadge');
        badge.className = 'pr-set-badge ' + (gxp === 'Yes' ? 'gxp' : 'std');
        badge.textContent = gxp === 'Yes' ? 'GxP checklist set' : (gxp === 'No' ? 'Standard (non-GxP) checklist set' : 'Select GxP Relevant first');
        if (!gxp) badge.className = 'pr-set-badge std';
        checklistType.disabled = !gxp;
        checklistType.value = '';
        refreshChecklistNames();

        // line checklist options
        const names = gxp ? Object.keys(CFG.lineChecklists[gxp]) : [];
        fillSelect(el.chk, names, gxp ? 'Select checklist' : 'Select GxP first');
        el.chk.disabled = !gxp;
        el.qmsType.value = ''; el.qmsRef.value = ''; el.qmsRef.disabled = true;
        updateChecklistCell();

        renderHeaderChecklists(); renderLines(); renderApprovers();
        updateLock(); refreshSaveState();
    }

    /* ---------------------------------------------------------------
       Approvers (driven by GxP Relevant)
       --------------------------------------------------------------- */
    const APPROVAL_LEVELS = {
        'No': [{ role: 'Reporting Manager', name: 'K. Sundaram' }, { role: 'Department Head', name: 'S. Priya' }],
        'Yes': [{ role: 'Reporting Manager', name: 'K. Sundaram' }, { role: 'Department Head', name: 'S. Priya' },
        { role: 'QA / Compliance Approver', name: 'Dr. N. Lakshmi' }, { role: 'Finance Approver', name: 'M. Anand' }, { role: 'Plant Head', name: 'R. Kumaran' }]
    };
    function renderApprovers() {
        const gxp = gxpRelevant.value;
        if (!gxp) { $('approversEmpty').style.display = 'block'; $('approversContent').style.display = 'none'; return; }
        const levels = APPROVAL_LEVELS[gxp];
        $('approversLevelNote').innerHTML = '<i class="bi bi-info-circle me-2 text-primary"></i>' + (gxp === 'Yes'
            ? 'GxP Relevant = Yes — this PR requires ' + levels.length + ' levels of approval, including QA / Compliance sign-off.'
            : 'GxP Relevant = No — this PR requires ' + levels.length + ' levels of approval.');
        $('approversBody').innerHTML = levels.map((l, i) => `
            <tr><td class="fw-bold">${i + 1}</td><td>${l.role}</td><td>${l.name}</td>
            <td><span class="status pending">Pending</span></td><td>—</td></tr>`).join('');
        $('approversEmpty').style.display = 'none'; $('approversContent').style.display = 'block';
    }

    /* ---------------------------------------------------------------
       Checklist execution pop-up (shared by header + line items)
       ctx: { title, sub, tasks:[string|{task,photo}], existing:[{resp,obs,photo}], photo:bool, onSave(record) }
       Executed-by is never typed - it is always the PR initiator.
       --------------------------------------------------------------- */
    const execModalEl = $('checklistExecModal');
    const execModal = new bootstrap.Modal(execModalEl, { backdrop: false });
    let execCtx = null;

    function openChecklist(ctx) {
        execCtx = ctx;
        $('execTitle').textContent = ctx.title;
        $('execSub').textContent = ctx.sub;
        $('execBy').textContent = USER.name + ' (' + USER.id + ')';
        $('execError').classList.add('d-none');
        $('execHead').innerHTML = '<th style="width:6%">S.No</th><th>Task / Instruction</th><th style="width:16%">Response</th>' +
            '<th style="width:30%">Observation</th>' + (ctx.photo ? '<th style="width:20%">Photo</th>' : '');
        $('execBody').innerHTML = ctx.tasks.map((t, i) => {
            const ex = (ctx.existing && ctx.existing[i]) || {};
            const sel = (v) => (ex.resp === v ? ' selected' : '');
            const photoCell = ctx.photo
                ? (t.photo
                    ? `<td><input type="file" accept="image/*" capture="environment" class="form-control form-control-sm ex-photo">` +
                    `${ex.photo ? `<div class="small text-success mt-1"><i class="bi bi-check2"></i> ${esc(ex.photo)}</div>` : ''}</td>`
                    : '<td class="text-muted small">—</td>')
                : '';
            return `<tr data-photo-old="${esc(ex.photo || '')}">
                <td class="text-center fw-bold">${i + 1}</td>
                <td>${esc(taskText(t))}${t.photo ? ' <i class="bi bi-camera text-primary" title="Photo can be captured"></i>' : ''}</td>
                <td><select class="form-select form-select-sm ex-resp"><option value="">Select</option>
                    <option${sel('Yes')}>Yes</option><option${sel('No')}>No</option><option${sel('N/A')}>N/A</option></select></td>
                <td><input type="text" class="form-control form-control-sm ex-obs" placeholder="Enter observation" value="${esc(ex.obs || '')}"></td>
                ${photoCell}</tr>`;
        }).join('');
        execModal.show();
    }

    $('execSaveBtn').addEventListener('click', () => {
        const rows = Array.from($('execBody').querySelectorAll('tr'));
        const items = [];
        for (let i = 0; i < rows.length; i++) {
            const resp = rows[i].querySelector('.ex-resp').value;
            const obs = rows[i].querySelector('.ex-obs').value.trim();
            const fileInp = rows[i].querySelector('.ex-photo');
            const photo = (fileInp && fileInp.files[0]) ? fileInp.files[0].name : rows[i].dataset.photoOld;
            if (!resp) return showExecError('Select a response for task ' + (i + 1) + '.');
            if (resp === 'No' && !obs) return showExecError('Enter an observation for task ' + (i + 1) + ' because the response is "No".');
            items.push({ task: taskText(execCtx.tasks[i]), resp, obs, photo: photo || '' });
        }
        execCtx.onSave({ items, executedBy: USER.name + ' (' + USER.id + ')', executedOn: nowStamp() });
        execModal.hide();
    });
    function showExecError(msg) { const e = $('execError'); e.textContent = msg; e.classList.remove('d-none'); }

    // Stacked-modal housekeeping: keep the PR modal scroll-locked after the pop-up closes
    execModalEl.addEventListener('shown.bs.modal', () => { const s = execModalEl.querySelector('select'); if (s) s.focus(); });
    execModalEl.addEventListener('hidden.bs.modal', () => {
        if (document.querySelector('#workOrderModal.show')) document.body.classList.add('modal-open');
    });

    /* ---------------------------------------------------------------
       Header checklist
       --------------------------------------------------------------- */
    const checklistType = $('checklistType');
    const checklistName = $('checklistName');
    const checklistAddBtn = $('checklistAddBtn');

    function refreshChecklistNames() {
        const names = (checklistType.value && gxpRelevant.value) ? HEADER_CHECKLISTS[checklistType.value][gxpRelevant.value] : [];
        fillSelect(checklistName, names, checklistType.value ? 'Select checklist' : 'Select type first');
        checklistName.disabled = !checklistType.value;
        checklistAddBtn.disabled = true;
    }
    checklistType.addEventListener('change', refreshChecklistNames);
    checklistName.addEventListener('change', () => { checklistAddBtn.disabled = !checklistName.value; });

    checklistAddBtn.addEventListener('click', () => {
        const name = checklistName.value;
        if (!checklistType.value || !name) return;
        if (headerChecklists.some((c) => c.name === name)) { alert('This checklist is already added. Use View / Edit to change its answers.'); return; }
        openChecklist({
            title: name, sub: 'Header checklist · GxP Relevant: ' + gxpRelevant.value,
            tasks: HEADER_TASKS[name], existing: null, photo: false,
            onSave: (rec) => {
                headerChecklists.push({ id: hcSeq++, type: checklistType.value, name, gxp: gxpRelevant.value, ...rec });
                checklistName.value = ''; checklistAddBtn.disabled = true;
                renderHeaderChecklists(); refreshSaveState();
            }
        });
    });

    function renderHeaderChecklists() {
        const body = $('hcBody');
        $('hcEmpty').style.display = headerChecklists.length ? 'none' : 'block';
        $('hcWrap').style.display = headerChecklists.length ? 'block' : 'none';
        body.innerHTML = headerChecklists.map((c, i) => {
            const yes = c.items.filter((x) => x.resp === 'Yes').length;
            return `<tr>
                <td class="text-center fw-bold">${i + 1}</td>
                <td>${esc(c.name)}</td>
                <td>${esc(c.type)}</td>
                <td>${yes} of ${c.items.length} tasks answered "Yes"</td>
                <td><span class="chk-done"><i class="bi bi-check2-circle me-1"></i>Executed</span></td>
                <td class="small text-muted">${esc(c.executedOn)}</td>
                <td class="text-end text-nowrap">
                    <button type="button" class="btn btn-sm btn-outline-primary border-0 hc-view" data-id="${c.id}" title="View / Edit"><i class="bi bi-eye"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger border-0 hc-rm" data-id="${c.id}" title="Remove"><i class="bi bi-trash3"></i></button>
                </td></tr>`;
        }).join('');
    }
    $('hcBody').addEventListener('click', (e) => {
        const v = e.target.closest('.hc-view'), r = e.target.closest('.hc-rm');
        if (v) {
            const c = headerChecklists.find((x) => String(x.id) === v.dataset.id);
            openChecklist({
                title: c.name, sub: 'Header checklist · GxP Relevant: ' + c.gxp, tasks: HEADER_TASKS[c.name], existing: c.items, photo: false,
                onSave: (rec) => { Object.assign(c, rec); renderHeaderChecklists(); }
            });
        } else if (r) {
            if (!confirm('Remove this executed checklist from the request?')) return;
            headerChecklists = headerChecklists.filter((x) => String(x.id) !== r.dataset.id);
            renderHeaderChecklists(); refreshSaveState();
        }
    });

    /* ---------------------------------------------------------------
       Attachments (multiple files, drag & drop)
       --------------------------------------------------------------- */
    const headerAttachment = $('headerAttachment');
    const attachmentList = $('attachmentList');
    const dropZone = $('attachDrop');
    let attachedFiles = [];

    function addFiles(fileList) {
        Array.from(fileList).forEach((f) => {
            if (!attachedFiles.some((a) => a.name === f.name && a.size === f.size)) attachedFiles.push(f);
        });
        renderAttachments();
    }
    function renderAttachments() {
        $('attachCount').textContent = attachedFiles.length ? attachedFiles.length + (attachedFiles.length === 1 ? ' file attached' : ' files attached') : '';
        $('attachClear').style.display = attachedFiles.length > 1 ? 'inline' : 'none';
        if (!attachedFiles.length) { attachmentList.innerHTML = '<li class="list-group-item small text-muted">No files uploaded yet.</li>'; return; }
        attachmentList.innerHTML = attachedFiles.map((f, i) => `
            <li class="list-group-item d-flex justify-content-between align-items-center small">
                <span><i class="bi bi-paperclip me-2 text-primary"></i>${esc(f.name)}</span>
                <span><span class="text-muted me-3">${(f.size / 1024).toFixed(1)} KB</span>
                <button class="btn btn-sm btn-outline-danger border-0 rm-attach" data-idx="${i}" type="button" title="Remove"><i class="bi bi-trash3"></i></button></span>
            </li>`).join('');
    }
    headerAttachment.addEventListener('change', () => { addFiles(headerAttachment.files); headerAttachment.value = ''; });
    dropZone.addEventListener('click', () => headerAttachment.click());
    ['dragenter', 'dragover'].forEach((t) => dropZone.addEventListener(t, (e) => { e.preventDefault(); dropZone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((t) => dropZone.addEventListener(t, (e) => { e.preventDefault(); dropZone.classList.remove('drag'); }));
    dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
    attachmentList.addEventListener('click', (e) => {
        const b = e.target.closest('.rm-attach');
        if (b) { attachedFiles.splice(Number(b.dataset.idx), 1); renderAttachments(); }
    });
    $('attachClear').addEventListener('click', () => { attachedFiles = []; renderAttachments(); });

    /* ---------------------------------------------------------------
       Line items - single-line entry row
       --------------------------------------------------------------- */
    const el = {
        group: $('itemGroup'), code: $('itemCode'), desc: $('itemDesc'), qty: $('itemQty'), uom: $('itemUom'),
        ptype: $('itemPurchaseType'), price: $('itemPrice'), per: $('itemPer'), total: $('itemTotal'), vendor: $('itemVendor'),
        budget: $('itemBudgetRef'), io: $('itemIntOrder'), bal: $('itemBalance'), storage: $('itemStorage'),
        delivery: $('itemDelivery'), useDept: $('itemUseDept'), asset: $('itemAssetCode'),
        qmsType: $('itemQmsType'), qmsRef: $('itemQmsRef'), chk: $('itemChecklist'), chkBtn: $('itemChecklistBtn'),
        chkStatus: $('itemChecklistStatus'), add: $('addLineBtn'), cancel: $('cancelEditBtn'), row: $('entryRow')
    };

    // static dropdowns
    fillSelect(el.group, Array.from(new Set(CFG.catalog.map((m) => m.group))), 'Select group');
    fillSelect(el.storage, STORAGE_AREAS, 'Select');
    fillSelect(el.useDept, DEPARTMENTS, 'Select');
    fillSelect(el.asset, ASSET_CODES, 'Select');
    fillSelect(el.qmsType, QMS_TYPES, 'Select');
    el.chk.innerHTML = '<option value="">Select GxP first</option>'; el.chk.disabled = true;
    el.delivery.min = new Date().toISOString().slice(0, 10);

    const vendorByCode = (c) => VENDORS.find((v) => v.code === c) || null;
    const vendorText = (v) => v ? v.code + ' – ' + v.name : '';

    /* -- Material group -> code (type to search by code or description) -- */
    el.group.addEventListener('change', () => {
        setMaterial(null);
        el.code.disabled = !el.group.value;
        el.code.placeholder = el.group.value ? 'Type code or description…' : 'Select group first';
    });

    makeCombo({
        input: el.code,
        items: () => CFG.catalog.filter((m) => m.group === el.group.value),
        search: (m) => (m.code + ' ' + m.desc).toLowerCase(),
        label: (m, hl) => `<b>${hl(m.code)}</b> — ${hl(m.desc)} <span class="text-muted">· ${esc(m.uom)}</span>`,
        pick: (m) => setMaterial(m),
        clear: () => setMaterial(null),
        current: () => (entry.material ? entry.material.code : '')
    });

    /* -- SAP vendor master (searchable) -- */
    makeCombo({
        input: el.vendor,
        items: () => VENDORS,
        search: (v) => (v.code + ' ' + v.name).toLowerCase(),
        label: (v, hl) => `<b>${hl(v.code)}</b> — ${hl(v.name)}`,
        pick: (v) => { entry.vendor = v; },
        clear: () => { entry.vendor = null; },
        current: () => vendorText(entry.vendor)
    });

    /* Choosing a material decides First vs Repeat purchase automatically:
       Repeat  -> approx. price (and vendor) come from the previous PR; price is locked.
       First   -> nothing to fetch, so the user enters the approx. price. */
    function setMaterial(m, restoreLine) {
        entry.material = m;
        el.code.value = m ? m.code : '';
        el.desc.value = m ? m.desc : '';
        el.uom.value = m ? m.uom : '';
        const h = m ? (CFG.history[m.code] || null) : null;
        entry.history = h;

        if (!m) {
            el.ptype.innerHTML = '<span class="text-muted">—</span>';
            setPriceLocked(false); el.price.value = ''; el.per.value = 1;
        } else if (h) {
            el.ptype.innerHTML = `<span class="pt-badge repeat"><i class="bi bi-arrow-repeat me-1"></i>Repeat Purchase</span>` +
                `<div class="small text-muted mt-1">Last: ${esc(h.pr)} · ${esc(h.date)}</div>`;
            setPriceLocked(true); el.price.value = h.price; el.per.value = h.per;
            entry.vendor = vendorByCode(h.vendor); el.vendor.value = vendorText(entry.vendor);
        } else {
            el.ptype.innerHTML = `<span class="pt-badge first"><i class="bi bi-1-circle me-1"></i>First Purchase</span>` +
                `<div class="small text-muted mt-1">No earlier PR — enter value</div>`;
            setPriceLocked(false); el.price.value = ''; el.per.value = 1;
        }
        if (restoreLine) { // editing an added line: bring back exactly what was saved
            if (!h) { el.price.value = restoreLine.price; el.per.value = restoreLine.per; }
            entry.vendor = vendorByCode(restoreLine.vendorCode); el.vendor.value = vendorText(entry.vendor);
        }
        calcTotal(); updateBudgetCells();
    }
    function setPriceLocked(on) {
        el.price.readOnly = on; el.per.readOnly = on;
        el.price.classList.toggle('bg-light', on); el.per.classList.toggle('bg-light', on);
        el.price.title = on ? 'Fetched from the previous PR' : '';
        el.price.placeholder = on ? '' : 'Enter value';
    }

    function lineTotal(qty, price, per) { return (Number(qty) || 0) * (Number(price) || 0) / (Number(per) || 1); }
    function calcTotal() {
        el.total.value = fmtINR(lineTotal(el.qty.value, el.price.value, el.per.value));
        updateBudgetCells();
    }
    ['input', 'change'].forEach((ev) => { el.qty.addEventListener(ev, calcTotal); el.price.addEventListener(ev, calcTotal); el.per.addEventListener(ev, calcTotal); });

    /* -- Budget: per line, filtered by budget type (from PR type) and the user's department -- */
    function budgetOptionsForPr() { return BUDGETS.filter((b) => b.type === budgetType() && b.dept === USER.dept); }
    function rebuildBudgetOptions() {
        const keep = el.budget.value;
        const opts = budgetOptionsForPr();
        el.budget.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = ''; ph.textContent = !budgetType() ? 'Select PR type first' : (opts.length ? 'Select budget' : 'No budget for dept');
        el.budget.appendChild(ph);
        opts.forEach((b) => { const o = document.createElement('option'); o.value = b.id; o.textContent = b.id; el.budget.appendChild(o); });
        el.budget.disabled = !opts.length;
        if (opts.some((b) => b.id === keep)) el.budget.value = keep;
        updateBudgetCells();
    }
    const budgetById = (id) => BUDGETS.find((b) => b.id === id) || null;
    function consumed(refId, excludeId) {
        return lines.filter((l) => l.budgetRef === refId && l.id !== excludeId).reduce((s, l) => s + l.total, 0);
    }
    function updateBudgetCells() {
        const b = budgetById(el.budget.value);
        el.io.value = b ? b.io + ' / ' + b.sap : '';
        if (!b) { el.bal.innerHTML = '<span class="text-muted">Auto</span>'; el.bal.classList.remove('over'); return; }
        const bal = b.available - consumed(b.id, editingId);
        const over = lineTotal(el.qty.value, el.price.value, el.per.value) > bal;
        el.bal.classList.toggle('over', over);
        el.bal.innerHTML = fmtINR(bal) + '<small>of ' + fmtINR(b.available) + (over ? ' · exceeds balance' : '') + '</small>';
    }
    el.budget.addEventListener('change', updateBudgetCells);

    /* -- QMS reference (GxP = Yes) -- */
    el.qmsType.addEventListener('change', () => {
        el.qmsRef.disabled = !el.qmsType.value;
        el.qmsRef.value = '';
        el.qmsRef.placeholder = el.qmsType.value ? el.qmsType.value + ' No.' : 'Select type first';
        if (el.qmsType.value) el.qmsRef.focus();
    });

    /* -- Line-item checklist -- */
    function lineChecklistTasks(name) { return CFG.lineChecklists[gxpRelevant.value][name]; }
    function updateChecklistCell() {
        el.chkBtn.disabled = !el.chk.value;
        el.chkStatus.innerHTML = entry.checklist
            ? '<span class="chk-done"><i class="bi bi-check2-circle me-1"></i>Executed</span>'
            : (el.chk.value ? '<span class="chk-pend">Not executed</span>' : '');
    }
    el.chk.addEventListener('change', () => { entry.checklist = null; updateChecklistCell(); });
    el.chkBtn.addEventListener('click', () => {
        const name = el.chk.value; if (!name) return;
        const label = entry.material ? entry.material.code : 'new line';
        openChecklist({
            title: name, sub: CFG.itemWord + ' line checklist (' + label + ') · GxP Relevant: ' + gxpRelevant.value,
            tasks: lineChecklistTasks(name),
            existing: entry.checklist && entry.checklist.name === name ? entry.checklist.items : null, photo: true,
            onSave: (rec) => { entry.checklist = { name, ...rec }; updateChecklistCell(); }
        });
    });

    /* -- validation + add / update -- */
    function showLineError(msg, focusEl) {
        const e = $('lineError'); e.textContent = msg; e.classList.remove('d-none');
        if (focusEl) focusEl.focus();
    }
    function clearLineError() { $('lineError').classList.add('d-none'); }

    function submitLine() {
        clearLineError();
        const w = CFG.itemWord;
        const m = entry.material;
        const gxp = gxpRelevant.value;
        const total = lineTotal(el.qty.value, el.price.value, el.per.value);
        const b = budgetById(el.budget.value);

        if (!el.group.value) return showLineError('Select a ' + w + ' Group.', el.group);
        if (!m) return showLineError('Select a ' + w + ' Code (type to search by code or description).', el.code);
        if (!(Number(el.qty.value) > 0)) return showLineError('Enter a quantity greater than zero.', el.qty);
        if (!entry.history && !(Number(el.price.value) > 0)) return showLineError('This is a first purchase — enter the approximate price.', el.price);
        if (!b) return showLineError('Select a Budget Reference ID for this line.', el.budget);
        if (!el.storage.value) return showLineError('Select a Storage Area.', el.storage);
        if (!el.delivery.value) return showLineError('Enter the Required By date.', el.delivery);
        if (!el.useDept.value) return showLineError('Select the Utilizing / Usage department.', el.useDept);
        if (prType.value === 'Asset' && !el.asset.value) return showLineError('Select the Asset Code (SAP) — mandatory for Asset requests.', el.asset);
        if (gxp === 'Yes') {
            if (!el.qmsType.value) return showLineError('GxP Relevant = Yes: select a QMS Reference type.', el.qmsType);
            if (!el.qmsRef.value.trim()) return showLineError('Enter the ' + el.qmsType.value + ' reference number.', el.qmsRef);
        }
        if (el.chk.value && !entry.checklist) return showLineError('Execute the selected line checklist before adding the line.', el.chkBtn);
        const bal = b.available - consumed(b.id, editingId);
        if (total > bal) return showLineError('This line (' + fmtINR(total) + ') exceeds the balance available on ' + b.id + ' (' + fmtINR(bal) + ').', el.budget);

        const rec = {
            group: el.group.value, matCode: m.code, desc: m.desc, uom: m.uom, qty: Number(el.qty.value),
            purchaseType: entry.history ? 'Repeat Purchase' : 'First Purchase', prevPr: entry.history ? entry.history.pr : '',
            price: Number(el.price.value), per: Number(el.per.value) || 1, total,
            vendorCode: entry.vendor ? entry.vendor.code : '', vendorName: entry.vendor ? entry.vendor.name : '',
            budgetRef: b.id, io: b.io, sap: b.sap,
            storage: el.storage.value, delivery: el.delivery.value, useDept: el.useDept.value,
            assetCode: prType.value === 'Asset' ? el.asset.value : '',
            qmsType: gxp === 'Yes' ? el.qmsType.value : '', qmsRef: gxp === 'Yes' ? el.qmsRef.value.trim() : '',
            checklist: el.chk.value ? entry.checklist : null
        };
        if (editingId) lines = lines.map((l) => (l.id === editingId ? { ...rec, id: editingId } : l));
        else lines.push({ ...rec, id: seq++ });
        const keepBudget = el.budget.value;
        resetEntry();
        el.budget.value = keepBudget; updateBudgetCells();
        renderLines();
    }
    el.add.addEventListener('click', submitLine);
    el.cancel.addEventListener('click', () => { clearLineError(); resetEntry(); renderLines(); });

    function resetEntry() {
        editingId = null;
        el.group.value = ''; el.code.disabled = true; el.code.placeholder = 'Select group first';
        entry.vendor = null; el.vendor.value = '';
        setMaterial(null);
        el.qty.value = 1;
        el.budget.value = ''; el.storage.value = ''; el.delivery.value = ''; el.useDept.value = ''; el.asset.value = '';
        el.qmsType.value = ''; el.qmsRef.value = ''; el.qmsRef.disabled = true; el.qmsRef.placeholder = 'Select type first';
        el.chk.value = ''; entry.checklist = null; updateChecklistCell();
        calcTotal(); updateBudgetCells();
        el.add.innerHTML = '<i class="bi bi-plus-lg me-1"></i>Add';
        el.cancel.style.display = 'none';
        el.row.classList.remove('editing-row');
    }

    function startEdit(id) {
        const l = lines.find((x) => x.id === id); if (!l) return;
        clearLineError();
        resetEntry();
        editingId = id;
        el.group.value = l.group; el.code.disabled = false;
        setMaterial(CFG.catalog.find((m) => m.code === l.matCode), l);
        el.qty.value = l.qty; calcTotal();
        el.budget.value = l.budgetRef; updateBudgetCells();
        el.storage.value = l.storage; el.delivery.value = l.delivery; el.useDept.value = l.useDept; el.asset.value = l.assetCode;
        el.qmsType.value = l.qmsType; el.qmsRef.disabled = !l.qmsType; el.qmsRef.value = l.qmsRef;
        el.chk.value = l.checklist ? l.checklist.name : ''; entry.checklist = l.checklist; updateChecklistCell();
        el.add.innerHTML = '<i class="bi bi-check2 me-1"></i>Update';
        el.cancel.style.display = 'inline-block';
        el.row.classList.add('editing-row');
        renderLines();
        $('lineGridWrap').scrollLeft = 0;
        el.row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /* -- table body -- */
    function renderLines() {
        $('emptyNote').style.display = lines.length ? 'none' : 'block';
        $('linesBody').innerHTML = lines.map((l, i) => `
            <tr${l.id === editingId ? ' class="editing-row"' : ''}>
                <td class="fw-bold text-center">${i + 1}</td>
                <td>${esc(l.group)}</td>
                <td class="fw-bold">${esc(l.matCode)}</td>
                <td>${esc(l.desc)}</td>
                <td>${l.qty}</td>
                <td>${esc(l.uom)}</td>
                <td><span class="pt-badge ${l.purchaseType === 'Repeat Purchase' ? 'repeat' : 'first'}">${l.purchaseType}</span>${l.prevPr ? `<div class="small text-muted">${esc(l.prevPr)}</div>` : ''}</td>
                <td class="text-end">${fmtINR(l.price)}</td>
                <td>${l.per}</td>
                <td class="text-end fw-bold text-primary">${fmtINR(l.total)}</td>
                <td>${l.vendorCode ? `<div class="fw-semibold">${esc(l.vendorName)}</div><div class="small text-muted">${esc(l.vendorCode)}</div>` : '<span class="text-muted">—</span>'}</td>
                <td class="fw-bold">${esc(l.budgetRef)}</td>
                <td class="small">${esc(l.io)} / ${esc(l.sap)}</td>
                <td class="text-end small">${fmtINR((budgetById(l.budgetRef).available) - consumed(l.budgetRef))}</td>
                <td>${esc(l.storage)}</td>
                <td>${fmtDate(l.delivery)}</td>
                <td>${esc(l.useDept)}</td>
                <td class="col-asset">${esc(l.assetCode) || '—'}</td>
                <td class="col-qms">${esc(l.qmsType) || '—'}</td>
                <td class="col-qms">${esc(l.qmsRef) || '—'}</td>
                <td>${l.checklist
                ? `<div class="small fw-semibold">${esc(l.checklist.name)}</div><span class="chk-done"><i class="bi bi-check2-circle me-1"></i>Executed</span>
                       <button type="button" class="btn btn-link btn-sm p-0 ms-1 ln-chk" data-id="${l.id}">View</button>`
                : '<span class="text-muted">—</span>'}</td>
                <td class="sticky-r text-center text-nowrap">
                    <button type="button" class="btn btn-outline-primary btn-sm border-0 ln-edit" data-id="${l.id}" title="Edit"><i class="bi bi-pencil-square"></i></button>
                    <button type="button" class="btn btn-outline-danger btn-sm border-0 ln-del" data-id="${l.id}" title="Delete"><i class="bi bi-trash3"></i></button>
                </td>
            </tr>`).join('');

        const count = lines.length;
        const sum = lines.reduce((s, l) => s + l.total, 0);
        $('footerLineCount').textContent = count + (count === 1 ? ' line item' : ' line items') + ' · Total ' + fmtINR(sum);
        $('prTotal').textContent = 'Total: ' + fmtINR(sum);
        updateBudgetCells();
        refreshSaveState();
    }

    $('linesBody').addEventListener('click', (e) => {
        const ed = e.target.closest('.ln-edit'), del = e.target.closest('.ln-del'), chk = e.target.closest('.ln-chk');
        if (ed) startEdit(Number(ed.dataset.id));
        else if (del) {
            if (!confirm('Delete this line item?')) return;
            const id = Number(del.dataset.id);
            if (id === editingId) resetEntry();
            lines = lines.filter((l) => l.id !== id);
            renderLines();
        } else if (chk) {
            const l = lines.find((x) => x.id === Number(chk.dataset.id));
            openChecklist({
                title: l.checklist.name, sub: CFG.itemWord + ' line checklist (' + l.matCode + ') · GxP Relevant: ' + gxpRelevant.value,
                tasks: lineChecklistTasks(l.checklist.name), existing: l.checklist.items, photo: true,
                onSave: (rec) => { l.checklist = { name: l.checklist.name, ...rec }; if (editingId === l.id) entry.checklist = l.checklist; renderLines(); }
            });
        }
    });

    /* ---------------------------------------------------------------
       Save / submit
       --------------------------------------------------------------- */
    function refreshSaveState() {
        const justified = rte.textContent.trim().length > 0;
        saveSubmitBtn.disabled = !(headerComplete() && justified && lines.length > 0);
    }
    saveDraftBtn.addEventListener('click', () => {
        alert('Requisition ' + $('prNo').textContent + ' saved as draft');
        bootstrap.Modal.getInstance($('workOrderModal'))?.hide();
    });
    saveSubmitBtn.addEventListener('click', () => {
        alert('Requisition ' + $('prNo').textContent + ' saved and submitted for multi-level approval');
        bootstrap.Modal.getInstance($('workOrderModal'))?.hide();
    });

    /* ---------------------------------------------------------------
       Initial state
       --------------------------------------------------------------- */
    resetEntry();
    renderAttachments();
    renderHeaderChecklists();
    updateLock();
    refreshSaveState();
})();
