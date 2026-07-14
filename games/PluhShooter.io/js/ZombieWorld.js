import * as THREE from 'three';

/**
 * ZombieWorld.js — Dark zombie survival map
 * Layout: One front wall (destructible), abandoned buildings on sides,
 * solid back wall, core zone at back. Zombies spawn from the front only.
 */

export class ZombieWorld {
    constructor(scene) {
        this.scene = scene;
        this.colliders = [];
        this.spawnPoints = [];
        this.zombieSpawnPoints = [];
        this.group = new THREE.Group();
        
        // Destructible front wall (starts as Cardboard)
        this.wallHP = 50;
        this.wallMaxHP = 50;
        this.wallMeshes = [];
        this.wallDamageMeshes = [];
        this.wallCollider = null;
        this.wallDestroyed = false;

        // Upgrade state (0=Cardboard, 1=Wood, 2=Cobblestone, 3=Concrete, 4=Steel, 5=Titanium)
        this.upgradeLevel = 0;
        this.towers = [];

        // Core zone (back of base) — if zombies reach here, game over
        this.coreZone = new THREE.Box3(
            new THREE.Vector3(-6, -1, 15),
            new THREE.Vector3(6, 5, 25)
        );

        this.build();
        this.scene.add(this.group);
    }

    build() {
        this.createFloor();
        this.createBoundaryWalls();
        this.createFrontWall();
        this.createSideBuildings();
        this.createBaseDetails();
        this.createSniperTower(-15, -3); // Left tower
        this.createSniperTower(15, -3);  // Right tower
        this.createWallClutter();
        this.setupSpawnPoints();
        
        // Apply initial visual setup (Cardboard theme)
        this.updateTowerVisuals();
    }

    getTerrainHeight(x, z) {
        // Mostly flat with subtle variation
        return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.15;
    }

    createFloor() {
        const size = 120;
        const segments = 60;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const y = this.getTerrainHeight(x, z);
            posAttr.setY(i, y);

            // Dark, desaturated ground colors
            const noise = Math.sin(x * 0.7 + z * 1.3) * 0.03;
            colors[i * 3] = 0.12 + noise;
            colors[i * 3 + 1] = 0.11 + noise * 0.8;
            colors[i * 3 + 2] = 0.10 + noise * 0.5;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.floorMesh = mesh;

        // Scattered debris
        const dummy = new THREE.Object3D();
        const debrisGeo = new THREE.DodecahedronGeometry(0.15, 0);
        const debrisMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const debris = new THREE.InstancedMesh(debrisGeo, debrisMat, 300);
        for (let i = 0; i < 300; i++) {
            const x = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;
            dummy.position.set(x, this.getTerrainHeight(x, z) + 0.05, z);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            const s = 0.3 + Math.random() * 1.5;
            dummy.scale.set(s, s * 0.5, s);
            dummy.updateMatrix();
            debris.setMatrixAt(i, dummy.matrix);
        }
        this.group.add(debris);

        // Dead trees in the wasteland (front area)
        for (let i = 0; i < 12; i++) {
            const x = (Math.random() - 0.5) * 80;
            const z = -20 - Math.random() * 30; // In front of wall
            this.createDeadTree(x, z);
        }
    }

    createDeadTree(x, z) {
        const y = this.getTerrainHeight(x, z);
        const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 3, 5);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x1a1510 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, y + 1.5, z);
        trunk.castShadow = true;
        this.group.add(trunk);

        // Bare branches
        for (let b = 0; b < 3; b++) {
            const branchGeo = new THREE.CylinderGeometry(0.02, 0.05, 1.2, 4);
            const branch = new THREE.Mesh(branchGeo, trunkMat);
            branch.position.set(
                (Math.random() - 0.5) * 0.3,
                0.8 + b * 0.4,
                (Math.random() - 0.5) * 0.3
            );
            branch.rotation.set(
                (Math.random() - 0.5) * 1.2,
                Math.random() * Math.PI,
                (Math.random() - 0.5) * 1.2
            );
            trunk.add(branch);
        }
    }

    createBoundaryWalls() {
        const wallH = 12;
        const wallT = 3;
        const wallColor = 0x1a1815;

        // Back wall (solid, no zombies come from here)
        this.addBox(0, wallH / 2, 28, 60, wallH, wallT, wallColor);

        // Left boundary (far)
        this.addBox(-30, wallH / 2, 0, wallT, wallH, 60, wallColor);

        // Right boundary (far)
        this.addBox(30, wallH / 2, 0, wallT, wallH, 60, wallColor);

        // Front far boundary (zombies spawn between this and the wall)
        this.addBox(0, wallH / 2, -50, 64, wallH, wallT, wallColor);
    }

    createFrontWall() {
        // THE WALL — the main defensive barrier
        // Positioned at z = -5, spanning x = -20 to x = 20
        const wallColor = 0x555555;
        const wallDamagedColor = 0x443333;

        // Main wall segments (visual, will show damage)
        const segmentWidth = 8;
        const wallY = 2.5;
        const wallZ = -5;

        for (let sx = -2; sx <= 2; sx++) {
            const x = sx * segmentWidth;
            const geo = new THREE.BoxGeometry(segmentWidth - 0.1, 5, 1.5);
            const mat = new THREE.MeshLambertMaterial({ color: wallColor });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, wallY, wallZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh);
            this.wallMeshes.push(mesh);

            // Damage overlay (cracks — hidden initially)
            const crackGeo = new THREE.BoxGeometry(segmentWidth - 0.2, 4.8, 0.1);
            const crackMat = new THREE.MeshBasicMaterial({ 
                color: wallDamagedColor, 
                transparent: true, 
                opacity: 0 
            });
            const crackMesh = new THREE.Mesh(crackGeo, crackMat);
            crackMesh.position.set(x, wallY, wallZ + 0.8);
            this.group.add(crackMesh);
            this.wallDamageMeshes.push(crackMesh);
        }

        // Wall top detail (concrete lip)
        const lipGeo = new THREE.BoxGeometry(40.5, 0.4, 2);
        const lipMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const lip = new THREE.Mesh(lipGeo, lipMat);
        lip.position.set(0, 5.2, -5);
        lip.castShadow = true;
        this.group.add(lip);

        // Wall collider
        const wallBox = new THREE.Box3();
        wallBox.setFromCenterAndSize(
            new THREE.Vector3(0, 2.5, -5),
            new THREE.Vector3(40, 5, 1.5)
        );
        this.wallCollider = wallBox;
        this.colliders.push(wallBox);

        // Sandbags in front of wall
        for (let sx = -2; sx <= 2; sx += 2) {
            const sbX = sx * 6;
            this.addBox(sbX, 0.4, -6.5, 3, 0.8, 1, 0x6e6353);
        }
    }

    createSideBuildings() {
        const brickColor = 0x2a2420;
        const concreteColor = 0x333333;
        const darkWood = 0x1a1510;

        // === LEFT SIDE BUILDINGS ===
        // Building 1 (left-front)
        this.createAbandonedBuilding(-22, 0, -2, brickColor);
        // Building 2 (left-middle)
        this.createAbandonedBuilding(-22, 0, 12, concreteColor);

        // === RIGHT SIDE BUILDINGS ===
        // Building 3 (right-front)
        this.createAbandonedBuilding(22, 0, -2, brickColor);
        // Building 4 (right-middle)
        this.createAbandonedBuilding(22, 0, 12, concreteColor);
    }

    createAbandonedBuilding(px, py, pz, color) {
        const group = new THREE.Group();
        group.position.set(px, py, pz);
        this.group.add(group);

        const floorColor = 0x1a1815;
        const darkColor = 0x111111;

        // Floor
        this.addBoxAt(0, 0.1, 0, 10, 0.2, 12, floorColor, group);
        // Back wall
        this.addBoxAt(0, 3, -5.7, 10, 6, 0.6, color, group);
        // Left wall
        this.addBoxAt(-4.7, 3, 0, 0.6, 6, 12, color, group);
        // Right wall
        this.addBoxAt(4.7, 3, 0, 0.6, 6, 12, color, group);
        // Partial front wall (with gap/doorway)
        this.addBoxAt(-3, 3, 5.7, 4, 6, 0.6, color, group);
        this.addBoxAt(3, 3, 5.7, 4, 6, 0.6, color, group);
        // Lintel over door
        this.addBoxAt(0, 5, 5.7, 3, 2, 0.6, color, group);
        // Partial roof (collapsed)
        this.addBoxAt(-1.5, 6.2, -1.5, 7, 0.3, 9, darkColor, group);

        // Interior rubble
        const rubbleGeo = new THREE.DodecahedronGeometry(0.3, 0);
        const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        for (let i = 0; i < 5; i++) {
            const rubble = new THREE.Mesh(rubbleGeo, rubbleMat);
            rubble.position.set(
                (Math.random() - 0.5) * 6,
                0.3 + Math.random() * 0.3,
                (Math.random() - 0.5) * 8
            );
            rubble.scale.set(
                0.5 + Math.random(),
                0.3 + Math.random() * 0.5,
                0.5 + Math.random()
            );
            group.add(rubble);
        }
    }

    addBoxAt(x, y, z, w, h, d, color, group) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // Collider in world space
        const worldPos = new THREE.Vector3(
            group.position.x + x,
            group.position.y + y,
            group.position.z + z
        );
        const box = new THREE.Box3();
        box.setFromCenterAndSize(worldPos, new THREE.Vector3(w, h, d));
        this.colliders.push(box);
        return mesh;
    }

    createBaseDetails() {
        // Barrel fires inside the base (dim light sources)
        this.barrelFirePositions = [
            [-8, 8], [8, 8], [-5, 18], [5, 18], [0, 12]
        ];

        for (const [bx, bz] of this.barrelFirePositions) {
            const y = this.getTerrainHeight(bx, bz);
            // Barrel
            const barrelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 8);
            const barrelMat = new THREE.MeshLambertMaterial({ color: 0x2a2520 });
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.position.set(bx, y + 0.45, bz);
            barrel.castShadow = true;
            this.group.add(barrel);

            // Fire glow
            const fireGeo = new THREE.SphereGeometry(0.3, 6, 6);
            const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
            const fire = new THREE.Mesh(fireGeo, fireMat);
            fire.position.set(bx, y + 1.0, bz);
            this.group.add(fire);
        }

        // Ammo crates
        const crateColor = 0x3a3020;
        this.addBox(-3, 0.4, 10, 1.2, 0.8, 0.8, crateColor);
        this.addBox(3, 0.4, 10, 1.2, 0.8, 0.8, crateColor);
        this.addBox(0, 0.4, 20, 1.5, 0.8, 1.0, crateColor);
        this.addBox(-6, 0.4, 15, 1.0, 0.8, 0.8, crateColor);
        this.addBox(6, 0.4, 15, 1.0, 0.8, 0.8, crateColor);
    }

    addBox(x, y, z, w, h, d, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);

        const box = new THREE.Box3();
        box.setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(w, h, d)
        );
        this.colliders.push(box);
        return mesh;
    }

    setupSpawnPoints() {
        // Player spawn points (inside the base)
        this.spawnPoints = [
            new THREE.Vector3(0, 1.5, 15),
            new THREE.Vector3(-5, 1.5, 10),
            new THREE.Vector3(5, 1.5, 10),
            new THREE.Vector3(0, 1.5, 20),
            new THREE.Vector3(-8, 1.5, 15),
            new THREE.Vector3(8, 1.5, 15)
        ];

        // Zombie spawn points (in front of the wall, spread across the wasteland)
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 50;
            const z = -20 - Math.random() * 25;
            this.zombieSpawnPoints.push(new THREE.Vector3(x, 0.5, z));
        }
    }

    // === WALL DAMAGE SYSTEM ===

    damageWall(amount) {
        if (this.wallDestroyed) return;
        this.wallHP = Math.max(0, this.wallHP - amount);

        // Update visual damage
        const damagePercent = 1 - (this.wallHP / this.wallMaxHP);
        for (const crackMesh of this.wallDamageMeshes) {
            crackMesh.material.opacity = damagePercent * 0.8;
        }

        // Color shift on wall meshes
        for (const wm of this.wallMeshes) {
            const r = 0.33 + damagePercent * 0.2;
            const g = 0.33 - damagePercent * 0.15;
            const b = 0.33 - damagePercent * 0.15;
            wm.material.color.setRGB(r, g, b);
        }

        if (this.wallHP <= 0) {
            this.destroyWall();
        }
    }

    repairWall(amount) {
        this.wallHP = Math.min(this.wallMaxHP, this.wallHP + amount);
        
        if (this.wallDestroyed && this.wallHP > 0) {
            // Rebuild wall
            this.wallDestroyed = false;
            for (const wm of this.wallMeshes) {
                wm.visible = true;
            }
            // Re-add collider
            if (!this.colliders.includes(this.wallCollider)) {
                this.colliders.push(this.wallCollider);
            }
        }

        // Update visuals
        const damagePercent = 1 - (this.wallHP / this.wallMaxHP);
        for (const crackMesh of this.wallDamageMeshes) {
            crackMesh.material.opacity = damagePercent * 0.8;
        }
        for (const wm of this.wallMeshes) {
            const r = 0.33 + damagePercent * 0.2;
            const g = 0.33 - damagePercent * 0.15;
            const b = 0.33 - damagePercent * 0.15;
            wm.material.color.setRGB(r, g, b);
        }
    }

    reinforceWalls() {
        this.wallMaxHP = Math.floor(this.wallMaxHP * 1.5);
        this.wallHP = this.wallMaxHP;
        this.repairWall(0); // Update visuals
    }

    destroyWall() {
        this.wallDestroyed = true;
        // Hide wall meshes
        for (const wm of this.wallMeshes) {
            wm.visible = false;
        }
        // Remove collider
        const idx = this.colliders.indexOf(this.wallCollider);
        if (idx !== -1) this.colliders.splice(idx, 1);

        // Scatter rubble
        for (let i = 0; i < 15; i++) {
            const rubbleGeo = new THREE.BoxGeometry(
                0.5 + Math.random() * 1.5,
                0.3 + Math.random() * 0.5,
                0.5 + Math.random() * 1.0
            );
            const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            const rubble = new THREE.Mesh(rubbleGeo, rubbleMat);
            rubble.position.set(
                (Math.random() - 0.5) * 30,
                0.2 + Math.random() * 0.3,
                -5 + (Math.random() - 0.5) * 4
            );
            rubble.rotation.set(
                Math.random() * 0.5,
                Math.random() * Math.PI,
                Math.random() * 0.3
            );
            rubble.castShadow = true;
            this.group.add(rubble);
        }
    }

    // === API ===

    getColliders() { return this.colliders; }
    getSpawnPoints() { return this.spawnPoints; }
    getZombieSpawnPoints() { return this.zombieSpawnPoints; }
    getRandomSpawnPoint() {
        return this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)].clone();
    }
    getRandomZombieSpawn() {
        return this.zombieSpawnPoints[Math.floor(Math.random() * this.zombieSpawnPoints.length)].clone();
    }
    isInCoreZone(position) {
        return this.coreZone.containsPoint(position);
    }

    addVisualBox(x, y, z, w, h, d, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    addVisualBoxAt(x, y, z, w, h, d, color, group) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    addColliderBoxAt(x, y, z, w, h, d, group) {
        const worldPos = new THREE.Vector3(
            group.position.x + x,
            group.position.y + y,
            group.position.z + z
        );
        const box = new THREE.Box3();
        box.setFromCenterAndSize(worldPos, new THREE.Vector3(w, h, d));
        this.colliders.push(box);
    }

    createSniperTower(px, pz) {
        const group = new THREE.Group();
        group.position.set(px, 0, pz);
        this.group.add(group);

        // We use dynamic materials, so initialize placeholders
        const dummyMat = new THREE.MeshLambertMaterial({ color: 0x5a3d28 });

        // Pillars
        const p1 = this.addBoxAt(-1.8, 2.5, -1.8, 0.3, 5.0, 0.3, 0x5a3d28, group);
        const p2 = this.addBoxAt(1.8, 2.5, -1.8, 0.3, 5.0, 0.3, 0x5a3d28, group);
        const p3 = this.addBoxAt(-1.8, 2.5, 1.8, 0.3, 5.0, 0.3, 0x5a3d28, group);
        const p4 = this.addBoxAt(1.8, 2.5, 1.8, 0.3, 5.0, 0.3, 0x5a3d28, group);

        // Platform (Visual only)
        const plat = this.addVisualBoxAt(0, 5.0, 0, 4.0, 0.2, 4.0, 0x3d281a, group);

        // Platform Colliders split to leave a gap at the top of the stairs (z = 1.0 to 2.0 at x = [-0.6, 0.6])
        this.addColliderBoxAt(-1.3, 5.0, 0, 1.4, 0.2, 4.0, group); // Left platform part
        this.addColliderBoxAt(1.3, 5.0, 0, 1.4, 0.2, 4.0, group);  // Right platform part
        this.addColliderBoxAt(0, 5.0, -0.5, 1.2, 0.2, 3.0, group); // Front platform part (leaves z = 1.0 to 2.0 clear)

        // Railings (left, right)
        const r1 = this.addBoxAt(-1.95, 5.5, 0, 0.1, 0.6, 4.0, 0x5a3d28, group); // Left
        const r2 = this.addBoxAt(1.95, 5.5, 0, 0.1, 0.6, 4.0, 0x5a3d28, group);  // Right
        
        // Back left/right rails, leaving center open for steps
        const r3 = this.addBoxAt(-1.3, 5.5, 1.95, 1.4, 0.6, 0.1, 0x5a3d28, group);
        const r4 = this.addBoxAt(1.3, 5.5, 1.95, 1.4, 0.6, 0.1, 0x5a3d28, group);

        this.towers.push({
            group,
            pillars: [p1, p2, p3, p4],
            platform: plat,
            railings: [r1, r2, r3, r4],
            neonTrim: []
        });

        // 1. VISUAL STEPS (Looks spaced and nice, but has NO collision boxes! Height goes up to 5.1, width 1.8)
        const numVisualSteps = 12;
        const stepW = 1.8;
        const stepH = 5.1 / numVisualSteps;
        const stepD = 4.0 / numVisualSteps;
        for (let i = 0; i < numVisualSteps; i++) {
            const stepY = (i + 0.5) * stepH;
            const stepZ = 2.0 + (numVisualSteps - 1 - i) * stepD + (stepD / 2);
            this.addVisualBoxAt(0, stepY, stepZ, stepW, stepH, stepD, 0x3d281a, group);
        }

        // 2. INVISIBLE SLOPE COLLIDERS (50 tiny steps to create a smooth slope collider! Height goes up to 5.1, width 1.8)
        const numCollisionSteps = 50;
        const colW = 1.8;
        const colH = 5.1 / numCollisionSteps;
        const colD = 4.0 / numCollisionSteps;
        for (let i = 0; i < numCollisionSteps; i++) {
            const colY = (i + 0.5) * colH;
            const colZ = 2.0 + (numCollisionSteps - 1 - i) * colD + (colD / 2);
            this.addColliderBoxAt(0, colY, colZ, colW, colH, colD, group);
        }
    }

    upgradeWall(level, maxHP, colorHex) {
        this.wallMaxHP = maxHP;
        this.wallHP = maxHP; // Auto-repair to full health on upgrade
        this.upgradeLevel = level;

        // Update wall colors
        for (const wm of this.wallMeshes) {
            wm.material.color.setHex(colorHex);
            wm.material.needsUpdate = true;
        }

        // Update tower colors/materials
        this.updateTowerVisuals();
    }

    updateTowerVisuals() {
        let pillarColor = 0x5a3d28; // wood
        let platformColor = 0x3d281a;
        let railingColor = 0x5a3d28;
        let showNeon = false;
        let neonColor = 0x00f0ff;

        if (this.upgradeLevel === 0) {
            // Cardboard
            pillarColor = 0x8b7355;
            platformColor = 0x7a6348;
            railingColor = 0x8b7355;
        } else if (this.upgradeLevel === 1) {
            // Wood
            pillarColor = 0x5a3d28;
            platformColor = 0x3d281a;
            railingColor = 0x5a3d28;
        } else if (this.upgradeLevel === 2) {
            // Cobblestone
            pillarColor = 0x444444;
            platformColor = 0x333333;
            railingColor = 0x444444;
        } else if (this.upgradeLevel === 3) {
            // Concrete
            pillarColor = 0x777777;
            platformColor = 0x555555;
            railingColor = 0x666666;
        } else if (this.upgradeLevel === 4) {
            // Steel
            pillarColor = 0x22252a;
            platformColor = 0x111317;
            railingColor = 0x2e3440;
            showNeon = true;
            neonColor = 0xffaa00; // orange neon
        } else if (this.upgradeLevel === 5) {
            // Titanium
            pillarColor = 0xd0d5db;
            platformColor = 0xa0a5ab;
            railingColor = 0xb0b5bb;
            showNeon = true;
            neonColor = 0x00ffcc; // cyan neon
        }

        for (const tower of this.towers) {
            for (const p of tower.pillars) {
                p.material.color.setHex(pillarColor);
            }
            tower.platform.material.color.setHex(platformColor);
            for (const r of tower.railings) {
                r.material.color.setHex(railingColor);
            }

            // Remove old neon trims
            for (const n of tower.neonTrim) {
                tower.group.remove(n);
                n.geometry.dispose();
                n.material.dispose();
            }
            tower.neonTrim = [];

            if (showNeon) {
                // Add glowing neon rings on platform edges
                const neonGeo = new THREE.BoxGeometry(4.2, 0.05, 0.05);
                const neonMat = new THREE.MeshBasicMaterial({ color: neonColor });
                
                const trim1 = new THREE.Mesh(neonGeo, neonMat);
                trim1.position.set(0, 5.0, -2.05);
                tower.group.add(trim1);
                tower.neonTrim.push(trim1);

                const trim2 = new THREE.Mesh(neonGeo, neonMat);
                trim2.position.set(0, 5.0, 2.05);
                tower.group.add(trim2);
                tower.neonTrim.push(trim2);
            }
        }
    }

    createWallClutter() {
        const woodColor = 0x6e4a35;
        const cardboardColor = 0xc2b280;
        const metalColor = 0x555555;
        const sandbagColor = 0x6e6353;

        // Place crates, boxes, and sandbags along the front of the wall
        // They will block zombies and push them back into view of the watchtowers
        
        // Left side clutter
        this.addBox(-12, 0.4, -6.6, 1.2, 0.8, 1.0, woodColor);
        this.addBox(-11, 0.3, -6.8, 1.0, 0.6, 0.8, cardboardColor);
        this.addBox(-12, 1.0, -6.6, 0.8, 0.5, 0.8, metalColor);

        // Center-left clutter
        this.addBox(-6, 0.4, -6.5, 1.5, 0.8, 0.9, sandbagColor);
        this.addBox(-5, 0.3, -6.7, 1.1, 0.6, 0.9, woodColor);

        // Center clutter
        this.addBox(0, 0.5, -6.6, 1.4, 1.0, 1.0, woodColor);
        this.addBox(1, 0.3, -6.9, 0.9, 0.6, 0.8, cardboardColor);

        // Center-right clutter
        this.addBox(5, 0.4, -6.5, 1.5, 0.8, 0.9, sandbagColor);
        this.addBox(6, 0.3, -6.7, 1.1, 0.6, 0.9, woodColor);

        // Right side clutter
        this.addBox(12, 0.4, -6.6, 1.2, 0.8, 1.0, woodColor);
        this.addBox(13, 0.3, -6.8, 1.0, 0.6, 0.8, cardboardColor);
        this.addBox(12, 1.0, -6.6, 0.8, 0.5, 0.8, metalColor);

        // Scatter empty shell casings (visual detail only, no collider)
        const casingGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.08, 4);
        casingGeo.rotateX(Math.PI / 2);
        const casingMat = new THREE.MeshLambertMaterial({ color: 0xcc9933 }); // Brass gold
        
        for (let i = 0; i < 40; i++) {
            const casing = new THREE.Mesh(casingGeo, casingMat);
            const xOffset = (Math.random() - 0.5) * 36;
            const zOffset = -3.5 + (Math.random() - 0.5) * 5;
            casing.position.set(xOffset, 0.04, zOffset);
            casing.rotation.set(
                Math.PI / 2 + (Math.random() - 0.5) * 0.5,
                Math.random() * Math.PI,
                (Math.random() - 0.5) * 0.5
            );
            casing.castShadow = true;
            this.group.add(casing);
        }
    }
}
