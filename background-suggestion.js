/* background-suggestion.js
   Inicializa partículas via tsParticles se a lib estiver carregada.
   Coloque este arquivo na raiz e adicione o <script> antes do </body>.
   O código falha graciosamente se tsParticles não estiver presente (fica apenas o CSS).
*/
(function(){
  function initParticles() {
    if (typeof window.tsParticles === 'undefined' && typeof window.tsparticles === 'undefined') {
      // biblioteca não carregada — fallback para apenas CSS
      console.log('[background] tsParticles não encontrado — usando somente CSS.');
      return;
    }

    const ts = window.tsParticles || window.tsparticles || window.tsParticles;
    if (!ts || !ts.load) {
      console.log('[background] tsParticles disponível mas método load não encontrado.');
      return;
    }

    ts.load('tsparticles', {
      fullScreen: { enable: false },
      detectRetina: true,
      fpsLimit: 60,
      background: { color: 'transparent' },
      particles: {
        number: { value: 40, density: { enable: true, area: 800 } },
        color: { value: ['#0d7de0', '#0a5fb8', '#7ef9ff'] },
        shape: { type: 'circle' },
        opacity: { value: 0.14, random: true },
        size: { value: { min: 1, max: 3 }, random: true },
        links: { enable: true, distance: 120, color: '#0d7de0', opacity: 0.08, width: 1 },
        move: { enable: true, speed: 0.6, direction: 'none', outModes: { default: 'out' } }
      },
      interactivity: {
        detectsOn: 'canvas',
        events: {
          onHover: { enable: false },
          onClick: { enable: false },
          resize: true
        }
      }
    }).then(() => {
      console.log('[background] tsParticles iniciado.');
    }).catch((e) => {
      console.warn('[background] erro ao inicializar tsParticles:', e);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initParticles, 50);
  } else {
    window.addEventListener('DOMContentLoaded', initParticles);
  }
})();