'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';

/* ─────────────────────────────────────────────
   SVG Defaults
───────────────────────────────────────────── */
const DEFAULT_SVG_CAM = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300F5FF'><path d='M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'/></svg>";
const DEFAULT_SVG_HEADSET = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FFD700'><path d='M12 1a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H5v-4a7 7 0 1 1 14 0v4h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z'/></svg>";
const DEFAULT_SVG_PIX = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><path d='M141.4 141.4L256 256L141.4 370.6L26.8 256Z' fill='%2300F5FF'/><path d='M370.6 141.4L256 256L370.6 370.6L485.2 256Z' fill='%2300F5FF'/><path d='M256 141.4L370.6 256L256 370.6L141.4 256Z' fill='%230080FF'/></svg>";

const CoinSVG = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="url(#coinGrad)" stroke="#FFD700" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="7" stroke="#FFE866" strokeWidth="1.5" strokeDasharray="2 2"/>
    <path d="M12 7.5V16.5M9.5 10H14.5M9.5 14H14.5" stroke="#FFF5B3" strokeWidth="2" strokeLinecap="round"/>
    <defs>
      <linearGradient id="coinGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFCC00"/>
        <stop offset="1" stopColor="#D48800"/>
      </linearGradient>
    </defs>
  </svg>
);

/* Paleta dos segmentos da roleta — vermelho e preto alternados */
const SLICE_COLORS_EVEN = '#CC0000'; // vermelho vivo
const SLICE_COLORS_ODD  = '#1A0000'; // preto-avermelhado

/* ─────────────────────────────────────────────
   Tipos
───────────────────────────────────────────── */
interface Config {
  title: string;
  prize: string;
  forcedWinner: string;
  participants: string[];
}

interface UserData {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  coins: number;
  balance: number;
}

type Screen = 'landing' | 'game';
type ModalId = 'none' | 'shop' | 'pix' | 'winner' | 'adminLogin' | 'admin' | 'withdraw';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function isValidCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0, rem: number;
  for (let i = 1; i <= 9; i++) sum += parseInt(c[i - 1]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(c[i - 1]) * (12 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(c[10]);
}

function isValidPhone(phone: string): boolean {
  const c = phone.replace(/\D/g, '');
  return c.length === 11 && parseInt(c.substring(0, 2)) >= 11;
}

function maskCpf(v: string): string {
  return v.replace(/\D/g, '').substring(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v: string): string {
  return v.replace(/\D/g, '').substring(0, 11)
    .replace(/^(\d{2})(\d)/g, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2');
}

/* ─────────────────────────────────────────────
   COMPONENT PRINCIPAL
───────────────────────────────────────────── */
export default function Home() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [modal, setModal] = useState<ModalId>('none');
  const [config, setConfig] = useState<Config>({
    title: 'ROLETA DO PIX',
    prize: 'Pix de R$ 50',
    forcedWinner: '',
    participants: ['R$ 50', 'R$ 100', 'Tente Novamente', 'R$ 200', 'R$ 20', 'R$ 500', 'R$ 30', 'R$ 150'],
  });

  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [usersDB, setUsersDB] = useState<Record<string, UserData>>({});

  // Form fields
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [cpfErr, setCpfErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');

  // Shop
  const [selectedPkg, setSelectedPkg] = useState(3);

  // PIX modal
  const [pixQr, setPixQr] = useState('');
  const [pixCode, setPixCode] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Withdraw
  const [withdrawPixKey, setWithdrawPixKey] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState('');

  // Winner
  const [winner, setWinner] = useState('');

  // Admin
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [cfgTitle, setCfgTitle] = useState('');
  const [cfgPrize, setCfgPrize] = useState('');
  const [cfgParticipants, setCfgParticipants] = useState('');
  const [cfgForcedWinner, setCfgForcedWinner] = useState('');

  // Canvas wheel
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startAngleRef = useRef(0);
  const isSpinningRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickRef = useRef(-1);
  const [spinning, setSpinning] = useState(false);

  // Fake Winners Ticker
  const fakeWinnersList = [
    { name: 'Paulo M.', prize: 'R$ 100' },
    { name: 'Adriana S.', prize: 'R$ 500' },
    { name: 'Lucas T.', prize: 'R$ 50' },
    { name: 'Mariana C.', prize: 'Action Cam 4K' },
    { name: 'Roberto V.', prize: 'R$ 100' },
    { name: 'Fernanda P.', prize: 'Headset Gamer' },
    { name: 'Carlos E.', prize: 'R$ 50' },
  ];
  const [fakeWinnerIndex, setFakeWinnerIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFakeWinnerIndex(prev => (prev + 1) % fakeWinnersList.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  /* ── Load Config and Users ── */
  useEffect(() => {
    // Carrega usuários do localStorage (mantido por enquanto até migrar tudo para Supabase)
    try {
      const savedDB = localStorage.getItem('pds_users_v4');
      if (savedDB) setUsersDB(JSON.parse(savedDB));
    } catch {}

    // Busca configurações reais do Supabase
    fetch('/api/admin/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setConfig({
            title: data.title || 'ROLETA DO PIX',
            prize: data.prize || 'Pix de R$ 50',
            forcedWinner: data.forced_winner || '',
            participants: data.participants && data.participants.length >= 2 ? data.participants : ['R$ 100', 'R$ 50', 'Tente Novamente', 'R$ 200'],
          });
        }
      })
      .catch(console.error);
  }, []);

  /* ── Draw wheel whenever config changes ── */
  useEffect(() => { drawWheel(); }, [config]);

  /* ─────── CANVAS WHEEL ─────── */
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const n = config.participants.length;
    if (n === 0) return;

    const CX = 300, CY = 300, R = 235, INNER = 68;
    const arc = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, 600, 600);

    /* ── 1. GLOW EXTERNO CYBERPUNK ── */
    const glowGrad = ctx.createRadialGradient(CX, CY, R - 20, CX, CY, R + 80);
    glowGrad.addColorStop(0, 'rgba(0,255,204,0.3)'); // Cyan
    glowGrad.addColorStop(0.5, 'rgba(255,0,255,0.15)'); // Pink
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(CX, CY, R + 80, 0, 2 * Math.PI);
    ctx.fill();

    /* ── 2. SEGMENTOS ── */
    for (let i = 0; i < n; i++) {
      const angle = startAngleRef.current + i * arc;
      
      // Cyberpunk colors: alternate dark purple and dark cyan
      const isPurple = i % 2 === 0;
      
      const midAngle = angle + arc / 2;
      const gx1 = CX + Math.cos(midAngle) * INNER;
      const gy1 = CY + Math.sin(midAngle) * INNER;
      const gx2 = CX + Math.cos(midAngle) * R;
      const gy2 = CY + Math.sin(midAngle) * R;
      const segGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
      
      if (isPurple) {
        segGrad.addColorStop(0, '#1a0033');
        segGrad.addColorStop(1, '#2d004d');
      } else {
        segGrad.addColorStop(0, '#001a33');
        segGrad.addColorStop(1, '#00334d');
      }

      ctx.fillStyle = segGrad;
      ctx.beginPath();
      ctx.arc(CX, CY, R, angle, angle + arc, false);
      ctx.arc(CX, CY, INNER, angle + arc, angle, true);
      ctx.closePath();
      ctx.fill();

      // Linha divisora NEON
      ctx.strokeStyle = isPurple ? '#00FFCC' : '#FF00FF'; // Cyan / Pink dividers
      ctx.lineWidth = 3;
      ctx.shadowColor = isPurple ? '#00FFCC' : '#FF00FF';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(angle) * INNER, CY + Math.sin(angle) * INNER);
      ctx.lineTo(CX + Math.cos(angle) * R, CY + Math.sin(angle) * R);
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* Texto do segmento holográfico */
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = isPurple ? '#FF00FF' : '#00FFCC';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      const label = config.participants[i];
      const textAngle = angle + arc / 2;
      const textR = INNER + (R - INNER) * 0.55;
      ctx.translate(CX + Math.cos(textAngle) * textR, CY + Math.sin(textAngle) * textR);
      ctx.rotate(textAngle + Math.PI / 2);

      const isValue = label.startsWith('R$');
      if (isValue && label.length > 6) {
        const parts = label.split(' ');
        ctx.font = 'bold 14px "Orbitron", Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(parts[0], 0, -8);
        ctx.font = '900 18px "Orbitron", Poppins, sans-serif';
        ctx.fillText(parts.slice(1).join(' '), 0, 10);
      } else {
        const fontSize = label.length > 10 ? 12 : label.length > 7 ? 14 : 16;
        ctx.font = `bold ${fontSize}px "Orbitron", Poppins, sans-serif`;
        ctx.textAlign = 'center';
        let shortLabel = label;
        if (shortLabel.length > 12) shortLabel = shortLabel.substring(0, 10) + '..';
        ctx.fillText(shortLabel, 0, 6);
      }
      ctx.textAlign = 'left';
      ctx.restore();

      /* ◆ ícone pequeno no segmento */
      ctx.save();
      const iconAngle = angle + arc / 2;
      const iconR = INNER + (R - INNER) * 0.85;
      const ix = CX + Math.cos(iconAngle) * iconR;
      const iy = CY + Math.sin(iconAngle) * iconR;
      ctx.translate(ix, iy);
      ctx.rotate(iconAngle + Math.PI / 2);
      const s = 6;
      ctx.fillStyle = isPurple ? '#FF00FF' : '#00FFCC';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* ── 3. BORDA EXTERNA CYBERPUNK (HUD) ── */
    const rimR = R + 10;
    
    // Fundo escuro da borda
    ctx.beginPath();
    ctx.arc(CX, CY, rimR + 15, 0, 2 * Math.PI);
    ctx.lineWidth = 30;
    ctx.strokeStyle = '#050011';
    ctx.stroke();

    // Anel externo tracejado (Tech HUD)
    ctx.beginPath();
    ctx.arc(CX, CY, rimR + 25, 0, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)'; // Cyan
    ctx.setLineDash([10, 15]);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Anel de neon brilhante
    ctx.beginPath();
    ctx.arc(CX, CY, rimR, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FF00FF'; // Neon Pink
    ctx.shadowColor = '#FF00FF';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Detalhes tech (pequenos arcos)
    ctx.beginPath();
    ctx.arc(CX, CY, rimR + 8, Math.PI * 0.2, Math.PI * 0.8);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00FFCC';
    ctx.shadowColor = '#00FFCC';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CX, CY, rimR + 8, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* ── 4. HUB CENTRAL GLASSMORPHISM ── */
    // Base hub vidro fosco
    ctx.beginPath();
    ctx.arc(CX, CY, INNER + 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(10, 0, 20, 0.7)'; // Dark translucent purple
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Reflexo glass
    const glassGrad = ctx.createLinearGradient(CX - INNER, CY - INNER, CX + INNER, CY + INNER);
    glassGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
    glassGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    glassGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.beginPath();
    ctx.arc(CX, CY, INNER + 4, 0, 2 * Math.PI);
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Anel neon no centro
    ctx.beginPath();
    ctx.arc(CX, CY, INNER - 8, 0, 2 * Math.PI);
    ctx.strokeStyle = '#00FFCC'; // Cyan
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FFCC';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ◆ Logo PIX central Cyberpunk
    const ps = 16;
    const px = CX, py = CY - 10;
    const drawDiamond = (dx: number, dy: number, size: number, color: string) => {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(dx, dy - size);
      ctx.lineTo(dx + size, dy);
      ctx.lineTo(dx, dy + size);
      ctx.lineTo(dx - size, dy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const dOff = ps * 0.75;
    drawDiamond(px - dOff, py - dOff, ps * 0.65, '#00FFCC'); // Cyan
    drawDiamond(px + dOff, py - dOff, ps * 0.65, '#00FFCC');
    drawDiamond(px - dOff, py + dOff, ps * 0.65, '#FF00FF'); // Pink
    drawDiamond(px + dOff, py + dOff, ps * 0.65, '#FF00FF');

    // Texto "PIX" cyberpunk
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#00FFCC';
    ctx.shadowBlur = 8;
    ctx.font = '900 16px "Orbitron", Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIX', CX, CY + INNER * 0.6);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

  }, [config]);

  /* ─────── AUDIO ─────── */
  function initAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  }

  function playTick() {
    const ac = audioCtxRef.current;
    if (!ac) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.025);
      gain.gain.setValueAtTime(0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.025);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.025);
    } catch {}
  }

  function playWin() {
    const ac = audioCtxRef.current;
    if (!ac) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => {
        try {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.frequency.setValueAtTime(freq, ac.currentTime);
          gain.gain.setValueAtTime(0.3, ac.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
          osc.connect(gain); gain.connect(ac.destination);
          osc.start(); osc.stop(ac.currentTime + 0.5);
        } catch {}
      }, i * 100);
    });
  }

  /* ─────── SPIN ─────── */
  function spinWheel() {
    if (isSpinningRef.current || config.participants.length === 0) return;
    if (!currentUser || currentUser.coins <= 0) { setModal('shop'); return; }

    // Debita moeda visualmente de imediato
    const updated = { ...currentUser, coins: currentUser.coins - 1 };
    setCurrentUser(updated);

    initAudio();
    isSpinningRef.current = true;
    setSpinning(true);

    const n = config.participants.length;
    const arc = (2 * Math.PI) / n;

    // Determina índice alvo
    let targetIdx = -1;
    if (config.forcedWinner) {
      targetIdx = config.participants.indexOf(config.forcedWinner);
    }
    if (targetIdx === -1) targetIdx = Math.floor(Math.random() * n);

    /*
     * O ponteiro está no TOPO da roleta (ângulo -π/2 = 3π/2 = 270°).
     * Queremos que o CENTRO do segmento alvo esteja nesse ponto.
     * Centro do segmento i em relação ao startAngle:
     *   ângulo_centro = startAngle + targetIdx * arc + arc/2
     * Para que esse ângulo seja -π/2 (mod 2π), precisamos:
     *   startAngle = -π/2 - targetIdx*arc - arc/2  (mod 2π)
     *
     * Adicionamos N voltas completas (7 voltas) para dar efeito de giro.
     */
    const targetAngleAtTop = -Math.PI / 2 - targetIdx * arc - arc / 2;
    const currentNorm = startAngleRef.current % (2 * Math.PI);
    let targetNorm = ((targetAngleAtTop % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Quanto girar a partir da posição atual
    let delta = ((targetNorm - currentNorm) + 2 * Math.PI) % (2 * Math.PI);
    if (delta < 0.1) delta += 2 * Math.PI; // garante pelo menos uma volta

    const totalRad = 2 * Math.PI * 7 + delta; // 7 voltas + alinhamento final
    const duration = 5500;
    const startTime = performance.now();
    const initialAngle = startAngleRef.current;

    function animate(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      startAngleRef.current = initialAngle + totalRad * ease;

      const currentSlice = Math.floor(((startAngleRef.current % (2 * Math.PI)) + 2 * Math.PI) / arc) % n;
      if (currentSlice !== lastTickRef.current) { playTick(); lastTickRef.current = currentSlice; }
      drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isSpinningRef.current = false;
        setSpinning(false);
        calculateWinner();
      }
    }
    requestAnimationFrame(animate);
  }

  function calculateWinner() {
    const n = config.participants.length;
    const arc = (2 * Math.PI) / n;
    /*
     * O ponteiro está no TOPO (ângulo -π/2 no sistema do canvas).
     * O ângulo no topo em relação ao startAngle é:
     *   -π/2 - startAngle  =>  normalizado: ((-π/2 - startAngle) mod 2π + 2π) mod 2π
     * O índice vencedor é o segmento que contém esse ângulo.
     */
    const angleAtTop = ((-Math.PI / 2 - startAngleRef.current) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const winIdx = Math.floor(angleAtTop / arc) % n;
    const result = config.participants[winIdx];
    playWin();
    setWinner(result);

    // Call API to sync win and balance
    if (currentUser) {
      fetch('/api/game/win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, result })
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setCurrentUser(prev => prev ? { ...prev, coins: data.newCoins, balance: data.newBalance } : prev);
        }
      })
      .catch(console.error);
    }

    // Efeito Ganhador (Explosão Gigante de Confetes)
    if (typeof (window as any).confetti === 'function') {
      const duration = 3000;
      const end = Date.now() + duration;

      (function frame() {
        (window as any).confetti({
          particleCount: 8,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#00FF88', '#AAFF00', '#ffffff']
        });
        (window as any).confetti({
          particleCount: 8,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#00FF88', '#AAFF00', '#ffffff']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }

    // Fala o resultado
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      let phrase = '';
      const firstName = currentUser?.name?.split(' ')[0] || '';
      if (result.toLowerCase().includes('tente novamente')) {
        phrase = `Que pena ${firstName}, não foi dessa vez. Tente novamente!`;
      } else {
        // Remove "R$" e "PIX" para não ler "R cifrão"
        let falado = result.replace(/R\$/gi, '').replace(/PIX/gi, '').trim();
        
        // Verifica se sobrou apenas números e formatação (pontos, vírgulas)
        const isApenasNumeros = /^[\d\.,]+$/.test(falado);
        
        if (isApenasNumeros) {
          phrase = `${firstName}, você ganhou ${falado} reais!`;
        } else {
          phrase = `${firstName}, você ganhou ${falado}!`;
        }
      }
      const msg = new SpeechSynthesisUtterance(phrase);
      msg.lang = 'pt-BR';
      window.speechSynthesis.speak(msg);
    }

    setModal('winner');
  }

  /* ─────── AUTH ─────── */
  async function handleAuth() {
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');
    let err = false;

    if (!name.trim()) { alert('Informe seu nome completo!'); return; }

    if (!isValidCPF(cleanCpf)) { setCpfErr('CPF inválido! Digite um CPF real.'); err = true; }
    else setCpfErr('');

    if (!isValidPhone(cleanPhone)) { setPhoneErr('Número de telefone inválido!'); err = true; }
    else setPhoneErr('');

    if (err) return;

    // Tenta registrar via API
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cpf: cleanCpf, phone: cleanPhone }),
      });
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
        setScreen('game');
        setTimeout(drawWheel, 100);
      } else {
        alert(data.error || 'Erro ao conectar com servidor.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  }

  /* ─────── WITHDRAW ─────── */
  async function handleWithdraw() {
    if (!withdrawPixKey) { setWithdrawMsg('Informe sua chave PIX.'); return; }
    setWithdrawMsg('Processando...');

    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          amount: currentUser?.balance,
          pixKey: withdrawPixKey,
          cpf: currentUser?.cpf
        })
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawMsg('Saque solicitado com sucesso!');
        setCurrentUser(prev => prev ? { ...prev, balance: data.newBalance } : prev);
        setTimeout(() => {
          setModal('none');
          setWithdrawPixKey('');
          setWithdrawMsg('');
        }, 2000);
      } else {
        setWithdrawMsg(data.error || 'Erro ao solicitar saque.');
      }
    } catch {
      setWithdrawMsg('Erro de conexão.');
    }
  }

  /* ─────── PAYMENT ─────── */
  async function generatePixPayment() {
    const qty = selectedPkg;
    const amount = parseFloat((qty * 0.5).toFixed(2));

    setModal('pix');
    setPixCode('Gerando chave Pix...');
    setPixQr('');

    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, coinsQty: qty, amount }),
      });
      const data = await res.json();
      if (data.qrCode && data.qrBase64) {
        setPixCode(data.qrCode);
        setPixQr(`data:image/png;base64,${data.qrBase64}`);
        startPolling(data.paymentId, qty);
        return;
      }
    } catch {}

    // Fallback visual
    const fallback = `00020126580014br.gov.bcb.pix0136${currentUser?.cpf}520400005303986540${amount.toFixed(2)}5802BR5920Pix da Sorte6009Campinas62070503***6304`;
    setPixCode(fallback);
    setPixQr(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fallback)}`);
  }

  function startPolling(paymentId: string, qty: number) {
    cancelPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/status?id=${paymentId}`);
        const data = await res.json();
        if (data.status === 'approved') {
          cancelPolling();
          const updated = { ...currentUser!, coins: currentUser!.coins + qty };
          setCurrentUser(updated);
          const newDB = { ...usersDB, [updated.id]: updated };
          setUsersDB(newDB);
          localStorage.setItem('pds_users_v4', JSON.stringify(newDB));
          setModal('none');
          alert(`🎉 +${qty} moedas adicionadas com sucesso!`);
        }
      } catch {}
    }, 3500);
  }

  function cancelPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setModal('none');
  }

  /* ─────── RENDER ─────── */
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js" strategy="lazyOnload" />

      {/* BACKGROUND */}
      <div className={`bg-scene ${screen === 'landing' ? 'bg-landing' : screen === 'game' ? 'bg-game' : ''}`}>
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="page-wrapper">
        {/* TOP BAR */}
        <div className="announcement-bar">
          🔥 CADASTRE-SE GRÁTIS E GANHE 3 MOEDAS PARA GIRAR AGORA! 🔥
        </div>

        {/* ════════════════════════════════
            LANDING PAGE
        ════════════════════════════════ */}
        {screen === 'landing' && (
          <div className="container" style={{ paddingTop: '28px', paddingBottom: '60px' }}>
            {/* Hero */}
            <div className="hero-header">
              {/* Logo */}
              <div className="pix-logo-wrap" style={{ marginBottom: '20px' }}>
                <div className="pix-logo-ring" />
                <div className="pix-logo-inner">
                  <svg width="52" height="52" viewBox="0 0 512 512" fill="none">
                    <path d="M141.4 141.4L256 256L141.4 370.6L26.8 256Z" fill="#00FF88"/>
                    <path d="M370.6 141.4L256 256L370.6 370.6L485.2 256Z" fill="#00FF88"/>
                    <path d="M256 141.4L370.6 256L256 370.6L141.4 256Z" fill="#00CC55"/>
                    <path d="M256 182L330 256L256 330L182 256Z" fill="rgba(0,15,5,0.95)"/>
                  </svg>
                </div>
              </div>

              <p className="hero-eyebrow">🎰 ROLETA DO PIX OFICIAL 🎰</p>
              <h1 className="hero-title" style={{ fontSize: '3.5rem', lineHeight: '1.1' }}>
                <span>JOGUE E</span><br />
                <span>GANHE</span>
              </h1>
              <p className="hero-desc" style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                Junte-se a milhares de brasileiros ganhando todo dia! Cadastre-se, ganhe 3 moedas e gire a roleta oficial!
              </p>
            </div>

            {/* LIVE TICKER */}
            <div className="glass-panel" style={{ width: '100%', marginBottom: '24px', padding: '16px' }}>
              <div className="live-dot" />
              <p className="live-text ticker-anim" key={fakeWinnerIndex}>
                <strong className="prize-highlight">{fakeWinnersList[fakeWinnerIndex].name}</strong> acabou de ganhar <strong className="cost-amount">{fakeWinnersList[fakeWinnerIndex].prize}</strong> • agora mesmo
              </p>
            </div>


            {/* SIGNUP */}
            <div className="signup-card">
              <div className="signup-label">
                <span className="signup-badge">GRÁTIS</span>
                <h2 className="signup-title">Criar Conta & Jogar</h2>
              </div>

              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Digite seu nome..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  id="authName"
                />
              </div>

              <div className="form-group">
                <label className="form-label">CPF Válido</label>
                <input
                  className={`form-input ${cpfErr ? 'error' : ''}`}
                  type="text"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={cpf}
                  onChange={e => setCpf(maskCpf(e.target.value))}
                  id="authCpf"
                />
                {cpfErr && <p className="form-error visible">{cpfErr}</p>}
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">WhatsApp (com DDD)</label>
                <input
                  className={`form-input ${phoneErr ? 'error' : ''}`}
                  type="text"
                  placeholder="(00) 90000-0000"
                  maxLength={15}
                  value={phone}
                  onChange={e => setPhone(maskPhone(e.target.value))}
                  id="authPhone"
                />
                {phoneErr && <p className="form-error visible">{phoneErr}</p>}
              </div>

              <button className="btn btn-hero" onClick={handleAuth} id="authSubmitBtn">
                🚀 VAMOS JOGAR
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '12px' }}>
                🔒 Seus dados estão seguros. Apenas 1 resgate por usuário.
              </p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            GAME SCREEN
        ════════════════════════════════ */}
        {screen === 'game' && (
          <div className="game-screen" style={{ paddingTop: '20px' }}>
            {/* HUD */}
            <div className="hud-bar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div className="hud-user">
                <span className="hud-username">{currentUser?.name}</span>
                <span className="hud-logout" onClick={() => {
                  setCurrentUser(null);
                  setScreen('landing');
                }}>Sair</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="coins-badge" onClick={() => setModal('shop')} role="button" id="coinsBtn">
                  <CoinSVG size={22} />
                  <span className="coins-count">{currentUser?.coins ?? 0}</span>
                  <span className="coins-label">+ Recarregar</span>
                </div>
                <div className="coins-badge" style={{ background: 'rgba(0,255,136,0.15)', borderColor: '#00FF88' }} onClick={() => setModal('withdraw')} role="button">
                  <span style={{ color: '#00FF88', fontWeight: 'bold' }}>R$ {parseFloat(String(currentUser?.balance || 0)).toFixed(2).replace('.', ',')}</span>
                  <span className="coins-label" style={{ color: '#00FF88' }}>💸 Sacar</span>
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="game-title" id="gameTitle">{config.title}</h1>
            <div className="prize-badge" id="prizeBadge">
              🏆 {config.prize}
            </div>

            {/* Wheel */}
            <div className="wheel-container" style={{ marginTop: '20px' }}>
              <div className="wheel-glow" />
              <div className="wheel-pointer" />
              <canvas ref={canvasRef} id="wheel" width={600} height={600} />
              <button
                className="spin-btn"
                onClick={spinWheel}
                disabled={spinning}
                id="spinBtn"
              >
                {spinning ? '...' : 'GIRAR'}
              </button>
            </div>

            <div className="cost-badge">
              <span>Custo por giro:</span> <strong className="cost-amount" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CoinSVG size={18} /> 1 moeda</strong>
            </div>

            {/* Live feed mini */}
            <div className="glass-panel" style={{ maxWidth: '340px' }}>
              <div className="live-dot" />
              <p className="live-text">
                Roleta ao vivo — <strong className="prize-highlight">{config.participants.length} prêmios</strong> disponíveis
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────
          ADMIN FLOAT BUTTON REMOVED (accessed via /admin)
      ────────────────────────────────────────────── */}

      {/* ══════════════════════════════════════════════
          MODAL: SHOP
      ══════════════════════════════════════════════ */}
      <div className={`modal-overlay ${modal === 'shop' ? 'open' : ''}`} id="shopModal">
        <div className="modal-box" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.5))' }}>
            <CoinSVG size={70} />
          </div>
          <h2 className="modal-title" style={{ fontSize: '1.8rem', color: '#FFF' }}>Recarregar <span style={{ color: 'var(--gold)' }}>Moedas</span></h2>

          <div className="alert-warning" style={{ background: 'rgba(0,255,136,0.05)', borderColor: 'rgba(0,255,136,0.2)', color: 'var(--text-muted)' }}>
            💡 Suas moedas acabaram! Compre mais para continuar girando e concorrer aos prêmios.
          </div>

          <div className="package-options">
            {[
              { qty: 2, price: 1.00 },
              { qty: 3, price: 1.50 },
              { qty: 6, price: 3.00, hot: true },
              { qty: 10, price: 5.00 },
              { qty: 20, price: 10.00, best: true },
              { qty: 50, price: 22.00, best: false },
            ].map(pkg => (
              <div
                key={pkg.qty}
                className={`package-option ${selectedPkg === pkg.qty ? 'selected' : ''}`}
                onClick={() => setSelectedPkg(pkg.qty)}
                id={`pkg-${pkg.qty}`}
              >
                {pkg.hot && <span className="package-badge" style={{ background: '#FF4444', color: '#FFF', boxShadow: '0 0 10px rgba(255,50,50,0.4)' }}>🔥 Popular</span>}
                {pkg.best && <span className="package-badge" style={{ background: 'var(--gold)', color: '#000', boxShadow: '0 0 10px rgba(255,215,0,0.4)' }}>💎 Melhor</span>}
                <span className="package-coins" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CoinSVG size={24} /> {pkg.qty}
                </span>
                <span className="package-price">R$ {pkg.price.toFixed(2).replace('.', ',')}</span>
              </div>
            ))}
          </div>

          <div className="checkout-total">
            <p className="total-label">Total a pagar via PIX:</p>
            <p className="total-value" style={{ textShadow: '0 0 15px rgba(255,215,0,0.4)' }}>R$ {(selectedPkg * 0.5).toFixed(2).replace('.', ',')}</p>
          </div>

          <button className="btn btn-hero" onClick={generatePixPayment} id="payBtn" style={{ marginBottom: '8px' }}>
            💠 GERAR PIX
          </button>
          <button className="btn btn-ghost" onClick={() => setModal('none')}>VOLTAR</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MODAL: PIX QR
      ══════════════════════════════════════════════ */}
      <div className={`modal-overlay ${modal === 'pix' ? 'open' : ''}`} id="pixModal">
        <div className="modal-box" style={{ textAlign: 'center' }}>
          <h2 className="modal-title" style={{ color: 'var(--cyan)' }}>Pagamento PIX</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Escaneie o QR Code ou use o Pix Copia e Cola no app do seu banco.
          </p>

          {pixQr && (
            <div className="qr-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pixQr} alt="QR Code PIX" width={180} height={180} />
            </div>
          )}

          <div className="payment-pulse">
            <div className="live-dot" />
            <span>Aguardando confirmação bancária...</span>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'left' }}>Pix Copia e Cola:</label>
            <div className="pix-code-box" id="pixCodeBox">{pixCode}</div>
          </div>

          <button
            className="btn btn-primary mb-10"
            onClick={() => {
              navigator.clipboard.writeText(pixCode).then(() => alert('✅ Código copiado!'));
            }}
            id="copyPixBtn"
          >
            📋 COPIAR CÓDIGO PIX
          </button>
          <button className="btn btn-ghost" onClick={cancelPolling}>Cancelar</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MODAL: WINNER
      ══════════════════════════════════════════════ */}
      <div className={`modal-overlay winner-modal ${modal === 'winner' ? 'open' : ''}`} id="winnerModal">
        <div className="modal-box" style={{ textAlign: 'center' }}>
          <span className="winner-emoji">🎉</span>
          <h2 className="modal-title" style={{ color: '#fff', marginBottom: '4px' }}>RESULTADO!</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {config.title}
          </p>
          <div className="winner-result" id="winnerDisplay">{winner}</div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
            Prêmio: <strong style={{ color: 'var(--gold)' }}>{config.prize}</strong>
          </p>
          <button className="btn btn-gold" onClick={() => setModal('none')} id="continueBtn">
            🎯 GIRAR NOVAMENTE
          </button>
        </div>
      </div>

    {/* ══════════════════════════════════════════════
        MODAL: WITHDRAW
    ══════════════════════════════════════════════ */}
    <div className={`modal-overlay ${modal === 'withdraw' ? 'open' : ''}`}>
      <div className="modal-box">
        <h2 className="modal-title">💸 Saque via PIX</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Saldo disponível: <strong>R$ {parseFloat(String(currentUser?.balance || 0)).toFixed(2).replace('.', ',')}</strong><br/>
          CPF Cadastrado: <strong>{currentUser?.cpf}</strong>
        </p>

        <div className="form-group mb-20">
          <label className="form-label">Sua Chave PIX</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Digite sua chave PIX..."
            value={withdrawPixKey}
            onChange={(e) => setWithdrawPixKey(e.target.value)}
          />
        </div>

        {withdrawMsg && <p style={{ color: '#00FF88', fontSize: '0.85rem', marginBottom: '16px' }}>{withdrawMsg}</p>}

        <button className="btn btn-hero mb-10" onClick={handleWithdraw}>
          ✅ CONFIRMAR SAQUE
        </button>
        <button className="btn btn-ghost" onClick={() => { setModal('none'); setWithdrawMsg(''); }}>
          Cancelar
        </button>
      </div>
    </div>

    </>
  );
}
