/*========================================================
 |  air.js (Keep your original code, plus new highlights)
 *=======================================================*/
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
        if (!time) return "";
        let [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12; // Convert hour '0' to '12'
        return `${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
    }

    // Function to calculate the timer based on entry
    function calculateTimer(entry) {
        const status = calculateStatus(entry.Start, entry.End);
        let timer = '00h 00m 00s'; // Default value in hh:mm:ss format

        if (entry.Start && status === "In progress") {
            const currentTime = new Date();
            const [startHours, startMinutes] = entry.Start.split(':').map(Number);

            const startDate = new Date(currentTime);
            startDate.setHours(startHours, startMinutes, 0, 0);

            // Adjust for previous day if start time is in the future
            if (startDate > currentTime) {
                startDate.setDate(startDate.getDate() - 1);
            }

            const elapsedMs = currentTime - startDate;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            const elapsedHours = Math.floor(elapsedMinutes / 60);
            const remainingMinutes = elapsedMinutes % 60;
            const remainingSeconds = elapsedSeconds % 60;

            timer = `${String(elapsedHours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`;
        }

        if (status === "Complete" && entry.Start && entry.End) {
            const startDateTime = new Date();
            const endDateTime = new Date();

            const [startHours, startMinutes] = entry.Start.split(':').map(Number);
            const [endHours, endMinutes] = entry.End.split(':').map(Number);

            startDateTime.setHours(startHours, startMinutes, 0, 0);
            endDateTime.setHours(endHours, endMinutes, 0, 0);

            const durationMs = endDateTime - startDateTime;
            const durationSeconds = Math.floor(durationMs / 1000);
            const durationMinutes = Math.floor(durationSeconds / 60);
            const durationHours = Math.floor(durationMinutes / 60);
            const remainingMinutes = durationMinutes % 60;
            const remainingSeconds = durationSeconds % 60;

            timer = `${String(durationHours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m ${String(remainingSeconds).padStart(2, '0')}s`;
        }

        return timer;
    }

    /**
     * Compares two entries based on Priority, Start_time, and Product.
     * @param {Object} a - The first entry to compare.
     * @param {Object} b - The second entry to compare.
     * @returns {number} - Returns -1 if a < b, 1 if a > b, 0 if equal.
     */
    function compareEntries(a, b) {
        // Compare Priority
        const priorityA = a.Priority !== undefined ? a.Priority : Number.MAX_SAFE_INTEGER; // Entries without Priority are considered lowest
        const priorityB = b.Priority !== undefined ? b.Priority : Number.MAX_SAFE_INTEGER;

        if (priorityA < priorityB) return -1;
        if (priorityA > priorityB) return 1;

        // Compare Start_time (Start)
        const startA = a.Start || "";
        const startB = b.Start || "";

        if (startA && startB) {
            if (startA < startB) return -1;
            if (startA > startB) return 1;
        } else if (startA && !startB) {
            return -1; // a comes before b
        } else if (!startA && startB) {
            return 1; // b comes before a
        }

        // Compare Product
        const productA = a.Product || "";
        const productB = b.Product || "";

        return productA.localeCompare(productB);
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

    // Enhanced Function to update facility timers with blinking and highlighting
    function updateFacilityTimers(data) {
        const container = document.getElementById('facility-timers');
        container.innerHTML = ''; // Clear previous data

        if (data.length === 0) {
            const noDataRow = document.createElement('div');
            noDataRow.innerHTML = `<div>No Project Running</div>`;
            container.appendChild(noDataRow);
        } else {
            // Group entries by Equipment
            const groupedData = data.reduce((acc, entry) => {
                const equipment = (entry.Equipment || 'Unknown Equipment').trim();
                if (!acc[equipment]) {
                    acc[equipment] = [];
                }
                acc[equipment].push(entry);
                return acc;
            }, {});

            const equipmentEntries = Object.entries(groupedData);

            // Define the status order for sorting Equipment groups
            const statusOrder = {
                "In progress": 1,
                "Released": 2,
                "Complete": 3
            };

            // Sort the Equipment groups by status and then by the number of entries
            equipmentEntries.sort((a, b) => {
                const statusA = calculateStatus(a[1][0].Start, a[1][0].End);
                const statusB = calculateStatus(b[1][0].Start, b[1][0].End);

                if (statusOrder[statusA] !== statusOrder[statusB]) {
                    return statusOrder[statusA] - statusOrder[statusB];
                }

                return a[1].length - b[1].length;
            });

            // Create containers for each Equipment group
            for (let i = 0; i < equipmentEntries.length; i += 3) { // Adjust based on desired layout
                const rowContainer = document.createElement('div');
                rowContainer.classList.add('row-container');

                for (let j = 0; j < 3; j++) { // Number of Equipment per row
                    if (i + j < equipmentEntries.length) {
                        const equipmentName = equipmentEntries[i + j][0];
                        let entries = equipmentEntries[i + j][1];

                        // Sort entries within the Equipment group using the compareEntries function
                        entries.sort(compareEntries);

                        // Calculate total project hours
                        const totalProjectHours = entries.reduce((total, entry) => {
                            return total + (parseFloat(entry["Project Hours"]) || 0);
                        }, 0);

                        const equipmentContainer = document.createElement('div');
                        equipmentContainer.classList.add('equipment-container');

                        // Equipment Title
                        const title = document.createElement('h3');
                        title.textContent = `${equipmentName} [Total Hours: ${totalProjectHours.toFixed(2)}]`;
                        equipmentContainer.appendChild(title);

                        // Create Table
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

                        // Populate Table Rows
                        entries.forEach(entry => {
                            const status = calculateStatus(entry.Start, entry.End);
                            const startTime = entry.Start ? convertTo12HourFormat(entry.Start) : '';
                            const timer = calculateTimer(entry);

                            // Calculate Run Rate
                            const timerParts = timer.split(' ');
                            const timerHours = parseInt(timerParts[0].replace('h', ''), 10) || 0;
                            const timerMinutes = parseInt(timerParts[1].replace('m', ''), 10) || 0;
                            const timerSeconds = parseInt(timerParts[2].replace('s', ''), 10) || 0;
                            const totalTimeInMinutes = (timerHours * 60) + timerMinutes + (timerSeconds / 60);

                            const count = parseFloat(entry["Count"] || 0);
                            const runRate = totalTimeInMinutes > 0 ? (count / totalTimeInMinutes).toFixed(2) : '';

                            // Determine Timer Class for Blinking
                            let timerClass = '';
                            if (status === "In progress") {
                                const projectTimeInMinutes = parseFloat(entry["Project Hours"]) * 60 || 0;
                                const elapsedTimeInMinutes = totalTimeInMinutes;
                                const timeDiff = elapsedTimeInMinutes - projectTimeInMinutes;

                                if (timeDiff >= -1 && timeDiff <= 10) {
                                    timerClass = 'blink-yellow';
                                } else if (timeDiff >= 11 && timeDiff <= 30) {
                                    timerClass = 'blink-pink';
                                } else if (timeDiff > 30) {
                                    timerClass = 'blink-red';
                                }
                            }

                            // Determine Highlight Class for Product Cell
                            let productHighlightClass = '';
                            if (status === "Complete") {
                                productHighlightClass = 'highlight-green';  // Product column = green
                            } else if (status === "In progress") {
                                productHighlightClass = 'highlight-yellow'; // Product column = yellow
                            }
                            // No highlighting for "Released"

                            // Create Table Row
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td class="${productHighlightClass}">${entry.Product || ''}</td>
                                <td>${startTime}</td>
                                <td class="${timerClass}">${timer}</td>
                                <td>${status}</td>
                                <td>${runRate} per min</td>
                            `;

                            // NEW: We need timeDiff for the highlight logic below
                            const projectTimeInMinutes = parseFloat(entry["Project Hours"]) * 60 || 0;
                            const elapsedTimeInMinutes = totalTimeInMinutes; // same as above
                            const timeDiff = elapsedTimeInMinutes - projectTimeInMinutes;

                            // NEW: If timeDiff < 0 => entire row highlight-green
                            if (timeDiff < 0) {
                                row.classList.add('highlight-green');
                            }

                            // NEW: If status = "Complete" AND timeDiff > 1 => highlight Start, Timer, Status, Run Rate in light orange
                            if (status === "Complete" && timeDiff > 1) {
                                // columns: 0=Product, 1=Start, 2=Timer, 3=Status, 4=Run Rate
                                row.children[1].classList.add('highlight-orange'); // Start
                                row.children[2].classList.add('highlight-orange'); // Timer
                                row.children[3].classList.add('highlight-orange'); // Status
                                row.children[4].classList.add('highlight-orange'); // Run Rate
                            }

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
