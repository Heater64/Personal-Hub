# 7. Diseño visual

## Dirección decidida

Tamp utilizará como referencia el estilo **Umbra oscuro**, manteniendo la organización clara y la jerarquía visual del mockup claro. La interfaz debe sentirse romántica, cercana y moderna, sin perder legibilidad ni facilidad de uso.

Las secciones conservarán una identidad coherente. El contenido puede cambiar el tratamiento visual según su propósito: recuerdos más emocionales, juegos más dinámicos y herramientas prácticas más directas.

## Principios de interfaz

- Prioridad a móvil, con adaptación a escritorio.
- Tarjetas y superficies redondeadas, con jerarquía sencilla.
- Espaciado suficiente y controles cómodos.
- Evitar saturar pantallas con información o adornos.
- Mantener las mismas pantallas para ambos roles y mostrar acciones según permisos.
- Diseñar estados vacíos, carga y error.

## Referencia existente

El repositorio tiene una guía Umbra con fondo oscuro, superficies en capas, acento coral, Playfair Display para contenido emocional e Inter para interfaz funcional. Se puede usar como punto de partida y contrastar con los mockups más recientes antes de reconstruir.

## Temas

- El tema oscuro Umbra será el predeterminado.
- y los temas que ya existen.
- Se ofrecerá tema claro y una opción «usar el tema del dispositivo», por accesibilidad y comodidad en distintos entornos.
- Los acentos morados y rosas de los mockups pueden usarse como apoyo en elementos románticos, conservando el coral Umbra como acento general hasta revisar los diseños juntos.
- Contraste, tamaño de texto y foco visible serán prioritarios en ambos temas.

## Decisiones de diseño recomendadas

- Mantener Playfair Display para titulares o frases emotivas e Inter para información funcional, salvo que las pruebas de lectura aconsejen simplificarlo.
- Animaciones breves y discretas; respetar `prefers-reduced-motion`.
- En móvil usar navegación inferior; en escritorio, navegación lateral y contenido centrado.
- Rehacer la interfaz para que sea consistente, conservando las funciones y los datos existentes que se hayan validado.
- Aplicar un mismo sistema de iconos, botones, formularios, estados vacíos, carga y error.
