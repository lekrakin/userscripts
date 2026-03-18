// ==UserScript==
// @name         Pokemon Idle ++
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Various tweaks to UI and extra features
// @match        https://pkmn-idle.com/
// @icon         https://pkmn-idle.com/pokeball.svg
// @updateURL    htt
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .side-panel.left-panel,
        .side-panel.left-panel .party-content {
            overflow: hidden !important;
        }

        .side-panel.left-panel .party-content {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            min-height: 0 !important;
        }

        .side-panel.left-panel .party-list {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
        }

        .side-panel.right-panel {
            overflow: hidden !important;
        }

        .side-panel.right-panel .panel-content,
        .side-panel.right-panel .location-panel-scroll {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            height: 100% !important;
            max-height: 100% !important;
        }

        .side-panel.left-panel .stats-panel {
            flex: 0 0 auto !important;
            margin-top: 0 !important;
        }

        .box-container,
        .box-grid-wrapper,
        .box-grid,
        .bag-container,
        .bag-content,
        .bag-item-list,
        .town-map,
        .town-map-canvas {
            overflow: auto !important;
        }

        .box-header {
            display: flex !important;
            align-items: center !important;
            overflow: visible !important;
        }

        .box-header .box-sort-btn {
            margin-left: auto !important;
            margin-right: 2px !important;
        }

        .box-header .box-toggle-btn {
            margin-left: 0 !important;
            margin-right: 0 !important;
            flex-shrink: 0 !important;
            cursor: pointer !important;
            min-width: 22px !important;
            text-align: center !important;
        }
    `);

    function copyButtonStyles(fromEl, toEl) {
        const cs = getComputedStyle(fromEl);
        [
            'backgroundColor', 'color', 'border', 'borderRadius', 'borderColor',
            'borderStyle', 'borderWidth', 'fontFamily', 'fontSize', 'fontWeight',
            'lineHeight', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft',
            'paddingRight', 'boxShadow', 'textShadow', 'letterSpacing',
            'imageRendering', 'height'
        ].forEach(prop => {
            try {
                toEl.style[prop] = cs[prop];
            } catch (_) {}
        });
    }

    function toggleBox(box, button, grid) {
        const minimized = box.dataset.boxMinimized === '1';

        if (minimized) {
            delete box.dataset.boxMinimized;
            grid.style.display = '';
            box.style.height = '';
            button.textContent = '−';
            button.title = 'Minimize box';
            return;
        }

        box.dataset.boxMinimized = '1';
        grid.style.display = 'none';
        box.style.height = 'auto';
        button.textContent = '+';
        button.title = 'Expand box';
    }

    function addBoxToggle() {
        const box = document.querySelector('.box-container');
        if (!box) return;

        const header = box.querySelector('.box-header');
        const sortBtn = box.querySelector('.box-sort-btn');
        const grid = box.querySelector('.box-grid-wrapper');

        if (!header || !sortBtn || !grid || header.querySelector('.box-toggle-btn')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'box-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.textContent = box.dataset.boxMinimized === '1' ? '+' : '−';
        toggleBtn.title = box.dataset.boxMinimized === '1' ? 'Expand box' : 'Minimize box';

        copyButtonStyles(sortBtn, toggleBtn);
        setTimeout(() => copyButtonStyles(sortBtn, toggleBtn), 500);

        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.filter = 'brightness(1.25)';
        });

        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.filter = '';
        });

        toggleBtn.addEventListener('click', event => {
            event.stopPropagation();
            toggleBox(box, toggleBtn, grid);
        });

        sortBtn.after(toggleBtn);

        if (box.dataset.boxMinimized === '1') {
            grid.style.display = 'none';
            box.style.height = 'auto';
        }
    }

    function init() {
        addBoxToggle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    new MutationObserver(() => {
        addBoxToggle();
    }).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
