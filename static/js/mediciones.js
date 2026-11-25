(function () {
  var A = window.Api;
  var form = document.getElementById('filtros-mediciones');
  var cabeza = document.getElementById('tabla-cabeza');
  var cuerpo = document.getElementById('tabla-cuerpo');
  var paginacion = document.getElementById('paginacion');
  var total = document.getElementById('mediciones-total');
  var personal = document.body.dataset.personal === 'true';
  var CAMPOS = ['zona', 'estado_revision', 'fuente', 'distrito', 'tipo_uso', 'excede_limite', 'desde', 'hasta', 'ordering'];
  var TAMANO = 15;
  var estado = { pagina: 1 };

  function columnas() {
    return personal ? 6 : 5;
  }

  function pintarCabeza() {
    cabeza.innerHTML = '<tr><th>Registro</th><th>Zona</th><th>Fuente</th><th>Nivel</th><th>Estado</th>' +
      (personal ? '<th><span class="acciones-fila">Acciones</span></th>' : '') + '</tr>';
  }

  function leerUrl() {
    var p = new URLSearchParams(window.location.search);
    CAMPOS.forEach(function (c) {
      var valor = p.get(c);
      form.elements[c].value = valor === null ? (c === 'ordering' ? '-registrado_en' : '') : valor;
    });
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
    if (visibles.ordering === '-registrado_en') delete visibles.ordering;
    history.replaceState(null, '', window.location.pathname + A.query(visibles));
  }

  function acciones(m) {
    var html = '';
    if (m.estado_revision === 'pendiente') {
      html += '<button class="boton boton-contorno boton-icono" type="button" data-accion="validar" aria-label="Validar medición"><i data-lucide="check"></i></button>';
      html += '<button class="boton boton-contorno boton-icono" type="button" data-accion="rechazar" aria-label="Rechazar medición"><i data-lucide="x"></i></button>';
    }
    if (m.enlaces && m.enlaces.emitir_multa) {
      html += '<button class="boton boton-primario boton-sm" type="button" data-accion="multa"><i data-lucide="gavel"></i>Emitir multa</button>';
    }
    return '<div class="acciones-fila">' + html + '</div>';
  }

  function fila(m) {
    var multa = m.multa_emitida
      ? '<span class="insignia insignia-excede">Multa S/ ' + Number(m.multa_monto).toFixed(2) + '</span>'
      : '';
    return '<tr data-id="' + m.id + '">' +
      '<td class="mono">' + A.fecha(m.registrado_en) + '</td>' +
      '<td><span class="celda-fuerte">' + A.escapar(m.zona_nombre) + '</span>' +
      '<span class="celda-sub">' + A.escapar(m.zona_distrito) + ' · ' + A.etiqueta('tipo_uso', m.zona_tipo_uso) + '</span></td>' +
      '<td><span class="fuente-celda"><i data-lucide="' + A.iconoFuente(m.fuente) + '"></i>' + A.etiqueta('fuente', m.fuente) + '</span></td>' +
      '<td><div class="db-celda nivel-' + A.nivel(m.decibeles) + '">' +
      '<span class="punto"></span><span class="db-valor">' + A.db(m.decibeles) + ' dB</span>' +
      (m.excede_limite
        ? '<span class="insignia insignia-excede">+' + A.db(m.exceso_db) + ' sobre ' + m.limite_db + '</span>'
        : '<span class="insignia insignia-ok">Límite ' + m.limite_db + '</span>') +
      '</div></td>' +
      '<td><div class="estado-celda"><span class="insignia insignia-' + m.estado_revision + '">' +
      A.etiqueta('estado', m.estado_revision) + '</span>' + multa + '</div></td>' +
      (personal ? '<td>' + acciones(m) + '</td>' : '') +
      '</tr>';
  }

  function esqueletos() {
    var html = '';
    for (var i = 0; i < 6; i++) {
      html += '<tr><td colspan="' + columnas() + '"><div class="esqueleto" style="height:36px"></div></td></tr>';
    }
    cuerpo.innerHTML = html;
  }

  async function cargar() {
    var params = parametros();
    sincronizarUrl(params);
    esqueletos();
    try {
      var datos = await A.get('/api/mediciones/', Object.assign({}, params, { page_size: TAMANO }));
      total.textContent = datos.count.toLocaleString('es-PE') + (datos.count === 1 ? ' medición' : ' mediciones') +
        ' · página ' + datos.pagina_actual + ' de ' + Math.max(datos.total_paginas, 1);
      if (!datos.results.length) {
        cuerpo.innerHTML = '<tr><td colspan="' + columnas() + '"><div class="vacio"><i data-lucide="audio-lines"></i><p>No hay mediciones con estos filtros.</p></div></td></tr>';
      } else {
        cuerpo.innerHTML = datos.results.map(fila).join('');
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
      cuerpo.innerHTML = '<tr><td colspan="' + columnas() + '"><div class="vacio"><i data-lucide="triangle-alert"></i><p>' + A.escapar(A.errorTexto(error)) + '</p></div></td></tr>';
      paginacion.innerHTML = '';
      total.textContent = '';
    }
    A.iconos();
  }

  cuerpo.addEventListener('click', async function (e) {
    var boton = e.target.closest('[data-accion]');
    if (!boton) return;
    var id = boton.closest('tr').dataset.id;
    var accion = boton.dataset.accion;
    boton.disabled = true;
    try {
      if (accion === 'multa') {
        var multa = await A.post('/api/mediciones/' + id + '/emitir-multa/');
        A.aviso('Multa emitida por S/ ' + Number(multa.monto).toFixed(2), 'exito');
      } else {
        var nuevo = accion === 'validar' ? 'validada' : 'rechazada';
        await A.patch('/api/mediciones/' + id + '/', { estado_revision: nuevo });
        A.aviso('Medición ' + (nuevo === 'validada' ? 'validada' : 'rechazada'), 'exito');
      }
      await cargar();
    } catch (error) {
      A.aviso(A.errorTexto(error), 'error');
      boton.disabled = false;
    }
  });

  form.addEventListener('submit', function (e) { e.preventDefault(); });

  form.addEventListener('change', function () {
    estado.pagina = 1;
    cargar();
  });

  document.getElementById('limpiar').addEventListener('click', function () {
    form.reset();
    form.elements.zona.value = '';
    form.elements.ordering.value = '-registrado_en';
    estado.pagina = 1;
    cargar();
  });

  pintarCabeza();
  leerUrl();
  cargar();
})();