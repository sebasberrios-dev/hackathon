# FemVault — Guion corto para demo (2–3 min)

## 1. Enganche (15 s)

> “Muchas apps de fertilidad acumulan datos íntimos y el usuario casi nunca controla quién los ve ni durante cuánto tiempo. **FemVault** propone lo contrario: **tú eres dueña de tus datos**, decides quién entra y **cada intento de acceso queda registrado**. La cadena no guarda tu historial médico: sirve para **consentimiento verificable** y **auditoría**. Hoy vemos el MVP solo en el navegador.”

---

## 2. Qué problema resolvemos (20 s)

- Datos sensibles **cifrados** antes de salir del navegador.
- **Consentimiento temporal** al médico (no acceso eterno).
- **Historial de quién intentó ver qué** (en producción: respaldado en Solana).

---

## 3. Cómo funciona la página — flujo guiado

### Paso A — Identidad (Phantom)

> “Conectamos **Phantom**: es nuestra **identidad descentralizada**, dirección pública, sin contraseña clásica del producto.”

**Demo:** Conectar wallet como **paciente**.

---

### Paso B — Guardar datos (dueña del registro)

> “Relleno mi ciclo, síntomas y notas. **Nada sale en texto claro**: se cifra aquí y solo subimos **cifrado**. Por eso la blockchain **no** necesita mi historia clínica literal.”

**Demo:** Rellenar formulario → **Guardar entrada cifrada**.  
**Decir:** Aparece un **código de registro** corto (sirve si el médico abre en otro dispositivo).

---

### Paso C — Consentimiento al médico

> “Aquí **yo decido**: pego la wallet del profesional y cuántos **minutos** puede ver mi registro. No es ‘compartir para siempre’: es una **ventana de tiempo**. Puedo **revocar** cuando quiera.”

**Demo:** Pegar wallet del “doctor” (segunda cuenta Phantom o otro navegador) → **Permitir acceso** → opcional **Revocar** para mostrar control.

---

### Paso D — El médico intenta leer

> “El médico conecta **su** Phantom, pone el código de registro y la misma **frase de demo** que acordamos (en producción esto iría resuelto sin que ambos copien una contraseña). Si **no hay consentimiento** o **ya revoqué**, **no ve nada**.”

**Demo:** Cambiar a wallet del médico → **Ver entrada** → éxito si hay permiso; si revocaste antes, **acceso denegado**.

---

### Paso E — Auditoría

> “Abajo está el **registro de auditoría**: sellado del dato, consentimiento, revocación, vistas permitidas y **intentos denegados**. En el MVP está en el navegador; **al integrar Solana**, ese mismo historial puede ser **verificable y difícil de manipular**.”

**Demo:** Bajar a **Access audit trail** y leer 2–3 líneas en voz alta.

---

## 4. Cierre (15 s)

> “Resumiendo: **datos médicos cifrados fuera de cadena**, **tú controlas el acceso temporal**, **todo queda trazado**. Solana entra para **consentimiento e identidad**, no para exponer tus notas. Esto es FemVault.”

---

## Tips rápidos si preguntan

| Pregunta | Respuesta corta |
|----------|------------------|
| ¿Los datos están en blockchain? | **No** los contenidos médicos; solo el diseño prepara **permisos / auditoría** on-chain. |
| ¿Por qué Phantom? | **Identidad** que tú controlas; sin cuenta central fake. |
| ¿Qué falta para producción? | Programa **Anchor** desplegado, mismos eventos del audit trail **anclados** en Solana, y flujo de claves sin “frase compartida” de demo. |
