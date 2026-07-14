/**
 * HUD.js — In-game heads-up display manager
 * Manages all DOM-based UI overlays for VOXEL STRIKE.
 */

export class HUD {
    constructor() {
        // ── Core HUD container ──
        this.hud = document.getElementById('hud');

        // ── Health ──
        this.healthBar = document.getElementById('health-bar');
        this.healthText = document.getElementById('health-text');
        this.healthContainer = document.getElementById('health-container');

        // ── Ammo ──
        this.weaponName = document.getElementById('weapon-name');
        this.ammoCurrent = document.getElementById('ammo-current');
        this.ammoMax = document.getElementById('ammo-max');
        this.ammoDisplay = document.getElementById('ammo-display');

        // ── Kill Feed ──
        this.killFeed = document.getElementById('kill-feed');

        // ── Crosshair ──
        this.crosshair = document.getElementById('crosshair');

        // ── Score ──
        this.scoreKills = document.getElementById('score-kills');
        this.scoreDeaths = document.getElementById('score-deaths');

        // ── Death Screen ──
        this.deathScreen = document.getElementById('death-screen');
        this.deathInfo = document.getElementById('death-info');
        this.respawnTimer = document.getElementById('respawn-timer');

        // ── Pause Screen ──
        this.pauseScreen = document.getElementById('pause-screen');

        // Internal state
        this._respawnTimeout = null;
        this._respawnInterval = null;
    }

    /* ──────────────────────────────────────────────────────────
       Visibility
       ────────────────────────────────────────────────────────── */

    /** Show the HUD overlay. */
    show() {
        this.hud.classList.add('active');
    }

    /** Hide the HUD overlay. */
    hide() {
        this.hud.classList.remove('active');
    }

    /* ──────────────────────────────────────────────────────────
       Health
       ────────────────────────────────────────────────────────── */

    /**
     * Update the health bar and numeric display.
     * @param {number} value — Health value (clamped to 0–100).
     */
    updateHealth(value) {
        const clamped = Math.max(0, Math.min(100, Math.round(value)));
        this.healthBar.style.width = `${clamped}%`;
        this.healthText.textContent = clamped;

        if (clamped <= 25) {
            this.healthContainer.classList.add('health-low');
        } else {
            this.healthContainer.classList.remove('health-low');
        }
    }

    /* ──────────────────────────────────────────────────────────
       Ammo
       ────────────────────────────────────────────────────────── */

    /**
     * Update the ammo counter and weapon name.
     * @param {string} weaponName - Name of the weapon
     * @param {number|string} current — Rounds in magazine.
     * @param {number|string} max     — Magazine capacity.
     */
    updateWeapon(weaponName, current, max) {
        if (this.weaponName) this.weaponName.textContent = weaponName;
        
        if (current === Infinity) {
            this.ammoCurrent.textContent = '∞';
            this.ammoMax.textContent = '∞';
        } else {
            this.ammoCurrent.textContent = current;
            this.ammoMax.textContent = max;
        }
    }

    /**
     * Toggle the reloading indicator.
     * @param {boolean} show — Whether to show the reloading state.
     */
    showReloading(show) {
        if (show) {
            this.ammoDisplay.classList.add('reloading');
        } else {
            this.ammoDisplay.classList.remove('reloading');
        }
    }

    /* ──────────────────────────────────────────────────────────
       Kill Feed
       ────────────────────────────────────────────────────────── */

    /**
     * Add a kill-feed entry.
     * @param {string} message — e.g. "Player1 ⟶ Player2"
     */
    addKillFeed(message) {
        const entry = document.createElement('div');
        entry.classList.add('kill-entry');
        entry.textContent = message;

        // Insert at top
        this.killFeed.prepend(entry);

        // Cap at 5 visible entries
        while (this.killFeed.children.length > 5) {
            this.killFeed.removeChild(this.killFeed.lastChild);
        }

        // Auto-remove after 4 s (with fade-out starting at 3 s)
        setTimeout(() => {
            entry.classList.add('fade-out');
        }, 3000);

        setTimeout(() => {
            if (entry.parentNode) {
                entry.parentNode.removeChild(entry);
            }
        }, 3500);
    }

    /* ──────────────────────────────────────────────────────────
       Damage Indicator
       ────────────────────────────────────────────────────────── */

    /** Flash a red vignette to indicate damage taken. */
    showDamageIndicator() {
        this.hud.classList.remove('damage-flash');
        // Force reflow so the animation restarts
        void this.hud.offsetWidth;
        this.hud.classList.add('damage-flash');

        setTimeout(() => {
            this.hud.classList.remove('damage-flash');
        }, 300);
    }

    /* ──────────────────────────────────────────────────────────
       Crosshair
       ────────────────────────────────────────────────────────── */

    /**
     * Update crosshair spread state.
     * @param {boolean} isMoving   — Player is moving.
     * @param {boolean} isShooting — Player is firing.
     */
    updateCrosshair(isMoving, isShooting) {
        if (isMoving || isShooting) {
            this.crosshair.classList.add('crosshair-spread');
        } else {
            this.crosshair.classList.remove('crosshair-spread');
        }
    }

    /* ──────────────────────────────────────────────────────────
       Score
       ────────────────────────────────────────────────────────── */

    /**
     * Update kill / death counters.
     * @param {number} kills
     * @param {number} deaths
     */
    updateScore(kills, deaths) {
        this.scoreKills.textContent = kills;
        this.scoreDeaths.textContent = deaths;
    }

    /* ──────────────────────────────────────────────────────────
       Death Screen
       ────────────────────────────────────────────────────────── */

    /**
     * Show the death overlay with a 5-second respawn countdown.
     * @param {string} killerName — Name of the player/bot that scored the kill.
     * @returns {Promise<void>} Resolves when the countdown reaches 0.
     */
    showDeathScreen(killerName) {
        // Clean up any existing countdown
        this._clearRespawnTimers();

        this.deathInfo.textContent = `Killed by ${killerName}`;
        this.deathScreen.classList.add('active');

        let remaining = 5;
        this.respawnTimer.textContent = remaining;

        return new Promise((resolve) => {
            this._respawnInterval = setInterval(() => {
                remaining -= 1;
                this.respawnTimer.textContent = Math.max(0, remaining);

                if (remaining <= 0) {
                    this._clearRespawnTimers();
                    this.hideDeathScreen();
                    resolve();
                }
            }, 1000);
        });
    }

    /** Hide the death screen. */
    hideDeathScreen() {
        this._clearRespawnTimers();
        this.deathScreen.classList.remove('active');
    }

    /** Internal: clear countdown timers. */
    _clearRespawnTimers() {
        if (this._respawnInterval) {
            clearInterval(this._respawnInterval);
            this._respawnInterval = null;
        }
        if (this._respawnTimeout) {
            clearTimeout(this._respawnTimeout);
            this._respawnTimeout = null;
        }
    }

    /* ──────────────────────────────────────────────────────────
       Team Indicator
       ────────────────────────────────────────────────────────── */

    showTeamIndicator(team) {
        const el = document.getElementById('team-indicator');
        if (!el) return;
        el.className = '';
        el.classList.add(team === 'blue' ? 'team-blue' : 'team-red');
        el.textContent = `TEAM ${team.toUpperCase()}`;
        el.style.display = 'block';
    }

    hideTeamIndicator() {
        const el = document.getElementById('team-indicator');
        if (el) el.style.display = 'none';
    }

    /* ──────────────────────────────────────────────────────────
       Hit Marker & Headshot
       ────────────────────────────────────────────────────────── */

    showHitMarker() {
        const el = document.getElementById('hit-marker');
        if (!el) return;
        el.style.display = 'block';
        el.classList.remove('active');
        void el.offsetWidth; // Force reflow to restart animation
        el.classList.add('active');
        clearTimeout(this._hitMarkerTimeout);
        this._hitMarkerTimeout = setTimeout(() => {
            el.style.display = 'none';
            el.classList.remove('active');
        }, 200);
    }

    showHeadshotText() {
        const el = document.getElementById('headshot-text');
        if (!el) return;
        el.style.display = 'block';
        el.classList.remove('active');
        void el.offsetWidth;
        el.classList.add('active');
        clearTimeout(this._headshotTimeout);
        this._headshotTimeout = setTimeout(() => {
            el.style.display = 'none';
            el.classList.remove('active');
        }, 600);
    }
}
