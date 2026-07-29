/* global BABYLON */

export class Engine {
    constructor(container) {
        // Create canvas inside container
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        container.appendChild(this.canvas);

        // Babylon.js Engine & Scene
        this.babylonEngine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new BABYLON.Scene(this.babylonEngine);
        this.scene.clearColor = new BABYLON.Color4(0.03, 0.03, 0.06, 1.0);

        // First-Person Camera Rig
        this.playerRig = new BABYLON.TransformNode("playerRig", this.scene);
        this.playerRig.position = new BABYLON.Vector3(0, 1.7, 0);

        this.camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, 0, 0), this.scene);
        this.camera.parent = this.playerRig;
        this.camera.fov = 1.2; // ~70 deg FOV
        this.camera.minZ = 0.1;
        this.camera.maxZ = 1000;

        // Player state
        this.player = {
            position: this.playerRig.position,
            height: 1.7,
            speed: 4,
            sprintSpeed: 8,
            canMove: true,
            isGrounded: true,
            velocity: new BABYLON.Vector3(0, 0, 0)
        };

        this.yaw = 0;
        this.pitch = 0;

        // Input state
        this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };

        // Post-Processing Shader Pipeline (Bloom, Glow, FXAA)
        this.glowLayer = new BABYLON.GlowLayer("glow", this.scene);
        this.glowLayer.intensity = 0.15;

        this.pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, this.scene, [this.camera]);
        this.pipeline.bloomEnabled = true;
        this.pipeline.bloomWeight = 0.1;
        this.pipeline.bloomThreshold = 0.85;
        this.pipeline.fxaaEnabled = true;

        // Pointer Lock & Mouse Look
        this.canvas.addEventListener('click', () => {
            if (this.player.canMove) this.enablePointerLock();
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.canvas && this.player.canMove) {
                const movementX = e.movementX || 0;
                const movementY = e.movementY || 0;

                // Standard FPS Mouse Look
                this.yaw += movementX * 0.002;
                this.pitch += movementY * 0.002;
                this.pitch = Math.max(-85 * Math.PI / 180, Math.min(85 * Math.PI / 180, this.pitch));

                this.playerRig.rotation.y = this.yaw;
                this.camera.rotation.x = this.pitch;
            }
        });

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('resize', () => this.onResize());

        // Systems
        this.colliders = [];
        this.playerRadius = 0.3;
        this.interactables = new Map();
        this.currentInteractable = null;
        this.onInteract = null;

        // Lighting & Effects
        this.ambientLight = null;
        this.lights = [];
        this.shakeIntensity = 0;
        this.shakeTime = 0;

        // Water Swimming System
        this.waterZones = [];
        this.isSwimming = false;
        this.drownTimer = 0;
        this.maxDrownTime = 30;
        this.onDrown = null;

        // Start render loop
        this.babylonEngine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
        if (e.key === 'Shift') this.keys.shift = true;
        if (key === ' ') this.keys.space = true;
        if (key === 'e' && this.currentInteractable && this.onInteract) {
            this.onInteract.call(null, this.currentInteractable);
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
        if (e.key === 'Shift') this.keys.shift = false;
        if (key === ' ') this.keys.space = false;
    }

    enablePointerLock() {
        if (this.canvas.requestPointerLock) {
            this.canvas.requestPointerLock();
        }
    }

    disablePointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    setPlayerPosition(x, y, z) {
        this.playerRig.position.set(x, y, z);
    }

    setPlayerCanMove(bool) {
        this.player.canMove = bool;
        if (!bool) this.disablePointerLock();
    }

    addCollider(mesh) {
        if (mesh) this.colliders.push(mesh);
    }

    removeCollider(mesh) {
        this.colliders = this.colliders.filter(c => c !== mesh);
    }

    clearColliders() {
        this.colliders = [];
    }

    checkCollisionAt(x, y, z) {
        const radius = 0.45;
        const pMinX = x - radius;
        const pMaxX = x + radius;
        const pMinZ = z - radius;
        const pMaxZ = z + radius;
        const pMinY = y - 1.5;
        const pMaxY = y + 0.3;

        for (const collider of this.colliders) {
            if (!collider || typeof collider.getBoundingInfo !== 'function') continue;
            collider.computeWorldMatrix(true);
            const bb = collider.getBoundingInfo().boundingBox;

            const intersects = (
                pMaxX >= bb.minimumWorld.x && pMinX <= bb.maximumWorld.x &&
                pMaxY >= bb.minimumWorld.y && pMinY <= bb.maximumWorld.y &&
                pMaxZ >= bb.minimumWorld.z && pMinZ <= bb.maximumWorld.z
            );

            if (intersects) return true;
        }
        return false;
    }

    addInteractable(id, mesh, label, callback) {
        this.interactables.set(id, { mesh, label, callback });
    }

    removeInteractable(id) {
        this.interactables.delete(id);
    }

    clearInteractables() {
        this.interactables.clear();
    }

    screenShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTime = duration;
    }

    screenFlash(color, duration) {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.backgroundColor = typeof color === 'string' ? color : '#ff0033';
        div.style.opacity = '0.7';
        div.style.zIndex = '9999';
        div.style.pointerEvents = 'none';
        div.style.transition = `opacity ${duration}ms ease-out`;

        document.body.appendChild(div);

        requestAnimationFrame(() => {
            div.style.opacity = '0';
        });

        setTimeout(() => div.remove(), duration);
    }

    setFog(color, near, far) {
        this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
        if (typeof color === 'number') {
            const r = ((color >> 16) & 255) / 255;
            const g = ((color >> 8) & 255) / 255;
            const b = (color & 255) / 255;
            this.scene.fogColor = new BABYLON.Color3(r, g, b);
            this.scene.clearColor = new BABYLON.Color4(r, g, b, 1.0);
        }
        this.scene.fogStart = near;
        this.scene.fogEnd = far;
    }

    clearFog() {
        this.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
    }

    setAmbientLight(color, intensity) {
        if (this.ambientLight) this.ambientLight.dispose();
        const r = ((color >> 16) & 255) / 255;
        const g = ((color >> 8) & 255) / 255;
        const b = (color & 255) / 255;
        this.ambientLight = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.ambientLight.diffuse = new BABYLON.Color3(r, g, b);
        this.ambientLight.intensity = intensity;
    }

    addPointLight(x, y, z, color, intensity, range = 20) {
        const r = ((color >> 16) & 255) / 255;
        const g = ((color >> 8) & 255) / 255;
        const b = (color & 255) / 255;
        const light = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(x, y, z), this.scene);
        light.diffuse = new BABYLON.Color3(r, g, b);
        light.intensity = intensity;
        light.range = range;
        this.lights.push(light);
        return light;
    }

    clearLights() {
        this.lights.forEach(l => l.dispose());
        this.lights = [];
    }

    addWaterZone(minVec3, maxVec3) {
        this.waterZones.push({ min: minVec3, max: maxVec3 });
    }

    clearWaterZones() {
        this.waterZones = [];
    }

    update(delta) {
        if (!this.player.canMove) return;

        // Screen Shake Decay
        if (this.shakeTime > 0) {
            this.shakeTime -= delta * 1000;
            const rx = (Math.random() - 0.5) * 0.05 * this.shakeIntensity;
            const ry = (Math.random() - 0.5) * 0.05 * this.shakeIntensity;
            this.camera.position.set(rx, ry, 0);
        } else {
            this.camera.position.set(0, 0, 0);
        }

        // Check if player is inside any water zone
        const pPos = this.playerRig.position;
        let inWater = false;
        for (const zone of this.waterZones) {
            if (pPos.x >= zone.min.x && pPos.x <= zone.max.x &&
                pPos.y >= zone.min.y && pPos.y <= zone.max.y &&
                pPos.z >= zone.min.z && pPos.z <= zone.max.z) {
                inWater = true;
                break;
            }
        }

        const moveSpeed = (this.keys.shift ? this.player.sprintSpeed : this.player.speed) * (inWater ? 0.6 : 1.0);
        const forward = this.playerRig.getDirection(BABYLON.Vector3.Forward());
        const right = this.playerRig.getDirection(BABYLON.Vector3.Right());

        const moveDir = new BABYLON.Vector3(0, 0, 0);
        if (this.keys.w) moveDir.addInPlace(forward);
        if (this.keys.s) moveDir.subtractInPlace(forward);
        if (this.keys.d) moveDir.addInPlace(right);
        if (this.keys.a) moveDir.subtractInPlace(right);

        if (moveDir.lengthSquared() > 0) {
            moveDir.normalize();
            const step = moveSpeed * delta;

            // X-axis movement with wall collision test
            const nextX = this.playerRig.position.x + moveDir.x * step;
            if (!this.checkCollisionAt(nextX, this.playerRig.position.y, this.playerRig.position.z)) {
                this.playerRig.position.x = nextX;
            }

            // Z-axis movement with wall collision test
            const nextZ = this.playerRig.position.z + moveDir.z * step;
            if (!this.checkCollisionAt(this.playerRig.position.x, this.playerRig.position.y, nextZ)) {
                this.playerRig.position.z = nextZ;
            }
        }

        if (inWater) {
            this.isSwimming = true;
            this.drownTimer += delta;

            // Update Drowning Oxygen HUD Meter
            const drownBar = document.getElementById('drown-bar');
            const drownFill = document.getElementById('drown-fill');
            const drownVal = document.getElementById('drown-value');
            if (drownBar) drownBar.classList.remove('screen-hidden');
            
            const remainingO2 = Math.max(0, 100 - (this.drownTimer / this.maxDrownTime) * 100);
            if (drownFill) drownFill.style.width = `${remainingO2}%`;
            if (drownVal) drownVal.textContent = `${Math.round(remainingO2)}% O2`;

            // Slow sink in water
            this.player.velocity.y = -1.5;
            if (this.keys.space) {
                this.player.velocity.y = 3.0; // Swim upward
            }
            this.playerRig.position.y += this.player.velocity.y * delta;

            // Drowning blue vignette overlay
            let overlay = document.getElementById('drown-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'drown-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '9998';
                overlay.style.background = 'radial-gradient(circle, transparent 40%, rgba(0, 80, 200, 0.8) 100%)';
                overlay.style.opacity = '0';
                document.body.appendChild(overlay);
            }

            if (this.drownTimer > 20) {
                overlay.style.opacity = String(Math.min(0.8, (this.drownTimer - 20) / 10));
            } else {
                overlay.style.opacity = '0';
            }

            if (this.drownTimer >= this.maxDrownTime && this.onDrown) {
                this.onDrown();
            }
        } else {
            this.isSwimming = false;
            this.drownTimer = 0;

            const drownBar = document.getElementById('drown-bar');
            if (drownBar) drownBar.classList.add('screen-hidden');

            const overlay = document.getElementById('drown-overlay');
            if (overlay) overlay.remove();

            // Simple ground plane check at y = 1.7
            if (this.playerRig.position.y < 1.7) {
                this.playerRig.position.y = 1.7;
            }
        }

        // Raycast interactables forward from camera
        const ray = this.scene.createPickingRay(
            this.babylonEngine.getRenderWidth() / 2,
            this.babylonEngine.getRenderHeight() / 2,
            BABYLON.Matrix.Identity(),
            this.camera
        );

        let hitInteractable = null;
        for (const [id, item] of this.interactables.entries()) {
            if (item.mesh) {
                const pickInfo = ray.intersectsMesh(item.mesh, true);
                if (pickInfo.hit && pickInfo.distance <= 6.0) {
                    hitInteractable = item;
                    break;
                }
            }
        }
        this.currentInteractable = hitInteractable;
    }

    onResize() {
        this.babylonEngine.resize();
    }
}
