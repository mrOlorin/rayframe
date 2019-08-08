AFRAME.registerComponent('q-controls', {
    schema: {
        playerHeight: {default: .8},
        playerMass: {default: 70},
        friction: {default: 100},
        groundAccelerate: {default: 20},
        maxVelocityGround: {default: 1},
        jumpAcceleration: {default: .05},
        airAccelerate: {default: 1},
        maxVelocityAir: {default: .4},
        gravity: {type: "vec3", default: new THREE.Vector3()},
        gravityConstant: {default: .02},
        yaw: {default: 0.001},
        pitch: {default: 0.001},
    },
    init: function() {
        this.adAxis = "x";
        this.wsAxis = "z";
        this.jAxis = "y";
        this.fly = false;
        this.maxDeltaTime = .004;
        this.clampVelocity = .00005;

        this.pressedKeys = {};
        this.wishWalkDir = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.thrust = new THREE.Vector3();

        this.hmdEuler = new THREE.Euler();  // Head-mounted display
        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        this.yawObject.add(this.pitchObject);
        this.worldObject = new THREE.Object3D();
        this.worldObject.add(this.yawObject);

        this.raycaster = new THREE.Raycaster();

        // Bind methods and add event listeners.
        this.onBlur = this.onBlur.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        this.attachVisibilityEventListeners();
        this.onLockChange = this.onLockChange.bind(this);
        this.onLockError = this.onLockError.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.attachRotationEventListeners();

        this.checkGround();
        this.initCollidableMeshList();
    },
    collidableMeshList: [],
    initCollidableMeshList: function() {
        const staticBodyList = this.el.sceneEl.querySelectorAll('[static-body]');
        for (const el of staticBodyList) {
            this.collidableMeshList.push(el.object3D);
        }
    },
    tick: function(time, delta) {
        this.updateOrientation();
        if (this.imprisoned) {
            return;
        }
        this.updateVelocity(delta * .0001);
        this.el.object3D.position.add(this.velocity);
        if (this.speedEl) {
            const hSpeed = this.velocity.lengthSq().toFixed(3);
            this.speedEl.setAttribute("text", {value: hSpeed});
        }
    },
    rotation: new THREE.Vector3(),
    updateOrientation: function() {
        this.rotation.x = THREE.Math.radToDeg(this.hmdEuler.x) + THREE.Math.radToDeg(this.pitchObject.rotation.x);
        this.rotation.y = THREE.Math.radToDeg(this.hmdEuler.y) + THREE.Math.radToDeg(this.yawObject.rotation.y);
        this.rotation.z = THREE.Math.radToDeg(this.hmdEuler.z);
        this.el.setAttribute('rotation', this.rotation);
    },
    checkGround: function() {
        if (this.el.object3D.position[this.jAxis] > this.data.playerHeight) {
            // Midair
            this.isWalking = false;
            return;
        }
        if (this.el.object3D.position[this.jAxis] <= this.data.playerHeight) {
            // Underground
            this.velocity[this.jAxis] = 0;
            this.el.object3D.position[this.jAxis] = this.data.playerHeight;
        }
        if (this.pressedKeys.Space) {
            // Init jump
            this.velocity[this.jAxis] = this.data.jumpAcceleration;
            this.isWalking = false;
        } else {
            this.isWalking = true;
        }
    },
    imprison: function(position) {
        this.el.object3D.position.set(position.x, position.y, position.z);
        this.velocity.set(0, 0, 0);
        this.imprisoned = true;
    },
    release: function() {
        this.imprisoned = false;
    },
    checkDelta: function(delta) {
        if (delta <= this.maxDeltaTime) {
            return true;
        }
        // Фризы живут здесь.
        this.velocity[this.adAxis] = 0;
        this.velocity[this.wsAxis] = 0;
        this.velocity[this.jAxis] = 0;
        return false;
    },
    updateVelocity: function(delta) {
        if (!(this.velocity.x || this.velocity.y || this.velocity.z || !isEmptyObject(this.pressedKeys)) && this.isWalking) {
            return;
        }
        this.checkGround();
        this.checkDelta(delta);

        this.wishWalkDir[this.adAxis] = 0;
        this.wishWalkDir[this.wsAxis] = 0;
        if (this.pressedKeys.KeyA) {
            this.wishWalkDir[this.adAxis] -= 1;
        }
        if (this.pressedKeys.KeyD) {
            this.wishWalkDir[this.adAxis] += 1;
        }
        if (this.pressedKeys.KeyW) {
            this.wishWalkDir[this.wsAxis] -= 1;
        }
        if (this.pressedKeys.KeyS) {
            this.wishWalkDir[this.wsAxis] += 1;
        }
        const wishMove = this.getMovementVector(this.wishWalkDir, delta);
        if (this.isWalking) {
            this.velocity = this.moveGround(wishMove, this.velocity.clone(), delta);
        } else {
            this.velocity = this.moveAir(wishMove, this.velocity.clone(), delta);
        }
        if (!this.isWalking) {
            this.velocity[this.jAxis] -= this.data.gravityConstant * this.data.playerMass * delta;
        }
        // Clamp velocity
        for (const axis of ["x", "y", "z"]) {
            if (Math.abs(this.velocity[axis]) < this.clampVelocity) {
                this.velocity[axis] = 0;
            }
        }
        if (!this.isWalking) {
            this.velocity.add(this.data.gravity);
        }
    },
    // https://flafla2.github.io/2015/02/14/bunnyhop.html
    moveGround: function(accelDir, prevVelocity, delta) {
        const speed = prevVelocity.length();
        if (speed) {
            const drop = speed * this.data.friction * delta;
            prevVelocity.multiplyScalar(Math.max(speed - drop, 0) / speed);
        }
        return this.accelerate(accelDir, prevVelocity, this.data.groundAccelerate, this.data.maxVelocityGround, delta);
    },
    moveAir: function(accelDir, prevVelocity, delta) {
        return this.accelerate(accelDir, prevVelocity, this.data.airAccelerate, this.data.maxVelocityAir, delta);
    },
    accelerate: function(accelDir, prevVelocity, accelerate, maxVvelocity, delta) {
        const proj = prevVelocity.dot(accelDir); // Vector projection of Current velocity onto accelDir.
        let accelVel = accelerate * delta; // Accelerated velocity in direction of movment
        // If necessary, truncate the accelerated velocity so the vector projection does not exceed maxVvelocity
        if (proj + accelVel > maxVvelocity) {
            accelVel = maxVvelocity - proj;
        }
        this.thrust = accelDir.multiplyScalar(accelVel);
        return prevVelocity.add(this.thrust);
    },
    getMovementVector: (function() {
        const directionVector = new THREE.Vector3(0, 0, 0);
        const rotationEuler = new THREE.Euler(0, 0, 0, 'YXZ');

        return function(velocity, delta) {
            const rotation = this.el.getAttribute('rotation');

            directionVector.copy(velocity);
            directionVector.multiplyScalar(delta);

            // Absolute.
            if (!rotation) {
                return directionVector;
            }
            const xRotation = this.fly ? rotation.x : 0;
            // Transform direction relative to heading.
            rotationEuler.set(THREE.Math.degToRad(xRotation), THREE.Math.degToRad(rotation.y), 0);
            directionVector.applyEuler(rotationEuler);
            return directionVector.normalize();
        };
    })(),
    remove: function() {
        this.removeKeyEventListeners();
        this.removeVisibilityEventListeners();
        this.removeRotationEventListeners();
    },
    play: function() {
        this.attachKeyEventListeners();
    },
    pause: function() {
        this.pressedKeys = {};
        this.removeKeyEventListeners();
    },
    attachVisibilityEventListeners: function() {
        window.addEventListener('blur', this.onBlur);
        window.addEventListener('focus', this.onFocus);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    },
    removeVisibilityEventListeners: function() {
        window.removeEventListener('blur', this.onBlur);
        window.removeEventListener('focus', this.onFocus);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    },
    attachRotationEventListeners: function() {
        document.addEventListener('pointerlockchange', this.onLockChange);
        document.addEventListener('pointerlockerror', this.onLockError);
        if (!this.el.sceneEl.canvas) { // Wait for canvas to load.
            this.el.sceneEl.addEventListener('render-target-loaded', this.addEventListeners);
            return
        }
        this.el.sceneEl.canvas.onclick = function requestPointerLock(event) {
            event.target.requestPointerLock();
        }
    },
    removeRotationEventListeners: function() {
        document.removeEventListener('pointerlockchange', this.onLockChange);
        document.removeEventListener('pointerlockerror', this.onLockError);
    },
    attachKeyEventListeners: function() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    },
    removeKeyEventListeners: function() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    },
    onBlur: function() {
        this.pause();
    },
    onFocus: function() {
        this.play();
    },
    onVisibilityChange: function() {
        if (document.hidden) {
            this.onBlur();
        } else {
            this.onFocus();
        }
    },
    isPointerLockedTo: function(el) {
        const POINTER_LOCK_ELEMENTS = ['pointerLockElement', 'mozPointerLockElement', 'webkitPointerLockElement'];
        return POINTER_LOCK_ELEMENTS.some(function(key) {
            return document[key] === el;
        });
    },
    onLockChange: function() {
        if (this.isPointerLockedTo(this.el.sceneEl.canvas)) {
            document.addEventListener('mousemove', this.onMouseMove, false);
        } else {
            document.removeEventListener('mousemove', this.onMouseMove, false);
        }
    },
    onLockError: function(event) {
        console.trace(event);
    },
    halfPI: Math.PI / 2,
    onMouseMove: function(event) {
        this.yawObject.rotation.y -= event.movementX * this.data.yaw;
        this.pitchObject.rotation.x -= event.movementY * this.data.pitch;
        this.pitchObject.rotation.x = Math.max(-this.halfPI, Math.min(this.halfPI, this.pitchObject.rotation.x));
    },
    onKeyDown: function(event) {
        if (!AFRAME.utils.shouldCaptureKeyEvent(event)) {
            return;
        }
        const keysToCapture = [
            'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
        ];
        if (keysToCapture.indexOf(event.code) !== -1) {
            this.pressedKeys[event.code] = true;
        }
    },
    onKeyUp: function(event) {
        delete this.pressedKeys[event.code];
    },
});

function isEmptyObject(keys) {
    for (let key in keys) return false;
    return true;
}
