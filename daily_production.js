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

    // Set default values for 'Term' and 'Day' when the page loads
    document.getElementById('term').value = "403"; // Set default term to 403
    document.getElementById('searchDay').value = "Sunday"; // Set default day to Sunday

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

    // Custom sorting order for status
    const statusOrder = {
        "in progress": 1,
        "shorts": 2,
        "released": 3,
        "complete": 4
    };

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

    // Sort the filtered data by custom status order, with equipment sorting as a secondary criterion
    const sortedData = filtered.sort((a, b) => {
        const statusA = calculateStatus(a.Start, a.End).toLowerCase().trim();
        const statusB = calculateStatus(b.Start, b.End).toLowerCase().trim();

        const orderA = statusOrder[statusA] || 5; // Default to a larger number if status is not found
        const orderB = statusOrder[statusB] || 5;

        // First, sort by custom status order
        if (orderA !== orderB) {
            return orderA - orderB;
        }

        // If statuses are the same, sort by Equipment alphabetically
        const equipmentA = a.Equipment ? a.Equipment.toLowerCase().trim() : '';
        const equipmentB = b.Equipment ? b.Equipment.toLowerCase().trim() : '';
        
        return equipmentA.localeCompare(equipmentB);
    });

    updateFacilityTimers(sortedData); // Update the table with the sorted, filtered data
}



function updateFacilityTimers(data) {
    const tbody = document.getElementById('facility-timers');
    tbody.innerHTML = ''; // Clear previous data

    if (data.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `<td colspan="8">No Project Running</td>`;
        tbody.appendChild(noDataRow);
    } else {
        data.forEach(entry => {
            const row = document.createElement('tr');

            const projectHours = parseFloat(entry["Project Hours"] || 0); // Use entry["Project Hours"]
            const hours = Math.floor(projectHours);
            const minutes = Math.round((projectHours - hours) * 60);
            const formattedProjectHours = `${hours}h ${minutes}m`;

            const status = calculateStatus(entry.Start, entry.End);

            // Convert start and end times to 12-hour format with AM/PM
            const startTime = entry.Start ? convertTo12HourFormat(entry.Start) : '';
            const endTime = entry.End ? convertTo12HourFormat(entry.End) : '';

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

            // Set the blinking behavior based on the difference between Project Hours and Timer (only for in-progress tasks)
            let timerClass = '';
            if (status === "In progress") {
                const projectTimeInMinutes = (hours * 60) + minutes;
                const timerParts = timer.split(' ');
                const timerHours = parseInt(timerParts[0].replace('h', ''), 10);
                const timerMinutes = parseInt(timerParts[1].replace('m', ''), 10);
                const timerSeconds = parseInt(timerParts[2].replace('s', ''), 10);
                const elapsedTimeInMinutes = (timerHours * 60) + timerMinutes;

                const timeDiff = elapsedTimeInMinutes - projectTimeInMinutes;

                if (timeDiff >= -1 && timeDiff <= 10) {
                    timerClass = 'blink-yellow'; // Blink yellow if within 10 mins
                } else if (timeDiff >= 11 && timeDiff <= 30) {
                    timerClass = 'blink-pink'; // Blink pink-red if 11 to 30 mins
                } else if (timeDiff > 30) {
                    timerClass = 'blink-red'; // Blink red if more than 31 mins
                }
            }

            // Highlighting logic based on status
            let productClass = ''; // Class for column 3 (Product)
            if (status === "In progress") {
                productClass = 'highlight-yellow'; // Light yellow for "In progress"
            } else if (status === "Shorts") {
                productClass = 'highlight-red'; // Red for "Shorts"
            } else if (status === "Complete") {
                productClass = 'highlight-green'; // Green for "Complete"
            }

            row.innerHTML = `
                <td>${entry.Task || 'N/A'}</td>
                <td>${entry.Equipment || 'N/A'}</td>
                <td class="${productClass}">${entry.Product || 'N/A'}</td> <!-- Highlidght the Product column -->
                <td class="project-hours">${formattedProjectHours}</td>
                <td>${startTime}</td>
                <td class="timer-cell ${timerClass}">${timer}</td>
                <td>${endTime}</td>
                <td>${status}</td>
            `;
            tbody.appendChild(row);
        });
    }
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
