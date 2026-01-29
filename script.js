// Configuration
const PARTICLE_COUNT = 15000; // Number of dots (lower if phone lags)
const HEART_COLOR = 0xff3366; // Red/Pink
const IMAGE_WIDTH = 100;      // Size of the photo in 3D space
const IMAGE_HEIGHT = 100;

// Setup Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('heart'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // Sharp on phones

// Load the Image
const textureLoader = new THREE.TextureLoader();
// We will use a placeholder logic first, then map the image colors later if you want advanced effects.
// For now, we focus on the SHAPE.

// Create Particles
const geometry = new THREE.BufferGeometry();
const positions = [];
const targetPositions = []; // Where particles go (the photo)
const speeds = [];

// 1. Generate Heart Shape (Math!)
for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Random point in a heart volume
    const x = Math.random() * 2 - 1; 
    const y = Math.random() * 2 - 1; 
    const z = Math.random() * 2 - 1;
    
    // Heart Formula
    // We reject points that fall outside the heart shape
    // A simple approximate distribution for a 3D heart
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const r = 10 * (Math.sin(theta) * Math.sin(phi)); // Simplified spread
    
    // Let's use a specific parametric heart curve for better shape
    const t = Math.random() * Math.PI * 2;
    const u = Math.random() * Math.PI * 2;
    
    // Heart Parametric Equations
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    const hz = Math.cos(u) * 4; // Add depth
    
    // Scale down
    positions.push(hx * 0.5 + (Math.random()-0.5), hy * 0.5 + (Math.random()-0.5), hz + (Math.random()-0.5));
    
    // Target Position (The Square Photo Frame)
    // We arrange them in a grid
    const gridX = (i % 200) - 100; // Spread width
    const gridY = Math.floor(i / 200) - 35; // Spread height
    targetPositions.push(gridX * 0.4, gridY * 0.4, 0); // Flat plane
    
    speeds.push(Math.random());
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute('target', new THREE.Float32BufferAttribute(targetPositions, 3));

// Shader Material (Makes it performant)
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 }, // 0 = Heart, 1 = Photo
        color: { value: new THREE.Color(HEART_COLOR) }
    },
    vertexShader: `
        uniform float uTime;
        uniform float uMorph;
        attribute vec3 target;
        varying float vAlpha;
        
        void main() {
            // Mix between heart position and photo position
            vec3 finalPos = mix(position, target, uMorph);
            
            // Add a "Heartbeat" pulse effect when in Heart mode
            if (uMorph < 0.5) {
                float beat = sin(uTime * 3.0) * 0.2 + 1.0;
                finalPos *= beat;
            }

            vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
            gl_PointSize = 2.0 * (300.0 / -mvPosition.z); // Scale by distance
            gl_Position = projectionMatrix * mvPosition;
            
            vAlpha = 1.0 - uMorph * 0.5; // Slight fade change
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        
        void main() {
            // Circle shape for particle
            float r = distance(gl_PointCoord, vec2(0.5, 0.5));
            if (r > 0.5) discard;
            
            gl_FragColor = vec4(color, vAlpha);
        }
    `,
    transparent: true
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

camera.position.z = 30;

// Animation Logic
let isHeart = true;
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    material.uniforms.uTime.value = time;
    
    // Slowly rotate the heart
    if(isHeart) {
        particles.rotation.y = Math.sin(time * 0.5) * 0.2;
    }

    renderer.render(scene, camera);
}
animate();

// Interactions
const startButton = document.getElementById('startButton');
const overlay = document.getElementById('overlay');
const music = document.getElementById('music');

// Start Button Click
startButton.addEventListener('click', () => {
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 1000);
    music.play();
});

// Click/Tap on Heart
window.addEventListener('click', () => {
    // If overlay is gone, toggle the shape
    if(overlay.style.display === 'none') {
        isHeart = !isHeart;
        
        // Use GSAP to animate the morph smoothly
        gsap.to(material.uniforms.uMorph, {
            value: isHeart ? 0 : 1,
            duration: 2, // 2 seconds to transform
            ease: "power2.inOut"
        });

        // Rotate camera back to center if going to photo
        if(!isHeart) {
            gsap.to(particles.rotation, { x: 0, y: 0, z: 0, duration: 2 });
        }
    }
});

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
