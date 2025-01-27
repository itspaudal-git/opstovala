document.getElementById('fetchData').addEventListener('click', fetchData);

function fetchData() {
    const term = document.getElementById('searchTerm').value.trim();
    if (term === '') {
        document.getElementById('status').textContent = "Please enter a term.";
        return;
    }

    const url = `https://misevala-api.tvla.co/v0/productionRecords/${term}?facelityNetwork=chicago`;

    fetch(url)
        .then(response => response.json())
        .then(data => processAndDisplayData(data))
        .catch(error => {
            document.getElementById('status').textContent = "Error fetching data: " + error.message;
        });
}

function processAndDisplayData(packageJson) {
    const cycle1 = packageJson['cycles']['1']['meals'];
    const cycle2 = packageJson['cycles']['2']['meals'];
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';  // Clear existing rows

    let previousMealNo = null;

    cycle1.forEach((item, index) => {
        const mealNo = item['mealCode'];
        const name = item['apiMealTitle'];
        const qty1 = item['totalMeals'];
        const qty2 = cycle2[index]['totalMeals'];

        // Exclude meals with "SOT" in the name
        if (!name.includes("SOT")) {
            const sleevingLoc = item['tags'].find(tag => tag['category'] === "sleeving_location")?.title || '';
            const sleevingConfig = item['tags'].find(tag => tag['category'] === "sleeving_configuration")?.title || '';

            // Sort the bill of materials by the specified type order
            let bom = item['billOfMaterials'].filter(material => {
                // Filter out containers with "N/A" or "NA"
                const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
                return container.toLowerCase() !== 'n/a' && container.toLowerCase() !== 'na';
            });

            // Group tray1Items and tray2Items separately and other items as well
            let tray1Items = [];
            let tray2Items = [];
            let otherItems = [];

            bom.forEach(material => {
                const container = getMaterialType(material);
                const name = material['title'];
                const uom = `${Math.round(material['qtyPounds'] * 453.59237)} g`;

                if (container.startsWith("tray 1")) {
                    tray1Items.push({ name, uom });
                } else if (container.startsWith("tray 2")) {
                    tray2Items.push({ name, uom });
                } else {
                    otherItems.push({ name, uom, container });
                }
            });

            // Draw a line at the end of each meal code section (before adding the new meal)
            if (previousMealNo !== null && mealNo !== previousMealNo) {
                const dividerRow = document.createElement('tr');
                dividerRow.classList.add('row-divider');
                dividerRow.innerHTML = '<td colspan="7"></td>';
                tableBody.appendChild(dividerRow);
            }

            // Add the row for the meal itself, making it bold for "Sleeving"
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: bold;">${mealNo}</td>
                <td style="font-weight: bold;">${qty1}</td>
                <td style="font-weight: bold;">${qty2}</td>
                <td style="font-weight: bold;">${name}</td>
                <td style="font-weight: bold;">${sleevingConfig}</td>
                <td style="font-weight: bold;">${sleevingLoc}</td>
                <td style="font-weight: bold;">Sleeving</td>
                
            `;
            tableBody.appendChild(row);

            // Add remaining items before trays (sorted)
            otherItems.forEach(item => {
                const materialRow = document.createElement('tr');
                materialRow.innerHTML = `
                    <td>${mealNo}</td>
                    <td>${qty1}</td>
                    <td>${qty2}</td>
                    <td>${item.name}</td>
                    <td>${item.uom}</td>
                    <td>${sleevingLoc}</td>
                    <td>${item.container}</td>
                `;
                tableBody.appendChild(materialRow);
            });

            // Add grouped tray 1 items, making them italic
            if (tray1Items.length > 0) {
                const names = tray1Items.map(item => item.name).join(" & ");
                const uoms = tray1Items.map(item => item.uom).join(" & ");
                const tray1Row = document.createElement('tr');
                tray1Row.innerHTML = `
                    <td style="font-style: italic;">${mealNo}</td>
                    <td style="font-style: italic;">${qty1}</td>
                    <td style="font-style: italic;">${qty2}</td>
                    <td style="font-style: italic;">${names}</td>
                    <td style="font-style: italic;">${uoms}</td>
                    <td style="font-style: italic;">${sleevingLoc}</td>
                    <td style="font-style: italic;">tray 1</td>
                `;
                tableBody.appendChild(tray1Row);
            }

            // Add grouped tray 2 items, making them italic
            if (tray2Items.length > 0) {
                const names = tray2Items.map(item => item.name).join(" & ");
                const uoms = tray2Items.map(item => item.uom).join(" & ");
                const tray2Row = document.createElement('tr');
                tray2Row.innerHTML = `
                    <td style="font-style: italic;">${mealNo}</td>
                    <td style="font-style: italic;">${qty1}</td>
                    <td style="font-style: italic;">${qty2}</td>
                    <td style="font-style: italic;">${names}</td>
                    <td style="font-style: italic;">${uoms}</td>
                    <td style="font-style: italic;">${sleevingLoc}</td>
                    <td style="font-style: italic;">tray 2</td>
                `;
                tableBody.appendChild(tray2Row);
            }

            previousMealNo = mealNo;
        }
    });

    document.getElementById('status').textContent = "Data fetched and displayed successfully.";
}

function getMaterialType(material) {
    const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
    return container;
}
