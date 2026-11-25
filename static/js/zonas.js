(function () {
  var A = window.Api;
  var form = document.getElementById('filtros-zonas');
  var grid = document.getElementById('zonas-grid');
  var paginacion = document.getElementById('paginacion');
  var total = document.getElementById('zonas-total');
  var dialogo = document.getElementById('dialogo-zona');
  var CAMPOS = ['search', 'distrito', 'tipo_uso', 'ordering'];
  var TAMANO = 9;
  var estado = { pagina: 1 };
  var temporizador = null;

  function leerUrl() {
    var p = new URLSearchParams(window.location.search);
    CAMPOS.forEach(function (c) { form.elements[c].value = p.get(c) || ''; });
    estado.pagina = parseInt(p.get('page'), 10) || 1;
  }

  function parametros() {
    var o = { page: estado.pagina };
    CAMPOS.forEach(function (c) { o[c] = form.elements[c].value; });
    return o;
  }

  function sincronizarUrl(params) {
    var visibles = Object.assign({}, params);
    if (visibles.page === 1) delete visibles.page;
    history.replaceState(null, '', window.location.pathname + A.query(visibles));
  }

  function esqueletos() {
    var html = '';
    for (var i = 0; i < 6; i++) html += '<div class="esqueleto" style="height:230px"></div>';
    grid.innerHTML = html;
  }

  function tarjeta(z) {
    return '<article class="zona-card">' +
      '<div class="zona-card-cabeza"><div>' +
      '<h3>' + A.escapar(z.nombre) + '</h3>' +
      '<span class="celda-sub">' + A.escapar(z.distrito) + '</span></div>' +
      '<span class="chip"><i data-lucide="' + A.iconoTipo(z.tipo_uso) + '"></i>' + A.etiqueta('tipo_uso', z.tipo_uso) + '</span></div>' +
      '<p class="zona-limite">' + z.limite_db + '<small>dB de límite</small></p>' +
      '<div class="zona-pie"><span>' + z.total_mediciones + ' mediciones</span>' +
      '<button class="boton boton-contorno boton-sm" type="button" data-promedio="' + z.id + '" data-nombre="' + A.escapar(z.nombre) + '">' +
      '<i data-lucide="activity"></i>Promedio</button></div>' +
      '</article>';
  }

  async function cargar() {
    var params = parametros();
    sincronizarUrl(params);
    grid.setAttribute('aria-busy', 'true');
    esqueletos();
    try {
      var datos = await A.get('/api/zonas/', Object.assign({}, params, { page_size: TAMANO }));
      total.textContent = datos.count + (datos.count === 1 ? ' zona encontrada' : ' zonas encontradas');
      if (!datos.results.length) {
        grid.innerHTML = '<div class="vacio"><i data-lucide="map-pin-off"></i><p>No hay zonas que coincidan con los filtros.</p></div>';
      } else {
        grid.innerHTML = datos.results.map(tarjeta).join('');
      }
      A.paginar(paginacion, datos.pagina_actual, datos.total_paginas, function (p) {
        estado.pagina = p;
        cargar();
        window.scrollTo({ top: 0 });
      });
    } catch (error) {
      if (error.estado === 404 && estado.pagina > 1) {
        estado.pagina = 1;
        return cargar();
      }
      grid.innerHTML = '<div class="vacio"><i data-lucide="triangle-alert"></i><p>' + A.escapar(A.errorTexto(error)) + '</p></div>';
      paginacion.innerHTML = '';
    }
    grid.removeAttribute('aria-busy');
    A.iconos();
  }

  function cifra(titulo, valor) {
    return '<div class="mini-cifra"><span>' + titulo + '</span><strong>' + valor + '</strong></div>';
  }

  async function abrirPromedio(id, nombre) {
    var cuerpo = document.getElementById('dialogo-cuerpo');
    document.getElementById('dialogo-titulo').textContent = nombre;
    document.getElementById('dialogo-sub').textContent = '';
    cuerpo.innerHTML = '<div class="esqueleto" style="height:220px"></div>';
    dialogo.showModal();
    try {
      var r = await A.get('/api/zonas/' + id + '/promedio-ruido/');
      document.getElementById('dialogo-sub').textContent =
        r.distrito + ' · ' + A.etiqueta('tipo_uso', r.tipo_uso) + ' · límite ' + r.limite_db + ' dB';
      if (!r.total) {
        cuerpo.innerHTML = '<div class="vacio"><i data-lucide="audio-lines"></i><p>Esta zona aún no tiene mediciones aceptadas.</p></div>';
      } else {
        cuerpo.innerHTML =
          '<div class="mini-cifras">' +
          cifra('Promedio', A.db(r.promedio) + ' dB') +
          cifra('Máximo', A.db(r.maximo) + ' dB') +
          cifra('Mínimo', A.db(r.minimo) + ' dB') +
          cifra('Exceden límite', r.excedidas + ' de ' + r.total) +
          '</div>' +
          '<div class="franjas">' + A.franjasHtml(r.por_franja) + '</div>' +
          '<a class="boton boton-contorno" href="/mediciones/?zona=' + id + '">Ver mediciones de esta zona<i data-lucide="arrow-right"></i></a>';
      }
    } catch (error) {
      cuerpo.innerHTML = '<div class="vacio"><i data-lucide="triangle-alert"></i><p>' + A.escapar(A.errorTexto(error)) + '</p></div>';
    }
    A.iconos();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); });

  form.addEventListener('input', function (e) {
    if (e.target.name !== 'search') return;
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      estado.pagina = 1;
      cargar();
    }, 300);
  });

  form.addEventListener('change', function (e) {
    if (e.target.name === 'search') return;
    estado.pagina = 1;
    cargar();
  });

  document.getElementById('limpiar').addEventListener('click', function () {
    form.reset();
    estado.pagina = 1;
    cargar();
  });

  grid.addEventListener('click', function (e) {
    var boton = e.target.closest('[data-promedio]');
    if (!boton) return;
    abrirPromedio(boton.dataset.promedio, boton.dataset.nombre);
  });

  dialogo.addEventListener('click', function (e) {
    if (e.target === dialogo || e.target.closest('[data-cerrar]')) dialogo.close();
  });

  leerUrl();
  cargar();
})();