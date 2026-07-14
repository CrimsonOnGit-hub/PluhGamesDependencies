import * as THREE from 'three';

const SEND_RATE = 60; // ms between position updates

export class Network {
    constructor(scene) {
        this.scene = scene;
        this.ws = null;
        this.isConnected = false;
        this.remotePlayers = new Map(); // id → { mesh, targetPos, targetRot, ... }
        this.lastSendTime = 0;
        this.callbacks = {
            onPlayerJoin: null,
            onPlayerLeave: null,
            onPlayerShoot: null,
            onHit: null,
            onReadyToJoin: null
        };
    }

    connect(url = 'wss://pluhshooterbackend.onrender.com', playerName = 'Player', playerTeam = 'player') {
        try {
            this.ws = new WebSocket(url);
            this.playerName = playerName;
            this.playerTeam = playerTeam;

            this.ws.onopen = () => {
                console.log('[Network] Connected to server');
                this.isConnected = true;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.warn('[Network] Failed to parse message:', e.message);
                }
            };

            this.ws.onclose = () => {
                console.log('[Network] Disconnected from server');
                this.isConnected = false;
                this.cleanupRemotePlayers();
            };

            this.ws.onerror = (error) => {
                console.warn('[Network] WebSocket error — is the server running?', error);
                this.isConnected = false;
            };
        } catch (e) {
            console.warn('[Network] Failed to connect:', e.message);
        }
    }

    sendJoin(name, team) {
        this.playerName = name;
        this.playerTeam = team;
        this.send({
            type: 'join',
            name: name,
            team: team
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'player_join':
                this.addRemotePlayer(data.id, data.name, data.team, data.position, data.rotation);
                if (this.callbacks.onPlayerJoin) this.callbacks.onPlayerJoin(data);
                break;

            case 'player_leave':
                this.removeRemotePlayer(data.id);
                if (this.callbacks.onPlayerLeave) this.callbacks.onPlayerLeave(data);
                break;

            case 'position_update':
                this.updateRemotePlayer(data.id, data.position, data.rotation);
                break;

            case 'shoot':
                this._visualizeRemoteShot(data);
                if (this.callbacks.onPlayerShoot) this.callbacks.onPlayerShoot(data);
                break;

            case 'hit':
                if (this.callbacks.onHit) this.callbacks.onHit(data);
                break;

            case 'game_state':
                if (data.players) {
                    data.players.forEach(p => this.addRemotePlayer(p.id, p.name, p.team, p.position, p.rotation));
                }
                if (this.callbacks.onReadyToJoin) {
                    this.callbacks.onReadyToJoin();
                }
                break;

            default:
                console.log('[Network] Unknown message type:', data.type);
        }
    }

    createNameTag(name, team) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(10, 10, 18, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const teamColor = team === 'red' ? '#ff3366' : (team === 'blue' ? '#00f0ff' : '#00ffaa');
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        ctx.font = 'bold 24px "Rajdhani", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.toUpperCase(), canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(2.0, 0.5, 1.0);
        return sprite;
    }

    addRemotePlayer(id, name, team, position, rotation) {
        if (this.remotePlayers.has(id)) return;

        const group = new THREE.Group();
        const pName = name || `PLAYER_${id.slice(-4)}`;
        const pTeam = team || 'player';

        let color = 0x4b5320;
        if (pTeam === 'blue') color = 0x1a3375;
        else if (pTeam === 'red') color = 0xb81414;

        const modelGroup = new THREE.Group();
        group.add(modelGroup);

        const bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.4);
        const bodyMat = new THREE.MeshLambertMaterial({ color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.0;
        body.castShadow = true;
        body.receiveShadow = true;
        modelGroup.add(body);

        const vestGeo = new THREE.BoxGeometry(0.85, 0.7, 0.45);
        const vestMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const vest = new THREE.Mesh(vestGeo, vestMat);
        body.add(vest);

        const packGeo = new THREE.BoxGeometry(0.5, 0.7, 0.2);
        const packMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const backpack = new THREE.Mesh(packGeo, packMat);
        backpack.position.set(0, 0, -0.3);
        body.add(backpack);

        const ledColor = pTeam === 'red' ? 0xff3333 : (pTeam === 'blue' ? 0x00aaff : 0x00ffaa);
        const ledGeo = new THREE.BoxGeometry(0.4, 0.06, 0.05);
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
        const ledStrip = new THREE.Mesh(ledGeo, ledMat);
        ledStrip.position.set(0, 0.1, 0.23);
        body.add(ledStrip);

        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const faceMat = new THREE.MeshLambertMaterial({ color: 0xffdcb3 });
        const head = new THREE.Mesh(headGeo, faceMat);
        head.position.y = 1.75;
        head.castShadow = true;
        modelGroup.add(head);

        const helmetGeo = new THREE.BoxGeometry(0.5, 0.25, 0.5);
        const helmetMat = new THREE.MeshLambertMaterial({ color });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.set(0, 0.15, 0);
        head.add(helmet);

        const eyeColor = pTeam === 'red' ? 0xff3333 : (pTeam === 'blue' ? 0x00aaff : 0x00ffaa);
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
        
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.12, 0.05, 0.23);
        head.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.12, 0.05, 0.23);
        head.add(eyeR);

        const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        armGeo.translate(0, -0.4, 0);
        const armMat = new THREE.MeshLambertMaterial({ color });
        
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.55, 1.5, 0);
        armL.castShadow = true;
        
        const padGeo = new THREE.BoxGeometry(0.32, 0.15, 0.32);
        const padMat = new THREE.MeshLambertMaterial({ color });
        const padL = new THREE.Mesh(padGeo, padMat);
        padL.position.set(0, 0.05, 0);
        armL.add(padL);
        
        const handGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const handMat = new THREE.MeshLambertMaterial({ color: 0xffdcb3 });
        const handL = new THREE.Mesh(handGeo, handMat);
        handL.position.set(0, -0.8, 0);
        armL.add(handL);
        modelGroup.add(armL);

        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.55, 1.5, 0);
        armR.castShadow = true;
        
        const padR = new THREE.Mesh(padGeo, padMat);
        padR.position.set(0, 0.05, 0);
        armR.add(padR);

        const handR = new THREE.Mesh(handGeo, handMat);
        handR.position.set(0, -0.8, 0);
        armR.add(handR);
        modelGroup.add(armR);

        armR.rotation.x = -Math.PI / 2.5;

        const gunGroup = new THREE.Group();
        const receiverGeo = new THREE.BoxGeometry(0.06, 0.08, 0.35);
        const receiverMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const receiver = new THREE.Mesh(receiverGeo, receiverMat);
        gunGroup.add(receiver);

        const gunBarrelGeo = new THREE.BoxGeometry(0.03, 0.03, 0.35);
        const gunBarrelMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
        const gunBarrel = new THREE.Mesh(gunBarrelGeo, gunBarrelMat);
        gunBarrel.position.set(0, 0.015, -0.3);
        gunGroup.add(gunBarrel);

        const gunMagGeo = new THREE.BoxGeometry(0.04, 0.12, 0.06);
        const gunMagMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const gunMag = new THREE.Mesh(gunMagGeo, gunMagMat);
        gunMag.position.set(0, -0.08, -0.05);
        gunMag.rotation.x = 0.25;
        gunGroup.add(gunMag);

        const gunScopeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8);
        gunScopeGeo.rotateX(Math.PI / 2);
        const gunScopeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const gunScope = new THREE.Mesh(gunScopeGeo, gunScopeMat);
        gunScope.position.set(0, 0.06, -0.05);
        gunGroup.add(gunScope);

        const gunStockGeo = new THREE.BoxGeometry(0.04, 0.08, 0.18);
        const gunStockMat = new THREE.MeshLambertMaterial({ color: 0x4a3219 });
        const gunStock = new THREE.Mesh(gunStockGeo, gunStockMat);
        gunStock.position.set(0, -0.01, 0.22);
        gunGroup.add(gunStock);

        gunGroup.position.set(0, -0.8, 0.15);
        armR.add(gunGroup);

        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
        legGeo.translate(0, -0.45, 0);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.25, 0.9, 0);
        legL.castShadow = true;
        const kneeGeo = new THREE.BoxGeometry(0.32, 0.2, 0.08);
        const kneeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const kneeL = new THREE.Mesh(kneeGeo, kneeMat);
        kneeL.position.set(0, -0.4, 0.16);
        legL.add(kneeL);
        const bootGeo = new THREE.BoxGeometry(0.32, 0.15, 0.42);
        const bootMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const bootL = new THREE.Mesh(bootGeo, bootMat);
        bootL.position.set(0, -0.85, 0.06);
        legL.add(bootL);
        modelGroup.add(legL);

        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.25, 0.9, 0);
        legR.castShadow = true;
        const kneeR = new THREE.Mesh(kneeGeo, kneeMat);
        kneeR.position.set(0, -0.4, 0.16);
        legR.add(kneeR);
        const bootR = new THREE.Mesh(bootGeo, bootMat);
        bootR.position.set(0, -0.85, 0.06);
        legR.add(bootR);
        modelGroup.add(legR);

        const nameTagSprite = this.createNameTag(pName, pTeam);
        nameTagSprite.position.set(0, 2.3, 0);
        group.add(nameTagSprite);

        const px = position?.x || 0;
        const py = (position?.y || 0) - 1.7; // Offset by player eye height (1.7) so feet stand on ground
        const pz = position?.z || 0;
        group.position.set(px, py, pz);

        this.scene.add(group);

        this.remotePlayers.set(id, {
            mesh: group,
            name: pName,
            team: pTeam,
            armL: armL,
            armR: armR,
            legL: legL,
            legR: legR,
            targetPos: new THREE.Vector3(px, py, pz),
            targetRot: rotation || { y: 0 },
            currentPos: group.position.clone(),
            walkCycle: 0
        });

        console.log(`[Network] Remote player ${pName} (${pTeam}) joined`);
    }

    updateRemotePlayer(id, position, rotation) {
        const player = this.remotePlayers.get(id);
        if (!player) return;
        if (position) {
            player.targetPos.set(position.x, position.y - 1.7, position.z);
        }
        if (rotation) {
            player.targetRot = rotation;
        }
    }

    removeRemotePlayer(id) {
        const player = this.remotePlayers.get(id);
        if (player) {
            this.scene.remove(player.mesh);
            // Dispose geometry and materials
            player.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            this.remotePlayers.delete(id);
            console.log(`[Network] Remote player ${id} left`);
        }
    }

    _visualizeRemoteShot(data) {
        if (!data.origin || !data.direction) return;

        const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
        const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z).normalize();
        const endPoint = origin.clone().add(direction.multiplyScalar(50));

        const points = [origin, endPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.7
        });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        // Fade out and clean up
        let elapsed = 0;
        const fadeInterval = setInterval(() => {
            elapsed += 16;
            material.opacity = Math.max(0, 0.7 - (elapsed / 250));
            if (elapsed >= 250) {
                clearInterval(fadeInterval);
                this.scene.remove(line);
                geometry.dispose();
                material.dispose();
            }
        }, 16);
    }

    sendPosition(state) {
        const now = performance.now();
        if (now - this.lastSendTime < SEND_RATE) return;
        this.lastSendTime = now;

        this.send({
            type: 'position_update',
            position: state.position,
            rotation: state.rotation
        });
    }

    sendShoot(origin, direction) {
        this.send({
            type: 'shoot',
            origin: { x: origin.x, y: origin.y, z: origin.z },
            direction: { x: direction.x, y: direction.y, z: direction.z }
        });
    }

    sendHit(targetId, damage) {
        this.send({
            type: 'hit',
            targetId,
            damage
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    update(deltaTime) {
        // Interpolate remote player positions and rotations for smooth movement
        for (const [id, player] of this.remotePlayers) {
            const lerpFactor = Math.min(1, 8 * deltaTime);

            // Position interpolation
            const prevPos = player.mesh.position.clone();
            player.mesh.position.lerp(player.targetPos, lerpFactor);
            const moveDist = prevPos.distanceTo(player.mesh.position);

            // Legs walk animation if moving
            if (moveDist > 0.005) {
                player.walkCycle = (player.walkCycle || 0) + deltaTime * 12;
                player.legL.rotation.x = Math.sin(player.walkCycle) * 0.5;
                player.legR.rotation.x = -Math.sin(player.walkCycle) * 0.5;
                player.armL.rotation.x = -Math.sin(player.walkCycle) * 0.4;
            } else {
                player.legL.rotation.x = 0;
                player.legR.rotation.x = 0;
                player.armL.rotation.x = 0;
            }

            // Rotation interpolation (Y-axis only, with wrapping)
            if (player.targetRot) {
                const targetY = player.targetRot.y || 0;
                let diff = targetY - player.mesh.rotation.y;
                // Normalize to [-PI, PI] for shortest path
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                player.mesh.rotation.y += diff * lerpFactor;
            }
        }
    }

    getRemotePlayers() {
        return this.remotePlayers;
    }

    onPlayerJoin(cb) { this.callbacks.onPlayerJoin = cb; }
    onPlayerLeave(cb) { this.callbacks.onPlayerLeave = cb; }
    onPlayerShoot(cb) { this.callbacks.onPlayerShoot = cb; }
    onHit(cb) { this.callbacks.onHit = cb; }
    onReadyToJoin(cb) { this.callbacks.onReadyToJoin = cb; }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.cleanupRemotePlayers();
    }

    cleanupRemotePlayers() {
        for (const [id, player] of this.remotePlayers) {
            this.scene.remove(player.mesh);
            player.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        }
        this.remotePlayers.clear();
    }

    dispose() {
        this.disconnect();
    }
}
