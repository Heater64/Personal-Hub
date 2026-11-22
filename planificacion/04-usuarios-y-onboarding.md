# 4. Usuarios, pareja y onboarding

## Decisiones confirmadas

- **Aplicación exclusiva:** Tamp está diseñada únicamente para una pareja, formada por dos usuarios.
- **Dos cuentas:** cada miembro tendrá su propia cuenta para acceder a la aplicación.
- **Roles diferenciados:** existirán dos roles: administrador (novio) y usuaria (novia).
- **Misma aplicación:** ambos tendrán las mismas secciones, navegación, diseño y funcionalidades visibles.
- **Permisos diferentes:** el administrador podrá gestionar todo el contenido, mientras que la usuaria únicamente podrá crear o modificar registros en las secciones autorizadas.
- **Contenido compartido:** ambos podrán consultar toda la información, excepto los registros personales de planificación de sorpresas y regalos.
- **Sin personalización de módulos:** no se podrán activar, desactivar, ocultar ni reorganizar secciones.
- **Sin vinculación de parejas:** las dos cuentas estarán asociadas directamente al mismo espacio, sin códigos de invitación ni sistemas para conectar otras parejas.

## 4.1. Usuarios y roles

### Administrador (novio)

Será el responsable de gestionar la aplicación y sus contenidos.

**Permisos principales:**

- Acceder a todas las secciones.
- Crear, editar y eliminar contenido.
- Gestionar fotografías, vídeos, cartas, regalos y demás elementos.
- Administrar calendarios y fechas importantes.
- Gestionar usuarios, notificaciones y configuración general.
- Acceder al panel de administración.
- Registrar sus propios estados de ánimo y molestias.
- Gestionar su planificación privada de sorpresas y regalos.

### Usuaria (novia)

Tendrá acceso a todas las secciones compartidas, pero con permisos de gestión limitados.

**Permisos principales:**

- Consultar todo el contenido compartido.
- Registrar y gestionar sus propios estados de ánimo.
- Crear y gestionar sus propios registros en Mal día.
- Registrar información en la sección Menstruación.
- Participar en juegos y otras funciones interactivas autorizadas.
- Gestionar su propia planificación de sorpresas y regalos.
- Consultar los registros personales compartidos del administrador.

No podrá modificar contenido administrativo ni crear elementos en secciones restringidas.

Los permisos específicos se mantendrán según el funcionamiento actual de Tamp, incorporando únicamente los cambios definidos en esta planificación.

## 4.2. Perfiles de usuario

Cada persona tendrá un perfil asociado a su cuenta.

**Información prevista:**

- Nombre.
- Apodo.
- Fotografía o avatar.
- Correo electrónico.
- Rol dentro de la aplicación.

**Información compartida de la pareja:**

- Nombres de ambos.
- Fecha de inicio de la relación.
- Días juntos.
- Fotografías y recuerdos compartidos.

Los perfiles servirán para identificar a cada usuario y mostrar correctamente sus registros.

No permitirán personalizar la estructura ni las secciones de Tamp.

## 4.3. Inicio de sesión

Tamp utilizará un sistema de autenticación para garantizar que únicamente los dos usuarios autorizados puedan acceder.

**Funcionamiento previsto:**

1. El usuario abre Tamp.
2. Si no tiene una sesión activa, aparece la pantalla de inicio de sesión.
3. Introduce sus credenciales.
4. La aplicación identifica automáticamente su cuenta y rol.
5. Accede a Inicio con las secciones y permisos correspondientes.

Si el usuario ya tiene una sesión válida, podrá entrar directamente sin iniciar sesión de nuevo.

No será necesario seleccionar el rol manualmente.

## 4.4. Onboarding

Tamp no necesitará un onboarding, ya que no está destinada a nuevos usuarios ni a múltiples parejas.

No existirán procesos para:

- Crear espacios de pareja.
- Invitar o vincular nuevas parejas.
- Elegir intereses o tipos de pareja.
- Seleccionar módulos iniciales.
- Personalizar la navegación.
- Configurar la visibilidad de los contenidos compartidos.

## 4.5. Gestión de cuentas

La aplicación tendrá únicamente dos cuentas autorizadas.

- Cada usuario accederá mediante sus propias credenciales.
- El rol se asignará previamente y no podrá modificarse desde el perfil de la usuaria.
- El administrador podrá gestionar las cuentas desde el panel de administración.
- No existirá un registro público para crear nuevas cuentas.
- Los datos y contenidos compartidos pertenecerán al espacio común de Tamp.
- Los registros individuales estarán asociados a su autor, aunque sean visibles para ambos.
- La planificación de sorpresas y regalos permanecerá separada por usuario.

## 4.6. Autenticación, perfiles y gestión de cuentas

**Estado: Decidido.**

### Autenticación

- Se mantendrá el sistema actual de inicio de sesión de Tamp.
- Cada usuario accederá mediante sus propias credenciales.
- La aplicación identificará automáticamente el rol correspondiente a cada cuenta.
- No se implementarán nuevos métodos de autenticación mientras el sistema actual funcione correctamente.

### Perfiles de usuario

Cada usuario podrá modificar los siguientes datos de su perfil:

- Nombre.
- Apodo.
- Fotografía de perfil.

Los cambios realizados en el perfil se reflejarán en las secciones de Tamp donde aparezca la información del usuario.

### Fotografías de perfil

- Ambos usuarios podrán cambiar su propia fotografía de perfil.
- Cada persona gestionará exclusivamente su fotografía.
- La imagen se actualizará automáticamente en los apartados donde se utilice.

### Recuperación de acceso

- Se mantendrá el sistema actual de recuperación de cuentas.
- No se desarrollarán nuevos mecanismos de recuperación salvo que sea necesario corregir o mejorar el funcionamiento existente.

### Seguridad

- El acceso estará protegido mediante el sistema de inicio de sesión.
- No se implementará un PIN adicional.
- No se requerirá autenticación biométrica.
- Los permisos de cada usuario se aplicarán según su rol.

### Gestión de sesiones

- La sesión permanecerá iniciada hasta que el usuario decida cerrarla manualmente.
- Al volver a abrir Tamp, el usuario accederá directamente si su sesión sigue siendo válida.
- Al cerrar sesión, será necesario volver a introducir las credenciales.
- Si la sesión deja de ser válida por motivos de seguridad, se solicitará nuevamente el inicio de sesión.

### Gestión de cuentas

El administrador podrá gestionar las dos cuentas de Tamp desde el panel de administración.

**Funciones principales:**

- Consultar las cuentas existentes.
- Gestionar la información de los usuarios.
- Administrar los roles.
- Gestionar los permisos y accesos a las diferentes funciones.
- Controlar qué acciones puede realizar cada usuario según su rol.

**Restricciones:**

- Solo existirán dos cuentas autorizadas.
- No habrá registro público de nuevos usuarios.
- La usuaria no podrá modificar su propio rol ni sus permisos.
- La gestión administrativa de cuentas estará reservada exclusivamente al administrador.

### Principio general

Tamp mantendrá un sistema de acceso sencillo, sin configuraciones de seguridad innecesarias para sus dos usuarios.

La aplicación conservará los mecanismos de autenticación y recuperación existentes, permitiendo que cada persona gestione su perfil y mantenga su sesión iniciada, mientras el administrador controla las cuentas, roles y permisos.