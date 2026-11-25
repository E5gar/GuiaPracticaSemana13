(function () {
  var A = window.Api;
  var MIN = 30;
  var MAX = 120;

  function posicion(valor) {
    var acotado = Math.min(MAX, Math.max(MIN, Number(valor)));
    return ((acotado - MIN) / (MAX - MIN)) * 100;
  }

  function pintarCifras(r) {
    var total = r.total || 0;
    var porcentaje = total ? Math.round((r.excedidas / total) * 100) : 0;
    document.querySelector('[data-cifra="total"]').textContent = total.toLocaleString('es-PE');
    document.querySelector('[data-cifra="pendientes"]').textContent = (r.pendientes || 0).toLocaleString('es-PE');
    document.querySelector('[data-cifra="porcentaje"]').textContent = porcentaje + '%';
  }

  function pintarRegla(r) {
    var marcador = document.getElementById('regla-marcador');
    var valor = document.getElementById('regla-valor');
    if (r.promedio === null) {
      valor.textContent = '--';
      return;
    }
    marcador.style.setProperty('--pos', posicion(r.promedio) + '%');
    valor.textContent = A.db(r.promedio);
  }

  function pintarFranjas(r) {
    document.getElementById('franjas').innerHTML = A.franjasHtml(r.por_franja);
  }

  function pintarFuentes(r) {
    var contenedor = document.getElementById('fuentes');
    if (!r.por_fuente.length) {
      contenedor.innerHTML = '<li class="celda-sub">Aún no hay reportes.</li>';
      return;
    }
    var maximo = Math.max.apply(null, r.por_fuente.map(function (f) { return f.total; }));
    contenedor.innerHTML = r.por_fuente.map(function (f) {
      return '<li class="hbarra">' +
        '<div class="hbarra-cabeza"><span><i data-lucide="' + A.iconoFuente(f.fuente) + '"></i>' +
        A.etiqueta('fuente', f.fuente) + '</span><b>' + f.total + '</b></div>' +
        '<div class="hbarra-pista"><div class="hbarra-relleno" style="width:' + (f.total / maximo) * 100 + '%"></div></div>' +
        '</li>';
    }).join('');
  }

  function pintarTop(r) {
    var contenedor = document.getElementById('top-zonas');
    if (!r.top_zonas.length) {
      contenedor.innerHTML = '<li class="celda-sub">Aún no hay reportes.</li>';
      return;
    }
    contenedor.innerHTML = r.top_zonas.map(function (z, i) {
      return '<li><a class="ranking-fila" href="/mediciones/?zona=' + z.zona_id + '">' +
        '<span class="ranking-puesto">' + (i + 1) + '</span>' +
        '<span><span class="ranking-nombre">' + A.escapar(z.nombre) + '</span>' +
        '<span class="celda-sub">' + A.escapar(z.distrito) + ' · límite ' + z.limite_db + ' dB</span></span>' +
        '<span class="ranking-valor"><strong>' + A.db(z.promedio) + '</strong><small>dB promedio</small></span>' +
        '</a></li>';
    }).join('');
  }

  function pintarUltimos(datos) {
    var contenedor = document.getElementById('ultimos');
    if (!datos.results.length) {
      contenedor.innerHTML = '<li class="celda-sub">Aún no hay reportes.</li>';
      return;
    }
    contenedor.innerHTML = datos.results.map(function (m) {
      return '<li class="reciente">' +
        '<div><span class="celda-fuerte">' + A.escapar(m.zona_nombre) + '</span>' +
        '<span class="celda-sub">' + A.escapar(m.zona_distrito) + ' · ' + A.etiqueta('fuente', m.fuente) + ' · ' + A.fecha(m.registrado_en) + '</span></div>' +
        '<div class="reciente-db nivel-' + A.nivel(m.decibeles) + '"><span class="punto"></span>' + A.db(m.decibeles) + ' dB' +
        (m.excede_limite ? '<span class="insignia insignia-excede">Excede</span>' : '') + '</div>' +
        '</li>';
    }).join('');
  }

  function fallo(id, error) {
    var nodo = document.getElementById(id);
    if (nodo) nodo.innerHTML = '<p class="celda-sub">' + A.escapar(A.errorTexto(error)) + '</p>';
  }

  async function iniciar() {
    try {
      var resumen = await A.get('/api/mediciones/resumen/');
      pintarCifras(resumen);
      pintarRegla(resumen);
      pintarFranjas(resumen);
      pintarFuentes(resumen);
      pintarTop(resumen);
    } catch (error) {
      ['franjas', 'fuentes', 'top-zonas'].forEach(function (id) { fallo(id, error); });
    }
    try {
      pintarUltimos(await A.get('/api/mediciones/', { page_size: 5 }));
    } catch (error) {
      fallo('ultimos', error);
    }
    A.iconos();
  }

  iniciar();
})();