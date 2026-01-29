// CONFIGURATION
const IMAGE_URL = 'image.jpg';  // Your photo filename
const PARTICLE_SIZE = 2.0;      // Size of the dots
const HEART_COLOR = new THREE.Color('#ff0033'); // Deep Red Heart

// SCENE SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('heart'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimizes for phones

// LIGHTING (Simple ambient light)
scene.add(new THREE.AmbientLight(0xffffff, 1));

// GROUPS
const group = new THREE.Group();
scene.add(group);

// VARIABLES
let particles;
let geometry;
let material;
let isHeart = true; // Starts as a heart

// LOAD IMAGE & CREATE PARTICLES
const img = new Image();
img.src = IMAGE_URL;
img.crossOrigin = "Anonymous";

img.onload = () => {
    // 1. Draw image to a hidden canvas to read colors
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // We scale the image to a grid (e.g., 120x120 dots)
    // This keeps the particle count reasonable for phones (~14k particles)
    const width = 120;
    const height = 120; // You can adjust aspect ratio here if needed
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data; // The RGBA pixel data

    const positions = [];
    const colors = [];
    const targetPositions = []; // Where they go to form the photo

    // 2. Loop through pixels
    for (let i = 0; i < width * height; i++) {
        // Get Color from Photo
        const r = data[i * 4] / 255;
        const g = data[i * 4 + 1] / 255;
        const b = data[i * 4 + 2] / 255;
        const alpha = data[i * 4 + 3];

        if (alpha < 20) continue; // Skip transparent pixels

        // --- TARGET POSITION (The Photo Grid) ---
        // Center the grid
        const tx = (i % width) - width / 2;
        const ty = -(Math.floor(i / width) - height / 2); // Flip Y for image
        const tz = 0;
        targetPositions.push(tx * 0.5, ty * 0.5, tz); // Scale down slightly

        // --- CURRENT POSITION (The Heart Shape) ---
        // Using Parametric Heart Equation
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        // Random scatter inside a heart volume
        // We use a math trick to make them look like a heart instantly
        const t = Math.random() * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        const hz = (Math.random() - 0.5) * 4; // Thickness
        
        // Scale the heart to match the image size roughly
        const scale = 1.5; 
        positions.push(hx * scale, hy * scale, hz * scale);

        // Store the Photo Color
        colors.push(r, g, b);
    }

    // 3. Create Geometry
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('target', new THREE.Float32BufferAttribute(targetPositions, 3));
    geometry.setAttribute('pColor', new THREE.Float32BufferAttribute(colors, 3)); // Photo colors

    // 4. Create Shader Material
    material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uMorph: { value: 0 }, // 0 = Heart, 1 = Photo
            uHeartColor: { value: HEART_COLOR }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uMorph;
            attribute vec3 target;
            attribute vec3 pColor;
            varying vec3 vColor;

            void main() {
                // Morph Position
                vec3 finalPos = mix(position, target, uMorph);

                // Add Noise/Wiggle based on time
                float noise = sin(uTime * 5.0 + position.x) * 0.1;
                if (uMorph < 0.1) {
                    // Heartbeat effect
                    float beat = 1.0 + sin(uTime * 3.0) * 0.05;
                    finalPos *= beat;
                }
                
                vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                gl_PointSize = ${PARTICLE_SIZE.toFixed(1)} * (50.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;

                // Color Mixing: Heart Red -> Photo Color
                // We access the global uniform uHeartColor for the heart state
                // and the attribute pColor for the image state
                // But we need to pass uHeartColor from JS
            }
        `,
        // We will do color mixing in Fragment shader for better look, 
        // but passing attributes is easier in vertex. 
        // Let's simplify:
        vertexShader: `
            uniform float uTime;
            uniform float uMorph;
            uniform vec3 uHeartColor;
            attribute vec3 target;
            attribute vec3 pColor;
            varying vec3 vColor;

            void main() {
                vec3 pos = position;
                vec3 trg = target;
                
                // Mix Positions
                vec3 finalPos = mix(pos, trg, uMorph);
                
                // Heartbeat
                if (uMorph < 0.5) {
                    float beat = 1.0 + sin(uTime * 4.0) * 0.03;
                    finalPos *= beat;
                }

                vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                gl_PointSize = ${PARTICLE_SIZE.toFixed(1)} * (60.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;

                // Mix Colors
                vColor = mix(uHeartColor, pColor, uMorph);
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                // Circular particle
                if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
                gl_FragColor = vec4(vColor, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false
    });

    particles = new THREE.Points(geometry, material);
    group.add(particles);

    // Center Camera
    camera.position.z = 60;
};

// ANIMATION LOOP
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (material) {
        material.uniforms.uTime.value = time;
        
        // Gentle rotation
        if (isHeart) {
           group.rotation.y = Math.sin(time * 0.5) * 0.2;
        } else {
           // When it's a photo, stop rotating so she can see it clearly
           group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, 0, 0.05); 
        }
    }
    renderer.render(scene, camera);
}
animate();

// INTERACTION
const startButton = document.getElementById('startButton');
const overlay = document.getElementById('overlay');
const music = document.getElementById('music');

// 1. Enter Site
startButton.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 1000);
    music.play().catch(e => console.log("Music blocked"));
});

// 2. Toggle Heart/Photo
window.addEventListener('click', (event) => {
    if (event.target === startButton) return; // Ignore start button clicks
    if (overlay.style.display !== 'none') return; // Ignore if overlay is up

    isHeart = !isHeart;
    
    // Animate the Morph Value
    gsap.to(material.uniforms.uMorph, {
        value: isHeart ? 0 : 1,
        duration: 1.5,
        ease: "power2.inOut"
    });
});

// RESIZE HANDLER
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
