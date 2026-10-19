// Works out how deep the current page is nested by reading the src
// attribute this very script was loaded with (e.g. "sidebar.js" from a
// root page, or "../sidebar.js" from a page one folder deep). That gives
// us a relative prefix (SIDEBAR_BASE_PATH) instead of a hardcoded absolute path
// like "/inventory-budget/", so the same file works unchanged whether it's
// opened from a local folder/local server or deployed on GitHub Pages
// under any repo name/subpath.
const __sidebarScriptSrc =
  (document.currentScript && document.currentScript.getAttribute("src")) ||
  "sidebar.js";
const SIDEBAR_BASE_PATH = __sidebarScriptSrc.replace(/sidebar\.js(?:\?.*)?$/, "");

const sidebarHTML = `
<aside id="sidebar">
    <div class="sidebar-header">
        <div class="d-flex align-items-center gap-3">
            <div class="logo-box">
    <img src="${SIDEBAR_BASE_PATH}assets/MTS_Logo.jpg" class="menu-icon">
            </div>
            <div class="brand-text">MICRO LABS</div>
        </div>
    </div>

    <div class="section-label">APPLICATIONS</div>
    <div class="sidebar-body">

    <nav class="nav flex-column">
    
        <div class="nav-item">
            <a href="#inventoryCollapse" class="nav-link" data-bs-toggle="collapse" aria-expanded="true">
                <i class="bi bi-box-seam"></i> 
                <span>INVENTORY</span>
                <i class="bi bi-chevron-down ms-auto arrow-icon"></i>
            </a>

            <div class="collapse show" id="inventoryCollapse">
            
                <div class="sub-menu-tree">            
                    <div class="operations-group">
                     <div class="nested-item">
                        <div class="nested-header" data-bs-toggle="collapse" data-bs-target="#masterNested" aria-expanded="true">
                            <span>Master</span>
                            <i class="bi bi-chevron-down arrow-icon small"></i>
                        </div>
                        
                        <div class="collapse show tree-line-nested" id="masterNested">
                            <a href="${SIDEBAR_BASE_PATH}Material_Master/a1.html" class="tree-link">Material Master</a>
                            <a href="${SIDEBAR_BASE_PATH}Service_Master/a1.html" class="tree-link">Service Master</a>
                        </div>
                     </div>

                     <div class="nested-item">
                        <div class="nested-header" data-bs-toggle="collapse" data-bs-target="#reportsNested" aria-expanded="true">
                            <span>Reports</span>
                            <i class="bi bi-chevron-down arrow-icon small"></i>
                        </div>

                        <div class="collapse show tree-line-nested" id="reportsNested">
                            <a href="${SIDEBAR_BASE_PATH}Ledger_Report/a1.html" class="tree-link">Ledger Report</a>
                            <a href="${SIDEBAR_BASE_PATH}Stock_Summary_Report/a1.html" class="tree-link">Stock Summary Report</a>
                        </div>
                     </div>
                        <a href="${SIDEBAR_BASE_PATH}Inward_Inventory/a1.html" class="tree-link">Inward - Inventory</a>
                        <a href="${SIDEBAR_BASE_PATH}Put_Away/a1.html" class="tree-link">Put Away</a>
                        <a href="${SIDEBAR_BASE_PATH}Stock_Transfer/a1.html" class="tree-link">Bin To Bin Transfer</a>
                        <a href="${SIDEBAR_BASE_PATH}Request_for_Issuance/a1.html" class="tree-link">Requests for Material</a>
                        <a href="${SIDEBAR_BASE_PATH}Issuance_of_Material/a1.html" class="tree-link">Issuance of Material</a>
                        <a href="${SIDEBAR_BASE_PATH}Return_Material/a1.html" class="tree-link">Return Material</a>
                        <a href="${SIDEBAR_BASE_PATH}Stock_Verification/a1.html" class="tree-link">Stock Verification</a>
                        <a href="${SIDEBAR_BASE_PATH}Stock_Adjustment/a1.html" class="tree-link">Stock Adjustment</a>
                    </div>
                    
                </div>
            </div>
        </div>


    <div class="nav-item">
    <a href="#purchaseCollapse" class="nav-link" data-bs-toggle="collapse" aria-expanded="true">
        <i class="bi bi-cart-plus"></i> 
        <span>PURCHASE</span>
        <i class="bi bi-chevron-down ms-auto arrow-icon"></i>
    </a>

    <div class="collapse show" id="purchaseCollapse">
        <div class="sub-menu-tree">
            <div class="operations-group">
                <a href="${SIDEBAR_BASE_PATH}Purchase/material_purchase_request.html" class="tree-link">
                    Material Request
                </a>
                <a href="${SIDEBAR_BASE_PATH}Purchase/service_purchase_request.html" class="tree-link">
                    Service Request
                </a>
            </div>
        </div>
    </div>
</div>
                           <div class="nav-item">
    <a href="#budgetCollapse" class="nav-link" data-bs-toggle="collapse" aria-expanded="true">
        <i class="bi bi-wallet2"></i> 
        <span>BUDGET</span>
        <i class="bi bi-chevron-down ms-auto arrow-icon"></i>
    </a>
        <div class="collapse show" id="budgetCollapse">
        <div class="sub-menu-tree">
            <div class="operations-group">
                <a href="${SIDEBAR_BASE_PATH}Budget/budget_entry.html" class="tree-link">
                    Budget Entry
                </a>
                <a href="${SIDEBAR_BASE_PATH}Budget/budget_category_master.html" class="tree-link">
                    Budget Category Master
                </a>
            </div>
        </div>
    </div>


</div>


    </div>

    </nav>
</aside>
`;

document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("sidebar-placeholder");

  if (container) {
    container.innerHTML = sidebarHTML;

    // Bootstrap collapse init
    if (window.bootstrap) {
      const collapseElementList = container.querySelectorAll(".collapse");
      collapseElementList.forEach((collapseEl) => {
        new bootstrap.Collapse(collapseEl, { toggle: false });
      });
    }

    // ✅ AUTO ACTIVE LINK
    const currentURL = window.location.href;

    const links = container.querySelectorAll(".tree-link");

    links.forEach((link) => {
      const linkURL = link.href;

      // ignore #
      if (!linkURL || link.getAttribute("href") === "#") return;

      // ✅ MATCH CURRENT PAGE
      if (currentURL === linkURL) {
        link.classList.add("active-tree");

        // ✅ OPEN PARENT MENUS
        let parentCollapse = link.closest(".collapse");

        while (parentCollapse) {
          parentCollapse.classList.add("show");

          const trigger = document.querySelector(
            `[data-bs-target="#${parentCollapse.id}"]`,
          );

          if (trigger) {
            trigger.setAttribute("aria-expanded", "true");
            trigger.classList.remove("collapsed");
          }

          parentCollapse = parentCollapse.parentElement.closest(".collapse");
        }

        link.scrollIntoView({ block: "center" });
      }
    });
  }
});
