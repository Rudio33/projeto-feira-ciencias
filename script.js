const $ = function (id) { return document.getElementById(id); };
const tela = $('tela');
const ctx = tela.getContext('2d');
const W = tela.width;
const H = tela.height;
const chaoY = 530;     // altura do chão na tela
const foguetex = 230;  // posição horizontal do foguete
const padX = 400;      // centro da balsa de pouso
const CH = 6;          // altura do convés da balsa

const btnArmar = $('btnArmar');
const btnLancar = $('btnLancar');
const btnReiniciar = $('btnReiniciar');
const elStatus = $('status');
const elAviso = $('aviso');
const elCont = $('contagemGrande');
const itens = document.querySelectorAll('#checklist li');
const fases = document.querySelectorAll('#fases li');

const NOMES = {
  ocioso: 'Aguardando: clique em Armar.',
  armando: 'Verificando sistemas...',
  armado: 'Tudo certo. Clique em Lançar.',
  contagem: 'Contagem regressiva...',
  voando: 'Em voo!',
  orbita: 'Missão concluída. Clique em Reiniciar para voar de novo.'
};
const ALVO_ORBITA = 6500;

// ---------- Estado ----------
let estado, contagem = 5, timerContagem = null, timersArmar = [], timerAviso = null;
let alt, vel, tempo, cam, tremor, pe, feito, booster, sat, detritos, fumaca, ultimaCont;

const estrelas = [];
for (let i = 0; i < 90; i++) {
  estrelas.push({ x: Math.random() * W, y: Math.random() * chaoY, r: Math.random() * 1.4 + 0.4, f: Math.random() * 6 });
}
const nuvens = [];
for (let i = 0; i < 12; i++) {
  nuvens.push({ x: Math.random() * W, wy: 200 + Math.random() * 1900, s: 0.6 + Math.random() });
}

function resetar() {
  clearInterval(timerContagem);
  clearTimeout(timerAviso);
  timersArmar.forEach(clearTimeout);
  timersArmar = [];
  estado = 'ocioso';
  alt = 0; vel = 0; tempo = 0; cam = 0; tremor = 0;
  pe = { estagio1: true, carenagem: true };
  feito = {};
  booster = null; sat = null;
  detritos = []; fumaca = [];
  ultimaCont = '';
  itens.forEach(function (li) { li.classList.remove('ok'); });
  fases.forEach(function (li) { li.classList.remove('feito', 'atual'); });
  elAviso.className = '';
  elCont.textContent = '';
  ui();
}

// ---------- Interface ----------
function ui() {
  btnArmar.disabled = estado !== 'ocioso';
  btnLancar.disabled = estado !== 'armado';
  btnReiniciar.disabled = estado === 'ocioso';
  elStatus.textContent = NOMES[estado];
}

function aviso(txt, ms) {
  clearTimeout(timerAviso);
  elAviso.textContent = txt;
  elAviso.className = 'on';
  if (ms) timerAviso = setTimeout(function () { elAviso.className = ''; }, ms);
}

function marcar(f) {
  if (feito[f]) return;
  feito[f] = true;
  fases.forEach(function (li) { li.classList.remove('atual'); });
  const li = document.querySelector('#fases li[data-fase="' + f + '"]');
  li.classList.add('feito', 'atual');
}

function tempoTxt(s) {
  const n = Math.floor(s);
  return 'T+ ' + String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

btnArmar.addEventListener('click', function () {
  if (estado !== 'ocioso') return;
  estado = 'armando';
  ui();
  itens.forEach(function (li, i) {
    timersArmar.push(setTimeout(function () { li.classList.add('ok'); }, 450 * (i + 1)));
  });
  timersArmar.push(setTimeout(function () { estado = 'armado'; ui(); }, 450 * (itens.length + 1)));
});

btnLancar.addEventListener('click', function () {
  if (estado !== 'armado') return;
  estado = 'contagem';
  contagem = 5;
  ui();
  timerContagem = setInterval(function () {
    contagem--;
    if (contagem <= 0) {
      clearInterval(timerContagem);
      estado = 'voando';
      tempo = 0;
      marcar('decolagem');
      ui();
    }
  }, 1000);
});

btnReiniciar.addEventListener('click', resetar);

// ---------- Física e eventos ----------
function suave(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function puff(x, wy, vx, r, a, k, d) {
  fumaca.push({ x: x, wy: wy, vx: vx, vida: 1, r: r, a: a, k: k, d: d });
}

function poeira(x) {
  for (let i = 0; i < 26; i++) puff(x + (Math.random() - 0.5) * 50, 8, (Math.random() - 0.5) * 170, 7, 0.45, 16, 0.7);
}

function atualizarBooster(dt) {
  const b = booster;
  if (b.landed) return;
  b.ts += dt;
  const T1 = 2.2, D = 4;
  if (b.ts < T1) {
    b.vy -= 250 * dt;
    b.wy += b.vy * dt;
    b.ang = Math.PI * suave(b.ts / 1.2);
    b.calor = 0;
    if (b.ts > 1.2) {
      b.chama = 0.55;
      b.x += (padX - b.x) * dt * 2.2;
      marcar('boostback');
    } else {
      b.chama = 0;
    }
    b.y0 = b.wy;
    b.x0 = b.x;
  } else {
    const q = Math.min(1, (b.ts - T1) / D);
    b.wy = CH + (b.y0 - CH) * (1 - q) * (1 - q);
    b.x = b.x0 + (padX - b.x0) * Math.min(1, q * 2.5);
    b.ang = Math.PI * (1 - suave((b.ts - T1) / 1.2));
    b.pernas = q > 0.4;
    b.chama = q > 0.45 ? 1 : 0;
    b.calor = q < 0.4 ? 1 : 0;
    if (q >= 1) {
      b.landed = true;
      b.wy = CH; b.chama = 0; b.ang = 0; b.pernas = true; b.calor = 0;
      tremor = 4;
      poeira(b.x);
      marcar('pouso');
      aviso('Pouso confirmado! O foguete pode voar de novo.', 4500);
    }
  }
}

function atualizar(dt) {
  if (estado === 'voando') {
    tempo += dt;
    vel += (30 + tempo * 12) * dt;
    alt += vel * dt;

    if (tempo >= 3) marcar('maxq');
    if (tempo >= 5 && pe.estagio1) {
      pe.estagio1 = false;
      booster = { x: foguetex, wy: alt, vy: vel, ang: 0, ts: 0, pernas: false, chama: 0, calor: 0, landed: false, x0: foguetex, y0: alt };
      marcar('separacao');
      aviso('Separação! O 2º estágio segue para a órbita.', 3500);
    }
    if (tempo >= 8 && pe.carenagem) {
      pe.carenagem = false;
      [-1, 1].forEach(function (s) {
        detritos.push({ s: s, x: foguetex, wy: alt + 225, vx: s * 45, vy: vel * 0.9, rot: 0, rv: s * 1.2 });
      });
      marcar('carenagem');
    }
    if (alt >= ALVO_ORBITA && (!booster || booster.landed)) {
      estado = 'orbita';
      marcar('orbita');
      aviso('Órbita alcançada! Satélite liberado.', 0);
      sat = { x: foguetex, wy: alt + 225, t: 0 };
      ui();
    }
  }

  if (booster) atualizarBooster(dt);
  if (sat) { sat.t += dt; sat.x += 18 * dt; sat.wy += 10 * dt; }

  detritos.forEach(function (d) {
    d.vy -= 420 * dt;
    d.wy += d.vy * dt;
    d.x += d.vx * dt;
    d.rot += d.rv * dt;
  });
  detritos = detritos.filter(function (d) { return d.wy > -100; });

  // fumaça no chão e rastro no ar
  const ign = estado === 'contagem' && contagem <= 2;
  if (ign || (estado === 'voando' && alt < 1500 && !booster)) {
    for (let i = 0; i < 2; i++) puff(foguetex + (Math.random() - 0.5) * 30, ign ? 6 : alt, (Math.random() - 0.5) * 70, 8, 0.5, 14, 0.6);
  } else if (estado === 'voando') {
    puff(foguetex + (Math.random() - 0.5) * 4, booster ? alt + 160 : alt, (Math.random() - 0.5) * 10, 3, 0.3, 6, 1.2);
  }
  fumaca.forEach(function (f) { f.x += f.vx * dt; f.vida -= dt * f.d; });
  fumaca = fumaca.filter(function (f) { return f.vida > 0; });
  if (fumaca.length > 700) fumaca.splice(0, fumaca.length - 700);

  tremor = Math.max(0, tremor - dt * 6);

  // câmera: segue o foguete, depois o 1º estágio, e sobe até a órbita
  const alvo = (booster && estado !== 'orbita') ? Math.max(0, booster.wy - 120) : Math.max(0, alt - 120);
  if (estado === 'orbita') cam += (alvo - cam) * Math.min(1, dt * 2.2);
  else cam = alvo;
}

// ---------- Desenho: utilidades ----------
const BRANCO = ['#ffffff', '#e9edf3', '#a9b2bf'];
const PRETO = ['#5a5f68', '#23262c', '#0a0b0d'];
const DOURADO = ['#f6e08a', '#d4af37', '#8a6d12'];

function sy(wy) { return chaoY - wy + cam; }

function misturar(c1, c2, f) {
  f = Math.max(0, Math.min(1, f));
  return 'rgb(' + Math.round(c1[0] + (c2[0] - c1[0]) * f) + ',' +
    Math.round(c1[1] + (c2[1] - c1[1]) * f) + ',' +
    Math.round(c1[2] + (c2[2] - c1[2]) * f) + ')';
}

function cil(x, y, w, h, cor) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, cor[0]);
  g.addColorStop(0.35, cor[1]);
  g.addColorStop(1, cor[2]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function brilho(x, y, r, cor) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, cor);
  g.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function chama(x, y, larg, comp) {
  const c = comp * (0.85 + Math.random() * 0.3);
  brilho(x, y + c * 0.25, larg * 2.6 + c * 0.4, 'rgba(255,170,70,0.45)');
  const g = ctx.createLinearGradient(0, y, 0, y + c);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(0.35, '#ffb23c');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - larg / 2, y);
  ctx.quadraticCurveTo(x - larg * 0.4, y + c * 0.6, x, y + c);
  ctx.quadraticCurveTo(x + larg * 0.4, y + c * 0.6, x + larg / 2, y);
  ctx.fill();
}

// ---------- Desenho: Falcon 9 (base da peça em y) ----------
function estagio1(x, y, pernas, aletas) {
  cil(x - 10, y - 150, 20, 150, BRANCO);
  const s = ctx.createLinearGradient(0, y - 45, 0, y);   // fuligem dos voos anteriores
  s.addColorStop(0, 'rgba(20,20,22,0)');
  s.addColorStop(1, 'rgba(20,20,22,0.6)');
  ctx.fillStyle = s;
  ctx.fillRect(x - 10, y - 45, 20, 45);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  [35, 70, 105].forEach(function (d) { ctx.fillRect(x - 10, y - d, 20, 1); });
  cil(x - 10, y - 160, 20, 10, PRETO);

  ctx.fillStyle = '#8f97a3';                              // aletas de controle
  if (aletas) { ctx.fillRect(x - 19, y - 148, 9, 4); ctx.fillRect(x + 10, y - 148, 9, 4); }
  else { ctx.fillRect(x - 12, y - 150, 2, 9); ctx.fillRect(x + 10, y - 150, 2, 9); }

  ctx.fillStyle = '#2a2d33';                              // motores
  ctx.fillRect(x - 9, y - 4, 18, 5);
  ctx.fillStyle = '#111';
  [-6, 0, 6].forEach(function (d) { ctx.fillRect(x + d - 2, y, 4, 3); });

  if (pernas) {
    ctx.strokeStyle = '#2b2f36';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 34); ctx.lineTo(x - 28, y);
    ctx.moveTo(x + 10, y - 34); ctx.lineTo(x + 28, y);
    ctx.stroke();
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(x - 32, y - 2, 8, 3);
    ctx.fillRect(x + 24, y - 2, 8, 3);
  } else {
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(x - 11, y - 36, 2, 34);
    ctx.fillRect(x + 9, y - 36, 2, 34);
  }
}

function estagio2(x, y) {
  cil(x - 10, y - 65, 20, 65, BRANCO);
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(x - 4, y); ctx.lineTo(x - 7, y + 8); ctx.lineTo(x + 7, y + 8); ctx.lineTo(x + 4, y);
  ctx.fill();
}

function meiaCarenagem(s) {
  ctx.save();
  ctx.scale(s, 1);
  ctx.fillStyle = s === 1 ? '#e4e9f1' : '#c6cdd9';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-10, 0); ctx.lineTo(-10, -20);
  ctx.quadraticCurveTo(-8, -38, 0, -46);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function carenagem(x, y) {
  ctx.save();
  ctx.translate(x, y);
  meiaCarenagem(1);
  meiaCarenagem(-1);
  ctx.restore();
}

function satelite(x, y, painel) {
  if (painel > 0) {
    const w = 26 * painel;
    ctx.fillStyle = '#1e4fa8';
    ctx.fillRect(x - 6 - w, y - 10, w, 6);
    ctx.fillRect(x + 6, y - 10, w, 6);
    ctx.strokeStyle = '#7ab4ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6 - w, y - 10, w, 6);
    ctx.strokeRect(x + 6, y - 10, w, 6);
  }
  cil(x - 6, y - 14, 12, 14, DOURADO);
  ctx.fillStyle = '#ddd';
  ctx.fillRect(x - 0.5, y - 20, 1, 6);
}

// ---------- Desenho: cena ----------
function desenharCeu(t) {
  const f = Math.min(1, cam / 5000);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, misturar([8, 14, 42], [0, 0, 0], f));
  g.addColorStop(0.6, misturar([50, 70, 150], [0, 0, 6], f * 1.2));
  g.addColorStop(1, misturar([255, 140, 80], [0, 0, 8], f * 1.3));
  ctx.fillStyle = g;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  const a = Math.max(0, 1 - cam / 1500);
  if (a > 0) {
    const y = chaoY + cam;
    const r = ctx.createRadialGradient(110, y, 0, 110, y, 260);
    r.addColorStop(0, 'rgba(255,190,110,' + (0.55 * a) + ')');
    r.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = r;
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }

  const base = Math.min(1, cam / 2500 + 0.1);
  estrelas.forEach(function (s) {
    ctx.fillStyle = 'rgba(255,255,255,' + (base * (0.6 + 0.4 * Math.sin(t * 2 + s.f))) + ')';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  });

  const ca = Math.max(0, 0.22 * (1 - cam / 2600));
  if (ca > 0) {
    nuvens.forEach(function (c) {
      const y = sy(c.wy);
      if (y < -60 || y > H + 60) return;
      ctx.fillStyle = 'rgba(255,220,200,' + ca + ')';
      [[0, 0, 50], [-34, 6, 34], [38, 8, 38]].forEach(function (p) {
        ctx.beginPath();
        ctx.ellipse(c.x + p[0] * c.s, y + p[1] * c.s, p[2] * c.s, p[2] * 0.38 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  if (estado === 'orbita' && cam > 4000) {
    const cy = H + 790;
    const e = ctx.createRadialGradient(W / 2, cy, 840, W / 2, cy, 912);
    e.addColorStop(0, '#0b2f78');
    e.addColorStop(0.93, '#1f6fe0');
    e.addColorStop(0.985, '#7fc4ff');
    e.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.save();
    ctx.globalAlpha = Math.min(1, (cam - 4000) / 1500);
    ctx.fillStyle = e;
    ctx.beginPath(); ctx.arc(W / 2, cy, 912, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function desenharChao(t) {
  const y = chaoY + cam;
  if (y > H + 240) return;

  const g = ctx.createLinearGradient(0, y, 0, y + 80);
  g.addColorStop(0, '#1b2a1f');
  g.addColorStop(1, '#080d0a');
  ctx.fillStyle = g;
  ctx.fillRect(-10, y, W + 20, H + 300);

  const m = ctx.createLinearGradient(0, y, 0, y + 80);   // mar à direita
  m.addColorStop(0, '#1c4a86');
  m.addColorStop(1, '#07142b');
  ctx.fillStyle = m;
  ctx.fillRect(300, y, W - 290, H + 300);
  ctx.strokeStyle = 'rgba(180,220,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let x = 300; x <= W; x += 10) {
      const yw = y + 10 + i * 14 + Math.sin(x * 0.05 + t * 2 + i) * 1.5;
      if (x === 300) ctx.moveTo(x, yw); else ctx.lineTo(x, yw);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,150,90,0.35)';
  ctx.fillRect(-10, y, W + 20, 2);

  // plataforma e torre
  ctx.fillStyle = '#4a505a';
  ctx.fillRect(190, y, 90, 5);
  ctx.fillStyle = '#59616e';
  ctx.fillRect(176, y - 230, 14, 230);
  ctx.strokeStyle = '#7b8492';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath(); ctx.moveTo(176, y - 230 + i * 33); ctx.lineTo(190, y - 197 + i * 33); ctx.stroke();
  }
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff4040' : '#661111';
  ctx.beginPath(); ctx.arc(183, y - 236, 3, 0, Math.PI * 2); ctx.fill();
  if (alt === 0 && estado !== 'voando' && estado !== 'orbita') {
    ctx.fillStyle = '#59616e';
    ctx.fillRect(190, y - 130, 34, 6);
  }

  // balsa de pouso
  ctx.fillStyle = '#151a26';
  ctx.fillRect(padX - 70, y - 2, 140, 14);
  ctx.fillStyle = '#2a3040';
  ctx.fillRect(padX - 70, y - CH, 140, CH);
  ctx.fillRect(padX + 48, y - 20, 16, 14);
  ctx.strokeStyle = '#e6eefc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX - 10, y - CH + 1); ctx.lineTo(padX + 10, y - 1);
  ctx.moveTo(padX + 10, y - CH + 1); ctx.lineTo(padX - 10, y - 1);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = Math.sin(t * 3 + i) > 0 ? '#7dffb0' : '#ffffff';
    ctx.fillRect(padX - 66 + i * 19, y - CH, 3, 2);
  }
}

function desenharBooster() {
  const b = booster;
  ctx.save();
  ctx.translate(b.x, sy(b.wy));
  ctx.translate(0, -80);
  ctx.rotate(b.ang);
  ctx.translate(0, 80);
  if (b.chama) chama(0, 3, 20, 65 * b.chama);
  if (b.calor) brilho(0, 8, 55, 'rgba(255,140,60,0.4)');
  estagio1(0, 0, b.pernas, true);
  ctx.restore();
}

function desenharPilha() {
  const x = foguetex;
  const base = sy(alt);
  const voo = estado === 'voando';
  const ign = estado === 'contagem' && contagem <= 2;

  if (voo || ign) {
    if (pe.estagio1) chama(x, base + 3, 20, voo ? 100 : 35);
    else if (voo) chama(x, base - 152, 9, 48);
  }
  if (pe.estagio1) estagio1(x, base, false, false);
  estagio2(x, base - 160);
  if (pe.carenagem) carenagem(x, base - 225);
  else if (estado !== 'orbita') satelite(x, base - 225, 0);
}

function desenhar() {
  const t = performance.now() / 1000;
  let sh = tremor;
  if (estado === 'contagem' && contagem <= 2) sh += 1.2;
  if (estado === 'voando' && alt < 300) sh += 3 * (1 - alt / 300) + 0.6;

  ctx.save();
  if (sh > 0) ctx.translate((Math.random() - 0.5) * sh * 2, (Math.random() - 0.5) * sh * 2);

  desenharCeu(t);
  desenharChao(t);

  fumaca.forEach(function (f) {
    ctx.fillStyle = 'rgba(235,235,240,' + (f.vida * f.a) + ')';
    ctx.beginPath();
    ctx.arc(f.x, sy(f.wy), f.r + (1 - f.vida) * f.k, 0, Math.PI * 2);
    ctx.fill();
  });

  detritos.forEach(function (d) {
    const y = sy(d.wy);
    if (y > H + 400 || y < -400) return;
    ctx.save();
    ctx.translate(d.x, y);
    ctx.rotate(d.rot);
    meiaCarenagem(d.s);
    ctx.restore();
  });

  if (booster) desenharBooster();
  desenharPilha();
  if (sat) satelite(sat.x, sy(sat.wy), Math.min(1, Math.max(0, (sat.t - 1) / 1.2)));
  ctx.restore();

  // contagem e telemetria (HTML)
  const txtCont = (estado === 'contagem' && contagem > 0) ? String(contagem) : '';
  if (txtCont !== ultimaCont) {
    ultimaCont = txtCont;
    elCont.textContent = txtCont;
    elCont.classList.remove('pop');
    void elCont.offsetWidth;
    if (txtCont) elCont.classList.add('pop');
  }
  $('tTempo').textContent = tempoTxt(tempo);
  $('tAlt').textContent = (alt / 16).toFixed(1).replace('.', ',') + ' km';
  $('tVel').textContent = Math.round(vel * 5.8) + ' m/s';
}

let ultimo = performance.now();
function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;
  atualizar(dt);
  desenhar();
  requestAnimationFrame(loop);
}

resetar();
requestAnimationFrame(loop);
