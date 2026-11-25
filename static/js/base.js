(function () {
  function aplicarTema(tema) {
    document.documentElement.dataset.theme = tema;
    try {
      localStorage.setItem('tema', tema);
    } catch (e) {}
  }

  document.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-tema-alternar]');
    if (!boton) return;
    var actual = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    aplicarTema(actual === 'light' ? 'dark' : 'light');
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
})();