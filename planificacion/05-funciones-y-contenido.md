# 5. Funciones y contenido

## 5.1. Funciones principales

Tamp reunirá diferentes herramientas y experiencias destinadas a conservar recuerdos, expresar sentimientos, compartir momentos y organizar aspectos importantes de la relación.

Las funciones estarán organizadas según los cuatro apartados principales definidos anteriormente.

### Inicio

- Bienvenida e información de la pareja.
- Contador de días juntos.
- Mapa de ubicación compartida.
- Estados de ánimo destacados.
- Widgets informativos.
- Accesos rápidos a otras secciones.
- Recomendaciones y contenido destacado.
- Próximas fechas y acontecimientos importantes.

### Rincón

**Galería**
- Fotografías y vídeos.
- Memes.
- Audios.
- Mundos de Minecraft.
- Subida rápida de contenido multimedia, inspirada en Retro.

**Canciones**
- Canciones especiales de la relación.
- Those Eyes.
- Just the Way You Are.

**Series y películas**
- Catálogo de películas y series mediante una API externa.
- Listas de pendientes, en progreso y completadas.
- Seguimiento de temporadas y episodios.
- Valoraciones e historial de visualización.
- Información sobre próximos estrenos.

**Juegos**
- Juegos y actividades interactivas para la pareja.

**OsitosWorld**
- Mundo de los ositos con sus propias experiencias y funcionalidades.

### Sentimientos

**Razones**
- Razones y mensajes especiales dedicados a la pareja.

**Open When**
- Cartas y mensajes preparados para diferentes emociones o situaciones.

**Estado de ánimo**
- Registro individual de emociones.
- Historial de estados de ánimo.
- Consulta de los registros de ambos usuarios.

**Mal día**
- Registro de situaciones o comportamientos de la pareja que hayan causado malestar.
- Historial compartido de molestias.
- Seguimiento de situaciones pendientes, habladas o resueltas.
- Sin conversaciones ni funcionamiento de chat.

**Ciclo menstrual**
- Calendario menstrual independiente.
- Registro y seguimiento del ciclo.
- Síntomas y predicciones.
- Herramientas de apoyo.

**Calendario compartido**
- Aniversarios.
- Fechas importantes de la pareja.
- Planes y citas compartidas.
- Acontecimientos especiales.
- Cuentas atrás.

**Sorpresas y regalos**
- Calendario personal de regalos y sorpresas.
- Ideas de regalos.
- Planificación de citas sorpresa.
- Cumpleaños de amigos y familiares.
- Fechas importantes de otras personas.
- Recordatorios y seguimiento de regalos.

Esta será la única sección con contenido separado por usuario para evitar descubrir sorpresas.

### Perfil

- Información personal.
- Nombre, apodo y fotografía.
- Información de la pareja.
- Ajustes generales.
- Gestión de sesión y cierre de sesión.

### Administración

Sección exclusiva para el administrador.

- Panel de control.
- Gestión de contenido.
- Gestión multimedia.
- Usuarios, roles y permisos.
- Estados de ánimo.
- Notificaciones.
- Recordatorios.
- Registro de actividad.
- Configuración general.

## 5.3. Reglas generales del contenido

- **Organización:** cada elemento pertenecerá a una sección principal.
- **Sin duplicaciones:** los accesos rápidos y widgets mostrarán información existente sin crear copias.
- **Visibilidad compartida:** todo el contenido será visible para ambos usuarios, excepto la planificación de sorpresas y regalos.
- **Autoría:** los registros identificarán al usuario que los haya creado cuando corresponda.
- **Permisos:** el administrador podrá gestionar el contenido general, mientras que la usuaria tendrá permisos de creación y edición únicamente en las funciones autorizadas.
- **Registros personales:** cada persona gestionará sus propios estados de ánimo, molestias y otros registros individuales permitidos.
- **Estructura fija:** ambos usuarios tendrán las mismas secciones, sin opciones para activar, desactivar u ocultar módulos.
- **Independencia:** cada módulo tendrá su propio funcionamiento y no dependerá innecesariamente de otros.
- **Creación contextual:** los elementos se añadirán desde la sección correspondiente.
- **Contenido multimedia:** las fotografías, vídeos y audios se gestionarán mediante un sistema de almacenamiento adecuado.

## 5.4. Estructura de los contenidos

Cada tipo de contenido deberá definirse individualmente para establecer cómo se almacena, muestra y gestiona.

**Información que debe documentarse:**

- **Nombre:** identificación del tipo de contenido.
- **Propósito:** para qué sirve y qué necesidad cubre.
- **Ubicación:** sección o mundo al que pertenece.
- **Autor:** usuario que crea el registro.
- **Campos:** información necesaria para crearlo.
- **Archivos adjuntos:** fotografías, vídeos, audios u otros documentos, cuando corresponda.
- **Fechas:** creación, modificación y fechas relevantes.
- **Permisos:** usuarios autorizados para crear, editar o eliminar.
- **Visibilidad:** compartida o personal en el caso de sorpresas y regalos.
- **Accesos rápidos:** posibilidad de aparecer en Inicio o widgets.
- **Edición y eliminación:** reglas para modificar o borrar contenido.
- **Historial:** registro de cambios cuando resulte necesario.

No todos los contenidos necesitarán todos estos campos. Cada módulo utilizará únicamente los que correspondan a su funcionamiento.

## 5.5. Gestión del contenido

Tamp deberá permitir gestionar sus contenidos de manera sencilla, respetando los permisos de cada usuario.

**Funciones que deben definirse según cada módulo:**

- Creación de nuevos registros.
- Edición de contenido existente.
- Eliminación de registros.
- Búsqueda y filtros.
- Organización por fechas o categorías.
- Favoritos, cuando resulten útiles.
- Notificaciones y recordatorios.
- Recuperación de contenido eliminado, si se implementa una papelera.

Estas funciones no tienen que estar presentes en todas las secciones.

## 5.6. Versiones y desarrollo

Las funcionalidades se implementarán progresivamente, tomando como punto de partida la aplicación actual.

- **V1 — Reestructuración:** reorganizar y mejorar las funciones existentes, manteniendo los datos y características que ya funcionan.
- **V2 — Ampliación:** incorporar las nuevas funciones confirmadas y mejorar la experiencia de los módulos.
- **Futuras versiones:** añadir funcionalidades adicionales, como hábitos, sueños o retos, si finalmente se consideran útiles.

Esta distribución es provisional y deberá revisarse antes de comenzar el desarrollo.

## 5.7. Decisiones pendientes

- Elaborar el inventario completo de las funciones existentes.
- Determinar qué funciones necesitan rediseño y cuáles pueden mantenerse.
- Definir las nuevas funcionalidades que se incorporarán.
- Establecer los permisos exactos de cada módulo.
- Decidir qué se incluirá en V1, V2 y versiones futuras.
- Definir qué módulos necesitan búsqueda, filtros, favoritos o papelera.
- Establecer un modelo de datos coherente que permita mantener las funciones independientes.
- Definir cómo se almacenarán y gestionarán los archivos multimedia.
# Correcci�n de calendarios

El calendario general integra los regalos recibidos con el resto de fechas compartidas. No se mostrar�n accesos separados para “Calendario compartido” y “Regalos recibidos”. “Mis sorpresas” conserva su planificador privado independiente para evitar revelar preparativos.
