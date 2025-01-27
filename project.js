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
const minTermInput = document.getElementById('minTermInput');
const maxTermInput = document.getElementById('maxTermInput');
const dayInput = document.getElementById('dayInput');
const teamsInput = document.getElementById('teamsInput');
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
const teamsOptionsSet = new Set(); // To store individual team members

// On page load, set the default terms using calculateCurrentTerm()
window.onload = function () {
    const baseTerm = 403; // Ensure baseTerm is accessible here
    const currentTerm = calculateCurrentTerm();

    // Ensure term inputs are of type number
    minTermInput.setAttribute('type', 'number');
    maxTermInput.setAttribute('type', 'number');

    // Set min and max attributes for term inputs
    minTermInput.min = baseTerm.toString(); // Set min to baseTerm
    minTermInput.max = currentTerm.toString(); // Set max to currentTerm
    maxTermInput.min = baseTerm.toString(); // Set min to baseTerm
    maxTermInput.max = currentTerm.toString(); // Set max to currentTerm

    // Set default values to currentTerm
    minTermInput.value = currentTerm;
    maxTermInput.value = currentTerm;

    loadData(); // Load data when the page loads
};

// Function to load data from Firebase
function loadData() {
    const minTermValue = parseInt(minTermInput.value.trim());
    const maxTermValue = parseInt(maxTermInput.value.trim());

    if (isNaN(minTermValue) || isNaN(maxTermValue)) {
        alert('Please enter valid terms.');
        return;
    }

    if (minTermValue > maxTermValue) {
        alert('Minimum term cannot be greater than maximum term.');
        return;
    }

    // Remove previous listener if it exists
    if (currentListener) {
        database.ref('Master_Task').off('value', currentListener);
    }

    masterTaskData = [];
    taskOptions.clear(); // Clear previous task options
    teamsOptionsSet.clear(); // Clear previous team options

    // Generate term array based on min and max term values
    const termArray = [];
    for (let term = minTermValue; term <= maxTermValue; term++) {
        termArray.push(term.toString());
    }

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

                            // Collect individual team members
                            if (item.Teams) {
                                const teamMembers = item.Teams.split(',').map(name => name.trim());
                                teamMembers.forEach(member => {
                                    teamsOptionsSet.add(member);
                                });
                            }
                        });
                    } else {
                        // Handle the case where data is an object, not an array
                        for (let key in termData) {
                            const item = termData[key];
                            masterTaskData.push({ ...item, key: key, term: trimmedTermKey });
                            if (item.Task) taskOptions.add(item.Task);

                            // Collect individual team members
                            if (item.Teams) {
                                const teamMembers = item.Teams.split(',').map(name => name.trim());
                                teamMembers.forEach(member => {
                                    teamsOptionsSet.add(member);
                                });
                            }
                        }
                    }
                }
            }
            if (masterTaskData.length > 0) {
                populateFilters(masterTaskData);
                setupTaskAutoComplete(); // Set up task auto-complete
                setupTeamsAutoComplete(); // Set up teams auto-complete
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
    const equipments = new Set();
    const facilities = new Set();

    data.forEach((item) => {
        if (item.Day) days.add(item.Day);
        if (item.Equipment) equipments.add(item.Equipment);
        if (item.Facility) facilities.add(item.Facility);
    });

    // Populate datalists
    populateDatalist('dayOptions', days);
    populateDatalist('teamsOptions', teamsOptionsSet);
    populateDatalist('equipmentOptions', equipments);
    populateDatalist('facilityOptions', facilities);
}

// Helper function to populate datalists
function populateDatalist(datalistId, items) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) {
        console.error(`Element with ID '${datalistId}' not found in the HTML.`);
        return;
    }
    datalist.innerHTML = '';
    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);
    });
}

// Function to apply filters and update Teams, Task, and Equipment options based on selected Facility and Day
function applyFilters() {
    const minTermValue = parseInt(minTermInput.value.trim());
    const maxTermValue = parseInt(maxTermInput.value.trim());
    const day = dayInput.value.trim();
    const teams = teamsInput.value.trim();
    const task = taskInput.value.trim();
    const equipment = equipmentInput.value.trim();
    const facility = facilityInput.value.trim();

    // Generate term array based on min and max term values
    const termArray = [];
    for (let term = minTermValue; term <= maxTermValue; term++) {
        termArray.push(term.toString());
    }

    // Split the task input by commas and trim each task
    const taskArray = task.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');

    // Split the teams input by commas and trim each team member
    const teamsArray = teams.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');

    // Filter the masterTaskData based on selected inputs
    filteredData = masterTaskData.filter((item) => {
        const termMatch = termArray.includes(item.term);
        const dayMatch = day === '' || (item.Day && item.Day.toLowerCase().includes(day.toLowerCase()));
        const equipmentMatch = equipment === '' || (item.Equipment && item.Equipment.toLowerCase().includes(equipment.toLowerCase()));
        const facilityMatch = facility === '' || (item.Facility && item.Facility.toLowerCase().includes(facility.toLowerCase()));

        // Check if item's Task matches any of the tasks in taskArray
        const itemTask = item.Task ? item.Task.toLowerCase() : '';
        const taskMatch = taskArray.length === 0 || taskArray.some(taskTerm => itemTask.includes(taskTerm));

        // Enhanced Teams matching logic
        const itemTeams = item.Teams ? item.Teams.toLowerCase() : '';
        const itemTeamsParts = itemTeams.split(',').map(part => part.trim());
        const teamsMatch = teams === '' || teamsArray.length === 0 || teamsArray.some(teamTerm => itemTeamsParts.some(part => part.includes(teamTerm)));

        return termMatch && dayMatch && teamsMatch && taskMatch && equipmentMatch && facilityMatch;
    });

    // Update Teams, Task, and Equipment options based on the filtered data
    updateTeamsTaskEquipmentOptions(filteredData);

    displayData(filteredData); // Pass filtered data to displayData
}

// Function to update Teams, Task, and Equipment options based on filtered data
function updateTeamsTaskEquipmentOptions(filteredData) {
    const uniqueTeams = new Set();
    const uniqueTasks = new Set();
    const uniqueEquipments = new Set();

    // Collect unique values for Teams, Task, and Equipment
    filteredData.forEach((item) => {
        if (item.Teams) {
            const teamMembers = item.Teams.split(',').map(name => name.trim());
            teamMembers.forEach(member => {
                uniqueTeams.add(member);
            });
        }
        if (item.Task) uniqueTasks.add(item.Task);
        if (item.Equipment) uniqueEquipments.add(item.Equipment);
    });

    // Populate teams options
    populateDatalist('teamsOptions', uniqueTeams);

    // Populate task options
    populateDatalist('taskOptions', uniqueTasks);

    // Populate equipment options
    populateDatalist('equipmentOptions', uniqueEquipments);
}

// Event listeners for updating Teams, Task, and Equipment options based on Day or Facility changes
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

// Function to set up teams auto-complete with individual team members
function setupTeamsAutoComplete() {
    const teamsInputField = teamsInput;
    const teamsDatalist = document.getElementById('teamsOptions');

    teamsInputField.addEventListener('input', function (e) {
        const inputValue = teamsInputField.value;
        const lastCommaIndex = inputValue.lastIndexOf(',');
        let currentInput = inputValue;

        if (lastCommaIndex !== -1) {
            currentInput = inputValue.substring(lastCommaIndex + 1).trim();
        }

        // Create a temporary datalist with options matching the current input
        const tempDatalist = document.createElement('datalist');
        tempDatalist.id = 'tempTeamsOptions';
        tempDatalist.innerHTML = '';

        teamsOptionsSet.forEach(teamMember => {
            if (teamMember.toLowerCase().includes(currentInput.toLowerCase())) {
                const option = document.createElement('option');
                option.value = teamMember;
                tempDatalist.appendChild(option);
            }
        });

        // Remove old temporary datalist if it exists
        const oldTempDatalist = document.getElementById('tempTeamsOptions');
        if (oldTempDatalist) {
            oldTempDatalist.parentNode.removeChild(oldTempDatalist);
        }

        document.body.appendChild(tempDatalist);
        teamsInputField.setAttribute('list', 'tempTeamsOptions');
    });
}

// Event listeners for buttons
searchButton.addEventListener('click', () => {
    loadData(); // Load data when the user clicks the search button
});

clearButton.addEventListener('click', () => {
    dayInput.value = '';
    teamsInput.value = '';
    taskInput.value = '';
    equipmentInput.value = '';
    facilityInput.value = '';
    currentSortField = null; // Reset sorting
    currentSortDirection = 'asc';
    // Remove sort classes from all headers
    tableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    applyFilters();
});

minTermInput.addEventListener('input', () => {
    // Ensure minTerm is not greater than maxTerm
    if (parseInt(minTermInput.value) > parseInt(maxTermInput.value)) {
        alert('Minimum term cannot be greater than maximum term.');
        minTermInput.value = maxTermInput.value;
    }
});

maxTermInput.addEventListener('input', () => {
    // Ensure maxTerm is not less than minTerm
    if (parseInt(maxTermInput.value) < parseInt(minTermInput.value)) {
        alert('Maximum term cannot be less than minimum term.');
        maxTermInput.value = minTermInput.value;
    }
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

        // Use Duration from Firebase
        const duration = formatNumber(item.Duration);
        const durationNum = parseFloat(item.Duration);
        const validDurationNum = !isNaN(durationNum) ? durationNum : null;

        // Calculate variance using Duration from Firebase
        let variance = '';
        if (validProjectHoursNum !== null && validDurationNum !== null && validProjectHoursNum !== 0) {
            // variance = ((validDurationNum - validProjectHoursNum) / validProjectHoursNum) * 100;
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
            status = ''; // Empty status if both Start and End are missing
        }

        // Create row HTML with Duration from Firebase
        row.innerHTML = `
            <td>${item.Cycle || ''}</td>
            <td title="${mealText}">${mealDisplay}</td>
            <td>${item.Product || ''}</td>
            <td>${item.Count || ''}</td>
            <td>${item.Teams || ''}</td>
            <td>${item.Equipment || ''}</td>
            <td>${projectHours}</td>
            <td>${startTime}</td>
            <td>${endTime}</td>
            <td>${duration}</td>
            <td class="variance-cell">${variance ? `${variance}%` : ''}</td>
            <td>${status}</td>
            <td>${item.Term || ''}</td>
        `;

        // Apply CSS class to 'Product' column based on Status
        const productCell = row.children[2]; // 'Product' column is the third column (index 2)
        if (status === 'In progress') {
            productCell.classList.add('status-in-progress');
        } else if (status === 'Complete') {
            productCell.classList.add('status-complete');
        }

        // Style Variance cell based on positive or negative value
        const varianceCell = row.querySelector('.variance-cell');
        const varianceValue = parseFloat(variance);
        if (!isNaN(varianceValue)) {
            if (varianceValue > 0) {
                varianceCell.style.backgroundColor = '#d4edda'; // Light green
                varianceCell.style.color = '#155724'; // Dark green text
            } else if (varianceValue < 0) {
                varianceCell.style.backgroundColor = '#f8d7da'; // Light pink
                varianceCell.style.color = '#721c24'; // Dark red text
            }
        }

        // Append the row to the table body
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

// Copy Selected Rows with Styles
const copyButton = document.createElement('button');
copyButton.textContent = 'Copy Selected Rows with Styles';
copyButton.style.margin = '10px';
document.body.appendChild(copyButton); // Append the button to your toolbar or desired location

// Function to copy selected table rows along with headers, styles, and format
copyButton.addEventListener('click', () => {
    const userSelection = window.getSelection();
    if (!userSelection || userSelection.rangeCount === 0) {
        alert('Please select some rows to copy.');
        return;
    }

    // Get the selected range and its contents
    const selectedRange = userSelection.getRangeAt(0);
    const selectedContent = selectedRange.cloneContents();

    // Create a temporary container to store the selected table content
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px'; // Hide the container offscreen

    // Create a table element to hold the selected rows and headers
    const tempTable = document.createElement('table');
    tempTable.style.borderCollapse = 'collapse'; // Maintain original table style
    tempTable.style.width = '100%';

    // Get all the table headers and append to a new header row
    const tableHeaders = document.querySelectorAll('#dataTable th');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = 'Aqua'; // Set header background color
    headerRow.style.color = 'black'; // Set header text color
    headerRow.style.fontWeight = 'bold'; // Bold header text

    tableHeaders.forEach(header => {
        const headerCell = document.createElement('th');
        headerCell.textContent = header.textContent;
        headerCell.style.border = '1px solid #000'; // Add border for clarity
        headerCell.style.padding = '5px'; // Add padding for aesthetics
        headerCell.style.textAlign = 'center';
        headerRow.appendChild(headerCell);
    });
    tempTable.appendChild(headerRow); // Append the header row to the temp table

    // Append the selected content to the temporary table
    const rows = selectedContent.querySelectorAll('tr');
    rows.forEach((row, index) => {
        const clonedRow = row.cloneNode(true);
        // Alternate row background colors: light gray and white
        clonedRow.style.backgroundColor = index % 2 === 0 ? 'lightgray' : 'white';
        clonedRow.querySelectorAll('td').forEach(cell => {
            cell.style.border = '1px solid #000'; // Maintain borders
            cell.style.padding = '5px'; // Maintain padding for cells
        });
        tempTable.appendChild(clonedRow);
    });

    // Append the temporary table to the temporary container
    tempContainer.appendChild(tempTable);

    // Append the temporary container to the body
    document.body.appendChild(tempContainer);

    // Copy the temporary container's HTML content to the clipboard as HTML format
    const htmlToCopy = tempContainer.innerHTML;
    navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([htmlToCopy], { type: 'text/html' }) })
    ]).then(() => {
        alert('Copied selected rows with headers, styles, and formatting!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });

    // Remove the temporary container after copying
    document.body.removeChild(tempContainer);
});

// Function to download data as XLSX
downloadButton.addEventListener('click', () => {
    if (filteredData.length === 0) {
        alert('No data to download.');
        return;
    }
    // Prepare data for XLSX
    const worksheetData = filteredData.map((item) => {
        // Determine Status
        let status = '';
        if (item.Start && !item.End) {
            status = 'In progress';
        } else if (item.Start && item.End) {
            status = 'Complete';
        } else {
            status = '';
        }

        // Use Duration from Firebase
        const duration = formatNumber(item.Duration);
        const durationNum = parseFloat(item.Duration);
        const validDurationNum = !isNaN(durationNum) ? durationNum : null;

        // Format numerical values to 2 decimal places
        const projectHours = formatNumber(item['Project Hours']);
        const projectHoursNum = parseFloat(item['Project Hours']);
        const validProjectHoursNum = !isNaN(projectHoursNum) ? projectHoursNum : null;

        // Calculate variance using Duration from Firebase
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
    // Use SheetJS to create and download XLSX file
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'EOD Data');
    const minTerm = minTermInput.value.trim();
    const maxTerm = maxTermInput.value.trim();
    const filename = `EOD_Data_Terms_${minTerm}_to_${maxTerm}.xlsx`;
    XLSX.writeFile(wb, filename);
});
