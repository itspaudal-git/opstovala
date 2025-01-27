const database = firebase.database();

let rawData = [];
let filteredData = [];
let facilityOptions = new Set();
let currentChartType = 'bar'; // Default chart type

// Fetch data from Firebase
database.ref('Error').once('value').then(snapshot => {
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
            filteredData.push({ term, ...entry });
            facilityOptions.add(entry.Facility);
        });
    }
}

// Set up autocomplete for the search input
function setupSearchAutoComplete() {
    const searchInput = document.getElementById('searchName');
    const suggestionsBox = document.getElementById('suggestions');

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        suggestionsBox.innerHTML = '';

        if (searchTerm.length > 0) {
            const suggestions = new Set(filteredData
                .filter(entry => entry.Name.toLowerCase().includes(searchTerm))
                .map(entry => entry.Name));

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
    const ctx = document.getElementById('errorChart').getContext('2d');
    const terms = Array.from(new Set(data.map(entry => entry.term)));
    const datasets = [];

    const datasetColors = {
        "QTY": "#FF6384",   // Red
        "ERROR": "#36A2EB", // Blue
        "Percentage": "#FFCE56" // Yellow
    };

    const datasetOptions = {
        "QTY": document.getElementById("toggleQTY").checked,
        "ERROR": document.getElementById("toggleERROR").checked,
        "Percentage": document.getElementById("togglePercentage").checked
    };

    facilityOptions.forEach(facility => {
        Object.keys(datasetOptions).forEach(key => {
            if (datasetOptions[key]) {
                const dataset = {
                    label: `${facility} - ${key}`,
                    data: [],
                    backgroundColor: datasetColors[key],
                    borderColor: datasetColors[key],
                    fill: currentChartType === 'line' ? false : true
                };

                terms.forEach(term => {
                    const entries = data.filter(entry => entry.term === term && entry.Facility === facility);
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
                    text: 'Error Data by Term and Facility'
                }
            }
        }
    });
}

// Display the data in the table
function displayTable(data) {
    const tbody = document.getElementById('dataTable').querySelector('tbody');
    tbody.innerHTML = '';

    data.forEach(entry => {
        const percentageValue = parseFloat(entry.Percentage) * 100; // Convert to percentage
        const rowClass = percentageValue >= 0.5 ? 'highlight-pink' : ''; // Ensure >= 0.5% is highlighted

        const row = document.createElement('tr');
        row.className = rowClass; // Apply the class conditionally
        row.innerHTML = `
            <td>${entry.term}</td>
            <td>${entry.Cycle}</td>
            <td>${entry.Facility}</td>
            <td>${entry.Date}</td>
            <td>${entry.Day}</td>
            <td>${entry.Line}</td>
            <td>${entry.Pick}</td>
            <td>${entry.Name}</td>
            <td>${parseInt(entry.QTY)}</td> <!-- Display QTY as an integer -->
            <td>${parseInt(entry.ERROR)}</td> <!-- Display ERROR as an integer -->
            <td>${percentageValue.toFixed(2)}%</td> <!-- Display Percentage with two decimal places -->
        `;
        tbody.appendChild(row);
    });
}

// Display chart and table based on filtered data
function displayData() {
    const searchTerm = document.getElementById('searchName').value.toLowerCase();
    const percentageThreshold = parseFloat(document.getElementById('percentageThreshold').value) || 0;

    // Filter data based on search term and percentage threshold
    const filtered = filteredData.filter(entry => {
        const percentageValue = parseFloat(entry.Percentage) * 100; // Convert to percentage
        return entry.Name.toLowerCase().includes(searchTerm) && percentageValue >= percentageThreshold;
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
            Cycle: cells[1].textContent,
            Facility: cells[2].textContent,
            Date: cells[3].textContent,
            Day: cells[4].textContent,
            Line: cells[5].textContent,
            Pick: cells[6].textContent,
            Name: cells[7].textContent,
            QTY: cells[8].textContent,
            ERROR: cells[9].textContent,
            Percentage: cells[10].textContent
        };
    });
    return data;
}
