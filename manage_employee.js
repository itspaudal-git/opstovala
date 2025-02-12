if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

document.addEventListener("DOMContentLoaded", function () {
    // Get references to DOM elements
    const employeeTable = document.getElementById("employee-table").querySelector("tbody");
    const facilityFilterSelect = document.getElementById("facility-filter");
    const searchBar = document.getElementById("search-bar");
    const sortBySelect = document.getElementById("sort-by");
    const sortOrderSelect = document.getElementById("sort-order");
    
    // In-memory storage of Employees and Notes from Firebase
    let employees = {};
    let notesData = {};
    // Combined list after merging employees + notes
    let allNotes = [];

    // For table sorting by clicking on <th>
    let sortDirection = {};

    // Points map for different notes
    const notesPointsMap = {
        "No Call/No Show": 4,
        "Called out after start of shift": 4,
        "Callout": 2,
        "Tardy less than 1 hour": 0.5,
        "Tardy more than 1 hour": 1,
        "Left early - worked less than half of their shift": 2,
        "Left early - worked more than half of their shift": 1,
        "Rollback": "*", // We'll assign negative values dynamically
        "Bereavement": 0,
        "Verbal": "*",
        "Dr Notes": "*",
        "Written": "*",
        "Final": "*",
        "Returned late from lunch": 0.5,
        "Left and returned less than 1 hour later": 0.5,
        "Left and returned between 1 and 2 hours later": 0.5,
        "Left and returned more than 2 hours later": 1,
        "Callout (Sick Time)": 0
    };

    // Attach real-time listeners to Firebase Realtime Database
    const employeesRef = db.ref("Employee");
    const notesRef = db.ref("Employee_Note");

    // Listen for changes in Employee data
    employeesRef.on("value", (snapshot) => {
        employees = snapshot.val() || {};
        updateAllNotesAndRender();
    });

    // Listen for changes in Employee_Note data
    notesRef.on("value", (snapshot) => {
        notesData = snapshot.val() || {};
        updateAllNotesAndRender();
    });

    /**
     * Merge employees + notes into allNotes,
     * insert rollbacks, populate facility dropdown,
     * and then render the table.
     */
    function updateAllNotesAndRender() {
        allNotes = [];

        // We need at least something in employees/notesData to proceed
        // (If either is empty, we just end up rendering an empty table or partial data).
        const employeeMap = {};
        const facilitiesSet = new Set();

        // Build a quick map (ID => employee obj)
        for (const key in employees) {
            const emp = employees[key];
            const employeeId = emp.ID || "";
            employeeMap[employeeId] = emp;
            facilitiesSet.add(emp.Facility || "Unknown");
        }

        // Merge notes with employee data
        for (const noteKey in notesData) {
            const noteRecord = notesData[noteKey];
            const { ID, date, notes } = noteRecord;
            if (!ID || !date) continue;

            const emp = employeeMap[ID];
            if (!emp) continue;

            const firstName = emp["First Name"] || "";
            const lastName = emp["Last Name"] || "";
            const facility = emp.Facility || "Unknown";

            let points = "N/A";
            if (notesPointsMap.hasOwnProperty(notes)) {
                points = notesPointsMap[notes];
            }

            allNotes.push({
                ID: ID,
                Name: `${firstName} ${lastName}`,
                Date: date,
                Notes: notes,
                Points: points,
                Facility: facility,
                firstNameRaw: firstName,
                lastNameRaw: lastName,
                firstName: firstName.toLowerCase(),
                lastName: lastName.toLowerCase(),
                employeeId: ID.toLowerCase(),
                dateValue: new Date(date)
            });
        }

        // Populate the facility filter dropdown each time
        populateFacilityFilter(Array.from(facilitiesSet));

        // Insert rollback events
        insertRollbacks();

        // Finally, render the table with the updated allNotes
        renderTable(allNotes);
    }

    /**
     * Populate the facility <select> with given facilities.
     */
    function populateFacilityFilter(facilities) {
        // Clear out existing options
        facilityFilterSelect.innerHTML = "";
        // Always include an "All" option
        const allOption = document.createElement("option");
        allOption.value = "All";
        allOption.textContent = "All";
        facilityFilterSelect.appendChild(allOption);

        facilities.sort();
        facilities.forEach((fac) => {
            const option = document.createElement("option");
            option.value = fac;
            option.textContent = fac;
            facilityFilterSelect.appendChild(option);
        });
    }

    /**
     * Insert rollback events for each employee group based on the 1-month rule
     * and adjusting cumulative points by 2, as needed.
     */
    function insertRollbacks() {
        // Group notes by employee ID
        const groups = {};
        allNotes.forEach(item => {
            if (!groups[item.ID]) groups[item.ID] = [];
            groups[item.ID].push(item);
        });

        let newAllNotes = [];

        // Process each employee's events
        for (const id in groups) {
            let events = groups[id];
            // Sort them by date ascending
            events.sort((a, b) => a.dateValue - b.dateValue);

            let finalEvents = [];
            let lastPositiveDate = null;
            let currentTotalPoints = 0;

            for (let i = 0; i < events.length; i++) {
                let ev = events[i];

                // Insert rollbacks in the gaps between lastPositiveDate and this event's date
                if (lastPositiveDate !== null) {
                    let rollbackDate = addOneMonth(lastPositiveDate);
                    while (rollbackDate < ev.dateValue) {
                        if (currentTotalPoints <= 0) {
                            // No points to roll back
                            break;
                        }
                        let rollbackAmount = -2;
                        if (currentTotalPoints < 2) {
                            // Only roll back what's available if less than 2
                            rollbackAmount = -currentTotalPoints;
                        }

                        finalEvents.push(createRollbackEvent(ev, rollbackDate, rollbackAmount));
                        currentTotalPoints += rollbackAmount; // rollbackAmount is negative
                        lastPositiveDate = rollbackDate;
                        // Move to the next month
                        rollbackDate = addOneMonth(lastPositiveDate);
                    }
                }

                // Add the current event
                finalEvents.push(ev);
                if (typeof ev.Points === "number") {
                    currentTotalPoints += ev.Points;
                    if (ev.Points > 0) {
                        lastPositiveDate = ev.dateValue;
                    }
                }
            }

            // No future rollbacks after the last event

            // Sort finalEvents (since we may have inserted rollbacks in the middle)
            finalEvents.sort((a, b) => a.dateValue - b.dateValue);

            // Combine them in the master list
            newAllNotes.push(...finalEvents);
        }

        // Replace allNotes with the new list that includes rollbacks
        allNotes = newAllNotes;
    }

    /**
     * Create a rollback event object based on a reference event.
     */
    function createRollbackEvent(referenceEvent, dateObj, amount) {
        return {
            ID: referenceEvent.ID,
            Name: referenceEvent.Name,
            Date: formatDate(dateObj),
            Notes: "Rollback",
            Points: amount, // negative or adjusted rollback
            Facility: referenceEvent.Facility,
            firstNameRaw: referenceEvent.firstNameRaw,
            lastNameRaw: referenceEvent.lastNameRaw,
            firstName: referenceEvent.firstName,
            lastName: referenceEvent.lastName,
            employeeId: referenceEvent.employeeId,
            dateValue: new Date(dateObj)
        };
    }

    /**
     * Utility: adds one month to a given date.
     */
    function addOneMonth(date) {
        const d = new Date(date.getTime());
        d.setMonth(d.getMonth() + 1);
        return d;
    }

    /**
     * Utility: format date as yyyy-mm-dd string.
     */
    function formatDate(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Render the table rows (with rollbacks, totals, etc.).
     */
    function renderTable(data) {
        // Clear existing rows
        employeeTable.innerHTML = "";

        // First, apply the facility & search filters
        const filtered = applyFilters(data);

        // Group the filtered data by employee ID
        const groups = {};
        filtered.forEach(item => {
            if (!groups[item.ID]) groups[item.ID] = [];
            groups[item.ID].push(item);
        });

        // Sort each group by date ascending
        for (const id in groups) {
            groups[id].sort((a, b) => a.dateValue - b.dateValue);
        }

        // Now we need to build a group array for sorting by (Name, Points, or Date)
        let groupArray = Object.keys(groups).map(id => {
            const items = groups[id];
            let sumPoints = 0;
            let hasNumeric = false;

            items.forEach(it => {
                if (typeof it.Points === "number") {
                    sumPoints += it.Points;
                    hasNumeric = true;
                }
            });
            // Make sure sumPoints doesn't go below 0
            if (sumPoints < 0) sumPoints = 0;

            return {
                ID: id,
                items: items,
                firstName: items[0].firstNameRaw,
                pointsSum: hasNumeric ? sumPoints : "N/A",
                earliestDate: items.length > 0 ? items[0].dateValue : null
            };
        });

        // Determine user-selected sort
        const sortBy = sortBySelect.value;
        const sortOrder = sortOrderSelect.value;

        // Sort the entire group array
        groupArray.sort((a, b) => {
            let valA, valB;

            if (sortBy === "FirstName") {
                valA = a.firstName.toLowerCase();
                valB = b.firstName.toLowerCase();
            } else if (sortBy === "Points") {
                valA = (typeof a.pointsSum === "number") ? a.pointsSum : -Infinity;
                valB = (typeof b.pointsSum === "number") ? b.pointsSum : -Infinity;
            } else if (sortBy === "Date") {
                valA = a.earliestDate ? a.earliestDate.getTime() : Infinity;
                valB = b.earliestDate ? b.earliestDate.getTime() : Infinity;
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });

        // Render each group's items
        groupArray.forEach(group => {
            group.items.forEach(item => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${item.ID}</td>
                    <td>${item.Name}</td>
                    <td>${item.Date}</td>
                    <td>${item.Notes}</td>
                    <td>${item.Points}</td>
                `;
                employeeTable.appendChild(row);
            });

            // Summary row (total points)
            const sumRow = document.createElement("tr");
            sumRow.className = "summary-row";
            sumRow.innerHTML = `
                <td colspan="4" style="text-align:right;">Total Points:</td>
                <td>${group.pointsSum}</td>
            `;
            employeeTable.appendChild(sumRow);

            // Empty spacer row
            const emptyRow = document.createElement("tr");
            emptyRow.className = "empty-row";
            emptyRow.innerHTML = `<td colspan="5"></td>`;
            employeeTable.appendChild(emptyRow);
        });
    }

    /**
     * Filter the data by selected facility and search term.
     */
    function applyFilters(data) {
        const selectedFacility = facilityFilterSelect.value;
        const searchTerm = searchBar.value.trim().toLowerCase();

        let result = data;

        // Filter by facility (if not "All")
        if (selectedFacility && selectedFacility !== "All") {
            result = result.filter(item => (item.Facility || "Unknown") === selectedFacility);
        }

        // Filter by search term (ID, first name, or last name)
        if (searchTerm) {
            result = result.filter(item =>
                item.employeeId.includes(searchTerm) ||
                item.firstName.includes(searchTerm) ||
                item.lastName.includes(searchTerm)
            );
        }

        return result;
    }

    /**
     * Click-to-sort on table headers (optional, if you want that feature).
     */
    const thead = document.querySelector("#employee-table thead");
    thead.addEventListener("click", (event) => {
        const th = event.target.closest("th");
        if (!th) return;
        const key = th.getAttribute("data-key");
        if (!key) return;

        // Toggle sort direction
        sortDirection[key] = !sortDirection[key];
        
        // Sort only the filtered data
        const dataToSort = applyFilters(allNotes).slice();

        dataToSort.sort((a, b) => {
            let valueA = a[key];
            let valueB = b[key];
            if (typeof valueA === "string") valueA = valueA.toLowerCase();
            if (typeof valueB === "string") valueB = valueB.toLowerCase();

            if (valueA < valueB) return sortDirection[key] ? -1 : 1;
            if (valueA > valueB) return sortDirection[key] ? 1 : -1;
            return 0;
        });

        // Re-render with newly sorted data
        renderTable(dataToSort);
    });

    // Attach filter/sort event listeners
    facilityFilterSelect.addEventListener("change", () => {
        renderTable(allNotes);
    });

    searchBar.addEventListener("input", () => {
        renderTable(allNotes);
    });

    sortBySelect.addEventListener("change", () => {
        renderTable(allNotes);
    });

    sortOrderSelect.addEventListener("change", () => {
        renderTable(allNotes);
    });
});
