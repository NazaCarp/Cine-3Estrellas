document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    const TOTAL_CAROUSELS = 20;
    const ITEMS_PER_CAROUSEL = 20;
    
    let currentRow = 0;
    let currentCol = 0;
    
    // Matriz para guardar referencias a los elementos
    const matrix = [];
    // Guardar la última columna visitada por fila
    const lastColPerRow = new Array(TOTAL_CAROUSELS).fill(0);

    // Generar el DOM
    for (let r = 0; r < TOTAL_CAROUSELS; r++) {
        const section = document.createElement('div');
        section.className = 'carousel-section';
        section.id = `carousel-${r}`;
        
        const title = document.createElement('h2');
        title.className = 'carousel-title';
        title.textContent = `Categoría ${r + 1}`;
        section.appendChild(title);
        
        const trackWrapper = document.createElement('div');
        trackWrapper.className = 'carousel-track-wrapper';
        
        const track = document.createElement('div');
        track.className = 'carousel-track';
        track.id = `track-${r}`;
        
        const rowItems = [];
        
        for (let c = 0; c < ITEMS_PER_CAROUSEL; c++) {
            const item = document.createElement('div');
            item.className = 'carousel-item';
            const imgId = ((r * ITEMS_PER_CAROUSEL) + c + 10) % 1000;
            item.innerHTML = `
                <img class="item-bg" src="https://picsum.photos/id/${imgId}/300/200" alt="Imagen ${r}-${c}" loading="lazy">
                <span class="item-text">Item ${c + 1}</span>
                <span class="item-number">${c + 1}</span>
            `;
            
            // Permitir clic para enfocar
            item.addEventListener('click', () => {
                lastColPerRow[r] = c;
                focusItem(r, c);
            });
            
            track.appendChild(item);
            rowItems.push(item);
        }
        
        trackWrapper.appendChild(track);
        section.appendChild(trackWrapper);
        app.appendChild(section);
        
        matrix.push(rowItems);
    }
    
    // Inicializar el primer elemento
    focusItem(0, 0);

    // Bucle principal de navegación
    window.addEventListener('keydown', (e) => {
        // Evitar el scroll por defecto con las flechas
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }

        let newRow = currentRow;
        let newCol = currentCol;

        switch (e.key) {
            case 'ArrowRight':
                newCol = Math.min(currentCol + 1, ITEMS_PER_CAROUSEL - 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(currentCol - 1, 0);
                break;
            case 'ArrowDown':
                newRow = Math.min(currentRow + 1, TOTAL_CAROUSELS - 1);
                newCol = lastColPerRow[newRow];
                break;
            case 'ArrowUp':
                newRow = Math.max(currentRow - 1, 0);
                newCol = lastColPerRow[newRow];
                break;
        }

        // Si cambió algo, actualizamos
        if (newRow !== currentRow || newCol !== currentCol) {
            lastColPerRow[newRow] = newCol;
            focusItem(newRow, newCol);
        }
    });

    function focusItem(row, col) {
        // Remover clases activas pasadas
        if (matrix[currentRow] && matrix[currentRow][currentCol]) {
            matrix[currentRow][currentCol].classList.remove('active');
        }
        
        const oldSection = document.getElementById(`carousel-${currentRow}`);
        if(oldSection) {
            oldSection.classList.remove('active');
        }

        // Actualizar índices
        currentRow = row;
        currentCol = col;

        // Añadir nuevas clases activas
        const newItem = matrix[currentRow][currentCol];
        newItem.classList.add('active');
        
        const newSection = document.getElementById(`carousel-${currentRow}`);
        if(newSection) {
            newSection.classList.add('active');
        }

        // --- Logica de desplazamiento (scroll / transform) ---
        
        // 1. Desplazar el Track horizontalmente
        const track = document.getElementById(`track-${currentRow}`);
        // El ancho base del item es 250px + 20px de gap = 270px aprox
        // Vamos a calcular el offset exacto, dejando un margen a la izquierda
        const itemWidth = 270; 
        // Centrando o dejando un margen: si está en columna 0, transform = 0
        // Si avanza, desplazamos
        const translateX = -(currentCol * itemWidth);
        
        // Pero para que no se mueva el inicio demasiado si está en índice bajo:
        track.style.transform = `translateX(${translateX}px)`;

        // 2. Desplazar la ventana verticalmente para que el carrusel se vea
        const titleElement = newSection.querySelector('.carousel-title');
        // Usamos scrollIntoView con comportamiento suave
        titleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});
