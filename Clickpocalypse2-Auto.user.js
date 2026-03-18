// ==UserScript==
// @name        Clickpocalypse2-Auto
// @namespace   C2C
// @description Clicker Bot for Clickpocalypse2
// @include     http://minmaxia.com/c2/
// @include     https://minmaxia.com/c2/
// @include     file:///C:/Users/Ben/Documents/Games/CLICKPOCALYPSE2/default.html
// @version     1.8.0
// @grant       none
// @require     https://code.jquery.com/jquery-3.1.0.slim.min.js
// ==/UserScript==

// ─── Scroll thresholds ───────────────────────────────────────────────────────
var SCROLL_RESERVE    = 15;
var SCROLL_FIRE_ABOVE = 29;

// ─── Potions to always drop ───────────────────────────────────────────────────
var JUNK_POTIONS = ['Infinite Scrolls', 'Scrolls Auto Fire'];

// ─── AP upgrade titles (from game's Jr array) ────────────────────────────────
var AP_UPGRADES = [
    'More Scrolls in Stack', 'Cheaper Farms',      'Extra Potion Slot',
    'Walking Speed Boost',   'Offline Time Bonus', 'Cheaper Monster Levels',
    'Better Item Sales',     'More Kills Per Farm', 'Potion Duration',
    '5th Character Slot',    'Permanent Faster Attacks',
    'Faster Healing',        'Spirit Regeneration',
];

// Categories handled by Auto Collect rather than Auto Upgrades
var COLLECT_CATS = { equip: true, harvest: true, itemsales: true, achieve: true };

// ─── Upgrade filter panel definition ─────────────────────────────────────────
var UPG_FILTERS = [
    { key: 'upgDo_levelup',   label: 'Level Up' },
    {
        key: 'upgDo_skills', label: 'Skills & Spells',
        subId: 'c2c-skill-filters', subCfgKey: 'upgFiltersSkillOpen',
        subs: [
            { key: 'skillDo_stats',  label: 'Stat Upgrades' },
            { key: 'skillDo_combat', label: 'Combat Upgrades' },
            { key: 'skillDo_spells', label: 'Spell Upgrades' },
            { key: 'skillDo_class',  label: 'Class Abilities' },
        ]
    },
    { key: 'upgDo_ap',        label: 'AP Upgrades' },
    { key: 'upgDo_gold',      label: 'Gold Upgrades' },
    { key: 'upgDo_dungeons',  label: 'Buy Farms' },
    { key: 'upgDo_castle',    label: 'Castle Attacks' },
    { key: 'upgDo_scrollupg', label: 'Scroll Upgrades' },
];

// ─── Persistent config ────────────────────────────────────────────────────────
var cfg = JSON.parse(localStorage.getItem('C2C_cfg') || '{}');
var DEFAULTS = {
    active:              true,
    autoLoot:            true,
    autoCollect:         true,
    autoUpgrades:        true,
    autoRetire:          false,
    autoPotions:         true,
    dropJunk:            true,
    dropDuplicates:      true,
    autoScrolls:         true,
    minimized:           false,
    upgFiltersOpen:      false,
    upgFiltersSkillOpen: false,
    panelX:              20,
    panelY:              20,
    // upgrade sub-toggles
    upgDo_levelup:       true,
    upgDo_skills:        true,
    upgDo_ap:            true,
    upgDo_gold:          true,
    upgDo_dungeons:      true,
    upgDo_castle:        true,
    upgDo_scrollupg:     true,
    // skill sub-toggles
    skillDo_stats:       true,
    skillDo_combat:      true,
    skillDo_spells:      true,
    skillDo_class:       true,
};
Object.keys(DEFAULTS).forEach(function (k) {
    if (cfg[k] === undefined) cfg[k] = DEFAULTS[k];
});
function saveConfig() { localStorage.setItem('C2C_cfg', JSON.stringify(cfg)); }

// ─── Category helpers ─────────────────────────────────────────────────────────

// classKw checked first — prevents "Sledge Hammer" (raw spell) matching before
// "Improved Sledge Hammer" (skill-point upgrade).
function skillCategory(text) {
    var groups = [
        ['class', [
            'Improved Sledge Hammer', 'Swift Strike II', 'Swift Strike III',
            'Ricochet Shot', 'Ricochet Chance', 'More Skeletons in Army',
            'Green Death II', 'Green Death III', 'Green Death IV',
            'Bigger Wolf Pack', 'I Love Chickens', 'Chicken Army',
            'Death by Chicken', 'Chicken Party', 'Flock', 'Fowl Territory',
            'Chicken Chance', 'Extra Strike', 'Attack Again',
            'Additional Attack Chance', 'Quick Shot', 'Quicker Shot', 'Quickest Shot',
        ]],
        ['spells', [
            'Improved Spider Web', 'Improved Chain Lightning', 'Improved Lightning Rain',
            'Improved Turn Monsters', 'Improved Fire Rain', 'Improved Fireball',
            'Improved Healing Spell', 'Improved Damage Spell', 'Improved Armor Spell',
            'Improved Attack Rating Spell', 'Improved Defense Rating Spell',
            'Improved Sleep', 'Efficient Caster', 'Spells Use 10 Less',
            'Spider Web', 'Lightning Rain', 'Chained Lightning', 'Blast Stun',
            'Fire Ring', 'Fire Rain', 'Fire Ball', 'Turn Monster',
            'Taunt', 'Rage', 'Stealth', 'Loot Instantly', 'Detect Treasure Chest',
            'Hurt', 'Skeleton Army', 'Phantom Skull', 'Wolf Pack', 'Guard Dog',
            'Minor Heal', 'Sleep', 'Swift Strike', 'Summon Chickens', 'Guard Chicken',
            'Sledge Hammer', 'Green Death', 'Poison Ring', 'Shock',
            'Revive', 'Increase Armor', 'Increase Damage',
            'Increase Attack Rating', 'Increase Defense Rating',
        ]],
        ['combat', [
            'Faster Attacks', 'Attack Cool-Down', 'Ignore Damage', 'Damage Resist',
            'Tank', 'Critical Hit', 'Critical Condition', 'Frequent Critical',
            'Likely Critical', 'Mean Backhand', 'Whirlwind', 'Impressive Attack',
        ]],
    ];
    for (var g = 0; g < groups.length; g++) {
        var kws = groups[g][1];
        for (var i = 0; i < kws.length; i++) {
            if (text.indexOf(kws[i]) !== -1) return groups[g][0];
        }
    }
    return 'stats';
}

function upgradeCategory(text) {
    // Retire MUST precede generic 'Monster Level' check — retire text contains it as a substring
    if (text.indexOf('Retire Monster Level') !== -1)                                              return 'monster_retire';
    if (text.indexOf('Unlock Monster Level') !== -1 ||
        text.indexOf('Monster Level')        !== -1)                                              return 'monster_unlock';

    // Collect categories — Harvest Rewards MUST precede generic 'Reward' check
    if (text.indexOf('Equip')                !== -1)                                              return 'equip';
    if (text.indexOf('Harvest Rewards')      !== -1)                                              return 'harvest';
    if (text.indexOf('Collect Item Sales')   !== -1)                                              return 'itemsales';
    if (text.indexOf('Achievement')          !== -1 || text.indexOf('Reward') !== -1)             return 'achieve';

    // Upgrade categories
    if (text.indexOf('Level Up')             !== -1)                                              return 'levelup';
    if (text.indexOf('Farm Dungeon')         !== -1 || text.indexOf('Buy Monster Farm') !== -1)   return 'dungeons';
    if (text.indexOf('Attack Castle')        !== -1)                                              return 'castle';
    if (text.indexOf('Unlock Scroll')        !== -1 || text.indexOf('Upgrade Scroll')   !== -1)  return 'scrollupg';
    // Gold drop stat upgrades (Min Gold, Max Gold, Average Gold) — checked after all named
    // categories so the 'Gold' keyword doesn't shadow anything specific
    if (text.indexOf('Gold')                 !== -1)                                              return 'gold';

    for (var i = 0; i < AP_UPGRADES.length; i++) {
        if (text.indexOf(AP_UPGRADES[i]) !== -1) return 'ap';
    }
    return 'skills';
}

// ─── Bot logic ────────────────────────────────────────────────────────────────

function tickLoot() {
    clickSelector($('#treasureChestLootButtonPanel').find('.gameTabLootButtonPanel'));
    clickSelector($('#treasureChestLootButtonPanel').find('.lootButton'));
}

// Clicks equip, harvest, item sales, and achievement reward buttons
function tickCollect() {
    for (var i = 43; i >= 0; i--) {
        var btn = $('#upgradeButtonContainer_' + i);
        if (COLLECT_CATS[upgradeCategory(btn.text())]) clickSelector(btn);
    }
}

function tickUpgrades() {
    for (var i = 43; i >= 0; i--) {
        var btn  = $('#upgradeButtonContainer_' + i);
        var text = btn.text();
        var cat  = upgradeCategory(text);

        if (cat === 'monster_unlock')  continue;
        if (cat === 'monster_retire')  { if (cfg.autoRetire) clickSelector(btn); continue; }
        if (COLLECT_CATS[cat])         continue;   // handled by tickCollect
        if (!cfg.autoUpgrades)         continue;

        if (cat === 'skills') {
            if (!cfg.upgDo_skills) continue;
            if (!cfg['skillDo_' + skillCategory(text)]) continue;
        } else if (!cfg['upgDo_' + cat]) {
            continue;
        }

        clickSelector(btn);
    }
}

function tickPotions() {
    // Pass 1: scan active potions so duplicates can be detected in pass 2
    var activePotionNames = {};
    var scrollsAutoFire   = false;

    for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 2; col++) {
            var pCont  = $('#potionButton_Row' + row + '_Col' + col).find('.potionContentContainer');
            var pName  = pCont.find('td').eq(1).text();
            var active = pCont.find('.potionButtonActive').length > 0;
            if (!pName.length) continue;
            if (active) activePotionNames[pName] = true;
            if (pName === 'Scrolls Auto Fire' && active) scrollsAutoFire = true;
        }
    }

    // Pass 2: drop junk/duplicates, activate everything else immediately
    for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 2; col++) {
            var potionBtn = $('#potionButton_Row' + row + '_Col' + col);
            var pCont     = potionBtn.find('.potionContentContainer');
            var pName     = pCont.find('td').eq(1).text();
            var active    = pCont.find('.potionButtonActive').length > 0;
            var dropBtn   = potionBtn.find('.dropPotionButton');

            if (!pName.length)                                               continue;
            if (cfg.dropJunk       && JUNK_POTIONS.indexOf(pName) !== -1)  { clickSelector(dropBtn); continue; }
            if (cfg.dropDuplicates && !active && activePotionNames[pName]) { clickSelector(dropBtn); continue; }
            if (active)                                                      continue;
            clickSelector(pCont);
        }
    }

    return scrollsAutoFire;
}

function tickScrolls(scrollsAutoFire, isBossEncounter, isDifficultEncounter) {
    for (var i = 0; i < 6; i++) {
        var cell   = $('#scrollButtonCell' + i);
        var btn    = cell.find('.scrollButton');
        var amount = cell.find('tr').eq(1).text().replace('x', '');

        if (!amount.length) continue;

        if (amount > SCROLL_FIRE_ABOVE) { clickSelector(btn); continue; }

        if (amount === 'Infinite') {
            clickSelector(btn);
            setTimeout(clickSelector, 250, btn);
            setTimeout(clickSelector, 500, btn);
            setTimeout(clickSelector, 750, btn);
            continue;
        }

        if (scrollsAutoFire && !isBossEncounter && !isDifficultEncounter) continue;

        if (i === 1 && !isBossEncounter)                                                      { clickSelector(btn); continue; }
        if (i !== 1 && (amount > SCROLL_RESERVE || isBossEncounter || isDifficultEncounter)) { clickSelector(btn); continue; }
    }
}

// ─── Floating UI ─────────────────────────────────────────────────────────────

function buildFilterRows(filters, indent) {
    return filters.map(function (f) {
        var html = '<div class="c2c-row ' + indent + '" data-key="' + f.key + '">' +
                   '<span class="c2c-label">&#x2514; ' + f.label + '</span>';
        if (f.subs) {
            html += '<span class="c2c-expand" data-expand="' + f.subId +
                    '" data-expandkey="' + f.subCfgKey + '">&#x25BC;</span>';
        }
        html += '<span class="c2c-toggle"></span></div>';
        if (f.subs) {
            html += '<div id="' + f.subId + '">' + buildFilterRows(f.subs, 'c2c-indent2') + '</div>';
        }
        return html;
    }).join('');
}

function buildUI() {
    $('body').append(
        '<div id="c2c-panel" style="top:' + cfg.panelY + 'px;left:' + cfg.panelX + 'px;">' +
        '  <div id="c2c-titlebar">' +
        '    <span id="c2c-title">&#9876; C2 Auto</span>' +
        '    <span id="c2c-minimize">&#x2014;</span>' +
        '  </div>' +
        '  <div id="c2c-body">' +
        '    <div class="c2c-row" data-key="active"><span class="c2c-label">Bot Active</span><span class="c2c-toggle"></span></div>' +
        '    <hr class="c2c-divider">' +
        '    <div class="c2c-row" data-key="autoLoot"><span class="c2c-label">Auto Loot</span><span class="c2c-toggle"></span></div>' +
        '    <div class="c2c-row" data-key="autoCollect"><span class="c2c-label">Auto Collect</span><span class="c2c-toggle"></span></div>' +
        '    <div class="c2c-row" data-key="autoUpgrades">' +
        '      <span class="c2c-label">Auto Upgrades</span>' +
        '      <span class="c2c-expand" data-expand="c2c-upg-filters" data-expandkey="upgFiltersOpen">&#x25BC;</span>' +
        '      <span class="c2c-toggle"></span>' +
        '    </div>' +
        '    <div id="c2c-upg-filters">' + buildFilterRows(UPG_FILTERS, 'c2c-indent') + '</div>' +
        '    <div class="c2c-row" data-key="autoRetire"><span class="c2c-label">Auto Retire</span><span class="c2c-toggle"></span></div>' +
        '    <div class="c2c-row" data-key="autoPotions"><span class="c2c-label">Auto Potions</span><span class="c2c-toggle"></span></div>' +
        '    <div class="c2c-row c2c-indent" data-key="dropJunk"><span class="c2c-label">&#x2514; Drop Junk Potions</span><span class="c2c-toggle"></span></div>' +
        '    <div class="c2c-row c2c-indent" data-key="dropDuplicates"><span class="c2c-label">&#x2514; Drop Duplicate Potions</span><span class="c2c-toggle"></span></div>' +
        '    <div class="c2c-row" data-key="autoScrolls"><span class="c2c-label">Auto Scrolls</span><span class="c2c-toggle"></span></div>' +
        '  </div>' +
        '</div>'
    );

    $('head').append('<style>' +
        '#c2c-panel{' +
            'position:fixed;z-index:99999;background:rgba(15,15,25,0.93);' +
            'border:1px solid #556;border-radius:7px;font-family:monospace;' +
            'font-size:12px;color:#ccc;min-width:220px;' +
            'box-shadow:0 4px 20px rgba(0,0,0,0.7);user-select:none;}' +
        '#c2c-titlebar{' +
            'background:rgba(50,55,80,0.97);border-radius:7px 7px 0 0;' +
            'padding:6px 10px;cursor:grab;display:flex;' +
            'justify-content:space-between;align-items:center;}' +
        '#c2c-title{font-weight:bold;letter-spacing:1px;color:#9cf;}' +
        '#c2c-minimize{cursor:pointer;color:#aaa;font-size:15px;padding:0 2px;line-height:1;}' +
        '#c2c-minimize:hover{color:#fff;}' +
        '#c2c-body{padding:8px 10px 10px;}' +
        '.c2c-row{' +
            'display:flex;justify-content:space-between;align-items:center;' +
            'margin:5px 0;cursor:pointer;border-radius:3px;padding:2px 3px;}' +
        '.c2c-row:hover{background:rgba(255,255,255,0.05);}' +
        '.c2c-row:hover .c2c-label{color:#fff;}' +
        '.c2c-indent{padding-left:10px;opacity:0.85;}' +
        '.c2c-indent2{padding-left:20px;opacity:0.72;}' +
        '.c2c-label{flex:1;}' +
        '.c2c-expand{font-size:9px;color:#888;margin-right:6px;padding:1px 3px;border-radius:2px;}' +
        '.c2c-expand:hover{color:#fff;background:rgba(255,255,255,0.1);}' +
        '.c2c-toggle{' +
            'width:30px;height:16px;border-radius:8px;background:#383838;' +
            'position:relative;flex-shrink:0;transition:background 0.2s;}' +
        '.c2c-toggle::after{' +
            'content:"";position:absolute;width:11px;height:11px;border-radius:50%;' +
            'background:#666;top:2.5px;left:2px;transition:left 0.2s,background 0.2s;}' +
        '.c2c-toggle.on{background:#2a7d4f;}' +
        '.c2c-toggle.on::after{left:17px;background:#fff;}' +
        '.c2c-divider{border:none;border-top:1px solid #3a3a4a;margin:6px 0;}' +
    '</style>');

    refreshToggles();

    if (cfg.minimized) { $('#c2c-body').hide(); $('#c2c-minimize').html('&#x25b2;'); }
    $('#c2c-panel .c2c-expand').each(function () {
        if (!cfg[$(this).data('expandkey')]) $('#' + $(this).data('expand')).hide();
        else                                 $(this).html('&#x25b2;');
    });

    $('#c2c-panel').on('click', '.c2c-row', function () {
        cfg[$(this).data('key')] = !cfg[$(this).data('key')];
        saveConfig();
        refreshToggles();
    });

    $('#c2c-panel').on('click', '.c2c-expand', function (e) {
        e.stopPropagation();
        var id  = $(this).data('expand');
        var key = $(this).data('expandkey');
        cfg[key] = !cfg[key];
        $('#' + id).toggle(cfg[key]);
        $(this).html(cfg[key] ? '&#x25b2;' : '&#x25bc;');
        saveConfig();
    });

    $('#c2c-minimize').on('click', function (e) {
        e.stopPropagation();
        cfg.minimized = !cfg.minimized;
        $(this).html(cfg.minimized ? '&#x25b2;' : '&#x2014;');
        $('#c2c-body').toggle(!cfg.minimized);
        saveConfig();
    });

    // Drag — css('left/top') used directly; offset() includes scroll and breaks position:fixed
    var dragging = false, ox, oy;
    $('#c2c-titlebar').on('mousedown', function (e) {
        dragging = true;
        ox = e.clientX - parseInt($('#c2c-panel').css('left'));
        oy = e.clientY - parseInt($('#c2c-panel').css('top'));
        $('#c2c-titlebar').css('cursor', 'grabbing');
        e.preventDefault();
    });
    $(document).on('mousemove.c2c', function (e) {
        if (!dragging) return;
        $('#c2c-panel').css({ left: e.clientX - ox, top: e.clientY - oy });
    });
    $(document).on('mouseup.c2c', function () {
        if (!dragging) return;
        dragging = false;
        $('#c2c-titlebar').css('cursor', 'grab');
        cfg.panelX = parseInt($('#c2c-panel').css('left'));
        cfg.panelY = parseInt($('#c2c-panel').css('top'));
        saveConfig();
    });
}

function refreshToggles() {
    $('#c2c-panel .c2c-row').each(function () {
        $(this).find('.c2c-toggle').toggleClass('on', !!cfg[$(this).data('key')]);
    });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

$(document).ready(function () {
    console.log('Starting Clickpocalypse2-Auto: ' + GM_info.script.version);
    buildUI();

    setInterval(function () {
        if (!cfg.active) return;

        var isBossEncounter      = $('.bossEncounterNotificationDiv').length > 0;
        var isDifficultEncounter = false;

        var positions = ['A', 'B', 'C', 'E', 'E', 'F'];
        $.each(positions, function (idx) {
            for (var c = 0; c < 5; c++) {
                var icon = $('#adventurerEffectIcon' + positions[idx] + c);
                if (icon.attr('title') === 'Stunned' && icon.css('display') !== 'none') {
                    isDifficultEncounter = true;
                }
            }
        });

        if (cfg.autoLoot)    tickLoot();
        if (cfg.autoCollect) tickCollect();
        tickUpgrades();
        var scrollsAutoFire = cfg.autoPotions ? tickPotions() : false;
        if (cfg.autoScrolls) tickScrolls(scrollsAutoFire, isBossEncounter, isDifficultEncounter);

    }, 1000);
});

function clickSelector($selector) { $selector.mouseup(); }
