import * as THREE from 'three';
import { Player } from './Player.js?v=2';
import { Weapon } from './Weapon.js?v=2';
import { World } from './World.js?v=2';
import { ZombieWorld } from './ZombieWorld.js?v=2';
import { Bot } from './Bot.js?v=2';
import { Network } from './Network.js?v=2';
import { HUD } from './HUD.js?v=2';

const WALL_UPGRADES = [
    { name: "Cardboard", maxHP: 50, color: 0x8b7355, cost: 0 },
    { name: "Wood", maxHP: 120, color: 0x5a3d28, cost: 5 },
    { name: "Cobblestone", maxHP: 250, color: 0x444444, cost: 10 },
    { name: "Concrete", maxHP: 500, color: 0x777777, cost: 18 },
    { name: "Steel", maxHP: 1000, color: 0x2a3038, cost: 28 },
    { name: "Titanium", maxHP: 2000, color: 0xd0d5db, cost: 40 }
];

// ─── Game States ────────────────────────────────────────────────
const STATE = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    DEAD: 'DEAD'
};

const NUM_BOTS = 5;

class Game {
    constructor() {
        this.state = STATE.MENU;
        this.mode = null; // 'offline' or 'online'
        this.clock = new THREE.Clock();

        // Core Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Modules
        this.world = null;
        this.player = null;
        this.weapon = null;
        this.hud = null;
        this.network = null;
        this.bots = [];

        // DOM
        this.container = document.getElementById('game-container');
        this.mainMenu = document.getElementById('main-menu');
        this.pauseScreen = document.getElementById('pause-screen');
        this.deathScreen = document.getElementById('death-screen');
        this.clickToPlay = document.getElementById('click-to-play');

        // Zombies Mode State
        this.zombieWave = 1;
        this.zombiesKilledInWave = 0;
        this.zombiesTotalInWave = 0;
        this.zombcoins = 0;
        this.isIntermission = false;
        this.intermissionTimer = 0;
        this.shopOpen = false;
        
        // Headlight variables
        this.headlight = null;
        this.headlightTarget = null;
        this.headlightRangeUpgrade = 40;

        // Click to play event
        this.clickToPlay.addEventListener('click', () => {
            if (this.player && this.state !== STATE.DEAD && !this.shopOpen) {
                this.player.lock();
            }
        });

        this.init();
    }

    // ─── Initialization ─────────────────────────────────────────
    init() {
        this.initRenderer();
        this.initScene();
        this.initCamera();
        // Load default menu backdrop world before initializing lights so that fire barrels snap to correct height
        this.world = new World(this.scene);
        this.initLights();
        this.initHUD();
        this.bindMenuEvents();
        this.bindPauseEvents();
        this.bindShopEvents();

        // Start render loop (runs even on menu for background visuals)
        this.update();

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.insertBefore(this.renderer.domElement, this.container.firstChild);
    }

    initScene() {
        this.scene = new THREE.Scene();
        const fogColor = 0x8a7761;
        this.scene.fog = new THREE.FogExp2(fogColor, 0.015);

        // Gradient sky sphere
        const skyGeo = new THREE.SphereGeometry(180, 32, 16);
        const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
        const skyPos = skyGeo.attributes.position;
        for (let i = 0; i < skyPos.count; i++) {
            const y = skyPos.getY(i);
            const t = Math.max(0, Math.min(1, (y + 180) / 360)); // 0=bottom, 1=top
            // Bottom: warm haze (0.54, 0.47, 0.38)
            // Mid: dusty orange (0.6, 0.45, 0.3)
            // Top: muted blue-grey (0.4, 0.42, 0.48)
            let r, g, b;
            if (t < 0.45) {
                const s = t / 0.45;
                r = 0.54 + s * 0.06;
                g = 0.47 - s * 0.02;
                b = 0.38 - s * 0.08;
            } else {
                const s = (t - 0.45) / 0.55;
                r = 0.6 - s * 0.2;
                g = 0.45 - s * 0.03;
                b = 0.3 + s * 0.18;
            }
            skyColors[i * 3] = r;
            skyColors[i * 3 + 1] = g;
            skyColors[i * 3 + 2] = b;
        }
        skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
        const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
        this.skySphere = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skySphere);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(
            80,
            window.innerWidth / window.innerHeight,
            0.1,
            200
        );
        this.camera.position.set(0, 10, 30);
        this.camera.rotation.set(-0.3, 0, 0); // Tilt down for menu backdrop view
        this.scene.add(this.camera);
    }

    initLights() {
        // Hemisphere light — warm sky / cool ground
        this.hemiLight = new THREE.HemisphereLight(0xdcc8a0, 0x3d352b, 1.8);
        this.scene.add(this.hemiLight);

        // Main directional light — golden sun, lower angle for dramatic shadows
        this.dirLight = new THREE.DirectionalLight(0xffd699, 3.8);
        this.dirLight.position.set(25, 40, 15);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 150;
        this.dirLight.shadow.camera.left = -60;
        this.dirLight.shadow.camera.right = 60;
        this.dirLight.shadow.camera.top = 60;
        this.dirLight.shadow.camera.bottom = -60;
        this.dirLight.shadow.bias = -0.001;
        this.scene.add(this.dirLight);

        // Subtle ambient fill
        this.ambLight = new THREE.AmbientLight(0x5a4d3d, 0.8);
        this.scene.add(this.ambLight);

        // Fire barrel positions
        this.fireBarrels = [];
        const barrelPositions = [
            [-20, -20], [20, 20], [-15, 15], [10, -10]
        ];

        for (const [bx, bz] of barrelPositions) {
            this.createFireBarrel(bx, bz);
        }

        // Dust particle system
        this.createDustParticles();
    }

    createFireBarrel(bx, bz) {
        const by = this.world ? this.world.getTerrainHeight(bx, bz) : 0;
        
        // Barrel body
        const barrelGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 8);
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x3a3530 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(bx, by + 0.5, bz);
        barrel.castShadow = true;
        this.scene.add(barrel);

        // Voxel Fire Group (3 layered glowing cones)
        const fireGroup = new THREE.Group();
        fireGroup.position.set(bx, by + 0.9, bz);
        this.scene.add(fireGroup);

        const innerGeo = new THREE.ConeGeometry(0.18, 0.6, 5);
        innerGeo.translate(0, 0.3, 0); // pivot to base
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // yellow-white core
        const innerFlame = new THREE.Mesh(innerGeo, innerMat);
        fireGroup.add(innerFlame);

        const midGeo = new THREE.ConeGeometry(0.28, 0.85, 5);
        midGeo.translate(0, 0.425, 0);
        const midMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // bright orange
        const midFlame = new THREE.Mesh(midGeo, midMat);
        fireGroup.add(midFlame);

        const outGeo = new THREE.ConeGeometry(0.38, 1.1, 5);
        outGeo.translate(0, 0.55, 0);
        const outMat = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.65
        }); // red outer flame
        const outFlame = new THREE.Mesh(outGeo, outMat);
        fireGroup.add(outFlame);

        // Fire point light
        const fireLight = new THREE.PointLight(0xff5500, 800, 30);
        fireLight.position.set(bx, by + 2.0, bz);
        this.scene.add(fireLight);

        this.fireBarrels.push({
            light: fireLight,
            innerFlame,
            midFlame,
            outFlame,
            baseIntensity: 800
        });
    }

    createDustParticles() {
        const count = 300;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 15;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
            velocities.push({
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.05,
                z: (Math.random() - 0.5) * 0.3
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xccbbaa,
            size: 0.08,
            transparent: true,
            opacity: 0.4,
            depthWrite: false
        });
        this.dustParticles = new THREE.Points(geo, mat);
        this.dustVelocities = velocities;
        this.scene.add(this.dustParticles);
    }

    initHUD() {
        this.hud = new HUD();
    }

    // ─── Menu & Event Binding ───────────────────────────────────
    bindMenuEvents() {
        const btnShowOffline = document.getElementById('btn-show-offline');
        const btnShowOnline = document.getElementById('btn-show-online');
        const btnBackOffline = document.getElementById('btn-back-offline');
        const btnBackOnline = document.getElementById('btn-back-online');

        const primaryMenu = document.getElementById('primary-menu');
        const offlineMenu = document.getElementById('offline-menu');
        const onlineMenu = document.getElementById('online-menu');

        // Navigation bindings
        btnShowOffline.addEventListener('click', () => {
            primaryMenu.style.display = 'none';
            offlineMenu.style.display = 'flex';
        });

        btnShowOnline.addEventListener('click', () => {
            primaryMenu.style.display = 'none';
            onlineMenu.style.display = 'flex';
        });

        btnBackOffline.addEventListener('click', () => {
            offlineMenu.style.display = 'none';
            primaryMenu.style.display = 'flex';
        });

        btnBackOnline.addEventListener('click', () => {
            onlineMenu.style.display = 'none';
            primaryMenu.style.display = 'flex';
        });

        // Game mode start bindings
        document.getElementById('btn-offline').addEventListener('click', () => this.startGame('offline'));
        document.getElementById('btn-tdm').addEventListener('click', () => this.startGame('tdm'));
        document.getElementById('btn-zombies').addEventListener('click', () => this.startGame('zombies'));

        document.getElementById('btn-online-classic').addEventListener('click', () => this.startGame('online-classic'));
        document.getElementById('btn-online-tdm').addEventListener('click', () => this.startGame('online-tdm'));

        // Load & save player name from localStorage
        const nameInput = document.getElementById('player-name');
        if (nameInput) {
            const savedName = localStorage.getItem('pluhshooter_name');
            if (savedName) {
                nameInput.value = savedName;
            }
            nameInput.addEventListener('input', () => {
                localStorage.setItem('pluhshooter_name', nameInput.value.trim().toUpperCase());
            });
        }
    }

    bindPauseEvents() {
        const btnResume = document.getElementById('btn-resume');
        const btnQuit = document.getElementById('btn-quit');

        btnResume.addEventListener('click', () => this.resume());
        btnQuit.addEventListener('click', () => this.quitToMenu());

        // Pointer lock change — single source of truth for play/pause transitions
        document.addEventListener('pointerlockchange', () => {
            if (!this.player) return;

            if (document.pointerLockElement) {
                // Pointer lock acquired — transition to playing
                this.pauseScreen.style.display = 'none';
                this.clickToPlay.style.display = 'none';
                this.state = STATE.PLAYING;
            } else {
                // Pointer lock lost — only pause if we were actively playing
                // Don't pause during DEAD or MENU states
                if (this.state === STATE.PLAYING && !this.shopOpen) {
                    this.pause();
                }
            }
        });

        // Escape to resume from pause (re-locks pointer)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.state === STATE.PAUSED) {
                    this.resume();
                }
            }
        });

        // B to open/close shop in Zombies mode
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyB' && this.mode === 'zombies') {
                if (this.shopOpen) {
                    this.closeShop();
                } else {
                    this.openShop();
                }
            }
        });
    }

    // ─── Game Start ─────────────────────────────────────────────
    // ─── Game Start ─────────────────────────────────────────────
    startGame(mode) {
        this.mode = mode;

        // Hide menus and overlays
        this.mainMenu.style.display = 'none';
        document.getElementById('zombies-game-over-screen').style.display = 'none';
        document.getElementById('zombcoin-shop').style.display = 'none';
        this.shopOpen = false;

        // Swap world geometry based on mode
        if (this.world) {
            this.scene.remove(this.world.group);
            this.world = null;
        }

        if (mode === 'zombies') {
            this.world = new ZombieWorld(this.scene);
        } else {
            this.world = new World(this.scene, mode);
        }

        // Clean up old player and weapon
        if (this.player) {
            this.player.dispose();
        }
        if (this.weapon) {
            this.weapon.dispose();
        }

        // Init player
        this.player = new Player(this.camera, this.scene, this.renderer.domElement);
        this.player.setWorld(this.world);
        this.player.setColliders(this.world.getColliders());

        // Spawn player
        let spawnPoint;
        if (mode === 'tdm' || mode === 'online-tdm') {
            const baseY = this.world.getTerrainHeight(-70, -70);
            spawnPoint = new THREE.Vector3(-70, baseY + 1.0, -70);
        } else {
            spawnPoint = this.world.getRandomSpawnPoint();
        }
        this.player.respawn(spawnPoint);

        // Init weapon
        this.weapon = new Weapon(this.camera, this.scene);

        // Configure Zombies-specific state
        if (mode === 'zombies') {
            this.zombieWave = 1;
            this.zombcoins = 0;
            this.zombiesKilledInWave = 0;
            this.isIntermission = false;
            this.weapon.unlocked = [true, true, true, false, false]; // AR, Glock, Knife unlocked; Sniper, Shotgun locked
            this.headlightRangeUpgrade = 40;
            this.wallLevel = 0; // Cardboard level
            
            // Set up eerie dark lighting & atmosphere
            this.scene.fog.color.setHex(0x050806);
            this.scene.fog.density = 0.04;
            if (this.skySphere) this.skySphere.visible = false;
            this.scene.background = new THREE.Color(0x050806);
            
            if (this.hemiLight) this.hemiLight.intensity = 0.15;
            if (this.dirLight) this.dirLight.intensity = 0.05;
            if (this.ambLight) this.ambLight.intensity = 0.15;
            
            this.initHeadlight();
            
            // Show HUD elements
            document.getElementById('zombcoin-display').style.display = 'block';
            document.getElementById('wall-hp-display').style.display = 'block';
            document.getElementById('zombcoins-val').textContent = this.zombcoins;
            
            this.updateWallHPDisplay();
            this.startZombieWave();
        } else {
            this.removeHeadlight();
            
            // Restore default sunset lighting & atmosphere
            this.scene.fog.color.setHex(0x8a7761);
            this.scene.fog.density = 0.015;
            if (this.skySphere) this.skySphere.visible = true;
            this.scene.background = null;
            
            if (this.hemiLight) this.hemiLight.intensity = 1.8;
            if (this.dirLight) this.dirLight.intensity = 3.8;
            if (this.ambLight) this.ambLight.intensity = 0.8;
            
            // Hide HUD elements
            document.getElementById('zombcoin-display').style.display = 'none';
            document.getElementById('wall-hp-display').style.display = 'none';
        }

        // Assign player team
        if (mode === 'tdm') this.player.team = 'blue';
        else if (mode === 'zombies') this.player.team = 'survivors';
        else this.player.team = 'player';

        // Mode-specific setup
        if (mode === 'online' || mode === 'online-classic' || mode === 'online-tdm') {
            this.startOnline(mode);
        } else {
            this.startOffline(mode);
        }

        // Show HUD
        this.hud.show();
        this.hud.updateHealth(100);
        this.hud.updateWeapon(this.weapon.name, this.weapon.ammo, this.weapon.maxAmmo);
        this.hud.updateScore(0, 0);

        // Show team indicator in TDM
        if (mode === 'tdm') {
            this.hud.showTeamIndicator(this.player.team);
        } else {
            this.hud.hideTeamIndicator();
        }

        // Show click to play overlay
        this.clickToPlay.style.display = 'flex';
        this.clock.getDelta(); // Reset clock
    }

    startOffline(mode) {
        // Clear any existing bots
        this.clearBots();

        if (mode === 'zombies') {
            return;
        }

        const difficultySelect = document.getElementById('bot-difficulty');
        let difficulty = difficultySelect ? difficultySelect.value : 'normal';

        if (mode === 'zombies') difficulty = 'zombie';
        const numBots = (mode === 'zombies') ? 15 : NUM_BOTS * 2; // More bots for fun

        // Spawn bots
        const spawnPoints = this.world.getSpawnPoints();
        for (let i = 0; i < numBots; i++) {
            let sp;
            let team = 'bots';
            if (mode === 'tdm') {
                team = (i % 2 === 0) ? 'red' : 'blue';
                const baseX = (team === 'red') ? 70 : -70;
                const baseZ = (team === 'red') ? 70 : -70;
                const baseY = this.world.getTerrainHeight(baseX, baseZ);
                sp = new THREE.Vector3(
                    baseX + (Math.random() - 0.5) * 4,
                    baseY + 1.0,
                    baseZ + (Math.random() - 0.5) * 4
                );
            } else {
                sp = spawnPoints[i % spawnPoints.length].clone();
                sp.x += (Math.random() - 0.5) * 4;
                sp.z += (Math.random() - 0.5) * 4;
            }

            const bot = new Bot(this.scene, this.world, i + 1, sp, difficulty);
            if (mode === 'tdm') {
                bot.setTeam(team);
            } else if (mode === 'zombies') {
                bot.team = 'zombies';
            } else {
                bot.team = 'bots';
            }

            this.bots.push(bot);
        }

        console.log(`[Game] Offline mode started with ${numBots} bots`);
    }

    startOnline(mode) {
        // Initialize network
        this.network = new Network(this.scene);
        
        // Allow passing a custom server URL via query parameter (e.g. ?server=wss://yourserver.com)
        const urlParams = new URLSearchParams(window.location.search);
        let defaultUrl = 'wss://pluhshooterbackend.onrender.com';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            defaultUrl = 'ws://localhost:8080';
        }
        const serverUrl = urlParams.get('server') || defaultUrl;
        
        // Get name from input field
        const nameInput = document.getElementById('player-name');
        const pName = nameInput ? nameInput.value.trim().toUpperCase() || 'PLAYER' : 'PLAYER';
        this.player.name = pName;

        this.network.connect(serverUrl, pName, this.player.team);

        // When game state is received, finalize team and join
        this.network.onReadyToJoin(() => {
            if (mode === 'online-tdm') {
                let blueCount = 0;
                let redCount = 0;
                for (const [id, rp] of this.network.getRemotePlayers()) {
                    if (rp.team === 'blue') blueCount++;
                    if (rp.team === 'red') redCount++;
                }
                this.player.team = (blueCount <= redCount) ? 'blue' : 'red';
                this.hud.showTeamIndicator(this.player.team);

                // Respawn at team base
                const sign = (this.player.team === 'blue') ? -70 : 70;
                const baseY = this.world.getTerrainHeight(sign, sign);
                this.player.respawn(new THREE.Vector3(sign, baseY + 1.0, sign));
            } else {
                this.player.team = 'player';
                this.hud.hideTeamIndicator();
            }

            // Announce join with finalized team and name
            this.network.sendJoin(this.player.name, this.player.team);
        });

        // Set up network callbacks
        this.network.onHit((data) => {
            if (data.damage) {
                this.player.takeDamage(data.damage);
                this.hud.showDamageIndicator();
                this.hud.updateHealth(this.player.health);

                // Check if player died in online match
                if (!this.player.isAlive && this.state !== STATE.DEAD) {
                    this.handlePlayerDeath('a rival player');
                }
            }
        });

        this.network.onPlayerJoin((data) => {
            const pNameToShow = data.name || `Player ${data.id}`;
            this.hud.addKillFeed(`${pNameToShow} joined`);
        });

        this.network.onPlayerLeave((data) => {
            const pNameToShow = this.network.remotePlayers.get(data.id)?.name || `Player ${data.id}`;
            this.hud.addKillFeed(`${pNameToShow} left`);
        });

        console.log('[Game] Online mode started — connecting to server...');
    }

    // ─── Game Loop ──────────────────────────────────────────────
    update() {
        requestAnimationFrame(() => this.update());

        const deltaTime = this.clock.getDelta();

        if (this.state === STATE.PLAYING) {
            this.gameLoop(deltaTime);
        } else if (this.state === STATE.MENU && this.mainMenu.style.display === 'flex') {
            // Slowly rotate camera around the origin for a Minecraft-style panorama menu
            this.menuRotationAngle = (this.menuRotationAngle || 0) + deltaTime * 0.05; // 0.05 rad/sec (very slow, peaceful rotation)
            const radius = 45; // Distance from center
            this.camera.position.x = Math.sin(this.menuRotationAngle) * radius;
            this.camera.position.z = Math.cos(this.menuRotationAngle) * radius;
            this.camera.position.y = 12; // Elevated angle
            this.camera.lookAt(0, 4, 0); // Look towards the center outpost
        }

        // Animate effects even when paused for visual continuity
        this.updateEffects(deltaTime);

        // Always render (even menu has the world as backdrop)
        this.renderer.render(this.scene, this.camera);
    }

    updateEffects(dt) {
        if (this.world && typeof this.world.updateSirens === 'function') {
            this.world.updateSirens(dt);
        }

        // Animate dust particles
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            for (let i = 0; i < this.dustVelocities.length; i++) {
                const v = this.dustVelocities[i];
                positions[i * 3] += v.x * dt;
                positions[i * 3 + 1] += v.y * dt;
                positions[i * 3 + 2] += v.z * dt;
                // Wrap around
                if (positions[i * 3] > 50) positions[i * 3] = -50;
                if (positions[i * 3] < -50) positions[i * 3] = 50;
                if (positions[i * 3 + 1] > 15) positions[i * 3 + 1] = 0;
                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 15;
                if (positions[i * 3 + 2] > 50) positions[i * 3 + 2] = -50;
                if (positions[i * 3 + 2] < -50) positions[i * 3 + 2] = 50;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }

        // Animate fire barrel flicker and 3-layered realistic fire
        if (this.fireBarrels) {
            const time = performance.now() * 0.003;
            for (const fb of this.fireBarrels) {
                const flicker = 0.75 + Math.sin(time * 6.3 + fb.light.position.x) * 0.15
                              + Math.cos(time * 11.2 + fb.light.position.z) * 0.1
                              + Math.random() * 0.04;
                fb.light.intensity = fb.baseIntensity * flicker;

                // Animate flame layers (scale and rotation)
                if (fb.innerFlame) {
                    const s1 = 0.85 + Math.sin(time * 8.0 + fb.light.position.x) * 0.15;
                    fb.innerFlame.scale.set(s1, 0.7 + Math.random() * 0.4, s1);
                    fb.innerFlame.rotation.y = time * 2.0;
                }
                if (fb.midFlame) {
                    const s2 = 0.9 + Math.cos(time * 5.0 + fb.light.position.z) * 0.15;
                    fb.midFlame.scale.set(s2, 0.8 + Math.random() * 0.3, s2);
                    fb.midFlame.rotation.y = -time * 1.5;
                }
                if (fb.outFlame) {
                    const s3 = 0.95 + Math.sin(time * 3.5 + fb.light.position.x) * 0.12;
                    fb.outFlame.scale.set(s3, 0.85 + Math.random() * 0.25, s3);
                    fb.outFlame.rotation.y = time * 0.8;
                }
            }
        }

        // Keep sky sphere centered on camera
        if (this.skySphere && this.camera) {
            this.skySphere.position.copy(this.camera.position);
        }
    }

    gameLoop(dt) {
        if (!this.player || !this.player.isAlive) return;

        // Update player physics/movement
        this.player.update(dt, this.weapon.isAiming);

        // Update watchtower buttons and door status
        this.updateInteractions(dt);

        // Update weapon
        this.weapon.update(dt, this.player.isMoving);

        // Build target list for weapon raycasting
        const targets = this.getShootTargets();

        // Handle shooting
        const shotResults = this.weapon.shoot(targets);
        if (shotResults) {
            if (Array.isArray(shotResults)) {
                for (let r of shotResults) this.handleShotResult(r);
            } else {
                this.handleShotResult(shotResults);
            }

            // Send shoot event to network if online
            const isOnline = this.mode.startsWith('online');
            if (isOnline && this.network) {
                const forward = new THREE.Vector3(0, 0, -1);
                forward.applyQuaternion(this.camera.quaternion);
                this.network.sendShoot(this.camera.position, forward);
            }
        }

        // Update HUD
        this.hud.updateWeapon(this.weapon.name, this.weapon.ammo, this.weapon.maxAmmo);
        this.hud.showReloading(this.weapon.isReloading);
        this.hud.updateCrosshair(this.player.isMoving, this.weapon.isShooting);
        this.hud.updateHealth(this.player.health);

        // Aiming overlays for Scopes (AR and Sniper)
        if (this.weapon) {
            const cw = this.weapon.currentWeapon;
            const isAiming = this.weapon.isAiming && !cw.isMelee && !cw.isReloading;
            const scopeOverlay = document.getElementById('sniper-scope-overlay');
            const crosshair = document.getElementById('crosshair');
            const arReticle = document.getElementById('ar-scope-reticle');

            if (isAiming) {
                if (cw.name === "SNIPER RIFLE") {
                    if (scopeOverlay) scopeOverlay.style.display = 'flex';
                    if (crosshair) crosshair.style.display = 'none';
                    if (arReticle) arReticle.style.display = 'none';
                    cw.group.visible = false; // Hide model so it doesn't block the screen inside the scope
                } else if (cw.name === "ASSAULT RIFLE") {
                    if (scopeOverlay) scopeOverlay.style.display = 'none';
                    if (crosshair) crosshair.style.display = 'none';
                    if (arReticle) arReticle.style.display = 'flex';
                    cw.group.visible = true; // Slides into ADS center
                } else {
                    if (scopeOverlay) scopeOverlay.style.display = 'none';
                    if (crosshair) crosshair.style.display = 'flex';
                    if (arReticle) arReticle.style.display = 'none';
                    cw.group.visible = true;
                }
            } else {
                if (scopeOverlay) scopeOverlay.style.display = 'none';
                if (crosshair) crosshair.style.display = 'flex';
                if (arReticle) arReticle.style.display = 'none';
                cw.group.visible = true;
            }
        }

        // Mode-specific updates
        const isOnline = this.mode.startsWith('online');
        if (!isOnline) {
            this.updateBots(dt);
        } else if (isOnline && this.network) {
            this.network.update(dt);
            this.network.sendPosition(this.player.getState());
        }
    }

    // ─── Shooting & Damage ──────────────────────────────────────
    getShootTargets() {
        const targets = [];

        // Add bots as targets (offline mode)
        for (const bot of this.bots) {
            if (bot.isAlive) {
                targets.push({
                    mesh: bot.getMesh(),
                    type: 'bot',
                    ref: bot
                });
            }
        }

        // Add remote players as targets (online mode)
        if (this.network) {
            for (const [id, rp] of this.network.getRemotePlayers()) {
                targets.push({
                    mesh: rp.mesh,
                    type: 'player',
                    ref: { id, ...rp }
                });
            }
        }

        // Add world colliders (walls, buildings, barricades) to block rays
        if (this.world) {
            const colliders = this.world.getColliders();
            for (let i = 0; i < colliders.length; i++) {
                targets.push({
                    obj: colliders[i],
                    type: 'world'
                });
            }
            if (this.world.floorMesh) {
                targets.push({
                    obj: this.world.floorMesh,
                    type: 'mesh'
                });
            }
        }

        return targets;
    }

    handleShotResult(result) {
        if (!result.hit) return;

        if (result.targetType === 'bot') {
            const bot = result.target;
            if (this.mode === 'tdm' && bot.team === this.player.team) return;

            const damage = (this.mode === 'zombies' && result.isHeadshot) ? 9999 : result.damage;
            const died = bot.takeDamage(damage);

            if (died) {
                this.player.kills++;
                const msg = result.isHeadshot
                    ? `💀 HEADSHOT! You killed ${bot.name}`
                    : `⚔ You killed ${bot.name}`;
                this.hud.addKillFeed(msg);
                this.hud.updateScore(this.player.kills, this.player.deaths);

                if (this.mode === 'zombies') {
                    const coins = result.isHeadshot ? 2 : 1;
                    this.zombcoins += coins;
                    this.updateZombcoinsHUD();
                    this.hud.addKillFeed(`🪙 +${coins} Zombcoins`);
                }
            }

            // HUD hit marker flash (white X on crosshair)
            this.hud.showHitMarker();
            if (result.isHeadshot) {
                this.hud.showHeadshotText();
            }

            // 3D hit marker flash
            this.createHitMarker(result.point);
        } else if (result.targetType === 'player' && this.network) {
            // Send hit event to server
            this.network.sendHit(result.target.id, result.damage);
            this.hud.showHitMarker();
        } else {
            // Hit the environment: leave a bullet mark
            this.createBulletMark(result.point);
        }
    }

    createHitMarker(point) {
        // Brief red flash at hit point
        const geo = new THREE.SphereGeometry(0.15, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(geo, mat);
        marker.position.copy(point);
        this.scene.add(marker);

        // Fade out and remove
        let opacity = 0.8;
        const fadeInterval = setInterval(() => {
            opacity -= 0.1;
            mat.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fadeInterval);
                this.scene.remove(marker);
                geo.dispose();
                mat.dispose();
            }
        }, 30);
    }

    createBulletMark(point) {
        // Create a tiny dark grey cube representing a bullet dent in the wall/ground
        const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const mark = new THREE.Mesh(geo, mat);
        mark.position.copy(point);
        this.scene.add(mark);

        // Disappear after 3 seconds
        setTimeout(() => {
            this.scene.remove(mark);
            geo.dispose();
            mat.dispose();
        }, 3000);
    }

    // ─── Bot Updates ────────────────────────────────────────────
    updateBots(dt) {
        // Build list of all valid targets
        const allTargets = [];
        // Only target player if they are actually playing (not paused, not on death screen)
        if (this.player && this.player.isAlive && this.state === STATE.PLAYING) {
            allTargets.push({ type: 'player', obj: this.player, pos: this.camera.position.clone() });
        }
        for (const b of this.bots) {
            if (b.isAlive) {
                // Offset target height by 1.2 units (chest height) so raycasts don't hit the ground
                const targetPos = b.mesh.position.clone();
                targetPos.y += 1.2;
                allTargets.push({ type: 'bot', obj: b, pos: targetPos });
            }
        }

        for (const bot of this.bots) {
            if (!bot.isAlive) {
                bot.update(dt, bot.mesh.position, null);
                continue;
            }

            // If mode is zombies, check if bot is attacking the wall
            if (this.mode === 'zombies' && !this.world.wallDestroyed) {
                const pos = bot.mesh.position;
                if (pos.z < -4.8 && pos.z >= -8.5 && Math.abs(pos.x) <= 20) {
                    bot.attackWallTimer = (bot.attackWallTimer || 0) + dt;
                    if (bot.attackWallTimer >= 1.0) {
                        bot.attackWallTimer = 0;
                        this.world.damageWall(bot.profile.DAMAGE);
                        this.updateWallHPDisplay();
                        this.hud.addKillFeed("⚠️ WARNING: Defensive Wall is taking damage!");
                    }
                }
            }

            // Check if zombie breached the base core
            if (this.mode === 'zombies' && this.world.isInCoreZone(bot.mesh.position)) {
                this.triggerZombiesGameOver();
                return;
            }

            // Find closest target
            let closestTarget = null;
            let closestDist = Infinity;
            for (const target of allTargets) {
                if (target.obj === bot) continue;
                // Teammates ignore each other unless they are in offline free-for-all deathmatch mode
                if (this.mode !== 'offline' && target.obj.team === bot.team) continue;
                
                const dist = bot.mesh.position.distanceTo(target.pos);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestTarget = target;
                }
            }

            if (!closestTarget) {
                bot.update(dt, bot.mesh.position, null);
                continue;
            }

            const shotResult = bot.update(dt, closestTarget.pos, null);

            // Bot shot someone
            if (shotResult && shotResult.hit) {
                if (closestTarget.type === 'player') {
                    this.player.takeDamage(shotResult.damage);
                    this.hud.showDamageIndicator();
                    this.hud.updateHealth(this.player.health);

                    // Check if player died
                    if (!this.player.isAlive && this.state !== STATE.DEAD) {
                        if (this.mode === 'zombies') {
                            this.triggerZombiesGameOver();
                        } else {
                            this.handlePlayerDeath(shotResult.shooterName || 'a Bot');
                        }
                    }
                } else {
                    const targetBot = closestTarget.obj;
                    targetBot.takeDamage(shotResult.damage);
                    if (!targetBot.isAlive) {
                        this.hud.addKillFeed(`${bot.name} killed ${targetBot.name}`);
                    }
                }
            }
        }

        // After updating all bots, check Zombies wave progress
        if (this.mode === 'zombies') {
            this.checkZombieWaveProgress();
        }
    }

    // ─── Death & Respawn ────────────────────────────────────────
    async handlePlayerDeath(killerName) {
        if (this.state === STATE.DEAD) return;
        this.state = STATE.DEAD;
        this.hud.updateHealth(0);
        this.player.unlock(); // Release mouse so they can use it during death/menus

        // Show death screen with countdown
        await this.hud.showDeathScreen(killerName);

        // Respawn
        this.hud.hideDeathScreen();
        let sp;
        if (this.mode === 'tdm') {
            const baseY = this.world.getTerrainHeight(-70, -70);
            sp = new THREE.Vector3(-70 + (Math.random() - 0.5) * 4, baseY + 1.0, -70 + (Math.random() - 0.5) * 4);
        } else if (this.mode === 'online-tdm') {
            const sign = (this.player.team === 'blue') ? -70 : 70;
            const baseY = this.world.getTerrainHeight(sign, sign);
            sp = new THREE.Vector3(sign + (Math.random() - 0.5) * 4, baseY + 1.0, sign + (Math.random() - 0.5) * 4);
        } else {
            sp = this.world.getRandomSpawnPoint();
        }
        this.player.respawn(sp);
        this.weapon.ammo = this.weapon.maxAmmo;
        this.weapon.isReloading = false;

        this.hud.updateHealth(this.player.health);
        this.hud.updateWeapon(this.weapon.name, this.weapon.ammo, this.weapon.maxAmmo);
        this.hud.updateScore(this.player.kills, this.player.deaths);

        // Set state to PAUSED so the click listener allows the transition to PLAYING
        this.state = STATE.PAUSED;
        
        // Show click to play overlay instead of directly requesting lock
        // The browser requires a user click to grant pointer lock.
        this.clickToPlay.querySelector('p').textContent = "CLICK TO RESPAWN";
        this.clickToPlay.style.display = 'flex';
        this.clock.getDelta(); // Reset clock so dt isn't huge after respawn
    }

    // ─── Pause / Resume ─────────────────────────────────────────
    pause() {
        if (this.state !== STATE.PLAYING) return;
        this.state = STATE.PAUSED;
        this.pauseScreen.style.display = 'flex';
    }

    resume() {
        if (this.state !== STATE.PAUSED) return;
        this.pauseScreen.style.display = 'none';
        // Request pointer lock — state transitions to PLAYING
        // only when pointerlockchange confirms it
        this.player.lock();
    }

    quitToMenu() {
        // Clean up
        this.state = STATE.MENU;
        this.pauseScreen.style.display = 'none';
        this.deathScreen.style.display = 'none';
        this.hud.hide();

        // Hide Zombies overlays
        const zCoins = document.getElementById('zombcoin-display');
        const zWall = document.getElementById('wall-hp-display');
        const zSplash = document.getElementById('wave-splash');
        const zGameOver = document.getElementById('zombies-game-over-screen');
        const zShop = document.getElementById('zombcoin-shop');
        if (zCoins) zCoins.style.display = 'none';
        if (zWall) zWall.style.display = 'none';
        if (zSplash) zSplash.style.display = 'none';
        if (zGameOver) zGameOver.style.display = 'none';
        if (zShop) zShop.style.display = 'none';
        this.shopOpen = false;

        this.removeHeadlight();

        // Cleanup bots
        this.clearBots();

        // Cleanup network
        if (this.network) {
            this.network.dispose();
            this.network = null;
        }

        // Cleanup weapon
        if (this.weapon) {
            this.weapon.dispose();
            this.weapon = null;
        }

        // Reset player
        if (this.player) {
            this.player.unlock();
            this.player = null;
        }

        // Reset camera for menu view
        this.camera.position.set(0, 10, 30);
        this.camera.rotation.set(-0.3, 0, 0);

        // Reset sub-menus back to primary state
        document.getElementById('offline-menu').style.display = 'none';
        document.getElementById('online-menu').style.display = 'none';
        document.getElementById('primary-menu').style.display = 'flex';

        // Show menu
        this.mainMenu.style.display = 'flex';
    }

    clearBots() {
        for (const bot of this.bots) {
            bot.dispose();
        }
        this.bots = [];
    }

    // ─── Headlight ──────────────────────────────────────────────
    initHeadlight() {
        this.removeHeadlight();
        
        // Flashlight source attached to camera
        this.headlight = new THREE.SpotLight(0xffffff, 5.0, this.headlightRangeUpgrade, Math.PI / 5, 0.4, 0.8);
        this.headlight.castShadow = true;
        this.headlight.shadow.mapSize.width = 1024;
        this.headlight.shadow.mapSize.height = 1024;
        this.camera.add(this.headlight);
        
        this.headlightTarget = new THREE.Object3D();
        this.scene.add(this.headlightTarget);
        this.headlight.target = this.headlightTarget;
    }

    removeHeadlight() {
        if (this.headlight) {
            this.camera.remove(this.headlight);
            this.headlight = null;
        }
        if (this.headlightTarget) {
            this.scene.remove(this.headlightTarget);
            this.headlightTarget = null;
        }
    }

    // ─── Wall HP Display ─────────────────────────────────────────
    updateWallHPDisplay() {
        if (!this.world || this.mode !== 'zombies') return;
        const hpPercent = Math.max(0, this.world.wallHP / this.world.wallMaxHP) * 100;
        const bar = document.getElementById('wall-hp-bar');
        const txt = document.getElementById('wall-hp-text');
        if (bar) bar.style.width = `${hpPercent}%`;
        if (txt) txt.textContent = `${this.world.wallHP} / ${this.world.wallMaxHP}`;
    }

    // ─── Zombies Wave Logic ─────────────────────────────────────
    startZombieWave() {
        if (this.mode !== 'zombies') return;
        this.isIntermission = false;
        
        // Show wave splash
        const splash = document.getElementById('wave-splash');
        const title = document.getElementById('wave-splash-title');
        const subtitle = document.getElementById('wave-splash-subtitle');
        
        if (title) title.textContent = `WAVE ${this.zombieWave}`;
        if (subtitle) subtitle.textContent = "THE HORDE APPROACHES";
        if (splash) splash.style.display = 'flex';
        
        setTimeout(() => {
            if (splash) splash.style.display = 'none';
        }, 3000);

        // Spawn zombies: count doubles every wave (1, 2, 4, 8, 16...)
        this.zombiesKilledInWave = 0;
        this.zombiesTotalInWave = Math.pow(2, this.zombieWave - 1);
        
        // Clear old dead/alive bots
        this.clearBots();

        // Spawn initial bots
        for (let i = 0; i < Math.min(this.zombiesTotalInWave, 10); i++) {
            this.spawnZombie();
        }
    }

    spawnZombie() {
        if (this.mode !== 'zombies') return;
        
        // Determine type of zombie based on wave
        let type = 'zombie';
        const rand = Math.random();
        
        // Spawn position from the front of the wall
        const sp = this.world.getRandomZombieSpawn();
        const id = this.bots.length + 1;
        const bot = new Bot(this.scene, this.world, id, sp, 'zombie');
        
        // Customize stats based on waves
        const speedScale = 1.0 + (this.zombieWave * 0.05);
        const hpScale = 1.0 + (this.zombieWave * 0.1);
        
        if (rand < 0.2 && this.zombieWave >= 3) {
            // Runner zombie: faster but lower HP
            bot.name = `Zombie Runner-${id}`;
            bot.profile.SPEED = 6.5 * speedScale;
            bot.maxHealth = 60 * hpScale;
            bot.health = bot.maxHealth;
            // Recolor model to dark reddish green (Runner)
            bot.mesh.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material = c.material.clone();
                    c.material.color.setHex(0x551111);
                }
            });
        } else if (rand < 0.35 && this.zombieWave >= 5) {
            // Brute zombie: slower but massive HP
            bot.name = `Zombie Brute-${id}`;
            bot.profile.SPEED = 3.0 * speedScale;
            bot.maxHealth = 250 * hpScale;
            bot.health = bot.maxHealth;
            bot.profile.DAMAGE = 60;
            // Scale mesh larger
            bot.mesh.scale.set(1.4, 1.4, 1.4);
            // Recolor model to dark green (Brute)
            bot.mesh.traverse(c => {
                if (c.isMesh && c.material) {
                    c.material = c.material.clone();
                    c.material.color.setHex(0x113311);
                }
            });
        } else {
            // Normal zombie: balanced speed and health
            bot.profile.SPEED = 4.5 * speedScale;
            bot.maxHealth = 100 * hpScale;
            bot.health = bot.maxHealth;
        }

        bot.team = 'zombies';
        this.bots.push(bot);
    }

    checkZombieWaveProgress() {
        if (this.mode !== 'zombies' || this.isIntermission) return;
        
        // Count killed zombies
        let alive = 0;
        for (const b of this.bots) {
            if (b.isAlive) alive++;
        }
        
        const totalSpawned = this.bots.length;
        const remainingToSpawn = this.zombiesTotalInWave - totalSpawned;
        
        // Spawn more zombies to keep pressure if we have remaining ones in reserve
        if (alive < 5 && remainingToSpawn > 0) {
            const spawnCount = Math.min(remainingToSpawn, 5);
            for (let i = 0; i < spawnCount; i++) {
                this.spawnZombie();
            }
        }
        
        // Wave complete condition: all total zombies are killed
        if (alive === 0 && remainingToSpawn === 0) {
            this.endZombieWave();
        }
    }

    endZombieWave() {
        this.isIntermission = true;
        
        // Show wave complete splash
        const splash = document.getElementById('wave-splash');
        const title = document.getElementById('wave-splash-title');
        const subtitle = document.getElementById('wave-splash-subtitle');
        
        if (title) title.textContent = `WAVE COMPLETED`;
        if (subtitle) {
            subtitle.textContent = "INTERMISSION: PRESS B TO OPEN UPGRADE SHOP";
            subtitle.style.color = "#ffd700";
        }
        if (splash) splash.style.display = 'flex';
        
        // Automatically start next wave after 12 seconds
        this.intermissionTimer = 12;
        const interval = setInterval(() => {
            if (this.mode !== 'zombies' || this.state === STATE.DEAD || this.state === STATE.MENU) {
                clearInterval(interval);
                return;
            }
            if (this.state === STATE.PAUSED) {
                return; // Pause countdown while paused
            }
            this.intermissionTimer--;
            if (this.intermissionTimer <= 0) {
                clearInterval(interval);
                if (splash) splash.style.display = 'none';
                if (subtitle) subtitle.style.color = "rgba(255,255,255,0.7)";
                
                // Next wave
                this.zombieWave++;
                this.startZombieWave();
            } else {
                if (subtitle) subtitle.textContent = `NEXT WAVE IN ${this.intermissionTimer}S - PRESS B TO SHOP`;
            }
        }, 1000);
    }

    triggerZombiesGameOver() {
        if (this.state === STATE.DEAD) return;
        this.state = STATE.DEAD;
        
        if (this.player) this.player.unlock();
        
        // Set stats on screen
        document.getElementById('stat-waves').textContent = this.zombieWave - 1;
        document.getElementById('stat-kills').textContent = this.player.kills;
        document.getElementById('stat-coins').textContent = this.zombcoins;
        
        document.getElementById('zombies-game-over-screen').style.display = 'flex';
    }

    // ─── Shop Toggle & Actions ──────────────────────────────────
    openShop() {
        if (this.mode !== 'zombies' || this.state !== STATE.PLAYING || this.shopOpen) return;
        this.shopOpen = true;
        this.player.unlock();
        
        // Update coins label in shop
        document.getElementById('shop-coins-val').textContent = this.zombcoins;
        document.getElementById('zombcoin-shop').style.display = 'flex';
        
        // Disable click to play temporarily
        this.clickToPlay.style.display = 'none';
        
        // Update button states
        this.updateShopButtonStates();
    }

    closeShop() {
        if (!this.shopOpen) return;
        this.shopOpen = false;
        document.getElementById('zombcoin-shop').style.display = 'none';
        
        // Re-lock
        this.player.lock();
    }

    updateShopButtonStates() {
        const shotgunUnlocked = this.weapon.unlocked[4];
        const sniperUnlocked = this.weapon.unlocked[3];
        
        const btnShotgun = document.getElementById('shop-buy-shotgun');
        const btnSniper = document.getElementById('shop-buy-sniper');
        
        if (shotgunUnlocked) {
            btnShotgun.querySelector('span').textContent = "💥 SHOTGUN (UNLOCKED)";
            btnShotgun.style.opacity = 0.5;
            btnShotgun.style.pointerEvents = 'none';
        } else {
            btnShotgun.style.opacity = this.zombcoins >= 5 ? 1.0 : 0.5;
            btnShotgun.style.pointerEvents = 'auto';
        }
        
        if (sniperUnlocked) {
            btnSniper.querySelector('span').textContent = "🎯 SNIPER (UNLOCKED)";
            btnSniper.style.opacity = 0.5;
            btnSniper.style.pointerEvents = 'none';
        } else {
            btnSniper.style.opacity = this.zombcoins >= 8 ? 1.0 : 0.5;
            btnSniper.style.pointerEvents = 'auto';
        }
        
        // Wall material upgrades
        const nextUpgrade = WALL_UPGRADES[this.wallLevel + 1];
        const btnUpgrade = document.getElementById('shop-upgrade-wall');
        const txtUpgrade = document.getElementById('shop-wall-upgrade-text');
        const costUpgrade = document.getElementById('shop-wall-upgrade-cost');
        
        if (this.wallLevel >= WALL_UPGRADES.length - 1) {
            if (txtUpgrade) txtUpgrade.textContent = "🛡️ WALL AT MAX LEVEL (TITANIUM)";
            if (costUpgrade) costUpgrade.textContent = "MAX";
            btnUpgrade.style.opacity = 0.5;
            btnUpgrade.style.pointerEvents = 'none';
        } else if (nextUpgrade) {
            if (txtUpgrade) txtUpgrade.textContent = `🛡️ UPGRADE WALL (${nextUpgrade.name})`;
            if (costUpgrade) costUpgrade.textContent = `${nextUpgrade.cost} 🪙`;
            btnUpgrade.style.opacity = this.zombcoins >= nextUpgrade.cost ? 1.0 : 0.5;
            btnUpgrade.style.pointerEvents = 'auto';
        }

        document.getElementById('shop-buy-ammo').style.opacity = this.zombcoins >= 2 ? 1.0 : 0.5;
        document.getElementById('shop-repair-wall').style.opacity = (this.zombcoins >= 3 && this.world.wallHP < this.world.wallMaxHP) ? 1.0 : 0.5;
        document.getElementById('shop-buy-dmg').style.opacity = this.zombcoins >= 6 ? 1.0 : 0.5;
    }

    bindShopEvents() {
        document.getElementById('shop-close-btn').addEventListener('click', () => this.closeShop());
        
        document.getElementById('shop-buy-shotgun').addEventListener('click', () => {
            if (this.zombcoins >= 5 && !this.weapon.unlocked[4]) {
                this.zombcoins -= 5;
                this.weapon.unlocked[4] = true;
                this.hud.addKillFeed("🔓 SHOTGUN UNLOCKED! Press 5 to equip");
                this.updateZombcoinsHUD();
                this.updateShopButtonStates();
            }
        });
        
        document.getElementById('shop-buy-sniper').addEventListener('click', () => {
            if (this.zombcoins >= 8 && !this.weapon.unlocked[3]) {
                this.zombcoins -= 8;
                this.weapon.unlocked[3] = true;
                this.hud.addKillFeed("🔓 SNIPER UNLOCKED! Press 4 to equip");
                this.updateZombcoinsHUD();
                this.updateShopButtonStates();
            }
        });
        
        document.getElementById('shop-buy-ammo').addEventListener('click', () => {
            if (this.zombcoins >= 2) {
                this.zombcoins -= 2;
                for (let w of this.weapon.weapons) {
                    w.ammo = w.maxAmmo;
                }
                this.weapon.isReloading = false;
                this.hud.updateWeapon(this.weapon.name, this.weapon.ammo, this.weapon.maxAmmo);
                this.hud.addKillFeed("📦 AMMO REFILLED!");
                this.updateZombcoinsHUD();
                this.updateShopButtonStates();
            }
        });
        
        document.getElementById('shop-repair-wall').addEventListener('click', () => {
            if (this.zombcoins >= 3 && this.world.wallHP < this.world.wallMaxHP) {
                this.zombcoins -= 3;
                this.world.repairWall(50);
                this.updateWallHPDisplay();
                this.hud.addKillFeed("🧱 DEFENSIVE WALL REPAIRED (+50 HP)!");
                this.updateZombcoinsHUD();
                this.updateShopButtonStates();
            }
        });
        
        document.getElementById('shop-upgrade-wall').addEventListener('click', () => {
            if (this.wallLevel < WALL_UPGRADES.length - 1) {
                const nextUpgrade = WALL_UPGRADES[this.wallLevel + 1];
                if (this.zombcoins >= nextUpgrade.cost) {
                    this.zombcoins -= nextUpgrade.cost;
                    this.wallLevel++;
                    
                    this.world.upgradeWall(this.wallLevel, nextUpgrade.maxHP, nextUpgrade.color);
                    this.updateWallHPDisplay();
                    this.hud.addKillFeed(`🛡️ WALL UPGRADED TO ${nextUpgrade.name.toUpperCase()}!`);
                    this.updateZombcoinsHUD();
                    this.updateShopButtonStates();
                }
            }
        });
        
        document.getElementById('shop-buy-dmg').addEventListener('click', () => {
            if (this.zombcoins >= 6) {
                this.zombcoins -= 6;
                this.weapon.damageMultiplier += 0.25;
                this.hud.addKillFeed(`🔥 DAMAGE UPGRADED (+25% Dmg, Now: x${this.weapon.damageMultiplier.toFixed(2)})!`);
                this.updateZombcoinsHUD();
                this.updateShopButtonStates();
            }
        });

        document.getElementById('btn-zombies-quit').addEventListener('click', () => {
            document.getElementById('zombies-game-over-screen').style.display = 'none';
            this.quitToMenu();
        });
    }

    updateZombcoinsHUD() {
        const val = document.getElementById('zombcoins-val');
        const shopVal = document.getElementById('shop-coins-val');
        if (val) val.textContent = this.zombcoins;
        if (shopVal) shopVal.textContent = this.zombcoins;
    }

    // ─── Resize ─────────────────────────────────────────────────
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateInteractions(dt) {
        if (!this.player || !this.player.isAlive || !this.world || !this.world.towers) {
            const prompt = document.getElementById('interact-prompt');
            if (prompt) prompt.style.display = 'none';
            return;
        }

        // Initialize interactCooldown
        if (this.interactCooldown === undefined) this.interactCooldown = 0;
        if (this.interactCooldown > 0) this.interactCooldown -= dt;

        const playerPos = this.player.camera.position;
        let nearButton = false;
        let activeTowerIndex = -1;

        const buttonWorldPos = new THREE.Vector3();
        for (let i = 0; i < this.world.towers.length; i++) {
            const tower = this.world.towers[i];
            
            // Force world matrix update so getWorldPosition returns correct coordinates
            tower.buttonMesh.updateMatrixWorld(true);
            tower.buttonMesh.getWorldPosition(buttonWorldPos);

            const dist = playerPos.distanceTo(buttonWorldPos);
            if (dist < 1.7) {
                nearButton = true;
                activeTowerIndex = i;
                break;
            }
        }

        const prompt = document.getElementById('interact-prompt');
        if (nearButton && prompt) {
            const activeTower = this.world.towers[activeTowerIndex];
            const actionText = activeTower.isOpen ? "CLOSE" : "OPEN";
            prompt.innerHTML = `PRESS <span style="color:#00f0ff; border:1px solid #00f0ff; padding:2px 8px; border-radius:4px; margin:0 4px; font-family:monospace;">E</span> TO ${actionText} BLAST DOOR`;
            prompt.style.display = 'block';

            // Handle press E key
            if (this.player.keys.interact && this.interactCooldown <= 0) {
                this.interactCooldown = 0.5; // Cooldown
                this.world.toggleTowerDoor(activeTowerIndex);

                // Play a toggle beep sound if audio is enabled
                if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
                    try {
                        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(activeTower.isOpen ? 330 : 550, audioCtx.currentTime); // Lower beep for close, higher for open
                        osc.frequency.exponentialRampToValueAtTime(activeTower.isOpen ? 550 : 880, audioCtx.currentTime + 0.12);
                        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.start();
                        osc.stop(audioCtx.currentTime + 0.15);
                    } catch (err) {
                        console.warn('Audio Context failed to play beep:', err);
                    }
                }
            }
        } else if (prompt) {
            prompt.style.display = 'none';
        }
    }
}

// ─── Boot ───────────────────────────────────────────────────────
const game = new Game();
