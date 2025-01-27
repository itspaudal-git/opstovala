document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const database = firebase.database();
    let rawData = [];
    let filteredData = [];
    let facilityOptions = new Set();
    let currentChartType = 'bar';
    let currentSortField = 'term';
    let currentSortDirection = 'asc';

    // Fetch data from Firebase
    database.ref('Timestudies').once('value').then(snapshot => {
        rawData = snapshot.val();
        populateFilters();
        setupSearchAutoComplete();
        displayData();
    });

    function populateFilters() {
        filteredData = [];

        for (let term in rawData) {
            rawData[term].forEach(entry => {
                const variance = calculateVariance(entry["Man Hours"], entry["Actual Manhours"]);
                filteredData.push({ term, ...entry, Variance: variance });
                facilityOptions.add(entry.Facility);
            });
        }
    }

    function calculateVariance(manHours, actualManhours) {
        if (manHours == 0) return 0;
        return (((actualManhours - manHours) / manHours) * 100).toFixed(2);
    }

    function setupSearchAutoComplete() {
        const searchInput = document.getElementById('searchStudy');
        const suggestionsBox = document.getElementById('suggestions');
    
        if (searchInput && suggestionsBox) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                suggestionsBox.innerHTML = '';
    
                if (searchTerm.length > 0) {
                    const suggestions = new Set(filteredData
                        .filter(entry => entry["Work Order"].toLowerCase().includes(searchTerm) ||
                                         entry["Task Type"].toLowerCase().includes(searchTerm))
                        .map(entry => `${entry["Work Order"]} | ${entry["Task Type"]}`));
    
                    suggestions.forEach(suggestion => {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.textContent = suggestion;
                        suggestionDiv.addEventListener('click', function() {
                            searchInput.value = suggestion.split(' | ')[0]; // Set the value to Work Order for example
                            suggestionsBox.innerHTML = '';
                        });
                        suggestionsBox.appendChild(suggestionDiv);
                    });
                }
            });
        }
    }

    function displayChart(data) {
        const ctx = document.getElementById('studyChart').getContext('2d');
        const terms = Array.from(new Set(data.map(entry => entry.term)));
        const datasets = [];

        const toggleProjectHours = document.getElementById("toggleProjectHours");
        const toggleManHours = document.getElementById("toggleManHours");
        const toggleActualManhours = document.getElementById("toggleActualManhours");
        const toggleDuration = document.getElementById("toggleDuration");

        if (toggleProjectHours && toggleManHours && toggleActualManhours && toggleDuration) {
            const datasetOptions = {
                "Project Hours": toggleProjectHours.checked,
                "Man Hours": toggleManHours.checked,
                "Actual Manhours": toggleActualManhours.checked,
                "Duration": toggleDuration.checked
            };

            const datasetColors = {
                "Project Hours": "#36A2EB",
                "Man Hours": "#FF6384",
                "Actual Manhours": "#FFCE56",
                "Duration": "#4BC0C0"
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
                type: currentChartType,
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
                            text: 'Study Data by Term and Facility'
                        }
                    }
                }
            });
        }
    }

    function displayTable(data) {
        const tbody = document.getElementById('dataTable').querySelector('tbody');
        tbody.innerHTML = '';
    
        // Sort data before displaying
        data.sort((a, b) => {
            let fieldA = a[currentSortField];
            let fieldB = b[currentSortField];
    
            // Handle numeric sorting
            if (!isNaN(parseFloat(fieldA)) && !isNaN(parseFloat(fieldB))) {
                fieldA = parseFloat(fieldA);
                fieldB = parseFloat(fieldB);
            }
    
            if (fieldA < fieldB) return currentSortDirection === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    
        data.forEach((entry, index) => {
            const varianceValue = parseFloat(entry.Variance);
            const varianceClass = varianceValue > 0 ? 'variance-positive' : 'variance-negative';
    
            // Skip the entry if Duration is 0.00
            if (parseFloat(entry.Duration) === 0.00) {
                return;
            }
    
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.term}</td>
                <td>${entry.Facility}</td>
                <td>${entry.Meal}</td>
                <td>${entry.Cycle}</td>
                <td>${entry["Work Order"]}</td>
                <td>${entry["Count"]}</td>
                <td>${entry["Task Type"]}</td>
                <td>${parseFloat(entry["Project Hours"]).toFixed(2)}</td>
                <td>${parseFloat(entry["Man Hours"]).toFixed(2)}</td>
                <td>${parseFloat(entry["Actual Manhours"]).toFixed(2)}</td>
                <td>${parseFloat(entry.Duration).toFixed(2)}</td>
                <td class="${varianceClass}">${varianceValue}%</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            tbody.appendChild(row);
        });
    
        // Attach event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const index = this.getAttribute('data-index');
                handleDelete(data[index], index);
            });
        });
    }
    

    function displayData() {
        const searchTerm = document.getElementById('searchStudy').value.toLowerCase();
        const varianceThreshold = parseFloat(document.getElementById('varianceThreshold').value);
        const minTerm = parseInt(document.getElementById('minTerm').value, 10) || -Infinity;
        const maxTerm = parseInt(document.getElementById('maxTerm').value, 10) || Infinity;

        const filtered = filteredData.filter(entry => {
            const varianceValue = parseFloat(entry.Variance);
            const termValue = parseInt(entry.term, 10);
            return (entry["Work Order"].toLowerCase().includes(searchTerm) ||
                    entry.Facility.toLowerCase().includes(searchTerm) ||
                    entry["Task Type"].toLowerCase().includes(searchTerm)) &&
                   Math.abs(varianceValue) >= varianceThreshold &&
                   termValue >= minTerm &&
                   termValue <= maxTerm;
        });

        displayChart(filtered);
        displayTable(filtered);
    }

    function handleDelete(entry, index) {
        if (confirm(`Are you sure you want to delete this entry: ${entry["Work Order"]}?`)) {
            const term = entry.term;
            database.ref(`Timestudies/${term}`).once('value').then(snapshot => {
                const entries = snapshot.val();
                const newEntries = entries.filter(e => e["Work Order"] !== entry["Work Order"]);
                database.ref(`Timestudies/${term}`).set(newEntries.length ? newEntries : null);
            }).then(() => {
                alert('Entry deleted successfully.');
                filteredData.splice(index, 1);
                displayTable(filteredData);
            }).catch(error => {
                console.error('Error deleting entry:', error);
                alert('Failed to delete entry.');
            });
        }
    }

    // Attach event listeners
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', displayData);
    }

    const toggles = document.querySelectorAll('.dataset-toggle input[type="checkbox"]');
    toggles.forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('change', displayData);
        }
    });

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
        });
    }

    const downloadXlsx = document.getElementById('downloadXlsx');
    if (downloadXlsx) {
        downloadXlsx.addEventListener('click', () => {
            const data = extractTableData();
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            XLSX.writeFile(workbook, 'data.xlsx');
        });
    }

    const downloadCsv = document.getElementById('downloadCsv');
    if (downloadCsv) {
        downloadCsv.addEventListener('click', () => {
            const data = extractTableData();
            const csvContent = "data:text/csv;charset=utf-8," 
                + data.map(e => Object.values(e).join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "data.csv");

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const downloadJson = document.getElementById('downloadJson');
    if (downloadJson) {
        downloadJson.addEventListener('click', () => {
            const data = extractTableData();
            const jsonString = JSON.stringify(data);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "data.json";
            link.click();
        });
    }

    function extractTableData() {
        const rows = document.querySelectorAll('#dataTable tbody tr');
        const data = Array.from(rows).map(row => {
            const cells = row.querySelectorAll('td');
            return {
                Term: cells[0].textContent,
                Facility: cells[1].textContent,
                Meal: cells[2].textContent,
                Cycle: cells[3].textContent,
                "Work Order": cells[4].textContent,
                "Task Type": cells[5].textContent,
                "Project Hours": cells[6].textContent,
                "Man Hours": cells[7].textContent,
                "Actual Manhours": cells[8].textContent,
                Duration: cells[9].textContent,
                Variance: cells[10].textContent
            };
        });
        return data;
    }

    // Add sorting functionality
    const headers = document.querySelectorAll('#dataTable thead th');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.getAttribute('data-sort');
            if (currentSortField === sortField) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = sortField;
                currentSortDirection = 'asc';
            }

            // Remove sort classes from all headers
            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

            // Add the relevant sort class to the active header
            if (currentSortDirection === 'asc') {
                header.classList.add('sort-asc');
            } else {
                header.classList.add('sort-desc');
            }

            displayTable(filteredData); // Only refresh the table with sorted data
        });
    });
});
