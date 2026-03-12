import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const stage = document.getElementById('stage');
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
document.getElementById('year').textContent = new Date().getFullYear();

/* ✅ Declarar teardown ANTES de usarlo */
let teardown = null;

/* ---------- Router ---------- */
function route() {
  const hash = location.hash.replace('#', '') || 'minecraft';

  // nav activo (si aún usas links clásicos)
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + hash);
  });

  // 👉 sincroniza radios
  syncRadios(hash);

  // ✅ limpiar demo anterior si existe
  if (typeof teardown === 'function') {
    try { teardown(); } catch (e) { console.warn('teardown error:', e); }
    teardown = null;
  }

  // limpiar contenedor y overlay
  stage.innerHTML = '';
  blocker.classList.add('d-none');

  // cargar demo
  if (hash === 'minecraft')      teardown = runMinecraft();
  else if (hash === 'map')       teardown = runMap();
  else if (hash === 'orbit')     teardown = runOrbit();
  else if (hash === 'pointer')   teardown = runPointerLock();
  else                           teardown = runMinecraft();
}

/* Registrar eventos DESPUÉS de declarar todo */
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
// Hotkeys 1–4 para navegar entre demos aun con pointer lock activo
document.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') location.hash = 'minecraft';
  else if (e.code === 'Digit2') location.hash = 'map';
  else if (e.code === 'Digit3') location.hash = 'orbit';
  else if (e.code === 'Digit4') location.hash = 'pointer';
});


// === Sincronizar radios con router ===
const navRadios = document.querySelectorAll('.radio-inputs input[name="demo"]');

// Cambiar hash cuando el usuario elige un radio
navRadios.forEach(r =>
  r.addEventListener('change', () => { 
    if (r.checked) location.hash = r.value; 
  })
);

// Marca el radio correspondiente al entrar/cambiar hash
function syncRadios(hash) {
  const val = hash || (location.hash.replace('#','') || 'minecraft');
  navRadios.forEach(r => r.checked = (r.value === val));
}


/* =======================================================================
   DEMO 1: MINECRAFT
   ======================================================================= */
function runMinecraft() { return (() => {
  let container, stats;
  let camera, controls, scene, renderer;

  const worldWidth = 128, worldDepth = 128;
  const worldHalfWidth = worldWidth / 2;
  const worldHalfDepth = worldDepth / 2;
  const data = generateHeight(worldWidth, worldDepth);

  const clock = new THREE.Clock();

  init();

  function init() {
    // FIX: usar #container si existe; si no, usa #stage
    container = document.getElementById('container') || stage; // FIX

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 20000);
    camera.position.y = getY(worldHalfWidth, worldHalfDepth) * 100 + 100;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    const matrix = new THREE.Matrix4();

    const pxGeometry = new THREE.PlaneGeometry(100, 100);
    pxGeometry.attributes.uv.array[1] = 0.5;
    pxGeometry.attributes.uv.array[3] = 0.5;
    pxGeometry.rotateY(Math.PI / 2);
    pxGeometry.translate(50, 0, 0);

    const nxGeometry = new THREE.PlaneGeometry(100, 100);
    nxGeometry.attributes.uv.array[1] = 0.5;
    nxGeometry.attributes.uv.array[3] = 0.5;
    nxGeometry.rotateY(-Math.PI / 2);
    nxGeometry.translate(-50, 0, 0);

    const pyGeometry = new THREE.PlaneGeometry(100, 100);
    pyGeometry.attributes.uv.array[5] = 0.5;
    pyGeometry.attributes.uv.array[7] = 0.5;
    pyGeometry.rotateX(-Math.PI / 2);
    pyGeometry.translate(0, 50, 0);

    const pzGeometry = new THREE.PlaneGeometry(100, 100);
    pzGeometry.attributes.uv.array[1] = 0.5;
    pzGeometry.attributes.uv.array[3] = 0.5;
    pzGeometry.translate(0, 0, 50);

    const nzGeometry = new THREE.PlaneGeometry(100, 100);
    nzGeometry.attributes.uv.array[1] = 0.5;
    nzGeometry.attributes.uv.array[3] = 0.5;
    nzGeometry.rotateY(Math.PI);
    nzGeometry.translate(0, 0, -50);

    const geometries = [];

    for (let z = 0; z < worldDepth; z++) {
      for (let x = 0; x < worldWidth; x++) {
        const h = getY(x, z);

        matrix.makeTranslation(
          x * 100 - worldHalfWidth * 100,
          h * 100,
          z * 100 - worldHalfDepth * 100
        );

        const px = getY(x + 1, z);
        const nx = getY(x - 1, z);
        const pz = getY(x, z + 1);
        const nz = getY(x, z - 1);

        geometries.push(pyGeometry.clone().applyMatrix4(matrix));

        if ((px !== h && px !== h + 1) || x === 0) geometries.push(pxGeometry.clone().applyMatrix4(matrix));
        if ((nx !== h && nx !== h + 1) || x === worldWidth - 1) geometries.push(nxGeometry.clone().applyMatrix4(matrix));
        if ((pz !== h && pz !== h + 1) || z === worldDepth - 1) geometries.push(pzGeometry.clone().applyMatrix4(matrix));
        if ((nz !== h && nz !== h + 1) || z === 0) geometries.push(nzGeometry.clone().applyMatrix4(matrix));
      }
    }

    const geometry = BufferGeometryUtils.mergeGeometries(geometries);
    geometry.computeBoundingSphere();

    const texture = new THREE.TextureLoader().load('textures/dirt.png');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide })
    );
    scene.add(mesh);

    scene.add(new THREE.AmbientLight(0xeeeeee, 3));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 12);
    directionalLight.position.set(1, 1, 0.5).normalize();
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    controls = new FirstPersonControls(camera, renderer.domElement);
    controls.movementSpeed = 1000;
    controls.lookSpeed = 0.125;
    controls.lookVertical = true;

    stats = new Stats();
    container.appendChild(stats.dom);

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    camera.aspect = (stage.clientWidth || window.innerWidth) / (stage.clientHeight || window.innerHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight);
    controls.handleResize();
  }

  function generateHeight(width, height) {
    const data = [], perlin = new ImprovedNoise(),
      size = width * height, z = Math.random() * 100;

    let quality = 2;

    for (let j = 0; j < 4; j++) {
      if (j === 0) for (let i = 0; i < size; i++) data[i] = 0;

      for (let i = 0; i < size; i++) {
        const x = i % width, y = (i / width) | 0;
        data[i] += perlin.noise(x / quality, y / quality, z) * quality;
      }
      quality *= 4;
    }
    return data;
  }

  function getY(x, z) { return (data[x + z * worldWidth] * 0.15) | 0; }

  function animate() { render(); stats.update(); }

  function render() { controls.update(clock.getDelta()); renderer.render(scene, camera); }

  return () => {  // teardown
    window.removeEventListener('resize', onWindowResize);
    renderer.setAnimationLoop(null);
    controls?.dispose?.();
    renderer?.dispose?.();
    stats?.dom?.remove?.();
    stage.innerHTML = '';
  };
})(); }

/* =======================================================================
   DEMO 2: MAP CONTROLS
   ======================================================================= */
function runMap() { return (() => {

  let camera, controls, scene, renderer, gui;

  init();

  function init() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setAnimationLoop(animate);
    stage.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(
      60,
      stage.clientWidth / stage.clientHeight,
      1,
      1000
    );

    camera.position.set(0, 200, -400);

    controls = new MapControls(camera, renderer.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    /* ===== Geometría de los edificios ===== */

    const geometry = new THREE.BoxGeometry();
    geometry.translate(0, 0.5, 0);

    /* ===== Colores permitidos ===== */

    const colors = [
      0x0000ff, // azul
      0x00ff00, // verde
      0x8000ff  // morado
    ];

    /* ===== Crear edificios ===== */

    for (let i = 0; i < 500; i++) {

      const material = new THREE.MeshPhongMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        flatShading: true
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.x = Math.random() * 1600 - 800;
      mesh.position.y = 0;
      mesh.position.z = Math.random() * 1600 - 800;

      mesh.scale.x = 20;
      mesh.scale.y = Math.random() * 80 + 10;
      mesh.scale.z = 20;

      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;

      scene.add(mesh);
    }

    /* ===== Iluminación ===== */

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
    dirLight2.position.set(-1, -1, -1);
    scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);

    window.addEventListener('resize', onWindowResize);

    /* ===== Panel de control ===== */

    gui = new GUI();
    gui.add(controls, 'zoomToCursor');
    gui.add(controls, 'screenSpacePanning');

  }

  function onWindowResize() {

    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);

  }

  function animate() {

    controls.update();
    render();

  }

  function render() {

    renderer.render(scene, camera);

  }

  /* ===== Limpiar escena al cambiar demo ===== */

  return () => {

    window.removeEventListener('resize', onWindowResize);

    renderer.setAnimationLoop(null);

    controls?.dispose?.();
    gui?.destroy?.();
    renderer?.dispose?.();

    stage.innerHTML = '';

  };

})(); }

/* =======================================================================
   DEMO 3: ORBIT CONTROLS
   ======================================================================= */
function runOrbit() { return (() => {

  let camera, controls, scene, renderer;

  init();

  function init() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setAnimationLoop(animate);
    stage.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(
      60,
      stage.clientWidth / stage.clientHeight,
      1,
      1000
    );

    camera.position.set(400, 200, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    /* ===== Geometría (Dodecaedro) ===== */

    const geometry = new THREE.DodecahedronGeometry(20);

    /* ===== Colores permitidos ===== */

    const colors = [
      0x8000ff, // morado
      0x0000ff, // azul
      0x00ff00  // verde
    ];

    /* ===== Crear objetos ===== */

    for (let i = 0; i < 500; i++) {

      const material = new THREE.MeshPhongMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        flatShading: true
      });

      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.x = Math.random() * 1600 - 800;
      mesh.position.y = 0;
      mesh.position.z = Math.random() * 1600 - 800;

      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;

      scene.add(mesh);
    }

    /* ===== Iluminación ===== */

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
    dirLight2.position.set(-1, -1, -1);
    scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {

    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);

  }

  function animate() {

    controls.update();
    render();

  }

  function render() {

    renderer.render(scene, camera);

  }

  return () => {

    window.removeEventListener('resize', onWindowResize);
    renderer.setAnimationLoop(null);
    controls?.dispose?.();
    renderer?.dispose?.();
    stage.innerHTML = '';

  };

})(); }

/* =======================================================================
   DEMO 4: POINTER LOCK
   ======================================================================= */
function runPointerLock() { return (() => {
  let camera, scene, renderer, controls;
  const objects = [];

  let raycaster;
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;
  let canJump = false;

  let prevTime = performance.now();
  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const color = new THREE.Color();

  init();

  function init() {
    blocker.classList.remove('d-none'); // mostrar overlay

    camera = new THREE.PerspectiveCamera(75, stage.clientWidth / stage.clientHeight, 1, 1000);
    camera.position.y = 10;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00FFFF);
    scene.fog = new THREE.Fog(0xffffff, 0, 750);

    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 2.5);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);

    controls = new PointerLockControls(camera, stage);
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => blocker.classList.add('d-none'));
    controls.addEventListener('unlock', () => blocker.classList.remove('d-none'));
    scene.add(controls.object);

    const onKeyDown = function (event) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'Space':
          if (canJump === true) velocity.y += 350;
          canJump = false;
          break;
      }
    };

    const onKeyUp = function (event) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

    // floor
    let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    let position = floorGeometry.attributes.position;
    for (let i = 0, l = position.count; i < l; i++) {
      vertex.fromBufferAttribute(position, i);
      vertex.x += Math.random() * 20 - 10;
      vertex.y += Math.random() * 2;
      vertex.z += Math.random() * 20 - 10;
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    floorGeometry = floorGeometry.toNonIndexed();
    position = floorGeometry.attributes.position;
    const colorsFloor = [];

    for (let i = 0, l = position.count; i < l; i++) {
      color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
      colorsFloor.push(color.r, color.g, color.b);
    }

    floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsFloor, 3));
    const floorMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    scene.add(floor);

    // objects
    const boxGeometry = new THREE.BoxGeometry(20, 20, 20).toNonIndexed();
    position = boxGeometry.attributes.position;
    const colorsBox = [];

    for (let i = 0, l = position.count; i < l; i++) {
      color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
      colorsBox.push(color.r, color.g, color.b);
    }

    // FIX: atributo de color es vec3, no vec4
    boxGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsBox, 3)); // FIX

    for (let i = 0; i < 500; i++) {
      const boxMaterial = new THREE.MeshPhongMaterial({ specular: 0xffffff, flatShading: true, vertexColors: true });
      boxMaterial.color.setHSL(Math.random() * 0.6 + 0.7, 1, Math.random() * 0.5 + 0.5, THREE.SRGBColorSpace);

      const box = new THREE.Mesh(boxGeometry, boxMaterial);
      box.position.x = Math.floor(Math.random() * 20 - 10) * 20;
      box.position.y = Math.floor(Math.random() * 20) * 20 + 10;
      box.position.z = Math.floor(Math.random() * 20 - 10) * 20;

      scene.add(box);
      objects.push(box);
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setAnimationLoop(animate);
    stage.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight);
  }

  function animate() {
    const time = performance.now();

    if (controls.isLocked === true) {
      raycaster.ray.origin.copy(controls.object.position);
      raycaster.ray.origin.y -= 10;

      const intersections = raycaster.intersectObjects(objects, false);
      const onObject = intersections.length > 0;

      const delta = (time - prevTime) / 1000;

      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      velocity.y -= 9.8 * 100.0 * delta; // gravedad

      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();

      if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

      if (onObject === true) { velocity.y = Math.max(0, velocity.y); canJump = true; }

      controls.moveRight(-velocity.x * delta);
      controls.moveForward(-velocity.z * delta);

      controls.object.position.y += (velocity.y * delta);

      if (controls.object.position.y < 10) {
        velocity.y = 0;
        controls.object.position.y = 10;
        canJump = true;
      }
    }

    prevTime = time;
    renderer.render(scene, camera);
  }

  return () => {
  // ✅ salir del pointer lock al cambiar demo
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (_) {}
  }

  window.removeEventListener('resize', onWindowResize);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  renderer.setAnimationLoop(null);
  controls?.dispose?.();
  renderer?.dispose?.();
  blocker.classList.add('d-none');
  stage.innerHTML = '';
};

})(); }
