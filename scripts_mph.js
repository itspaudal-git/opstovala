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

// Fetch data from Firebase and filter by 'Day' !== 'All'
database.ref('MPH Chicago').once('value').then(snapshot => {
    rawData = snapshot.val();
    populateFilters();
    displayData();
});

// Populate filter options
function populateFilters() {
    filteredData = [];

    for (let term in rawData) {
        rawData[term].forEach(entry => {
            if (entry.Day !== 'All') { // Filter out "All" from Day
                filteredData.push({ term, ...entry });
                facilityOptions.add(entry.Facility);
            }
        });
    }

}

function displayChart(data) {
    const ctx = document.getElementById('chart').getContext('2d');
    const terms = Array.from(new Set(data.map(entry => entry.term)));
    const datasets = [];

    const facilityColors = {
        "Pershing": "#28a745",  // Green
        "Tubeway": "#17a2b8"    // Cyan
    };

    const datasetOptions = {
        "Total Scheduled": document.getElementById("toggleTotalScheduled").checked,
        "Total Needed per Production": document.getElementById("toggleTotalNeeded").checked,
        "Hours Short": document.getElementById("toggleHoursShort").checked,
        "Targeted Hours": document.getElementById("toggleTargetedHours").checked,
        "Total Hours": document.getElementById("toggleActualTotalNeeded").checked,
        "Variance to target hours": document.getElementById("toggleVariance").checked
    };

    facilityOptions.forEach(facility => {
        // Group data by term for the current facility
        const facilityData = data.filter(entry => entry.Facility === facility);


        Object.keys(datasetOptions).forEach(key => {
            if (datasetOptions[key]) {
                const termData = terms.map(term => {
                    const entries = facilityData.filter(e => e.term === term);
                    return entries.reduce((total, entry) => total + (parseFloat(entry[key]) || 0), 0);
                });

                if (termData.some(val => val !== 0)) {  // Ensure we only add datasets with actual data
                    datasets.push({
                        label: `${facility} - ${key}`,
                        data: termData,
                        borderColor: facilityColors[facility],
                        backgroundColor: facilityColors[facility],
                        fill: currentChartType === 'line' ? false : true
                    });
                }
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
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function sortTable(data, sortBy) {
    if (!sortBy) return data; // If no sorting criteria, return data as is
    return data.sort((a, b) => {
        if (sortBy === 'Term' || sortBy === 'Facility') {
            return a[sortBy].localeCompare(b[sortBy]);
        } else if (sortBy === 'Date') {
            return new Date(a[sortBy]) - new Date(b[sortBy]);
        } else {
            return a[sortBy] - b[sortBy];
        }
    });
}

// Display the data in the table with sorting
function displayTable(data) {
    const sortByElement = document.querySelector('input[name="sort"]:checked');
    const sortBy = sortByElement ? sortByElement.value : null; // Check if element exists
    // Filter out entries where Day is "All" to exclude aggregated data from the table
    const sortedData = sortTable(data.filter(entry => entry.Day !== "All"), sortBy);

    const tbody = document.getElementById('dataTable').querySelector('tbody');
    tbody.innerHTML = '';

    sortedData.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.term}</td>
            <td>${entry.Facility}</td>
            <td>${entry.Date}</td>
            <td>${entry.Day}</td>
            <td>${entry["Total Scheduled"]}</td>
            <td>${parseFloat(entry["Total Needed per Production"]).toFixed(2)}</td>
            <td>${parseFloat(entry["Hours Short"]).toFixed(2)}</td>
            <td>${parseFloat(entry["Targeted Hours"]).toFixed(2)}</td>
            <td>${parseFloat(entry["Total Hours"]).toFixed(2)}</td>
            <td>${parseFloat(entry["Variance to target hours"]).toFixed(2)}</td>
            <td>${(entry["% Staff Scheduled Daily"] * 100).toFixed(2)}%</td>
            <td>${parseFloat(entry["Total Staff Hours Targeted"]).toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Display chart and table based on filtered data
function displayData() {
    const minTerm = document.getElementById('minTerm').value || -Infinity;
    const maxTerm = document.getElementById('maxTerm').value || Infinity;

    // Filter data based on term range
    const filtered = filteredData.filter(entry => {
        return entry.term >= minTerm &&
               entry.term <= maxTerm;
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
            Facility: cells[1].textContent,
            Date: cells[2].textContent,
            Day: cells[3].textContent,
            "Total Scheduled": cells[4].textContent,
            "Total Needed per Production": cells[5].textContent,
            "Hours Short": cells[6].textContent,
            "Targeted Hours": cells[7].textContent,
            "Total Hours": cells[8].textContent,
            "Variance to Target Hours": cells[9].textContent,
            "% Staff Scheduled Daily": cells[10].textContent,
            "Total Staff Hours Targeted": cells[11].textContent
        };
    });
    return data;
}
