const saida = document.getElementById('saida');
const cmd = document.getElementById('cmd');
const usuario = 'Usuario001';

// Cria uma linha nova dentro da saída
function escrever(texto) {
  const linha = document.createElement('div');
  linha.textContent = texto;
  saida.appendChild(linha);
}

// Roda quando uma tecla é apertada no input
cmd.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;

  const texto = cmd.value.trim();

  // Enter sem digitar nada só repete o usuário
  if (texto === '') {
    escrever(usuario);
    return;
  }

  // Mostra o que foi digitado
  escrever(usuario + ' ' + texto);

  // Responde
  if (texto === 'ajuda') {
    escrever('Comandos: ajuda, ola, limpar');
  } else if (texto === 'ola') {
    escrever('Olá, mundo!');
  } else if (texto === 'limpar') {
    saida.innerHTML = '';
  } else {
    escrever('comando não encontrado: ' + texto);
  }

  cmd.value = ''; // esvazia o input
});