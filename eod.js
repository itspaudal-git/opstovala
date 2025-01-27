// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Function to calculate the current term number based on the current week
function calculateCurrentTerm() {
    const baseTerm = 403; // Starting term
    const startDate = new Date('2024-09-15'); // Starting date of term 403
    const currentDate = new Date();

    // Calculate the number of weeks between the starting date and the current date
    const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksPassed = Math.floor((currentDate - startDate) / millisecondsPerWeek);

    // Calculate the current term
    return baseTerm + weeksPassed;
}

// References to DOM elements
const termInput = document.getElementById('termInput');
const dayInput = document.getElementById('dayInput');
const leadInput = document.getElementById('leadInput');
const taskInput = document.getElementById('taskInput');
const equipmentInput = document.getElementById('equipmentInput');
const facilityInput = document.getElementById('facilityInput');
const searchButton = document.getElementById('searchButton');
const clearButton = document.getElementById('clearButton');
const downloadButton = document.getElementById('downloadButton');
const dataTableBody = document.querySelector('#dataTable tbody');

// Variables to store data
let masterTaskData = []; // All data from Master_Task
let filteredData = []; // Data after applying filters
let currentListener = null; // Store the current listener

// Variables for sorting
let currentSortField = null;
let currentSortDirection = 'asc'; // 'asc' or 'desc'

// Variables for auto-complete
const taskOptions = new Set();

// On page load, set the default term using calculateCurrentTerm()
window.onload = function () {
    termInput.value = calculateCurrentTerm();
    loadData(); // Load data when the page loads
};

// Function to load data from Firebase
function loadData() {
    const termInputValue = termInput.value.trim();
    if (termInputValue === '') {
        alert('Please enter a term.');
        return;
    }

    // Remove previous listener if it exists
    if (currentListener) {
        database.ref('Master_Task').off('value', currentListener);
    }

    masterTaskData = [];
    taskOptions.clear(); // Clear previous task options

    // Split terms if multiple terms are entered
    const termArray = termInputValue.split(',').map(term => term.trim()).filter(term => term !== '');

    currentListener = database.ref('Master_Task').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            for (let termKey in data) {
                const trimmedTermKey = termKey.trim();
                if (termArray.includes(trimmedTermKey)) {
                    const termData = data[termKey];
                    if (Array.isArray(termData)) {
                        termData.forEach((item, index) => {
                            // Include the term key in each item
                            masterTaskData.push({ ...item, key: index, term: trimmedTermKey });
                            if (item.Task) taskOptions.add(item.Task);
                        });
                    } else {
                        // Handle the case where data is an object, not an array
                        for (let key in termData) {
                            const item = termData[key];
                            masterTaskData.push({ ...item, key: key, term: trimmedTermKey });
                            if (item.Task) taskOptions.add(item.Task);
                        }
                    }
                }
            }
            if (masterTaskData.length > 0) {
                populateFilters(masterTaskData);
                setupTaskAutoComplete(); // Set up task auto-complete
                applyFilters(); // Apply filters after data is loaded
            } else {
                dataTableBody.innerHTML = '';
                alert('No data found for the selected term(s).');
            }
        } else {
            dataTableBody.innerHTML = '';
            alert('No data found.');
        }
    });
}

// Function to populate filter options
function populateFilters(data) {
    // Collect unique values for each filter
    const days = new Set();
    const leads = new Set();
    const equipments = new Set();
    const facilities = new Set();

    data.forEach((item) => {
        if (item.Day) days.add(item.Day);
        if (item.Lead) leads.add(item.Lead);
        if (item.Equipment) equipments.add(item.Equipment);
        if (item.Facility) facilities.add(item.Facility);
    });

    // Populate datalists
    populateDatalist('dayOptions', days);
    populateDatalist('leadOptions', leads);
    populateDatalist('equipmentOptions', equipments);
    populateDatalist('facilityOptions', facilities);
}

// Helper function to populate datalists
function populateDatalist(datalistId, items) {
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = '';
    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);
    });
}

// Function to apply filters and update lead, task, and equipment options based on selected Facility and Day
function applyFilters() {
    const term = termInput.value.trim();
    const day = dayInput.value.trim();
    const lead = leadInput.value.trim();
    const task = taskInput.value.trim();
    const equipment = equipmentInput.value.trim();
    const facility = facilityInput.value.trim();

    // Split the task input by commas and trim each task
    const taskArray = task.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');

    // Split the lead input by commas and trim each lead
    const leadArray = lead.split(',').map(l => l.trim().toLowerCase()).filter(l => l !== '');

    // Filter the masterTaskData based on selected inputs
    filteredData = masterTaskData.filter((item) => {
        const termMatch = term === '' || (item.term && term.includes(item.term.toString().trim()));
        const dayMatch = day === '' || (item.Day && item.Day.toLowerCase().includes(day.toLowerCase()));
        const equipmentMatch = equipment === '' || (item.Equipment && item.Equipment.toLowerCase().includes(equipment.toLowerCase()));
        const facilityMatch = facility === '' || (item.Facility && item.Facility.toLowerCase().includes(facility.toLowerCase()));

        // Check if item's Task matches any of the tasks in taskArray
        const itemTask = item.Task ? item.Task.toLowerCase() : '';
        const taskMatch = taskArray.length === 0 || taskArray.some(taskTerm => itemTask.includes(taskTerm));

        // Enhanced Lead matching logic
        const itemLead = item.Lead ? item.Lead.toLowerCase() : '';
        const itemLeadParts = itemLead.split('/').map(part => part.trim());
        const leadMatch = lead === '' || 
                          leadArray.length === 0 ||
                          leadArray.some(leadTerm => 
                              itemLeadParts.some(part => part.includes(leadTerm))
                          );

        return termMatch && dayMatch && leadMatch && taskMatch && equipmentMatch && facilityMatch;
    });

    // Update Lead, Task, and Equipment options based on the filtered data
    updateLeadTaskEquipmentOptions(filteredData);

    displayData(filteredData); // Pass filtered data to displayData
}

// Function to update Lead, Task, and Equipment options based on filtered data
function updateLeadTaskEquipmentOptions(filteredData) {
    const uniqueLeads = new Set();
    const uniqueTasks = new Set();
    const uniqueEquipments = new Set();

    filteredData.forEach((item) => {
        if (item.Lead) uniqueLeads.add(item.Lead);
        if (item.Task) uniqueTasks.add(item.Task);
        if (item.Equipment) uniqueEquipments.add(item.Equipment);
    });

    // Populate lead options
    const leadDatalist = document.getElementById('leadOptions');
    leadDatalist.innerHTML = '';
    uniqueLeads.forEach(lead => {
        const option = document.createElement('option');
        option.value = lead;
        leadDatalist.appendChild(option);
    });

    // Populate task options
    const taskDatalist = document.getElementById('taskOptions');
    taskDatalist.innerHTML = '';
    uniqueTasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task;
        taskDatalist.appendChild(option);
    });

    // Populate equipment options
    const equipmentDatalist = document.getElementById('equipmentOptions');
    equipmentDatalist.innerHTML = '';
    uniqueEquipments.forEach(equipment => {
        const option = document.createElement('option');
        option.value = equipment;
        equipmentDatalist.appendChild(option);
    });
}

// Event listeners for updating Lead, Task, and Equipment options based on Day or Facility changes
dayInput.addEventListener('input', applyFilters);
facilityInput.addEventListener('input', applyFilters);

// Function to set up task auto-complete with multiple tasks
function setupTaskAutoComplete() {
    const taskDatalist = document.getElementById('taskOptions');
    taskDatalist.innerHTML = '';

    taskOptions.forEach(task => {
        const option = document.createElement('option');
        option.value = task;
        taskDatalist.appendChild(option);
    });

    taskInput.addEventListener('input', function (e) {
        const inputValue = taskInput.value;
        const lastCommaIndex = inputValue.lastIndexOf(',');
        let currentInput = inputValue;

        if (lastCommaIndex !== -1) {
            currentInput = inputValue.substring(lastCommaIndex + 1).trim();
        }

        // Create a temporary datalist with options matching the current input
        const tempDatalist = document.createElement('datalist');
        tempDatalist.id = 'tempTaskOptions';
        tempDatalist.innerHTML = '';

        taskOptions.forEach(task => {
            if (task.toLowerCase().includes(currentInput.toLowerCase())) {
                const option = document.createElement('option');
                option.value = task;
                tempDatalist.appendChild(option);
            }
        });

        // Remove old temporary datalist if it exists
        const oldTempDatalist = document.getElementById('tempTaskOptions');
        if (oldTempDatalist) {
            oldTempDatalist.parentNode.removeChild(oldTempDatalist);
        }

        document.body.appendChild(tempDatalist);
        taskInput.setAttribute('list', 'tempTaskOptions');
    });
}

// Event listeners for buttons
searchButton.addEventListener('click', () => {
    loadData(); // Load data when the user clicks the search button
});

clearButton.addEventListener('click', () => {
    dayInput.value = '';
    leadInput.value = '';
    taskInput.value = '';
    equipmentInput.value = '';
    facilityInput.value = '';
    currentSortField = null; // Reset sorting
    currentSortDirection = 'asc';
    // Remove sort classes from all headers
    tableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    applyFilters();
});

termInput.addEventListener('input', () => {
    // If you'd like to auto-load data as the user types, uncomment below:
    // loadData();
});

// Function to format numbers to 2 decimal places, avoiding NaN
function formatNumber(num) {
    const parsedNum = parseFloat(num);
    if (isNaN(parsedNum)) return '';
    return parsedNum.toFixed(2);
}

// Function to abbreviate text longer than a certain length
function abbreviateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Function to format time from 24-hour format to 12-hour AM/PM format
function formatTimeTo12Hour(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // If hour is 0, it should be 12
    return `${hour}:${minutes} ${ampm}`;
}

// Function to display data in the table
function displayData(data) {
    // Apply sorting to the data
    if (currentSortField) {
        data.sort((a, b) => {
            let valueA = a[currentSortField];
            let valueB = b[currentSortField];

            // Handle null or undefined values
            if (valueA === undefined || valueA === null) valueA = '';
            if (valueB === undefined || valueB === null) valueB = '';

            // Convert values to appropriate types
            if (currentSortField === 'Project Hours' || currentSortField === 'Duration') {
                valueA = parseFloat(valueA) || 0;
                valueB = parseFloat(valueB) || 0;
            } else {
                valueA = valueA.toString().toLowerCase();
                valueB = valueB.toString().toLowerCase();
            }

            if (valueA < valueB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Clear the table before displaying new data
    dataTableBody.innerHTML = '';

    // Display each row of data
    data.forEach((item) => {
        const row = document.createElement('tr');

        // Abbreviate Meal field after 15 characters
        const mealText = item.Meal || '';
        const mealDisplay = abbreviateText(mealText, 15);

        // Format numerical values to 2 decimal places
        const projectHours = formatNumber(item['Project Hours']);
        const projectHoursNum = parseFloat(item['Project Hours']);
        const validProjectHoursNum = !isNaN(projectHoursNum) ? projectHoursNum : null;

        // Format Start and End times using 12-hour AM/PM format
        const startTime = formatTimeTo12Hour(item.Start || '');
        const endTime = formatTimeTo12Hour(item.End || '');

        // Use Duration directly from DB
        const duration = formatNumber(item.Duration);
        const durationNum = parseFloat(item.Duration);
        const validDurationNum = !isNaN(durationNum) ? durationNum : null;

        // Calculate variance using Duration from Firebase
        let variance = '';
        if (validProjectHoursNum !== null && validDurationNum !== null && validDurationNum !== 0) {
            // Depending on your preference, you can invert this:
            // variance = ((validDurationNum - validProjectHoursNum) / validProjectHoursNum) * 100;
            // Or:
            variance = ((validProjectHoursNum - validDurationNum) / validDurationNum) * 100;
            variance = variance.toFixed(2);
        }

        // Determine Status
        let status = '';
        if (item.Start && !item.End) {
            status = 'In progress';
        } else if (item.Start && item.End) {
            status = 'Complete';
        } else {
            status = ''; // If both Start and End are missing
        }

        // Build the row
        row.innerHTML = `
            <td>${item.Cycle || ''}</td>
            <td title="${mealText}">${mealDisplay}</td>
            <td>${item.Product || ''}</td>
            <td>${item.Count || ''}</td>
            <td>${item.Lead || ''}</td>
            <td>${item.Equipment || ''}</td>
            <td>${projectHours}</td>
            <td>${startTime}</td>
            <td>${endTime}</td>
            <td>${duration}</td>
            <td class="variance-cell">${variance ? `${variance}%` : ''}</td>
            <td>${item.Teams || ''}</td>
            <td>${status}</td>
        `;

        // Apply CSS class to 'Product' column based on Status
        const productCell = row.children[2]; // 'Product' column = index 2
        if (status === 'In progress') {
            productCell.classList.add('status-in-progress');
        } else if (status === 'Complete') {
            productCell.classList.add('status-complete');
        }

        // Style Variance cell based on positive or negative
        const varianceCell = row.querySelector('.variance-cell');
        const varianceValue = parseFloat(variance);
        if (!isNaN(varianceValue)) {
            if (varianceValue > 0) {
                varianceCell.style.backgroundColor = '#d4edda'; // Light green
                varianceCell.style.color = '#155724';          // Dark green text
            } else if (varianceValue < 0) {
                varianceCell.style.backgroundColor = '#f8d7da'; // Light pink
                varianceCell.style.color = '#721c24';          // Dark red text
            }
        }

        dataTableBody.appendChild(row);
    });
}

// Event listeners for sorting
const tableHeaders = document.querySelectorAll('#dataTable th');
tableHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const field = header.getAttribute('data-field');
        if (currentSortField === field) {
            // Toggle sort direction
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortField = field;
            currentSortDirection = 'asc';
        }

        // Remove sort classes from all headers
        tableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        // Add sort class to the current header
        header.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');

        // Re-display data with new sorting
        displayData(filteredData);
    });
});

// =======================
//  Copy ALL Visible Rows
// =======================
const copyAllButton = document.createElement('button');
copyAllButton.textContent = 'Copy All Rows with Styles';
copyAllButton.style.margin = '10px';
document.body.insertBefore(copyAllButton, document.getElementById('tableContainer'));

// Function to copy ALL currently displayed rows along with headers, styles, and format
copyAllButton.addEventListener('click', () => {
    // If there is no data to copy
    if (filteredData.length === 0) {
        alert('No data to copy.');
        return;
    }

    // Create a temporary container for copying
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px'; // Hide offscreen

    // Create a new table element to hold everything
    const tempTable = document.createElement('table');
    tempTable.style.borderCollapse = 'collapse'; 
    tempTable.style.width = '100%';

    // ====== HEADERS ======
    // Grab existing table headers
    const tableHeaders = document.querySelectorAll('#dataTable thead tr th');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = 'Aqua'; 
    headerRow.style.color = 'black'; 
    headerRow.style.fontWeight = 'bold';

    tableHeaders.forEach(header => {
        const headerCell = document.createElement('th');
        headerCell.textContent = header.textContent;
        headerCell.style.border = '1px solid #000';
        headerCell.style.padding = '5px';
        headerCell.style.textAlign = 'center';
        headerRow.appendChild(headerCell);
    });
    tempTable.appendChild(headerRow);

    // ====== BODY (all rows currently displayed) ======
    const allDisplayedRows = dataTableBody.querySelectorAll('tr');
    allDisplayedRows.forEach((row, index) => {
        const clonedRow = row.cloneNode(true);
        // Alternate row background colors (optional)
        clonedRow.style.backgroundColor = index % 2 === 0 ? 'lightgray' : 'white';

        // Style each cell
        clonedRow.querySelectorAll('td').forEach(cell => {
            cell.style.border = '1px solid #000';
            cell.style.padding = '5px';
        });
        tempTable.appendChild(clonedRow);
    });

    // Append the tempTable to tempContainer
    tempContainer.appendChild(tempTable);

    // Append tempContainer to document body
    document.body.appendChild(tempContainer);

    // Copy the tempContainer's HTML as 'text/html'
    const htmlToCopy = tempContainer.innerHTML;
    navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([htmlToCopy], { type: 'text/html' }) })
    ]).then(() => {
        alert('Copied all displayed rows with headers, styles, and formatting!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });

    // Cleanup - remove the temporary container
    document.body.removeChild(tempContainer);
});

// =======================
//   DOWNLOAD as XLSX
// =======================
downloadButton.addEventListener('click', () => {
    if (filteredData.length === 0) {
        alert('No data to download.');
        return;
    }
    // Prepare data for XLSX
    const worksheetData = filteredData.map((item) => {
        let status = '';
        if (item.Start && !item.End) {
            status = 'In progress';
        } else if (item.Start && item.End) {
            status = 'Complete';
        }

        // Use Duration from DB
        const duration = formatNumber(item.Duration);
        const durationNum = parseFloat(item.Duration);
        const validDurationNum = !isNaN(durationNum) ? durationNum : null;

        // Format Project Hours
        const projectHours = formatNumber(item['Project Hours']);
        const projectHoursNum = parseFloat(item['Project Hours']);
        const validProjectHoursNum = !isNaN(projectHoursNum) ? projectHoursNum : null;

        // Calculate variance
        let variance = '';
        if (validProjectHoursNum !== null && validDurationNum !== null && validProjectHoursNum !== 0) {
            variance = ((validDurationNum - validProjectHoursNum) / validProjectHoursNum) * 100;
            variance = variance.toFixed(2) + '%';
        }

        return {
            'Cycle': item.Cycle || '',
            'Meal': item.Meal || '',
            'Product': item.Product || '',
            'Count': item.Count || '',
            'Lead': item.Lead || '',
            'Teams': item.Teams || '',
            'Equipment': item.Equipment || '',
            'Project Hours': projectHours,
            'Start': item.Start || '',
            'End': item.End || '',
            'Duration': duration,
            'Variance': variance || '',
            'Status': status,
        };
    });

    // Use SheetJS to create and download XLSX
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'EOD Data');
    const term = termInput.value.trim().replace(/,/g, '_');
    const filename = `EOD_Data_Term_${term}.xlsx`;
    XLSX.writeFile(wb, filename);
});
