// LASSO SELECTION (Area Selection)
window.fmHasDragged = false; // exported so filemanager.js can read it
let fmIsLassoSelecting = false;
let fmLassoStartX = 0;
let fmLassoStartY = 0;
let fmLassoCachedItems = [];

// Inject styles for lassoing
const fmLassoStyle = document.createElement('style');
fmLassoStyle.innerHTML = `
    body.fm-lassoing {
        user-select: none !important;
        -webkit-user-select: none !important;
    }
    body.fm-lassoing .fm-grid-item {
        pointer-events: none !important;
    }
`;
document.head.appendChild(fmLassoStyle);

// Create the visual selection box
const fmSelectionBox = document.createElement('div');
fmSelectionBox.id = 'fm-selection-box';
fmSelectionBox.style.display = 'none';
fmSelectionBox.style.position = 'fixed';
fmSelectionBox.style.border = '1px solid rgba(255, 255, 255, 0.4)';
fmSelectionBox.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
fmSelectionBox.style.zIndex = '9999';
fmSelectionBox.style.pointerEvents = 'none';
fmSelectionBox.style.borderRadius = '4px';
document.body.appendChild(fmSelectionBox);

// Keep track of what was selected before the lasso started (for Ctrl/Shift key support in the future if needed)
let fmPreLassoSelection = [];

const fmDropZoneElement = document.getElementById("fm-drop-zone");

if (fmDropZoneElement) {
    fmDropZoneElement.addEventListener('mousedown', (e) => {
        window.fmHasDragged = false;
        
        // Only trigger on left click
        if (e.button !== 0) return;
        
        // Don't trigger if clicking on the grid item, a button, or an input
        if (e.target.closest('.fm-grid-item') || e.target.closest('button') || e.target.closest('input')) return;
        
        // Prevent default to avoid text selection while dragging
        e.preventDefault();
        
        fmIsLassoSelecting = true;
        document.body.classList.add('fm-lassoing');
        
        fmLassoStartX = e.clientX;
        fmLassoStartY = e.clientY;
        
        fmSelectionBox.style.left = fmLassoStartX + 'px';
        fmSelectionBox.style.top = fmLassoStartY + 'px';
        fmSelectionBox.style.width = '0px';
        fmSelectionBox.style.height = '0px';
        fmSelectionBox.style.display = 'block';
        
        if (!e.ctrlKey && !e.shiftKey) {
            fmClearSelection();
        }
        fmPreLassoSelection = [...selectedItems];
        
        // Cache item rects to prevent layout thrashing during mousemove
        const items = document.querySelectorAll('.fm-grid-item');
        fmLassoCachedItems = Array.from(items).map(item => {
            return {
                el: item,
                rect: item.getBoundingClientRect(), // viewport relative
                type: item.getAttribute('data-type'),
                id: parseInt(item.getAttribute('data-id')),
                wasSelected: item.classList.contains('selected')
            };
        });
    });
}

document.addEventListener('mousemove', (e) => {
    if (!fmIsLassoSelecting) return;
    
    // If they moved the mouse more than 3 pixels, consider it a drag
    if (Math.abs(e.clientX - fmLassoStartX) > 3 || Math.abs(e.clientY - fmLassoStartY) > 3) {
        window.fmHasDragged = true;
    }
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const selLeft = Math.min(fmLassoStartX, currentX);
    const selTop = Math.min(fmLassoStartY, currentY);
    const selWidth = Math.abs(currentX - fmLassoStartX);
    const selHeight = Math.abs(currentY - fmLassoStartY);
    const selRight = selLeft + selWidth;
    const selBottom = selTop + selHeight;
    
    fmSelectionBox.style.left = selLeft + 'px';
    fmSelectionBox.style.top = selTop + 'px';
    fmSelectionBox.style.width = selWidth + 'px';
    fmSelectionBox.style.height = selHeight + 'px';
    
    let currentLassoSelection = [];
    
    fmLassoCachedItems.forEach(cached => {
        const itemRect = cached.rect;
        
        // Mathematical AABB Intersection check
        const intersects = !(
            selRight < itemRect.left || 
            selLeft > itemRect.right || 
            selBottom < itemRect.top || 
            selTop > itemRect.bottom
        );
        
        if (intersects) {
            currentLassoSelection.push({ type: cached.type, id: cached.id });
        }
    });
    
    // Combine pre-lasso selection with new lasso selection
    const combinedSelection = [...fmPreLassoSelection];
    
    currentLassoSelection.forEach(item => {
        if (!combinedSelection.find(i => i.type === item.type && i.id === item.id)) {
            combinedSelection.push(item);
        }
    });
    
    selectedItems = combinedSelection;
    
    // Update visual styles efficiently
    fmLassoCachedItems.forEach(cached => {
        const isNowSelected = !!selectedItems.find(i => i.type === cached.type && i.id === cached.id);
        
        // Only modify DOM if state changed to prevent repaints
        if (isNowSelected !== cached.wasSelected) {
            if (isNowSelected) {
                cached.el.classList.add('selected');
                cached.el.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            } else {
                cached.el.classList.remove('selected');
                cached.el.style.backgroundColor = 'transparent';
            }
            cached.wasSelected = isNowSelected;
        }
    });
});

document.addEventListener('mouseup', (e) => {
    if (fmIsLassoSelecting) {
        fmIsLassoSelecting = false;
        document.body.classList.remove('fm-lassoing');
        fmSelectionBox.style.display = 'none';
        // Finalize UI (this updates the action buttons like Delete, Cut, Copy, Protect)
        fmUpdateSelectionUI();
    }
});
