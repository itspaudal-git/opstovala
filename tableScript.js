// tableScript.js

document.addEventListener("DOMContentLoaded", () => {
    // Fetch data from Firebase and populate the table
    dataRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        originalData = Object.values(data); // Store the original data
        populateTable(originalData);
    }).catch((error) => {
        console.error("Error fetching data for table: ", error);
    });
});

function populateTable(data) {
    const tableBody = document.querySelector("#dataTable tbody");
    tableBody.innerHTML = ""; // Clear the table body

    data.forEach(item => {
        const row = document.createElement("tr");
        
        const termCell = document.createElement("td");
        termCell.textContent = item.term;
        row.appendChild(termCell);
        
        const locationCell = document.createElement("td");
        locationCell.textContent = item.facility;
        row.appendChild(locationCell);
        
        const errorCell = document.createElement("td");
        errorCell.textContent = item.error;
        row.appendChild(errorCell);
        
        const totalCustBoxesCell = document.createElement("td");
        totalCustBoxesCell.textContent = item['total cust boxes'];
        row.appendChild(totalCustBoxesCell);
        
        const totalMealsShippedCell = document.createElement("td");
        totalMealsShippedCell.textContent = item['total meals shipped'];
        row.appendChild(totalMealsShippedCell);
        
        const totalPickCell = document.createElement("td");
        totalPickCell.textContent = item['total pick'];
        row.appendChild(totalPickCell);
        
        const errorCustBoxesCell = document.createElement("td");
        errorCustBoxesCell.textContent = (item['% error cust boxes'] * 100).toFixed(2) + '%';
        row.appendChild(errorCustBoxesCell);
        
        const errorShippedMealsCell = document.createElement("td");
        errorShippedMealsCell.textContent = (item['% error shipped meals'] * 100).toFixed(2) + '%';
        row.appendChild(errorShippedMealsCell);
        
        const errorTotalPicksCell = document.createElement("td");
        errorTotalPicksCell.textContent = (item['% error total picks'] * 100).toFixed(2) + '%';
        row.appendChild(errorTotalPicksCell);

        tableBody.appendChild(row);
    });
}

function filterTable() {
    const minSearchTermElement = document.getElementById("minSearchTerm");
    const maxSearchTermElement = document.getElementById("maxSearchTerm");
    const searchLocationElement = document.getElementById("searchLocation");
    const minCustBoxesElement = document.getElementById("minCustBoxes");
    const maxCustBoxesElement = document.getElementById("maxCustBoxes");
    const minMealsShippedElement = document.getElementById("minMealsShipped");
    const maxMealsShippedElement = document.getElementById("maxMealsShipped");

    const minTerm = minSearchTermElement ? parseInt(minSearchTermElement.value) || -Infinity : -Infinity;
    const maxTerm = maxSearchTermElement ? parseInt(maxSearchTermElement.value) || Infinity : Infinity;
    const locationFilter = searchLocationElement ? searchLocationElement.value.toLowerCase() : '';
    const minCustBoxes = minCustBoxesElement ? parseInt(minCustBoxesElement.value) || -Infinity : -Infinity;
    const maxCustBoxes = maxCustBoxesElement ? parseInt(maxCustBoxesElement.value) || Infinity : Infinity;
    const minMealsShipped = minMealsShippedElement ? parseInt(minMealsShippedElement.value) || -Infinity : -Infinity;
    const maxMealsShipped = maxMealsShippedElement ? parseInt(maxMealsShippedElement.value) || Infinity : Infinity;
    
    const filteredData = originalData.filter(item => {
        const term = parseInt(item.term);
        const location = item.facility.toLowerCase();
        const totalCustBoxes = parseInt(item['total cust boxes']);
        const totalMealsShipped = parseInt(item['total meals shipped']);

        const matchesTerm = term >= minTerm && term <= maxTerm;
        const matchesLocation = location.includes(locationFilter);
        const matchesCustBoxes = totalCustBoxes >= minCustBoxes && totalCustBoxes <= maxCustBoxes;
        const matchesMealsShipped = totalMealsShipped >= minMealsShipped && totalMealsShipped <= maxMealsShipped;

        return matchesTerm && matchesLocation && matchesCustBoxes && matchesMealsShipped;
    });

    populateTable(filteredData);
}


function sortTable(columnIndex) {
    const table = document.getElementById("dataTable");
    const rows = Array.from(table.rows).slice(1); // Exclude header row
    const isAscending = table.getAttribute("data-sort-dir") === "asc";
    const direction = isAscending ? 1 : -1;
    
    rows.sort((a, b) => {
        const aText = a.cells[columnIndex].textContent.trim();
        const bText = b.cells[columnIndex].textContent.trim();
        
        const aValue = isNaN(aText) ? aText : parseFloat(aText);
        const bValue = isNaN(bText) ? bText : parseFloat(bText);

        return aValue > bValue ? direction : -direction;
    });

    rows.forEach(row => table.tBodies[0].appendChild(row));

    // Toggle sort direction
    table.setAttribute("data-sort-dir", isAscending ? "desc" : "asc");
}

function downloadData(format) {
    const tableRows = Array.from(document.querySelectorAll("#dataTable tbody tr"));
    const filteredData = tableRows.map(row => {
        return {
            term: row.cells[0].textContent,
            facility: row.cells[1].textContent,
            error: row.cells[2].textContent,
            'total cust boxes': row.cells[3].textContent,
            'total meals shipped': row.cells[4].textContent,
            'total pick': row.cells[5].textContent,
            '% error cust boxes': row.cells[6].textContent,
            '% error shipped meals': row.cells[7].textContent,
            '% error total picks': row.cells[8].textContent
        };
    });

    if (format === 'json') {
        const jsonData = JSON.stringify(filteredData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'filtered_data.json';
        a.click();
    } else if (format === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered Data');
        XLSX.writeFile(workbook, 'filtered_data.xlsx');
    } else if (format === 'csv') {
        const csvData = [];
        const headers = Object.keys(filteredData[0]);
        csvData.push(headers.join(',')); // Add headers
        filteredData.forEach(item => {
            const row = headers.map(header => item[header]);
            csvData.push(row.join(','));
        });
        const csvContent = csvData.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'filtered_data.csv';
        a.click();
    }
}
