// Os dados da única faixa do player ficam centralizados aqui.
const permanentTrack = {
  title: "A Primeira Vez Que Eu Te Vi",
  artist: "Gm$",
  src: "assets/audio/musica.mp3",
};

const audio = document.querySelector("#audio");
const playButton = document.querySelector("#playButton");
const progress = document.querySelector("#progress");
const currentTime = document.querySelector("#currentTime");
const duration = document.querySelector("#duration");
const trackTitle = document.querySelector("#trackTitle");
const trackArtist = document.querySelector("#trackArtist");
const trackPosition = document.querySelector("#trackPosition");
const player = document.querySelector(".player-shell");
const playerStage = document.querySelector(".player-stage");
const visualizer = document.querySelector("#audioVisualizer");
const visualizerContext = visualizer.getContext("2d");

const activeTrack = permanentTrack;
let audioContext;
let analyser;
let frequencyData;
let mediaSource;
let visualizerFrame;

function resizeVisualizer() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = visualizer.clientWidth || 280;
  const height = visualizer.clientHeight || 82;
  const targetWidth = Math.round(width * pixelRatio);
  const targetHeight = Math.round(height * pixelRatio);

  if (visualizer.width !== targetWidth || visualizer.height !== targetHeight) {
    visualizer.width = targetWidth;
    visualizer.height = targetHeight;
  }

  visualizerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
}

function drawVisualizer(useAudio = !audio.paused) {
  const { width, height } = resizeVisualizer();
  const barCount = 28;
  const gap = 3;
  const barWidth = (width - gap * (barCount - 1)) / barCount;
  const segmentHeight = 4;
  const segmentGap = 2;
  const maxSegments = Math.floor((height - 4) / (segmentHeight + segmentGap));

  visualizerContext.clearRect(0, 0, width, height);
  if (useAudio && analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);

  let audioLevel = 0;
  if (useAudio && frequencyData) {
    for (let index = 0; index < 36; index += 1) audioLevel += frequencyData[index];
    audioLevel /= 36 * 255;
  }
  playerStage.style.setProperty("--audio-level", audioLevel.toFixed(3));

  for (let index = 0; index < barCount; index += 1) {
    const hasAudioData = useAudio && frequencyData;
    const frequencyIndex = hasAudioData
      ? Math.floor((index / barCount) * frequencyData.length * 0.72)
      : index;
    const idleShape = 0.13 + Math.sin((index / (barCount - 1)) * Math.PI) * 0.22;
    const strength = hasAudioData ? frequencyData[frequencyIndex] / 255 : idleShape;
    const segmentCount = Math.max(1, Math.round(strength * maxSegments));

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const y = height - (segment + 1) * (segmentHeight + segmentGap);
      const warmThreshold = maxSegments * 0.72;
      visualizerContext.fillStyle = segment > warmThreshold ? "#dce966" : "#eef4ea";
      visualizerContext.fillRect(
        index * (barWidth + gap),
        y,
        Math.max(2, barWidth),
        segmentHeight,
      );
    }
  }

  if (useAudio) visualizerFrame = requestAnimationFrame(() => drawVisualizer(true));
}

async function initializeVisualizer() {
  if (audioContext) {
    if (audioContext.state === "suspended") await audioContext.resume();
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    mediaSource = audioContext.createMediaElementSource(audio);
    mediaSource.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch {
    analyser = null;
    frequencyData = null;
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function updateTrackDetails() {
  trackTitle.textContent = activeTrack.title;
  trackArtist.textContent = activeTrack.artist;
  trackPosition.textContent = "1 / 1";
}

function loadTrack(shouldPlay = false) {
  audio.src = activeTrack.src;
  updateTrackDetails();
  progress.value = 0;
  progress.style.setProperty("--progress", "0%");
  currentTime.textContent = "0:00";
  duration.textContent = "0:00";

  if (shouldPlay) {
    audio.play().catch(() => setPlayingState(false));
  }
}

function setPlayingState(isPlaying) {
  player.classList.toggle("is-playing", isPlaying);
  playButton.setAttribute("aria-label", isPlaying ? "Pausar" : "Reproduzir");
}

async function togglePlayback() {
  if (audio.paused) {
    await initializeVisualizer();
    audio.play().catch(() => setPlayingState(false));
  } else {
    audio.pause();
  }
}

playButton.addEventListener("click", togglePlayback);

audio.addEventListener("play", () => {
  setPlayingState(true);
  cancelAnimationFrame(visualizerFrame);
  drawVisualizer(true);
});
audio.addEventListener("pause", () => {
  setPlayingState(false);
  cancelAnimationFrame(visualizerFrame);
  drawVisualizer(false);
});
audio.addEventListener("ended", () => {
  audio.currentTime = 0;
  setPlayingState(false);
  cancelAnimationFrame(visualizerFrame);
  drawVisualizer(false);
});

audio.addEventListener("loadedmetadata", () => {
  duration.textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  const percentage = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progress.value = percentage;
  progress.style.setProperty("--progress", `${percentage}%`);
  currentTime.textContent = formatTime(audio.currentTime);
});

progress.addEventListener("input", () => {
  if (!audio.duration) return;
  audio.currentTime = (Number(progress.value) / 100) * audio.duration;
  progress.style.setProperty("--progress", `${progress.value}%`);
});

updateTrackDetails();
loadTrack(false);
drawVisualizer(false);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(visualizerFrame);
  cancelAnimationFrame(particleFrame);
  audioContext?.close();
});

const particleCanvas = document.querySelector("#blingParticles");
const particleContext = particleCanvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const blingColors = ["#ff3f98", "#ff8fc5", "#fff7fc", "#d8d4d9", "#e9cf8d"];
let blingParticles = [];
let particleFrame;
let lastParticleTime = 0;

function createBlingParticle(width, height, randomY = true) {
  return {
    x: Math.random() * width,
    y: randomY ? Math.random() * height : height + 4,
    radius: 0.85 + Math.random() * 1.2,
    speedX: -0.14 + Math.random() * 0.28,
    speedY: 0.42 + Math.random() * 0.55,
    opacity: 0.46 + Math.random() * 0.46,
    shimmer: Math.random() * Math.PI * 2,
    glow: Math.random() > 0.58,
    color: blingColors[Math.floor(Math.random() * blingColors.length)],
  };
}

function resizeParticleCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = particleCanvas.clientWidth;
  const height = particleCanvas.clientHeight;
  particleCanvas.width = Math.round(width * ratio);
  particleCanvas.height = Math.round(height * ratio);
  particleContext.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.min(108, Math.max(52, Math.round((width * height) / 12500)));
  blingParticles = Array.from({ length: count }, () => createBlingParticle(width, height));
}

function drawBlingParticles(timestamp = 0) {
  const width = particleCanvas.clientWidth;
  const height = particleCanvas.clientHeight;
  const elapsed = Math.min(32, timestamp - lastParticleTime || 16.7);
  const speedFactor = elapsed / 16.7;
  lastParticleTime = timestamp;

  particleContext.clearRect(0, 0, width, height);

  blingParticles.forEach((particle, index) => {
    if (!reduceMotion.matches) {
      particle.x += particle.speedX * speedFactor;
      particle.y -= particle.speedY * speedFactor;
      particle.shimmer += 0.04 * speedFactor;
    }

    if (particle.y < -5 || particle.x < -5 || particle.x > width + 5) {
      blingParticles[index] = createBlingParticle(width, height, false);
      return;
    }

    const shimmer = 0.72 + Math.sin(particle.shimmer) * 0.28;
    particleContext.beginPath();
    particleContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    particleContext.fillStyle = particle.color;
    particleContext.globalAlpha = particle.opacity * shimmer;
    particleContext.shadowBlur = particle.glow ? 5 : 1.5;
    particleContext.shadowColor = particle.color;
    particleContext.fill();
  });

  particleContext.globalAlpha = 1;
  particleContext.shadowBlur = 0;
  if (!reduceMotion.matches) particleFrame = requestAnimationFrame(drawBlingParticles);
}

function restartBlingParticles() {
  cancelAnimationFrame(particleFrame);
  lastParticleTime = 0;
  resizeParticleCanvas();
  drawBlingParticles();
}

new ResizeObserver(restartBlingParticles).observe(particleCanvas);
reduceMotion.addEventListener("change", restartBlingParticles);
