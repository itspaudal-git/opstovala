document.addEventListener('DOMContentLoaded', function () {
    // Function to calculate the current term number based on the current week
    function calculateCurrentTerm() {
        const baseTerm = 403; // Starting term
        const startDate = new Date('2024-09-15'); // Starting date of term 403
        const currentDate = new Date();
        const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
        const weeksPassed = Math.floor((currentDate - startDate) / millisecondsPerWeek);
        return baseTerm + weeksPassed;
    }
    
    // Set current term onload
    const termInput = document.getElementById('Term');
    termInput.value = calculateCurrentTerm();

    // Day toggles: uncheck all days except tomorrow.
    const dayToggles = {
        Sunday: document.getElementById('toggleSunday'),
        Monday: document.getElementById('toggleMonday'),
        Tuesday: document.getElementById('toggleTuesday'),
        Wednesday: document.getElementById('toggleWednesday'),
        Thursday: document.getElementById('toggleThursday'),
        Friday: document.getElementById('toggleFriday'),
        Saturday: document.getElementById('toggleSaturday')
    };
    const today = new Date();
    const tomorrowIndex = (today.getDay() + 1) % 7;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const tomorrowName = days[tomorrowIndex];
    Object.keys(dayToggles).forEach(day => {
        dayToggles[day].checked = (day === tomorrowName);
    });

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
    let equipmentOptions = new Set();  // Replaces taskOptions
    let productOptions = new Set();      // Store product options
    let dayOptions = new Set();

    // Get references to DOM elements
    // termInput already obtained above.
    const filterBtn = document.getElementById('filterBtn');
    const productionChartCtx = document.getElementById('productionChart').getContext('2d');

    // Checkbox elements for toggles
    const projectHoursToggle = document.getElementById('toggleProjectHours');
    const manHoursToggle = document.getElementById('toggleManHours');
    const tubewayToggle = document.getElementById('toggleTubeway');
    const pershingToggle = document.getElementById('togglePershing');
    const westvalaToggle = document.getElementById('toggleWestvala');

    // Chart variable
    let productionChart;

    // Fetch the full Master_Task node
    database.ref('Master_Task').on('value', snapshot => {
        rawData = snapshot.val();
        console.log('Raw data:', rawData);
        populateFilters();
        displayData();  // Display data upon loading the page
    });

    function populateFilters() {
        filteredData = [];
        facilityOptions.clear();
        equipmentOptions.clear();
        productOptions.clear();  // Collect products
        dayOptions.clear();

        for (let term in rawData) {
            const termData = rawData[term];
            if (typeof termData === 'object') {
                for (let key in termData) {
                    const entry = termData[key];

                    filteredData.push({
                        term: term,
                        key: key,
                        ...entry
                    });

                    if (entry.Facility) facilityOptions.add(entry.Facility);
                    if (entry.Equipment) equipmentOptions.add(entry.Equipment);  // Collect equipment
                    if (entry.Product) productOptions.add(entry.Product);          // Collect products
                    if (entry.Day) dayOptions.add(entry.Day);
                }
            }
        }

        console.log('Filtered data after populating:', filteredData);

        setupSearchAutoComplete();  // Trigger autocomplete setup after filtering
    }

    // Function to populate suggestions with better UX
    function setupAutoComplete(inputId, suggestionBoxId, data) {
        const input = document.getElementById(inputId);
        const suggestionBox = document.getElementById(suggestionBoxId);

        input.addEventListener('focus', function () {
            suggestionBox.innerHTML = '';  // Clear previous suggestions

            const uniqueData = [...new Set(data)];
            uniqueData.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.textContent = suggestion;
                suggestionBox.appendChild(suggestionItem);

                suggestionItem.addEventListener('click', function () {
                    input.value = suggestion;
                    suggestionBox.style.display = 'none';
                    displayData();  // Trigger the filter to apply based on selected item
                });
            });

            suggestionBox.style.display = 'block';  // Show the suggestion box when focused
        });

        input.addEventListener('input', function () {
            const inputValue = this.value.toLowerCase();
            suggestionBox.innerHTML = '';  // Clear previous suggestions

            if (inputValue === '') {
                suggestionBox.style.display = 'block';  // Show all options when empty
            }

            const uniqueData = [...new Set(data)];
            const suggestions = uniqueData.filter(item => item.toLowerCase().includes(inputValue));

            if (suggestions.length === 0) {
                suggestionBox.style.display = 'none';
                return;
            }

            suggestionBox.style.display = 'block';  // Show the suggestion box
            suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.textContent = suggestion;
                suggestionBox.appendChild(suggestionItem);

                suggestionItem.addEventListener('click', function () {
                    input.value = suggestion;
                    suggestionBox.style.display = 'none';
                    displayData();  // Trigger the filter to apply based on selected item
                });
            });
        });

        // Ensure the suggestion box stays open when interacting
        input.addEventListener('click', function () {
            suggestionBox.style.display = 'block';
        });

        // Close the suggestion box when clicking outside
        document.addEventListener('click', function (event) {
            if (!input.contains(event.target) && !suggestionBox.contains(event.target)) {
                suggestionBox.style.display = 'none';
            }
        });
    }

    // Use the setupAutoComplete function for both Equipment and Product
    function setupSearchAutoComplete() {
        const equipmentOptionsArray = Array.from(equipmentOptions);
        const productOptionsArray = Array.from(productOptions);

        setupAutoComplete('searchEquipment', 'equipmentSuggestions', equipmentOptionsArray);
        setupAutoComplete('searchProduct', 'productSuggestions', productOptionsArray);
    }

    // Function to display data in the table
    function displayTable(data) {
        const tbody = document.querySelector('#dataTable tbody');
        tbody.innerHTML = '';  // Clear previous data

        if (!Array.isArray(data)) {
            console.error("Data is not an array");
            return;
        }

        data.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.term || ''}</td>
                <td>${entry.Facility || ''}</td>
                <td>${entry.Meal || ''}</td>
                <td>${entry.Cycle || ''}</td>
                <td>${entry.Product || ''}</td>
                <td>${entry.Count || ''}</td>
                <td>${entry.Equipment || ''}</td>
                <td>${parseFloat(entry['Project Hours'] || 0).toFixed(2)}</td>
                <td>${parseFloat(entry['Man Hours'] || 0).toFixed(2)}</td>
                <td>${entry.Day || ''}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Function to group data by equipment
    function groupDataByEquipment(data) {
        const equipmentMap = {};

        data.forEach(entry => {
            const equipment = entry.Equipment || '';
            if (!equipmentMap[equipment]) {
                equipmentMap[equipment] = {
                    equipment: equipment,
                    manHours: 0,
                    projectHours: 0
                };
            }
            equipmentMap[equipment].manHours += parseFloat(entry['Man Hours'] || 0);
            equipmentMap[equipment].projectHours += parseFloat(entry['Project Hours'] || 0);
        });

        return Object.values(equipmentMap);
    }

    // Update chart function with grouped equipment and data labels
    function updateChart(data) {
        const groupedData = groupDataByEquipment(data);  // Group the data by equipment

        const labels = groupedData.map(entry => entry.equipment);  // X-axis: Equipment
        const datasets = [];

        // Conditionally include the 'Man Hours' dataset based on the toggle
        if (manHoursToggle.checked) {
            const manHoursData = groupedData.map(entry => entry.manHours);  // Y-axis: Man Hours
            datasets.push({
                label: 'Man Hours',
                data: manHoursData,
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            });
        }

        // Conditionally include the 'Project Hours' dataset based on the toggle
        if (projectHoursToggle.checked) {
            const projectHoursData = groupedData.map(entry => entry.projectHours);  // Y-axis: Project Hours
            datasets.push({
                label: 'Project Hours',
                data: projectHoursData,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            });
        }

        // Destroy the old chart if it exists
        if (productionChart) {
            productionChart.destroy();  
        }

        // Create a new chart with the datasets and data labels
        productionChart = new Chart(productionChartCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets  // Use the dynamically generated datasets
            },
            options: {
                plugins: {
                    datalabels: {
                        display: true,   // Display the labels
                        align: 'end',    // Align the label at the top of the bar
                        anchor: 'end',   // Anchor the label at the end of the bar
                        formatter: (value) => value.toFixed(2),  // Display value with 2 decimal places
                        color: '#000'    // Label color
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            },
            plugins: [ChartDataLabels]  // Enable the Chart.js plugin for data labels
        });
    }

    // Filter data based on the term input and checkboxes
    function displayData() {
        const termElement = document.getElementById('Term');
        const searchEquipmentElement = document.getElementById('searchEquipment');
        const searchProductElement = document.getElementById('searchProduct');

        const term = termElement ? parseInt(termElement.value, 10) : '';
        const searchEquipment = searchEquipmentElement ? searchEquipmentElement.value.toLowerCase() : '';
        const searchProduct = searchProductElement ? searchProductElement.value.toLowerCase() : '';

        console.log('Filtering data for term:', term);

        // Step 1: Filter by term
        const filtered = filteredData.filter(entry => {
            const termValue = parseInt(entry.term, 10);
            return termValue === term;
        });

        // Step 2: Filter by facility (Tubeway, Pershing, Westvala)
        const filteredFacilities = filtered.filter(entry => {
            const facility = entry.Facility || '';
            return (tubewayToggle.checked && facility === 'Tubeway') ||
                   (pershingToggle.checked && facility === 'Pershing') ||
                   (westvalaToggle.checked && facility === 'Westvala');
        });

        // Step 3: Filter by day
        const filteredDays = filteredFacilities.filter(entry => {
            const day = entry.Day || '';
            return Object.keys(dayToggles).some(dayName => dayToggles[dayName].checked && day === dayName);
        });

        // Step 4: Filter by equipment (if searchEquipment is provided)
        const filteredEquipments = filteredDays.filter(entry => {
            const equipment = entry.Equipment ? entry.Equipment.toLowerCase() : '';
            return searchEquipment === '' || equipment.includes(searchEquipment);
        });

        // Step 5: Filter by product (if searchProduct is provided)
        const filteredProducts = filteredEquipments.filter(entry => {
            const product = entry.Product ? entry.Product.toLowerCase() : '';
            return searchProduct === '' || product.includes(searchProduct);
        });

        console.log('Filtered data:', filteredProducts);

        // Step 6: Display the filtered data in the table and update the chart
        displayTable(filteredProducts);
        updateChart(filteredProducts);
    }

    // Event listener for the filter button
    filterBtn.addEventListener('click', function () {
        displayData();
    });

    // Function to trigger filter when Enter is pressed on inputs
    function handleEnterKeyPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            displayData();
        }
    }

    // Attach the keypress event to the input fields
    document.getElementById('Term').addEventListener('keypress', handleEnterKeyPress);
    document.getElementById('searchEquipment').addEventListener('keypress', handleEnterKeyPress);
    document.getElementById('searchProduct').addEventListener('keypress', handleEnterKeyPress);

    // Add event listeners to checkboxes to trigger filtering
    projectHoursToggle.addEventListener('change', displayData);
    manHoursToggle.addEventListener('change', displayData);
    tubewayToggle.addEventListener('change', displayData);
    pershingToggle.addEventListener('change', displayData);
    westvalaToggle.addEventListener('change', displayData);

    Object.values(dayToggles).forEach(toggle => toggle.addEventListener('change', displayData));
});
