(function () {
  var A = window.Api;
  var form = document.getElementById('form-reporte');
  var selectZona = form.elements.zona;
  var campoDb = document.getElementById('decibeles');
  var rango = document.getElementById('rango-db');
  var lectura = document.getElementById('lectura-db');
  var comparativa = document.getElementById('comparativa');
  var errorGeneral = document.getElementById('error-general');
  var resultado = document.getElementById('resultado');
  var enviar = document.getElementById('enviar');

  var HITOS = [
    [120, 'un cohetón'],
    [100, 'una banda en fiesta patronal'],
    [85, 'el claxon de una combi'],
    [70, 'una avenida concurrida'],
    [60, 'una conversación animada'],
    [40, 'una biblioteca'],
    [20, 'un susurro lejano']
  ];

  function limiteSeleccionado() {
    var opcion = selectZona.options[selectZona.selectedIndex];
    return opcion && opcion.dataset.limite ? Number(opcion.dataset.limite) : null;
  }

  function actualizarLectura() {
    var valor = Number(campoDb.value);
    if (!isFinite(valor) || campoDb.value === '') {
      lectura.textContent = '';
      comparativa.textContent = '';
      comparativa.removeAttribute('data-estado');
      return;
    }
    var hito = HITOS.find(function (h) { return valor >= h[0]; }) || HITOS[HITOS.length - 1];
    lectura.textContent = 'Equivale aproximadamente a ' + hito[1] + '.';
    var limite = limiteSeleccionado();
    if (limite === null) {
      comparativa.textContent = 'Elige una zona para comparar con su límite.';
      comparativa.removeAttribute('data-estado');
    } else if (valor > limite) {
      comparativa.textContent = 'Supera el límite de la zona (' + limite + ' dB) por ' + (valor - limite).toFixed(1) + ' dB.';
      comparativa.dataset.estado = 'excede';
    } else {
      comparativa.textContent = 'Dentro del límite de la zona (' + limite + ' dB).';
      comparativa.dataset.estado = 'ok';
    }
  }

  async function cargarZonas() {
    try {
      var datos = await A.get('/api/zonas/', { page_size: 100, ordering: 'distrito' });
      var grupos = {};
      datos.results.forEach(function (z) {
        if (!grupos[z.distrito]) grupos[z.distrito] = [];
        grupos[z.distrito].push(z);
      });
      var html = '<option value="">Selecciona una zona</option>';
      Object.keys(grupos).forEach(function (distrito) {
        html += '<optgroup label="' + A.escapar(distrito) + '">';
        grupos[distrito].forEach(function (z) {
          html += '<option value="' + A.escapar(z.url) + '" data-limite="' + z.limite_db + '">' +
            A.escapar(z.nombre) + ' · ' + A.etiqueta('tipo_uso', z.tipo_uso) + '</option>';
        });
        html += '</optgroup>';
      });
      selectZona.innerHTML = html;
    } catch (error) {
      selectZona.innerHTML = '<option value="">No se pudieron cargar las zonas</option>';
      A.aviso(A.errorTexto(error), 'error');
    }
  }

  function limpiarErrores() {
    errorGeneral.hidden = true;
    errorGeneral.textContent = '';
    form.querySelectorAll('[data-error]').forEach(function (nodo) { nodo.textContent = ''; });
  }

  function mostrarErrores(datos) {
    var general = [];
    Object.keys(datos).forEach(function (campo) {
      var mensajes = [].concat(datos[campo]).join(' ');
      var nodo = form.querySelector('[data-error="' + campo + '"]');
      if (nodo) {
        nodo.textContent = mensajes;
      } else {
        general.push(mensajes);
      }
    });
    if (general.length) {
      errorGeneral.textContent = general.join(' ');
      errorGeneral.hidden = false;
    }
  }

  function mostrarResultado(m) {
    var excede = m.excede_limite;
    resultado.hidden = false;
    resultado.innerHTML =
      '<h3><i data-lucide="' + (excede ? 'triangle-alert' : 'circle-check') + '"></i>Reporte recibido</h3>' +
      '<p>' + A.escapar(m.zona_nombre) + ' · ' + A.db(m.decibeles) + ' dB. ' +
      (excede
        ? 'Supera el límite de la zona por ' + A.db(m.exceso_db) + ' dB.'
        : 'Se encuentra dentro del límite de la zona.') +
      ' Quedó en estado pendiente de revisión.</p>' +
      '<a class="boton boton-contorno boton-sm" href="/mediciones/">Ver mediciones<i data-lucide="arrow-right"></i></a>';
    A.iconos();
  }

  campoDb.addEventListener('input', function () {
    rango.value = campoDb.value;
    actualizarLectura();
  });

  rango.addEventListener('input', function () {
    campoDb.value = rango.value;
    actualizarLectura();
  });

  selectZona.addEventListener('change', actualizarLectura);

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    limpiarErrores();
    resultado.hidden = true;
    if (!selectZona.value) {
      form.querySelector('[data-error="zona"]').textContent = 'Selecciona una zona.';
      return;
    }
    if (campoDb.value === '') {
      form.querySelector('[data-error="decibeles"]').textContent = 'Indica el nivel medido.';
      return;
    }
    enviar.disabled = true;
    try {
      var medicion = await A.post('/api/mediciones/', {
        zona: selectZona.value,
        decibeles: Number(campoDb.value),
        fuente: form.elements.fuente.value
      });
      mostrarResultado(medicion);
      A.aviso('Medición registrada correctamente', 'exito');
      selectZona.value = '';
      actualizarLectura();
    } catch (error) {
      if (error.estado === 400 && error.datos) {
        mostrarErrores(error.datos);
      } else {
        errorGeneral.textContent = A.errorTexto(error);
        errorGeneral.hidden = false;
      }
    }
    enviar.disabled = false;
  });

  cargarZonas().then(actualizarLectura);
})();