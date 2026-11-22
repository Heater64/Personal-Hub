# 3. Navegación y mundos

## Barra de navegación principal

**Estado: Decidido.**

Tamp tendrá cuatro apartados principales, idénticos para ambos usuarios:

1. **Inicio:** información destacada, widgets, accesos rápidos y recomendaciones.
2. **Rincón:** recuerdos, entretenimiento y experiencias compartidas.
3. **Sentimientos:** emociones, cariño, cuidados y organización de fechas especiales.
4. **Perfil:** información de usuario y ajustes generales.

## 3.1. Inicio

Pantalla principal con:

- Bienvenida e información de la pareja.
- Mapa de ubicación compartida.
- Accesos rápidos a funciones importantes.
- Widgets de días juntos, estados de ánimo y otros datos.
- Recomendaciones y contenido destacado.
- Próximos acontecimientos importantes.

## 3.2. Rincón

### Galería

Fotografías, vídeos, memes, audios y mundos de Minecraft, organizados por categorías.

La subida de fotografías y vídeos deberá ser rápida y sencilla, inspirándose en Retro (a cloudinary).

### Canciones

Canciones especiales de la pareja, incluyendo Those Eyes y Just the Way You Are.

### Series

Sección dedicada a organizar y llevar un seguimiento de las series y películas que la pareja quiere ver, está viendo o ya ha terminado.

La aplicación utilizará preferiblemente una **API externa, como TMDB (The Movie Database)**, para disponer de un catálogo amplio y actualizado sin necesidad de añadir manualmente cada película o serie.

**Funciones principales:**

- **Catálogo:** buscar películas y series mediante una API, mostrando sus portadas, sinopsis, géneros y demás información.
- **Lista de pendientes:** guardar las películas y series que queremos ver.
- **En progreso:** registrar las series que estamos viendo y el episodio y temporada por los que vamos.
- **Completadas:** guardar un historial de las películas y series que ya hemos visto.
- **Seguimiento:** actualizar manualmente el progreso de cada serie, con posibilidad de marcar episodios como vistos.
- **Valoraciones:** permitir puntuar y comentar las películas y series.
- **Próximos estrenos:** consultar nuevas temporadas, episodios y películas mediante la API.
- **Contenido compartido:** ambos usuarios podrán consultar y actualizar las listas y el progreso.

**Funcionamiento:** Tamp no reproducirá películas ni series. Su función será exclusivamente organizar lo que queremos ver y registrar nuestro progreso, independientemente de la plataforma donde lo veamos.

La información de las películas y series se obtendrá automáticamente de la API, mientras que Tamp almacenará únicamente nuestras listas, valoraciones y progreso.

### Juegos

Juegos y actividades interactivas de la aplicación. 

### OsitosWorld

Mundo de los ositos, integrado en Rincón y conservando su funcionamiento independiente.

## 3.3. Sentimientos

### Razones

Mensajes y razones especiales dedicados a la pareja.

### Open When

Cartas y mensajes preparados para diferentes emociones y situaciones.

### Estado de ánimo

Registro individual de emociones con historiales visibles para ambos usuarios.

### Mal día

Espacio dedicado a expresar y registrar situaciones, comentarios o comportamientos de la pareja que hayan provocado malestar, tristeza o incomodidad.

La sección dejará de funcionar como un chat convencional y pasará a ser un **registro compartido de sentimientos y molestias**, donde ambos podrán expresar lo que les ha afectado sin necesidad de iniciar una conversación.

**Funciones principales:**

- **Registrar una molestia:** escribir qué ha ocurrido, qué le ha molestado y cómo se ha sentido.
- **Registros individuales:** cada usuario podrá crear, editar y eliminar sus propios registros.
- **Historial compartido:** ambos podrán consultar las molestias registradas por el otro.
- **Fecha y hora:** cada registro mostrará cuándo se produjo o cuándo se añadió.
- **Estado del registro:** permitir marcar una situación como pendiente, hablada o resuelta.
- **Organización:** mostrar los registros mediante tarjetas individuales, ordenadas cronológicamente.
- **Notificaciones:** avisar cuando la pareja registre una nueva molestia.
- **Sin conversaciones:** no habrá respuestas en forma de chat ni hilos de mensajes.

**Funcionamiento:**

Cuando uno de los usuarios se sienta molesto por algo relacionado con su pareja, podrá acceder a Mal día y crear un registro explicando lo sucedido.

El otro usuario podrá consultar lo que ha ocurrido y comprender cómo se ha sentido su pareja, sin necesidad de responder directamente desde la aplicación.

La finalidad será **facilitar la expresión de sentimientos, reconocer situaciones que han causado malestar y evitar que queden olvidadas**, fomentando que ambos puedan hablarlas cuando lo consideren oportuno.

Los registros serán visibles para ambos, pero cada persona gestionará únicamente los suyos.

Evitaría añadir comentarios, respuestas o reacciones, porque acabaría convirtiéndose otra vez en un chat. En cambio, los estados Pendiente, Hablado y Resuelto permitirían llevar un seguimiento sin complicar la sección.

### Ciclo menstrual

Sección independiente para el seguimiento del ciclo menstrual, con calendario propio, registro de síntomas, predicciones y herramientas de apoyo.

### Calendario compartido

Calendario para organizar acontecimientos relacionados con la pareja.

Incluye:

- Aniversarios.
- Fechas importantes.
- Planes y citas compartidas.
- Acontecimientos especiales.
- Cuentas atrás.

Toda su información será visible para ambos.

### Sorpresas y regalos

Sección independiente para organizar regalos, sorpresas y acontecimientos personales.

Cada usuario tendrá su propio espacio de planificación, sin compartir su contenido con la otra persona.

Incluirá:

- Calendario de regalos.
- Planificación de citas sorpresa.
- Ideas de regalos.
- Cumpleaños de amigos y familiares.
- Fechas importantes de otras personas.
- Recordatorios y cuentas atrás.
- Seguimiento de regalos pendientes, preparados o entregados.

**Excepción de privacidad:** esta sección será privada para cada usuario, permitiendo preparar sorpresas sin que su pareja pueda descubrirlas.

La estructura y las funciones serán iguales para ambos, aunque cada uno tendrá sus propios datos.

## 3.4. Perfil

- Información del usuario.
- Datos de la pareja.
- Ajustes generales.
- Configuración de cuenta.
- Seguridad y acceso.

No permitirá personalizar, ocultar ni reorganizar módulos.

## 3.5. Administración

Zona exclusiva para el novio, destinada a gestionar:

- Contenido y multimedia.
- Usuarios.
- Estados de ánimo.
- Notificaciones y recordatorios.
- Actividad.
- Configuración general.

La novia tendrá acceso de consulta a las secciones compartidas y podrá registrar información en las funciones autorizadas.

## 3.6. Reglas de navegación y privacidad

- Ambos tendrán las mismas secciones y estructura.
- No existirán módulos personalizables ni desactivables.
- Cada contenido tendrá una ubicación principal.
- Inicio podrá mostrar accesos rápidos sin duplicar información.
- Los permisos de creación y edición dependerán del rol.
- Todo el contenido será visible para ambos, excepto la planificación personal de sorpresas y regalos.
- Los calendarios compartido, menstrual y de sorpresas funcionarán de manera independiente.
- Las nuevas funciones deberán respetar la organización establecida.
## Correcci�n de estructura de calendarios

Tamp tendr� solamente dos calendarios visibles.

- **Calendario general**. Re�ne planes, citas, aniversarios, fechas importantes, acontecimientos y regalos recibidos.
- **Calendario menstrual**. Vive dentro de Menstruaci�n y contiene ciclos, s�ntomas y predicciones.

La planificaci�n privada de sorpresas no es un tercer calendario visible. Se mantiene como un espacio privado de preparaci�n y sus registros no aparecen en el calendario general.
