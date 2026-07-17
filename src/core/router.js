const router = {
    navigate: (page) => {
        const view = document.getElementById('view');
        // Aquí cargaremos dinámicamente las vistas (v1, v2...)
        view.innerHTML = `<h1>Página: ${page}</h1>`;
    }
};
