# 🚢 Mexx Logistics - Import Intelligence v3.5

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![Comex](https://img.shields.io/badge/Comercio_Internacional-Log%C3%ADstica-success?style=for-the-badge)

<img width="1912" height="909" alt="image" src="https://github.com/user-attachments/assets/ba30634b-0baa-4ab4-962b-d40e1df9c7fd" />

Una herramienta de cotización y proyección de costos de importación (Landed Cost) desarrollada en JavaScript puro (Vanilla JS). 
Diseñada para automatizar el cálculo de nacionalización de mercadería, optimización de cubicaje y análisis de rentabilidad por SKU.

 ## 📊 Problema y Solución
Calcular el costo real de un producto importado puesto en el almacén (Landed Cost) suele requerir hojas de cálculo complejas y propensas a errores. Esta aplicación web resuelve este problema mediante un entorno interactivo que calcula prorrateos, cubicaje e impuestos en tiempo real.

## 🚀 Funcionalidades Principales

* **Prorrateo Dinámico:** Distribuye automáticamente los costos de flete internacional, seguro y gastos locales (EXW/FOB a CIF) basándose en el peso relativo del valor de cada SKU.
* **Motor Impositivo Nacional:** Cálculo automático de Derechos de Importación (DI), Tasa Estadística (TE), IVA, y Percepción de Ganancias según la categoría NCM del producto.
* **Sincronización en Tiempo Real:** Integración asíncrona (Fetch API) con **DolarAPI** para obtener el Tipo de Cambio Oficial BNA al instante.
* **Optimización de Carga (CBM):** Analiza dimensiones (L/A/H) y peso bruto por caja para sugerir automáticamente el equipo logístico óptimo (LCL, 20' ST, 40' ST, 40' HC).
* **Semáforo de Rentabilidad (Factor):** Indicador visual que compara el FOB unitario contra el costo nacionalizado para detectar rápidamente la viabilidad del negocio.
* **Gestión de Escenarios:** Capacidad para importar y exportar simulaciones completas en formato `.json` mediante `localStorage` y la API de archivos del navegador.

## 🛠️ Arquitectura Técnica

El proyecto fue construido priorizando la velocidad de ejecución en el cliente y la portabilidad:
* **Frontend:** Interfaz de usuario responsiva mediante HTML5 y CSS3 personalizado (Grid/Flexbox).
* **Lógica de Negocio:** Toda la matemática de prorrateo y manejo del DOM se ejecuta mediante Vanilla JavaScript, sin dependencias externas pesadas.

## ⚙️ Uso Rápido

1.  Clona este repositorio: `git clone https://github.com/tu-usuario/import-intelligence.git`
2.  Abre el archivo `index.html` en cualquier navegador web moderno.
3.  Ingresa los parámetros globales (Flete, Seguro, TC).
4.  Agrega las filas de SKUs con sus valores FOB y dimensiones.
5.  El dashboard actualizará automáticamente los costos unitarios y sugerencias logísticas.
