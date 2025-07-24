(function () {
'use strict';


const PLAYER_SHIP_IMG_URLS = {
    idle: "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Standard_Space_Ship_1_1753389597605.png",
    left: "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Standard_Space_Ship_4_1753389630164.png",
    right: "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Standard_Space_Ship_5_1753389644373.png"
};

const PlayerShipSprites = {
    imgs: { idle: null, left: null, right: null },
    loaded: false,
    _loadedCount: 0,
    _onloadQueue: [],
    _processAndSet(key, img) {

        processImageToTransparent(img, (processedImg) => {
            this.imgs[key] = processedImg;
            this._loadedCount++;
            if (this._loadedCount === 3) {
                this.loaded = true;
                while (this._onloadQueue.length) this._onloadQueue.pop()();
            }
        });
    },
    load() {
        if (this.loaded) return;
        for (const key of ["idle", "left", "right"]) {
            const img = new window.Image();
            img.crossOrigin = "Anonymous";
            img.src = PLAYER_SHIP_IMG_URLS[key];
            img.onload = () => this._processAndSet(key, img);
            img.onerror = () => {
                this._loadedCount++;
                if (this._loadedCount === 3) {
                    this.loaded = true;
                    while (this._onloadQueue.length) this._onloadQueue.pop()();
                }
            };
        }
    },
    ensureLoaded(cb) {
        if (this.loaded) {
            cb && cb();
        } else {
            if (cb) this._onloadQueue.push(cb);
        }
    }
};
PlayerShipSprites.load();


function processImageToTransparent(img, callback) {
    const w = img.width, h = img.height;
    if (!w || !h) {
        callback(img); // fallback, no processing
        return;
    }
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d', { alpha: true });
    octx.clearRect(0, 0, w, h);
    octx.drawImage(img, 0, 0, w, h);
    const imgData = octx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            const idx = (py * w + px) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2];

            if (r >= 250 && g >= 250 && b >= 250) {
                data[idx+3] = 0;
            }
        }
    }

    octx.putImageData(imgData, 0, 0);

    const processedImg = new window.Image();
    processedImg.crossOrigin = "Anonymous";
    processedImg.src = off.toDataURL();
    processedImg.onload = () => callback(processedImg);
    processedImg.onerror = () => callback(img); // fallback
}


const GAME_WIDTH = 640, GAME_HEIGHT = 800;
const ZONES = 10, STAGES_PER_ZONE = 10, WAVES_PER_STAGE = 10;
const PLAYER_BASE_RADIUS = 22, PLAYER_BASE_SPEED = 5;
const ENEMY_BASE_RADIUS = 18, ENEMY_BASE_SPEED = 1.6;
const BULLET_BASE_SPEED = 9;
const UPGRADE_INTERVAL_WAVES = 5;
const FPS = 60;

function clamp(val, min, max) { return Math.max(min, Math.min(val, max)); }

function rand(a, b) { return Math.random() * (b - a) + a; }

function lerp(a, b, t) { return a + (b - a) * t; }

function distance(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

const PLAYER_BULLET_ANIM_URLS = [
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/StandardPlasma1_1753294753160.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/StandardPlasma2_1753294770089.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/StandardPlasma3_1753294782782.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/StandardPlasma4_1753294792160.png"
];

const PlayerBulletAnim = {
    frames: [],
    loaded: false,
    onloadCallbacks: [],
    load() {
        if (this.frames.length > 0) return;
        let loadedCount = 0;
        for (let i = 0; i < PLAYER_BULLET_ANIM_URLS.length; ++i) {
            const img = new window.Image();
            img.crossOrigin = "Anonymous";
            img.src = PLAYER_BULLET_ANIM_URLS[i];
            img.onload = () => {

                processImageToTransparent(img, (processedImg) => {
                    PlayerBulletAnim.frames[i] = processedImg;
                    loadedCount++;
                    if (loadedCount === PLAYER_BULLET_ANIM_URLS.length) {
                        this.loaded = true;
                        this.onloadCallbacks.forEach(cb => cb());
                    }
                });
            };
            img.onerror = () => {
                loadedCount++;
                if (loadedCount === PLAYER_BULLET_ANIM_URLS.length) {
                    this.loaded = true;
                    this.onloadCallbacks.forEach(cb => cb());
                }
            };
            this.frames.push(img);
        }
    },
    ensureLoaded(cb) {
        if (this.loaded) {
            cb && cb();
        } else {
            if (cb) this.onloadCallbacks.push(cb);
        }
    }
};
PlayerBulletAnim.load();




window.Player = class Player {
    constructor(game) {
        this.game = game;
        this.x = GAME_WIDTH / 2;
        this.y = GAME_HEIGHT - 70;
        this.radius = PLAYER_BASE_RADIUS;
        this.speed = PLAYER_BASE_SPEED;
        this.color = '#2efadc';
        this.outline = '#ffe750';
        this.bulletLevel = 1;
        this.bulletCooldown = 0;
        this.bulletFireRate = 10; // frames
        this.lives = 3;
        this.shields = 0;
        this.wingmen = 0;
        this.homing = false;
        this.invincibleTimer = 0;
        this.moveDir = { left: false, right: false, up: false, down: false };

        this.lastMoveFrame = 0;
        this._moveState = "idle"; // idle, left, right
    }

    update() {

        let dx = 0, dy = 0;
        if (this.moveDir.left) dx -= 1;
        if (this.moveDir.right) dx += 1;
        if (this.moveDir.up) dy -= 1;
        if (this.moveDir.down) dy += 1;
        let mag = Math.sqrt(dx * dx + dy * dy) || 1;
        this.x += (dx / mag) * this.speed;
        this.y += (dy / mag) * this.speed;

        this.x = clamp(this.x, this.radius + 6, GAME_WIDTH - this.radius - 6);
        this.y = clamp(this.y, this.radius + 6, GAME_HEIGHT - this.radius - 6);

        if (this.bulletCooldown > 0) this.bulletCooldown--;
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        if (this.game.input.shooting && this.bulletCooldown <= 0) {
            this.shoot();
            this.bulletCooldown = Math.floor(this.bulletFireRate);
        }

        if (this.moveDir.left && !this.moveDir.right) {
            this._moveState = "left";
        } else if (this.moveDir.right && !this.moveDir.left) {
            this._moveState = "right";
        } else {
            this._moveState = "idle";
        }
    }

    shoot() {

        const bullets = [];
        const spread = this.bulletLevel >= 3 ? Math.min(0.25 + this.bulletLevel * 0.07, 0.8) : 0;
        const count = Math.min(this.bulletLevel, 5);
        for (let i = 0; i < count; ++i) {
            const angle = lerp(-spread, spread, count === 1 ? 0.5 : i / (count - 1));

            bullets.push(new window.Bullet(this.game, this.x, this.y - this.radius - 2,
                angle, -1, false, false, '#fff', "player"));
        }

        if (this.homing && this.game.waveNum >= 5) {
            bullets.push(new window.Bullet(this.game, this.x, this.y - this.radius - 2,
                0, -1, true, false, '#ff75fa', "player_homing"));
        }

        for (let i = 0; i < Math.min(this.wingmen, 2); ++i) {
            const wx = this.x + (i === 0 ? -42 : 42);

            bullets.push(new window.Bullet(this.game, wx, this.y - this.radius - 8,
                0, -1, false, true, '#b9ff32', "wingman"));
        }
        for (const b of bullets) {
            this.game.playerBullets.push(b);
        }
    }

    hit() {
        if (this.invincibleTimer > 0) return false;
        if (this.shields > 0) {
            this.shields--;
            this.invincibleTimer = 40;
            this.game.effectManager.addShieldPop(this.x, this.y);
            return false;
        } else {
            this.lives--;
            this.invincibleTimer = 60;
            this.game.effectManager.addExplosion(this.x, this.y, 'player');
            return this.lives < 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.invincibleTimer && Math.floor(this.invincibleTimer / 5) % 2 === 0) ctx.globalAlpha = 0.3;

        let drewSprite = false;
        if (PlayerShipSprites.loaded) {
            let img = null;

            if (this._moveState === "left") {
                img = PlayerShipSprites.imgs.left;
            } else if (this._moveState === "right") {
                img = PlayerShipSprites.imgs.right;
            } else {
                img = PlayerShipSprites.imgs.idle;
            }
            if (img) {


                const size = this.radius * 2.15; // extra 7.5% for a good fit
                ctx.save();
                ctx.globalAlpha *= 1.0;
                ctx.drawImage(
                    img,
                    -size/2, -size/2,
                    size, size
                );
                ctx.restore();
                drewSprite = true;
            }
        }

        if (!drewSprite) {

            let grad = ctx.createRadialGradient(0, 0, 3, 0, 0, this.radius + 2);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.15, this.color);
            grad.addColorStop(1, '#0a1f2c');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
            ctx.fill();

            ctx.lineWidth = 3;
            ctx.strokeStyle = this.outline;
            ctx.shadowColor = '#ffe750';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 2, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(0, -7, 8, Math.PI * 1.1, Math.PI * 1.9, false);
            ctx.lineWidth = 4.2;
            ctx.strokeStyle = '#fff6';
            ctx.shadowColor = '#fff7';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.rotate(-0.4);
            ctx.beginPath();
            ctx.moveTo(-this.radius - 8, 0);
            ctx.lineTo(-6, 4);
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#6af9f3';
            ctx.globalAlpha = 0.28;
            ctx.stroke();
            ctx.restore();
            ctx.save();
            ctx.rotate(0.4);
            ctx.beginPath();
            ctx.moveTo(this.radius + 8, 0);
            ctx.lineTo(6, 4);
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#6af9f3';
            ctx.globalAlpha = 0.28;
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        if (this.shields > 0 && this.invincibleTimer % 8 < 5) {
            ctx.save();
            ctx.globalAlpha = 0.45 + 0.10 * Math.sin(Date.now() / 140);
            ctx.strokeStyle = '#50f0ff';
            ctx.lineWidth = 5.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }

        for (let i = 0; i < Math.min(this.wingmen, 2); ++i) {
            ctx.save();
            ctx.translate((i === 0 ? -42 : 42), 0);
            ctx.scale(0.7, 0.7);
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.7, 0, 2 * Math.PI);
            ctx.fillStyle = '#b9ff32';
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }
};

window.Bullet = class Bullet {
    /**
     * 
     * @param {*} game 
     * @param {*} x 
     * @param {*} y 
     * @param {*} angle 
     * @param {*} dirY 
     * @param {*} homing 
     * @param {*} isWingman 
     * @param {*} color 
     * @param {*} type   // "player" (main), "wingman", "player_homing", or undefined for plain effect bullets
     */
    constructor(game, x, y, angle, dirY, homing, isWingman, color, type) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.radius = 5.5;
        this.speed = BULLET_BASE_SPEED + (isWingman ? -2 : 0);
        this.angle = angle;
        this.dirY = dirY;
        this.homing = homing;
        this.isWingman = isWingman;
        this.color = color;
        this.age = 0;
        this.toRemove = false;
        this.type = type || "default";
    }
    update() {
        this.age++;
        let vx = Math.sin(this.angle) * 5;
        let vy = this.dirY * this.speed * (1 + 0.05 * Math.cos(this.angle));

        if (this.homing && this.age > 4) {
            let nearest = null, ndist = 9999;
            for (const enemy of this.game.enemies) {
                let d = distance(this.x, this.y, enemy.x, enemy.y);
                if (d < ndist) { ndist = d; nearest = enemy; }
            }
            if (nearest && ndist < 380) {
                const dx = nearest.x - this.x, dy = nearest.y - this.y;
                let desAngle = Math.atan2(dx, dy * -1);
                this.angle = lerp(this.angle, desAngle, 0.22);
            }
        }
        this.x += vx;
        this.y += vy;

        if (this.y < -24 || this.y > GAME_HEIGHT + 24 || this.x < -24 || this.x > GAME_WIDTH + 24)
            this.toRemove = true;
    }
    draw(ctx) {

        if (
            (this.type === "player" || this.type === "wingman" || this.type === "player_homing") &&
            PlayerBulletAnim.frames.length === 4
        ) {
            ctx.save();
            ctx.translate(this.x, this.y);

            let frameIdx = Math.floor((this.age / 2) % 4);

            ctx.rotate(-this.angle);

            let alpha = 0.82 + 0.13 * Math.sin(Date.now() / 83 + this.x + this.y);
            ctx.globalAlpha *= alpha;


            let blurColor, blur, bgRadius;
            if (this.type === "player_homing") {
                blurColor = "#ffb0ff";
                blur = 24;
                bgRadius = 18;
            } else if (this.type === "wingman") {
                blurColor = "#b9ff32";
                blur = 12;
                bgRadius = 14;
            } else {
                blurColor = "#6ff8ff";
                blur = 16;
                bgRadius = 17;
            }

            ctx.save();
            ctx.globalAlpha *= 0.14; // reduce glow
            ctx.shadowColor = blurColor;
            ctx.shadowBlur = blur;
            ctx.beginPath();
            ctx.arc(0, 0, bgRadius, 0, 2 * Math.PI);
            ctx.restore();

            if (this.type === "player_homing") {
                ctx.save();
                ctx.globalAlpha *= 0.7;
                ctx.drawImage(PlayerBulletAnim.frames[frameIdx], -16, -16, 32, 32);
                ctx.restore();
                ctx.globalAlpha *= 0.58;
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = "#ffb0ff";
                ctx.beginPath();
                ctx.arc(0, 0, 11, 0, 2 * Math.PI);
                ctx.fill();
                ctx.globalCompositeOperation = "source-over";
            } else if (this.type === "wingman") {
                ctx.save();
                ctx.globalAlpha *= 0.8;
                ctx.drawImage(PlayerBulletAnim.frames[frameIdx], -13, -13, 26, 26);
                ctx.restore();
                ctx.globalAlpha *= 0.43;
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = "#c6ff7c";
                ctx.beginPath();
                ctx.arc(0, 0, 8.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.globalCompositeOperation = "source-over";
            } else { // player
                ctx.drawImage(PlayerBulletAnim.frames[frameIdx], -14, -14, 28, 28);
            }

            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
};

window.Enemy = class Enemy {
    constructor(game, type, x, y, attributes) {
        this.game = game;
        this.type = type;
        this.x = x;
        this.y = y;
        this.radius = attributes.radius || ENEMY_BASE_RADIUS;
        this.speed = attributes.speed || ENEMY_BASE_SPEED;
        this.color = attributes.color || '#ff5341';
        this.hp = attributes.hp || 1;
        this.maxHp = this.hp;
        this.value = attributes.value || 10;
        this.pattern = attributes.pattern || 'down';
        this.age = 0;
        this.toRemove = false;
        this.bulletTimer = 0;
    }
    update() {
        this.age++;

        if (this.pattern === 'down') {
            this.y += this.speed;
        } else if (this.pattern === 'zigzag') {
            this.y += this.speed * 0.9;
            this.x += Math.sin(this.age * 0.1) * 2.8;
        } else if (this.pattern === 'sine') {
            this.y += this.speed * 0.8;
            this.x += Math.sin(this.y / 32) * 3.8;
        } else if (this.pattern === 'fast') {
            this.y += this.speed * 1.35;
        } else if (this.pattern === 'boss') {
            this.y += this.speed * 0.5 * Math.sin(this.age / 40);
            this.x += Math.cos(this.age / 60) * 1.5;
        }

        if (this.pattern === 'boss') {
            if (this.age > 60 && this.age % 50 === 0) {
                for (let i = 0; i < 6; ++i) {
                    const ang = Math.PI * 2 * i / 6;
                    this.game.enemyBullets.push(new window.EnemyBullet(this.game, this.x, this.y, ang, 2.6, '#ff9f32'));
                }
            }
        }

        if (this.y > GAME_HEIGHT + this.radius + 64) this.toRemove = true;
    }
    hit() {
        this.hp--;
        if (this.hp <= 0) {
            this.toRemove = true;
            this.game.effectManager.addExplosion(this.x, this.y, 'enemy');
            this.game.addCurrency(this.value);
            this.game.score += this.value;
            return true;
        }
        return false;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 28;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.08 + Math.sin(this.age / 10) * 1.4, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff2';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        let grad = ctx.createRadialGradient(0, 0, 3, 0, 0, this.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.12, this.color);
        grad.addColorStop(1, '#1a0a0a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fff4';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 2, 0, 2 * Math.PI);
        ctx.stroke();

        if (this.pattern === "boss") {
            ctx.save();
            ctx.translate(-this.radius, -this.radius - 16);
            ctx.fillStyle = "#0008";
            ctx.fillRect(0, 0, this.radius * 2, 7);
            ctx.fillStyle = "#ffb200";
            ctx.fillRect(0, 0, this.radius * 2 * (this.hp / this.maxHp), 7);
            ctx.restore();
        }
        ctx.restore();
    }
};

window.EnemyBullet = class EnemyBullet {
    constructor(game, x, y, angle, speed, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.speed = speed;
        this.angle = angle;
        this.color = color;
        this.age = 0;
        this.toRemove = false;
    }
    update() {
        this.age++;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        if (this.x < -24 || this.x > GAME_WIDTH + 24 || this.y > GAME_HEIGHT + 24)
            this.toRemove = true;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff2';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
};



window.EffectManager = class EffectManager {
    constructor(game) {
        this.game = game;
        this.effects = [];
    }
    addExplosion(x, y, type) {
        for (let i = 0; i < 14; ++i) {
            this.effects.push({
                type: "particle",
                x, y,
                vx: rand(-2.2,2.2)+(type==='player'?0:rand(-1,1)),
                vy: rand(-2.2,2.2)+(type==='player'?0:rand(-1,1)),
                radius: rand(7,16),
                color: type === 'player' ? '#ffe750' : '#ff5341',
                life: rand(15,24),
                age: 0
            });
        }
    }
    addShieldPop(x, y) {
        for (let i = 0; i < 10; ++i) {
            this.effects.push({
                type: "particle",
                x, y,
                vx: rand(-2.5,2.5),
                vy: rand(-2.5,2.5),
                radius: rand(5,9),
                color: "#50f0ff",
                life: rand(10,16),
                age: 0
            });
        }
    }
    addBanner(text, color, duration) {
        this.effects.push({
            type: "banner",
            text,
            color,
            time: 0,
            duration: duration || 70
        });
    }
    update() {
        for (const eff of this.effects) {
            if (eff.type === "particle") {
                eff.x += eff.vx;
                eff.y += eff.vy;
                eff.vx *= 0.87;
                eff.vy *= 0.87;
                eff.age++;
            } else if (eff.type === "banner") {
                eff.time++;
            }
        }
        this.effects = this.effects.filter(eff => {
            if (eff.type === "particle") return eff.age < eff.life;
            if (eff.type === "banner") return eff.time < eff.duration;
        });
    }
    draw(ctx) {
        for (const eff of this.effects) {
            if (eff.type === "particle") {
                ctx.save();
                ctx.globalAlpha = 1 - eff.age / eff.life;
                ctx.beginPath();
                ctx.arc(eff.x, eff.y, eff.radius, 0, 2 * Math.PI);
                ctx.fillStyle = eff.color;
                ctx.shadowColor = eff.color;
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
            } else if (eff.type === "banner") {
                ctx.save();
                let alpha = eff.time < 16 ? eff.time/16 : (eff.time > eff.duration-16 ? (eff.duration-eff.time)/16 : 1);
                ctx.globalAlpha = clamp(alpha, 0, 1);
                ctx.font = 'bold 42px Segoe UI, Arial';
                ctx.textAlign = 'center';
                ctx.lineWidth = 5;
                ctx.strokeStyle = "#000b";
                ctx.strokeText(eff.text, GAME_WIDTH/2, GAME_HEIGHT/2-26);
                ctx.fillStyle = eff.color;
                ctx.fillText(eff.text, GAME_WIDTH/2, GAME_HEIGHT/2-26);
                ctx.restore();
            }
        }
    }
};



const UPGRADE_LIST = [
    {
        id: "bulletLevel",
        name: "Upgrade Projectiles",
        desc: "Fire more bullets and increase firepower.",
        cost: 45,
        max: 5,
        apply: (p) => { p.bulletLevel = clamp(p.bulletLevel+1,1,5); }
    },
    {
        id: "shields",
        name: "Add Shield",
        desc: "Gain an extra shield (blocks one hit).",
        cost: 55,
        max: 4,
        apply: (p) => { p.shields = clamp(p.shields+1,0,4); }
    },
    {
        id: "lives",
        name: "Extra Life",
        desc: "Gain an extra life.",
        cost: 60,
        max: 6,
        apply: (p) => { p.lives = clamp(p.lives+1,0,6); }
    },
    {
        id: "wingmen",
        name: "Wingman Drone",
        desc: "A drone helps you shoot from the side.",
        cost: 90,
        max: 2,
        apply: (p) => { p.wingmen = clamp(p.wingmen+1,0,2); }
    },
    {
        id: "homing",
        name: "Unlock Homing Missiles",
        desc: "Occasionally fires homing projectiles.",
        cost: 120,
        max: 1,
        apply: (p) => { p.homing = true; }
    },
];



window.GameManager = class GameManager {
    constructor(canvas, uiOverlay) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.uiOverlay = uiOverlay;
        this.reset();
        this.setupInput();
        this.lastFrameTime = 0;
        this.running = false;
        this._raf = null;

        this.showMainMenu();
    }

    reset() {
        this.zoneNum = 1;
        this.stageNum = 1;
        this.waveNum = 1;
        this.score = 0;
        this.currency = 0;
        this.state = "menu"; // menu, playing, upgrade, dead, win
        this.player = new window.Player(this);
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.effectManager = new window.EffectManager(this);
        this.input = { left: false, right: false, up: false, down: false, shooting: false };
        this.waveCleared = false;
        this.waveTimer = 0;
        this.upgradeData = {};
        for (const u of UPGRADE_LIST) this.upgradeData[u.id] = 0;
        this._hudElem = null;
    }

    setupInput() {
        this.keys = {};

        this._keysDown = {};

        function keyToMoveDir(key) {

            switch (key) {
                case "ArrowLeft":
                case "Left": // legacy
                case "a":
                case "A":
                    return "left";
                case "ArrowRight":
                case "Right":
                case "d":
                case "D":
                    return "right";
                case "ArrowUp":
                case "Up":
                case "w":
                case "W":
                    return "up";
                case "ArrowDown":
                case "Down":
                case "s":
                case "S":
                    return "down";
                default:
                    return null;
            }
        }

        const updateMoveDir = () => {

            this.input.left = this.input.right = this.input.up = this.input.down = false;
            for (let key in this._keysDown) {
                let dir = keyToMoveDir(key);
                if (!dir) continue;
                this.input[dir] = true;
            }

            if (this.player) {
                this.player.moveDir.left = this.input.left;
                this.player.moveDir.right = this.input.right;
                this.player.moveDir.up = this.input.up;
                this.player.moveDir.down = this.input.down;
            }
        };

        window.addEventListener('keydown', (e) => {

            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
                e.preventDefault();
            }

            if (["upgrade", "menu", "dead", "win"].includes(this.state)) return;

            this._keysDown[e.key] = true;
            updateMoveDir();

            if (e.key === " " || e.key === "z" || e.key === "Z") this.input.shooting = true;
        });

        window.addEventListener('keyup', (e) => {
            delete this._keysDown[e.key];
            updateMoveDir();

            if (e.key === " " || e.key === "z" || e.key === "Z") this.input.shooting = false;
        });

        this.canvas.addEventListener('pointerdown', (e) => {
            if (this.state === "playing") this.input.shooting = true;
        });
        this.canvas.addEventListener('pointerup', (e) => {
            this.input.shooting = false;
        });
    }

    showMainMenu() {
        this.clearOverlay();
        this.state = "menu";
        const div = document.createElement('div');
        div.className = 'menu-screen';
        div.innerHTML = `
            <h1>Space Shooter Roguelike</h1>
            <p>Progress through 10 zones of escalating danger!<br>
            Upgrade your ship every 5 waves.<br>
            Controls: <span style="color:#ffe750;">WASD/Arrow keys</span> to move, <span style="color:#ffe750;">Space/Z</span> or hold mouse to shoot.<br>
            <b>Survive and defeat the final boss!</b></p>
            <button class="menu-btn" id="startBtn">Start Game</button>
        `;
        this.uiOverlay.appendChild(div);
        document.getElementById('startBtn').onclick = () => {
            this.clearOverlay();
            this.startGame();
        };
        this.renderHud();
    }

    showUpgradeMenu() {
        this.clearOverlay();
        this.state = "upgrade";
        const div = document.createElement('div');
        div.className = 'upgrade-screen';

        div.style.maxWidth = "700px";
        div.style.width = "98vw";
        div.style.maxHeight = "98vh";
        div.style.overflow = "auto";
        div.innerHTML = `<h1>Choose Upgrade</h1>
        <p>You have <span class="currency">${this.currency}</span> credits<br>
        Zone <span class="zone">${this.zoneNum}</span> &ndash; Stage <span class="stage">${this.stageNum}</span> &ndash; Wave <span class="wave">${this.waveNum}</span></p>
        <div class="upgrade-list"></div>
        <button class="menu-btn" id="continueBtn" style="margin-top:22px;">Continue</button>
        `;
        this.uiOverlay.appendChild(div);
        const listDiv = div.querySelector('.upgrade-list');

        for (const u of UPGRADE_LIST) {
            const current = this.upgradeData[u.id] || 0;
            const locked = (current >= u.max) || (this.currency < u.cost);
            const btn = document.createElement('button');
            btn.className = 'upgrade-btn' + (locked ? ' locked' : '');
            btn.innerHTML = `<b>${u.name}</b><br>
                <span style="font-size:0.93em">${u.desc}</span><br>
                <span style="color:#ffe750;font-weight:bold;">Cost: ${u.cost}</span> 
                <span style="font-size:0.9em;color:#fff7;">(${current}/${u.max})</span>`;
            btn.disabled = locked;
            btn.onclick = () => {
                u.apply(this.player);
                this.currency -= u.cost;
                this.upgradeData[u.id] = clamp(current + 1, 0, u.max);
                this.showUpgradeMenu();
                this.renderHud();
            };
            listDiv.appendChild(btn);
        }
        document.getElementById('continueBtn').onclick = () => {
            this.clearOverlay();
            this.state = "playing";
        };

        div.tabIndex = 0;
        div.focus();
        div.addEventListener('keydown', (e) => {
            if (e.key === "Escape" || e.key === "Enter") {
                document.getElementById('continueBtn').click();
            }
        });
    }

    showGameOver(win=false) {
        this.clearOverlay();
        this.state = win ? "win" : "dead";
        const div = document.createElement('div');
        div.className = 'menu-screen';
        if (win) {
            div.innerHTML = `<h1>Victory!</h1>
                <p>You've defeated the final boss!<br>
                <span style="color:#ffe750;font-size:1.3em;">Score: ${this.score}</span><br>
                <button class="menu-btn" id="restartBtn">Play Again</button>`;
        } else {
            div.innerHTML = `<h1>Game Over</h1>
                <p>Your run ended.<br>
                <span style="color:#ffe750;font-size:1.3em;">Score: ${this.score}</span><br>
                <button class="menu-btn" id="restartBtn">Restart</button>`;
        }
        this.uiOverlay.appendChild(div);
        document.getElementById('restartBtn').onclick = () => {
            this.clearOverlay();
            this.reset();
            this.showMainMenu();
        };
        this.renderHud();
    }

    clearOverlay() {
        while (this.uiOverlay.firstChild) {
            this.uiOverlay.removeChild(this.uiOverlay.firstChild);
        }
    }

    renderHud() {

        if (this._hudElem && this._hudElem.parentNode) this._hudElem.parentNode.removeChild(this._hudElem);

        const div = document.createElement('div');
        div.id = 'hud';
        div.innerHTML = `
            <span class="currency">&#x1F4B0; ${this.currency}</span>&nbsp; 
            <span class="zone">Zone ${this.zoneNum}</span> &ndash; 
            <span class="stage">Stage ${this.stageNum}</span> &ndash; 
            <span class="wave">Wave ${this.waveNum}</span><br>
            <span class="lives">&#x1F397; ${clamp(this.player.lives,0,99)}</span> 
            <span class="shields">&#x1F6E1; ${clamp(this.player.shields,0,99)}</span> 
            <span class="wingmen">&#x1F47E; ${clamp(this.player.wingmen,0,2)}</span>
        `;
        this.uiOverlay.appendChild(div);
        this._hudElem = div;
    }

    startGame() {
        this.reset();
        this.state = "playing";
        this.running = true;
        this.renderHud();
        this.spawnWave();
        this.effectManager.addBanner(`Zone ${this.zoneNum} Start!`, "#ffa200", 62);
        if (!this._raf) this.render(performance.now());
    }

    render(now) {
        if (!this.running) return;

        if (!this.lastFrameTime) this.lastFrameTime = now;
        const dt = Math.min((now - this.lastFrameTime) / (1000 / FPS), 2);
        this.lastFrameTime = now;

        if (this.state === "playing") {
            this.updateGame(dt);
        }

        this.drawGame();

        this._raf = requestAnimationFrame(this.render.bind(this));
    }

    updateGame(dt) {

        this.player.update();
        for (const b of this.playerBullets) b.update();
        for (const e of this.enemies) e.update();
        for (const eb of this.enemyBullets) eb.update();
        this.effectManager.update();

        for (const b of this.playerBullets) {
            for (const e of this.enemies) {
                if (!b.toRemove && !e.toRemove && distance(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
                    b.toRemove = true;
                    e.hit();
                }
            }
        }

        for (const eb of this.enemyBullets) {
            if (!eb.toRemove && distance(eb.x, eb.y, this.player.x, this.player.y) < eb.radius + this.player.radius) {
                eb.toRemove = true;
                if (this.player.hit()) { // Dead
                    this.running = false;
                    setTimeout(() => this.showGameOver(false), 750);
                    return;
                }
                this.renderHud();
            }
        }

        for (const e of this.enemies) {
            if (!e.toRemove && distance(e.x, e.y, this.player.x, this.player.y) < e.radius + this.player.radius - 3) {
                e.toRemove = true;
                if (this.player.hit()) {
                    this.running = false;
                    setTimeout(() => this.showGameOver(false), 750);
                    return;
                }
                this.renderHud();
            }
        }

        this.playerBullets = this.playerBullets.filter(b => !b.toRemove);
        this.enemies = this.enemies.filter(e => !e.toRemove);
        this.enemyBullets = this.enemyBullets.filter(eb => !eb.toRemove);

        if (this.enemies.length === 0 && this.state === "playing") {
            this.waveCleared = true;
            this.waveTimer++;
            if (this.waveTimer > 30) {
                this.waveTimer = 0;
                this.waveNum++;
                if ((this.waveNum-1) % UPGRADE_INTERVAL_WAVES === 0 && this.waveNum !== 1 && this.waveNum <= WAVES_PER_STAGE) {
                    setTimeout(() => this.showUpgradeMenu(), 300);
                }
                if (this.waveNum > WAVES_PER_STAGE) {
                    this.waveNum = 1;
                    this.stageNum++;
                    if (this.stageNum > STAGES_PER_ZONE) {
                        this.stageNum = 1;
                        this.zoneNum++;
                        if (this.zoneNum > ZONES) {

                            this.running = false;
                            setTimeout(() => this.showGameOver(true), 1100);
                            return;
                        } else {
                            this.effectManager.addBanner(`Zone ${this.zoneNum} Start!`, "#ffa200", 64);
                        }
                    } else {
                        this.effectManager.addBanner(`Stage ${this.stageNum}`, "#2efadc", 60);
                    }
                }
                if (this.state === "playing") this.spawnWave();
                this.renderHud();
            }
        }
    }

    drawGame() {

        this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        this.drawStarfield();

        for (const b of this.playerBullets) b.draw(this.ctx);
        for (const eb of this.enemyBullets) eb.draw(this.ctx);
        for (const e of this.enemies) e.draw(this.ctx);
        this.player.draw(this.ctx);
        this.effectManager.draw(this.ctx);
    }

    drawStarfield() {
        const ctx = this.ctx;

        for (let i = 0; i < 60; ++i) {
            let sx = (i * 97) % GAME_WIDTH;
            let sy = (((i * 53) + (Date.now() / 17 * (1 + this.zoneNum * 0.1))) % GAME_HEIGHT);
            let r = 0.9 + 0.6 * Math.sin(i + Date.now() / 210);
            ctx.save();
            ctx.globalAlpha = 0.12 + 0.08 * Math.sin(i + Date.now() / 180);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.shadowBlur = 7;
            ctx.shadowColor = "#fff";
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        let g = ctx.createRadialGradient(
            GAME_WIDTH/2+Math.sin(Date.now()/1200)*40, 
            GAME_HEIGHT*0.34+Math.cos(Date.now()/1500)*28,
            16,
            GAME_WIDTH/2, GAME_HEIGHT/2, 340
        );
        g.addColorStop(0, "#1e8aff44");
        g.addColorStop(0.2, "#0a6dee22");
        g.addColorStop(1, "#0000");
        ctx.save();
        ctx.globalAlpha = 0.23;
        ctx.fillStyle = g;
        ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
        ctx.restore();
    }

    spawnWave() {

        const z = this.zoneNum, st = this.stageNum, w = this.waveNum;
        this.enemies = [];
        let enemyCount = clamp(3 + Math.floor(z * 1.1) + Math.floor(st * 0.45) + Math.floor(w * 0.7), 4, 18);
        let patterns = ["down", "zigzag", "sine"];
        if (z > 3) patterns.push("fast");
        if (st > 7 && z > 2) patterns.push("zigzag");
        if (z === ZONES && st === STAGES_PER_ZONE && w === WAVES_PER_STAGE) {

            this.enemies.push(new window.Enemy(this, "boss", GAME_WIDTH/2, 120, {
                radius: 50, speed: 1.5, 
                color: "#ffb200", hp: 70+Math.floor(this.score/20), value: 500, pattern: "boss"
            }));
            this.effectManager.addBanner("FINAL BOSS", "#ffb200", 96);
            return;
        }
        for (let i = 0; i < enemyCount; ++i) {

            let px = lerp(50, GAME_WIDTH-50, i/(enemyCount-1));
            let py = rand(30, 90);
            let pattern = patterns[Math.floor(Math.random() * patterns.length)];
            let color = "#ff5341";
            let hp = 1 + Math.floor(z/2) + Math.floor(st/5) + Math.floor(w/5);
            let value = 8 + z*2 + st + Math.floor(w/2);
            if (pattern === "zigzag") color = "#ffb200";
            if (pattern === "sine") color = "#ff50b8";
            if (pattern === "fast") color = "#6ef7fe";
            this.enemies.push(new window.Enemy(this, "basic", px, py, {
                radius: ENEMY_BASE_RADIUS + rand(-3, 3),
                speed: ENEMY_BASE_SPEED + 0.2 * z + 0.07 * st + rand(-0.1, 0.13),
                color, hp, value, pattern
            }));
        }
    }

    addCurrency(amount) {
        this.currency += amount;
        this.renderHud();
    }
};



function initGame() {
    const canvas = document.getElementById('gameCanvas');
    const uiOverlay = document.getElementById('uiOverlay');
    if (!canvas || !uiOverlay) {
        alert("Game failed to initialize. Please reload.");
        return;
    }
    window.__spaceShooterGame = new window.GameManager(canvas, uiOverlay);
}

window.addEventListener('DOMContentLoaded', initGame);

})();