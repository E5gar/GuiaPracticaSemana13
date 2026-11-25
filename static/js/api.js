(function () {
  var ETIQUETAS = {
    tipo_uso: { residencial: 'Residencial', comercial: 'Comercial', hospital: 'Hospital' },
    fuente: {
      trafico: 'Tráfico vehicular',
      construccion: 'Construcción',
      comercio: 'Comercio ambulante',
      industria: 'Industria',
      evento: 'Eventos y fiestas',
      vecindad: 'Vecindad',
      otro: 'Otra fuente'
    },
    estado: { pendiente: 'Pendiente', validada: 'Validada', rechazada: 'Rechazada' },
    franja: { madrugada: 'Madrugada', manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' }
  };

  var ICONOS_FUENTE = {
    trafico: 'car',
    construccion: 'hard-hat',
    comercio: 'store',
    industria: 'factory',
    evento: 'party-popper',
    vecindad: 'users',
    otro: 'ellipsis'
  };

  var ICONOS_TIPO = { residencial: 'house', comercial: 'store', hospital: 'hospital' };
  var ICONOS_AVISO = { exito: 'circle-check', error: 'circle-alert', info: 'info' };

  function leerCookie(nombre) {
    var partes = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < partes.length; i++) {
      var par = partes[i].split('=');
      if (decodeURIComponent(par[0]) === nombre) return decodeURIComponent(par.slice(1).join('='));
    }
    return '';
  }

  function query(params) {
    var q = new URLSearchParams();
    Object.keys(params || {}).forEach(function (clave) {
      var valor = params[clave];
      if (valor !== '' && valor !== null && valor !== undefined) q.set(clave, valor);
    });
    var texto = q.toString();
    return texto ? '?' + texto : '';
  }

  async function peticion(ruta, opciones) {
    var config = opciones || {};
    var metodo = config.metodo || 'GET';
    var cabeceras = { Accept: 'application/json' };
    var init = { method: metodo, headers: cabeceras, credentials: 'same-origin' };
    if (config.cuerpo !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      init.body = JSON.stringify(config.cuerpo);
    }
    if (metodo !== 'GET') cabeceras['X-CSRFToken'] = leerCookie('csrftoken');
    var respuesta = await fetch(ruta + query(config.params), init);
    var datos = null;
    try {
      datos = await respuesta.json();
    } catch (e) {
      datos = null;
    }
    if (!respuesta.ok) {
      var error = new Error('Error ' + respuesta.status);
      error.estado = respuesta.status;
      error.datos = datos;
      throw error;
    }
    return datos;
  }

  function get(ruta, params) { return peticion(ruta, { params: params }); }
  function post(ruta, cuerpo) { return peticion(ruta, { metodo: 'POST', cuerpo: cuerpo }); }
  function patch(ruta, cuerpo) { return peticion(ruta, { metodo: 'PATCH', cuerpo: cuerpo }); }

  function errorTexto(error) {
    if (error.estado === 429) return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
    if (error.datos && error.datos.detalle) return error.datos.detalle;
    if (error.datos && error.datos.detail) return error.datos.detail;
    return 'No se pudo completar la solicitud.';
  }

  function escapar(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function etiqueta(grupo, valor) {
    return (ETIQUETAS[grupo] && ETIQUETAS[grupo][valor]) || valor;
  }

  function fecha(iso) {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function db(valor) {
    return Number(valor).toFixed(1);
  }

  function nivel(valor) {
    var n = Number(valor);
    if (n < 55) return 'bajo';
    if (n < 70) return 'medio';
    if (n < 85) return 'alto';
    return 'critico';
  }

  function iconos() {
    if (window.lucide) window.lucide.createIcons();
  }

  function aviso(texto, tipo) {
    var contenedor = document.getElementById('avisos');
    if (!contenedor) return;
    var tipoFinal = tipo || 'info';
    var elemento = document.createElement('div');
    elemento.className = 'aviso aviso-' + tipoFinal;
    elemento.setAttribute('role', 'status');
    elemento.innerHTML = '<i data-lucide="' + ICONOS_AVISO[tipoFinal] + '"></i><span>' + escapar(texto) + '</span>';
    contenedor.appendChild(elemento);
    iconos();
    setTimeout(function () {
      elemento.classList.add('saliendo');
      setTimeout(function () { elemento.remove(); }, 300);
    }, 4500);
  }

  function paginar(contenedor, pagina, total, alCambiar) {
    if (total <= 1) {
      contenedor.innerHTML = '';
      contenedor.onclick = null;
      return;
    }
    var paginas = [];
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - pagina) <= 1) {
        paginas.push(i);
      } else if (paginas[paginas.length - 1] !== '...') {
        paginas.push('...');
      }
    }
    var html = '<button class="pagina-btn" type="button" data-p="' + (pagina - 1) + '"' +
      (pagina === 1 ? ' disabled' : '') + ' aria-label="Página anterior"><i data-lucide="chevron-left"></i></button>';
    paginas.forEach(function (p) {
      if (p === '...') {
        html += '<span class="pagina-puntos">…</span>';
      } else {
        html += '<button class="pagina-btn" type="button" data-p="' + p + '"' +
          (p === pagina ? ' aria-current="page"' : '') + '>' + p + '</button>';
      }
    });
    html += '<button class="pagina-btn" type="button" data-p="' + (pagina + 1) + '"' +
      (pagina === total ? ' disabled' : '') + ' aria-label="Página siguiente"><i data-lucide="chevron-right"></i></button>';
    contenedor.innerHTML = html;
    iconos();
    contenedor.onclick = function (evento) {
      var boton = evento.target.closest('[data-p]');
      if (!boton || boton.disabled) return;
      alCambiar(Number(boton.dataset.p));
    };
  }

  function franjasHtml(lista) {
    return lista.map(function (f) {
      var vacia = f.promedio === null;
      var alto = vacia ? 0 : Math.max(4, Math.min(100, ((f.promedio - 30) / 70) * 100));
      return '<div class="franja">' +
        '<span class="franja-valor">' + (vacia ? '--' : db(f.promedio)) + '</span>' +
        '<div class="franja-pista"><div class="franja-relleno nivel-' + (vacia ? 'bajo' : nivel(f.promedio)) +
        '" style="height:' + alto + '%"></div></div>' +
        '<span class="franja-nombre">' + etiqueta('franja', f.franja) + '</span>' +
        '<span class="franja-total">' + f.total + ' reportes</span>' +
        '</div>';
    }).join('');
  }

  window.Api = {
    get: get,
    post: post,
    patch: patch,
    query: query,
    errorTexto: errorTexto,
    escapar: escapar,
    etiqueta: etiqueta,
    fecha: fecha,
    db: db,
    nivel: nivel,
    iconos: iconos,
    aviso: aviso,
    paginar: paginar,
    franjasHtml: franjasHtml,
    iconoFuente: function (valor) { return ICONOS_FUENTE[valor] || 'ellipsis'; },
    iconoTipo: function (valor) { return ICONOS_TIPO[valor] || 'map-pin'; }
  };
})();