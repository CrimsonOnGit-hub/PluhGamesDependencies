import * as THREE from 'three';

const HEADSHOT_MULTIPLIER = 2;

const WEAPONS = {
    AR: 0,
    GLOCK: 1,
    KNIFE: 2,
    SNIPER: 3,
    SHOTGUN: 4
};

export class Weapon {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;

        this.raycaster = new THREE.Raycaster();
        
        // Input state
        this.mouseDown = false;
        this.isAiming = false;
        
        // Shop & damage multipliers
        this.unlocked = [true, true, true, true, true]; // AR, Glock, Knife, Sniper, Shotgun
        this.damageMultiplier = 1.0;

        this.weapons = [
            this.createAR(),
            this.createGlock(),
            this.createKnife(),
            this.createSniper(),
            this.createShotgun()
        ];
        
        this.currentIndex = WEAPONS.AR;
        
        // Hide all except current
        for (let i = 0; i < this.weapons.length; i++) {
            this.weapons[i].group.visible = (i === this.currentIndex);
        }

        // Bobbing state
        this.bobTime = 0;
        this.bobAmount = 0;

        // Event listeners
        this.onMouseDown = (e) => { 
            if (e.button === 0) this.mouseDown = true;
            if (e.button === 2) this.isAiming = true;
        };
        this.onMouseUp = (e) => { 
            if (e.button === 0) this.mouseDown = false;
            if (e.button === 2) this.isAiming = false;
        };
        this.onContextMenu = (e) => e.preventDefault();

        this.onKeyDown = (e) => {
            if (e.code === 'KeyR') this.reload();
            if (e.code === 'Digit1') this.switchWeapon(WEAPONS.AR);
            if (e.code === 'Digit2') this.switchWeapon(WEAPONS.GLOCK);
            if (e.code === 'Digit3') this.switchWeapon(WEAPONS.KNIFE);
            if (e.code === 'Digit4') this.switchWeapon(WEAPONS.SNIPER);
            if (e.code === 'Digit5') this.switchWeapon(WEAPONS.SHOTGUN);
        };

        this.onWheel = (e) => {
            let nextIndex = this.currentIndex;
            const dir = e.deltaY > 0 ? 1 : -1;
            for (let i = 0; i < this.weapons.length; i++) {
                nextIndex = (nextIndex + dir + this.weapons.length) % this.weapons.length;
                if (this.unlocked[nextIndex]) {
                    this.switchWeapon(nextIndex);
                    break;
                }
            }
        };

        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('wheel', this.onWheel);
    }

    get currentWeapon() {
        return this.weapons[this.currentIndex];
    }

    get ammo() { return this.currentWeapon.ammo; }
    set ammo(val) { this.currentWeapon.ammo = val; }
    get maxAmmo() { return this.currentWeapon.maxAmmo; }
    get isReloading() { return this.currentWeapon.isReloading; }
    set isReloading(val) { this.currentWeapon.isReloading = val; }
    get isShooting() { return this.currentWeapon.isShooting; }
    get name() { return this.currentWeapon.name; }

    switchWeapon(index) {
        if (index === this.currentIndex) return;
        if (index < 0 || index >= this.weapons.length) return;
        
        // Block switching to locked weapons
        if (!this.unlocked[index]) return;
        
        // Cancel reloading on current
        this.currentWeapon.isReloading = false;
        this.currentWeapon.isShooting = false;
        
        this.weapons[this.currentIndex].group.visible = false;
        this.currentIndex = index;
        this.weapons[this.currentIndex].group.visible = true;
        
        // Reset position
        this.weapons[this.currentIndex].group.position.copy(this.weapons[this.currentIndex].defaultPos);
        this.weapons[this.currentIndex].group.rotation.set(0, 0, 0);
    }

    createAR() {
        const group = new THREE.Group();
        group.position.set(0.3, -0.3, -0.5);
        const defaultPos = group.position.clone();

        // AR model (longer barrel, stock)
        const barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.5);
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.03, -0.2);
        group.add(barrel);

        const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.3);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0.1);
        group.add(body);

        const stockGeo = new THREE.BoxGeometry(0.06, 0.15, 0.2);
        const stockMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.set(0, -0.05, 0.35);
        group.add(stock);

        const gripGeo = new THREE.BoxGeometry(0.05, 0.12, 0.06);
        const gripMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.1, 0.15);
        grip.rotation.x = -0.2;
        group.add(grip);

        const magGeo = new THREE.BoxGeometry(0.04, 0.15, 0.08);
        const magMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const mag = new THREE.Mesh(magGeo, magMat);
        mag.position.set(0, -0.1, 0.02);
        group.add(mag);

        // Scope for AR
        const scopeGroup = new THREE.Group();
        scopeGroup.position.set(0, 0.12, 0.02);
        
        // Scope mount
        const mountGeo = new THREE.BoxGeometry(0.02, 0.05, 0.04);
        const mountMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const mount = new THREE.Mesh(mountGeo, mountMat);
        mount.position.set(0, -0.02, 0);
        scopeGroup.add(mount);
        
        // Scope tube (horizontal cylinder)
        const tubeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8);
        tubeGeo.rotateX(Math.PI / 2); // align along barrel
        const tubeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        scopeGroup.add(tube);
        
        // Scope glass lenses (cyan glow lens)
        const lensGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.01, 8);
        lensGeo.rotateX(Math.PI / 2);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.15 });
        const frontLens = new THREE.Mesh(lensGeo, lensMat);
        frontLens.position.set(0, 0, -0.11);
        scopeGroup.add(frontLens);
        
        const backLens = new THREE.Mesh(lensGeo, lensMat);
        backLens.position.set(0, 0, 0.11);
        scopeGroup.add(backLens);
        
        group.add(scopeGroup);

        this.addFirstPersonHands(group, false, false);

        this.camera.add(group);

        const muzzleFlash = new THREE.PointLight(0xffaa00, 3, 5);
        muzzleFlash.position.set(0, 0.03, -0.5);
        muzzleFlash.visible = false;
        group.add(muzzleFlash);

        return {
            name: "ASSAULT RIFLE",
            group, defaultPos, muzzleFlash,
            adsPos: new THREE.Vector3(0, -0.16, -0.3), adsFov: 40,
            damage: 20, maxAmmo: 30, ammo: 30,
            fireRate: 0.1, reloadTime: 2.0, range: 100,
            isAuto: true, lastShotWasDown: false,
            isReloading: false, reloadTimer: 0, fireTimer: 0, isShooting: false, muzzleFlashTimer: 0
        };
    }

    createGlock() {
        const group = new THREE.Group();
        group.position.set(0.3, -0.3, -0.5);
        const defaultPos = group.position.clone();

        // Glock model
        const barrelGeo = new THREE.BoxGeometry(0.06, 0.08, 0.2);
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.05, 0);
        group.add(barrel);

        const gripGeo = new THREE.BoxGeometry(0.05, 0.12, 0.06);
        const gripMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.05, 0.06);
        grip.rotation.x = -0.1;
        group.add(grip);

        this.addFirstPersonHands(group, false, true);

        this.camera.add(group);

        const muzzleFlash = new THREE.PointLight(0xffaa00, 2, 4);
        muzzleFlash.position.set(0, 0.05, -0.15);
        muzzleFlash.visible = false;
        group.add(muzzleFlash);

        return {
            name: "GLOCK",
            group, defaultPos, muzzleFlash,
            adsPos: new THREE.Vector3(0, -0.15, -0.3), adsFov: 65,
            damage: 25, maxAmmo: 12, ammo: 12,
            fireRate: 0.15, reloadTime: 1.2, range: 80,
            isAuto: false, lastShotWasDown: false,
            isReloading: false, reloadTimer: 0, fireTimer: 0, isShooting: false, muzzleFlashTimer: 0
        };
    }

    createKnife() {
        const group = new THREE.Group();
        group.position.set(0.3, -0.3, -0.5);
        const defaultPos = group.position.clone();

        // Knife model
        const bladeGeo = new THREE.BoxGeometry(0.01, 0.06, 0.25);
        const bladeMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, 0, -0.1);
        group.add(blade);

        const knifeGripGeo = new THREE.BoxGeometry(0.03, 0.05, 0.12);
        const knifeGripMat = new THREE.MeshLambertMaterial({ color: 0x332211 });
        const grip = new THREE.Mesh(knifeGripGeo, knifeGripMat);
        grip.position.set(0, -0.02, 0.08);
        group.add(grip);

        this.addFirstPersonHands(group, true, false);

        this.camera.add(group);

        return {
            name: "COMBAT KNIFE",
            group, defaultPos, muzzleFlash: null,
            adsPos: defaultPos, adsFov: 80,
            damage: 50, maxAmmo: Infinity, ammo: Infinity,
            fireRate: 0.5, reloadTime: 0, range: 100.0,
            isAuto: false, lastShotWasDown: false, isMelee: false,
            isReloading: false, reloadTimer: 0, fireTimer: 0, isShooting: false, muzzleFlashTimer: 0
        };
    }

    createSniper() {
        const group = new THREE.Group();
        group.position.set(0.3, -0.3, -0.5);
        const defaultPos = group.position.clone();

        // Sniper body
        const bodyGeo = new THREE.BoxGeometry(0.06, 0.1, 0.5);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x334433 }); // Olive drab
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0);
        group.add(body);

        // Long barrel
        const barrelGeo = new THREE.BoxGeometry(0.04, 0.04, 0.8);
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.03, -0.5);
        group.add(barrel);

        // Detailed Sniper Scope
        const scopeGroup = new THREE.Group();
        scopeGroup.position.set(0, 0.09, -0.05);

        // Mount blocks
        const scopeMountGeo = new THREE.BoxGeometry(0.02, 0.04, 0.04);
        const scopeMountMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const frontMount = new THREE.Mesh(scopeMountGeo, scopeMountMat);
        frontMount.position.set(0, -0.02, -0.08);
        scopeGroup.add(frontMount);

        const backMount = new THREE.Mesh(scopeMountGeo, scopeMountMat);
        backMount.position.set(0, -0.02, 0.08);
        scopeGroup.add(backMount);

        // Scope tube center
        const centerTubeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8);
        centerTubeGeo.rotateX(Math.PI / 2);
        const tubeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const centerTube = new THREE.Mesh(centerTubeGeo, tubeMat);
        scopeGroup.add(centerTube);

        // Eyepiece (back flare)
        const eyeGeo = new THREE.CylinderGeometry(0.035, 0.025, 0.06, 8);
        eyeGeo.rotateX(Math.PI / 2);
        const eyepiece = new THREE.Mesh(eyeGeo, tubeMat);
        eyepiece.position.set(0, 0, 0.11);
        scopeGroup.add(eyepiece);

        // Objective lens (front flare)
        const objGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.08, 8);
        objGeo.rotateX(Math.PI / 2);
        const objective = new THREE.Mesh(objGeo, tubeMat);
        objective.position.set(0, 0, -0.12);
        scopeGroup.add(objective);

        // Lenses (cyan-glowing optic glass)
        const glassGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.005, 8);
        glassGeo.rotateX(Math.PI / 2);
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.15 });
        const frontGlass = new THREE.Mesh(glassGeo, glassMat);
        frontGlass.position.set(0, 0, -0.155);
        scopeGroup.add(frontGlass);

        const backGlass = new THREE.Mesh(glassGeo, glassMat);
        backGlass.position.set(0, 0, 0.135);
        scopeGroup.add(backGlass);

        group.add(scopeGroup);

        // Stock
        const stockGeo = new THREE.BoxGeometry(0.06, 0.12, 0.25);
        const stockMat = new THREE.MeshLambertMaterial({ color: 0x221111 }); // Wood/Dark brown
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.set(0, -0.02, 0.35);
        group.add(stock);

        const muzzleFlash = new THREE.Mesh(
            new THREE.PlaneGeometry(0.5, 0.5),
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
        );
        muzzleFlash.position.set(0, 0.03, -1.0);
        muzzleFlash.visible = false;
        group.add(muzzleFlash);
        
        this.addFirstPersonHands(group, false, false);

        this.camera.add(group);

        return {
            name: "SNIPER RIFLE",
            group, defaultPos, muzzleFlash,
            adsPos: new THREE.Vector3(0, -0.16, -0.3), adsFov: 20, // Massive zoom
            damage: 150, maxAmmo: 5, ammo: 5, // 1-shot kill (most bots have 100 HP)
            fireRate: 1.5, reloadTime: 3.0, range: 500,
            isAuto: false, lastShotWasDown: false,
            isReloading: false, reloadTimer: 0, fireTimer: 0, isShooting: false, muzzleFlashTimer: 0
        };
    }

    createShotgun() {
        const group = new THREE.Group();
        group.position.set(0.3, -0.25, -0.4);
        const defaultPos = group.position.clone();

        // Shotgun body
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.1, 0.4);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0);
        group.add(body);

        // Double barrel (over-under)
        const barrelGeo = new THREE.BoxGeometry(0.06, 0.08, 0.4);
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.04, -0.3);
        group.add(barrel);

        // Grip/Pump
        const pumpGeo = new THREE.BoxGeometry(0.1, 0.08, 0.15);
        const pumpMat = new THREE.MeshLambertMaterial({ color: 0x443322 });
        const pump = new THREE.Mesh(pumpGeo, pumpMat);
        pump.position.set(0, 0, -0.2);
        group.add(pump);

        const muzzleFlash = new THREE.Mesh(
            new THREE.PlaneGeometry(0.6, 0.6),
            new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        );
        muzzleFlash.position.set(0, 0.04, -0.6);
        muzzleFlash.visible = false;
        group.add(muzzleFlash);
        
        this.addFirstPersonHands(group, false, false);

        this.camera.add(group);

        return {
            name: "SHOTGUN",
            group, defaultPos, muzzleFlash,
            adsPos: new THREE.Vector3(0, -0.15, -0.3), adsFov: 70, // Slight zoom
            damage: 15, maxAmmo: 6, ammo: 6, // 15 damage per pellet
            fireRate: 0.8, reloadTime: 2.5, range: 40,
            isAuto: false, lastShotWasDown: false,
            isShotgun: true, pellets: 8, spread: 0.1, // Shotgun specific properties
            isReloading: false, reloadTimer: 0, fireTimer: 0, isShooting: false, muzzleFlashTimer: 0
        };
    }

    reload() {
        const cw = this.currentWeapon;
        if (cw.isReloading || cw.ammo === cw.maxAmmo || cw.maxAmmo === Infinity) return;
        cw.isReloading = true;
        cw.reloadTimer = cw.reloadTime;
    }

    update(dt, isMoving) {
        const cw = this.currentWeapon;
        cw.isShooting = false;
        
        // Handle Reloading
        if (cw.isReloading) {
            cw.reloadTimer -= dt;
            
            // Reload animation
            cw.group.rotation.x = Math.sin((cw.reloadTimer / cw.reloadTime) * Math.PI) * 0.5;
            cw.group.position.y = cw.defaultPos.y - Math.sin((cw.reloadTimer / cw.reloadTime) * Math.PI) * 0.1;

            if (cw.reloadTimer <= 0) {
                cw.isReloading = false;
                cw.ammo = cw.maxAmmo;
                cw.group.rotation.x = 0;
                cw.group.position.copy(cw.defaultPos);
                
                // Fire a custom event or callback to HUD if we had one, but Game.js will poll
            }
            return;
        }

        // Fire timer
        if (cw.fireTimer > 0) {
            cw.fireTimer -= dt;
        }

        // Muzzle flash timer
        if (cw.muzzleFlash && cw.muzzleFlashTimer > 0) {
            cw.muzzleFlashTimer -= dt;
            if (cw.muzzleFlashTimer <= 0) {
                cw.muzzleFlash.visible = false;
            }
        }

        // Aim Down Sights (ADS)
        const baseFov = 80;
        let targetPos = cw.defaultPos;
        let targetFov = baseFov;
        let bobScale = 1.0;

        if (this.isAiming && !cw.isMelee && !cw.isReloading) {
            targetPos = cw.adsPos;
            targetFov = cw.adsFov;
            bobScale = 0.2; // Less bobbing while aiming
        }

        // Smoothly interpolate FOV
        if (Math.abs(this.camera.fov - targetFov) > 0.1) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 15);
            this.camera.updateProjectionMatrix();
        }

        // Recoil recovery and ADS interpolation
        cw.group.position.lerp(targetPos, dt * 15);
        cw.group.rotation.x = THREE.MathUtils.lerp(cw.group.rotation.x, 0, dt * 15);

        // Weapon bobbing
        if (isMoving && !cw.isReloading) {
            this.bobTime += dt * 12;
            this.bobAmount = 0.02 * bobScale;
            
            cw.group.position.x = targetPos.x + Math.sin(this.bobTime) * this.bobAmount;
            cw.group.position.y = targetPos.y + Math.abs(Math.cos(this.bobTime)) * this.bobAmount;
        } else {
            this.bobTime = 0;
            cw.group.position.x = THREE.MathUtils.lerp(cw.group.position.x, targetPos.x, dt * 10);
            cw.group.position.y = THREE.MathUtils.lerp(cw.group.position.y, targetPos.y, dt * 10);
        }
    }

    shoot(targets) {
        const cw = this.currentWeapon;
        if (cw.isReloading || cw.fireTimer > 0) return null;

        // Sniper rifle requires using the scope (aiming) to fire
        if (cw.name === "SNIPER RIFLE" && !this.isAiming) {
            return null;
        }

        // Semi-auto check
        if (!cw.isAuto) {
            if (this.mouseDown && cw.lastShotWasDown) {
                return null; // Must release and click again
            }
        }

        if (!this.mouseDown) {
            cw.lastShotWasDown = false;
            return null;
        }

        cw.lastShotWasDown = true;

        if (cw.ammo <= 0) {
            this.reload();
            return null;
        }

        // Fire weapon
        cw.isShooting = true;
        cw.fireTimer = cw.fireRate;
        if (cw.ammo !== Infinity) cw.ammo--;

        // Visual effects (Recoil & Flash)
        if (cw.isMelee) {
            cw.group.rotation.x = -1.0; // Swing motion
            cw.group.position.z -= 0.2;
        } else {
            cw.group.position.z += 0.05;
            cw.group.rotation.x += 0.05;
            if (cw.muzzleFlash) {
                cw.muzzleFlash.visible = true;
                cw.muzzleFlashTimer = 0.05;
            }
        }

        // Raycast logic
        const raycastHit = (spreadX = 0, spreadY = 0) => {
            // Apply spread by slightly rotating camera direction
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(this.camera.quaternion);
            
            if (spreadX !== 0 || spreadY !== 0) {
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
                direction.addScaledVector(right, spreadX);
                direction.addScaledVector(up, spreadY);
                direction.normalize();
            }

            this.raycaster.set(this.camera.position, direction);
            this.raycaster.far = cw.range;
            
            let closestHit = null;
            let closestDist = Infinity;

            for (const target of targets) {
                if (target.type === 'bot' || target.type === 'player') {
                    const pos = target.mesh.position;
                    const box = new THREE.Box3(
                        new THREE.Vector3(pos.x - 0.5, pos.y, pos.z - 0.5),
                        new THREE.Vector3(pos.x + 0.5, pos.y + 2.0, pos.z + 0.5)
                    );
                    const intersection = this.raycaster.ray.intersectBox(box, new THREE.Vector3());
                    if (intersection) {
                        const dist = this.raycaster.ray.origin.distanceTo(intersection);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestHit = { target, intersection };
                        }
                    }
                } else if (target.type === 'world') {
                    const intersection = this.raycaster.ray.intersectBox(target.obj, new THREE.Vector3());
                    if (intersection) {
                        const dist = this.raycaster.ray.origin.distanceTo(intersection);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestHit = { target, intersection };
                        }
                    }
                } else if (target.type === 'mesh') {
                    const intersections = this.raycaster.intersectObject(target.obj);
                    if (intersections && intersections.length > 0) {
                        const intersection = intersections[0].point;
                        const dist = this.raycaster.ray.origin.distanceTo(intersection);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestHit = { target, intersection };
                        }
                    }
                }
            }

            if (closestHit && (closestHit.target.type === 'bot' || closestHit.target.type === 'player')) {
                const hitPoint = closestHit.intersection;
                const botMesh = closestHit.target.mesh;
                const relativeY = hitPoint.y - botMesh.position.y;
                const isHeadshot = relativeY > 1.4;
                
                return {
                    hit: true,
                    target: closestHit.target.ref,
                    targetType: closestHit.target.type,
                    damage: (isHeadshot ? cw.damage * HEADSHOT_MULTIPLIER : cw.damage) * this.damageMultiplier,
                    point: hitPoint,
                    isHeadshot
                };
            }

            if (closestHit && (closestHit.target.type === 'world' || closestHit.target.type === 'mesh')) {
                return { hit: true, target: 'world', targetType: 'world', point: closestHit.intersection };
            }

            return null;
        };

        if (cw.isShotgun) {
            const results = [];
            for (let i = 0; i < cw.pellets; i++) {
                // Random spread within a circle
                const r = Math.random() * cw.spread;
                const theta = Math.random() * Math.PI * 2;
                const sx = r * Math.cos(theta);
                const sy = r * Math.sin(theta);
                const hit = raycastHit(sx, sy);
                if (hit) results.push(hit);
            }
            return results;
        } else {
            return raycastHit(0, 0);
        }
    }

    addFirstPersonHands(group, isMelee = false, isPistol = false) {
        const armMat = new THREE.MeshLambertMaterial({ color: 0xffdcb3 }); // Skin tone
        const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); // Black tactical sleeves

        if (isMelee) {
            // Knife: hold it with one hand (right hand only)
            const handRGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const handR = new THREE.Mesh(handRGeo, armMat);
            handR.position.set(0, -0.05, 0.08);
            group.add(handR);

            const armRGeo = new THREE.BoxGeometry(0.09, 0.09, 0.4);
            const armR = new THREE.Mesh(armRGeo, sleeveMat);
            armR.position.set(0.1, -0.22, 0.22);
            armR.rotation.set(-0.6, -0.4, 0.2);
            group.add(armR);
        } else if (isPistol) {
            // Glock: hold it with one hand (right hand)
            const handRGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const handR = new THREE.Mesh(handRGeo, armMat);
            handR.position.set(0, -0.06, 0.06);
            group.add(handR);

            const armRGeo = new THREE.BoxGeometry(0.09, 0.09, 0.4);
            const armR = new THREE.Mesh(armRGeo, sleeveMat);
            armR.position.set(0.1, -0.22, 0.22);
            armR.rotation.set(-0.6, -0.4, 0.2);
            group.add(armR);
        } else {
            // Rifles / Shotguns: two hands
            // Right Hand (on grip)
            const handRGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const handR = new THREE.Mesh(handRGeo, armMat);
            handR.position.set(0, -0.08, 0.15);
            group.add(handR);

            // Right Arm
            const armRGeo = new THREE.BoxGeometry(0.09, 0.09, 0.45);
            const armR = new THREE.Mesh(armRGeo, sleeveMat);
            armR.position.set(0.12, -0.25, 0.28);
            armR.rotation.set(-0.6, -0.4, 0.2);
            group.add(armR);

            // Left Hand (under barrel / pump)
            const handLGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            const handL = new THREE.Mesh(handLGeo, armMat);
            handL.position.set(-0.08, -0.04, -0.1);
            group.add(handL);

            // Left Arm
            const armLGeo = new THREE.BoxGeometry(0.09, 0.09, 0.5);
            const armL = new THREE.Mesh(armLGeo, sleeveMat);
            armL.position.set(-0.2, -0.22, 0.1);
            armL.rotation.set(-0.5, 0.5, -0.3);
            group.add(armL);
        }
    }

    dispose() {
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('contextmenu', this.onContextMenu);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('wheel', this.onWheel);

        // Remove weapon meshes from camera and dispose WebGL resources to prevent leaks
        for (const w of this.weapons) {
            if (w && w.group) {
                this.camera.remove(w.group);
                w.group.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }
        }
    }
}
