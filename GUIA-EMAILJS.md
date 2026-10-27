# Emails bonitos y automáticos (EmailJS) — opcional

Sin esto, PorHacer abre tu app de correo con el email ya escrito (en texto) y tú pulsas Enviar.
Con esto, la app **envía sola** emails con diseño y colores. Es **gratis** (200 emails al mes) y **sin tarjeta**.

1. Entra en **https://www.emailjs.com** → **Sign Up** (puedes entrar con tu cuenta de Google).
2. **Email Services** → **Add New Service** → **Gmail** → **Connect Account** (elige elialtarriba@gmail.com y da permiso) → **Create Service**.
   Apunta el **Service ID** (algo como `service_ab12cd3`).
3. **Email Templates** → **Create New Template**:
   - **Subject**: `{{subject}}`
   - **Content**: pulsa **Edit Content → Code Editor**, borra todo y pon solo: `{{{html}}}` (con tres llaves)
   - A la derecha: **To Email** `{{to_email}}` · **From Name** `{{from_name}}` · **Reply To** `{{reply_to}}`
   - **Save**. Apunta el **Template ID** (algo como `template_xy98zz1`).
4. Arriba a la derecha, tu nombre → **Account** → **General** → apunta la **Public Key**.
5. Envíame los tres datos (Service ID, Template ID y Public Key) y los pongo en `email-config.js`.

Los emails saldrán desde tu Gmail, con el nombre de quien los envía («Raimon Bielsa · PorHacer») y, al responder, la respuesta le llega a esa persona.
