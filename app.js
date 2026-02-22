import { 
    db, ref, push, set, onChildAdded, onChildRemoved, 
    remove, onValue, onDisconnect, update 
} from "./firebase-config.js";

const rocket = {
    // --- الإعدادات الأساسية ---
    role: 'student',
    isAdmin: false,
    userName: '',
    room: '',
    currentPage: 1,
    mode: 'pen', // pen, marker, neon, brush, eraser, move
    currentColor: '#000000',
    currentThickness: 3,
    zoom: 1,
    camera: { x: 0, y: 0 },
    isDrawing: false,
    isDragging: false,
    currentPath: [],
    lastMouse: { x: 0, y: 0 },
    drawings: {},

    init() {
        this.canvas = document.getElementById('board');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.setupEventListeners();
        this.startTimer();
        window.addEventListener('resize', () => this.resize());
    },

    // --- 1. نظام الدخول والغرف ---
    async login(role) {
        const name = document.getElementById('userName').value.trim();
        const room = document.getElementById('roomID').value.trim();
        const pass = document.getElementById('roomPass').value.trim();

        if (!name || !room) return alert("يا مستر، لازم تدخل الاسم ورقم الغرفة!");

        const roomRef = ref(db, `rooms/${room}/config`);
        
        onValue(roomRef, (snap) => {
            const config = snap.val();
            if (role === 'teacher') {
                if (!config || config.pass === pass) {
                    if (!config) set(roomRef, { pass: pass, creator: name });
                    this.startSession(name, room, true);
                } else {
                    alert("كلمة السر غلط يا مستر كريم!");
                }
            } else {
                if (config) {
                    this.startSession(name, room, false);
                } else {
                    alert("الغرفة دي لسه متبنتش، استنى المستر يفتحها!");
                }
            }
        }, { onlyOnce: true });
    },

    startSession(name, room, isAdmin) {
        this.userName = name;
        this.room = room;
        this.isAdmin = isAdmin;
        this.role = isAdmin ? 'teacher' : 'student';

        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-toolbar').style.display = 'flex';
        document.getElementById('room-display').innerText = room;
        if (isAdmin) document.getElementById('teacher-tools').classList.remove('hidden-tools');

        // تسجيل الحضور
        const userRef = push(ref(db, `rooms/${this.room}/users`));
        set(userRef, { name, role: this.role });
        onDisconnect(userRef).remove();

        this.syncWithFirebase();
        this.render();
    },

    // --- 2. المزامنة (Firebase) ---
    syncWithFirebase() {
        const roomPath = `rooms/${this.room}`;
        
        // مزامنة الرسم
        onChildAdded(ref(db, `${roomPath}/board`), (s) => this.drawings[s.key] = s.val());
        onChildRemoved(ref(db, `${roomPath}/board`), (s) => delete this.drawings[s.key]);

        // مزامنة المستخدمين
        onValue(ref(db, `${roomPath}/users`), (s) => {
            const users = s.val() ? Object.values(s.val()) : [];
            document.getElementById('user-count').innerText = users.length;
            document.getElementById('users-list').innerHTML = users.map(u => 
                `<div class="user-row"><span class="status-dot"></span> ${u.name} ${u.role === 'teacher' ? '(المستر)' : ''}</div>`
            ).join('');
        });

        // مزامنة الشات
        onChildAdded(ref(db, `${roomPath}/chat`), (s) => {
            const d = s.val();
            const div = document.createElement('div');
            div.className = `msg ${d.user === this.userName ? 'msg-me' : 'msg-them'}`;
            div.innerHTML = `<b>${d.user}:</b> ${d.text}`;
            const container = document.getElementById('chat-messages');
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        });
    },

    // --- 3. لوجيك الرسم (المساحة الذكية) ---
    setupEventListeners() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || e.touches?.[0].clientX;
            const clientY = e.clientY || e.touches?.[0].clientY;
            return {
                x: (clientX - rect.left - this.camera.x) / this.zoom,
                y: (clientY - rect.top - this.camera.y) / this.zoom
            };
        };

        this.canvas.addEventListener('pointerdown', (e) => {
            this.closeAllMenus();
            const pos = getPos(e);
            if (this.mode === 'move' || !this.isAdmin) {
                this.isDragging = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
            } else {
                this.isDrawing = true;
                this.currentPath = [pos];
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isDragging) {
                this.camera.x += e.clientX - this.lastMouse.x;
                this.camera.y += e.clientY - this.lastMouse.y;
                this.lastMouse = { x: e.clientX, y: e.clientY };
            } else if (this.isDrawing) {
                this.currentPath.push(getPos(e));
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isDrawing && this.currentPath.length > 1) {
                push(ref(db, `rooms/${this.room}/board`), {
                    points: this.currentPath,
                    color: this.currentColor,
                    thickness: this.currentThickness,
                    mode: this.mode,
                    page: this.currentPage
                });
            }
            this.isDrawing = false;
            this.isDragging = false;
        });

        // الزوم بالبكرة
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.min(Math.max(this.zoom * delta, 0.1), 10);
            document.getElementById('zoom-info').innerText = Math.round(this.zoom * 100) + "%";
        }, { passive: false });

        // ربط أزرار الواجهة
        this.bindUI();
    },

    bindUI() {
        // تغيير الألوان
        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.onclick = () => {
                this.currentColor = dot.dataset.color;
                document.getElementById('color-trigger').style.color = this.currentColor;
                this.closeAllMenus();
            };
        });

        // تغيير السمك (طلبك الأساسي)
        const slider = document.getElementById('thickness-slider');
        slider.oninput = (e) => {
            this.currentThickness = parseInt(e.target.value);
            document.getElementById('thickness-value').innerText = this.currentThickness;
        };

        // تغيير الأنماط (قلم، ماركر، إلخ)
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.onclick = () => {
                this.mode = btn.dataset.mode;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('pen-trigger').classList.add('active');
                this.closeAllMenus();
            };
        });

        // الأدوات الهندسية
        document.querySelectorAll('[data-geo]').forEach(btn => {
            btn.onclick = () => {
                const el = document.getElementById(btn.dataset.geo);
                el.style.display = el.style.display === 'block' ? 'none' : 'block';
                el.style.top = '200px'; el.style.left = '200px';
                this.closeAllMenus();
            };
        });

        // فتح القوائم
        document.getElementById('color-trigger').onclick = () => this.toggleMenu('color-menu');
        document.getElementById('pen-trigger').onclick = () => this.toggleMenu('pen-menu');
        document.getElementById('geo-trigger').onclick = () => this.toggleMenu('geo-menu');
        
        // أزرار المسح والتراجع
        document.getElementById('undo-btn').onclick = () => this.undo();
        document.getElementById('clear-btn').onclick = () => this.clearBoard();
        document.getElementById('eraser-btn').onclick = () => { this.mode = 'eraser'; this.closeAllMenus(); };
        document.getElementById('move-btn').onclick = () => { this.mode = 'move'; this.closeAllMenus(); };

        // الشات
        document.getElementById('chat-toggle').onclick = () => document.getElementById('chat-panel').style.display = 'flex';
        document.getElementById('send-msg').onclick = () => this.sendMsg();
        document.querySelectorAll('.close-panel').forEach(btn => {
            btn.onclick = () => btn.closest('.side-panel').style.display = 'none';
        });
    },

    // --- 4. الرسوميات (Rendering) ---
    render() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.zoom, this.zoom);

        // رسم كل ما في المخزن
        Object.values(this.drawings).forEach(draw => {
            if (draw.page === this.currentPage) this.drawPath(draw);
        });

        // رسم الخط الحالي (قبل الرفع للسيرفر)
        if (this.isDrawing) {
            this.drawPath({
                points: this.currentPath,
                color: this.currentColor,
                thickness: this.currentThickness,
                mode: this.mode
            });
        }

        requestAnimationFrame(() => this.render());
    },

    drawPath(draw) {
        if (!draw.points || draw.points.length < 2) return;
        this.ctx.beginPath();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        let w = draw.thickness;
        if (draw.mode === 'marker') w *= 3;
        if (draw.mode === 'brush') w *= 5;
        if (draw.mode === 'eraser') w = 40;

        this.ctx.lineWidth = w;
        this.ctx.strokeStyle = draw.color;

        if (draw.mode === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.globalAlpha = (draw.mode === 'brush') ? 0.4 : 1;
            if (draw.mode === 'neon') {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = draw.color;
            } else {
                this.ctx.shadowBlur = 0;
            }
        }

        this.ctx.moveTo(draw.points[0].x, draw.points[0].y);
        for (let i = 1; i < draw.points.length; i++) {
            this.ctx.lineTo(draw.points[i].x, draw.points[i].y);
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
    },

    // --- 5. وظائف إضافية ---
    toggleMenu(id) {
        const el = document.getElementById(id);
        const isOpen = el.classList.contains('show-menu');
        this.closeAllMenus();
        if (!isOpen) el.classList.add('show-menu');
    },

    closeAllMenus() {
        document.querySelectorAll('.sub-menu').forEach(m => m.classList.remove('show-menu'));
    },

    undo() {
        const keys = Object.keys(this.drawings);
        if (keys.length > 0) remove(ref(db, `rooms/${this.room}/board/${keys[keys.length - 1]}`));
    },

    clearBoard() {
        if (confirm("تمسح السبورة كلها يا مستر كريم؟")) {
            Object.keys(this.drawings).forEach(k => {
                if (this.drawings[k].page === this.currentPage) 
                    remove(ref(db, `rooms/${this.room}/board/${k}`));
            });
        }
    },

    sendMsg() {
        const input = document.getElementById('chat-input');
        if (!input.value.trim()) return;
        push(ref(db, `rooms/${this.room}/chat`), { user: this.userName, text: input.value });
        input.value = '';
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    startTimer() {
        let sec = 0;
        setInterval(() => {
            sec++;
            let m = Math.floor(sec / 60), s = sec % 60;
            document.getElementById('timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);
    }
};

// تشغيل الأدوات الهندسية (السحب وتغيير الحجم)
function makeDraggable(el) {
    let px = 0, py = 0;
    el.onpointerdown = (e) => {
        if (e.target.classList.contains('resizer')) return;
        e.preventDefault();
        px = e.clientX; py = e.clientY;
        document.onpointermove = (ee) => {
            el.style.left = (el.offsetLeft + ee.clientX - px) + "px";
            el.style.top = (el.offsetTop + ee.clientY - py) + "px";
            px = ee.clientX; py = ee.clientY;
        };
        document.onpointerup = () => document.onpointermove = null;
    };
}

document.querySelectorAll('.geo-tool').forEach(makeDraggable);

window.rocket = rocket;
rocket.init();
