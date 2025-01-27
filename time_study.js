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
    let currentFilteredData = [];

    // Fetch data from Firebase and listen for real-time updates
    database.ref('Master_Task').on('value', snapshot => {
        rawData = snapshot.val();
        populateFilters();
        setupSearchAutoComplete();
        displayData();
    });

    function populateFilters() {
        filteredData = [];
        console.log(rawData);

        for (let term in rawData) {
            rawData[term].forEach(entry => {
                const variance = calculateVariance(entry["Man Hours"], entry["ActualManhours"]);
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
        const workOrderInput = document.getElementById('searchWorkOrder');
        const workOrderSuggestionsBox = document.getElementById('workOrderSuggestions');

        const taskTypeInput = document.getElementById('searchTaskType');
        const taskTypeSuggestionsBox = document.getElementById('taskTypeSuggestions');

        if (workOrderInput && workOrderSuggestionsBox) {
            workOrderInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                workOrderSuggestionsBox.innerHTML = '';

                if (searchTerm.length > 0) {
                    const suggestions = new Set(filteredData
                        .filter(entry => entry["Product"].toLowerCase().includes(searchTerm))
                        .map(entry => entry["Product"]));

                    suggestions.forEach(suggestion => {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.textContent = suggestion;
                        suggestionDiv.addEventListener('click', function() {
                            workOrderInput.value = suggestion;
                            workOrderSuggestionsBox.innerHTML = '';
                        });
                        workOrderSuggestionsBox.appendChild(suggestionDiv);
                    });
                }
            });
        }

        if (taskTypeInput && taskTypeSuggestionsBox) {
            taskTypeInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                taskTypeSuggestionsBox.innerHTML = '';

                if (searchTerm.length > 0) {
                    const suggestions = new Set(filteredData
                        .filter(entry => entry["Task"].toLowerCase().includes(searchTerm))
                        .map(entry => entry["Task"]));

                    suggestions.forEach(suggestion => {
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.textContent = suggestion;
                        suggestionDiv.addEventListener('click', function() {
                            taskTypeInput.value = suggestion;
                            taskTypeSuggestionsBox.innerHTML = '';
                        });
                        taskTypeSuggestionsBox.appendChild(suggestionDiv);
                    });
                }
            });
        }
    }

    function getSelectedFacilities() {
        const selectedFacilities = [];
        document.querySelectorAll('.facility-toggle').forEach(toggle => {
            if (toggle.checked) {
                selectedFacilities.push(toggle.value);
            }
        });
        return selectedFacilities;
    }

    function displayData() {
        const workOrderSearchTerm = document.getElementById('searchWorkOrder').value.toLowerCase();
        const taskTypeSearchTerm = document.getElementById('searchTaskType').value.toLowerCase();
        const varianceThreshold = parseFloat(document.getElementById('varianceThreshold').value);
        const minTerm = parseInt(document.getElementById('minTerm').value, 10) || -Infinity;
        const maxTerm = parseInt(document.getElementById('maxTerm').value, 10) || Infinity;
        const selectedFacilities = getSelectedFacilities();

        const filtered = filteredData.filter(entry => {
            const varianceValue = parseFloat(entry.Variance);
            const termValue = parseInt(entry.term, 10);

            const matchesWorkOrder = entry["Product"].toLowerCase().includes(workOrderSearchTerm);
            const matchesTaskType = entry["Task"].toLowerCase().includes(taskTypeSearchTerm);

            return (selectedFacilities.includes(entry.Facility) &&
                matchesWorkOrder &&
                matchesTaskType &&
                Math.abs(varianceValue) >= varianceThreshold &&
                termValue >= minTerm &&
                termValue <= maxTerm &&
                parseFloat(entry.Duration) !== 0.00);
        });

        currentFilteredData = filtered;
        displayChart(filtered);
        displayTable(filtered);
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
                "Duration": toggleDuration.checked,
                "Man Hours": toggleManHours.checked,
                "ActualManhours": toggleActualManhours.checked
            };

            const datasetColors = {
                "Project Hours": "#36A2EB",
                "Man Hours": "#FF6384",
                "ActualManhours": "#FFCE56",
                "Duration": "#4BC0C0"
            };

            const selectedFacilities = getSelectedFacilities();

            selectedFacilities.forEach(facility => {
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
                            const entries = data.filter(entry => entry.term === term && entry.Facility === facility && parseFloat(entry.Duration) !== 0.00);
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
                                    return `${context.dataset.label}: ${context.raw.toFixed(2)} hours`;
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Study Data by Term and Facility'
                        },
                        datalabels: {
                            display: true,
                            color: 'black',
                            align: 'end',
                            anchor: 'end',
                            formatter: function(value) {
                                return `${value.toFixed(2)} hours`;
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
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
            const manHours = parseFloat(entry["Man Hours"]);
            const actualManhours = parseFloat(entry["ActualManhours"]);
            const varianceValue = parseFloat(entry.Variance);

            let varianceClass = '';

            // Apply conditional classes based on variance value
            if (varianceValue >= 1 && varianceValue <= 10) {
                varianceClass = 'highlight-yellow';
            } else if (varianceValue >= 11 && varianceValue <= 25) {
                varianceClass = 'highlight-pink';
            } else if (varianceValue >= 26) {
                varianceClass = 'highlight-red';
            } else if (varianceValue >= -15 && varianceValue < 0) {
                varianceClass = 'highlight-lightgreen';
            } else if (varianceValue <= -16 && varianceValue >= -500) {
                varianceClass = 'highlight-darkgreen';
            }

            // Create a new table row and insert all the table data cells
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.term}</td>
                <td>${entry.Facility}</td>
                <td>${entry.Meal}</td>
                <td>${entry.Cycle}</td>
                <td>${entry["Product"]}</td>
                <td>${entry["Count"]}</td>
                <td>${entry["Task"]}</td>
                <td>${parseFloat(entry["Project Hours"]).toFixed(2)}</td>
                <td>${parseFloat(entry.Duration).toFixed(2)}</td>
                <td>${manHours.toFixed(2)}</td>
                <td>${actualManhours.toFixed(2)}</td>
                <td class="${varianceClass}">${varianceValue.toFixed(2)}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Attach event listeners
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', displayData);
    }

    const facilityToggles = document.querySelectorAll('.facility-toggle');
    facilityToggles.forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('change', displayData);
        }
    });

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
                Product: cells[4].textContent,
                Count: cells[5].textContent,
                Task: cells[6].textContent,
                "Project Hours": cells[7].textContent,
                Duration: cells[8].textContent,
                "Man Hours": cells[9].textContent,
                ActualManhours: cells[10].textContent,
                Variance: cells[11].textContent
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

            displayTable(currentFilteredData); // Sort and display the filtered data
        });
    });
});
