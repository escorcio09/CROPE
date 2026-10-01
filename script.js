// ==========================================
// 1. NAVEGAÇÃO ENTRE AS PÁGINAS (HERO -> SEÇÕES -> JOGO)
// ==========================================
const viewHero = document.getElementById('viewHero');
const viewSecoes = document.getElementById('viewSecoes');
const viewJogo = document.getElementById('viewJogo');

const navApresentacao = document.getElementById('navApresentacao');
const navJogo = document.getElementById('navJogo');

function mostrarHero() {
    viewHero.classList.add('active');
    viewHero.classList.remove('hidden');
    viewSecoes.classList.remove('active');
    viewSecoes.classList.add('hidden');
    viewJogo.classList.remove('active');
    viewJogo.classList.add('hidden');

    navApresentacao.classList.add('active');
}

function mostrarSecoes() {
    viewHero.classList.remove('active');
    viewHero.classList.add('hidden');
    viewSecoes.classList.add('active');
    viewSecoes.classList.remove('hidden');
    viewJogo.classList.remove('active');
    viewJogo.classList.add('hidden');

    navApresentacao.classList.add('active');
}

function mostrarJogo() {
    viewHero.classList.remove('active');
    viewHero.classList.add('hidden');
    viewSecoes.classList.remove('active');
    viewSecoes.classList.add('hidden');
    viewJogo.classList.add('active');
    viewJogo.classList.remove('hidden');

    navApresentacao.classList.remove('active');
}

// ==========================================
// 2. LÓGICA DO JOGO CANVAS (GUARDIÃO DO VERDE)
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');

let isPlaying = false;
let score = 0;
let forestHealth = 100;
let waterLevel = 100;
let maxWater = 100;
let seedLevel = 8;
let timer = 120;

let wind = { speed: 0.8, direction: 1 }; // 1: Direita, -1: Esquerda

let gameInterval = null;
let fireSpawnInterval = null;
let windInterval = null;

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// DRONE DE REFLORESTAMENTO
const drone = {
    x: 425,
    y: 90,
    speed: 5.5,
    tilt: 0,
    propFrame: 0,
    isRefilling: false,

    update() {
        let dx = 0;
        let dy = 0;

        if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) dy += 1;

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        this.x = Math.max(35, Math.min(canvas.width - 35, this.x));
        this.y = Math.max(35, Math.min(260, this.y));

        this.tilt += (dx * 0.12 - this.tilt) * 0.2;
        this.propFrame += 0.5;

        // REABASTECIMENTO NO RIO (Lado Esquerdo, x < 180, voando baixo y > 190)
        if (this.x < 180 && this.y > 190) {
            this.isRefilling = true;
            if (waterLevel < maxWater) {
                waterLevel = Math.min(maxWater, waterLevel + 0.8);
                if (Math.random() > 0.4) {
                    addParticles(this.x + (Math.random() * 20 - 10), this.y + 15, '#38bdf8', 2, 1);
                }
            }
        } else {
            this.isRefilling = false;
        }
    },

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);

        // Sombra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 340 - this.y, 20, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Estrutura
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-28, -4); ctx.lineTo(28, -4);
        ctx.stroke();

        // Hélices
        ctx.fillStyle = '#1e293b';
        const pSize = Math.sin(this.propFrame) * 18;
        ctx.fillRect(-34, -10, 14, Math.abs(pSize) > 4 ? 2 : 6);
        ctx.fillRect(20, -10, 14, Math.abs(pSize) > 4 ? 2 : 6);

        // Corpo
        ctx.fillStyle = this.isRefilling ? '#38bdf8' : '#64748b';
        ctx.beginPath();
        ctx.roundRect(-20, -8, 40, 18, 5);
        ctx.fill();

        // Tanque de Água
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(0, 2, 5, 0, Math.PI * 2);
        ctx.fill();

        if (this.isRefilling && waterLevel < maxWater) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = '700 10px sans-serif';
            ctx.fillText('[REABASTECENDO...]', -45, -18);
        }

        ctx.restore();
    }
};

let trees = [];       
let fires = [];       
let waterDrops = [];  
let seedDrops = [];   
let particles = [];   
let ashSpots = [];

function plantSeed(x) {
    if (x < 190) return; // Não planta no rio

    const groundY = 340 + (Math.random() * 20 - 10);
    trees.push({
        x: x,
        y: groundY,
        stage: 0, 
        growthProgress: 0,   
        hydration: 80,       
        flowerColor: ['#facc15', '#f43f5e', '#a855f7'][Math.floor(Math.random() * 3)],
        lastSeedProduced: 0
    });
}

// Disparos
window.addEventListener('keydown', e => {
    if (!isPlaying) return;

    if (e.code === 'Space' && waterLevel >= 1.5) {
        waterLevel -= 1.5;
        waterDrops.push({ x: drone.x, y: drone.y + 8, radius: 6, vy: 7.5 });
    }

    if ((e.code === 'KeyE' || e.code === 'ShiftLeft') && seedLevel >= 1) {
        seedLevel -= 1;
        seedDrops.push({ x: drone.x, y: drone.y + 8, radius: 4, vy: 6.5 });
    }
});

function spawnFire() {
    if (!isPlaying) return;
    const x = Math.random() * (canvas.width - 240) + 210;
    const y = Math.random() * 50 + 320;
    fires.push({ x, y, size: 8, maxSize: 42 });
}

function addParticles(x, y, color, count, speed = 2, isSmoke = false) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * speed + (isSmoke ? wind.speed * wind.direction : 0),
            vy: isSmoke ? -Math.random() * 1.5 - 0.5 : (Math.random() - 0.5) * speed,
            size: isSmoke ? Math.random() * 6 + 4 : Math.random() * 3 + 2,
            color,
            life: 1.0,
            decay: isSmoke ? 0.01 : Math.random() * 0.03 + 0.015,
            isSmoke
        });
    }
}

// CENÁRIO DO JOGO
function drawCenario() {
    // Céu
    const gradSky = ctx.createLinearGradient(0, 0, 0, 310);
    gradSky.addColorStop(0, '#0b1329');
    gradSky.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradSky;
    ctx.fillRect(0, 0, canvas.width, 310);

    // Solo
    ctx.fillStyle = '#14532d';
    ctx.fillRect(180, 310, canvas.width - 180, canvas.height - 310);

    // Cinzas
    ashSpots.forEach(ash => {
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.ellipse(ash.x, ash.y, ash.radius, ash.radius / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // RIO (Lado Esquerdo)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(0, 310);
    ctx.bezierCurveTo(90, 310, 120, 380, 180, 480);
    ctx.lineTo(0, 480);
    ctx.fill();

    // Brilho na água
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 5; i++) {
        let rx = (Math.sin(Date.now() * 0.002 + i) + 1) * 60;
        let ry = 330 + i * 25;
        ctx.fillRect(rx, ry, 30, 2);
    }

    // Placa do Rio
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.roundRect(15, 275, 140, 24, 4);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 11px sans-serif';
    ctx.fillText('[ZONA DE REABASTECIMENTO]', 22, 291);
}

function drawTree(tree) {
    const x = tree.x;
    const y = tree.y;

    if (tree.stage === 0) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    } else if (tree.stage === 1) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x - 1, y - 6, 2, 6);
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(x, y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
    } else if (tree.stage === 2) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x - 2, y - 12, 4, 12);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(x, y - 16, 8, 0, Math.PI * 2);
        ctx.fill();
    } else if (tree.stage === 3) {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(x - 3, y - 22, 6, 22);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(x, y - 28, 15, 0, Math.PI * 2);
        ctx.arc(x - 8, y - 22, 10, 0, Math.PI * 2);
        ctx.arc(x + 8, y - 22, 10, 0, Math.PI * 2);
        ctx.fill();
    } else if (tree.stage === 4) {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(x - 4, y - 28, 8, 28);

        ctx.fillStyle = tree.flowerColor;
        ctx.beginPath();
        ctx.arc(x, y - 36, 20, 0, Math.PI * 2);
        ctx.arc(x - 12, y - 28, 14, 0, Math.PI * 2);
        ctx.arc(x + 12, y - 28, 14, 0, Math.PI * 2);
        ctx.fill();

        if (Math.random() > 0.85) {
            addParticles(x + (Math.random() * 30 - 15), y - 20, tree.flowerColor, 1, 0.8);
        }
    }

    if (tree.stage < 4) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - 10, y + 4, 20, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x - 10, y + 4, (tree.growthProgress / 100) * 20, 3);
    }
}

function drawHUD() {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(12, 12, 826, 42, 8);
    ctx.fill();

    ctx.font = '600 12px sans-serif';

    ctx.fillStyle = '#facc15';
    ctx.fillText(`[PONTOS: ${score}]`, 25, 37);

    ctx.fillStyle = forestHealth > 35 ? '#4ade80' : '#f43f5e';
    ctx.fillText(`[FLORESTA: ${Math.max(0, Math.floor(forestHealth))}%]`, 150, 37);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`[ÁGUA: ${Math.floor(waterLevel)}%]`, 300, 37);

    ctx.fillStyle = '#fb923c';
    ctx.fillText(`[SEMENTES: ${seedLevel}]`, 450, 37);

    ctx.fillStyle = '#94a3b8';
    const windText = wind.direction > 0 ? '→' : '←';
    ctx.fillText(`[VENTO: ${windText}]`, 610, 37);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`[TEMPO: ${timer}s]`, 730, 37);
}

// LOOP DO JOGO
function loop() {
    if (!isPlaying) return;

    drawCenario();

    // 1. Árvores
    trees.forEach(tree => {
        if (tree.hydration > 0 && tree.stage < 4) {
            tree.growthProgress += 0.22;
            tree.hydration -= 0.04;

            if (tree.growthProgress >= 100) {
                tree.stage++;
                tree.growthProgress = 0;
                score += 30;
                forestHealth = Math.min(100, forestHealth + 6);
                addParticles(tree.x, tree.y - 10, '#4ade80', 8, 2);
            }
        }

        if (tree.stage === 4) {
            tree.lastSeedProduced += 0.01;
            if (tree.lastSeedProduced >= 10) {
                seedLevel = Math.min(20, seedLevel + 1);
                tree.lastSeedProduced = 0;
                addParticles(tree.x, tree.y - 30, '#facc15', 5, 1.5);
            }
        }

        drawTree(tree);
    });

    // 2. Drone
    drone.update();
    drone.draw();

    // 3. Gotas de Água
    for (let i = waterDrops.length - 1; i >= 0; i--) {
        let w = waterDrops[i];
        w.y += w.vy;

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        ctx.fill();

        trees.forEach(t => {
            if (Math.hypot(w.x - t.x, w.y - t.y) < 25) {
                t.hydration = Math.min(100, t.hydration + 45);
                t.growthProgress = Math.min(100, t.growthProgress + 15);
                addParticles(t.x, t.y, '#38bdf8', 3, 1);
            }
        });

        for (let j = fires.length - 1; j >= 0; j--) {
            let f = fires[j];
            if (Math.hypot(w.x - f.x, w.y - f.y) < f.size + w.radius) {
                f.size -= 12;
                addParticles(f.x, f.y, '#38bdf8', 4, 2);
                waterDrops.splice(i, 1);

                if (f.size <= 0) {
                    ashSpots.push({ x: f.x, y: f.y, radius: 12 });
                    fires.splice(j, 1);
                    score += 25;
                }
                break;
            }
        }

        if (w && w.y > canvas.height - 30) waterDrops.splice(i, 1);
    }

    // 4. Sementes
    for (let i = seedDrops.length - 1; i >= 0; i--) {
        let s = seedDrops[i];
        s.y += s.vy;

        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        if (s.y >= 330) {
            plantSeed(s.x);
            addParticles(s.x, s.y, '#4ade80', 6, 2);
            seedDrops.splice(i, 1);
        }
    }

    // 5. Fogo e Fumaça
    for (let i = fires.length - 1; i >= 0; i--) {
        let f = fires[i];

        if (f.size < f.maxSize) f.size += 0.035;
        else forestHealth -= 0.09;

        if (Math.random() > 0.4) {
            addParticles(f.x, f.y - f.size * 0.5, '#64748b', 1, 1, true);
        }

        for (let tIdx = trees.length - 1; tIdx >= 0; tIdx--) {
            let t = trees[tIdx];
            if (Math.hypot(f.x - t.x, f.y - t.y) < f.size + 10) {
                if (t.hydration > 20) {
                    t.hydration -= 0.6;
                } else {
                    addParticles(t.x, t.y - 15, '#f43f5e', 12, 3);
                    ashSpots.push({ x: t.x, y: t.y, radius: 14 });
                    trees.splice(tIdx, 1);
                }
            }
        }

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(f.x + wind.direction * 2, f.y - 2, f.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
    }

    // 6. Partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.isSmoke) p.size += 0.15;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    drawHUD();

    if (forestHealth <= 0) {
        endGame(false);
        return;
    }

    requestAnimationFrame(loop);
}

function startGame() {
    isPlaying = true;
    score = 0;
    forestHealth = 100;
    waterLevel = 100;
    seedLevel = 8;
    timer = 120;

    trees = [];
    fires = [];
    waterDrops = [];
    seedDrops = [];
    particles = [];
    ashSpots = [];

    drone.x = 425;
    drone.y = 90;

    startBtn.style.display = 'none';

    clearInterval(gameInterval);
    clearInterval(fireSpawnInterval);
    clearInterval(windInterval);

    gameInterval = setInterval(() => {
        timer--;
        if (timer <= 0) endGame(true);
    }, 1000);

    fireSpawnInterval = setInterval(spawnFire, 1700);

    windInterval = setInterval(() => {
        wind.direction = Math.random() > 0.5 ? 1 : -1;
        wind.speed = Math.random() * 1.2 + 0.4;
    }, 8000);

    requestAnimationFrame(loop);
}

function endGame(win) {
    isPlaying = false;
    clearInterval(gameInterval);
    clearInterval(fireSpawnInterval);
    clearInterval(windInterval);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.font = '700 24px sans-serif';

    if (win) {
        ctx.fillStyle = '#22c55e';
        ctx.fillText('[MISSÃO CUMPRIDA! FLORESTA REFLORESTADA]', canvas.width / 2, 190);
    } else {
        ctx.fillStyle = '#f43f5e';
        ctx.fillText('[FIM DE JOGO! A FLORESTA FOI DESTRUÍDA]', canvas.width / 2, 190);
    }

    const ipeCount = trees.filter(t => t.stage === 4).length;

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`[PONTUAÇÃO FINAL: ${score}]`, canvas.width / 2, 240);
    ctx.fillText(`[ÁRVORES CULTIVADAS: ${trees.length} | IPÊS FLORIDOS: ${ipeCount}]`, canvas.width / 2, 275);

    startBtn.innerText = '[JOGAR NOVAMENTE]';
    startBtn.style.display = 'block';
}

// Tela Inicial do Canvas
drawCenario();
ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.font = '600 18px sans-serif';
ctx.fillStyle = '#f8fafc';
ctx.textAlign = 'center';
ctx.fillText('[CLIQUE NO BOTÃO ABAIXO PARA INICIAR O JOGO]', canvas.width / 2, canvas.height / 2);

startBtn.addEventListener('click', startGame);