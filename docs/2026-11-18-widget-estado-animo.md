# Ficha de diseño — Widget «Estado de ánimo»

## 1. Identificación

- **Nombre:** Estado de ánimo
- **Categoría:** Sentimientos
- **Descripción:** Cómo estás hoy, con el emoji con el que lo registraste.
- **Función principal:** Verse de un vistazo y recordar que se puede registrar.
- **Datos que muestra:** emoji, etiqueta del ánimo, si es de hoy o de otro día.
- **Origen de los datos:** PersonalHub → `saveHerMoodWidget` → `CapacitorStorage` (`widget_mood`).
- **De quién es:** el ánimo de ella y solo el de ella. En su móvil sale del
  `moodStore` de su sesión; si la sesión es la del administrador, se lee el de
  ella de la base y nunca se guarda el de quien mira. Si no se puede saber, no
  se toca lo guardado.

## 2. Diseño visual

- **Estilo:** el de la familia, con borde rosa.
- **Fondo:** degradado `#2A1B30 → #0F0F10` con borde rosa al 19 %.
- **Principal:** blanco (emoji y etiqueta). **Secundario:** `#C9BBD1` («hoy» / «ayer»). **Acento:** rosa `#F3C5D0`.
- **Radio:** 26 dp. **Tipografía del emoji:** la del sistema, anclada a su caja.

### Pequeña (2×2)

- Emoji 40 sp centrado, etiqueta 10 sp y «hoy» / «toca para registrar».

### Rectangular (4×2)

- Emoji 36 sp a la izquierda; a la derecha «HOY», etiqueta 16 sp y cuándo.

### Grande (4×3)

- «ESTADO DE ÁNIMO», emoji 56 sp, etiqueta 20 sp y cuándo.

## 3. Información y funcionamiento

- Se guarda la **primera** emoción y «+N» si registraste varias, igual que en Inicio: no se inventa una media ni se amontonan emojis.
- El ánimo es de un día: si lo guardado no es de hoy, la línea inferior dice «ayer» o la fecha, nunca «hoy».
- Sin ánimo: «—», «sin registrar» y «toca para registrar».
- El emoji cede tamaño al 170 % de fuente para que quepan etiqueta y fecha.

## 4. Estados

| Estado | Comportamiento |
| --- | --- |
| Normal (hoy) | Emoji, etiqueta y «hoy». |
| Sin registrar | «—», «sin registrar», «toca para registrar». |
| De otro día | Etiqueta con «ayer» o la fecha. |
| Fuente grande | Emoji reducido y, en la composición grande, se oculta el «hoy». |

## 5. Interacciones

- Toda la superficie abre `/sentimientos`, donde se registra o cambia.

## 6. Verificación

- Compilación web y Android.
- Comprobación geométrica a 1,0× / 1,3× / 1,5× / 2,0× de fuente.
- Pendiente de probar en dispositivo real (glifo del emoji y recorte del texto).

## 7. Resultado final

- **Diseño aprobado:** pendiente de revisión.
- **Implementación terminada:** tres tamaños con composición adaptativa.
