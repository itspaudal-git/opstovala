// Check if Firebase is already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}

const database = firebase.database();

let rawData = [];
let filteredData = [];
let facilityOptions = new Set();
let currentChartType = 'bar'; // Default chart type

// Fetch data from Firebase
database.ref('Yield').once('value').then(snapshot => {
    rawData = snapshot.val();
    populateFilters();
    setupSearchAutoComplete();
    displayData();
});

// Populate filter options
function populateFilters() {
    filteredData = [];

    for (let term in rawData) {
        rawData[term].forEach(entry => {
            const variance = calculateVariance(entry["Term Needs"], entry["Actual Produced"]);
            filteredData.push({ term, ...entry, Variance: variance });
            facilityOptions.add(entry.Location);
        });
    }
}

// Function to calculate variance between Term Needs and Actual Produced
function calculateVariance(termNeeds, actualProduced) {
    if (termNeeds == 0) return 0;
    return (((actualProduced - termNeeds) / termNeeds) * 100).toFixed(2);
}

// Set up autocomplete for the search input
function setupSearchAutoComplete() {
    const searchInput = document.getElementById('searchProduct');
    const suggestionsBox = document.getElementById('suggestions');

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        suggestionsBox.innerHTML = '';

        if (searchTerm.length > 0) {
            const suggestions = new Set(filteredData
                .filter(entry => entry["Product Name"].toLowerCase().includes(searchTerm))
                .map(entry => entry["Product Name"]));

            suggestions.forEach(suggestion => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = suggestion;
                suggestionDiv.addEventListener('click', function() {
                    searchInput.value = suggestion;
                    suggestionsBox.innerHTML = '';
                });
                suggestionsBox.appendChild(suggestionDiv);
            });
        }
    });
}

function displayChart(data) {
    const ctx = document.getElementById('yieldChart').getContext('2d');
    const terms = Array.from(new Set(data.map(entry => entry.term)));
    const datasets = [];

    const datasetColors = {
        "Term Needs": "#FF6384",   // Red
        "Yield": "#36A2EB",        // Blue
        "Actual Produced": "#FFCE56",  // Yellow
        "Variance": "#4BC0C0"  // Green
    };

    const datasetOptions = {
        "Term Needs": document.getElementById("toggleTermNeeds").checked,
        "Yield": document.getElementById("toggleYield").checked,
        "Actual Produced": document.getElementById("toggleActualProduced").checked,
        "Variance": document.getElementById("toggleVariance").checked
    };

    facilityOptions.forEach(location => {
        Object.keys(datasetOptions).forEach(key => {
            if (datasetOptions[key]) {
                const dataset = {
                    label: `${location} - ${key}`,
                    data: [],
                    backgroundColor: datasetColors[key],
                    borderColor: datasetColors[key],
                    fill: currentChartType === 'line' ? false : true
                };

                terms.forEach(term => {
                    const entries = data.filter(entry => entry.term === term && entry.Location === location);
                    const total = entries.reduce((sum, entry) => sum + (parseFloat(entry[key]) || 0), 0);
                    dataset.data.push(total);
                });

                datasets.push(dataset);
            }
        });
    });

    if (window.currentChart) {
        window.currentChart.destroy();
    }

    window.currentChart = new Chart(ctx, {
        type: currentChartType, // Dynamic chart type
        data: {
            labels: terms,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Term'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Values'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Yield Data by Term and Facility'
                }
            }
        }
    });
}

// Display the data in the table with sorting
function displayTable(data) {
    const tbody = document.getElementById('dataTable').querySelector('tbody');
    tbody.innerHTML = '';

    data.forEach(entry => {
        const varianceValue = parseFloat(entry.Variance);
        const varianceClass = varianceValue > 0 ? 'variance-positive' : 'variance-negative';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.term}</td>
            <td>${entry.Location}</td>
            <td>${entry["Product Name"]}</td>
            <td>${entry["Meal No"]}</td>
            <td>${entry.Cycle}</td>
            <td>${entry.Type}</td>
            <td>${parseFloat(entry["Term Needs"]).toFixed(2)}</td>
            <td>${parseFloat(entry.Yield).toFixed(2)}</td>
            <td>${entry.UoM}</td>
            <td>${parseFloat(entry["Actual Produced"]).toFixed(2)}</td>
            <td class="${varianceClass}">${varianceValue}%</td>
        `;
        tbody.appendChild(row);
    });
}

// Display chart and table based on filtered data
function displayData() {
    const searchTerm = document.getElementById('searchProduct').value.toLowerCase();
    const minTerm = parseInt(document.getElementById('minTerm').value, 10) || -Infinity;
    const varianceThreshold = parseFloat(document.getElementById('varianceThreshold').value);

    // Filter data based on search term, min term, and variance threshold
    const filtered = filteredData.filter(entry => {
        const termValue = parseInt(entry.term, 10);
        const varianceValue = parseFloat(entry.Variance);
        return entry["Product Name"].toLowerCase().includes(searchTerm) &&
               termValue >= minTerm &&
               Math.abs(varianceValue) >= varianceThreshold;
    });

    displayChart(filtered);
    displayTable(filtered);
}

// Event listener for filter button
document.getElementById('filterBtn').addEventListener('click', displayData);

// Event listener for changing chart type
document.getElementById('chartTypeSelect').addEventListener('change', (event) => {
    currentChartType = event.target.value;
    displayData();
});

// Event listeners for toggling datasets
const toggles = document.querySelectorAll('.dataset-toggle input[type="checkbox"]');
toggles.forEach(toggle => {
    toggle.addEventListener('change', displayData);
});

// Dark mode toggle
document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

// Download as XLSX
document.getElementById('downloadXlsx').addEventListener('click', () => {
    const data = extractTableData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, 'data.xlsx');
});

// Download as CSV
document.getElementById('downloadCsv').addEventListener('click', () => {
    const data = extractTableData();
    const csvContent = "data:text/csv;charset=utf-8," 
        + data.map(e => Object.values(e).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "data.csv");
   

    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
});

// Download as JSON
document.getElementById('downloadJson').addEventListener('click', () => {
    const data = extractTableData();
    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data.json";
    link.click();
});

// Extracts data from the table for downloading
function extractTableData() {
    const rows = document.querySelectorAll('#dataTable tbody tr');
    const data = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        return {
            Term: cells[0].textContent,
            Location: cells[1].textContent,
            "Product Name": cells[2].textContent,
            "Meal No": cells[3].textContent,
            Cycle: cells[4].textContent,
            Type: cells[5].textContent,
            "Term Needs": cells[6].textContent,
            Yield: cells[7].textContent,
            UoM: cells[8].textContent,
            "Actual Produced": cells[9].textContent,
            Variance: cells[10].textContent
        };
    });
    return data;
}

// Draw the second row table
doc.rect(qaX, row2Y - 10, qaWidth, 10);  // QA
doc.rect(leadershipX, row2Y - 10, leadershipWidth, 10);  // Leadership
doc.rect(producedQtyX, row2Y - 10, producedQtyWidth, 10);  // Produced Qty

// Add text inside the second row cells (centered)
doc.text('QA:___________', qaX + 2, row2Y - 3);  // Reduced width for QA
doc.text('Leadership:___________', leadershipX + 2, row2Y - 3);  // Reduced width for Leadership
doc.text('Produced Qty:______', producedQtyX + 2, row2Y - 3);  // Reduced width for Produced Qty