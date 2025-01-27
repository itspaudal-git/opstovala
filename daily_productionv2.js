document.addEventListener('DOMContentLoaded', function () {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const database = firebase.database();
    let rawData = [];
    let filteredData = [];
    let facilityOptions = new Set();
    let taskOptions = new Set();
    let dayOptions = new Set();

// Function to calculate the current term number based on the current week
function calculateCurrentTerm() {
    const baseTerm = 403; // Starting term
    const startDate = new Date('2024-09-15'); // Replace with the actual starting Sunday date of term 403
    const currentDate = new Date();

    // Calculate the number of weeks between the starting date and the current date
    const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7; // Number of milliseconds in a week
    const weeksPassed = Math.floor((currentDate - startDate) / millisecondsPerWeek);

    // Calculate the current term
    return baseTerm + weeksPassed;
}

// Set default values for 'Term' and 'Day' when the page loads
document.getElementById('term').value = calculateCurrentTerm(); // Calculate the current term
document.getElementById('searchDay').value = new Date().toLocaleString('en-US', { weekday: 'long' }); // Set default day to today


    // Function to calculate status based on start and end time
    function calculateStatus(start, end) {
        if (start && end) {
            return "Complete";
        } else if (start) {
            return "In progress";
        } else {
            return "Released";
        }
    }

    // Function to convert 24-hour time to 12-hour time with AM/PM
    function convertTo12HourFormat(time) {
        if (!time) return "N/A";
        let [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12; // Convert hour '0' to '12'
        return `${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
    }

    // Real-time listener for Firebase data
    database.ref('Master_Task').on('value', snapshot => {
        rawData = snapshot.val();
        filteredData = []; // Reset filtered data before populating it again
        facilityOptions.clear();
        taskOptions.clear();
        dayOptions.clear();

        // Iterate through terms in rawData (e.g., "403")
        for (let term in rawData) {
            const termData = rawData[term];

            // Filter out null entries from the array
            termData.forEach(entry => {
                if (entry) { // Only include non-null entries
                    filteredData.push({
                        ...entry, // Spread the entry object to include all properties
                        term: term // Add the term as a field
                    });

                    // Collect facility, task, and day options for filtering
                    if (entry.Facility) facilityOptions.add(entry.Facility);
                    if (entry.Task) taskOptions.add(entry.Task);
                    if (entry.Day) dayOptions.add(entry.Day);
                }
            });
        }

        // Populate filters and display the initial data
        displayData();
        setupAutoComplete('searchFacility', 'facilitySuggestions', Array.from(facilityOptions));
        setupAutoComplete('searchTask', 'taskSuggestions', Array.from(taskOptions));
        setupAutoComplete('searchDay', 'daySuggestions', Array.from(dayOptions));
        setupAutoComplete('searchStatus', 'statusSuggestions', ["Complete", "In progress", "Released"]);
    });

    // Add a click event listener to the filter button
    const filterButton = document.getElementById('filterBtn');
    filterButton.addEventListener('click', function () {
        displayData(); // Trigger the filtering when the button is clicked
    });

// Function to display the filtered data
function displayData() {
    const searchTaskElement = document.getElementById('searchTask');
    const searchFacilityElement = document.getElementById('searchFacility');
    const searchDayElement = document.getElementById('searchDay');
    const searchStatusElement = document.getElementById('searchStatus');
    const termElement = document.getElementById('term');

    // Get the input values, trimming spaces and converting to lower case for comparison
    const searchTask = searchTaskElement ? searchTaskElement.value.toLowerCase().trim() : '';
    const searchFacility = searchFacilityElement ? searchFacilityElement.value.toLowerCase().trim() : '';
    const searchDay = searchDayElement ? searchDayElement.value.toLowerCase().trim() : '';
    const searchStatus = searchStatusElement ? searchStatusElement.value.toLowerCase().trim() : '';
    const term = termElement ? termElement.value.trim() : ''; // Don't parse to int immediately

    // Filter the data based on the search inputs
    const filtered = filteredData.filter(entry => {
        const termValue = entry.term ? entry.term.trim() : ''; // Trim spaces from Firebase term
        const facility = entry.Facility ? entry.Facility.toLowerCase().trim() : ''; // Lowercase and trim for comparison
        const task = entry.Task ? entry.Task.toLowerCase().trim() : '';
        const day = entry.Day ? entry.Day.toLowerCase().trim() : '';
        const status = calculateStatus(entry.Start, entry.End).toLowerCase().trim();

        // Facility and Term filtering
        const facilityMatch = facility.includes(searchFacility); // Matches typed facility
        const termMatch = term === '' || termValue === term; // Either matches or no filter applied

        // Other filters: task, day, status
        const taskMatch = task.includes(searchTask);
        const dayMatch = day.includes(searchDay);
        const statusMatch = status.includes(searchStatus);

        // Return true if all filters match
        return facilityMatch && termMatch && taskMatch && dayMatch && statusMatch;
    });

    updateFacilityTimers(filtered); // Update the table with the filtered data
}

function updateFacilityTimers(data) {
    const container = document.getElementById('facility-timers');
    container.innerHTML = ''; // Clear previous data

    if (data.length === 0) {
        const noDataRow = document.createElement('div');
        noDataRow.innerHTML = `<div>No Project Running</div>`;
        container.appendChild(noDataRow);
    } else {
        // Group entries by cleaned Equipment names without removing duplicates
        const groupedData = data.reduce((acc, entry) => {
            // Clean up equipment name: remove leading/trailing spaces, but keep duplicates
            const equipment = (entry.Equipment || 'Unknown Equipment').trim();
            if (!acc[equipment]) {
                acc[equipment] = [];
            }
            acc[equipment].push(entry);
            return acc;
        }, {});

        // Create an array of [equipmentName, entries] pairs
        const equipmentEntries = Object.entries(groupedData);

        // Define the status order for sorting
        const statusOrder = {
            "In progress": 1,
            "Released": 2,
            "Complete": 3
        };

        // Sort the equipment groups by status and then by the number of entries
        equipmentEntries.sort((a, b) => {
            // Get the status of the first entry for each equipment group
            const statusA = calculateStatus(a[1][0].Start, a[1][0].End);
            const statusB = calculateStatus(b[1][0].Start, b[1][0].End);

            // Compare based on status order
            if (statusOrder[statusA] !== statusOrder[statusB]) {
                return statusOrder[statusA] - statusOrder[statusB];
            }

            // If statuses are the same, sort by the number of entries (ascending)
            const countA = a[1].length; // Number of entries for equipment A
            const countB = b[1].length; // Number of entries for equipment B
            return countA - countB;
        });

        // Create containers for each equipment group
        for (let i = 0; i < equipmentEntries.length; i += 2) {
            const rowContainer = document.createElement('div');
            rowContainer.classList.add('row-container'); // Add a class for styling

            // Create two containers per row
            for (let j = 0; j < 2; j++) {
                if (i + j < equipmentEntries.length) {
                    const equipmentName = equipmentEntries[i + j][0];
                    let entries = equipmentEntries[i + j][1];

                    // Sort the entries by status within the group
                    entries.sort((a, b) => {
                        const statusA = calculateStatus(a.Start, a.End);
                        const statusB = calculateStatus(b.Start, b.End);
                        return statusOrder[statusA] - statusOrder[statusB];
                    });

                    // Calculate total project hours for this equipment group
                    const totalProjectHours = entries.reduce((total, entry) => {
                        return total + (parseFloat(entry["Project Hours"]) || 0);
                    }, 0);

                    const equipmentContainer = document.createElement('div');
                    equipmentContainer.classList.add('equipment-container'); // Add a class for styling

                    // Title including total project hours
                    const title = document.createElement('h3');
                    title.textContent = `${equipmentName} [Total Hours: ${totalProjectHours.toFixed(2)}]`;
                    equipmentContainer.appendChild(title);

                    // Table for the equipment entries
                    const table = document.createElement('table');
                    table.innerHTML = `
                        <tr>
                            <th>Product</th>
                            <th>Start</th>
                            <th>Timer</th>
                            <th>Status</th>
                            <th>Run Rate</th>
                        </tr>
                    `;
                    // Populate the table with sorted entries and apply color based on status
                    entries.forEach(entry => {
                        const status = calculateStatus(entry.Start, entry.End);
                        const startTime = entry.Start ? convertTo12HourFormat(entry.Start) : '';
                        const timer = calculateTimer(entry); // Calculate the timer based on entry

                        // Convert timer to total minutes for run rate calculation
                        const timerParts = timer.split(' ');
                        const timerHours = parseInt(timerParts[0].replace('h', ''), 10) || 0;
                        const timerMinutes = parseInt(timerParts[1].replace('m', ''), 10) || 0;
                        const timerSeconds = parseInt(timerParts[2].replace('s', ''), 10) || 0;
                        const totalTimeInMinutes = (timerHours * 60) + timerMinutes + (timerSeconds / 60); // Convert to total minutes

                        // Get the count
                        const count = parseFloat(entry["Count"] || 0);

                        // Calculate the Run Rate in items per minute
                        const runRate = totalTimeInMinutes > 0 ? (count / totalTimeInMinutes).toFixed(2) : ''; // Avoid division by zero

                        // Determine timerClass for blinking effect
                        let timerClass = '';
                        if (status === "In progress") {
                            const projectTimeInMinutes = parseFloat(entry["Project Hours"]) * 60 || 0;
                            const elapsedTimeInMinutes = totalTimeInMinutes;

                            const timeDiff = elapsedTimeInMinutes - projectTimeInMinutes;

                            if (timeDiff >= -1 && timeDiff <= 10) {
                                timerClass = 'blink-yellow'; // Blink yellow if within 10 mins
                            } else if (timeDiff >= 11 && timeDiff <= 30) {
                                timerClass = 'blink-pink'; // Blink pink-red if 11 to 30 mins
                            } else if (timeDiff > 30) {
                                timerClass = 'blink-red'; // Blink red if more than 31 mins
                            }
                        }

                        // Highlight Product cell based on status
                        let productHighlightClass = '';
                        if (status === "Complete") {
                            productHighlightClass = 'highlight-green';
                        } else if (status === "In progress") {
                            productHighlightClass = 'highlight-yellow';
                        }

                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td class="${productHighlightClass}">${entry.Product || 'N/A'}</td>
                            <td>${startTime}</td>
                            <td class="${timerClass}">${timer}</td> <!-- Apply timerClass for blinking effect -->
                            <td>${status}</td>
                            <td>${runRate} per min</td>
                        `;
                        table.appendChild(row);
                    });

                    equipmentContainer.appendChild(table);
                    rowContainer.appendChild(equipmentContainer);
                }
            }
            container.appendChild(rowContainer);
        }
    }
}

    // Function to calculate the timer based on entry
    function calculateTimer(entry) {
        const status = calculateStatus(entry.Start, entry.End);
        let timer = '00h 00m 00s'; // Default value in hh:mm:ss format

        // Only calculate the timer if there's a start time and the task is still in progress
        if (entry.Start && status === "In progress") {
            const currentTime = new Date();
            const startTimeSplit = entry.Start.split(':');
            let startHours = parseInt(startTimeSplit[0], 10);
            let startMinutes = parseInt(startTimeSplit[1], 10);

            const startDate = new Date(currentTime);
            startDate.setHours(startHours);
            startDate.setMinutes(startMinutes);
            startDate.setSeconds(0);

            // Correct for when the start date might be on a previous day
            if (startDate > currentTime) {
                startDate.setDate(startDate.getDate() - 1); // Assuming the start time was on the previous day
            }

            const elapsedMs = currentTime - startDate;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const elapsedHours = Math.floor(elapsedMinutes / 60);
            const remainingMinutes = elapsedMinutes % 60;
            const remainingSeconds = elapsedSeconds % 60;

            timer = `${String(elapsedHours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`;
        }

        // If the status is Complete, calculate the duration based on start and end times
        if (status === "Complete" && entry.Start && entry.End) {
            const startDateTime = new Date();
            const endDateTime = new Date();

            // Parsing start and end times
            const [startHours, startMinutes] = entry.Start.split(':').map(Number);
            const [endHours, endMinutes] = entry.End.split(':').map(Number);

            startDateTime.setHours(startHours, startMinutes, 0);
            endDateTime.setHours(endHours, endMinutes, 0);

            const durationMs = endDateTime - startDateTime;
            const durationSeconds = Math.floor(durationMs / 1000);
            const durationMinutes = Math.floor(durationSeconds / 60);
            const durationHours = Math.floor(durationMinutes / 60);
            const remainingMinutes = durationMinutes % 60;
            const remainingSeconds = durationSeconds % 60;

            // Format the duration as hh:mm:ss
            timer = `${String(durationHours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`;
        }

        return timer;
    }

    // Update the facility timers every second
    setInterval(() => {
        displayData(); // Re-fetch and update the data at each interval
    }, 1000); // 1000ms = 1 second

    // Function to setup autocomplete suggestions
    function setupAutoComplete(inputId, suggestionBoxId, data) {
        const input = document.getElementById(inputId);
        const suggestionBox = document.getElementById(suggestionBoxId);

        input.addEventListener('input', function () {
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

                suggestionItem.addEventListener('click', function () {
                    input.value = suggestion;
                    suggestionBox.style.display = 'none';
                });
            });
        });

        input.addEventListener('focus', function () {
            const uniqueData = [...new Set(data)];
            suggestionBox.innerHTML = '';
            uniqueData.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.textContent = suggestion;
                suggestionBox.appendChild(suggestionItem);

                suggestionItem.addEventListener('click', function () {
                    input.value = suggestion;
                    suggestionBox.style.display = 'none';
                });
            });
            suggestionBox.style.display = 'block';
        });

        document.addEventListener('click', function (event) {
            if (!input.contains(event.target) && !suggestionBox.contains(event.target)) {
                suggestionBox.style.display = 'none';
            }
        });
    }
});
