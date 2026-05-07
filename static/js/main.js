import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

window.addEventListener('error', (e) => {
    const notice = document.getElementById('connection-notice-text');
    if (notice) notice.textContent = 'JS Error: ' + e.message;
});

// Global App State
let isPinching = false;
let handStateActive = false;
let sysPower = true;
let alarmActive = false;
let conveyorSpeed = 50;
let isDraggingSlider = false;

// Initialization Flags
let cameraReady = false;
let modelReady = false;

// Cursor Smoothing 
let targetCursorX = window.innerWidth / 2;
let targetCursorY = window.innerHeight / 2;
let currentCursorX = window.innerWidth / 2;
let currentCursorY = window.innerHeight / 2;

// DOM Element References
const video = document.getElementById('camera-feed');
const cursorEl = document.getElementById('virtual-cursor');
const cursorInner = document.getElementById('cursor-inner');
const connectionNotice = document.getElementById('connection-notice');

const statusModel = document.getElementById('status-model');
const textModel = document.getElementById('text-model');
const statusCamera = document.getElementById('status-camera');
const textCamera = document.getElementById('text-camera');
const statusTracking = document.getElementById('status-tracking');
const textTracking = document.getElementById('text-tracking');

const powerBtn = document.getElementById('power-btn');
const powerStatusText = document.getElementById('power-status-text');

const alarmPanel = document.getElementById('alarm-panel');
const alarmIcon = document.getElementById('alarm-icon');
const simulateErrorBtn = document.getElementById('simulate-error-btn');
const alarmBtn = document.getElementById('alarm-btn');

const sliderTrack = document.getElementById('slider-track');
const sliderFill = document.getElementById('slider-fill');
const sliderThumb = document.getElementById('slider-thumb');
const speedText = document.getElementById('speed-text');
const startCameraBtn = document.getElementById('start-camera-btn');
const connectionNoticeTitle = document.getElementById('connection-notice-title');
const connectionNoticeText = document.getElementById('connection-notice-text');

// Mediapipe Initialization
let handLandmarker;
let lastVideoTime = -1;

async function initializeHandTracking() {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        
        statusModel.className = "w-2 h-2 rounded-full glow-cyan bg-cyan-400";
        textModel.textContent = "Vision Model: Loaded";
        modelReady = true;
        
        if (cameraReady) {
            if (connectionNoticeText) connectionNoticeText.textContent = "Position hand in camera view to begin tracking";
            predictWebcam();
        }
    } catch(err) {
        console.error("Failed to load MediaPipe model:", err);
    }
}

async function enableCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (connectionNoticeTitle) connectionNoticeTitle.textContent = "Camera API Missing";
        if (connectionNoticeText) connectionNoticeText.textContent = "Please ensure the site is loaded over HTTPS (secure).";
        console.error("navigator.mediaDevices is undefined.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: "user"
            } 
        });
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
            video.play().catch(e => console.error("Play error:", e));
            statusCamera.className = "w-2 h-2 rounded-full glow-cyan bg-cyan-400";
            textCamera.textContent = "Camera: Active";
            cameraReady = true;
            
            if (startCameraBtn) startCameraBtn.style.display = "none";
            if (connectionNoticeTitle) connectionNoticeTitle.textContent = "System Ready";
            
            if (!modelReady) {
                if (connectionNoticeText) connectionNoticeText.textContent = "Waiting for Vision Model (Downloading...)";
            } else {
                if (connectionNoticeText) connectionNoticeText.textContent = "Position hand in camera view to begin tracking";
                predictWebcam();
            }
        });
    } catch(err) {
        console.error("Camera access denied or unavilable:", err);
        if (connectionNoticeTitle) connectionNoticeTitle.textContent = "Camera Blocked";
        if (connectionNoticeText) connectionNoticeText.textContent = "Please allow camera access in your browser via the URL bar icon";
        if (startCameraBtn) {
            startCameraBtn.style.display = "block";
            startCameraBtn.textContent = "Retry Camera Connection";
            startCameraBtn.disabled = false;
            startCameraBtn.className = "mt-6 px-6 py-3 glass hover:bg-sky-900/50 text-cyan-400 text-xs font-bold uppercase tracking-widest border border-cyan-400/30 rounded transition-colors cursor-pointer pointer-events-auto";
        }
    }
}

if (startCameraBtn) {
    startCameraBtn.addEventListener('click', () => {
        startCameraBtn.textContent = "Requesting Access...";
        enableCamera();
    });
}

// Main Prediction Loop
async function predictWebcam() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
            const results = handLandmarker.detectForVideo(video, performance.now());
            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                
                // Get coordinates for Index Finger Tip (8) and Thumb Tip (4)
                const indexFinger = landmarks[8];
                const thumbTip = landmarks[4];
                
                // Mirror the X coordinate so it moves naturally
                targetCursorX = (1 - indexFinger.x) * window.innerWidth;
                targetCursorY = indexFinger.y * window.innerHeight;
                
                // Calculate distance between thumb and index for pinch detection
                const dist = Math.sqrt(
                    Math.pow(indexFinger.x - thumbTip.x, 2) + 
                    Math.pow(indexFinger.y - thumbTip.y, 2)
                );
                
                const pinchingNow = dist < 0.05; // Pinch threshold
                if(pinchingNow !== isPinching) {
                    isPinching = pinchingNow;
                    handlePinchChange(isPinching);
                }
                
                if (!handStateActive) {
                    handStateActive = true;
                    statusTracking.className = "w-2 h-2 rounded-full glow-cyan bg-cyan-400";
                    textTracking.textContent = "Tracking: Active";
                    connectionNotice.style.opacity = '0';
                    setTimeout(() => connectionNotice.style.display = 'none', 300);
                    cursorEl.style.opacity = '1';
                }
                
            } else {
                if(handStateActive) {
                    handStateActive = false;
                    statusTracking.className = "w-2 h-2 rounded-full glow-cyan bg-sky-900";
                    textTracking.textContent = "Tracking: Waiting...";
                    connectionNotice.style.display = 'flex';
                    setTimeout(() => connectionNotice.style.opacity = '1', 10);
                    cursorEl.style.opacity = '0';
                    if (isDraggingSlider) {
                        isDraggingSlider = false;
                        updateSliderStyles();
                    }
                }
            }
        } catch (e) {
            // Processing frame exception
        }
    }
    window.requestAnimationFrame(predictWebcam);
}

// Render Loop for UI Updates
function updateUI() {
    // Apply lerp smoothing to cursor movements to avoid jitter
    currentCursorX += (targetCursorX - currentCursorX) * 0.4;
    currentCursorY += (targetCursorY - currentCursorY) * 0.4;
    
    cursorEl.style.left = `${currentCursorX}px`;
    cursorEl.style.top = `${currentCursorY}px`;
    
    // Drag slider logic update
    if (isDraggingSlider) {
        const rect = sliderTrack.getBoundingClientRect();
        let percentage = ((currentCursorX - rect.left) / rect.width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        conveyorSpeed = Math.round(percentage);
        
        sliderFill.style.width = `${conveyorSpeed}%`;
        sliderThumb.style.left = `calc(${conveyorSpeed}% - 20px)`;
        speedText.innerHTML = `${conveyorSpeed.toString().padStart(3, '0')} <span class="text-lg text-sky-600 uppercase">RPM</span>`;
    }
    
    requestAnimationFrame(updateUI);
}

// Mouse Interactions mapped to Pinch
function handlePinchChange(pinching) {
    cursorInner.className = pinching 
        ? "w-full h-full rounded-full border-2 absolute transition-all duration-150 bg-white border-white scale-75 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
        : "w-full h-full rounded-full border-2 absolute transition-all duration-150 bg-white/40 border-white scale-100 shadow-[0_0_10px_rgba(255,255,255,0.4)]";
        
    if (pinching) {
        // Temporarily hide cursor to find the DOM element directly beneath it
        cursorEl.style.display = 'none'; 
        const elementUnderCursor = document.elementFromPoint(currentCursorX, currentCursorY);
        cursorEl.style.display = 'block';
        
        if (elementUnderCursor) {
            const btn = elementUnderCursor.closest('button');
            const track = elementUnderCursor.closest('#slider-track');
            const thumb = elementUnderCursor.closest('#slider-thumb');
            
            if (btn && btn.id === 'power-btn') {
                togglePower();
            } else if (btn && btn.id === 'simulate-error-btn') {
                triggerAlarm(true);
            } else if (btn && btn.id === 'alarm-btn') {
                triggerAlarm(false);
            } else if (track || thumb) {
                isDraggingSlider = true;
                updateSliderStyles();
            }
        }
    } else {
        if (isDraggingSlider) {
            isDraggingSlider = false;
            updateSliderStyles();
        }
    }
}

// App Logic Functions
function togglePower() {
    sysPower = !sysPower;
    
    powerBtn.className = sysPower 
        ? "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 outline-none glass text-cyan-400 border-2 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
        : "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 outline-none bg-black/50 text-sky-900 border-2 border-sky-900";
        
    powerStatusText.textContent = sysPower ? "ONLINE" : "OFFLINE";
    powerStatusText.className = `mt-6 font-mono text-xl tracking-wider font-bold ${sysPower ? 'text-cyan-400' : 'text-sky-900'}`;
    
    updateSliderStyles();
}

function triggerAlarm(active) {
    alarmActive = active;
    
    alarmPanel.className = alarmActive 
        ? "glass rounded-xl p-8 flex flex-col items-center justify-center transition-colors duration-500 relative overflow-hidden border border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
        : "glass rounded-xl p-8 flex flex-col items-center justify-center transition-colors duration-500 relative overflow-hidden border border-sky-500/20 text-sky-400";
        
    alarmIcon.className = alarmActive
        ? "w-24 h-24 mb-6 transition-all animate-[pulse_0.5s_ease-in-out_infinite] drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]"
        : "w-24 h-24 mb-6 transition-all opacity-20";
        
    simulateErrorBtn.style.display = alarmActive ? 'none' : 'block';
    alarmBtn.style.display = alarmActive ? 'block' : 'none';
}

function updateSliderStyles() {
    sliderFill.style.transitionDuration = isDraggingSlider ? '0ms' : '150ms';
    sliderThumb.style.transitionDuration = isDraggingSlider ? '0ms' : '150ms';
    
    const fillBg = sysPower ? "bg-cyan-400 glow-cyan" : "bg-sky-950";
    sliderFill.className = `absolute top-0 left-0 h-full transition-all ease-out pointer-events-none ${fillBg}`;
    
    let thumbClass = "absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-black/80 rounded-full shadow-lg border-2 transition-all pointer-events-none ";
    thumbClass += isDraggingSlider ? "scale-110 border-cyan-400 glow-cyan" : "border-cyan-600";
    if(!sysPower) thumbClass += " opacity-50";
    sliderThumb.className = thumbClass;
}

// Start Program
initializeHandTracking();
updateUI();
