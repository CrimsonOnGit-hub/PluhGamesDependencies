/* global BABYLON */
import { TextureGenerator } from './textures.js';

export class World {
    constructor(engine) {
        this.engine = engine;
        this.textures = new TextureGenerator(engine);
    }

    clearWorld() {
        const scene = this.engine.scene;

        // Dispose of all meshes except camera rig
        const meshes = [...scene.meshes];
        meshes.forEach((mesh) => {
            if (mesh && mesh !== this.engine.camera && mesh.parent !== this.engine.playerRig) {
                mesh.dispose();
            }
        });

        // Dispose of lights
        this.engine.clearLights();
        this.engine.clearColliders();
        this.engine.clearInteractables();
        this.engine.clearWaterZones();
    }

    // Helper: Hex color to Babylon Color3
    hexToColor3(hex) {
        const r = ((hex >> 16) & 255) / 255;
        const g = ((hex >> 8) & 255) / 255;
        const b = (hex & 255) / 255;
        return new BABYLON.Color3(r, g, b);
    }

    // High-Quality Joint-Rigged Character Generator in Babylon.js
    createCharacterMesh(hairColorHex = 0x221100, heightScale = 1.7, isMale = true, hairType = 'spiky') {
        const scene = this.engine.scene;
        const root = new BABYLON.TransformNode("charRoot", scene);
        const joints = {};

        const skinMat = new BABYLON.StandardMaterial("skinMat", scene);
        skinMat.diffuseColor = new BABYLON.Color3(0.85, 0.72, 0.62);
        skinMat.specularColor = new BABYLON.Color3(0, 0, 0); // Matte skin, no plastic glare

        const shirtMat = new BABYLON.StandardMaterial("shirtMat", scene);
        shirtMat.diffuseColor = new BABYLON.Color3(0.85, 0.45, 0.45); // Bunny shirt pinkish red
        shirtMat.specularColor = new BABYLON.Color3(0, 0, 0);

        const pantsMat = new BABYLON.StandardMaterial("pantsMat", scene);
        pantsMat.diffuseColor = new BABYLON.Color3(0.55, 0.45, 0.32);
        pantsMat.specularColor = new BABYLON.Color3(0, 0, 0);

        const hairMat = new BABYLON.StandardMaterial("hairMat", scene);
        hairMat.diffuseColor = this.hexToColor3(hairColorHex);
        hairMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

        const eyeMat = new BABYLON.StandardMaterial("eyeMat", scene);
        eyeMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        const bootMat = new BABYLON.StandardMaterial("bootMat", scene);
        bootMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);

        const beltMat = new BABYLON.StandardMaterial("beltMat", scene);
        beltMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        const buckleMat = new BABYLON.StandardMaterial("buckleMat", scene);
        buckleMat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.2);

        const visorMat = new BABYLON.StandardMaterial("visorMat", scene);
        visorMat.diffuseColor = new BABYLON.Color3(0.05, 0.15, 0.3);
        visorMat.emissiveColor = new BABYLON.Color3(0.02, 0.1, 0.2);

        const bunnyMat = new BABYLON.StandardMaterial("bunnyMat", scene);
        bunnyMat.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);

        // Scale root for age/height (e.g. 1.45m for 13yo Jake, 1.7m for Miles)
        root.scaling.set(heightScale / 1.7, heightScale / 1.7, heightScale / 1.7);

        // Pelvis & Belt
        const pelvis = new BABYLON.TransformNode("pelvis", scene);
        pelvis.parent = root;
        pelvis.position.y = 0.85;
        joints.pelvis = pelvis;

        const belt = BABYLON.MeshBuilder.CreateCylinder("belt", { height: 0.08, diameter: 0.42 }, scene);
        belt.parent = pelvis;
        belt.position.y = 0.08;
        belt.material = beltMat;

        const buckle = BABYLON.MeshBuilder.CreateBox("buckle", { width: 0.08, height: 0.06, depth: 0.04 }, scene);
        buckle.parent = belt;
        buckle.position.set(0, 0, 0.21);
        buckle.material = buckleMat;

        // Left Leg & Boot
        const leftHip = new BABYLON.TransformNode("leftHip", scene);
        leftHip.parent = pelvis;
        leftHip.position.set(-0.18, 0, 0);
        joints.leftHip = leftHip;

        const leftLeg = BABYLON.MeshBuilder.CreateCylinder("leftLeg", { height: 0.75, diameter: 0.2 }, scene);
        leftLeg.parent = leftHip;
        leftLeg.position.y = -0.375;
        leftLeg.material = pantsMat;

        const leftBoot = BABYLON.MeshBuilder.CreateBox("leftBoot", { width: 0.22, height: 0.18, depth: 0.3 }, scene);
        leftBoot.parent = leftHip;
        leftBoot.position.set(0, -0.78, 0.04);
        leftBoot.material = bootMat;

        // Right Leg & Boot
        const rightHip = new BABYLON.TransformNode("rightHip", scene);
        rightHip.parent = pelvis;
        rightHip.position.set(0.18, 0, 0);
        joints.rightHip = rightHip;

        const rightLeg = BABYLON.MeshBuilder.CreateCylinder("rightLeg", { height: 0.75, diameter: 0.2 }, scene);
        rightLeg.parent = rightHip;
        rightLeg.position.y = -0.375;
        rightLeg.material = pantsMat;

        const rightBoot = BABYLON.MeshBuilder.CreateBox("rightBoot", { width: 0.22, height: 0.18, depth: 0.3 }, scene);
        rightBoot.parent = rightHip;
        rightBoot.position.set(0, -0.78, 0.04);
        rightBoot.material = bootMat;

        // Torso & Shirt Logo
        const torso = new BABYLON.TransformNode("torso", scene);
        torso.parent = pelvis;
        torso.position.y = 0.2;
        joints.torso = torso;

        const chest = BABYLON.MeshBuilder.CreateCylinder("chest", { height: 0.7, diameterTop: 0.45, diameterBottom: 0.38 }, scene);
        chest.parent = torso;
        chest.position.y = 0.35;
        chest.material = shirtMat;

        // Bunny Shirt Emblem on Chest
        const bunnyLogo = BABYLON.MeshBuilder.CreateBox("bunnyLogo", { width: 0.16, height: 0.18, depth: 0.02 }, scene);
        bunnyLogo.parent = chest;
        bunnyLogo.position.set(0, 0.08, 0.21);
        bunnyLogo.material = bunnyMat;

        // Left Arm
        const leftShoulder = new BABYLON.TransformNode("leftShoulder", scene);
        leftShoulder.parent = torso;
        leftShoulder.position.set(-0.32, 0.6, 0);
        joints.leftShoulder = leftShoulder;

        const leftArm = BABYLON.MeshBuilder.CreateCylinder("leftArm", { height: 0.65, diameter: 0.14 }, scene);
        leftArm.parent = leftShoulder;
        leftArm.position.y = -0.325;
        leftArm.material = shirtMat;

        // Right Arm
        const rightShoulder = new BABYLON.TransformNode("rightShoulder", scene);
        rightShoulder.parent = torso;
        rightShoulder.position.set(0.32, 0.6, 0);
        joints.rightShoulder = rightShoulder;

        const rightArm = BABYLON.MeshBuilder.CreateCylinder("rightArm", { height: 0.65, diameter: 0.14 }, scene);
        rightArm.parent = rightShoulder;
        rightArm.position.y = -0.325;
        rightArm.material = shirtMat;

        // Head Node
        const headNode = new BABYLON.TransformNode("headNode", scene);
        headNode.parent = torso;
        headNode.position.y = 0.75;
        joints.head = headNode;

        const headMesh = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.42 }, scene);
        headMesh.parent = headNode;
        headMesh.position.y = 0.21;
        headMesh.material = skinMat;

        // Facial Features: Eyes, Eyebrows, Nose, Ears
        const leftEye = BABYLON.MeshBuilder.CreateSphere("leftEye", { diameter: 0.06 }, scene);
        leftEye.parent = headMesh;
        leftEye.position.set(-0.09, 0.04, 0.19);
        leftEye.material = eyeMat;

        const rightEye = BABYLON.MeshBuilder.CreateSphere("rightEye", { diameter: 0.06 }, scene);
        rightEye.parent = headMesh;
        rightEye.position.set(0.09, 0.04, 0.19);
        rightEye.material = eyeMat;

        // Eyebrows
        const eyebrowL = BABYLON.MeshBuilder.CreateBox("eyebrowL", { width: 0.08, height: 0.015, depth: 0.02 }, scene);
        eyebrowL.parent = headMesh;
        eyebrowL.position.set(-0.09, 0.09, 0.2);
        eyebrowL.material = hairMat;

        const eyebrowR = BABYLON.MeshBuilder.CreateBox("eyebrowR", { width: 0.08, height: 0.015, depth: 0.02 }, scene);
        eyebrowR.parent = headMesh;
        eyebrowR.position.set(0.09, 0.09, 0.2);
        eyebrowR.material = hairMat;

        // Nose & Ears
        const nose = BABYLON.MeshBuilder.CreateBox("nose", { width: 0.03, height: 0.05, depth: 0.04 }, scene);
        nose.parent = headMesh;
        nose.position.set(0, 0.01, 0.21);
        nose.material = skinMat;

        const earL = BABYLON.MeshBuilder.CreateSphere("earL", { diameter: 0.08 }, scene);
        earL.parent = headMesh;
        earL.position.set(-0.21, 0.02, 0);
        earL.material = skinMat;

        const earR = BABYLON.MeshBuilder.CreateSphere("earR", { diameter: 0.08 }, scene);
        earR.parent = headMesh;
        earR.position.set(0.21, 0.02, 0);
        earR.material = skinMat;

        // Hair / Guard Helmet Styling
        if (hairType === 'guard') {
            const helmet = BABYLON.MeshBuilder.CreateSphere("helmet", { diameter: 0.47 }, scene);
            helmet.parent = headMesh;
            helmet.position.set(0, 0.04, 0);
            helmet.material = hairMat;

            const visor = BABYLON.MeshBuilder.CreateBox("visor", { width: 0.32, height: 0.1, depth: 0.06 }, scene);
            visor.parent = helmet;
            visor.position.set(0, 0.04, 0.19);
            visor.material = visorMat;
        } else if (hairType === 'female') {
            const hairBase = BABYLON.MeshBuilder.CreateSphere("hairBase", { diameter: 0.46 }, scene);
            hairBase.parent = headMesh;
            hairBase.position.set(0, 0.04, -0.04);
            hairBase.material = hairMat;

            const ponytail = BABYLON.MeshBuilder.CreateCylinder("ponytail", { height: 0.4, diameterTop: 0.12, diameterBottom: 0.04 }, scene);
            ponytail.parent = hairBase;
            ponytail.position.set(0, -0.15, -0.22);
            ponytail.rotation.x = 0.4;
            ponytail.material = hairMat;
        } else {
            const hairCap = BABYLON.MeshBuilder.CreateSphere("hairCap", { diameter: 0.44 }, scene);
            hairCap.parent = headMesh;
            hairCap.position.set(0, 0.06, -0.02);
            hairCap.material = hairMat;

            // Spiky hair tufts
            const spike1 = BABYLON.MeshBuilder.CreateCone("spike1", { diameter: 0.08, height: 0.12 }, scene);
            spike1.parent = hairCap;
            spike1.position.set(0, 0.22, 0.05);
            spike1.material = hairMat;

            const spike2 = BABYLON.MeshBuilder.CreateCone("spike2", { diameter: 0.07, height: 0.1 }, scene);
            spike2.parent = hairCap;
            spike2.position.set(-0.08, 0.2, 0);
            spike2.material = hairMat;
        }

        root.userData = { joints };
        return root;
    }

    // Joint Animation Engine in Babylon.js
    animateCharacter(charMesh, animType, time) {
        if (!charMesh || !charMesh.userData || !charMesh.userData.joints) return;
        const j = charMesh.userData.joints;

        if (animType === 'walk') {
            const angle = Math.sin(time * 6) * 0.45;
            j.leftHip.rotation.x = angle;
            j.rightHip.rotation.x = -angle;
            j.leftShoulder.rotation.x = -angle * 0.8;
            j.rightShoulder.rotation.x = angle * 0.8;
            j.torso.rotation.y = Math.sin(time * 3) * 0.08;
        } else if (animType === 'run') {
            const angle = Math.sin(time * 10) * 0.85;
            j.leftHip.rotation.x = angle;
            j.rightHip.rotation.x = -angle;
            j.leftShoulder.rotation.x = -angle * 1.2;
            j.rightShoulder.rotation.x = angle * 1.2;
            j.torso.rotation.y = Math.sin(time * 5) * 0.15;
        } else if (animType === 'talk') {
            j.leftHip.rotation.x = 0;
            j.rightHip.rotation.x = 0;
            j.head.rotation.y = Math.sin(time * 4) * 0.15;
            j.head.rotation.x = Math.sin(time * 2) * 0.08;
            j.rightShoulder.rotation.x = -0.3 + Math.sin(time * 5) * 0.2;
        } else if (animType === 'swim') {
            j.leftHip.rotation.x = Math.sin(time * 8) * 0.3;
            j.rightHip.rotation.x = -Math.sin(time * 8) * 0.3;
            j.leftShoulder.rotation.x = Math.sin(time * 5) * 1.5;
            j.rightShoulder.rotation.x = Math.cos(time * 5) * 1.5;
        } else if (animType === 'drown') {
            j.leftShoulder.rotation.z = 1.2 + Math.sin(time * 12) * 0.5;
            j.rightShoulder.rotation.z = -1.2 - Math.cos(time * 12) * 0.5;
            j.head.rotation.x = Math.sin(time * 15) * 0.4;
        } else {
            // Idle Pose
            j.leftHip.rotation.x = 0;
            j.rightHip.rotation.x = 0;
            j.leftShoulder.rotation.x = 0;
            j.rightShoulder.rotation.x = 0;
            j.leftShoulder.rotation.z = 0;
            j.rightShoulder.rotation.z = 0;
            j.head.rotation.x = 0;
            j.head.rotation.y = 0;
            j.torso.rotation.y = 0;
        }
    }

    // Equip 3D Gun mesh
    equipGun(charMesh, gunType = 'pistol') {
        const scene = this.engine.scene;
        const j = charMesh.userData ? charMesh.userData.joints : null;
        if (!j || !j.rightShoulder) return;

        const gunMat = new BABYLON.StandardMaterial("gunMat", scene);
        gunMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);

        const body = BABYLON.MeshBuilder.CreateBox("gunBody", { width: 0.08, height: 0.12, depth: 0.35 }, scene);
        body.parent = j.rightShoulder;
        body.position.set(0, -0.6, 0.2);
        body.rotation.x = Math.PI / 4;
        body.material = gunMat;
    }

    // Particle system blood burst
    createBloodBurst(position, direction, scale = 1.0) {
        const scene = this.engine.scene;
        const ps = new BABYLON.ParticleSystem("bloodBurst", 80, scene);
        ps.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", scene);
        ps.emitter = position.clone();
        ps.color1 = new BABYLON.Color4(0.8, 0, 0, 1.0);
        ps.color2 = new BABYLON.Color4(0.4, 0, 0, 1.0);
        ps.minSize = 0.05 * scale;
        ps.maxSize = 0.15 * scale;
        ps.minLifeTime = 0.3;
        ps.maxLifeTime = 0.8;
        ps.emitRate = 400;
        ps.gravity = new BABYLON.Vector3(0, -12, 0);
        ps.direction1 = direction.add(new BABYLON.Vector3(0.5, 0.5, 0.5)).scale(3);
        ps.direction2 = direction.add(new BABYLON.Vector3(-0.5, -0.5, -0.5)).scale(3);
        ps.start();
        setTimeout(() => ps.stop(), 250);
    }

    gunshot(shooterPos, targetChar) {
        if (targetChar && targetChar.position) {
            const dir = targetChar.position.subtract(shooterPos).normalize();
            this.createBloodBurst(targetChar.position.add(new BABYLON.Vector3(0, 1.2, 0)), dir, 1.5);
        }
    }

    // Environment Builders
    buildRationsRoom() {
        this.clearWorld();
        this.engine.setFog(0x181822, 5, 25);
        this.engine.setAmbientLight(0xddeeff, 0.3);

        const scene = this.engine.scene;
        const objects = {};

        const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);

        // Floor (6m x 6m)
        const floor = BABYLON.MeshBuilder.CreatePlane("floor", { width: 6, height: 6 }, scene);
        floor.rotation.x = Math.PI / 2;
        floor.material = wallMat;

        // Ceiling (6m x 6m)
        const ceiling = BABYLON.MeshBuilder.CreatePlane("ceiling", { width: 6, height: 6 }, scene);
        ceiling.rotation.x = -Math.PI / 2;
        ceiling.position.y = 3;
        ceiling.material = wallMat;

        // Walls
        const wallBack = BABYLON.MeshBuilder.CreateBox("wallBack", { width: 6, height: 3, depth: 0.1 }, scene);
        wallBack.position.set(0, 1.5, -3);
        wallBack.material = wallMat;
        this.engine.addCollider(wallBack);

        const wallFront = BABYLON.MeshBuilder.CreateBox("wallFront", { width: 6, height: 3, depth: 0.1 }, scene);
        wallFront.position.set(0, 1.5, 3);
        wallFront.material = wallMat;
        this.engine.addCollider(wallFront);

        const wallLeft = BABYLON.MeshBuilder.CreateBox("wallLeft", { width: 0.1, height: 3, depth: 6 }, scene);
        wallLeft.position.set(-3, 1.5, 0);
        wallLeft.material = wallMat;
        this.engine.addCollider(wallLeft);

        const wallRight = BABYLON.MeshBuilder.CreateBox("wallRight", { width: 0.1, height: 3, depth: 6 }, scene);
        wallRight.position.set(3, 1.5, 0);
        wallRight.material = wallMat;
        this.engine.addCollider(wallRight);

        // Metal Table
        const tableMat = new BABYLON.StandardMaterial("tableMat", scene);
        tableMat.diffuseColor = new BABYLON.Color3(0.65, 0.65, 0.7);

        const table = BABYLON.MeshBuilder.CreateBox("table", { width: 1.5, height: 0.8, depth: 1 }, scene);
        table.position.set(0, 0.4, 0);
        table.material = tableMat;
        this.engine.addCollider(table);
        objects.table = table;

        // Rations Plate & Block
        const rationsGroup = new BABYLON.TransformNode("rationsGroup", scene);
        rationsGroup.position.set(0, 0.8, 0);

        const plateMat = new BABYLON.StandardMaterial("plateMat", scene);
        plateMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.95);
        const plate = BABYLON.MeshBuilder.CreateCylinder("plate", { height: 0.02, diameter: 0.5 }, scene);
        plate.parent = rationsGroup;
        plate.material = plateMat;

        const blockMat = new BABYLON.StandardMaterial("blockMat", scene);
        blockMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
        const block = BABYLON.MeshBuilder.CreateBox("block", { width: 0.22, height: 0.12, depth: 0.15 }, scene);
        block.parent = rationsGroup;
        block.position.y = 0.07;
        block.material = blockMat;

        objects.rations = block; // Bind interactable mesh directly to block!

        // Guard / PA Speaker Figure
        const guard = this.createCharacterMesh(0x111115, 1.85, false, 'guard');
        guard.position.set(0, 0, -2.1);
        guard.rotation.y = 0; // Facing +Z directly towards player across table!
        objects.guard = guard;
        objects.speaker = guard;

        // Wall Mounted Speaker
        const speakerMat = new BABYLON.StandardMaterial("speakerMat", scene);
        speakerMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
        const speaker = BABYLON.MeshBuilder.CreateBox("speaker", { width: 0.6, height: 0.4, depth: 0.2 }, scene);
        speaker.position.set(0, 2.4, -2.85);
        speaker.material = speakerMat;
        objects.paSpeaker = speaker;

        this.engine.addPointLight(0, 2.8, 0, 0xffeedd, 0.6, 15);
        return { objects };
    }

    buildResidentialQuarters(characterPreset = '') {
        this.clearWorld();
        this.engine.setFog(0x050a18, 10, 60);
        this.engine.setAmbientLight(0xffffff, 0.6);

        const scene = this.engine.scene;
        const objects = {};

        const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.4);

        // Open-air Courtyard Ground (36m x 36m)
        const ground = BABYLON.MeshBuilder.CreatePlane("ground", { width: 36, height: 36 }, scene);
        ground.rotation.x = Math.PI / 2;
        ground.material = wallMat;

        // Perimeter Walls (10m high)
        const backWall = BABYLON.MeshBuilder.CreateBox("backWall", { width: 36, height: 10, depth: 0.4 }, scene);
        backWall.position.set(0, 5, -18);
        backWall.material = wallMat;
        this.engine.addCollider(backWall);

        const leftWall = BABYLON.MeshBuilder.CreateBox("leftWall", { width: 0.4, height: 10, depth: 36 }, scene);
        leftWall.position.set(-18, 5, 0);
        leftWall.material = wallMat;
        this.engine.addCollider(leftWall);

        const rightWall = BABYLON.MeshBuilder.CreateBox("rightWall", { width: 0.4, height: 10, depth: 36 }, scene);
        rightWall.position.set(18, 5, 0);
        rightWall.material = wallMat;
        this.engine.addCollider(rightWall);

        // Ocean Swimming Zone (Front wall opening)
        const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
        waterMat.diffuseColor = new BABYLON.Color3(0.05, 0.25, 0.6);
        waterMat.alpha = 0.85;

        const ocean = BABYLON.MeshBuilder.CreatePlane("ocean", { width: 36, height: 30 }, scene);
        ocean.rotation.x = Math.PI / 2;
        ocean.position.set(0, -0.2, 28);
        ocean.material = waterMat;

        this.engine.addWaterZone(
            new BABYLON.Vector3(-18, -10, 16),
            new BABYLON.Vector3(18, 2, 40)
        );

        // Lighting
        this.engine.addPointLight(-8, 8, -8, 0x88ccff, 1.5, 40);
        this.engine.addPointLight(8, 8, 8, 0x88ccff, 1.5, 40);

        // Strict Preset Resident Spawning
        const p = characterPreset.toLowerCase();

        if (p === 'residentialquarters_glory' || p === 'residentialquarters_glory_jake') {
            const glory = this.createCharacterMesh(0x2a1506, 1.7, true, 'female');
            glory.position.set(3, 0, -4);
            objects.glory = glory;
        }

        if (p === 'residentialquarters_glory_jake') {
            const jake = this.createCharacterMesh(0x1a1a1a, 1.45, true, 'spiky');
            jake.position.set(-4, 0, -4);
            objects.jake = jake;
        }

        if (p === 'residentialquarters_lily' || p === 'residentialquarters_lily_james' || p === 'residentialquarters_full') {
            const lily = this.createCharacterMesh(0x3a1a08, 1.7, true, 'female');
            lily.position.set(5, 0, 2);
            objects.lily = lily;
        }

        if (p === 'residentialquarters_lily_james' || p === 'residentialquarters_full') {
            const james = this.createCharacterMesh(0xb8860b, 1.7, true, 'spiky');
            james.position.set(-5, 0, 2);
            objects.james = james;
        }

        if (p === 'residentialquarters_full') {
            const blue = this.createCharacterMesh(0x0e0e0e, 1.7, true, 'spiky');
            blue.position.set(0, 0, 4);
            objects.blue = blue;
        }

        return { objects };
    }

    buildCourtroom() {
        this.clearWorld();
        this.engine.setFog(0x221100, 5, 25);
        this.engine.setAmbientLight(0xffffff, 0.4);

        const scene = this.engine.scene;
        const objects = {};

        const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
        woodMat.diffuseColor = new BABYLON.Color3(0.35, 0.18, 0.08);

        const floor = BABYLON.MeshBuilder.CreatePlane("floor", { width: 16, height: 12 }, scene);
        floor.rotation.x = Math.PI / 2;
        floor.material = woodMat;

        const table = BABYLON.MeshBuilder.CreateBox("table", { width: 10, height: 0.8, depth: 2 }, scene);
        table.position.set(0, 0.4, -2);
        table.material = woodMat;

        const crimson = this.createCharacterMesh(0xdc143c, 1.85, false, 'spiky');
        crimson.position.set(0, 0, -3.5);
        objects.crimson = crimson;

        this.engine.addPointLight(0, 4, -2, 0xffaa44, 2.0, 20);
        return { objects };
    }

    buildInterrogationBlock() {
        this.clearWorld();
        this.engine.setFog(0x111118, 5, 25);
        this.engine.setAmbientLight(0xffffff, 0.5);

        const scene = this.engine.scene;
        const objects = {};

        const floorMat = new BABYLON.StandardMaterial("floorMat", scene);
        floorMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);

        const floor = BABYLON.MeshBuilder.CreatePlane("floor", { width: 10, height: 4 }, scene);
        floor.rotation.x = Math.PI / 2;
        floor.material = floorMat;

        this.engine.addPointLight(0, 2.5, 0, 0x99ccff, 1.5, 15);
        return { objects };
    }

    buildOcean() {
        this.clearWorld();
        this.engine.setFog(0x0a1628, 10, 80);
        this.engine.setAmbientLight(0x88bbff, 0.5);

        const scene = this.engine.scene;
        const objects = {};

        const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
        waterMat.diffuseColor = new BABYLON.Color3(0.04, 0.12, 0.28);

        const oceanPlane = BABYLON.MeshBuilder.CreatePlane("oceanPlane", { width: 500, height: 500 }, scene);
        oceanPlane.rotation.x = Math.PI / 2;
        oceanPlane.material = waterMat;

        const raftMat = new BABYLON.StandardMaterial("raftMat", scene);
        raftMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);

        const raft = BABYLON.MeshBuilder.CreateBox("raft", { width: 2.5, height: 0.3, depth: 3.5 }, scene);
        raft.position.set(0, 0.15, 0);
        raft.material = raftMat;
        objects.raft = raft;

        return { objects };
    }

    buildBeach() {
        this.clearWorld();
        this.engine.setFog(0x1a2436, 10, 80);
        this.engine.setAmbientLight(0xffddaa, 0.6);

        const scene = this.engine.scene;
        const objects = {};

        const sandMat = new BABYLON.StandardMaterial("sandMat", scene);
        sandMat.diffuseColor = new BABYLON.Color3(0.75, 0.65, 0.42);

        const ground = BABYLON.MeshBuilder.CreatePlane("ground", { width: 100, height: 100 }, scene);
        ground.rotation.x = Math.PI / 2;
        ground.material = sandMat;

        // Statue of Crimson (8m tall)
        const statueMat = new BABYLON.StandardMaterial("statueMat", scene);
        statueMat.diffuseColor = new BABYLON.Color3(0.8, 0.65, 0.2); // Bronze gold

        const pedestal = BABYLON.MeshBuilder.CreateCylinder("pedestal", { height: 2, diameter: 3 }, scene);
        pedestal.position.set(0, 1, -15);
        pedestal.material = statueMat;

        const statueBody = BABYLON.MeshBuilder.CreateCylinder("statueBody", { height: 6, diameter: 1.5 }, scene);
        statueBody.position.set(0, 5, -15);
        statueBody.material = statueMat;

        objects.statue = statueBody;
        this.engine.addPointLight(0, 8, -15, 0xffaa00, 3.0, 30);

        return { objects };
    }

    buildMuseum() {
        this.clearWorld();
        this.engine.setFog(0x332211, 10, 40);
        this.engine.setAmbientLight(0xffeeda, 0.8);

        const scene = this.engine.scene;
        const objects = {};

        const marbleMat = new BABYLON.StandardMaterial("marbleMat", scene);
        marbleMat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.9);

        const floor = BABYLON.MeshBuilder.CreatePlane("floor", { width: 20, height: 15 }, scene);
        floor.rotation.x = Math.PI / 2;
        floor.material = marbleMat;

        this.engine.addPointLight(0, 6, 0, 0xffddaa, 2.5, 30);
        return { objects };
    }
}
