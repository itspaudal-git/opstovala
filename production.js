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
    database.ref('Master_Task').once('value').then(snapshot => {
        rawData = snapshot.val();
        console.log(rawData); // Log the raw data to check its structure
        populateFilters();
        setupSearchAutoComplete();
        displayData();
    });

    function populateFilters() {
        filteredData = [];

        for (let term in rawData) {
            const trimmedTerm = term.trim(); // Trim the term to avoid trailing spaces
            const termData = rawData[term];
            if (Array.isArray(termData)) {
                termData.forEach(entry => {
                    const variance = calculateVariance(entry["Man Hours"], entry["Actual Manhours"]);
                    filteredData.push({ term: trimmedTerm, ...entry, Variance: variance });
                    if (entry.Facility) {
                        facilityOptions.add(entry.Facility);
                    }
                });
            }
        }

        console.log(filteredData); // Log filtered data to ensure it's populated correctly
    }

    function calculateVariance(manHours, actualManhours) {
        if (manHours == 0) return 0;
        return (((actualManhours - manHours) / manHours) * 100).toFixed(2);
    }

function setupSearchAutoComplete() {
    // Product search autocomplete
    const searchProductInput = document.getElementById('searchProduct');
    const productSuggestionsBox = document.getElementById('productSuggestions');
    
    searchProductInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        productSuggestionsBox.innerHTML = '';

        if (searchTerm.length > 0) {
            const suggestions = new Set(filteredData
                .filter(entry => entry.Product && entry.Product.toLowerCase().includes(searchTerm))
                .map(entry => entry.Product));

            suggestions.forEach(suggestion => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = suggestion;
                suggestionDiv.addEventListener('click', function() {
                    searchProductInput.value = suggestion;
                    productSuggestionsBox.innerHTML = '';
                    displayData(); // Update the table and chart based on the selected suggestion
                });
                productSuggestionsBox.appendChild(suggestionDiv);
            });
        }
    });

    // Task search autocomplete
    const searchTaskInput = document.getElementById('searchTask');
    const taskSuggestionsBox = document.getElementById('taskSuggestions');
    
    searchTaskInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        taskSuggestionsBox.innerHTML = '';

        if (searchTerm.length > 0) {
            const suggestions = new Set(filteredData
                .filter(entry => entry.Task && entry.Task.toLowerCase().includes(searchTerm))
                .map(entry => entry.Task));

            suggestions.forEach(suggestion => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = suggestion;
                suggestionDiv.addEventListener('click', function() {
                    searchTaskInput.value = suggestion;
                    taskSuggestionsBox.innerHTML = '';
                    displayData(); // Update the table and chart based on the selected suggestion
                });
                taskSuggestionsBox.appendChild(suggestionDiv);
            });
        }
    });

    // Facility search autocomplete
    const searchFacilityInput = document.getElementById('searchFacility');
    const facilitySuggestionsBox = document.getElementById('facilitySuggestions');
    
    searchFacilityInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        facilitySuggestionsBox.innerHTML = '';

        if (searchTerm.length > 0) {
            const suggestions = new Set(filteredData
                .filter(entry => entry.Facility && entry.Facility.toLowerCase().includes(searchTerm))
                .map(entry => entry.Facility));

            suggestions.forEach(suggestion => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.textContent = suggestion;
                suggestionDiv.addEventListener('click', function() {
                    searchFacilityInput.value = suggestion;
                    facilitySuggestionsBox.innerHTML = '';
                    displayData(); // Update the table and chart based on the selected suggestion
                });
                facilitySuggestionsBox.appendChild(suggestionDiv);
            });
        }
    });
}



function displayChart(data) {
    const ctx = document.getElementById('productionChart').getContext('2d');
    const terms = Array.from(new Set(data.map(entry => entry.term)));
    const tasks = Array.from(new Set(data.map(entry => entry.Task)));
    const datasets = [];

    const toggleProjectHours = document.getElementById("toggleProjectHours");
    const toggleManHours = document.getElementById("toggleManHours");

    const dayToggles = {
        Sunday: document.getElementById("toggleSunday").checked,
        Monday: document.getElementById("toggleMonday").checked,
        Tuesday: document.getElementById("toggleTuesday").checked,
        Wednesday: document.getElementById("toggleWednesday").checked,
        Thursday: document.getElementById("toggleThursday").checked,
        Friday: document.getElementById("toggleFriday").checked,
        Saturday: document.getElementById("toggleSaturday").checked
    };

    const datasetOptions = {
        "Project Hours": toggleProjectHours.checked,
        "Man Hours": toggleManHours.checked,
    };

    const datasetColors = {
        "Project Hours": "#36A2EB",
        "Man Hours": "#FF6384",
    };

    // Calculate task dataset (placed on the y-axis)
    const taskDataset = {
        label: 'Tasks',
        data: [],
        backgroundColor: "#FFCE56",
        borderColor: "#FFCE56",
        fill: true,
        type: 'bar',
        xAxisID: 'xTasks' // Assign the dataset to a new x-axis for tasks
    };

    tasks.forEach(task => {
        const totalTaskHours = data.reduce((sum, entry) => {
            if (entry.Task === task && dayToggles[entry.Day]) {
                return sum + (parseFloat(entry["Man Hours"]) || 0);
            }
            return sum;
        }, 0);

        if (totalTaskHours > 0) {
            taskDataset.data.push(totalTaskHours);
        }
    });

    if (toggleManHours.checked && taskDataset.data.length > 0) {
        datasets.push(taskDataset);
    }

    facilityOptions.forEach(facility => {
        Object.keys(datasetOptions).forEach(key => {
            if (datasetOptions[key]) {
                const dataset = {
                    label: `${facility} - ${key}`,
                    data: [],
                    backgroundColor: datasetColors[key],
                    borderColor: datasetColors[key],
                    fill: false,
                    yAxisID: 'y' // Assign the dataset to the main y-axis
                };

                terms.forEach(term => {
                    const entries = data.filter(entry => entry.term === term && entry.Facility === facility);
                    const total = entries.reduce((sum, entry) => {
                        if (dayToggles[entry.Day]) {
                            return sum + (parseFloat(entry[key]) || 0);
                        }
                        return sum;
                    }, 0);
                    dataset.data.push(total);
                });

                datasets.push(dataset);
            }
        });
    });

    const labels = terms; // Use only terms as labels

    if (window.currentChart) {
        window.currentChart.destroy();
    }

    window.currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels, // Only terms will be used as labels on the x-axis
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    right: 50
                }
            },
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Term'
                    }
                },
                xTasks: {
                    type: 'category',
                    position: 'top', // Position this x-axis at the top
                    labels: tasks, // Tasks as labels for this axis
                    title: {
                        display: true,
                        text: 'Tasks'
                    },
                    grid: {
                        drawOnChartArea: false, // Avoid drawing gridlines for this axis
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
                    display: datasets.length > 0, // Show legend only if there's something to display
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
                    text: 'Production Data by Term and Facility'
                }
            }
        }
    });
}
    
    function displayTable(data) {
        const tbody = document.getElementById('dataTable').querySelector('tbody');
        tbody.innerHTML = '';
    
        // Apply sorting to the filtered data
        data.sort((a, b) => {
            let fieldA = a[currentSortField];
            let fieldB = b[currentSortField];
    
            if (!isNaN(parseFloat(fieldA)) && !isNaN(parseFloat(fieldB))) {
                fieldA = parseFloat(fieldA);
                fieldB = parseFloat(fieldB);
            }
    
            if (fieldA < fieldB) return currentSortDirection === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    
        // Display the sorted data
        data.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.term}</td>
                <td>${entry.Facility || ''}</td>
                <td>${entry.Meal || ''}</td>
                <td>${entry.Cycle || ''}</td>
                <td>${entry.Product || ''}</td>
                <td>${entry["Count"] || ''}</td>
                <td>${entry.Task || ''}</td>
                <td>${parseFloat(entry["Project Hours"] || 0).toFixed(2)}</td>
                <td>${parseFloat(entry["Man Hours"] || 0).toFixed(2)}</td>
                <td>${entry.Day || ''}</td>
            `;
            tbody.appendChild(row);
        });
    
        // Re-attach event listeners to sorting headers
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
    
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    
                if (currentSortDirection === 'asc') {
                    header.classList.add('sort-asc');
                } else {
                    header.classList.add('sort-desc');
                }
    
                displayTable(data); // Sort and display the currently filtered data
            });
        });
    }
    
    function displayData() {
        const searchProduct = document.getElementById('searchProduct').value.toLowerCase();
        const searchTask = document.getElementById('searchTask').value.toLowerCase();
        const searchFacility = document.getElementById('searchFacility').value.toLowerCase();
        const minTerm = parseInt(document.getElementById('minTerm').value, 10) || -Infinity;
        const maxTerm = parseInt(document.getElementById('maxTerm').value, 10) || Infinity;
    
        // Get day toggle states
        const dayToggles = {
            "Sunday": document.getElementById("toggleSunday").checked,
            "Monday": document.getElementById("toggleMonday").checked,
            "Tuesday": document.getElementById("toggleTuesday").checked,
            "Wednesday": document.getElementById("toggleWednesday").checked,
            "Thursday": document.getElementById("toggleThursday").checked,
            "Friday": document.getElementById("toggleFriday").checked,
            "Saturday": document.getElementById("toggleSaturday").checked
        };
    
        const filtered = filteredData.filter(entry => {
            const termValue = parseInt(entry.term, 10);
            const product = entry.Product ? entry.Product.toLowerCase() : "";
            const facility = entry.Facility ? entry.Facility.toLowerCase() : "";
            const task = entry.Task ? entry.Task.toLowerCase() : "";
            const day = entry.Day || "";
    
            // Filter based on search inputs, term range, and day toggle
            const productMatch = product.includes(searchProduct);
            const facilityMatch = facility.includes(searchFacility);
            const taskMatch = task.includes(searchTask);
            const isTermInRange = termValue >= minTerm && termValue <= maxTerm;
            const isDaySelected = dayToggles[day];
    
            return productMatch && facilityMatch && taskMatch && isTermInRange && isDaySelected;
        });
    
        console.log('Filtered Data:', filtered); // Check the filtered data before displaying
        displayChart(filtered);
        displayTable(filtered);
    }
    
    
    
    

    function handleDelete(entry, index) {
        if (confirm(`Are you sure you want to delete this entry: ${entry.Product}?`)) {
            const term = entry.term;
            database.ref(`Master_Task/${term}`).once('value').then(snapshot => {
                const entries = snapshot.val();
                const newEntries = entries.filter(e => e.Product !== entry.Product);
                database.ref(`Master_Task/${term}`).set(newEntries.length ? newEntries : null);
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
                Product: cells[4].textContent,
                Task: cells[5].textContent,
                "Project Hours": cells[6].textContent,
                "Man Hours": cells[7].textContent,
                "Actual Manhours": cells[8].textContent,
                Duration: cells[9].textContent,
                Variance: cells[10].textContent
            };
        });
        return data;
    }

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

            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

            if (currentSortDirection === 'asc') {
                header.classList.add('sort-asc');
            } else {
                header.classList.add('sort-desc');
            }

            displayTable(filteredData);
        });
    });
});
