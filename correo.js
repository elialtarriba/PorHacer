/* PorHacer · emails: tarea nueva, recordatorio e invitación a un tablero
   - Con EmailJS configurado (email-config.js): se envía solo, con diseño.
   - Si no: se abre tu app de correo con el texto ya escrito y ordenado.   */

const Correo = {
  url(extra){ return (typeof APP_URL !== 'undefined' ? APP_URL : location.origin + location.pathname) + (extra || ''); },
  hayEmailJS(){ return typeof EMAILJS === 'object' && EMAILJS && EMAILJS.servicio && EMAILJS.plantilla && EMAILJS.clave; },
  remitente(){ return (typeof Nube !== 'undefined' && Nube.user) ? Nube.nombreYo() : (App.ajustes.firma || 'PorHacer'); },
  remitenteEmail(){ return (typeof Nube !== 'undefined' && Nube.user) ? Nube.email() : ''; },

  /* ---------- Envío ---------- */
  async enviar({ para, nombre, asunto, html, texto }){
    if(this.hayEmailJS()){
      try{
        const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ service_id:EMAILJS.servicio, template_id:EMAILJS.plantilla, user_id:EMAILJS.clave,
            template_params:{ to_email:para, to_name:nombre, subject:asunto, html, from_name:this.remitente() + ' · PorHacer', reply_to:this.remitenteEmail() } })
        });
        if(!r.ok) throw new Error(await r.text());
        toast('📧 Email enviado a ' + (nombre || para));
        return true;
      }catch(e){ console.warn('EmailJS', e); toast('⚠️ No se pudo enviar solo: se abre tu correo'); }
    }
    // Respaldo: abrir el correo con el texto preparado (saltos de línea \r\n)
    let cuerpo = texto.replace(/\r?\n/g, '\r\n');
    if(cuerpo.length > 1900) cuerpo = cuerpo.slice(0, 1890) + '…';
    location.href = 'mailto:' + encodeURIComponent(para) + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
    return true;
  },

  /* ---------- Diseño del email (HTML con estilos dentro, como piden los correos) ---------- */
  colores(){
    const c = App.ajustes.colores || {};
    return { accent:c.accent || '#e5201c', dark:c.dark || '#3a3a3c', bg:c.bg || '#eeeff1', ink:'#2c2c2e', ink2:'#6e6e76', line:'#e2e3e7' };
  },
  marco({ etiqueta, titulo, saludo, cuerpo, boton, enlace, pie }){
    const k = this.colores();
    const logo = this.url('logo.png');
    return `<!doctype html><html><body style="margin:0;padding:0;background:${k.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${k.bg};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08);">
  <tr><td style="background:${k.dark};padding:18px 22px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${logo}" width="44" height="44" alt="" style="display:block;border-radius:12px;background:#fff;"></td>
      <td style="padding-left:12px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.4px;">Por<span style="color:${k.accent};">Hacer</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:26px 26px 6px;">
    <div style="display:inline-block;background:${k.accent};color:#ffffff;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;border-radius:8px;padding:5px 10px;">${etiqueta}</div>
    <h1 style="margin:14px 0 6px;font-size:24px;line-height:1.25;color:${k.dark};font-weight:800;">${titulo}</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:${k.ink};">${saludo}</p>
    ${cuerpo}
  </td></tr>
  <tr><td style="padding:8px 26px 4px;" align="center">
    <a href="${boton.url}" style="display:inline-block;background:${k.accent};color:#ffffff;text-decoration:none;font-size:17px;font-weight:800;border-radius:14px;padding:15px 30px;">${boton.txt}</a>
  </td></tr>
  <tr><td style="padding:16px 26px 8px;">
    <p style="margin:0 0 6px;font-size:13px;color:${k.ink2};text-align:center;">¿No se abre? Copia este enlace en el navegador (mantén el dedo encima → Copiar):</p>
    <div style="background:${k.bg};border:1px dashed #c9cad0;border-radius:12px;padding:12px;text-align:center;font-size:15px;font-weight:700;word-break:break-all;">
      <a href="${enlace}" style="color:${k.dark};text-decoration:none;">${enlace}</a>
    </div>
  </td></tr>
  <tr><td style="padding:18px 26px 24px;border-top:1px solid ${k.line};font-size:13px;line-height:1.5;color:${k.ink2};text-align:center;">${pie}</td></tr>
</table>
</td></tr></table></body></html>`;
  },
  fichaTarea(t){
    const k = this.colores(), col = colDe(t.colId), r = rango(t), p = persona(t.personaId);
    const fondo = fondoTarea(t.color) || '#ffffff';
    const fila = (ico, txt) => `<tr><td style="padding:5px 0;font-size:15px;color:${k.ink};"><span style="display:inline-block;width:26px;">${ico}</span>${txt}</td></tr>`;
    const prio = t.prio ? ['', '🔵 Baja', '🟠 Media', '🔴 Alta'][t.prio] : '';
    const fechas = r ? (r[0] === r[1] ? fLarga(r[0]) : 'Del ' + fLarga(r[0]) + '<br><span style="display:inline-block;width:26px;"></span>al ' + fLarga(r[1])) : '';
    const subs = (t.subs || []);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fondo};border:3px solid ${col.color};border-radius:16px;margin:0 0 18px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:20px;font-weight:800;color:#2a2a2c;margin-bottom:8px;">${esc(t.titulo)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0">
          ${fila('📌', `<span style="display:inline-block;background:${col.color};color:#fff;border-radius:7px;padding:2px 9px;font-weight:700;font-size:14px;">${esc(col.nombre)}</span>`)}
          ${fechas ? fila('📅', fechas) : ''}
          ${prio ? fila('⚡', 'Prioridad ' + prio) : ''}
          ${p ? fila('👤', esc(nombreP(p))) : ''}
        </table>
        ${t.notas ? `<div style="margin-top:12px;background:rgba(255,255,255,.75);border-radius:12px;padding:12px 14px;font-size:15px;line-height:1.55;color:#3a3a3e;white-space:pre-wrap;">${esc(t.notas)}</div>` : ''}
        ${subs.length ? `<div style="margin-top:12px;font-size:14px;font-weight:800;color:${k.ink2};text-transform:uppercase;letter-spacing:.3px;">Pasos</div>` + subs.map(s => `<div style="font-size:15px;padding:4px 0;color:#3a3a3e;">${s.ok ? '✅ <s>' + esc(s.t) + '</s>' : '⬜ ' + esc(s.t)}</div>`).join('') : ''}
        ${(t.nf || t.nv || t.na) ? `<div style="margin-top:10px;font-size:14px;color:${k.ink2};">${t.nf ? '📷 ' + t.nf + ' foto' + (t.nf>1?'s':'') + ' &nbsp; ' : ''}${t.nv ? '🎬 ' + t.nv + ' vídeo' + (t.nv>1?'s':'') + ' &nbsp; ' : ''}${t.na ? '🎙️ ' + t.na + ' audio' + (t.na>1?'s':'') : ''} — en la app</div>` : ''}
      </td></tr></table>`;
  },
  textoTarea(t){
    const col = colDe(t.colId), r = rango(t);
    const l = ['📋 ' + t.titulo, '', '📌 Estado: ' + col.nombre];
    if(r) l.push('📅 ' + (r[0] === r[1] ? fLarga(r[0]) : 'Del ' + fLarga(r[0]) + ' al ' + fLarga(r[1])));
    if(t.prio) l.push('⚡ Prioridad: ' + ['','baja','media','alta'][t.prio]);
    if(t.notas) l.push('', '📝 Notas:', t.notas);
    if(t.subs && t.subs.length) l.push('', '☑️ Pasos:', ...t.subs.map(s => (s.ok ? '   ✅ ' : '   ⬜ ') + s.t));
    return l.join('\n');
  },

  /* ---------- Los tres emails ---------- */
  async tarea(t){
    const p = persona(t.personaId); if(!p || !p.email) return;
    const de = this.remitente(), enlace = this.url();
    const html = this.marco({ etiqueta:'Nueva tarea', titulo:'Tienes una tarea nueva ✨',
      saludo:`Hola <b>${esc(p.nombre)}</b>,<br><br><b>${esc(de)}</b> te ha asignado esta tarea:`,
      cuerpo:this.fichaTarea(t), boton:{ txt:'Abrir en PorHacer', url:enlace }, enlace,
      pie:`Entra con tu email <b>${esc(p.email)}</b> para verla con sus fotos, vídeos y audios.<br>Enviado por ${esc(de)} desde PorHacer` });
    const texto = `Hola ${p.nombre},\n\n${de} te ha asignado esta tarea:\n\n${this.textoTarea(t)}\n\n————————————\n\n👉 Ábrela en PorHacer (con sus fotos, vídeos y audios):\n${enlace}\n\nEntra con tu email: ${p.email}\n\n¡Gracias!\n${de}`;
    return this.enviar({ para:p.email, nombre:p.nombre, asunto:'📋 Nueva tarea: ' + t.titulo, html, texto });
  },
  async recordatorio(t){
    const p = persona(t.personaId); if(!p || !p.email) return;
    const de = this.remitente(), enlace = this.url(), r = rango(t), hoy = hoyIso();
    let cuando = '';
    if(t.fin && t.fin < hoy) cuando = 'La fecha prevista era el <b>' + fLarga(t.fin) + '</b>, así que cuando puedas, ¡ánimo! 💪';
    else if(t.fin === hoy) cuando = 'La fecha prevista es <b>hoy</b> ☀️';
    else if(t.fin) cuando = 'La fecha prevista es el <b>' + fLarga(t.fin) + '</b> (faltan ' + difDias(hoy, t.fin) + ' días).';
    const html = this.marco({ etiqueta:'🔔 Recordatorio', titulo:'Un recordatorio amable 😊',
      saludo:`Hola <b>${esc(p.nombre)}</b>,<br><br>¿Qué tal va? Solo te recuerdo, con cariño, esta tarea que tienes pendiente.${cuando ? '<br><br>' + cuando : ''}`,
      cuerpo:this.fichaTarea(t), boton:{ txt:'Ver la tarea', url:enlace }, enlace,
      pie:`Cuando la acabes, márcala en la app con el cuadradito ✅ y así lo veremos todos.<br>¡Muchas gracias! — ${esc(de)}` });
    const cuandoTxt = cuando.replace(/<[^>]+>/g, '');
    const texto = `Hola ${p.nombre},\n\n¿Qué tal va? Solo te recuerdo, con cariño, esta tarea que tienes pendiente.${cuandoTxt ? '\n\n' + cuandoTxt : ''}\n\n${this.textoTarea(t)}\n\n————————————\n\n👉 Ábrela en PorHacer:\n${enlace}\n\nCuando la acabes, márcala con el cuadradito ✅ y así lo veremos todos.\n\n¡Muchas gracias!\n${de}`;
    return this.enviar({ para:p.email, nombre:p.nombre, asunto:'🔔 Recordatorio: ' + t.titulo, html, texto });
  },
  async invitacion(p, tablero){
    const de = this.remitente(), enlace = this.url('?invitacion=' + tablero.id), nomT = Nube.nombreTablero(tablero);
    const k = this.colores();
    const paso = (n, txt) => `<tr><td style="padding:7px 0;vertical-align:top;"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:9px;background:${k.dark};color:#fff;font-weight:800;font-size:14px;">${n}</span></td><td style="padding:7px 0 7px 12px;font-size:15px;line-height:1.5;color:${k.ink};">${txt}</td></tr>`;
    const cuerpo = `<div style="background:${k.bg};border-radius:16px;padding:16px 18px;margin:0 0 18px;text-align:center;">
        <div style="font-size:13px;color:${k.ink2};font-weight:700;text-transform:uppercase;letter-spacing:.4px;">Tablero</div>
        <div style="font-size:22px;font-weight:800;color:${k.dark};margin-top:4px;">📋 ${esc(nomT)}</div></div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
        ${paso(1, 'Pulsa el botón <b>Unirme al tablero</b>.')}
        ${paso(2, `Si es la primera vez, pulsa <b>Crear cuenta</b> con este email: <b>${esc(p.email)}</b>`)}
        ${paso(3, 'Confirma tu email y pulsa <b>Aceptar</b> en la invitación. ¡Listo!')}
      </table>`;
    const html = this.marco({ etiqueta:'📬 Invitación', titulo:`${esc(de)} te invita a su tablero`,
      saludo:`Hola <b>${esc(p.nombre)}</b>,<br><br>Te invito a <b>PorHacer</b>, la app donde organizamos nuestras tareas. Así podremos repartirlas, ver las fotos y vídeos y saber cómo va cada una.`,
      cuerpo, boton:{ txt:'Unirme al tablero', url:enlace }, enlace,
      pie:`Truco: en el iPhone, abre el enlace con Safari → Compartir → <b>Añadir a pantalla de inicio</b> y la tendrás como una app.<br>Enviado por ${esc(de)} desde PorHacer` });
    const texto = `Hola ${p.nombre},\n\nTe invito a mi tablero «${nomT}» en PorHacer, la app donde organizamos nuestras tareas.\n\n————————————\n\n1️⃣ Abre este enlace:\n${enlace}\n\n2️⃣ Si es la primera vez, pulsa «Crear cuenta» con este email:\n${p.email}\n\n3️⃣ Confirma tu email y pulsa «Aceptar» en la invitación.\n\n————————————\n\nTruco: en el iPhone, abre el enlace con Safari → Compartir → «Añadir a pantalla de inicio».\n\n¡Hasta pronto!\n${de}`;
    return this.enviar({ para:p.email, nombre:p.nombre, asunto:'📬 ' + de + ' te invita a su tablero «' + nomT + '» en PorHacer', html, texto });
  }
  ,
  async enhorabuena(t, lista){
    const de = this.remitente(), enlace = this.url(), k = this.colores();
    const quien = persona(t.personaId);
    const html = p => this.marco({ etiqueta:'🎉 Tarea acabada', titulo:'¡Enhorabuena, tarea acabada! 🎉',
      saludo:`Hola <b>${esc(p.nombre)}</b>,<br><br>¡Buenas noticias! <b>${esc(de)}</b> acaba de marcar como <b style="color:#22a55a;">acabada</b> esta tarea${quien && quien.email !== p.email ? ' (de ' + esc(quien.nombre) + ')' : ''}. Una cosa menos 💪`,
      cuerpo: `<div style="text-align:center;font-size:44px;line-height:1;margin:0 0 12px;">🎉✅🎊</div>` + this.fichaTarea(t),
      boton:{ txt:'Ver el tablero', url:enlace }, enlace,
      pie:`¡Gracias a todos por el trabajo en equipo!<br>Enviado por ${esc(de)} desde PorHacer` });
    const texto = `¡Hola!\n\n🎉 ¡Enhorabuena! ${de} acaba de marcar como ACABADA esta tarea:\n\n${this.textoTarea(t)}\n\nUna cosa menos 💪\n\n————————————\n\n👉 Ver el tablero en PorHacer:\n${enlace}\n\n¡Gracias a todos por el trabajo en equipo!\n${de}`;
    const asunto = '🎉 ¡Tarea acabada! ' + t.titulo;
    if(this.hayEmailJS()){
      let ok = 0;
      for(const p of lista){
        try{
          const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method:'POST', headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({ service_id:EMAILJS.servicio, template_id:EMAILJS.plantilla, user_id:EMAILJS.clave,
              template_params:{ to_email:p.email, to_name:p.nombre, subject:asunto, html:html(p), from_name:de + ' · PorHacer', reply_to:this.remitenteEmail() } }) });
          if(r.ok) ok++;
        }catch(e){ console.warn(e); }
      }
      if(ok){ toast('🎉 Enhorabuena enviada a ' + ok + ' persona' + (ok>1?'s':'')); return; }
    }
    // Respaldo: un solo email para todos, con tu app de correo
    let cuerpo = texto.replace(/\r?\n/g, '\r\n');
    location.href = 'mailto:' + lista.map(p => encodeURIComponent(p.email)).join(',') + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
  }
};
