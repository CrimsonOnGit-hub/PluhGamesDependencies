/* global BABYLON */
import { Engine } from './engine.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { STORY } from './story.js';
import { audio } from './audio.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.uiOverlay = document.getElementById('ui-overlay');
        
        this.engine = new Engine(this.container);
        this.world = new World(this.engine);
        this.ui = new UI(this.uiOverlay);

        this.state = {
            actIndex: 0,
            sceneIndex: 0,
            morale: 50,
            starveCount: 0,
            lastChoiceWasStarve: false,
            hasEatenThisTrial: false,
            inventory: new Set(),
            flags: new Set(),
            currentAct: null,
            currentScene: null,
            isExploring: false
        };

        this.setupEngineHooks();
        this.setupPauseAndSettingsUI();
        this.setupStartScreen();
    }

    setupEngineHooks() {
        this.engine.onInteract = (interactable) => {
            if (interactable && interactable.callback) {
                interactable.callback();
            }
        };

        this.engine.onPointerLockChange = (isLocked) => {
            if (!isLocked && this.state.isExploring && !this.state.isPaused) {
                this.showPauseMenu();
            }
        };

        let lastTime = performance.now();
        const animate = (now) => {
            requestAnimationFrame(animate);
            const delta = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;

            this.engine.update(delta);

            // MORALE ZERO BREAKDOWN CHECK
            if (this.state.morale <= 0 && !this.state.isInsanityTriggered) {
                this.state.isInsanityTriggered = true;
                this.runCutscene('bad_ending_morale');
            }

            // Footstep audio synthesizer tick
            const keys = this.engine.keys;
            if (this.engine.player.canMove && (keys.w || keys.a || keys.s || keys.d)) {
                this.state.footstepTimer = (this.state.footstepTimer || 0) + delta;
                if (this.state.footstepTimer > 0.38) {
                    this.state.footstepTimer = 0;
                    audio.playFootstep();
                }
            }

            if (this.state.isExploring) {
                if (this.engine.currentInteractable) {
                    this.ui.highlightCrosshair(true);
                    this.ui.showInteractPrompt(this.engine.currentInteractable.label);
                } else {
                    this.ui.highlightCrosshair(false);
                    this.ui.hideInteractPrompt();
                }
            } else {
                this.ui.highlightCrosshair(false);
                this.ui.hideInteractPrompt();
            }
        };
        requestAnimationFrame(animate);
    }

    setupPauseAndSettingsUI() {
        const pauseMenu = document.getElementById('pause-menu');
        const settingsModal = document.getElementById('settings-modal');
        const resumeBtn = document.getElementById('resume-btn');
        const pauseSettingsBtn = document.getElementById('pause-settings-btn');
        const startSettingsBtn = document.getElementById('start-settings-btn');
        const closeSettingsBtn = document.getElementById('close-settings-btn');
        const toggleMobileBtn = document.getElementById('toggle-mobile-btn');
        const mainMenuBtn = document.getElementById('main-menu-btn');

        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                this.hidePauseMenu();
                if (this.state.isExploring) {
                    this.engine.enablePointerLock();
                }
            });
        }

        if (pauseSettingsBtn) {
            pauseSettingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        }

        if (startSettingsBtn) {
            startSettingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        }

        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                this.hideSettings();
            });
        }

        if (toggleMobileBtn) {
            toggleMobileBtn.addEventListener('click', () => {
                const isCurrentlyActive = toggleMobileBtn.classList.contains('active');
                this.engine.setMobileControlsEnabled(!isCurrentlyActive);
            });
        }

        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', () => {
                this.hidePauseMenu();
                this.hideSettings();
                this.state.isExploring = false;
                this.engine.setPlayerCanMove(false);
                this.ui.hideHUD();
                this.ui.hideCrosshair();
                const startScreen = document.getElementById('start-screen');
                if (startScreen) startScreen.classList.remove('screen-hidden');
            });
        }
    }

    showPauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('screen-hidden');
        this.state.isPaused = true;
        this.engine.disablePointerLock();
        this.engine.setPlayerCanMove(false);
    }

    hidePauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('screen-hidden');
        this.state.isPaused = false;
        if (this.state.isExploring) {
            this.engine.setPlayerCanMove(true);
        }
    }

    showSettings() {
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) settingsModal.classList.remove('screen-hidden');
    }

    hideSettings() {
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) settingsModal.classList.add('screen-hidden');
    }

    setupStartScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const startScreen = document.getElementById('start-screen');
        const loadingBarFill = document.getElementById('loading-bar-fill');
        const loadingStatus = document.getElementById('loading-status');

        const storyModeBtn = document.getElementById('story-mode-btn');
        const freeplayBtn = document.getElementById('freeplay-btn');
        const actSelectModal = document.getElementById('act-select-modal');
        const backToMenuBtn = document.getElementById('back-to-menu-btn');
        const actButtons = document.querySelectorAll('.act-select-btn');

        let progress = 0;
        const interval = setInterval(() => {
            progress += 25;
            if (loadingBarFill) loadingBarFill.style.width = `${progress}%`;
            if (progress >= 100) {
                clearInterval(interval);
                if (loadingStatus) loadingStatus.textContent = 'READY';
                setTimeout(() => {
                    if (loadingScreen) loadingScreen.classList.add('screen-hidden');
                    if (startScreen) startScreen.classList.remove('screen-hidden');
                }, 200);
            }
        }, 80);

        // Story Mode: Starts from Act I
        if (storyModeBtn) {
            storyModeBtn.addEventListener('click', () => {
                this.launchGameFromAct(0);
            });
        }

        // Freeplay Mode: Opens Act Select Modal
        if (freeplayBtn) {
            freeplayBtn.addEventListener('click', () => {
                if (actSelectModal) actSelectModal.classList.remove('screen-hidden');
            });
        }

        // Back to Menu Button
        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', () => {
                if (actSelectModal) actSelectModal.classList.add('screen-hidden');
            });
        }

        // Act Select Buttons
        actButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const actIndex = parseInt(btn.getAttribute('data-act'), 10);
                this.launchGameFromAct(actIndex);
            });
        });
    }

    launchGameFromAct(actIndex) {
        audio.init();
        const startScreen = document.getElementById('start-screen');
        const actSelectModal = document.getElementById('act-select-modal');
        
        if (startScreen) startScreen.classList.add('screen-hidden');
        if (actSelectModal) actSelectModal.classList.add('screen-hidden');
        if (this.uiOverlay) this.uiOverlay.classList.remove('screen-hidden');
        
        this.ui.showHUD();
        this.ui.showCrosshair();
        this.ui.updateMorale(this.state.morale);

        this.state.actIndex = actIndex;
        this.state.starveCount = 0;
        this.state.lastChoiceWasStarve = false;
        this.state.hasEatenThisTrial = false;
        
        this.loadAct(actIndex);
    }

    async loadAct(actIndex) {
        if (actIndex >= STORY.acts.length) {
            await this.ui.fadeToBlack(1000);
            await this.ui.showTitle('THE END', 'Freedom at last', 5000);
            return;
        }

        const act = STORY.acts[actIndex];
        this.state.currentAct = act;
        this.state.actIndex = actIndex;

        await this.ui.fadeToBlack(400);

        this.buildEnvironmentForAct(act.environment);

        await this.ui.showTitle(act.title.toUpperCase(), act.subtitle, 2000);
        await this.ui.fadeFromBlack(400);

        this.state.sceneIndex = 0;
        await this.playScene(act.scenes[0]);
    }

    buildEnvironmentForAct(envName) {
        let worldData = {};
        if (envName === 'rationsRoom') {
            worldData = this.world.buildRationsRoom();
            this.engine.setPlayerPosition(0, 1.7, 1);
            this.engine.yaw = Math.PI; // Face metal table and rations block directly!
            this.engine.pitch = -0.25;
            this.engine.playerRig.rotation.y = Math.PI;
            this.engine.camera.rotation.x = -0.25;
        } else if (envName === 'courtroom') {
            worldData = this.world.buildCourtroom();
            this.engine.setPlayerPosition(0, 1.7, 3);
            this.engine.yaw = Math.PI; // Face President Crimson directly!
            this.engine.pitch = -0.08;
            this.engine.playerRig.rotation.y = Math.PI;
            this.engine.camera.rotation.x = -0.08;
        } else if (envName.startsWith('residentialQuarters')) {
            worldData = this.world.buildResidentialQuarters(envName);
            this.engine.setPlayerPosition(0, 1.7, 2);
        } else if (envName === 'interrogationBlock') {
            worldData = this.world.buildInterrogationBlock();
            this.engine.setPlayerPosition(-3, 1.7, 0);
        } else if (envName === 'ocean') {
            worldData = this.world.buildOcean();
            this.engine.setPlayerPosition(0, 1.7, 0);
        } else if (envName === 'beach') {
            worldData = this.world.buildBeach();
            this.engine.setPlayerPosition(0, 1.7, 5);
        } else if (envName === 'museum') {
            worldData = this.world.buildMuseum();
            this.engine.setPlayerPosition(0, 1.7, 5);
        } else {
            worldData = this.world.buildRationsRoom();
        }

        this.currentWorldObjects = worldData.objects || {};
    }

    async runCutscene(cutsceneType) {
        this.ui.showLetterbox();
        this.engine.setPlayerCanMove(false);
        
        switch (cutsceneType) {
            case 'courtroom_rage': {
                this.buildEnvironmentForAct('courtroom');
                this.engine.setPlayerPosition(0, 1.7, 3);
                this.engine.yaw = 0; // Force rotation to face straight at Crimson (-Z)
                this.engine.pitch = 0;
                this.engine.playerRig.rotation.y = 0;
                this.engine.camera.rotation.x = 0;
                
                const crimson = this.currentWorldObjects.crimson;

                audio.playTableHit();
                this.engine.screenShake(0.8, 1500);
                this.engine.screenFlash('#dc143c', 800);

                await this.animate3DSequence((progress) => {
                    this.engine.playerRig.position.z = 3 - progress * 2;
                    if (crimson) crimson.position.y = Math.sin(progress * Math.PI * 4) * 0.2;
                }, 2000);

                await this.ui.showCutsceneBanner('President Crimson: "If you want your stupid ass bunny shirts mandatory, then split off of Crimson Island and make your own country!"', 3000);
                
                this.engine.screenShake(1.2, 2000);
                this.engine.screenFlash('#ffaa44', 500);
                await this.ui.showCutsceneBanner('JULY 20, 2023: Tectonic Thrusters engage! Restrictia rips away from Crimson Island!', 3000);
                break;
            }

            case 'jake_drown': {
                // Environment only has Glory & Jake (no extra people!)
                this.buildEnvironmentForAct('residentialQuarters_glory_jake');
                
                const jake = this.currentWorldObjects.jake || this.world.createCharacterMesh(0x1a1a1a, 1.45, true, 'spiky'); // 13 yrs old
                jake.position.set(0, 0, -4);
                jake.rotation.y = 0; // Face forward (+Z toward ocean opening)

                // Player starts behind Jake
                this.engine.setPlayerPosition(0, 1.7, -7);

                await this.ui.showCutsceneBanner('Jake: "I think we can just swim to Crimson Island! I\'m diving in now!"', 2500);

                // Stage 1: Jake runs to the coastline edge, player follows behind
                await this.animate3DSequence((p) => {
                    const time = p * 4;
                    // Jake runs to z = 17.5
                    jake.position.z = -4 + p * 21.5;
                    this.world.animateCharacter(jake, 'run', time);

                    // Player follows behind to coastline edge (z = 15.5)
                    this.engine.playerRig.position.z = -7 + p * 22.5;
                }, 3000);

                // Stage 2: Jake leaps off the edge into the ocean water!
                await this.animate3DSequence((p) => {
                    jake.position.z = 17.5 + p * 3;
                    jake.position.y = Math.sin(p * Math.PI) * 1.5 - p * p * 2.5;
                    this.world.animateCharacter(jake, 'run', p * 2);
                }, 1000);

                // Big Water Splash upon landing
                audio.playPneumaticHiss();
                this.engine.screenFlash('#0055aa', 600);
                this.engine.screenShake(0.6, 800);

                // Stage 3: Panic sets in! Jake screams he doesn't know how to swim!
                await this.ui.showCutsceneBanner('Jake: "WAIT I DONT KNOW HOW TO SWIM! HELP!"', 3000);

                // Stage 4: Frantic struggling, slowly getting weaker and stopping until he sinks
                let splashTimer = 0;
                await this.animate3DSequence((p) => {
                    // Animation speed and movement decay as p -> 1 (he stops trying)
                    const speed = (1 - p * 0.75); 
                    const time = p * 8 * speed;
                    
                    jake.position.z = 20.5 + p * 3;
                    jake.position.y = -1.2 - (p * p) * 2.2; // Sinks deeper as he stops trying
                    
                    // Animate drowning struggle getting slower & weaker
                    this.world.animateCharacter(jake, 'drown', time);

                    splashTimer += 16;
                }, 4500);

                jake.dispose();

                await this.ui.showCutsceneBanner('NOVEMBER 12, 2023: The ocean current swallows Jake... your best friend is gone.', 3500);
                break;
            }

            case 'glory_execution': {
                // PHASE 1: Sneaking onto Cargo Ship at Dock
                this.buildEnvironmentForAct('ocean');
                this.engine.setPlayerPosition(0, 3, 5);

                const gloryShip = this.world.createCharacterMesh(0x2a1506, 1.7, true, 'female');
                gloryShip.position.set(0, 0, -5);

                await this.ui.showCutsceneBanner('December 13, 2023. Glory sneaks onto a cargo ship bound for Crimson Island...', 2500);

                // Glory walks stealthily across the ship deck
                await this.animate3DSequence((p) => {
                    gloryShip.position.z = -5 - p * 8;
                    this.world.animateCharacter(gloryShip, 'walk', p * 3);
                }, 2000);

                // Guards burst in & corner her
                audio.playSiren();
                this.engine.screenFlash('#ff0000', 600);
                this.engine.screenShake(0.8, 1000);

                const gShip1 = this.world.createCharacterMesh(0x1a1a1a, 1.8, false);
                gShip1.position.set(-2, 0, -15);
                this.world.equipGun(gShip1, 'pistol');

                const gShip2 = this.world.createCharacterMesh(0x2a1506, 1.8, false);
                gShip2.position.set(2, 0, -15);
                this.world.equipGun(gShip2, 'pistol');

                await this.ui.showCutsceneBanner('SIRENS BLARE! "INTRUDER ON THE CARGO BAY!" Guards corner Glory!', 2500);

                // PHASE 2: Carried Back by Guards to the Sector
                this.buildEnvironmentForAct('residentialQuarters_full');
                this.engine.setPlayerPosition(0, 1.7, 8);

                const gloryDrag = this.world.createCharacterMesh(0x2a1506, 1.7, true, 'female');
                const guardDragL = this.world.createCharacterMesh(0x1a1a1a, 1.8, false);
                const guardDragR = this.world.createCharacterMesh(0x2a1506, 1.8, false);

                await this.ui.showCutsceneBanner('Guards overpower Glory and carry her back into the sector...', 2500);

                await this.animate3DSequence((p) => {
                    const time = p * 4;
                    const z = -10 + p * 12;
                    gloryDrag.position.set(0, 0.4, z);
                    guardDragL.position.set(-0.9, 0, z);
                    guardDragR.position.set(0.9, 0, z);

                    this.world.animateCharacter(gloryDrag, 'struggle', time);
                    this.world.animateCharacter(guardDragL, 'walk', time);
                    this.world.animateCharacter(guardDragR, 'walk', time);
                }, 3000);

                // PHASE 3: Miles Escorted by Guards to Watch
                const guardEscort1 = this.world.createCharacterMesh(0x111115, 1.85, false);
                guardEscort1.position.set(-1.2, 0, 7);

                const guardEscort2 = this.world.createCharacterMesh(0x111115, 1.85, false);
                guardEscort2.position.set(1.2, 0, 7);

                await this.ui.showCutsceneBanner('Guards grab you and force you to the execution line...', 2500);

                // PHASE 4: Execution
                const executioner = this.world.createCharacterMesh(0x111115, 1.85, false);
                executioner.position.set(0, 0, -2);
                this.world.equipGun(executioner, 'pistol');

                gloryDrag.position.set(0, 0, -4);
                gloryDrag.rotation.y = Math.PI;

                await this.ui.showCutsceneBanner('Council Enforcer aims pistol at Glory. "Any last words, rebel?"', 2500);

                // Gunfire & Execution
                audio.playGunshot();
                this.world.gunshot(executioner.position, gloryDrag);

                await new Promise(r => setTimeout(r, 2000));

                await this.ui.showCutsceneBanner('DECEMBER 13, 2023: Glory is executed by Council enforcers before your eyes. You are hollow.', 4000);
                
                gloryDrag.dispose();
                guardDragL.dispose();
                guardDragR.dispose();
                guardEscort1.dispose();
                guardEscort2.dispose();
                executioner.dispose();
                break;
            }

            case 'shirt_tear': {
                audio.playSiren();
                this.engine.screenFlash('#ffffff', 600);
                this.engine.screenShake(1.0, 1500);

                this.buildEnvironmentForAct('interrogationBlock');
                this.engine.setPlayerPosition(0, 1.7, 2);

                await this.ui.showCutsceneBanner('MILES TEARS OFF THE BUNNY SHIRT! SIRENS BLARE: WAAAAAAAH! WAAAAAAAH!', 3000);
                break;
            }

            case 'shoot_james': {
                audio.playGunshot();
                this.engine.screenFlash('#ffffcc', 400);
                this.engine.screenShake(0.7, 800);

                const james = this.currentWorldObjects.james;
                if (james) {
                    await this.animate3DSequence((p) => {
                        james.position.y = Math.abs(Math.sin(p * Math.PI * 6)) * 0.3;
                    }, 1500);
                }

                await this.ui.showCutsceneBanner('*BANG!* Shot James in the foot! Wrapped heavy military bandage & fed pain pill.', 2500);
                break;
            }

            case 'chute_launch': {
                this.buildEnvironmentForAct('ocean');
                const raft = this.currentWorldObjects.raft;

                audio.playSiren();
                this.engine.screenShake(1.2, 2500);

                if (raft) {
                    await this.animate3DSequence((p) => {
                        raft.position.z = -p * 40;
                        this.engine.playerRig.position.z = raft.position.z + 1;
                    }, 3000);
                }

                await this.ui.showCutsceneBanner('LAUNCHING DOWN THE WASTE CHUTE — 58,000 AAA BATTERY MATRIX IGNITES!', 3000);
                break;
            }

            case 'beach_crash': {
                this.buildEnvironmentForAct('beach');
                audio.playGunshot();
                this.engine.screenShake(1.5, 2500);
                this.engine.screenFlash('#ff6600', 1000);

                await this.ui.showCutsceneBanner('BOOM! Rocket pallet slams into Crimson Island beach! Emergency battery explodes into flames!', 3000);
                break;
            }

            case 'starve_rations_retract': {
                this.buildEnvironmentForAct('rationsRoom');
                
                // PA Speaker / Security Camera Perspective (High Corner Lens)
                const milesMesh = this.world.createCharacterMesh(0x1a1a1a, 1.4, true); // 13yo Miles
                milesMesh.position.set(0, 0, 1.8);
                milesMesh.lookAt(new BABYLON.Vector3(0, 0.4, 0));

                // Mount camera at PA Speaker position (high corner x=2.2, y=2.6, z=2.2) angled down
                this.engine.setPlayerPosition(2.2, 2.6, 2.2);
                this.engine.yaw = Math.PI * 0.25;
                this.engine.pitch = -0.65;
                this.engine.playerRig.rotation.y = Math.PI * 0.25;
                this.engine.camera.rotation.x = -0.65;

                const rations = this.currentWorldObjects.rations;

                await this.animate3DSequence((p) => {
                    milesMesh.position.z = 1.8 - p * 1.05; // Walks to (0, 0, 0.75) in front of table
                    milesMesh.lookAt(new BABYLON.Vector3(0, 0.4, 0));
                    this.world.animateCharacter(milesMesh, 'walk', p * 4);
                }, 2000);

                this.world.animateCharacter(milesMesh, 'idle', 0);
                audio.playPneumaticHiss();

                // Pneumatic tray retracts into metal table
                if (rations) {
                    await this.animate3DSequence((p) => {
                        rations.position.y = 0.85 - p * 0.45;
                        const s = 1 - p * 0.8;
                        rations.scaling.set(s, s, s);
                    }, 1200);
                    rations.setEnabled(false);
                }

                await this.ui.showCutsceneBanner('[CAM-01 / PA SYSTEM] *HISS!* Pneumatic tray retracts into the table. Rations withheld.', 2500);

                // Smooth fade back to 1st person perspective from Miles's eyes
                await this.ui.fadeToBlack(400);
                milesMesh.dispose();

                this.engine.setPlayerPosition(0, 1.7, 1.0); // Reset to 1st person eye-level
                this.engine.yaw = Math.PI;
                this.engine.pitch = -0.15;
                this.engine.playerRig.rotation.y = Math.PI;
                this.engine.camera.rotation.x = -0.15;
                
                await this.ui.fadeFromBlack(400);
                break;
            }

            case 'glory_arrival': {
                // Miles watches from inside his apartment door at (-5, 1.7, -11)
                this.buildEnvironmentForAct('residentialQuarters_empty');
                this.engine.setPlayerPosition(-5, 1.7, -11);

                const guard = this.world.createCharacterMesh(0x111115, 1.85, false);
                const glory = this.world.createCharacterMesh(0x2a1506, 1.7, true, 'female');
                
                guard.position.set(16.5, 0, 1.5);
                glory.position.set(16, 0, 0);
                this.currentWorldObjects.glory = glory;

                await this.ui.showCutsceneBanner('Early 2023. Guard door opens... A new resident is escorted into the sector.', 2500);

                await this.animate3DSequence((p) => {
                    const time = p * 4;
                    glory.position.x = 16 - p * 13; // Glory walks to x = 3 (her room)
                    this.world.animateCharacter(glory, 'walk', time);
                    this.world.animateCharacter(guard, 'idle', 0);

                    // Dynamic Camera Tracking from Miles's room doorway:
                    const camPos = new BABYLON.Vector3(-5, 1.7, -11);
                    const targetHead = glory.position.clone();
                    targetHead.y += 1.6;
                    const dir = targetHead.subtract(camPos);
                    this.engine.yaw = Math.atan2(dir.x, dir.z);
                    this.engine.pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                    this.engine.playerRig.rotation.y = this.engine.yaw;
                    this.engine.camera.rotation.x = this.engine.pitch;
                }, 3000);

                this.world.animateCharacter(glory, 'idle', 0);
                if (guard) guard.dispose();

                // TIME-SKIP TRANSITION
                await this.ui.fadeToBlack(1000);
                await this.ui.showCutsceneBanner('A couple of days pass in the sector... You step out of your room to meet Glory.', 3000);
                
                // Miles steps out of his room into the open courtyard
                this.engine.setPlayerPosition(0, 1.7, -5);
                await this.ui.fadeFromBlack(1000);
                break;
            }

            case 'jake_arrival': {
                // Miles & Glory watch from their rooms as 13yo Jake arrives
                this.buildEnvironmentForAct('residentialQuarters_glory');
                this.engine.setPlayerPosition(-5, 1.7, -11);

                const guard = this.world.createCharacterMesh(0x111115, 1.85, false);
                const jake = this.world.createCharacterMesh(0x1a1a1a, 1.45, true, 'spiky'); // 13yo Jake
                
                guard.position.set(16.5, 0, 1.5);
                jake.position.set(16, 0, 0);
                this.currentWorldObjects.jake = jake;

                await this.ui.showCutsceneBanner('July 27, 2023. A 13-year-old boy named Jake is escorted into the sector.', 2500);

                await this.animate3DSequence((p) => {
                    const time = p * 4;
                    jake.position.x = 16 - p * 20; // Jake walks to x = -4 (his room)
                    this.world.animateCharacter(jake, 'walk', time);
                    this.world.animateCharacter(guard, 'idle', 0);

                    // Dynamic Camera Tracking: Follow Jake!
                    const camPos = new BABYLON.Vector3(-5, 1.7, -11);
                    const targetHead = jake.position.clone();
                    targetHead.y += 1.4;
                    const dir = targetHead.subtract(camPos);
                    this.engine.yaw = Math.atan2(dir.x, dir.z);
                    this.engine.pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                    this.engine.playerRig.rotation.y = this.engine.yaw;
                    this.engine.camera.rotation.x = this.engine.pitch;
                }, 3000);

                this.world.animateCharacter(jake, 'idle', 0);
                if (guard) guard.dispose();

                // TIME-SKIP TRANSITION
                await this.ui.fadeToBlack(1000);
                await this.ui.showCutsceneBanner('A couple of days pass... You walk out into the courtyard to talk to Jake.', 3000);

                // Miles steps out into the open courtyard
                this.engine.setPlayerPosition(0, 1.7, -5);
                await this.ui.fadeFromBlack(1000);
                break;
            }

            case 'lily_arrival': {
                // Glory and Jake are gone. Miles watches from his room as Lily arrives.
                this.buildEnvironmentForAct('residentialQuarters_empty');
                this.engine.setPlayerPosition(-5, 1.7, -11);

                const guard = this.world.createCharacterMesh(0x111115, 1.85, false);
                guard.position.set(16.5, 0, 1.5);
                const lily = this.world.createCharacterMesh(0x3a1a08, 1.7, true, 'female');
                lily.position.set(16, 0, 0);
                this.currentWorldObjects.lily = lily;

                await this.ui.showCutsceneBanner('Early 2024. A new resident arrives at the sector door...', 2500);

                await this.animate3DSequence((p) => {
                    lily.position.x = 16 - p * 11;
                    this.world.animateCharacter(lily, 'walk', p * 4);
                    this.world.animateCharacter(guard, 'idle', 0);

                    // Dynamic Camera Tracking: Follow Lily!
                    const camPos = new BABYLON.Vector3(-5, 1.7, -11);
                    const targetHead = lily.position.clone();
                    targetHead.y += 1.6;
                    const dir = targetHead.subtract(camPos);
                    this.engine.yaw = Math.atan2(dir.x, dir.z);
                    this.engine.pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                    this.engine.playerRig.rotation.y = this.engine.yaw;
                    this.engine.camera.rotation.x = this.engine.pitch;
                }, 2500);

                this.world.animateCharacter(lily, 'idle', 0);
                if (guard) guard.dispose();

                // TIME-SKIP TRANSITION
                await this.ui.fadeToBlack(1000);
                await this.ui.showCutsceneBanner('A couple of days pass... You freeze seeing Lily\'s identical resemblance to Glory.', 3000);

                // Miles steps out into the courtyard
                this.engine.setPlayerPosition(0, 1.7, -5);
                await this.ui.fadeFromBlack(1000);
                break;
            }

            case 'james_arrival': {
                // Miles & Lily watch as James arrives
                this.buildEnvironmentForAct('residentialQuarters_lily');
                this.engine.setPlayerPosition(-5, 1.7, -11);

                const james = this.world.createCharacterMesh(0xb8860b, 1.7, true, 'spiky');
                james.position.set(16, 0, 0);
                this.currentWorldObjects.james = james;

                await this.ui.showCutsceneBanner('2025. Nationalist warden James marches into the residential quarters!', 2500);

                await this.animate3DSequence((p) => {
                    james.position.x = 16 - p * 21;
                    this.world.animateCharacter(james, 'run', p * 5);

                    const camPos = new BABYLON.Vector3(-5, 1.7, -11);
                    const targetHead = james.position.clone();
                    targetHead.y += 1.7;
                    const dir = targetHead.subtract(camPos);
                    this.engine.yaw = Math.atan2(dir.x, dir.z);
                    this.engine.pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                    this.engine.playerRig.rotation.y = this.engine.yaw;
                    this.engine.camera.rotation.x = this.engine.pitch;
                }, 2500);

                this.world.animateCharacter(james, 'idle', 0);

                // TIME-SKIP TRANSITION
                await this.ui.fadeToBlack(1000);
                await this.ui.showCutsceneBanner('Days pass as James aggressively patrols camera blind spots...', 3000);

                this.engine.setPlayerPosition(0, 1.7, -5);
                await this.ui.fadeFromBlack(1000);
                break;
            }

            case 'blue_arrival': {
                // Miles, Lily, James watch as Blue arrives
                this.buildEnvironmentForAct('residentialQuarters_lily_james');
                this.engine.setPlayerPosition(-5, 1.7, -11);

                const blue = this.world.createCharacterMesh(0x0e0e0e, 1.7, true, 'spiky');
                blue.position.set(16, 0, 0);
                this.currentWorldObjects.blue = blue;

                await this.ui.showCutsceneBanner('Then came Blue. Unshakeable iron core posture.', 2500);

                await this.animate3DSequence((p) => {
                    blue.position.x = 16 - p * 16;
                    this.world.animateCharacter(blue, 'walk', p * 3.5);

                    const camPos = new BABYLON.Vector3(-5, 1.7, -11);
                    const targetHead = blue.position.clone();
                    targetHead.y += 1.7;
                    const dir = targetHead.subtract(camPos);
                    this.engine.yaw = Math.atan2(dir.x, dir.z);
                    this.engine.pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                    this.engine.playerRig.rotation.y = this.engine.yaw;
                    this.engine.camera.rotation.x = this.engine.pitch;
                }, 2500);

                this.world.animateCharacter(blue, 'idle', 0);

                // TIME-SKIP TRANSITION
                await this.ui.fadeToBlack(1000);
                await this.ui.showCutsceneBanner('A couple of days pass... Blue gives you an unshakeable nod of support in the courtyard.', 3000);

                this.engine.setPlayerPosition(0, 1.7, -5);
                await this.ui.fadeFromBlack(1000);
                break;
            }

            case 'bad_ending_starve': {
                this.engine.screenFlash('#000000', 1000);
                this.engine.setPlayerPosition(0, 0.3, 0);
                await this.ui.showCutsceneBanner('Glory enters the room... "Miles? Wake up... please NOOOOO!"', 4000);
                await this.ui.fadeToBlack(1000);
                await this.ui.showTitle('BAD ENDING', 'The Price of Defiance — You kept your name, but starved to death.', 7000);
                break;
            }

            case 'last_stand_attack': {
                this.buildEnvironmentForAct('residentialQuarters_full');
                this.engine.setPlayerPosition(0, 1.8, 8); // 3rd person camera behind Miles

                const milesMesh = this.world.createCharacterMesh(0x1a1a1a, 1.7, true);
                milesMesh.position.set(0, 0, 6);

                // Miles wields sharp metal scrap
                const scrapMat = new BABYLON.StandardMaterial("scrapMat", this.engine.scene);
                scrapMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.85);
                const weapon = BABYLON.MeshBuilder.CreateBox("weapon", { width: 0.04, height: 0.4, depth: 0.04 }, this.engine.scene);
                weapon.parent = milesMesh;
                weapon.rotation.z = Math.PI / 4;
                weapon.position.set(0.3, 0.8, 0.2);
                weapon.material = scrapMat;

                // Council Guards stationed at guard door
                const guard1 = this.world.createCharacterMesh(0x111115, 1.85, false);
                guard1.position.set(-1.5, 0, -4);
                this.world.equipGun(guard1, 'pistol');

                const guard2 = this.world.createCharacterMesh(0x111115, 1.85, false);
                guard2.position.set(1.5, 0, -4);
                this.world.equipGun(guard2, 'pistol');

                await this.ui.showCutsceneBanner('SANITY BROKEN: Miles screams in rage and charges the Council Guards with a sharp metal scrap!', 2500);

                // Miles charges full speed at guards
                await this.animate3DSequence((p) => {
                    milesMesh.position.z = 6 - p * 8; // Charges forward to z = -2
                    this.world.animateCharacter(milesMesh, 'run', p * 6);
                    this.engine.playerRig.position.z = 8 - p * 6;
                }, 2000);

                // Guards raise weapons and fire
                audio.playSiren();
                audio.playGunshot();
                this.world.gunshot(guard1.position, milesMesh);
                this.engine.screenFlash('#ff0000', 800);
                this.engine.screenShake(1.0, 1200);

                await new Promise(r => setTimeout(r, 2000));

                milesMesh.dispose();
                guard1.dispose();
                guard2.dispose();
                break;
            }

            case 'bad_ending_morale': {
                this.engine.setPlayerCanMove(false);
                this.engine.screenFlash('#660000', 1500);
                this.engine.screenShake(0.8, 2000);

                await this.ui.showCutsceneBanner('SANITY COLLAPSE: Morale reached 0%! The psychological weight of Restrictia shatters your mind...', 3000);

                // Interactive Insanity Breakdown Choices
                const fateChoices = [
                    { text: 'Premature Cargo Ship Escape (Suffer Glory\'s Execution Fate)' },
                    { text: 'Desperately dive into the ocean (Suffer Jake\'s Drowning Fate)' },
                    { text: 'Reckless Last Stand: Charge the Council guards with sharp metal scrap' }
                ];

                const chosenIdx = await this.ui.showDialogue('Miles (Insane)', 'Your morale is zero. Choose how your story ends in madness:', fateChoices);
                this.ui.hideDialogue();

                if (chosenIdx === 0) {
                    // Glory's Fate
                    await this.runCutscene('glory_execution');
                    await this.ui.showTitle('BAD ENDING: EXECUTED', 'You tried to escape early. The Council enforcers ended your rebellion.', 7000);
                } else if (chosenIdx === 1) {
                    // Jake's Fate
                    await this.runCutscene('jake_drown');
                    await this.ui.showTitle('BAD ENDING: SWALLOWED BY THE SEA', 'You leaped into the ocean without a raft. The current claimed another soul.', 7000);
                } else {
                    // Last Stand Attack
                    await this.runCutscene('last_stand_attack');
                    await this.ui.showTitle('BAD ENDING: LAST STAND', 'Your sanity broke. You charged the guards in a desperate last stand and were cut down.', 7000);
                }
                break;
            }

            default:
                break;
        }

        this.ui.hideLetterbox();
    }

    animate3DSequence(updateCallback, durationMs) {
        return new Promise((resolve) => {
            const start = performance.now();
            const step = (now) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / durationMs, 1.0);
                
                updateCallback(progress);

                if (progress < 1.0) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    async playScene(scene) {
        if (!scene) {
            await this.loadAct(this.state.actIndex + 1);
            return;
        }

        this.state.currentScene = scene;

        if (scene.environment) {
            this.buildEnvironmentForAct(scene.environment);
        }

        if (scene.cutscene) {
            await this.runCutscene(scene.cutscene);
            if (scene.type !== 'exploration') {
                this.advanceScene(scene.nextScene);
                return;
            }
        }

        if (scene.soundEffect) {
            if (scene.soundEffect === 'hit') audio.playTableHit();
            else if (scene.soundEffect === 'eat') {
                audio.playEat();
                if (this.currentWorldObjects.rations) {
                    this.currentWorldObjects.rations.visible = false;
                }
                this.state.hasEatenThisTrial = true;
            }
            else if (scene.soundEffect === 'hiss') {
                audio.playPneumaticHiss();
                this.state.hasEatenThisTrial = false;
            }
            else if (scene.soundEffect === 'siren') audio.playSiren();
            else if (scene.soundEffect === 'shot') audio.playGunshot();
        }

        if (scene.moraleDelta) {
            this.state.morale = Math.max(0, Math.min(100, this.state.morale + scene.moraleDelta));
            this.ui.updateMorale(this.state.morale);

            // MORALE DEATH — if morale hits 0, trigger bad ending
            if (this.state.morale <= 0) {
                await this.runCutscene('bad_ending_morale');
                return;
            }
        }

        if (scene.addItem) {
            this.state.inventory.add(scene.addItem.id);
            this.ui.addInventoryItem(scene.addItem);
        }

        if (scene.removeItem) {
            this.state.inventory.delete(scene.removeItem);
            this.ui.removeInventoryItem(scene.removeItem);
        }

        if (scene.setFlag) {
            this.state.flags.add(scene.setFlag);
        }

        if (scene.screenEffect) {
            if (scene.screenEffect === 'shake') {
                this.engine.screenShake(0.3, 600);
            } else if (scene.screenEffect === 'flash_red') {
                this.engine.screenFlash('#ff0033', 400);
            } else if (scene.screenEffect === 'flash_white') {
                this.engine.screenFlash('#ffffff', 400);
            }
        }

        if (this.currentWorldObjects.rations) {
            if (this.state.lastChoiceWasStarve || this.state.hasEatenThisTrial) {
                this.currentWorldObjects.rations.setEnabled(false);
            } else {
                this.currentWorldObjects.rations.setEnabled(true);
            }
        }

        this.engine.setPlayerCanMove(false);
        this.state.isExploring = false;

        switch (scene.type) {
            case 'narration':
                this.advanceScene(scene.nextScene);
                break;

            case 'dialogue': {
                const speakerKey = (scene.speaker || '').toLowerCase();
                const speakerMesh = this.currentWorldObjects[speakerKey] || this.currentWorldObjects[scene.speaker];
                
                // If speaker is far from player, walk up to player first
                if (speakerMesh && speakerKey !== 'miles' && speakerKey !== 'narrator' && speakerKey !== 'pa') {
                    const playerPos = this.engine.playerRig.position;
                    const dist = BABYLON.Vector3.Distance(speakerMesh.position, playerPos);

                    if (dist > 2.0) {
                        const dirToPlayer = playerPos.subtract(speakerMesh.position).normalize();
                        const targetPos = playerPos.subtract(dirToPlayer.scale(1.6));
                        targetPos.y = speakerMesh.position.y;
                        const startPos = speakerMesh.position.clone();

                        await this.animate3DSequence((p) => {
                            speakerMesh.position = BABYLON.Vector3.Lerp(startPos, targetPos, p);
                            speakerMesh.lookAt(new BABYLON.Vector3(playerPos.x, speakerMesh.position.y, playerPos.z));
                            this.world.animateCharacter(speakerMesh, 'walk', p * 4);
                        }, Math.min(1800, dist * 500));

                        this.world.animateCharacter(speakerMesh, 'idle', 0);
                    } else {
                        speakerMesh.lookAt(new BABYLON.Vector3(playerPos.x, speakerMesh.position.y, playerPos.z));
                    }

                    // Turn player camera to face speaker eyes directly!
                    const camPos = this.engine.playerRig.position;
                    const speakerHead = speakerMesh.position.clone();
                    speakerHead.y += 1.6;
                    const dir = speakerHead.subtract(camPos);
                    this.engine.yaw = Math.atan2(dir.x, dir.z);
                    this.engine.pitch = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
                    this.engine.playerRig.rotation.y = this.engine.yaw;
                    this.engine.camera.rotation.x = this.engine.pitch;
                }

                let isTalking = true;
                if (speakerMesh) {
                    let talkTime = 0;
                    const talkLoop = () => {
                        if (!isTalking) {
                            this.world.animateCharacter(speakerMesh, 'idle', 0);
                            return;
                        }
                        talkTime += 0.016;
                        this.world.animateCharacter(speakerMesh, 'talk', talkTime);
                        requestAnimationFrame(talkLoop);
                    };
                    talkLoop();
                }

                await this.ui.showDialogue(scene.speaker, scene.text);
                isTalking = false;
                if (speakerMesh) this.world.animateCharacter(speakerMesh, 'idle', 0);
                this.ui.hideDialogue();

                // MORALE-DRIVEN PLAYER RESPONSE SYSTEM
                // If an NPC just spoke, Miles responds based on current morale level!
                const isNPC = ['glory', 'jake', 'lily', 'james', 'blue'].includes(speakerKey);
                if (isNPC) {
                    let responseChoices = [];
                    const m = this.state.morale;

                    if (m >= 60) {
                        // High Morale (Defiant & Hopeful)
                        responseChoices = [
                            { text: 'We are going to break out of this cage together, I swear it.', moraleDelta: 5 },
                            { text: 'They can strip our names, but they can never erase who we are.', moraleDelta: 5 },
                            { text: 'I am building a way home. Keep your hope alive.', moraleDelta: 5 }
                        ];
                    } else if (m >= 30) {
                        // Medium Morale (Grounded & Cautious)
                        responseChoices = [
                            { text: 'We just need to keep our heads down and survive for now.', moraleDelta: 0 },
                            { text: 'I am watching the surveillance blind spots carefully...', moraleDelta: 0 },
                            { text: 'Let me handle the guards. Just stay safe.', moraleDelta: 0 }
                        ];
                    } else {
                        // Low Morale (Broken & Hopeless)
                        responseChoices = [
                            { text: 'What is the point... nobody ever escapes Restrictia...', moraleDelta: -5 },
                            { text: 'I do not know how much longer I can endure this cold...', moraleDelta: -5 },
                            { text: 'Every day feels like losing another piece of myself...', moraleDelta: -5 }
                        ];
                    }

                    const choiceIdx = await this.ui.showDialogue('Miles', `Respond as Miles (Morale: ${m}%):`, responseChoices);
                    this.ui.hideDialogue();
                    
                    const chosen = responseChoices[choiceIdx];
                    if (chosen) {
                        if (chosen.moraleDelta) {
                            this.state.morale = Math.max(0, Math.min(100, this.state.morale + chosen.moraleDelta));
                            this.ui.updateMorale(this.state.morale);
                        }

                        // Speak selected response out loud
                        await this.ui.showDialogue('Miles', chosen.text);
                        this.ui.hideDialogue();

                        if (this.state.morale <= 0) {
                            await this.runCutscene('bad_ending_morale');
                            return;
                        }
                    }
                }

                this.advanceScene(scene.nextScene);
                break;
            }

            case 'choice': {
                const speakerKey = (scene.speaker || '').toLowerCase();
                const speakerMesh = this.currentWorldObjects[speakerKey] || this.currentWorldObjects[scene.speaker];
                
                let isTalking = true;
                if (speakerMesh) {
                    let talkTime = 0;
                    const talkLoop = () => {
                        if (!isTalking) {
                            this.world.animateCharacter(speakerMesh, 'idle', 0);
                            return;
                        }
                        talkTime += 0.016;
                        this.world.animateCharacter(speakerMesh, 'talk', talkTime);
                        requestAnimationFrame(talkLoop);
                    };
                    talkLoop();
                }

                const choiceIdx = await this.ui.showDialogue(scene.speaker || '', scene.prompt, scene.choices);
                isTalking = false;
                if (speakerMesh) this.world.animateCharacter(speakerMesh, 'idle', 0);

                this.ui.hideDialogue();
                const chosen = scene.choices[choiceIdx];
                if (chosen) {
                    if (chosen.isStarveChoice) {
                        this.state.starveCount++;
                        this.state.lastChoiceWasStarve = true;
                        audio.playPneumaticHiss();
                    } else {
                        this.state.lastChoiceWasStarve = false;
                    }

                    if (chosen.cutscene) {
                        await this.runCutscene(chosen.cutscene);
                    }
                    if (chosen.moraleDelta) {
                        this.state.morale = Math.max(0, Math.min(100, this.state.morale + chosen.moraleDelta));
                        this.ui.updateMorale(this.state.morale);
                    }

                    if (scene.id === 'act1_choice5') {
                        if (this.state.starveCount >= 5) {
                            await this.runCutscene('bad_ending_starve');
                            return;
                        }
                    }

                    this.advanceScene(chosen.nextScene || scene.nextScene);
                } else {
                    this.advanceScene(scene.nextScene);
                }
                break;
            }

            case 'exploration':
                this.ui.showObjective(scene.objective);
                this.engine.setPlayerCanMove(true);
                this.engine.enablePointerLock();
                this.state.isExploring = true;

                if (scene.interactables) {
                    scene.interactables.forEach(item => {
                        if (item.id === 'rations' && (this.state.lastChoiceWasStarve || this.state.hasEatenThisTrial)) {
                            return;
                        }

                        let targetMesh = this.currentWorldObjects[item.id];
                        if (!targetMesh) {
                            targetMesh = this.engine.scene.getMeshByName(item.id) || this.engine.scene.getNodeByName(item.id);
                        }
                        if (targetMesh) {
                            this.engine.addInteractable(item.id, targetMesh, item.label, () => {
                                this.engine.removeInteractable(item.id);
                                this.ui.hideInteractPrompt();
                                this.ui.hideObjective();
                                if (item.triggerScene) {
                                    this.advanceScene(item.triggerScene);
                                }
                            });
                        }
                    });
                }
                break;

            case 'event':
                this.advanceScene(scene.nextScene);
                break;

            default:
                this.advanceScene(scene.nextScene);
                break;
        }
    }

    advanceScene(nextSceneId) {
        if (!nextSceneId) {
            const act = this.state.currentAct;
            const currentIdx = act.scenes.findIndex(s => s.id === this.state.currentScene.id);
            if (currentIdx !== -1 && currentIdx + 1 < act.scenes.length) {
                this.playScene(act.scenes[currentIdx + 1]);
            } else {
                this.loadAct(this.state.actIndex + 1);
            }
        } else {
            const act = this.state.currentAct;
            const targetScene = act.scenes.find(s => s.id === nextSceneId);
            if (targetScene) {
                this.playScene(targetScene);
            } else {
                for (let a of STORY.acts) {
                    const s = a.scenes.find(sc => sc.id === nextSceneId);
                    if (s) {
                        this.playScene(s);
                        return;
                    }
                }
                this.loadAct(this.state.actIndex + 1);
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
