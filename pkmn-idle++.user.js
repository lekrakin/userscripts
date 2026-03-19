// ==UserScript==
// @name         Pokemon Idle ++
// @author       lekrakin
// @version      2.5
// @description  Various tweaks to UI and extra features
// @match        https://pkmn-idle.com/
// @icon         https://pkmn-idle.com/pokeball.svg
// @updateURL    https://github.com/lekrakin/userscripts/raw/refs/heads/main/pkmn-idle++.user.js
// @downloadURL  https://github.com/lekrakin/userscripts/raw/refs/heads/main/pkmn-idle++.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    "use strict";

    // ── CSS ────────────────────────────────────────────────────────────────────

    GM_addStyle(`
        /* allow the party list to scroll vertically */
        .party-content {
            overflow: auto;
        }

        /* the game forces position:absolute on all buttons, which breaks
           injected buttons — reset everything except the move-swap button
           which relies on that positioning */
        button:not(.move-swap-btn) {
            position: unset !important;
            padding: 1px 2px;
        }
    `);

    // ── Box toggle ─────────────────────────────────────────────────────────────

    // flips the box between expanded (grid visible) and minimized (grid hidden)
    function toggleBox(box, button, grid) {
        const minimized = box.dataset.boxMinimized === "1";

        if (minimized) {
            delete box.dataset.boxMinimized;
            grid.style.display = "";
            button.textContent = "−";
            return;
        }

        box.dataset.boxMinimized = "1";
        grid.style.display = "none";
        button.textContent = "+";
    }

    // injects the toggle button into the box header, next to the sort button.
    // the guard at the top prevents duplicates when the observer fires repeatedly
    function addBoxToggle() {
        const box = document.querySelector(".box-container");
        if (!box) return;

        const sortBtn = box.querySelector(".box-sort-btn");
        const grid = box.querySelector(".box-grid-wrapper");

        if (!sortBtn || !grid || box.querySelector(".box-toggle-btn")) return;

        const toggleBtn = document.createElement("button");
        toggleBtn.className = `${sortBtn.className} box-toggle-btn`;
        toggleBtn.textContent = "−";

        // stopPropagation prevents the click from reaching any game listeners
        // on parent elements that might interfere
        toggleBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleBox(box, toggleBtn, grid);
        });

        sortBtn.after(toggleBtn);
    }

    // ── Init ───────────────────────────────────────────────────────────────────

    // run immediately if DOM is ready, otherwise wait for it
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", addBoxToggle, { once: true });
    } else {
        addBoxToggle();
    }

    // the box is rendered dynamically by the game's framework, so we watch
    // for DOM changes and inject the button whenever the box appears
    new MutationObserver(() => {
        addBoxToggle();
    }).observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
})();
