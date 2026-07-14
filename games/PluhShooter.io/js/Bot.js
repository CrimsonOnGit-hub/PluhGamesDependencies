import * as THREE from 'three';

const BOT_STATES = { IDLE: 0, PATROL: 1, CHASE: 2, ATTACK: 3 };
const RESPAWN_TIME = 3;

function isInTeamBase(pos, team) {
    if (team === 'blue') {
        return (pos.x >= -75 && pos.x <= -65 && pos.z >= -75 && pos.z <= -65);
    } else if (team === 'red') {
        return (pos.x >= 65 && pos.x <= 75 && pos.z >= 65 && pos.z <= 75);
    }
    return false;
}

const DIFFICULTY_PROFILES = {
    easy: {
        SPEED: 4,
        DAMAGE: 5,
        SHOOT_INTERVAL_MIN: 1.5,
        SHOOT_INTERVAL_MAX: 3.0,
        ACCURACY: 0.3,
        DETECTION_RANGE: 25,
        ATTACK_RANGE: 15
    },
    normal: {
        SPEED: 6,
        DAMAGE: 10,
        SHOOT_INTERVAL_MIN: 0.8,
        SHOOT_INTERVAL_MAX: 2.0,
        ACCURACY: 0.6,
        DETECTION_RANGE: 35,
        ATTACK_RANGE: 25
    },
    hard: {
        SPEED: 12,
        DAMAGE: 20,
        SHOOT_INTERVAL_MIN: 0.3,
        SHOOT_INTERVAL_MAX: 0.8,
        ACCURACY: 0.7,
        DETECTION_RANGE: 60,
        ATTACK_RANGE: 50
    },
    zombie: {
        SPEED: 14,
        DAMAGE: 40,
        SHOOT_INTERVAL_MIN: 999, // They don't shoot
        SHOOT_INTERVAL_MAX: 999,
        ACCURACY: 0,
        DETECTION_RANGE: 200, // They always know where you are
        ATTACK_RANGE: 2.5, // Melee range
        IS_MELEE: true
    }
};

const BOT_COLORS = [0x4b5320, 0xc2b280, 0x333333, 0x223344, 0x554433]; // Military colors: Olive Drab, Desert Tan, Dark Grey, Navy, Brown

export class Bot {
    constructor(scene, world, id, spawnPoint, difficulty = 'normal') {
        this.scene = scene;
        this.world = world;
        this.profile = { ...(DIFFICULTY_PROFILES[difficulty] || DIFFICULTY_PROFILES.normal) };
        this.id = id;
        this.name = `Bot-${id}`;
        this.health = 100;
        this.maxHealth = 100;
        this.isAlive = true;
        this.state = BOT_STATES.IDLE;
        this.respawnTimer = 0;
        this.shootTimer = this.randomShootInterval();
        this.patrolTarget = null;
        this.stateTimer = 0;
        this.difficulty = difficulty;
        this.team = (difficulty === 'zombie') ? 'zombies' : 'bots'; // For TDM later
        this.isZombie = (difficulty === 'zombie');

        // Physics/Movement State
        this.velocity = new THREE.Vector3();
        this.isOnGround = false;
        this.isCrouching = false;
        this.crouchTimer = 0;

        // Internal helpers
        this._direction = new THREE.Vector3();
        this._targetAngle = 0;
        this.stuckTimer = 0;
        this.avoidDir = null;
        this._colliderBox = new THREE.Box3();

        // Create mesh group
        this.mesh = new THREE.Group();
        this.createModel();
        this.mesh.position.copy(spawnPoint);
        this.scene.add(this.mesh);

        // Raycaster for obstacle avoidance
        this.raycaster = new THREE.Raycaster();
    }

    createModel() {
        const isZombie = this.difficulty === 'zombie';
        const color = isZombie ? 0x228b22 : BOT_COLORS[this.id % BOT_COLORS.length]; // Forest green for zombies

        // Group for animation
        this.modelGroup = new THREE.Group();
        this.mesh.add(this.modelGroup);

        // Body (Chest)
        const bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.4);
        const bodyMat = new THREE.MeshLambertMaterial({ color });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 1.0;
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.modelGroup.add(this.body);

        // Tactical Vest
        const vestGeo = new THREE.BoxGeometry(0.85, 0.7, 0.45);
        const vestMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        this.vest = new THREE.Mesh(vestGeo, vestMat);
        this.body.add(this.vest);

        // Tactical Backpack
        const packGeo = new THREE.BoxGeometry(0.5, 0.7, 0.2);
        const packMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        this.backpack = new THREE.Mesh(packGeo, packMat);
        this.backpack.position.set(0, 0, -0.3);
        this.body.add(this.backpack);

        // Glowing chest LED strip
        const ledColor = isZombie ? 0x00ff00 : (this.team === 'red' ? 0xff0055 : (this.team === 'blue' ? 0x00f0ff : 0x00ffaa));
        const ledGeo = new THREE.BoxGeometry(0.4, 0.06, 0.05);
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
        this.ledStrip = new THREE.Mesh(ledGeo, ledMat);
        this.ledStrip.position.set(0, 0.1, 0.23);
        this.body.add(this.ledStrip);

        // Head (Skin tone)
        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const faceMat = new THREE.MeshLambertMaterial({ color: 0xffdcb3 });
        this.head = new THREE.Mesh(headGeo, faceMat);
        this.head.position.y = 1.75;
        this.head.castShadow = true;
        this.modelGroup.add(this.head);

        // Helmet
        const helmetGeo = new THREE.BoxGeometry(0.5, 0.25, 0.5);
        const helmetMat = new THREE.MeshLambertMaterial({ color });
        this.helmet = new THREE.Mesh(helmetGeo, helmetMat);
        this.helmet.position.set(0, 0.15, 0);
        this.head.add(this.helmet);

        // Glowing Cybernetic Eyes
        const eyeColor = isZombie ? 0xff0000 : 0x00f0ff;
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
        
        this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        this.eyeL.position.set(-0.12, 0.05, 0.23);
        this.head.add(this.eyeL);

        this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        this.eyeR.position.set(0.12, 0.05, 0.23);
        this.head.add(this.eyeR);

        // Arms (Uniform)
        const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        armGeo.translate(0, -0.4, 0); // Move pivot to top
        const armMat = new THREE.MeshLambertMaterial({ color });
        
        this.armL = new THREE.Mesh(armGeo, armMat);
        this.armL.position.set(-0.55, 1.5, 0);
        this.armL.castShadow = true;
        
        // Shoulder pad
        const padGeo = new THREE.BoxGeometry(0.32, 0.15, 0.32);
        const padMat = new THREE.MeshLambertMaterial({ color });
        this.padL = new THREE.Mesh(padGeo, padMat);
        this.padL.position.set(0, 0.05, 0);
        this.armL.add(this.padL);
        
        this.modelGroup.add(this.armL);

        this.armR = new THREE.Mesh(armGeo, armMat);
        this.armR.position.set(0.55, 1.5, 0);
        this.armR.castShadow = true;
        
        this.padR = new THREE.Mesh(padGeo, padMat);
        this.padR.position.set(0, 0.05, 0);
        this.armR.add(this.padR);
        
        if (!isZombie) {
            // Make right arm point forward (holding weapon)
            this.armR.rotation.x = -Math.PI / 2.5;

            // Voxel-style Assault Rifle model
            const gunGroup = new THREE.Group();
            
            // Receiver / body (dark metal)
            const bodyMeshGeo = new THREE.BoxGeometry(0.06, 0.08, 0.35);
            const bodyMeshMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
            const bodyMesh = new THREE.Mesh(bodyMeshGeo, bodyMeshMat);
            gunGroup.add(bodyMesh);

            // Barrel
            const barrelMeshGeo = new THREE.BoxGeometry(0.03, 0.03, 0.35);
            const barrelMeshMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
            const barrelMesh = new THREE.Mesh(barrelMeshGeo, barrelMeshMat);
            barrelMesh.position.set(0, 0.015, -0.3); // forward along Z (barrel points forward!)
            gunGroup.add(barrelMesh);

            // Magazine (curved style)
            const magMeshGeo = new THREE.BoxGeometry(0.04, 0.12, 0.06);
            const magMeshMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const magMesh = new THREE.Mesh(magMeshGeo, magMeshMat);
            magMesh.position.set(0, -0.08, -0.05);
            magMesh.rotation.x = 0.25;
            gunGroup.add(magMesh);

            // Scope (Visual tube)
            const scopeMeshGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8);
            scopeMeshGeo.rotateX(Math.PI / 2);
            const scopeMeshMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const scopeMesh = new THREE.Mesh(scopeMeshGeo, scopeMeshMat);
            scopeMesh.position.set(0, 0.06, -0.05);
            gunGroup.add(scopeMesh);

            // Stock
            const stockMeshGeo = new THREE.BoxGeometry(0.04, 0.08, 0.18);
            const stockMeshMat = new THREE.MeshLambertMaterial({ color: 0x4a3219 }); // wood stock
            const stockMesh = new THREE.Mesh(stockMeshGeo, stockMeshMat);
            stockMesh.position.set(0, -0.01, 0.22); // back along Z
            gunGroup.add(stockMesh);

            // Pistol Grip
            const gripMeshGeo = new THREE.BoxGeometry(0.04, 0.08, 0.04);
            const gripMesh = new THREE.Mesh(gripMeshGeo, bodyMeshMat);
            gripMesh.position.set(0, -0.06, 0.08);
            gripMesh.rotation.x = -0.2;
            gunGroup.add(gripMesh);

            this.gun = gunGroup;
            // Position gun group inside the arm (hand pivot is at y = -0.8)
            this.gun.position.set(0, -0.8, 0.15);
            this.armR.add(this.gun);
        } else {
            // Both arms point forward for zombies
            this.armL.rotation.x = -Math.PI / 2.5;
            this.armR.rotation.x = -Math.PI / 2.5;
        }
        this.modelGroup.add(this.armR);

        // Legs (Darker Pants)
        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
        legGeo.translate(0, -0.45, 0); // Move pivot to top
        const legMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

        this.legL = new THREE.Mesh(legGeo, legMat);
        this.legL.position.set(-0.25, 0.9, 0);
        this.legL.castShadow = true;
        
        // Kneepad
        const kneeGeo = new THREE.BoxGeometry(0.32, 0.2, 0.08);
        const kneeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        this.kneeL = new THREE.Mesh(kneeGeo, kneeMat);
        this.kneeL.position.set(0, -0.4, 0.16);
        this.legL.add(this.kneeL);

        // Combat boot
        const bootGeo = new THREE.BoxGeometry(0.32, 0.15, 0.42);
        const bootMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        this.bootL = new THREE.Mesh(bootGeo, bootMat);
        this.bootL.position.set(0, -0.85, 0.06);
        this.legL.add(this.bootL);

        this.modelGroup.add(this.legL);

        this.legR = new THREE.Mesh(legGeo, legMat);
        this.legR.position.set(0.25, 0.9, 0);
        this.legR.castShadow = true;

        this.kneeR = new THREE.Mesh(kneeGeo, kneeMat);
        this.kneeR.position.set(0, -0.4, 0.16);
        this.legR.add(this.kneeR);

        this.bootR = new THREE.Mesh(bootGeo, bootMat);
        this.bootR.position.set(0, -0.85, 0.06);
        this.legR.add(this.bootR);

        this.modelGroup.add(this.legR);

        // Health bar background
        const hpBgGeo = new THREE.BoxGeometry(1.1, 0.12, 0.12);
        const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
        this.healthBarBg = new THREE.Mesh(hpBgGeo, hpBgMat);
        this.healthBarBg.position.y = 2.4;
        this.mesh.add(this.healthBarBg);

        // Health bar foreground (child of background to eliminate Z-fighting)
        const hpGeo = new THREE.BoxGeometry(1, 0.1, 0.1);
        const hpMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthBar = new THREE.Mesh(hpGeo, hpMat);
        this.healthBar.position.set(0, 0, 0.07);
        this.healthBarBg.add(this.healthBar);
    }

    update(deltaTime, playerPosition, playerMesh) {
        if (!this.isAlive) {
            if (this.isZombie) return null; // Zombies do not respawn automatically
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) this.respawn();
            return null;
        }

        const dx = this.mesh.position.x - playerPosition.x;
        const dz = this.mesh.position.z - playerPosition.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);
        this.updateState(distToPlayer, playerPosition);
        this.stateTimer += deltaTime;

        // Make health bar face camera (billboard)
        this.healthBarBg.lookAt(playerPosition);

        // Animate limbs based on movement state
        if (this.state === BOT_STATES.PATROL || this.state === BOT_STATES.CHASE || this.state === BOT_STATES.ATTACK) {
            const moveSpeed = this.state === BOT_STATES.PATROL ? 0.5 : 1.0;
            const cycle = this.stateTimer * 15 * moveSpeed;
            this.legL.rotation.x = Math.sin(cycle) * 0.6;
            this.legR.rotation.x = Math.sin(cycle + Math.PI) * 0.6;
            if (this.difficulty !== 'zombie') {
                this.armL.rotation.x = Math.sin(cycle + Math.PI) * 0.4;
            }
        } else {
            this.legL.rotation.x = 0;
            this.legR.rotation.x = 0;
            if (this.difficulty !== 'zombie') {
                this.armL.rotation.x = 0;
            }
        }

        // Handle crouching scale
        if (this.isCrouching) {
            this.modelGroup.scale.y = THREE.MathUtils.lerp(this.modelGroup.scale.y, 0.6, deltaTime * 10);
        } else {
            this.modelGroup.scale.y = THREE.MathUtils.lerp(this.modelGroup.scale.y, 1.0, deltaTime * 10);
        }

        // Apply physics (gravity)
        this.velocity.y -= 20 * deltaTime; // Gravity
        
        let newY = this.mesh.position.y + this.velocity.y * deltaTime;
        
        // Dynamic vertical collision checking (allowing bots to stand on hills, structures, and climb ramps)
        const botHalfW = 0.4;
        const botHalfD = 0.4;
        const botHeight = this.isCrouching ? 0.95 : 1.9;
        const yEpsilon = this.isCrouching ? 0.35 : 0.7;
        
        const testBoxY = new THREE.Box3(
            new THREE.Vector3(this.mesh.position.x - botHalfW, newY, this.mesh.position.z - botHalfD),
            new THREE.Vector3(this.mesh.position.x + botHalfW, newY + botHeight, this.mesh.position.z + botHalfD)
        );
        
        let collidedY = false;
        let floorY = -Infinity;
        let ceilY = Infinity;
        const colliders = this.world.getColliders();
        
        const oldFootY = this.mesh.position.y;

        for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];
            if (c.ownerTeam && c.ownerTeam === this.team) {
                continue; // Friendly forcefield, pass through!
            }
            if (testBoxY.intersectsBox(c)) {
                if (this.velocity.y <= 0) {
                    // Only land if previously above the collider
                    if (oldFootY + yEpsilon >= c.max.y) {
                        collidedY = true;
                        const newFloorY = c.max.y;
                        if (newFloorY > floorY) floorY = newFloorY;
                    }
                } else {
                    // Jumping: hit head
                    // Only hit head if previously below the collider
                    if (oldFootY + botHeight <= c.min.y + 0.25) {
                        collidedY = true;
                        const newCeilY = c.min.y;
                        if (newCeilY < ceilY) ceilY = newCeilY;
                    }
                }
            }
        }
        
        if (collidedY) {
            if (this.velocity.y <= 0) {
                newY = floorY;
                this.velocity.y = 0;
                this.isOnGround = true;
            } else {
                newY = ceilY - botHeight;
                this.velocity.y = 0;
            }
        } else {
            // Dynamic terrain heightmap snapping
            const terrainY = this.world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
            if (newY < terrainY) {
                newY = terrainY;
                this.velocity.y = 0;
                this.isOnGround = true;
            } else {
                this.isOnGround = false;
            }
        }
        this.mesh.position.y = newY;

        let shotResult = null;

        switch (this.state) {
            case BOT_STATES.IDLE:
                this.doIdle(deltaTime);
                break;
            case BOT_STATES.PATROL:
                this.doPatrol(deltaTime);
                break;
            case BOT_STATES.CHASE:
                this.doChase(deltaTime, playerPosition);
                break;
            case BOT_STATES.ATTACK:
                shotResult = this.doAttack(deltaTime, playerPosition);
                break;
        }

        // Random jumping/crouching during combat
        if (this.state === BOT_STATES.ATTACK || this.state === BOT_STATES.CHASE) {
            if (Math.random() < 0.01 && this.isOnGround) {
                this.velocity.y = 8; // Jump
            }
            if (Math.random() < 0.005) {
                this.isCrouching = true;
                this.crouchTimer = 1.0 + Math.random();
            }
        }

        if (this.crouchTimer > 0) {
            this.crouchTimer -= deltaTime;
            if (this.crouchTimer <= 0) this.isCrouching = false;
        }

        return shotResult;
    }

    hasLineOfSight(playerPos) {
        if (!playerPos) return false;

        const origin = this.mesh.position.clone();
        origin.y += 1.5; // Bot eye height (head is at y=1.75)

        const direction = new THREE.Vector3().subVectors(playerPos, origin);
        const distToPlayer = direction.length();
        direction.normalize();

        this.raycaster.set(origin, direction);
        this.raycaster.far = distToPlayer;

        const colliders = this.world.getColliders();
        for (let i = 0; i < colliders.length; i++) {
            const box = colliders[i];
            const intersection = this.raycaster.ray.intersectBox(box, new THREE.Vector3());
            if (intersection) {
                const distToWall = origin.distanceTo(intersection);
                if (distToWall < distToPlayer - 0.1) {
                    return false; // Shot blocked by a wall
                }
            }
        }
        return true;
    }

    updateState(distToPlayer, playerPos) {
        let newState = this.state;
        
        // Bots only attack (shoot) if they have direct line of sight.
        const hasLos = (this.difficulty === 'zombie') ? true : this.hasLineOfSight(playerPos);

        if (hasLos && distToPlayer <= this.profile.ATTACK_RANGE) {
            newState = BOT_STATES.ATTACK;
        } else if (distToPlayer <= this.profile.DETECTION_RANGE) {
            // Do not chase enemies who are camping inside their own bases
            const enemyTeam = (this.team === 'blue') ? 'red' : 'blue';
            if (isInTeamBase(playerPos, enemyTeam)) {
                newState = BOT_STATES.PATROL;
            } else {
                newState = BOT_STATES.CHASE;
            }
        } else if (this.state === BOT_STATES.IDLE && this.stateTimer > 2) {
            newState = BOT_STATES.PATROL;
        } else {
            newState = BOT_STATES.PATROL;
        }

        if (newState !== this.state) {
            this.state = newState;
            this.stateTimer = 0;
        }
    }

    doIdle(dt) {
        // Subtle random rotation to look "alive"
        this.mesh.rotation.y += (Math.random() - 0.5) * 0.3 * dt;
    }

    doPatrol(dt) {
        // Pick a new patrol target if we don't have one or we've reached it
        if (!this.patrolTarget) {
            this.patrolTarget = this._randomPatrolPoint();
        }

        const dist = this.mesh.position.distanceTo(this.patrolTarget);
        if (dist < 2) {
            this.patrolTarget = this._randomPatrolPoint();
            // Occasionally go idle
            if (Math.random() < 0.3) {
                this.state = BOT_STATES.IDLE;
                this.stateTimer = 0;
                return;
            }
        }

        const moved = this.moveToward(this.patrolTarget, dt, this.profile.SPEED * 0.5);
        if (!moved) {
            // Stuck — pick a new patrol target
            this.patrolTarget = this._randomPatrolPoint();
        }
        this.rotateToward(this.patrolTarget, dt);
    }

    doChase(dt, playerPos) {
        this.moveToward(playerPos, dt, this.profile.SPEED);
        this.rotateToward(playerPos, dt);
    }

    doAttack(dt, playerPos) {
        // Face the player
        this.rotateToward(playerPos, dt);

        if (this.profile.IS_MELEE) {
            // Zombies melee attack logic
            // Swing arms back and forth to indicate attacking
            const cycle = this.stateTimer * 20;
            this.armL.rotation.x = -Math.PI / 2.5 + Math.sin(cycle) * 0.4;
            this.armR.rotation.x = -Math.PI / 2.5 + Math.cos(cycle) * 0.4;

            this.shootTimer -= dt;

            // Check horizontal (2D) distance every frame
            const attackDx = this.mesh.position.x - playerPos.x;
            const attackDz = this.mesh.position.z - playerPos.z;
            const horizontalDist = Math.sqrt(attackDx * attackDx + attackDz * attackDz);

            if (horizontalDist <= this.profile.ATTACK_RANGE) {
                if (this.shootTimer <= 0 || this.shootTimer > 2.0) {
                    this.shootTimer = 1.0; // Cooldown: 1 second
                    return { hit: true, damage: this.profile.DAMAGE, shooterName: this.name };
                }
            }

            // Move toward player even while attacking
            this.moveToward(playerPos, dt, this.profile.SPEED);
            return null;
        }

        // Count down shoot timer for ranged bots
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.randomShootInterval();

            // Check line-of-sight before shooting
            if (!this.hasLineOfSight(playerPos)) {
                return null;
            }

            // Determine hit or miss
            const hit = Math.random() < this.profile.ACCURACY;

            // Fire visual tracer
            this._fireTracer(playerPos, hit);

            if (hit) {
                return { hit: true, damage: this.profile.DAMAGE, shooterName: this.name };
            } else {
                return { hit: false };
            }
        }

        // Slowly strafe while attacking to make the bot harder to hit
        const strafeSpeedMult = this.profile.SPEED > 10 ? 0.8 : 0.3;
        const strafeDir = new THREE.Vector3(
            Math.sin(this.stateTimer * (this.profile.SPEED > 10 ? 4 : 2)) * 0.5,
            0,
            Math.cos(this.stateTimer * (this.profile.SPEED > 10 ? 4 : 2)) * 0.5
        );
        const strafeTarget = this.mesh.position.clone().add(strafeDir);
        this.moveToward(strafeTarget, dt, this.profile.SPEED * strafeSpeedMult);

        return null;
    }

    rotateToward(targetPos, dt) {
        const dx = targetPos.x - this.mesh.position.x;
        const dz = targetPos.z - this.mesh.position.z;
        const targetAngle = Math.atan2(dx, dz);

        // Smooth lerp toward target angle (handle wrapping)
        let diff = targetAngle - this.mesh.rotation.y;
        // Normalize to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        this.mesh.rotation.y += diff * Math.min(1, 5 * dt);
    }

    moveToward(targetPos, dt, speed) {
        // Pathfinding improvement: if bot is inside its own team base, override target Pos to the front exit gate waypoint
        if (this.team && isInTeamBase(this.mesh.position, this.team)) {
            const gateX = (this.team === 'red') ? 70 : -70;
            const gateZ = (this.team === 'red') ? 64 : -64;
            const terrainY = typeof this.world.getTerrainHeight === 'function' ? this.world.getTerrainHeight(gateX, gateZ) : 0;
            targetPos = new THREE.Vector3(gateX, terrainY, gateZ);
        }

        const startPos = this.mesh.position.clone();

        this._direction.set(
            targetPos.x - this.mesh.position.x,
            0,
            targetPos.z - this.mesh.position.z
        );

        const dist = this._direction.length();
        if (dist < 0.1) return true;

        this._direction.normalize();

        // Obstacle avoidance steer if stuck
        if (this.stuckTimer > 0.15 && this.avoidDir) {
            // Blend original direction with perpendicular avoidance direction
            this._direction.addScaledVector(this.avoidDir, 1.5).normalize();

            // Stuck jump logic to jump over debris, low walls, stairs, hills
            if (this.stuckTimer > 0.8 && this.isOnGround && Math.random() < 0.08) {
                this.velocity.y = 8.0; // Jump!
            }
        }

        const step = speed * dt;
        const moveX = this._direction.x * step;
        const moveZ = this._direction.z * step;

        // Proposed new position
        const newX = this.mesh.position.x + moveX;
        const newZ = this.mesh.position.z + moveZ;

        // Check collision with world colliders
        const botHalfW = 0.5;
        const botHalfD = 0.5;

        let moved = false;

        // Try moving on both axes
        if (!this._wouldCollide(newX, newZ, botHalfW, botHalfD)) {
            this.mesh.position.x = newX;
            this.mesh.position.z = newZ;
            moved = true;
        } else if (!this._wouldCollide(newX, this.mesh.position.z, botHalfW, botHalfD)) {
            // Slide on X
            this.mesh.position.x = newX;
            moved = true;
        } else if (!this._wouldCollide(this.mesh.position.x, newZ, botHalfW, botHalfD)) {
            // Slide on Z
            this.mesh.position.z = newZ;
            moved = true;
        }

        // Calculate actual distance moved this frame
        const actualDistMoved = this.mesh.position.distanceTo(startPos);
        const expectedDist = speed * dt;

        // If moved less than 30% of expected speed, bot is stuck/sliding against a wall
        if (moved && actualDistMoved > expectedDist * 0.3) {
            // Decay stuck timer slowly
            this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2.0);
            if (this.stuckTimer <= 0) {
                this.avoidDir = null;
            }
        } else {
            // Increment stuck timer
            this.stuckTimer += dt;
            if (!this.avoidDir) {
                // Pick a perpendicular vector to steer around the obstacle
                this.avoidDir = new THREE.Vector3(this._direction.z, 0, -this._direction.x).normalize();
                if (Math.random() < 0.5) this.avoidDir.negate();
            }
        }

        return moved;
    }

    _wouldCollide(x, z, halfW, halfD) {
        const botHeight = this.isCrouching ? 0.95 : 1.9;
        const yEpsilon = this.isCrouching ? 0.35 : 0.7;
        
        // Build a Box3 for the bot at the proposed position using its current Y position
        this._colliderBox.min.set(x - halfW, this.mesh.position.y + yEpsilon, z - halfD);
        this._colliderBox.max.set(x + halfW, this.mesh.position.y + botHeight, z + halfD);

        const colliders = this.world.getColliders();
        for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];
            if (c.ownerTeam && c.ownerTeam === this.team) {
                continue; // Friendly forcefield, pass through!
            }
            // Skip any collider that is below or at the level of the bot's feet
            if (c.max.y <= this.mesh.position.y + 0.05) continue;
            if (this._colliderBox.intersectsBox(c)) {
                return true;
            }
        }
        return false;
    }

    _randomPatrolPoint() {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        const y = this.world.getTerrainHeight(x, z);
        return new THREE.Vector3(x, y, z);
    }

    _fireTracer(targetPos, hit) {
        // Visual tracer line from bot head to target direction
        const origin = this.mesh.position.clone();
        origin.y += 1.5; // shoot from head height

        let endPoint;
        if (hit) {
            endPoint = targetPos.clone();
            endPoint.y += 0.8; // aim at player center mass
        } else {
            // Miss — offset the end point
            endPoint = targetPos.clone();
            endPoint.x += (Math.random() - 0.5) * 4;
            endPoint.y += (Math.random() - 0.5) * 3 + 0.8;
            endPoint.z += (Math.random() - 0.5) * 4;
        }

        const points = [origin, endPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: hit ? 0xff4444 : 0xffaa44,
            transparent: true,
            opacity: 0.8
        });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        // Fade and remove after a short duration
        let elapsed = 0;
        const fadeInterval = setInterval(() => {
            elapsed += 16;
            material.opacity = Math.max(0, 0.8 - (elapsed / 200));
            if (elapsed >= 200) {
                clearInterval(fadeInterval);
                this.scene.remove(line);
                geometry.dispose();
                material.dispose();
            }
        }, 16);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;

        // Update health bar
        const ratio = this.health / this.maxHealth;
        this.healthBar.scale.x = Math.max(ratio, 0.001);
        // Offset to keep it left-aligned
        this.healthBar.position.x = -(1 - ratio) * 0.5;

        // Color based on health
        if (ratio > 0.5) {
            this.healthBar.material.color.setHex(0x00ff00); // green
        } else if (ratio > 0.25) {
            this.healthBar.material.color.setHex(0xffff00); // yellow
        } else {
            this.healthBar.material.color.setHex(0xff0000); // red
        }

        if (this.health <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    die() {
        this.isAlive = false;
        this.mesh.visible = false;
        this.respawnTimer = RESPAWN_TIME;
    }


    respawn() {
        this.isAlive = true;
        this.health = this.maxHealth;
        this.mesh.visible = true;

        let sp;
        if (this.team === 'red' && typeof this.world.getTerrainHeight === 'function') {
            const baseY = this.world.getTerrainHeight(70, 70);
            sp = new THREE.Vector3(70 + (Math.random() - 0.5) * 4, baseY + 1.0, 70 + (Math.random() - 0.5) * 4);
        } else if (this.team === 'blue' && typeof this.world.getTerrainHeight === 'function') {
            const baseY = this.world.getTerrainHeight(-70, -70);
            sp = new THREE.Vector3(-70 + (Math.random() - 0.5) * 4, baseY + 1.0, -70 + (Math.random() - 0.5) * 4);
        } else {
            sp = this.world.getRandomSpawnPoint();
        }
        this.mesh.position.copy(sp);

        this.state = BOT_STATES.IDLE;
        this.stateTimer = 0;
        this.shootTimer = this.randomShootInterval();
        this.patrolTarget = null;

        // Reset health bar
        this.healthBar.scale.x = 1;
        this.healthBar.position.x = 0;
        this.healthBar.material.color.setHex(0x00ff00);
    }

    randomShootInterval() {
        return this.profile.SHOOT_INTERVAL_MIN + Math.random() * (this.profile.SHOOT_INTERVAL_MAX - this.profile.SHOOT_INTERVAL_MIN);
    }

    getPosition() {
        return this.mesh.position;
    }

    getMesh() {
        return this.mesh;
    }

    setTeam(team) {
        this.team = team;
        
        // Clone materials to avoid sharing color mutations between bots
        this.body.material = this.body.material.clone();
        this.helmet.material = this.helmet.material.clone();
        this.armL.material = this.armL.material.clone();
        this.armR.material = this.armR.material.clone();
        this.legL.material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        this.legR.material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        this.padL.material = this.padL.material.clone();
        this.padR.material = this.padR.material.clone();
        this.ledStrip.material = this.ledStrip.material.clone();

        if (team === 'blue') {
            const teamColor = 0x2244bb;
            const darkTeamColor = 0x152c7a;
            this.body.material.color.setHex(teamColor);
            this.helmet.material.color.setHex(teamColor);
            this.armL.material.color.setHex(teamColor);
            this.armR.material.color.setHex(teamColor);
            this.legL.material.color.setHex(darkTeamColor);
            this.legR.material.color.setHex(darkTeamColor);
            this.padL.material.color.setHex(teamColor);
            this.padR.material.color.setHex(teamColor);
            this.ledStrip.material.color.setHex(0x00f0ff);
        } else if (team === 'red') {
            const teamColor = 0xbb2222;
            const darkTeamColor = 0x7a1515;
            this.body.material.color.setHex(teamColor);
            this.helmet.material.color.setHex(teamColor);
            this.armL.material.color.setHex(teamColor);
            this.armR.material.color.setHex(teamColor);
            this.legL.material.color.setHex(darkTeamColor);
            this.legR.material.color.setHex(darkTeamColor);
            this.padL.material.color.setHex(teamColor);
            this.padR.material.color.setHex(teamColor);
            this.ledStrip.material.color.setHex(0xff0055);
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.traverse((child) => {
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
