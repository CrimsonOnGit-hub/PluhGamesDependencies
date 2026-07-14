import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const PLAYER_SPEED = 12;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_VELOCITY = 8;
const GRAVITY = 20;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.4;

export class Player {
    constructor(camera, scene, domElement) {
        this.camera = camera;
        this.scene = scene;
        this.controls = new PointerLockControls(camera, domElement);

        // State
        this.health = 100;
        this.maxHealth = 100;
        this.isAlive = true;
        this.kills = 0;
        this.deaths = 0;

        // Health regeneration variables
        this.timeSinceLastDamage = 2.0;
        this.regenTimer = 0;

        // Physics
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isOnGround = false;
        this.isSprinting = false;

        // Input state
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false, crouch: false, interact: false };

        // Posture state
        this.currentHeight = PLAYER_HEIGHT;

        // World colliders reference
        this.colliders = [];
        this.world = null;

        // Bind handler references for clean removal
        this.keydownHandler = (e) => this.onKeyDown(e);
        this.keyupHandler = (e) => this.onKeyUp(e);

        this.setupInput();
    }

    setupInput() {
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown':  this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft':  this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'Space':                    this.keys.jump = true; break;
            case 'ShiftLeft':               this.keys.sprint = true; break;
            case 'KeyC': case 'ControlLeft': this.keys.crouch = true; break;
            case 'KeyE':                    this.keys.interact = true; break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown':  this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft':  this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'Space':                    this.keys.jump = false; break;
            case 'ShiftLeft':               this.keys.sprint = false; break;
            case 'KeyC': case 'ControlLeft': this.keys.crouch = false; break;
            case 'KeyE':                    this.keys.interact = false; break;
        }
    }

    setColliders(colliders) {
        this.colliders = colliders;
    }

    setWorld(world) {
        this.world = world;
    }

    dispose() {
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        if (this.controls) {
            this.controls.dispose();
        }
    }

    lock() { this.controls.lock(); }
    unlock() { this.controls.unlock(); }
    get isLocked() { return this.controls.isLocked; }

    update(deltaTime, isAiming = false) {
        if (!this.isAlive || !this.controls.isLocked) return;

        // Cap deltaTime to prevent tunneling on lag spikes
        const dt = Math.min(deltaTime, 0.05);

        const oldHeight = this.currentHeight;

        // Update health regeneration (10 HP every 2 seconds if not damaged for 2 seconds)
        this.timeSinceLastDamage += dt;
        if (this.timeSinceLastDamage >= 2.0) {
            this.regenTimer += dt;
            if (this.regenTimer >= 2.0) {
                this.health = Math.min(this.maxHealth, this.health + 10);
                this.regenTimer = 0;
            }
        } else {
            this.regenTimer = 0;
        }

        // Calculate movement direction from input
        this.direction.set(0, 0, 0);
        if (this.keys.forward)  this.direction.z -= 1;
        if (this.keys.backward) this.direction.z += 1;
        if (this.keys.left)     this.direction.x -= 1;
        if (this.keys.right)    this.direction.x += 1;
        this.direction.normalize();

        // Posture (Crouching)
        let targetHeight = this.keys.crouch ? PLAYER_HEIGHT * 0.5 : PLAYER_HEIGHT;
        if (targetHeight === PLAYER_HEIGHT && this.currentHeight < PLAYER_HEIGHT) {
            // Check if we can uncrouch: if standing up would collide with any ceiling
            const pos = this.camera.position;
            const standBox = new THREE.Box3(
                new THREE.Vector3(pos.x - PLAYER_RADIUS, pos.y - this.currentHeight + 0.05, pos.z - PLAYER_RADIUS),
                new THREE.Vector3(pos.x + PLAYER_RADIUS, pos.y - this.currentHeight + PLAYER_HEIGHT, pos.z + PLAYER_RADIUS)
            );
            let blocked = false;
            for (const collider of this.colliders) {
                if (collider.ownerTeam && collider.ownerTeam === this.team) {
                    continue;
                }
                if (standBox.intersectsBox(collider)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) {
                targetHeight = PLAYER_HEIGHT * 0.5; // Stay crouched
            }
        }
        this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, dt * 10);

        // Sprint
        this.isSprinting = this.keys.sprint && this.keys.forward && !isAiming && !this.keys.crouch;
        let speed = this.isSprinting ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED;
        if (isAiming) speed *= 0.45; // Slow down significantly when aiming
        if (this.keys.crouch) speed *= 0.4; // Slow down when crouching

        // Apply movement in camera's local space (XZ plane only)
        // Get camera's forward and right vectors projected onto XZ plane
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calculate desired horizontal velocity
        const moveX = (right.x * this.direction.x + forward.x * (-this.direction.z)) * speed;
        const moveZ = (right.z * this.direction.x + forward.z * (-this.direction.z)) * speed;

        this.velocity.x = moveX;
        this.velocity.z = moveZ;

        // Jumping
        if (this.keys.jump && this.isOnGround) {
            this.velocity.y = JUMP_VELOCITY;
            this.isOnGround = false;
        }

        // Gravity
        this.velocity.y -= GRAVITY * dt;

        // Calculate new position
        const pos = this.camera.position;
        const newPos = pos.clone();
        newPos.x += this.velocity.x * dt;
        newPos.y += this.velocity.y * dt + (this.currentHeight - oldHeight);
        newPos.z += this.velocity.z * dt;

        // Collision detection with world colliders
        // Scale yEpsilon dynamically so that crouching players don't have an unrealistic step-climbing height
        const yEpsilon = (this.currentHeight / PLAYER_HEIGHT) * 0.7;

        // Check X axis
        const testBoxX = new THREE.Box3(
            new THREE.Vector3(newPos.x - PLAYER_RADIUS, pos.y - this.currentHeight + yEpsilon, pos.z - PLAYER_RADIUS),
            new THREE.Vector3(newPos.x + PLAYER_RADIUS, pos.y, pos.z + PLAYER_RADIUS)
        );
        let collidedX = false;
        for (const collider of this.colliders) {
            if (collider.ownerTeam && collider.ownerTeam === this.team) {
                continue; // Friendly forcefield, pass through!
            }
            if (testBoxX.intersectsBox(collider)) {
                collidedX = true;
                break;
            }
        }
        if (collidedX) {
            newPos.x = pos.x;
            this.velocity.x = 0;
        }

        // Check Z axis
        const testBoxZ = new THREE.Box3(
            new THREE.Vector3(newPos.x - PLAYER_RADIUS, pos.y - this.currentHeight + yEpsilon, newPos.z - PLAYER_RADIUS),
            new THREE.Vector3(newPos.x + PLAYER_RADIUS, pos.y, newPos.z + PLAYER_RADIUS)
        );
        let collidedZ = false;
        for (const collider of this.colliders) {
            if (collider.ownerTeam && collider.ownerTeam === this.team) {
                continue; // Friendly forcefield, pass through!
            }
            if (testBoxZ.intersectsBox(collider)) {
                collidedZ = true;
                break;
            }
        }
        if (collidedZ) {
            newPos.z = pos.z;
            this.velocity.z = 0;
        }
        // Check Y axis
        const testBoxY = new THREE.Box3(
            new THREE.Vector3(newPos.x - PLAYER_RADIUS, newPos.y - this.currentHeight, newPos.z - PLAYER_RADIUS),
            new THREE.Vector3(newPos.x + PLAYER_RADIUS, newPos.y, newPos.z + PLAYER_RADIUS)
        );
        let collidedY = false;
        let floorY = -Infinity;
        let ceilY = Infinity;

        const oldFootY = pos.y - this.currentHeight;

        for (const collider of this.colliders) {
            if (collider.ownerTeam && collider.ownerTeam === this.team) {
                continue; // Friendly forcefield, pass through!
            }
            if (testBoxY.intersectsBox(collider)) {
                if (this.velocity.y <= 0) {
                    // Only land on top of the collider if we were previously above its surface
                    if (oldFootY + yEpsilon >= collider.max.y) {
                        collidedY = true;
                        const newFloorY = collider.max.y;
                        if (newFloorY > floorY) floorY = newFloorY;
                    }
                } else {
                    // Jumping: hit head on bottom of collider
                    // Only hit head if we were previously below the collider's bottom
                    const oldHeadY = pos.y;
                    if (oldHeadY <= collider.min.y + 0.25) {
                        collidedY = true;
                        const newCeilY = collider.min.y;
                        if (newCeilY < ceilY) ceilY = newCeilY;
                    }
                }
            }
        }

        if (collidedY) {
            if (this.velocity.y <= 0) {
                // Landed
                newPos.y = floorY + this.currentHeight;
                this.velocity.y = 0;
                this.isOnGround = true;
            } else {
                // Hit head
                newPos.y = ceilY;
                this.velocity.y = 0;
            }
        } else {
            // Check dynamic terrain heightmap first
            const terrainY = this.world ? this.world.getTerrainHeight(newPos.x, newPos.z) : -3.5;
            if (newPos.y - this.currentHeight < terrainY) {
                newPos.y = terrainY + this.currentHeight;
                this.velocity.y = 0;
                this.isOnGround = true;
            } else {
                this.isOnGround = false;
            }
        }
        pos.copy(newPos);
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health = Math.max(0, this.health - amount);
        this.timeSinceLastDamage = 0; // Interrupt health regeneration
        this.regenTimer = 0;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isAlive = false;
        this.deaths++;
        this.controls.unlock();
    }

    respawn(position) {
        this.health = this.maxHealth;
        this.isAlive = true;
        this.velocity.set(0, 0, 0);
        this.camera.position.copy(position);
        // Keep the exact position Y, since spawn points already calculate correct standing Y relative to terrain
        this.camera.position.y = position.y;
    }

    getPosition() {
        return {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };
    }

    getRotation() {
        return {
            yaw: this.camera.rotation.y,
            pitch: this.camera.rotation.x
        };
    }

    getState() {
        return {
            position: this.getPosition(),
            rotation: this.getRotation(),
            health: this.health,
            isAlive: this.isAlive
        };
    }

    get isMoving() {
        return this.keys.forward || this.keys.backward || this.keys.left || this.keys.right;
    }
}
