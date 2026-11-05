//  Simulador de foguetes: Falcon 9 (satélites) e Apollo (Lua)
//    1. Constantes e funções de desenho reutilizáveis
//    2. criarPainel(): botões, checklist, contagem e fases (igual nos dois)
//    3. falcon: a simulação do Falcon 9
//    4. apollo: a simulação da viagem à Lua
//    5. Botões para alternar e o laço de animação

// ---------- 1. Constantes e utilidades ----------
const $ = function (id) { return document.getElementById(id); };
const LARGURA = 520;
const ALTURA = 600;
const CHAO = 530;
const FOGUETE_X = 230;

const BRANCO = ['#ffffff', '#e9edf3', '#a9b2bf'];
const PRETO = ['#5a5f68', '#23262c', '#0a0b0d'];
const PRATA = ['#e6e8ee', '#b9bec9', '#7c8392'];
const DOURADO = ['#f6e08a', '#d4af37', '#8a6d12'];

function tempoTxt(s) {
  const n = Math.floor(s);
  return 'T+ ' + String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

function numero(n, casas) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function misturar(a, b, f) {
  f = Math.max(0, Math.min(1, f));
  const cor = a.map(function (v, i) { return Math.round(v + (b[i] - v) * f); });
  return 'rgb(' + cor.join(',') + ')';
}

function cilindro(c, x, y, w, h, cores) {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, cores[0]);
  g.addColorStop(0.35, cores[1]);
  g.addColorStop(1, cores[2]);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
}

function chama(c, x, y, largura, comprimento) {
  const comp = comprimento * (0.85 + Math.random() * 0.3);
  const g = c.createLinearGradient(0, y, 0, y + comp);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(0.4, '#ffb23c');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - largura / 2, y);
  c.lineTo(x, y + comp);
  c.lineTo(x + largura / 2, y);
  c.fill();
}

const ESTRELAS = [];
for (let i = 0; i < 100; i++) {
  ESTRELAS.push({ x: Math.random() * LARGURA, y: Math.random() * CHAO, r: Math.random() * 1.4 + 0.4, f: Math.random() * 6 });
}

function desenharEstrelas(c, alfa) {
  const t = performance.now() / 1000;
  ESTRELAS.forEach(function (e) {
    c.fillStyle = 'rgba(255,255,255,' + alfa * (0.6 + 0.4 * Math.sin(t * 2 + e.f)) + ')';
    c.fillRect(e.x, e.y, e.r, e.r);
  });
}

function ceu(c, cam) {
  const f = Math.min(1, cam / 5000);
  const g = c.createLinearGradient(0, 0, 0, ALTURA);
  g.addColorStop(0, misturar([20, 60, 140], [0, 0, 0], f));
  g.addColorStop(1, misturar([255, 205, 160], [0, 0, 8], f * 1.3));
  c.fillStyle = g;
  c.fillRect(0, 0, LARGURA, ALTURA);
  desenharEstrelas(c, Math.min(1, cam / 2500));
}

function soltarFumaca(lista, x, y, vx) {
  lista.push({ x: x, y: y, vx: vx, vida: 1 });
}

function moverFumaca(lista, dt) {
  for (let i = lista.length - 1; i >= 0; i--) {
    lista[i].x += lista[i].vx * dt;
    lista[i].vida -= dt;
    if (lista[i].vida <= 0) lista.splice(i, 1);
  }
}

function desenharFumaca(c, lista, cam) {
  lista.forEach(function (f) {
    c.fillStyle = 'rgba(235,235,240,' + f.vida * 0.5 + ')';
    c.beginPath();
    c.arc(f.x, CHAO - f.y + cam, 8 + (1 - f.vida) * 14, 0, Math.PI * 2);
    c.fill();
  });
}

// ---------- 2. Painel de controle (botões, checklist, contagem, fases) ----------
function criarPainel(ids, aoDecolar, aoReiniciar) {
  const painel = { estado: 'ocioso', contagem: 5 };
  const bArmar = $(ids.armar);
  const bLancar = $(ids.lancar);
  const bReiniciar = $(ids.reiniciar);
  const elStatus = $(ids.status);
  const elAviso = $(ids.aviso);
  const elContagem = $(ids.contagem);
  const itens = document.querySelectorAll('#' + ids.checklist + ' li');
  const fases = document.querySelectorAll('#' + ids.fases + ' li');
  let timers = [], timerAviso, timerContagem;

  const TEXTOS = {
    ocioso: 'Aguardando: clique em Armar.',
    armando: 'Verificando sistemas...',
    armado: 'Tudo certo. Clique em Lançar.',
    contagem: 'Contagem regressiva...',
    voando: 'Missão em andamento!',
    fim: 'Missão cumprida. Clique em Reiniciar para voar de novo.'
  };

  painel.mudar = function (estado) {
    painel.estado = estado;
    bArmar.disabled = estado !== 'ocioso';
    bLancar.disabled = estado !== 'armado';
    bReiniciar.disabled = estado === 'ocioso';
    elStatus.textContent = TEXTOS[estado];
  };

  painel.avisar = function (texto, ms) {
    clearTimeout(timerAviso);
    elAviso.textContent = texto;
    elAviso.className = 'on';
    if (ms) timerAviso = setTimeout(function () { elAviso.className = ''; }, ms);
  };

  painel.marcar = function (fase) {
    const li = document.querySelector('#' + ids.fases + ' li[data-fase="' + fase + '"]');
    if (li.classList.contains('feito')) return;
    fases.forEach(function (f) { f.classList.remove('atual'); });
    li.classList.add('feito', 'atual');
  };

  function mostrarContagem(n) {
    elContagem.textContent = n || '';
    elContagem.classList.remove('pop');
    void elContagem.offsetWidth;
    if (n) elContagem.classList.add('pop');
  }

  painel.resetar = function () {
    clearInterval(timerContagem);
    clearTimeout(timerAviso);
    timers.forEach(clearTimeout);
    timers = [];
    itens.forEach(function (li) { li.classList.remove('ok'); });
    fases.forEach(function (li) { li.classList.remove('feito', 'atual'); });
    elAviso.className = '';
    mostrarContagem(0);
    painel.mudar('ocioso');
  };

  bArmar.addEventListener('click', function () {
    painel.mudar('armando');
    itens.forEach(function (li, i) {                      // acende um item por vez
      timers.push(setTimeout(function () { li.classList.add('ok'); }, 450 * (i + 1)));
    });
    timers.push(setTimeout(function () { painel.mudar('armado'); }, 450 * (itens.length + 1)));
  });

  bLancar.addEventListener('click', function () {
    painel.mudar('contagem');
    painel.contagem = 5;
    mostrarContagem(5);
    timerContagem = setInterval(function () {
      painel.contagem--;
      if (painel.contagem > 0) { mostrarContagem(painel.contagem); return; }
      clearInterval(timerContagem);
      mostrarContagem(0);
      painel.mudar('voando');
      aoDecolar();
    }, 1000);
  });

  bReiniciar.addEventListener('click', aoReiniciar);
  return painel;
}

// ---------- 3. Falcon 9: decolagem, pouso do 1º estágio e satélite ----------
const falcon = (function () {
  const c = $('tela').getContext('2d');
  const PAD_X = 400;
  const CONVES = 6;
  const ALVO_ORBITA = 6500;

  const painel = criarPainel({
    armar: 'btnArmar', lancar: 'btnLancar', reiniciar: 'btnReiniciar', status: 'status',
    aviso: 'aviso', contagem: 'contagemGrande', checklist: 'checklist', fases: 'fases'
  }, decolar, reiniciar);

  let tempo, alt, vel, cam, tremor, estagio1, carenagem, booster, satelite;
  const fumaca = [];
  const metades = [];

  function sy(y) { return CHAO - y + cam; }

  function reiniciar() {
    tempo = alt = vel = cam = tremor = 0;
    estagio1 = true;
    carenagem = true;
    booster = null;
    satelite = null;
    fumaca.length = 0;
    metades.length = 0;
    painel.resetar();
  }

  function decolar() {
    tempo = 0;
    painel.marcar('decolagem');
  }

  // ----- eventos do voo -----
  function separarEstagio() {
    estagio1 = false;
    booster = { x: FOGUETE_X, y: alt, y0: alt, vy: vel, t: 0, ang: 0, pernas: false, chama: 0, pousou: false };
    painel.marcar('separacao');
    painel.avisar('Separação! O 2º estágio segue para a órbita.', 3500);
  }

  function abrirCarenagem() {
    carenagem = false;
    [-1, 1].forEach(function (lado) {
      metades.push({ lado: lado, x: FOGUETE_X, y: alt + 225, vx: lado * 45, vy: vel * 0.9, rot: 0 });
    });
    painel.marcar('carenagem');
  }

  function chegarNaOrbita() {
    painel.mudar('fim');
    painel.marcar('orbita');
    painel.avisar('Órbita alcançada! Satélite liberado.', 0);
    satelite = { x: FOGUETE_X, y: alt + 225, t: 0 };
  }

  function moverBooster(dt) {
    const b = booster;
    if (b.pousou) return;
    b.t += dt;
    b.x += (PAD_X - b.x) * dt * 2;
    if (b.t < 2.2) {
      b.vy -= 250 * dt;
      b.y += b.vy * dt;
      b.y0 = b.y;
      b.ang = Math.PI * Math.min(1, b.t / 1.2);
      b.chama = b.t > 1.2 ? 0.55 : 0;
      if (b.t > 1.2) painel.marcar('boostback');
    } else {
      const q = Math.min(1, (b.t - 2.2) / 4);
      b.y = CONVES + (b.y0 - CONVES) * (1 - q) * (1 - q);
      b.ang = Math.PI * (1 - Math.min(1, (b.t - 2.2) / 1.2));
      b.pernas = q > 0.4;
      b.chama = q > 0.45 ? 1 : 0;
      if (q >= 1) pousar();
    }
  }

  function pousar() {
    const b = booster;
    b.pousou = true;
    b.x = PAD_X; b.y = CONVES; b.ang = 0; b.chama = 0; b.pernas = true;
    tremor = 4;
    for (let i = 0; i < 26; i++) soltarFumaca(fumaca, b.x + (Math.random() - 0.5) * 50, 8, (Math.random() - 0.5) * 170);
    painel.marcar('pouso');
    painel.avisar('Pouso confirmado! O foguete pode voar de novo.', 4500);
  }

  function atualizar(dt) {
    const ignicao = painel.estado === 'contagem' && painel.contagem <= 2;

    if (painel.estado === 'voando') {
      tempo += dt;
      vel += (30 + tempo * 12) * dt;
      alt += vel * dt;
      if (tempo >= 3) painel.marcar('maxq');
      if (tempo >= 5 && estagio1) separarEstagio();
      if (tempo >= 8 && carenagem) abrirCarenagem();
      if (alt >= ALVO_ORBITA && (!booster || booster.pousou)) chegarNaOrbita();
    }

    if (booster) moverBooster(dt);
    if (satelite) { satelite.t += dt; satelite.x += 18 * dt; satelite.y += 10 * dt; }
    metades.forEach(function (m) {         // as metades da carenagem caem girando
      m.vy -= 420 * dt;
      m.y += m.vy * dt;
      m.x += m.vx * dt;
      m.rot += m.lado * 1.2 * dt;
    });

    if (ignicao || (painel.estado === 'voando' && alt < 1500 && !booster)) {
      soltarFumaca(fumaca, FOGUETE_X + (Math.random() - 0.5) * 30, ignicao ? 6 : alt, (Math.random() - 0.5) * 70);
    }
    moverFumaca(fumaca, dt);
    tremor = Math.max(0, tremor - dt * 6);

    const alvo = Math.max(0, ((booster && painel.estado === 'voando') ? booster.y : alt) - 120);
    if (painel.estado === 'fim') cam += (alvo - cam) * Math.min(1, dt * 2.2);
    else cam = alvo;
  }

  // ----- desenho das peças (y = base da peça) -----
  function desenharEstagio1(x, y, pernas) {
    cilindro(c, x - 10, y - 150, 20, 150, BRANCO);
    cilindro(c, x - 10, y - 160, 20, 10, PRETO);
    c.fillStyle = '#8f97a3';
    c.fillRect(x - 19, y - 148, 9, 4);
    c.fillRect(x + 10, y - 148, 9, 4);
    c.fillStyle = '#2a2d33';
    c.fillRect(x - 9, y - 4, 18, 5);
    c.strokeStyle = '#2b2f36';
    c.lineWidth = 3;
    c.beginPath();
    if (pernas) {
      c.moveTo(x - 10, y - 34); c.lineTo(x - 28, y);
      c.moveTo(x + 10, y - 34); c.lineTo(x + 28, y);
    } else {
      c.moveTo(x - 11, y - 36); c.lineTo(x - 11, y);
      c.moveTo(x + 11, y - 36); c.lineTo(x + 11, y);
    }
    c.stroke();
  }

  function desenharEstagio2(x, y) {
    cilindro(c, x - 10, y - 65, 20, 65, BRANCO);
    c.fillStyle = '#444';
    c.beginPath();
    c.moveTo(x - 4, y); c.lineTo(x - 7, y + 8); c.lineTo(x + 7, y + 8); c.lineTo(x + 4, y);
    c.fill();
  }

  function desenharMetade(lado) {                             // lado: 1 = direita, -1 = esquerda
    c.save();
    c.scale(lado, 1);
    c.fillStyle = lado === 1 ? '#e4e9f1' : '#c6cdd9';
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(-10, 0); c.lineTo(-10, -20);
    c.quadraticCurveTo(-8, -38, 0, -46);
    c.fill();
    c.restore();
  }

  function desenharSatelite(x, y, abertura) {                 // abertura: 0 a 1 (painéis solares)
    if (abertura > 0) {
      const w = 26 * abertura;
      c.fillStyle = '#1e4fa8';
      c.fillRect(x - 6 - w, y - 10, w, 6);
      c.fillRect(x + 6, y - 10, w, 6);
    }
    cilindro(c, x - 6, y - 14, 12, 14, DOURADO);
  }

  function desenharChao() {
    const y = CHAO + cam;
    if (y > ALTURA + 300) return;
    c.fillStyle = '#2e5b34'; c.fillRect(0, y, LARGURA, ALTURA);
    c.fillStyle = '#1c4a86'; c.fillRect(300, y, LARGURA - 300, ALTURA);
    c.fillStyle = '#4a505a'; c.fillRect(190, y, 90, 5);
    c.fillStyle = '#59616e'; c.fillRect(176, y - 230, 14, 230);
    c.fillStyle = Math.sin(performance.now() / 250) > 0 ? '#ff4040' : '#661111';
    c.beginPath(); c.arc(183, y - 236, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a3040'; c.fillRect(PAD_X - 70, y - CONVES, 140, CONVES + 8);
    c.strokeStyle = '#e6eefc'; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(PAD_X - 10, y - CONVES + 1); c.lineTo(PAD_X + 10, y - 1);
    c.moveTo(PAD_X + 10, y - CONVES + 1); c.lineTo(PAD_X - 10, y - 1);
    c.stroke();
  }

  function desenharPilha() {
    const x = FOGUETE_X;
    const base = sy(alt);
    const acesa = painel.estado === 'voando' || (painel.estado === 'contagem' && painel.contagem <= 2);
    if (acesa) {
      if (estagio1) chama(c, x, base + 3, 20, painel.estado === 'voando' ? 100 : 35);
      else chama(c, x, base - 152, 9, 48);
    }
    if (estagio1) desenharEstagio1(x, base, false);
    desenharEstagio2(x, base - 160);
    if (carenagem) {
      c.save();
      c.translate(x, base - 225);
      desenharMetade(1);
      desenharMetade(-1);
      c.restore();
    } else if (!satelite) {
      desenharSatelite(x, base - 225, 0);
    }
  }

  function desenhar() {
    let treme = tremor;
    if (painel.estado === 'contagem' && painel.contagem <= 2) treme += 1.2;
    if (painel.estado === 'voando' && alt < 300) treme += 3 * (1 - alt / 300) + 0.6;

    c.save();
    if (treme > 0) c.translate((Math.random() - 0.5) * treme * 2, (Math.random() - 0.5) * treme * 2);

    ceu(c, cam);
    desenharChao();
    desenharFumaca(c, fumaca, cam);

    metades.forEach(function (m) {
      c.save();
      c.translate(m.x, sy(m.y));
      c.rotate(m.rot);
      desenharMetade(m.lado);
      c.restore();
    });

    if (booster) {                                            // gira em torno do meio do foguete
      c.save();
      c.translate(booster.x, sy(booster.y) - 80);
      c.rotate(booster.ang);
      c.translate(0, 80);
      if (booster.chama) chama(c, 0, 3, 20, 65 * booster.chama);
      desenharEstagio1(0, 0, booster.pernas);
      c.restore();
    }

    desenharPilha();
    if (satelite) desenharSatelite(satelite.x, sy(satelite.y), Math.min(1, Math.max(0, (satelite.t - 1) / 1.2)));
    c.restore();

    $('tTempo').textContent = tempoTxt(tempo);
    $('tAlt').textContent = numero(alt / 16, 1) + ' km';
    $('tVel').textContent = Math.round(vel * 5.8) + ' m/s';
  }

  reiniciar();
  return { atualizar: atualizar, desenhar: desenhar, reiniciar: reiniciar };
})();

// ---------- 4. Apollo: decolagem, viagem à Lua e alunissagem ----------
const apollo = (function () {
  const c = $('luaTela').getContext('2d');
  const T_VIAGEM = 9;
  const T_DESCIDA = 11;
  const ALT_DESCIDA = 440;
  const LUA_X = 260;
  const P0 = [185, 360], CURVA = [150, 200], P1 = [350, 175];

  const painel = criarPainel({
    armar: 'luaArmar', lancar: 'luaLancar', reiniciar: 'luaReiniciar', status: 'luaStatus',
    aviso: 'luaAviso', contagem: 'luaContagem', checklist: 'luaChecklist', fases: 'luaFases'
  }, decolar, reiniciar);

  let cena, tempo, tc, alt, vel, cam, tremor, escuro, la, descidaQ, pousou, partes;
  const fumaca = [];
  const pedacos = [];

  function sy(y) { return CHAO - y + cam; }

  function reiniciar() {
    cena = 'terra';
    tempo = tc = alt = vel = cam = tremor = escuro = descidaQ = 0;
    la = ALT_DESCIDA;
    pousou = false;
    partes = { s1: true, s2: true, torre: true };
    fumaca.length = 0;
    pedacos.length = 0;
    painel.resetar();
  }

  function decolar() {
    tempo = 0;
    painel.marcar('decolagem');
  }

  function mudarCena(nova) {
    cena = nova;
    tc = 0;
    cam = 0;
    escuro = 1;
    fumaca.length = 0;
    pedacos.length = 0;
  }

  function largar(tipo, y, altura) {                          // solta uma peça que cai girando
    pedacos.push({ tipo: tipo, h: altura, x: FOGUETE_X, y: y, vx: (Math.random() - 0.5) * 40, vy: vel * 0.9, rot: 0, rv: (Math.random() - 0.5) * 1.5 });
  }

  // ----- as três cenas -----
  function subir(dt) {
    vel += (28 + tempo * 10) * dt;
    alt += vel * dt;
    if (tempo >= 3) painel.marcar('maxq');
    if (tempo >= 6 && partes.s1) {
      partes.s1 = false;
      largar('s1', alt, 120);
      painel.marcar('separacao');
      painel.avisar('Separação! O 1º estágio ficou para trás.', 3000);
    }
    if (tempo >= 9 && partes.torre) {
      partes.torre = false;
      largar('torre', alt + 274, 38);
      painel.avisar('Torre de escape descartada.', 2500);
    }
    if (tempo >= 11 && partes.s2) {
      partes.s2 = false;
      largar('s2', alt + 122, 70);
      painel.avisar('2º estágio separado.', 2500);
    }
    if (tempo >= 13) {
      mudarCena('espaco');
      painel.marcar('translunar');
      painel.avisar('Rumo à Lua! A viagem real dura cerca de 3 dias.', 4000);
      return;
    }
    cam = Math.max(0, alt - 120);
  }

  function viajar(dt) {
    tc += dt;
    if (tc >= T_VIAGEM) {
      mudarCena('lua');
      painel.marcar('descida');
      painel.avisar('Módulo lunar separado. Iniciando a descida!', 3500);
    }
  }

  function descer(dt) {
    if (pousou) return;
    tc += dt;
    descidaQ = Math.min(1, tc / T_DESCIDA);
    la = ALT_DESCIDA * (1 - descidaQ) * (1 - descidaQ);
    if (la < 90 && descidaQ < 1) soltarFumaca(fumaca, LUA_X + (Math.random() - 0.5) * 30, 3, (Math.random() - 0.5) * 240);
    if (descidaQ >= 1) {
      pousou = true;
      la = 0;
      tremor = 2;
      for (let i = 0; i < 30; i++) soltarFumaca(fumaca, LUA_X + (Math.random() - 0.5) * 50, 4, (Math.random() - 0.5) * 200);
      painel.mudar('fim');
      painel.marcar('pouso');
      painel.avisar('O Foguete pousou com sucesso na lua!.', 0);
    }
  }

  function atualizar(dt) {
    if (painel.estado === 'voando') {
      tempo += dt;
      if (cena === 'terra') subir(dt);
      else if (cena === 'espaco') viajar(dt);
      else descer(dt);
    }
    escuro = Math.max(0, escuro - dt);

    pedacos.forEach(function (p) {
      p.vy -= 420 * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.rot += p.rv * dt;
    });

    const ignicao = painel.estado === 'contagem' && painel.contagem <= 2;
    if (cena === 'terra' && (ignicao || (painel.estado === 'voando' && alt < 1500))) {
      soltarFumaca(fumaca, FOGUETE_X + (Math.random() - 0.5) * 30, ignicao ? 6 : alt, (Math.random() - 0.5) * 70);
    }
    moverFumaca(fumaca, dt);
    tremor = Math.max(0, tremor - dt * 6);
  }

  // ----- Saturn V (y = base da peça) -----
  function desenharS1(x, y) {
    c.fillStyle = '#2b2f36';
    c.beginPath(); c.moveTo(x - 11, y - 35); c.lineTo(x - 25, y); c.lineTo(x - 11, y); c.fill();
    c.beginPath(); c.moveTo(x + 11, y - 35); c.lineTo(x + 25, y); c.lineTo(x + 11, y); c.fill();
    cilindro(c, x - 11, y - 120, 22, 120, BRANCO);
    c.fillStyle = 'rgba(15,16,20,0.85)';
    c.fillRect(x - 11, y - 80, 22, 16);
    c.fillRect(x - 11, y - 40, 22, 16);
  }

  function desenharS2(x, y) {
    cilindro(c, x - 11, y - 70, 22, 70, BRANCO);
    c.fillStyle = 'rgba(15,16,20,0.85)';
    c.fillRect(x - 11, y - 70, 22, 6);
  }

  function desenharS3(x, y) {
    cilindro(c, x - 8, y - 42, 16, 42, BRANCO);
    c.fillStyle = 'rgba(15,16,20,0.85)';
    c.fillRect(x - 8, y - 42, 16, 5);
  }

  function desenharCapsula(x, y) {
    cilindro(c, x - 6, y - 22, 12, 22, PRATA);
    c.fillStyle = '#e4e9f1';
    c.beginPath(); c.moveTo(x - 6, y - 22); c.lineTo(x, y - 40); c.lineTo(x + 6, y - 22); c.fill();
  }

  function desenharTorre(x, y) {
    c.strokeStyle = '#cfd4dc';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 38); c.stroke();
    c.fillStyle = '#3a3d44';
    c.fillRect(x - 3, y - 30, 6, 14);
  }

  function desenharSaturn() {
    const x = FOGUETE_X;
    const base = sy(alt);
    const acesa = painel.estado === 'voando' || (painel.estado === 'contagem' && painel.contagem <= 2);
    if (acesa) {                                              // a chama fica no estágio de baixo
      if (partes.s1) chama(c, x, base + 3, 26, painel.estado === 'voando' ? 110 : 40);
      else if (partes.s2) chama(c, x, base - 119, 14, 60);
      else chama(c, x, base - 189, 9, 45);
    }
    if (partes.s1) desenharS1(x, base);
    if (partes.s2) desenharS2(x, base - 122);
    desenharS3(x, base - 192);
    desenharCapsula(x, base - 234);
    if (partes.torre) desenharTorre(x, base - 274);
  }

  function desenharChaoTerra() {
    const y = CHAO + cam;
    if (y > ALTURA + 340) return;
    c.fillStyle = '#2e5b34'; c.fillRect(0, y, LARGURA, ALTURA);
    c.fillStyle = '#4a505a'; c.fillRect(FOGUETE_X - 55, y, 110, 6);
    c.fillStyle = '#59616e'; c.fillRect(168, y - 290, 14, 290);
    c.fillStyle = Math.sin(performance.now() / 250) > 0 ? '#ff4040' : '#661111';
    c.beginPath(); c.arc(175, y - 296, 3, 0, Math.PI * 2); c.fill();
  }

  // ----- Terra, Lua, módulo lunar e bandeira -----
  function desenharGlobo(cx, cy, r) {                         // a Terra vista do espaço
    const g = c.createRadialGradient(cx + r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#3a8fe6');
    g.addColorStop(1, '#0b2f78');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(70,170,100,0.75)';
    [[0.2, -0.45, 0.35, 0.15], [-0.3, -0.2, 0.25, 0.12]].forEach(function (p) {
      c.beginPath(); c.ellipse(cx + p[0] * r, cy + p[1] * r, p[2] * r, p[3] * r, 0.4, 0, Math.PI * 2); c.fill();
    });
    c.restore();
  }

  function desenharEspaco() {
    c.fillStyle = '#02030a';
    c.fillRect(0, 0, LARGURA, ALTURA);
    desenharEstrelas(c, 1);
    desenharGlobo(60, 600, 230);

    const g = c.createRadialGradient(395, 105, 8, 410, 120, 62);
    g.addColorStop(0, '#f0f0f2');
    g.addColorStop(1, '#8a8d96');
    c.fillStyle = g;
    c.beginPath(); c.arc(410, 120, 60, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.13)';
    [[390, 100, 12], [430, 140, 15]].forEach(function (k) {
      c.beginPath(); c.arc(k[0], k[1], k[2], 0, Math.PI * 2); c.fill();
    });

    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 1.5;
    c.setLineDash([4, 6]);
    c.beginPath(); c.moveTo(P0[0], P0[1]); c.quadraticCurveTo(CURVA[0], CURVA[1], P1[0], P1[1]); c.stroke();
    c.setLineDash([]);

    const p = Math.min(1, tc / T_VIAGEM);
    const q = 1 - p;
    const x = q * q * P0[0] + 2 * q * p * CURVA[0] + p * p * P1[0];
    const y = q * q * P0[1] + 2 * q * p * CURVA[1] + p * p * P1[1];
    const dx = 2 * q * (CURVA[0] - P0[0]) + 2 * p * (P1[0] - CURVA[0]);
    const dy = 2 * q * (CURVA[1] - P0[1]) + 2 * p * (P1[1] - CURVA[1]);
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    if (p < 0.12) chama(c, 0, 6, 6, 22);
    cilindro(c, -5, -2, 10, 8, DOURADO);
    cilindro(c, -4, -18, 8, 16, BRANCO);
    c.fillStyle = '#e4e9f1';
    c.beginPath(); c.moveTo(-4, -18); c.lineTo(0, -26); c.lineTo(4, -18); c.fill();
    c.restore();

    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.font = '13px "Segoe UI", Arial, sans-serif';
    c.fillText('Terra', 28, 345);
    c.fillText('Lua', 396, 205);
  }

  function desenharSolo() {
    c.fillStyle = '#02030a';
    c.fillRect(0, 0, LARGURA, ALTURA);
    desenharEstrelas(c, 1);
    desenharGlobo(420, 110, 24);
    const g = c.createLinearGradient(0, CHAO, 0, ALTURA);
    g.addColorStop(0, '#a3a5ad');
    g.addColorStop(1, '#3b3d44');
    c.fillStyle = g;
    c.fillRect(0, CHAO, LARGURA, ALTURA);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    [[60, 570, 40, 10], [170, 590, 60, 12], [400, 565, 50, 10]].forEach(function (k) {
      c.beginPath(); c.ellipse(k[0], k[1], k[2], k[3], 0, 0, Math.PI * 2); c.fill();
    });
  }

  function desenharModulo(x, y) {
    c.strokeStyle = '#3a3d44';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - 12, y - 16); c.lineTo(x - 28, y);
    c.moveTo(x + 12, y - 16); c.lineTo(x + 28, y);
    c.stroke();
    c.fillStyle = '#3a3d44';
    c.fillRect(x - 33, y - 2, 10, 3);
    c.fillRect(x + 23, y - 2, 10, 3);
    cilindro(c, x - 17, y - 30, 34, 20, DOURADO);
    cilindro(c, x - 11, y - 52, 22, 22, PRATA);
    c.fillStyle = '#10141c';
    c.fillRect(x - 6, y - 45, 12, 6);
  }

  function desenharBandeira(x, y) {
    c.fillStyle = '#ddd';
    c.fillRect(x, y - 52, 2, 52);
    c.fillStyle = '#f2f2f2';
    c.fillRect(x + 2, y - 52, 30, 20);
    c.fillStyle = '#c62d3a';
    [0, 8, 16].forEach(function (d) { c.fillRect(x + 2, y - 52 + d, 30, 4); });
    c.fillStyle = '#1f3d8a';
    c.fillRect(x + 2, y - 52, 13, 10);
  }

  function desenhar() {
    let treme = tremor;
    if (cena === 'terra') {
      if (painel.estado === 'contagem' && painel.contagem <= 2) treme += 1.2;
      if (painel.estado === 'voando' && alt < 300) treme += 3 * (1 - alt / 300) + 0.6;
    }

    c.save();
    if (treme > 0) c.translate((Math.random() - 0.5) * treme * 2, (Math.random() - 0.5) * treme * 2);

    if (cena === 'terra') { ceu(c, cam); desenharChaoTerra(); }
    else if (cena === 'espaco') desenharEspaco();
    else desenharSolo();

    desenharFumaca(c, fumaca, cam);

    pedacos.forEach(function (p) {                            // estágios e torre caindo
      const y = sy(p.y);
      if (y > ALTURA + 300 || y < -500) return;
      c.save();
      c.translate(p.x, y - p.h / 2);
      c.rotate(p.rot);
      c.translate(0, p.h / 2);
      if (p.tipo === 's1') desenharS1(0, 0);
      else if (p.tipo === 's2') desenharS2(0, 0);
      else desenharTorre(0, 0);
      c.restore();
    });

    if (cena === 'terra') desenharSaturn();

    if (cena === 'lua') {
      const y = sy(la);
      if (painel.estado === 'voando') chama(c, LUA_X, y - 2, 12, 50);
      desenharModulo(LUA_X, y);
      if (pousou) desenharBandeira(LUA_X + 90, CHAO);
    }
    c.restore();

    if (escuro > 0) {                                         // transição entre cenas
      c.fillStyle = 'rgba(0,0,0,' + escuro + ')';
      c.fillRect(0, 0, LARGURA, ALTURA);
    }

    let a, v, casas = 1;
    if (cena === 'terra') { a = alt * 0.032; v = vel * 6.5; }
    else if (cena === 'espaco') {
      const p = Math.min(1, tc / T_VIAGEM);
      a = 190 + p * 384000; v = 10800 - 9500 * p; casas = 0;
    } else { a = la / ALT_DESCIDA * 15; v = 1700 * (1 - descidaQ); }

    $('lTempo').textContent = tempoTxt(tempo);
    $('lAlt').textContent = numero(a, casas) + ' km';
    $('lVel').textContent = numero(Math.round(v), 0) + ' m/s';
  }

  reiniciar();
  return { atualizar: atualizar, desenhar: desenhar, reiniciar: reiniciar };
})();

// ---------- 5. Alternar entre os simuladores e animar ----------
const modos = [
  { sim: falcon, botao: $('modoSat'), area: $('modoSatelite') },
  { sim: apollo, botao: $('modoLua'), area: $('lua') }
];
let ativo = modos[0];

modos.forEach(function (modo) {
  modo.botao.addEventListener('click', function () {
    if (modo === ativo) return;
    ativo.sim.reiniciar();
    ativo = modo;
    modos.forEach(function (m) {
      m.area.hidden = m !== ativo;
      m.botao.classList.toggle('ativo', m === ativo);
      m.botao.setAttribute('aria-pressed', String(m === ativo));
    });
  });
});

let ultimo = performance.now();
function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;
  ativo.sim.atualizar(dt);
  ativo.sim.desenhar();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
