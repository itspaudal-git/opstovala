// Initialize Firebase if not already done (from credd.js)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Global data arrays
let rawData = {};
let filteredData = [];
let facilityOptions = new Set();
let taskOptions = new Set();
let dayOptions = new Set();
let productOptions = new Set();
let statusOptions = new Set();
let maxUpdates = 0; // track the max number of updates (Update1, Update2, ...) across all entries
let currentFilteredData = []; // store the currently displayed filtered data for live updates

// Calculate the current term number based on the current week
function calculateCurrentTerm() {
    const baseTerm = 403; // Starting term
    const startDate = new Date('2024-09-15'); // The starting Sunday date of term 403
    const currentDate = new Date();

    // Calculate the number of weeks between the starting date and the current date
    const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7; 
    const weeksPassed = Math.floor((currentDate - startDate) / millisecondsPerWeek);

    // Calculate the current term
    return baseTerm + weeksPassed;
}

// Once the DOM is ready, set the default values for Term, Day, and Status
document.addEventListener('DOMContentLoaded', function() {
    const termField = document.getElementById('term');
    if (termField) {
        termField.value = calculateCurrentTerm();
    }

    const searchDayField = document.getElementById('searchDay');
    if (searchDayField) {
        searchDayField.value = new Date().toLocaleString('en-US', { weekday: 'long' });
    }

    const searchStatusField = document.getElementById('searchStatus');
    if (searchStatusField) {
        searchStatusField.value = "In progress";
    }
});

// Status calculation function
function calculateStatus(start, end, count, producedQty, task) {
    const specialTasks = ['Batch Mix', 'Sauce Mix', 'Open', 'Drain', 'Kettle', 'Oven', 'Thaw', 'VCM', 'Planetary Mix', 'Skillet'];
    if (producedQty && count > producedQty) {
        if (specialTasks.includes(task)) {
            return "Complete";
        } else {
            return "Shorts";
        }
    } else if (start && end) {
        return "Complete";
    } else if (start) {
        return "In progress";
    } else {
        return "Released";
    }
}

// Real-time listener for Firebase data
database.ref('Master_Task').on('value', snapshot => {
    rawData = snapshot.val() || {};
    processData();
    displayData(); // Re-display whenever data changes to show updates in real-time
});

function processData() {
    filteredData = [];
    facilityOptions.clear();
    taskOptions.clear();
    dayOptions.clear();
    productOptions.clear();
    statusOptions.clear();
    maxUpdates = 0;

    for (let term in rawData) {
        const termData = rawData[term];
        if (typeof termData === 'object') {
            for (let key in termData) {
                const entry = termData[key];
                const count = parseFloat(entry["Count"] || 0);
                const producedQty = parseFloat(entry["Produced Qty"] || 0);
                const task = entry.Task || '';
                const status = calculateStatus(entry.Start, entry.End, count, producedQty, task);

                // Count how many Updates (Update1, Update2...) exist
                const updates = Object.keys(entry).filter(field => field.startsWith("Update"));
                if (updates.length > maxUpdates) {
                    maxUpdates = updates.length;
                }

                filteredData.push({
                    term: term,
                    key: key,
                    ...entry,
                    __status: status
                });

                if (entry.Facility) facilityOptions.add(entry.Facility);
                if (entry.Task) taskOptions.add(entry.Task);
                if (entry.Day) dayOptions.add(entry.Day);
                if (entry.Product) productOptions.add(entry.Product);

                statusOptions.add(status);
            }
        }
    }
}

function displayData() {
    const termValue = parseInt(document.getElementById('term').value, 10);
    // If no term is entered, show nothing
    if (isNaN(termValue) || termValue === 0) {
        const tbody = document.getElementById('dataTable').querySelector('tbody');
        const thead = document.getElementById('tableHeader');
        thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
        currentFilteredData = [];
        return;
    }

    const searchProduct = (document.getElementById('searchProduct')?.value || '').toLowerCase();
    const searchTask = (document.getElementById('searchTask')?.value || '').toLowerCase();
    const searchFacility = (document.getElementById('searchFacility')?.value || '').toLowerCase();
    const searchDay = (document.getElementById('searchDay')?.value || '').toLowerCase();
    const searchStatus = (document.getElementById('searchStatus')?.value || '').toLowerCase();

    const filtered = filteredData.filter(entry => {
        const product = (entry.Product || '').toLowerCase();
        const facility = (entry.Facility || '').toLowerCase();
        const task = (entry.Task || '').toLowerCase();
        const day = (entry.Day || '').toLowerCase();
        const status = (entry.__status || '').toLowerCase();
        const entryTerm = parseInt(entry.term, 10);

        const productMatch = product.includes(searchProduct);
        const facilityMatch = facility.includes(searchFacility);
        const taskMatch = task.includes(searchTask);
        const dayMatch = day.includes(searchDay);
        const statusMatch = status.includes(searchStatus);
        const termMatch = entryTerm === termValue; 

        return productMatch && facilityMatch && taskMatch && dayMatch && statusMatch && termMatch;
    });

    currentFilteredData = filtered; // store the filtered data for real-time updates
    buildTableHeaders();
    populateTable(filtered);
}

// Build table headers dynamically (with Update columns and "Projected")
function buildTableHeaders() {
    const thead = document.getElementById('tableHeader');
    thead.innerHTML = '';

    // Mandatory columns
    const headers = ["Term", "Facility", "Meal", "Cycle", "Product", "Task", "Count", "Project Hours", "Start", "Projected"];
    // Add Update columns dynamically
    for (let i = 1; i <= maxUpdates; i++) {
        headers.push(`Update${i}`);
    }
    headers.push("End");

    const tr = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
}

// Populate table body
function populateTable(data) {
    const tbody = document.getElementById('dataTable').querySelector('tbody');
    tbody.innerHTML = '';

    // Sort data by Task, then by Product
    data.sort((a, b) => {
        const taskA = (a.Task || '').toLowerCase();
        const taskB = (b.Task || '').toLowerCase();
        const productA = (a.Product || '').toLowerCase();
        const productB = (b.Product || '').toLowerCase();

        if (taskA < taskB) return -1;
        if (taskA > taskB) return 1;
        if (productA < productB) return -1;
        if (productA > productB) return 1;
        return 0;
    });

    const now = new Date();

    data.forEach(entry => {
        const row = document.createElement('tr');
        row.dataset.uniqueId = `${entry.term}-${entry.Facility}-${entry.key}`;

        const count = parseFloat(entry["Count"] || 0);
        const projectHours = parseFloat(entry["Project Hours"]||0);

        const startTime24 = entry.Start || '';
        const startTime12 = formatTime24To12(startTime24);
        const projectedCount = calculateProjectedCountAtTime(startTime24, projectHours, count, now);

        // Mandatory columns
        addCell(row, entry.term);
        addCell(row, entry.Facility);
        addCell(row, entry.Meal);
        addCell(row, entry.Cycle);
        addCell(row, entry.Product);
        addCell(row, entry.Task);
        addCell(row, count);
        addCell(row, projectHours.toFixed(2));
        addCell(row, startTime12);
        addCell(row, projectedCount);

        // Update columns
        const startDate = createStartDate(now, startTime24); // Reference start date for the day

        for (let i = 1; i <= maxUpdates; i++) {
            const updateField = `Update${i}`;
            const td = document.createElement('td');

            if (entry[updateField]) {
                const updateObj = entry[updateField];
                if (typeof updateObj === 'object' && updateObj.Log_time && updateObj.Log_Qty) {
                    const logQty = parseFloat(updateObj.Log_Qty) || 0;
                    const updateTime = parseLogTime(updateObj.Log_time, startDate);
                    const projectedAtUpdateTime = calculateProjectedCountAtTime(startTime24, projectHours, count, updateTime);

                    // New text format: Qty. {Log_Qty}, {Log_time}, Expected {projectedAtUpdateTime}
                    const updateText = `Qty. ${updateObj.Log_Qty}, ${updateObj.Log_time}, Expected ${projectedAtUpdateTime}`;
                    td.textContent = updateText;

                    if (logQty >= projectedAtUpdateTime) {
                        td.style.backgroundColor = 'lightgreen';
                    } else {
                        td.style.backgroundColor = 'pink';
                    }

                } else {
                    td.textContent = entry[updateField];
                }
            } else {
                td.textContent = '';
            }

            row.appendChild(td);
        }

        addCell(row, entry.End);

        tbody.appendChild(row);
    });
}

// Helper to add a cell
function addCell(row, text) {
    const td = document.createElement('td');
    td.textContent = text || '';
    row.appendChild(td);
    return td;
}

// Convert "HH:MM" 24-hour format to "HH:MM AM/PM"
function formatTime24To12(time24) {
    if (!time24) return '';
    const [hourStr, minuteStr] = time24.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (isNaN(hour) || isNaN(minute)) return '';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour || 12;
    const hh = hour < 10 ? '0' + hour : hour;
    const mm = minute < 10 ? '0' + minute : minute;
    return `${hh}:${mm} ${ampm}`;
}

// Create a date object for the Start time's day
function createStartDate(now, startTime24) {
    const [startH, startM] = startTime24.split(':').map(Number);
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM, 0);
    return startDate;
}

// Calculate projected counts at a specific time
function calculateProjectedCountAtTime(startTime24, projectHoursDecimal, totalCount, targetTime) {
    if (!startTime24) return 0;
    const [startH, startM] = startTime24.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM)) return 0;

    const startDate = new Date(targetTime.getFullYear(), targetTime.getMonth(), targetTime.getDate(), startH, startM, 0);

    const totalProjectMinutes = Math.floor(projectHoursDecimal * 60);
    const elapsedMs = targetTime - startDate;
    const elapsedMinutes = elapsedMs / 60000;

    if (elapsedMinutes <= 0) {
        // Before start time
        return 0;
    } else if (elapsedMinutes >= totalProjectMinutes) {
        // Past projected end time, full count done
        return totalCount;
    } else {
        // Partial progress
        const ratio = elapsedMinutes / totalProjectMinutes;
        return Math.floor(ratio * totalCount);
    }
}

// Parse the Log_time (HH:MM AM/PM) and return a Date object on the same day as startDate
function parseLogTime(logTimeString, startDate) {
    // logTimeString format: "HH:MM AM/PM"
    const [timePart, ampm] = logTimeString.split(' ');
    const [hh, mm] = timePart.split(':').map(Number);

    let hour = hh;
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    const logDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), hour, mm, 0);
    return logDate;
}

// Setup auto-complete
function setupAutoComplete(inputId, suggestionBoxId, data) {
    const input = document.getElementById(inputId);
    const suggestionBox = document.getElementById(suggestionBoxId);

    input.addEventListener('input', function() {
        const inputValue = this.value.toLowerCase();
        suggestionBox.innerHTML = '';
        if (inputValue === '') {
            suggestionBox.style.display = 'none';
            return;
        }

        const uniqueData = [...new Set(data)];
        const suggestions = uniqueData.filter(item => item.toLowerCase().includes(inputValue));

        if (suggestions.length === 0) {
            suggestionBox.style.display = 'none';
            return;
        }

        suggestionBox.style.display = 'block';
        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = suggestion;
            suggestionBox.appendChild(suggestionItem);

            suggestionItem.addEventListener('click', function() {
                input.value = suggestion;
                suggestionBox.style.display = 'none';
            });
        });
    });

    input.addEventListener('focus', function() {
        suggestionBox.innerHTML = '';
        const uniqueData = [...new Set(data)];
        uniqueData.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = suggestion;
            suggestionBox.appendChild(suggestionItem);

            suggestionItem.addEventListener('click', function() {
                input.value = suggestion;
                suggestionBox.style.display = 'none';
            });
        });
        suggestionBox.style.display = 'block';
    });

    document.addEventListener('click', function(event) {
        if (!input.contains(event.target) && !suggestionBox.contains(event.target)) {
            suggestionBox.style.display = 'none';
        }
    });
}

// Re-filter on Enter
['term', 'searchFacility', 'searchProduct', 'searchTask', 'searchDay', 'searchStatus'].forEach(id => {
    const inputField = document.getElementById(id);
    if (inputField) {
        inputField.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                displayData();
            }
        });
    }
});

document.getElementById('filterBtn').addEventListener('click', displayData);

// Real-time updates of projected counts every second
setInterval(() => {
    updateProjectedCounts();
}, 1000); // every 1 second

function updateProjectedCounts() {
    // Only update if we have data displayed
    if (!currentFilteredData || currentFilteredData.length === 0) return;

    const tbody = document.getElementById('dataTable').querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');

    const now = new Date();
    rows.forEach((row, index) => {
        const uniqueId = row.dataset.uniqueId;
        if (!uniqueId) return;

        // Find matching entry
        const entry = currentFilteredData[index];
        if (!entry) return;

        const count = parseFloat(entry["Count"] || 0);
        const projectHours = parseFloat(entry["Project Hours"]||0);
        const startTime24 = entry.Start || '';

        // Update Projected column
        const projectedCount = calculateProjectedCountAtTime(startTime24, projectHours, count, now);
        const projectedCell = row.cells[9]; 
        if (projectedCell) {
            projectedCell.textContent = projectedCount;
        }

        // Re-check update cells highlighting with their respective Log_time
        const startDate = createStartDate(now, startTime24);
        for (let i = 1; i <= maxUpdates; i++) {
            const updateField = `Update${i}`;
            const updateCellIndex = 9 + i; // Projected is 9, updates start at 10
            const updateCell = row.cells[updateCellIndex];
            if (!updateCell) continue;

            if (entry[updateField] && typeof entry[updateField] === 'object' && entry[updateField].Log_time && entry[updateField].Log_Qty) {
                const logQty = parseFloat(entry[updateField].Log_Qty) || 0;
                const updateTime = parseLogTime(entry[updateField].Log_time, startDate);
                const projectedAtUpdateTime = calculateProjectedCountAtTime(startTime24, projectHours, count, updateTime);

                // Update text with new "Expected" info even during updates
                const updateText = `Qty. ${entry[updateField].Log_Qty}, ${entry[updateField].Log_time}, Expected ${projectedAtUpdateTime}`;
                updateCell.textContent = updateText;

                if (logQty >= projectedAtUpdateTime) {
                    updateCell.style.backgroundColor = 'lightgreen';
                } else {
                    updateCell.style.backgroundColor = 'pink';
                }
            }
        }
    });
}
