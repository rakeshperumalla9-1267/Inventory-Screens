// =====================================================================
// Budget Category Master (mock data source)
// ---------------------------------------------------------------------
// Single source of truth for budget categories. Both the Budget Category
// Master screen and the Budget Entry line items read from this list, so
// the category dropdown on each line is always driven by the master
// (filtered by that line's Budget Type and Active status).
// In the real app, replace this with an API call, e.g.
//   GET /api/budget-category-master?type=CAPEX&active=true
// =====================================================================
window.BUDGET_CATEGORY_MASTER = [
    // ---------- CAPEX ----------
    { code: 'CPX-PEQ', name: 'Process Equipments', type: 'CAPEX', active: true },
    { code: 'CPX-CIV', name: 'Civil', type: 'CAPEX', active: true },
    { code: 'CPX-HVA', name: 'HVAC', type: 'CAPEX', active: true },
    { code: 'CPX-ELE', name: 'Electrical', type: 'CAPEX', active: true },
    { code: 'CPX-UTL', name: 'Utility', type: 'CAPEX', active: true },
    { code: 'CPX-EHS', name: 'EHS', type: 'CAPEX', active: true },
    { code: 'CPX-DOC', name: 'Documentation', type: 'CAPEX', active: true },

    // ---------- OPEX ----------
    { code: 'OPX-MSS', name: 'Machinery Spares & Service', type: 'OPEX', active: true },
    { code: 'OPX-LAB', name: 'Laboratory Expenses', type: 'OPEX', active: true },
    { code: 'OPX-ADM', name: 'Admin Expenses', type: 'OPEX', active: true },
    { code: 'OPX-ELC', name: 'Electricity', type: 'OPEX', active: true },
    { code: 'OPX-MAN', name: 'Manpower', type: 'OPEX', active: true },
    { code: 'OPX-CPD', name: 'Change Parts, Punches & Dies', type: 'OPEX', active: true },
    { code: 'OPX-BLD', name: 'Building Maintenance', type: 'OPEX', active: true },
    { code: 'OPX-FUL', name: 'Fuel', type: 'OPEX', active: true },
    { code: 'OPX-WTR', name: 'Water', type: 'OPEX', active: true },
    { code: 'OPX-FAC', name: 'Factory Maintenance', type: 'OPEX', active: true },
    { code: 'OPX-QCA', name: 'Lab QC AMC', type: 'OPEX', active: true },
    { code: 'OPX-MAM', name: 'Machinery AMC', type: 'OPEX', active: true },
    { code: 'OPX-ITS', name: 'IT Spares & Services', type: 'OPEX', active: true },
    { code: 'OPX-HVS', name: 'HVAC Spares & Services', type: 'OPEX', active: true },
    { code: 'OPX-UWP', name: 'Utility & Water Plant', type: 'OPEX', active: true },
    { code: 'OPX-ESS', name: 'Electrical Spares & Services', type: 'OPEX', active: true },
    { code: 'OPX-EHS', name: 'EHS Spares & Services', type: 'OPEX', active: true },
    { code: 'OPX-CAL', name: 'Calibration Spares & Services', type: 'OPEX', active: true },
    { code: 'OPX-FRT', name: 'Freight', type: 'OPEX', active: true },
    { code: 'OPX-M72', name: 'ML72 OPEX', type: 'OPEX', active: true },
    { code: 'OPX-BMX', name: 'B-Max Change Parts', type: 'OPEX', active: false }
];

window.getBudgetCategories = function (type, includeInactive) {
    return window.BUDGET_CATEGORY_MASTER.filter(
        (c) => c.type === type && (includeInactive || c.active)
    );
};

window.getBudgetCategory = function (code) {
    return window.BUDGET_CATEGORY_MASTER.find((c) => c.code === code) || null;
};
