if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

document.addEventListener("DOMContentLoaded", async function () {
    const employeeTable = document.getElementById("employee-table").querySelector("tbody");
    const facilityFilterSelect = document.getElementById("facility-filter");
    const searchBar = document.getElementById("search-bar");
    const sortBySelect = document.getElementById("sort-by");
    const sortOrderSelect = document.getElementById("sort-order");

    let allNotes = [];
    let sortDirection = {};

    const notesPointsMap = {
        "No Call/No Show":4,
        "Called out after start of shift":4,
        "Callout":2,
        "Tardy less than 1 hour":0.5,
        "Tardy more than 1 hour":1,
        "Left early - worked less than half of their shift":2,
        "Left early - worked more than half of their shift":1,
        "Rollback":"*", // We'll assign the actual rollback value dynamically
        "Bereavement":0,
        "Verbal":"*",
        "Dr Notes":"*",
        "Written":"*",
        "Final":"*",
        "Returned late from lunch":0.5,
        "Left and returned less than 1 hour later":0.5,
        "Left and returned between 1 and 2 hours later":0.5,
        "Left and returned more than 2 hours later":1,
        "Callout (Sick Time)":0
    };

    async function fetchData() {
        const [employeeSnap, notesSnap] = await Promise.all([
            db.ref("Employee").once("value"),
            db.ref("Employee_Note").once("value")
        ]);

        const employees = employeeSnap.val() || {};
        const notesData = notesSnap.val() || {};

        const employeeMap = {};
        const facilitiesSet = new Set();

        for (const key in employees) {
            const emp = employees[key];
            const employeeId = emp.ID || "";
            employeeMap[employeeId] = emp;
            facilitiesSet.add(emp.Facility || "Unknown");
        }

        allNotes = [];
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

        populateFacilityFilter(Array.from(facilitiesSet));

        insertRollbacks();

        renderTable(allNotes);
    }

    function populateFacilityFilter(facilities) {
        facilities.sort();
        facilities.forEach((fac) => {
            const option = document.createElement("option");
            option.value = fac;
            option.textContent = fac;
            facilityFilterSelect.appendChild(option);
        });
    }

    function insertRollbacks() {
        // Group by ID
        const groups = {};
        allNotes.forEach(item => {
            if (!groups[item.ID]) groups[item.ID] = [];
            groups[item.ID].push(item);
        });

        let newAllNotes = [];

        for (const id in groups) {
            let events = groups[id];
            // Sort by date
            events.sort((a,b) => a.dateValue - b.dateValue);

            let finalEvents = [];
            let lastPositiveDate = null;
            let currentTotalPoints = 0; // track cumulative points over time

            // First pass: calculate currentTotalPoints after each event
            // Actually, we can insert rollbacks on the fly.
            for (let i = 0; i < events.length; i++) {
                let ev = events[i];

                // Before processing this event, check if we need to insert rollbacks
                if (lastPositiveDate !== null) {
                    let rollbackDate = addOneMonth(lastPositiveDate);
                    while (rollbackDate < ev.dateValue) {
                        // Attempt a rollback
                        // Determine how much we can roll back:
                        // - If currentTotalPoints <=0, no rollback (no points to remove)
                        if (currentTotalPoints <= 0) break;

                        let rollbackAmount = -2;
                        if (currentTotalPoints < 2) {
                            // roll back only as many points as available
                            rollbackAmount = -currentTotalPoints;
                        }

                        finalEvents.push(createRollbackEvent(ev, rollbackDate, rollbackAmount));
                        currentTotalPoints += rollbackAmount; // rollbackAmount is negative
                        lastPositiveDate = rollbackDate; 
                        rollbackDate = addOneMonth(lastPositiveDate);
                    }
                }

                // Now process the current event
                finalEvents.push(ev);
                if (typeof ev.Points === "number") {
                    currentTotalPoints += ev.Points;
                    if (ev.Points > 0) {
                        lastPositiveDate = ev.dateValue;
                    }
                }
            }

            // After last event, we do not insert future rollbacks as per the requirement

            // Sort again (in case rollbacks were inserted)
            finalEvents.sort((a,b) => a.dateValue - b.dateValue);
            newAllNotes.push(...finalEvents);
        }

        allNotes = newAllNotes;
    }

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

    function addOneMonth(date) {
        const d = new Date(date.getTime());
        const month = d.getMonth() + 1;
        d.setMonth(month);
        return d;
    }

    function formatDate(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth()+1).padStart(2,'0');
        const d = String(dateObj.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
    }

    function renderTable(data) {
        employeeTable.innerHTML = "";
        const filtered = applyFilters(data);

        // Group by ID
        const groups = {};
        filtered.forEach(item => {
            if (!groups[item.ID]) groups[item.ID] = [];
            groups[item.ID].push(item);
        });

        // For each group, sort by date
        for (const id in groups) {
            groups[id].sort((a,b) => a.dateValue - b.dateValue);
        }

        // Determine sort by groups
        const sortBy = sortBySelect.value; 
        const sortOrder = sortOrderSelect.value; 

        // Build group array for sorting
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

            // Ensure sumPoints never goes below 0 (it shouldn't now)
            if (sumPoints < 0) sumPoints = 0;

            let finalPoints = hasNumeric ? sumPoints : "N/A";
            let earliestDate = items.length > 0 ? items[0].dateValue : null;
            return {
                ID: id,
                items: items,
                firstName: items[0].firstNameRaw,
                pointsSum: finalPoints,
                earliestDate: earliestDate
            };
        });

        // Sort groups
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

        // Render groups
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

            // After printing group's items: print total points row first, then empty line
            const sumRow = document.createElement("tr");
            sumRow.className = "summary-row";
            sumRow.innerHTML = `
                <td colspan="4" style="text-align:right;">Total Points:</td>
                <td>${group.pointsSum}</td>
            `;
            employeeTable.appendChild(sumRow);

            const emptyRow = document.createElement("tr");
            emptyRow.className = "empty-row";
            emptyRow.innerHTML = `<td colspan="5"></td>`;
            employeeTable.appendChild(emptyRow);
        });
    }

    function applyFilters(data) {
        const selectedFacility = facilityFilterSelect.value;
        const searchTerm = searchBar.value.trim().toLowerCase();

        let result = data;

        // Filter by facility
        if (selectedFacility && selectedFacility !== "All") {
            result = result.filter(item => (item.Facility || "Unknown") === selectedFacility);
        }

        // Search by ID, firstName, lastName
        if (searchTerm) {
            result = result.filter(item =>
                item.employeeId.includes(searchTerm) ||
                item.firstName.includes(searchTerm) ||
                item.lastName.includes(searchTerm)
            );
        }

        return result;
    }

    // Thead click sorting (optional)
    const thead = document.querySelector("#employee-table thead");
    thead.addEventListener("click", (event) => {
        const th = event.target.closest("th");
        if (!th) return;
        const key = th.getAttribute("data-key");
        if (!key) return;

        sortDirection[key] = !sortDirection[key];
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

        renderTable(dataToSort);
    });

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

    fetchData();
});
