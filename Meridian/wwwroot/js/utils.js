    function updateRailActive(btnId) {
        document.querySelectorAll('.activity-bar-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active');
    }

    function collapseSidebar() {
        const sidebar = document.getElementById('sidebar');
        const openBtn = document.getElementById('open-sidebar-btn');
        if (sidebar && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            const activityBar = document.getElementById('activity-bar');
            if (activityBar) activityBar.classList.add('sidebar-closed');
            if (openBtn) openBtn.style.display = 'block';
        }
    }

    function toggleNodeCollapse(nodeId, event, isSearch = false) {
        if (event) {
            event.stopPropagation();
        }
        if (isSearch) {
            if (searchExpandedNodes.has(nodeId)) {
                searchExpandedNodes.delete(nodeId);
            } else {
                searchExpandedNodes.add(nodeId);
            }
            applySidebarFilters();
        } else {
            if (expandedNodes.has(nodeId)) {
                expandedNodes.delete(nodeId);
            } else {
                expandedNodes.add(nodeId);
            }
            renderExplorerTree();
        }
    }

    let sidebarSearchQuery = "";
    let sidebarFilterStatus = "all";
    let sidebarSortStatus = "none";

    let gridProjectsData = [];
    let gridSearchQuery = "";
    let gridFilterStatus = "all";
    let gridSortStatus = "none";

    function getSmoothProgressColor(progress) {
        if (progress === 0) return "var(--text-muted)";
        // --color-danger: #ef4444 -> rgb(239, 68, 68)
        // --color-progress: #ffa33a -> rgb(255, 163, 58)
        // --color-success: #10b981 -> rgb(16, 185, 129)
        let r, g, b;
        
        if (progress <= 50) {
            const p = progress / 50;
            r = Math.round(239 + (255 - 239) * p);
            g = Math.round(68 + (163 - 68) * p);
            b = Math.round(68 + (58 - 68) * p);
        } else {
            const p = (progress - 50) / 50;
            r = Math.round(255 + (16 - 255) * p);
            g = Math.round(163 + (185 - 163) * p);
            b = Math.round(58 + (129 - 58) * p);
        }
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadSidebarTree();
        loadHomeStatsAndGrid();

        document.getElementById('sidebar-search').addEventListener('input', (e) => {
            sidebarSearchQuery = e.target.value.trim().toLowerCase();
            applySidebarFilters();
        });

        document.getElementById('sidebar-filter-status').addEventListener('change', (e) => {
            sidebarFilterStatus = e.target.value;
            applySidebarFilters();
        });

        document.getElementById('sidebar-sort')?.addEventListener('change', (e) => {
            sidebarSortStatus = e.target.value;
            applySidebarFilters();
        });

        document.getElementById('grid-search').addEventListener('input', (e) => {
            gridSearchQuery = e.target.value.trim().toLowerCase();
            applyGridFilters();
        });

        document.getElementById('grid-filter-status').addEventListener('change', (e) => {
            gridFilterStatus = e.target.value;
            applyGridFilters();
        });

        document.getElementById('grid-sort')?.addEventListener('change', (e) => {
            gridSortStatus = e.target.value;
            applyGridFilters();
        });

        const cardApproaching = document.getElementById('stat-card-approaching');
        cardApproaching.style.cursor = 'pointer';
        cardApproaching.addEventListener('click', () => {
            const filterEl = document.getElementById('grid-filter-status');
            filterEl.value = 'approaching';
            gridFilterStatus = 'approaching';
            applyGridFilters();
        });

        const cardOverdue = document.getElementById('stat-card-overdue');
        cardOverdue.style.cursor = 'pointer';
        cardOverdue.addEventListener('click', () => {
            const filterEl = document.getElementById('grid-filter-status');
            filterEl.value = 'overdue';
            gridFilterStatus = 'overdue';
            applyGridFilters();
        });

        document.getElementById('btn-clear-filters').addEventListener('click', () => {
            document.getElementById('grid-search').value = "";
            gridSearchQuery = "";
            
            document.getElementById('grid-filter-status').value = "all";
            gridFilterStatus = "all";
            
            const gridSort = document.getElementById('grid-sort');
            if (gridSort) {
                gridSort.value = "none";
                gridSortStatus = "none";
            }
            
            applyGridFilters();
        });

        document.getElementById('sidebar-new-project-btn').addEventListener('click', () => {
            openProjectModal();
        });


    });

    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : '✕'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove("active");
        setTimeout(() => modal.style.display = "none", 250);
    }

