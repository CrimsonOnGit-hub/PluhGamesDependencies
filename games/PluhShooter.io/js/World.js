import * as THREE from 'three';

export class World {
    constructor(scene, mode = 'offline') {
        this.scene = scene;
        this.mode = mode;
        this.colliders = [];     // Array of THREE.Box3
        this.spawnPoints = [];   // Array of THREE.Vector3
        this.group = new THREE.Group();
        this.build();
        this.scene.add(this.group);
    }

    build() {
        this.createFloor();
        this.createWalls();
        this.createStructures();
        this.createTrenchDetails();
        
        // Only build team bases in TDM modes (offline or online)
        if (this.mode === 'tdm' || this.mode === 'online-tdm') {
            this.createTeamBases();
        }
        
        // Spawn 4 central elevated watchtowers for snipers (raised to height 9.0)
        // With stairs pointing outward (West/East) away from the bridge connections
        this.createOutpost(-20, 20, 'W', ['E', 'S']);
        this.createOutpost(20, -20, 'E', ['W', 'N']);
        this.createOutpost(-20, -20, 'W', ['E', 'N']);
        this.createOutpost(20, 20, 'E', ['W', 'S']);

        // Connect the 4 central outposts with bridges at height 9.0 (offset by deck radius 3.0 to keep deck clear)
        this.addBridge(-17, 20, 17, 20, 2.0, 9.0);   // North bridge
        this.addBridge(-17, -20, 17, -20, 2.0, 9.0); // South bridge
        this.addBridge(-20, -17, -20, 17, 2.0, 9.0); // Left bridge
        this.addBridge(20, -17, 20, 17, 2.0, 9.0);   // Right bridge

        // Spawn 4 NEW standalone outposts closer to the corners of the expanded map
        // (stairs point inward towards center: North/South)
        this.createOutpost(-60, 60, 'S', []);
        this.createOutpost(60, 60, 'S', []);
        this.createOutpost(-60, -60, 'N', []);
        this.createOutpost(60, -60, 'N', []);

        this.setupSpawnPoints();
    }

    getTerrainHeight(x, z) {
        // Base noise for rolling hills
        const baseNoise = Math.sin(x * 0.15) * Math.cos(z * 0.15) * 0.5 + 
                          Math.sin(x * 0.05) * Math.sin(z * 0.05) * 0.8;

        // Hill 1: Relocated to Top-Right (centered at 32, -32)
        const d1 = Math.sqrt((x - 32) * (x - 32) + (z + 32) * (z + 32));
        const hill1 = d1 < 15 ? Math.cos((d1 / 15) * Math.PI * 0.5) * 3.0 : 0;

        // Hill 2: Relocated to Bottom-Left (centered at -32, 32)
        const d2 = Math.sqrt((x + 32) * (x + 32) + (z - 32) * (z - 32));
        const hill2 = d2 < 15 ? Math.cos((d2 / 15) * Math.PI * 0.5) * 3.0 : 0;

        let baseHeight = baseNoise + hill1 + hill2;

        // Trench cross
        const trenchMaxHalfLen = 30;
        const rampFadeStart = 22;
        const trenchFullDepth = 3.5;
        const trenchInnerHalfWidth = 1.8;
        const trenchOuterHalfWidth = 4.8;

        let maxDepthFactor = 0;

        // Z-axis trench segment (running along Z, at x = 0)
        const absZ = Math.abs(z);
        if (absZ < trenchMaxHalfLen) {
            const absX = Math.abs(x);
            if (absX < trenchOuterHalfWidth) {
                let widthFactor = 0;
                if (absX <= trenchInnerHalfWidth) {
                    widthFactor = 1.0;
                } else {
                    widthFactor = 1.0 - (absX - trenchInnerHalfWidth) / (trenchOuterHalfWidth - trenchInnerHalfWidth);
                }

                let lengthFactor = 1.0;
                if (absZ > rampFadeStart) {
                    lengthFactor = 1.0 - (absZ - rampFadeStart) / (trenchMaxHalfLen - rampFadeStart);
                }

                const depthFactor = widthFactor * lengthFactor;
                if (depthFactor > maxDepthFactor) maxDepthFactor = depthFactor;
            }
        }

        // X-axis trench segment (running along X, at z = 0)
        const absX = Math.abs(x);
        if (absX < trenchMaxHalfLen) {
            const absZ = Math.abs(z);
            if (absZ < trenchOuterHalfWidth) {
                let widthFactor = 0;
                if (absZ <= trenchInnerHalfWidth) {
                    widthFactor = 1.0;
                } else {
                    widthFactor = 1.0 - (absZ - trenchInnerHalfWidth) / (trenchOuterHalfWidth - trenchInnerHalfWidth);
                }

                let lengthFactor = 1.0;
                if (absX > rampFadeStart) {
                    lengthFactor = 1.0 - (absX - rampFadeStart) / (trenchMaxHalfLen - rampFadeStart);
                }

                const depthFactor = widthFactor * lengthFactor;
                if (depthFactor > maxDepthFactor) maxDepthFactor = depthFactor;
            }
        }

        return baseHeight - maxDepthFactor * trenchFullDepth;
    }

    createFloor() {
        // Create a highly subdivided PlaneGeometry for smooth rolling hills and sloped trenches
        const size = 200;
        const segments = 120;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2); // Make it horizontal

        // Displace vertices based on terrain heightmap AND apply vertex colors
        const posAttr = geo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const y = this.getTerrainHeight(x, z);
            posAttr.setY(i, y);

            // Color gradient based on height
            // Trench bottom (-3.5): dark brown/mud
            // Flat ground (0): warm earth/sand
            // Hilltops (2-3): dusty green
            const t = Math.max(0, Math.min(1, (y + 3.5) / 6.5)); // 0 = trench, 1 = hilltop
            
            // Trench: dark mud (0.25, 0.2, 0.15)
            // Flat: warm earth (0.43, 0.39, 0.33)
            // Hill: dusty green (0.35, 0.42, 0.25)
            let r, g, b;
            if (t < 0.5) {
                const s = t / 0.5;
                r = 0.22 + s * 0.21;
                g = 0.17 + s * 0.22;
                b = 0.12 + s * 0.21;
            } else {
                const s = (t - 0.5) / 0.5;
                r = 0.43 - s * 0.08;
                g = 0.39 + s * 0.03;
                b = 0.33 - s * 0.08;
            }
            // Add subtle noise variation
            const noise = (Math.sin(x * 1.7 + z * 2.3) * 0.02 + Math.cos(x * 3.1 - z * 1.1) * 0.015);
            colors[i * 3] = Math.max(0, Math.min(1, r + noise));
            colors[i * 3 + 1] = Math.max(0, Math.min(1, g + noise * 0.8));
            colors[i * 3 + 2] = Math.max(0, Math.min(1, b + noise * 0.6));
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.floorMesh = mesh;

        const dummy = new THREE.Object3D();

        // Instanced Rocks — 500 varied sizes scattered across 180 area
        const rockCount = 500;
        const rockGeo = new THREE.DodecahedronGeometry(0.2, 1);
        const rockMat = new THREE.MeshLambertMaterial({ color: 0x544c45 });
        const instancedRocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
        
        for (let i = 0; i < rockCount; i++) {
            const x = (Math.random() - 0.5) * 178;
            const z = (Math.random() - 0.5) * 178;
            const y = this.getTerrainHeight(x, z);

            dummy.position.set(x, y, z);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            const s = 0.3 + Math.random() * 2.5;
            dummy.scale.set(s, s * (0.5 + Math.random() * 0.5), s);
            dummy.updateMatrix();
            instancedRocks.setMatrixAt(i, dummy.matrix);
        }
        instancedRocks.castShadow = true;
        instancedRocks.receiveShadow = true;
        this.group.add(instancedRocks);

        // Instanced Plants/Bushes — 150 varied
        const plantCount = 150;
        const plantGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
        const plantMat = new THREE.MeshLambertMaterial({ color: 0x4b5320 });
        const instancedPlants = new THREE.InstancedMesh(plantGeo, plantMat, plantCount);
        
        for (let i = 0; i < plantCount; i++) {
            const x = (Math.random() - 0.5) * 178;
            const z = (Math.random() - 0.5) * 178;
            const y = this.getTerrainHeight(x, z) + 0.4;

            dummy.position.set(x, y, z);
            dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
            const s = 0.4 + Math.random() * 1.8;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            instancedPlants.setMatrixAt(i, dummy.matrix);
        }
        this.group.add(instancedPlants);

        // Instanced Grass Tufts — 800 small flat green clusters
        const grassCount = 800;
        const grassGeo = new THREE.ConeGeometry(0.15, 0.5, 4);
        const grassColors = [0x556b2f, 0x6b8e23, 0x4a5d23, 0x8fbc8f];
        const grassMat = new THREE.MeshLambertMaterial({ color: 0x556b2f });
        const instancedGrass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
        
        const grassColor = new THREE.Color();
        // Pre-initialize colors to avoid null instanceColor
        for (let i = 0; i < grassCount; i++) {
            grassColor.setHex(grassColors[i % grassColors.length]);
            instancedGrass.setColorAt(i, grassColor);
        }

        for (let i = 0; i < grassCount; i++) {
            const x = (Math.random() - 0.5) * 176;
            const z = (Math.random() - 0.5) * 176;
            const y = this.getTerrainHeight(x, z);
            // Skip grass in deep trenches
            if (y < -1.5) { 
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                instancedGrass.setMatrixAt(i, dummy.matrix);
                continue;
            }

            dummy.position.set(x, y + 0.15, z);
            dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
            const s = 0.4 + Math.random() * 1.2;
            dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
            dummy.updateMatrix();
            instancedGrass.setMatrixAt(i, dummy.matrix);
            
            grassColor.setHex(grassColors[i % grassColors.length]);
            instancedGrass.setColorAt(i, grassColor);
        }
        if (instancedGrass.instanceColor) {
            instancedGrass.instanceColor.needsUpdate = true;
        }
        this.group.add(instancedGrass);
    }

    createWalls() {
        const wallHeight = 16;
        const wallThickness = 4;
        const arenaSize = 180;
        const halfArena = arenaSize / 2;
        const wallColor = 0x4a453f; // Dusty concrete

        // Outer boundaries
        this.addBox(0, 4, -(halfArena + wallThickness / 2), arenaSize + wallThickness * 2, wallHeight, wallThickness, wallColor);
        this.addBox(0, 4, (halfArena + wallThickness / 2), arenaSize + wallThickness * 2, wallHeight, wallThickness, wallColor);
        this.addBox(-(halfArena + wallThickness / 2), 4, 0, wallThickness, wallHeight, arenaSize, wallColor);
        this.addBox((halfArena + wallThickness / 2), 4, 0, wallThickness, wallHeight, arenaSize, wallColor);
    }

    createStructures() {
        const rubbleColor = 0x544c45;
        const sandbagColor = 0x6e6353;

        // === 1. Destroyed Center Building (Inside the Trench Cross) ===
        const centerY = this.getTerrainHeight(0, 0); // -3.5
        this.addBox(0, centerY + 1.5, 0, 6, 3, 6, rubbleColor);
        this.addBox(0, centerY + 5.0, 0, 1.5, 4.0, 1.5, 0x7c7c7c); // Ruined pillar monument
        this.addBox(-2, centerY + 5.0, -2, 0.8, 4.0, 0.8, 0x7c7c7c);
        this.addBox(2, centerY + 4.0, -2, 0.8, 2.0, 0.8, 0x7c7c7c);
        this.addBox(-2, centerY + 3.5, 2, 0.8, 1.0, 0.8, 0x7c7c7c);
        this.addBox(2, centerY + 6.0, 2, 0.8, 6.0, 0.8, 0x7c7c7c);

        // === 2. Trenches & Sandbags (Edges of the trench, placed at exact local terrain Y) ===
        const sb1Y = this.getTerrainHeight(-4, -25);
        this.addBox(-4, sb1Y + 1.0, -25, 2, 2, 10, sandbagColor);
        const sb2Y = this.getTerrainHeight(4, -25);
        this.addBox(4, sb2Y + 1.0, -25, 2, 2, 10, sandbagColor);
        const sb3Y = this.getTerrainHeight(-25, -4);
        this.addBox(-25, sb3Y + 1.0, -4, 10, 2, 2, sandbagColor);
        const sb4Y = this.getTerrainHeight(25, 4);
        this.addBox(25, sb4Y + 1.0, 4, 10, 2, 2, sandbagColor);

        // === 3. Elevated Hills Buildings ===
        // Hill 1: Top-Right (dome hill centered at 32, -32)
        const hill1Y = this.getTerrainHeight(32, -32);
        this.createBunker(32, hill1Y, -32, Math.PI);

        // Hill 2: Bottom-Left (dome hill centered at -32, 32)
        const hill2Y = this.getTerrainHeight(-32, 32);
        this.createRuinedHouse(-32, hill2Y, 32, -Math.PI / 2);

        // === 4. Additional Ground Buildings & Ruins ===
        // Flat Top-Left Ground Bunker (former hill 1 area)
        const bunkerY = this.getTerrainHeight(-25, -25);
        this.createBunker(-25, bunkerY, -25, 0);
        
        // Flat Bottom-Right Ground Ruined House (former hill 2 area)
        const houseY = this.getTerrainHeight(25, 25);
        this.createRuinedHouse(25, houseY, 25, Math.PI / 2);

        // === 5. Barricades (Czech hedgehogs, aligned to terrain) ===
        const hedgehogs = [
            [-12, -12], [12, -12], [-12, 12], [12, 12],
            [6, -18], [-6, 18], [-18, 6], [18, -6]
        ];
        for (const [x, z] of hedgehogs) {
            const y = this.getTerrainHeight(x, z);
            this.createBarricade(x, y, z);
        }

        // === 6. Small Debris and Rubble Piles near ruins ===
        // Near Bottom-Left hill ruin (-32, 32)
        const d1Y = this.getTerrainHeight(-29, 29);
        this.addBox(-29, d1Y + 0.3, 29, 1.2, 0.6, 1.2, rubbleColor);
        const d2Y = this.getTerrainHeight(-35, 35);
        this.addBox(-35, d2Y + 0.4, 35, 1.5, 0.8, 1.5, rubbleColor);
        // Near Bottom-Right flat ruin (25, 25)
        const d3Y = this.getTerrainHeight(22, 22);
        this.addBox(22, d3Y + 0.3, 22, 1.2, 0.6, 1.2, rubbleColor);
        const d4Y = this.getTerrainHeight(28, 28);
        this.addBox(28, d4Y + 0.4, 28, 1.5, 0.8, 1.5, rubbleColor);
    }

    addBox(x, y, z, w, h, d, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);

        // Compute world-space bounding box and register as collider
        const box = new THREE.Box3();
        box.setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(w, h, d)
        );
        this.colliders.push(box);

        return mesh;
    }

    addVisualBox(x, y, z, w, h, d, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        return mesh;
    }

    addVisualRamp(x, y, z, w, h, d, rotX, rotY, rotZ, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rotX, rotY, rotZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        return mesh;
    }

    addInvisibleCollider(x, y, z, w, h, d) {
        const box = new THREE.Box3();
        box.setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(w, h, d)
        );
        this.colliders.push(box);
    }

    addRampPhysics(startX, startZ, endX, endZ, isAlongZ, directionMultiplier) {
        const steps = 10;
        const rampLength = 6;
        const stepLength = rampLength / steps;
        const stepHeightIncrement = 3.5 / steps;
        const width = 5.8;

        for (let i = 1; i <= steps; i++) {
            const h = i * stepHeightIncrement;
            const y = -3.5 + h / 2;
            let x, z;
            if (isAlongZ) {
                x = startX;
                z = startZ + directionMultiplier * (i - 0.5) * stepLength;
                this.addInvisibleCollider(x, y, z, width, h, stepLength);
            } else {
                x = startX + directionMultiplier * (i - 0.5) * stepLength;
                z = startZ;
                this.addInvisibleCollider(x, y, z, stepLength, h, width);
            }
        }
    }

    addRotatedBox(x, y, z, w, h, d, color, group, rotY) {
        const cos = Math.cos(rotY);
        const sin = Math.sin(rotY);
        const worldX = x * cos - z * sin;
        const worldZ = x * sin + z * cos;
        
        const isSwapped = Math.abs(cos) < 0.1;
        const worldW = isSwapped ? d : w;
        const worldD = isSwapped ? w : d;
        
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        
        const box = new THREE.Box3();
        box.setFromCenterAndSize(
            new THREE.Vector3(group.position.x + worldX, group.position.y + y, group.position.z + worldZ),
            new THREE.Vector3(worldW, h, worldD)
        );
        this.colliders.push(box);
        
        return mesh;
    }

    createBunker(px, py, pz, rotY) {
        const group = new THREE.Group();
        group.position.set(px, py, pz);
        this.group.add(group);
        
        const wallColor = 0x7c7c7c; // Concrete grey
        const roofColor = 0x5c5c5c; // Darker concrete
        const floorColor = 0x4c4c4c;
        const sandbagColor = 0x6e6353;
        
        // Floor slab
        this.addRotatedBox(0, 0.1, 0, 8, 0.2, 8, floorColor, group, rotY);
        
        // Back wall
        this.addRotatedBox(0, 1.7, -3.7, 8, 3.0, 0.6, wallColor, group, rotY);
        
        // Left wall — shortened to NOT cover the doorway (stops at z=2.7 instead of z=4)
        this.addRotatedBox(-3.7, 1.7, -0.5, 0.6, 3.0, 7.0, wallColor, group, rotY);
        
        // Right wall — shortened to NOT cover the doorway
        this.addRotatedBox(3.7, 1.7, -0.5, 0.6, 3.0, 7.0, wallColor, group, rotY);
        
        // Front wall (doorway gap: 2 units wide at center, 2.2 units tall)
        this.addRotatedBox(-2.5, 1.7, 3.7, 3.0, 3.0, 0.6, wallColor, group, rotY);
        this.addRotatedBox(2.5, 1.7, 3.7, 3.0, 3.0, 0.6, wallColor, group, rotY);
        this.addRotatedBox(0, 2.7, 3.7, 2.0, 1.0, 0.6, wallColor, group, rotY);
        
        // Roof slab
        this.addRotatedBox(0, 3.4, 0, 8.4, 0.4, 8.4, roofColor, group, rotY);

        // Sandbag base detail (visual only)
        const sb = this.addVisualBox(0, 0, 0, 8.8, 0.5, 0.8, sandbagColor);
        sb.position.set(0, 0.25, 4.2);
        group.add(sb);
    }

    createRuinedHouse(px, py, pz, rotY) {
        const group = new THREE.Group();
        group.position.set(px, py, pz);
        this.group.add(group);
        
        const brickColor = 0x9c5d53; // Bricks red
        const woodColor = 0x6e4a35;  // Wood brown
        const floorColor = 0x5a544f;
        
        // Floor slab
        this.addRotatedBox(0, 0.1, 0, 8, 0.2, 8, floorColor, group, rotY);
        
        // Ruined Back wall (jagged masonry segments)
        this.addRotatedBox(-3.7, 1.7, -3.7, 0.6, 3.0, 0.6, brickColor, group, rotY);
        this.addRotatedBox(-1.5, 0.8, -3.7, 3.8, 1.4, 0.6, brickColor, group, rotY);
        this.addRotatedBox(2.0, 1.4, -3.7, 3.2, 2.6, 0.6, brickColor, group, rotY);
        
        // Ruined Left wall (with window opening)
        this.addRotatedBox(-3.7, 0.6, 2.0, 0.6, 1.0, 3.8, brickColor, group, rotY);
        this.addRotatedBox(-3.7, 2.1, 0.3, 0.6, 2.0, 0.4, brickColor, group, rotY);
        this.addRotatedBox(-3.7, 2.1, 3.7, 0.6, 2.0, 0.4, brickColor, group, rotY);
        this.addRotatedBox(-3.7, 2.9, 2.0, 0.6, 0.4, 3.8, brickColor, group, rotY);
        this.addRotatedBox(-3.7, 1.0, -1.5, 0.6, 1.8, 3.8, brickColor, group, rotY);

        // Collapsed structural wood rafters (visual detail only)
        const beam1 = this.addVisualBox(0, 0, 0, 0.2, 0.2, 5.5, woodColor);
        beam1.position.set(-1.0, 1.6, -1.0);
        beam1.rotation.set(0.6, 0.4, -0.2);
        group.add(beam1);

        const beam2 = this.addVisualBox(0, 0, 0, 0.2, 0.2, 4.8, woodColor);
        beam2.position.set(1.5, 1.1, 1.5);
        beam2.rotation.set(-0.4, -0.3, 0.6);
        group.add(beam2);
    }

    createBarricade(px, py, pz) {
        const group = new THREE.Group();
        group.position.set(px, py, pz);
        this.group.add(group);
        
        const metalColor = 0x2c2927; // Dark oxidized iron
        
        // Visual Czech Hedgehog (3 crossed metal beams)
        const beam1 = this.addVisualBox(0, 0.8, 0, 0.2, 0.2, 2.2, metalColor);
        beam1.rotation.set(0.78, 0.78, 0);
        group.add(beam1);
        
        const beam2 = this.addVisualBox(0, 0.8, 0, 0.2, 0.2, 2.2, metalColor);
        beam2.rotation.set(-0.78, 0.78, 0);
        group.add(beam2);
        
        const beam3 = this.addVisualBox(0, 0.8, 0, 2.2, 0.2, 0.2, metalColor);
        beam3.rotation.set(0, 0.78, 0.78);
        group.add(beam3);
        
        const box = new THREE.Box3();
        box.setFromCenterAndSize(
            new THREE.Vector3(px, py + 0.8, pz),
            new THREE.Vector3(1.8, 1.6, 1.8)
        );
        this.colliders.push(box);
    }

    createTrenchDetails() {
        const duckboardColor = 0x5c4033; // Dark wood color for floor walkboards

        // 1. Duckboards (walkboards) on the trench floor
        // Z-axis trench floor:
        this.addVisualBox(0, -3.45, -16.5, 2, 0.08, 27, duckboardColor);
        this.addVisualBox(0, -3.45, 16.5, 2, 0.08, 27, duckboardColor);
        
        // X-axis trench floor:
        this.addVisualBox(-16.5, -3.45, 0, 27, 0.08, 2, duckboardColor);
        this.addVisualBox(16.5, -3.45, 0, 27, 0.08, 2, duckboardColor);

        // Center intersection:
        this.addVisualBox(0, -3.45, 0, 2, 0.08, 2, duckboardColor);
    }

    setupSpawnPoints() {
        // 8 spawn points spread around the arena, all at standing height
        const points = [
            new THREE.Vector3(-65, 0, -65),
            new THREE.Vector3(65, 0, -65),
            new THREE.Vector3(-65, 0, 65),
            new THREE.Vector3(65, 0, 65),
            new THREE.Vector3(0, 0, -50),
            new THREE.Vector3(0, 0, 50),
            new THREE.Vector3(-55, 0, 0),
            new THREE.Vector3(55, 0, 0)
        ];
        
        // Adjust Y coordinates to match terrain dynamically
        for (const pt of points) {
            pt.y = this.getTerrainHeight(pt.x, pt.z) + 1.0; // standing Y height
        }
        this.spawnPoints = points;
    }

    getColliders() {
        return this.colliders;
    }

    getSpawnPoints() {
        return this.spawnPoints;
    }

    getRandomSpawnPoint() {
        return this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)].clone();
    }

    createTeamBases() {
        const blueColor = 0x1f3d7a; // Deep blue
        const redColor = 0x7a1f1f;  // Deep red
        const stoneColor = 0x484a4d; // Grey stone castle walls
        const battlementColor = 0x333538; // Darker accent stone

        // Helper to build a castle base
        const buildCastle = (cx, cz, colorHex, forcefieldColor, teamName, gateSign) => {
            const floorY = this.getTerrainHeight(cx, cz);
            
            // Floor slab (8x8)
            this.addBox(cx, floorY + 0.1, cz, 8, 0.2, 8, colorHex);

            // Left Wall
            this.addBox(cx - 4.1, floorY + 1.6, cz, 0.2, 3.0, 8, stoneColor);
            // Right Wall
            this.addBox(cx + 4.1, floorY + 1.6, cz, 0.2, 3.0, 8, stoneColor);

            // Back Wall (placed opposite to the gate)
            this.addBox(cx, floorY + 1.6, cz - 4.1 * gateSign, 8, 3.0, 0.2, stoneColor);

            // Gate Towers (Front-Left & Front-Right pillars flanking the entrance)
            this.addBox(cx - 3.5, floorY + 2.2, cz + 3.7 * gateSign, 1.2, 4.2, 1.2, stoneColor);
            this.addBox(cx + 3.5, floorY + 2.2, cz + 3.7 * gateSign, 1.2, 4.2, 1.2, stoneColor);
            
            // Tower Caps (slightly wider rings on top)
            this.addBox(cx - 3.5, floorY + 4.3, cz + 3.7 * gateSign, 1.4, 0.2, 1.4, battlementColor);
            this.addBox(cx + 3.5, floorY + 4.3, cz + 3.7 * gateSign, 1.4, 0.2, 1.4, battlementColor);

            // Back Towers
            this.addBox(cx - 3.5, floorY + 2.2, cz - 3.7 * gateSign, 1.2, 4.2, 1.2, stoneColor);
            this.addBox(cx + 3.5, floorY + 2.2, cz - 3.7 * gateSign, 1.2, 4.2, 1.2, stoneColor);
            this.addBox(cx - 3.5, floorY + 4.3, cz - 3.7 * gateSign, 1.4, 0.2, 1.4, battlementColor);
            this.addBox(cx + 3.5, floorY + 4.3, cz - 3.7 * gateSign, 1.4, 0.2, 1.4, battlementColor);

            // Crenellations (battlements) along Left, Back, and Right walls
            // Left wall top crenellations
            for (let zOffset = -3; zOffset <= 3; zOffset += 2) {
                this.addBox(cx - 4.1, floorY + 3.3, cz + zOffset, 0.3, 0.4, 1.0, battlementColor);
            }
            // Right wall top crenellations
            for (let zOffset = -3; zOffset <= 3; zOffset += 2) {
                this.addBox(cx + 4.1, floorY + 3.3, cz + zOffset, 0.3, 0.4, 1.0, battlementColor);
            }
            // Back wall top crenellations (placed at the back)
            for (let xOffset = -3; xOffset <= 3; xOffset += 2) {
                this.addBox(cx + xOffset, floorY + 3.3, cz - 4.1 * gateSign, 1.0, 0.4, 0.3, battlementColor);
            }

            // Forcefield at front entrance (spanning cx - 2.8 to cx + 2.8, height 20.0)
            const ffZ = cz + 3.9 * gateSign;
            const ffGeo = new THREE.BoxGeometry(5.8, 20.0, 0.2);
            const ffMat = new THREE.MeshBasicMaterial({
                color: forcefieldColor,
                transparent: true,
                opacity: 0.22,
                side: THREE.DoubleSide
            });
            const ffMesh = new THREE.Mesh(ffGeo, ffMat);
            ffMesh.position.set(cx, floorY + 10.0, ffZ);
            this.group.add(ffMesh);

            // Add team forcefield collider
            const ffCollider = new THREE.Box3();
            ffCollider.setFromCenterAndSize(
                new THREE.Vector3(cx, floorY + 10.0, ffZ),
                new THREE.Vector3(5.8, 20.0, 0.2)
            );
            ffCollider.ownerTeam = teamName;
            this.colliders.push(ffCollider);
        };

        // Build Blue Castle at Top-Left (-70, -70) - gate faces positive Z (1) towards center
        buildCastle(-70, -70, blueColor, 0x00aaff, 'blue', 1);

        // Build Red Castle at Bottom-Right (70, 70) - gate faces negative Z (-1) towards center
        buildCastle(70, 70, redColor, 0xff3333, 'red', -1);
    }

    createOutpost(x, z, stairDir, bridgeDirs = []) {
        const terrainY = this.getTerrainHeight(x, z);
        const outpostGroup = new THREE.Group();
        outpostGroup.position.set(x, terrainY, z);
        this.group.add(outpostGroup);

        const navyColor = 0x1c2030; // Dark navy steel
        const whiteColor = 0xeeeeee; // White panels
        const darkColor = 0x222222;

        // Central support column (Cylinder)
        const colGeo = new THREE.CylinderGeometry(0.8, 0.8, 9.0, 12);
        const colMat = new THREE.MeshLambertMaterial({ color: navyColor });
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(0, 4.5, 0);
        col.castShadow = true;
        col.receiveShadow = true;
        outpostGroup.add(col);

        // Column collider in world space
        const colBox = new THREE.Box3();
        colBox.setFromCenterAndSize(
            new THREE.Vector3(x, terrainY + 4.5, z),
            new THREE.Vector3(1.6, 9.0, 1.6)
        );
        this.colliders.push(colBox);

        // Platform deck (Cylinder)
        const deckGeo = new THREE.CylinderGeometry(3.0, 3.0, 0.2, 16);
        const deckMat = new THREE.MeshLambertMaterial({ color: darkColor });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(0, 9.0, 0);
        deck.receiveShadow = true;
        outpostGroup.add(deck);

        // Platform floor collider (entire deck area 6x6 is solid so players never fall through)
        this.addColliderBoxAt(0, 9.0, 0, 6.0, 0.2, 6.0, outpostGroup);

        // --- Cabin Structure ---
        const cabinGroup = new THREE.Group();
        outpostGroup.add(cabinGroup);

        // 4 roof support posts
        const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 8);
        const postMat = new THREE.MeshLambertMaterial({ color: whiteColor });
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) + Math.PI / 4;
            const px = Math.cos(angle) * 2.8;
            const pz = Math.sin(angle) * 2.8;
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(px, 10.5, pz);
            post.castShadow = true;
            cabinGroup.add(post);
        }

        // Roof Canopy (Cylinder)
        const roofGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.2, 16);
        const roofMat = new THREE.MeshLambertMaterial({ color: navyColor });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 12.0, 0);
        roof.castShadow = true;
        cabinGroup.add(roof);

        // Window Shutter (continuous cyber energy ring covering window level)
        const shutterGeo = new THREE.CylinderGeometry(2.92, 2.92, 2.0, 24, 1, true);
        const shutterMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        });
        const shutterMesh = new THREE.Mesh(shutterGeo, shutterMat);
        shutterMesh.position.set(0, 11.0, 0);
        shutterMesh.visible = false; // Starts open
        cabinGroup.add(shutterMesh);

        // Centered console pedestal button (Y height 9.3, size 0.4, 0.6, 0.4)
        const consoleMesh = this.addVisualBoxAt(0, 9.3, 0, 0.4, 0.6, 0.4, 0x12151e, cabinGroup);
        const buttonScreen = this.addVisualBoxAt(0, 9.6, 0, 0.2, 0.04, 0.2, 0x00ff88, cabinGroup);

        // Arrays to register multiple doors and window colliders dynamically
        const doorMeshes = [];
        const doorColliders = [];
        const shutterColMeshes = [];
        const shutterColliders = [];

        // Define the 4 cardinal directions and coordinates with correct THREE.CylinderGeometry thetaStart angles
        const directions = [
            { dir: 'N', thetaStart: Math.PI * 0.75, x: 0, z: -2.9, w: 4.0, d: 0.2, doorW: 2.0, doorD: 0.2, doorX: 0, doorZ: -2.9 },
            { dir: 'S', thetaStart: -Math.PI * 0.25, x: 0, z: 2.9,  w: 4.0, d: 0.2, doorW: 2.0, doorD: 0.2, doorX: 0, doorZ: 2.9 },
            { dir: 'E', thetaStart: Math.PI * 0.25,  x: 2.9, z: 0,  w: 0.2, d: 4.0, doorW: 0.2, doorD: 2.0, doorX: 2.9, doorZ: 0 },
            { dir: 'W', thetaStart: Math.PI * 1.25,  x: -2.9, z: 0, w: 0.2, d: 4.0, doorW: 0.2, doorD: 2.0, doorX: -2.9, doorZ: 0 }
        ];

        for (const item of directions) {
            const isEntrance = (item.dir === stairDir) || bridgeDirs.includes(item.dir);
            if (isEntrance) {
                // Entrance direction: Spawn full-height orange blast energy door
                const doorGeo = new THREE.BoxGeometry(item.doorW, 3.0, item.doorD);
                const doorMat = new THREE.MeshBasicMaterial({
                    color: 0xff5500,
                    transparent: true,
                    opacity: 0.45,
                    side: THREE.DoubleSide
                });
                const doorMesh = new THREE.Mesh(doorGeo, doorMat);
                doorMesh.position.set(item.doorX, 10.5, item.doorZ);
                doorMesh.visible = false; // Default open
                cabinGroup.add(doorMesh);
                doorMeshes.push(doorMesh);
                doorColliders.push(new THREE.Box3());
            } else {
                // Solid direction: Spawn white wall segment cylinder mesh (height 1.0, Y=9.5)
                const segmentGeo = new THREE.CylinderGeometry(2.9, 2.9, 1.0, 8, 1, true, item.thetaStart, 0.5 * Math.PI);
                const segmentMat = new THREE.MeshLambertMaterial({ color: whiteColor, side: THREE.DoubleSide });
                const segmentMesh = new THREE.Mesh(segmentGeo, segmentMat);
                segmentMesh.position.set(0, 9.5, 0);
                segmentMesh.castShadow = true;
                cabinGroup.add(segmentMesh);

                // Add solid wall collider
                this.addColliderBoxAt(item.x, 9.5, item.z, item.w, 1.0, item.d, cabinGroup);

                // Add invisible window collider helper mesh (height 2.0, Y=11.0)
                const shutterColGeo = new THREE.BoxGeometry(item.w, 2.0, item.d);
                const shutterColMesh = new THREE.Mesh(shutterColGeo, new THREE.MeshBasicMaterial());
                shutterColMesh.position.set(item.x * 1.02, 11.0, item.z * 1.02);
                shutterColMesh.visible = false;
                cabinGroup.add(shutterColMesh);

                shutterColMeshes.push(shutterColMesh);
                shutterColliders.push(new THREE.Box3());
            }
        }

        // Register interactive tower details
        if (!this.towers) this.towers = [];
        this.towers.push({
            isOpen: true,
            doorMeshes: doorMeshes,
            shutterMesh: shutterMesh,
            buttonMesh: consoleMesh,
            buttonScreen: buttonScreen,
            doorColliders: doorColliders,
            shutterColMeshes: shutterColMeshes,
            shutterColliders: shutterColliders
        });

        // --- Flashing Police Sirens ---
        this.addVisualBoxAt(-2.7, 12.15, -2.7, 0.2, 0.1, 0.2, darkColor, cabinGroup);
        const sirenRed = this.addVisualBoxAt(-2.7, 12.3, -2.7, 0.25, 0.2, 0.25, 0xff0033, cabinGroup);
        
        this.addVisualBoxAt(2.7, 12.15, -2.7, 0.2, 0.1, 0.2, darkColor, cabinGroup);
        const sirenBlue = this.addVisualBoxAt(2.7, 12.3, -2.7, 0.25, 0.2, 0.25, 0x00aaff, cabinGroup);

        if (!this.sirens) this.sirens = [];
        this.sirens.push({ red: sirenRed, blue: sirenBlue });

        // --- Volumetric Searchlight ---
        this.addVisualBoxAt(0, 8.8, -2.8, 0.4, 0.3, 0.4, darkColor, outpostGroup);
        this.addVisualBoxAt(0, 8.65, -2.8, 0.3, 0.02, 0.3, 0xffeebb, outpostGroup);
        
        const beamGeo = new THREE.CylinderGeometry(0.2, 3.5, 9.0, 8, 1, true);
        beamGeo.translate(0, -4.5, 0);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xfff2df,
            transparent: true,
            opacity: 0.14,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(0, 8.6, -2.8);
        beam.rotation.x = 0.25;
        outpostGroup.add(beam);

        // --- Stair Group ---
        const stairGroup = new THREE.Group();
        outpostGroup.add(stairGroup);

        // Rotate stairs to face the correct cardinal direction FIRST so world matrix calculations inside addColliderBoxAt are correct
        if (stairDir === 'N') {
            stairGroup.rotation.y = Math.PI;
        } else if (stairDir === 'E') {
            stairGroup.rotation.y = Math.PI / 2;
        } else if (stairDir === 'W') {
            stairGroup.rotation.y = -Math.PI / 2;
        }

        const numVisualSteps = 24;
        const stepW = 1.6;
        const stepH = 9.1 / numVisualSteps;
        const stepD = 10.0 / numVisualSteps;
        for (let i = 0; i < numVisualSteps; i++) {
            const stepY = (i + 0.5) * stepH;
            const stepZ = 1.6 + (numVisualSteps - 1 - i) * stepD + (stepD / 2);
            this.addVisualBoxAt(0, stepY, stepZ, stepW, stepH, stepD, navyColor, stairGroup);
        }

        // Invisible slope colliders (18 steps of thickness 0.55 to prevent physics tunneling)
        const numCollisionSteps = 18;
        const colW = 1.6;
        const colH = 9.0 / numCollisionSteps;
        const colD = 10.0 / numCollisionSteps;
        for (let i = 0; i < numCollisionSteps; i++) {
            const colY = (i + 0.5) * colH;
            const colZ = 1.6 + (numCollisionSteps - 1 - i) * colD + (colD / 2);
            this.addColliderBoxAt(0, colY, colZ, colW, colH, colD * 1.6, stairGroup);
        }

        // Under-stair solid collision wedge blocks to prevent clipping inside/under the stairs
        // Block 1 (High back section): Z = 1.6 to 5.0, Y = 0 to 6.0
        this.addColliderBoxAt(0, 3.0, 3.3, 1.6, 6.0, 3.4, stairGroup);
        // Block 2 (Mid section): Z = 5.0 to 8.0, Y = 0 to 3.5
        this.addColliderBoxAt(0, 1.75, 6.5, 1.6, 3.5, 3.0, stairGroup);
        // Block 3 (Low front section): Z = 8.0 to 10.0, Y = 0 to 1.5
        this.addColliderBoxAt(0, 0.75, 9.0, 1.6, 1.5, 2.0, stairGroup);
    }

    addBridge(x1, z1, x2, z2, width, height) {
        const len = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;

        const isXAligned = Math.abs(z2 - z1) < 0.1;
        const w = isXAligned ? len : width;
        const d = isXAligned ? width : len;

        // Base deck
        this.addBox(cx, height, cz, w, 0.2, d, 0x111111);

        // Railings
        const railH = 0.6;
        const railT = 0.1;
        const railColor = 0xeeeeee;

        if (isXAligned) {
            // Front & Back railings
            this.addBox(cx, height + 0.3, cz - width/2, w, railH, railT, railColor);
            this.addBox(cx, height + 0.3, cz + width/2, w, railH, railT, railColor);
        } else {
            // Left & Right railings
            this.addBox(cx - width/2, height + 0.3, cz, railT, railH, d, railColor);
            this.addBox(cx + width/2, height + 0.3, cz, railT, railH, d, railColor);
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

        // Register collider in world space
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
        this.group.updateMatrixWorld(true);
        const localPos = new THREE.Vector3(x, y, z);
        const worldPos = group.localToWorld(localPos);

        const q = new THREE.Quaternion();
        group.getWorldQuaternion(q);
        const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        const sin = Math.sin(euler.y);
        const isRotatedXZ = Math.abs(sin) > 0.5;
        const rw = isRotatedXZ ? d : w;
        const rd = isRotatedXZ ? w : d;

        const box = new THREE.Box3();
        box.setFromCenterAndSize(worldPos, new THREE.Vector3(rw, h, rd));
        this.colliders.push(box);
    }

    updateSirens(dt) {
        if (!this.sirens) return;
        this.sirenTimer = (this.sirenTimer || 0) + dt;
        const flash = Math.floor(this.sirenTimer * 8) % 2 === 0;
        for (const s of this.sirens) {
            s.red.visible = flash;
            s.blue.visible = !flash;
        }
    }

    toggleTowerDoor(towerIndex) {
        if (!this.towers) return;
        const tower = this.towers[towerIndex];
        if (!tower) return;

        tower.isOpen = !tower.isOpen;

        // Toggle visual meshes
        if (tower.doorMeshes) {
            for (const dm of tower.doorMeshes) {
                dm.visible = !tower.isOpen;
            }
        }
        if (tower.shutterMesh) {
            tower.shutterMesh.visible = !tower.isOpen;
        }

        // Update console screen indicator (green/red)
        tower.buttonScreen.material = tower.buttonScreen.material.clone();
        tower.buttonScreen.material.color.setHex(tower.isOpen ? 0x00ff88 : 0xff3333);

        // Update physics collision bounds
        if (tower.isOpen) {
            // Remove door colliders
            if (tower.doorColliders) {
                for (const col of tower.doorColliders) {
                    const idx = this.colliders.indexOf(col);
                    if (idx !== -1) {
                        this.colliders.splice(idx, 1);
                    }
                }
            }
            // Remove window shutter colliders
            if (tower.shutterColliders) {
                for (const col of tower.shutterColliders) {
                    const sIdx = this.colliders.indexOf(col);
                    if (sIdx !== -1) {
                        this.colliders.splice(sIdx, 1);
                    }
                }
            }
        } else {
            // Compute current world bounding boxes of all doors and add to colliders
            if (tower.doorMeshes && tower.doorColliders) {
                for (let i = 0; i < tower.doorMeshes.length; i++) {
                    const mesh = tower.doorMeshes[i];
                    const col = tower.doorColliders[i];
                    mesh.updateMatrixWorld(true);
                    col.setFromObject(mesh);
                    this.colliders.push(col);
                }
            }

            // Compute world bounding boxes of helper window meshes and add to colliders
            if (tower.shutterColMeshes && tower.shutterColliders) {
                for (let i = 0; i < tower.shutterColMeshes.length; i++) {
                    const mesh = tower.shutterColMeshes[i];
                    const col = tower.shutterColliders[i];
                    mesh.updateMatrixWorld(true);
                    col.setFromObject(mesh);
                    this.colliders.push(col);
                }
            }
        }
    }
}
