if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.database();
  
  document.addEventListener("DOMContentLoaded", function () {
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const employeeTable = document.getElementById("employee-table").querySelector("tbody");
    const departmentSummary = document.getElementById("department-summary");
    const positionSummary = document.getElementById("position-summary");
    const previousBtn = document.getElementById("previous-btn");
    const nextBtn = document.getElementById("next-btn");
    const showOffCheckbox = document.getElementById("show-off-checkbox");
    const showNotesCheckbox = document.getElementById("show-notes-checkbox");
    const searchBar = document.getElementById("search-bar");
    const totalsSummary = document.getElementById("totals-summary");
    const facilityFilterSelect = document.getElementById("facility-filter");
    const copyNamesBtn = document.getElementById("copy-names-btn"); // New button reference
    let contextMenu;
    let allEmployees = [];
    let sortDirection = {};
    let employeeNotesData = {};
  
    // Predefined notes
    const predefinedNotes = [
        "No Call/No Show",
        "Called out after start of shift",
        "Callout",
        "Tardy less than 1 hour",
        "Tardy more than 1 hour",
        "Left early - worked less than half of their shift",
        "Left early - worked more than half of their shift",
        "Rollback",
        "Bereavement",
        "Verbal",
        "Written",
        "Final",
        "Dr Notes",
        "Returned late from lunch",
        "Left and returned less than 1 hour later",
        "Left and returned between 1 and 2 hours later",
        "Left and returned more than 2 hours later",
        "Callout (Sick Time)",
        "Custom"
    ];
  
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
  
    function updateDates() {
        const now = new Date();
        const currentDate = new Date(now);
        startDateInput.value = formatDate(currentDate);
        endDateInput.value = formatDate(currentDate);
    }
  
    function scheduleMidnightUpdate() {
        const now = new Date();
        const timeToMidnight =
            new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
                0,
                0,
                0
            ).getTime() - now.getTime();
  
        setTimeout(() => {
            updateDates();
            updateTable();
            scheduleMidnightUpdate();
        }, timeToMidnight);
    }
  
    updateDates();
    scheduleMidnightUpdate();
  
    function populateFacilityFilter(facilities) {
        while (facilityFilterSelect.options.length > 1) {
            facilityFilterSelect.remove(1);
        }
  
        facilities.forEach(fac => {
            const option = document.createElement("option");
            option.value = fac;
            option.textContent = fac;
            facilityFilterSelect.appendChild(option);
        });
    }
  
    function fetchEmployeesForRange(startDateStr, endDateStr) {
        const daysInRange = getDaysInRange(startDateStr, endDateStr);
        const selectedDays = daysInRange.map((d) => d.day);
  
        const statusPromises = [
            db.ref("Time_off").once("value"),
            db.ref("Late").once("value"),
            db.ref("Early").once("value"),
            db.ref("Volunteer").once("value"),
            db.ref("Absent").once("value"),
            db.ref("Employee_Note").once("value")
        ];
  
        Promise.all(statusPromises)
            .then((statusSnapshots) => {
                const timeOffData = statusSnapshots[0].val() || {};
                const lateData = statusSnapshots[1].val() || {};
                const earlyData = statusSnapshots[2].val() || {};
                const volunteerData = statusSnapshots[3].val() || {};
                const absentData = statusSnapshots[4].val() || {};
                const notesData = statusSnapshots[5].val() || {};
  
                employeeNotesData = {};
                for (const key in notesData) {
                    const noteRecord = notesData[key];
                    const { ID, date, notes } = noteRecord;
                    if (!ID || !date) continue;
                    if (!employeeNotesData[ID]) {
                        employeeNotesData[ID] = {};
                    }
                    if (!employeeNotesData[ID][date]) {
                        employeeNotesData[ID][date] = [];
                    }
                    employeeNotesData[ID][date].push(notes);
                }
  
                db.ref("Employee")
                    .once("value")
                    .then((snapshot) => {
                        const employees = snapshot.val();
                        const filteredEmployees = [];
                        const departmentCounts = {};
                        const positionCounts = {};
                        const employeesByDepartment = { Total: [] };
                        const employeesByPosition = { Total: [] };
                        const departmentHours = {};
                        const facilitiesSet = new Set();
  
                        const selectedFacility = facilityFilterSelect.value || "All";
  
                        for (const key in employees) {
                            const employee = employees[key];
                            const employeeId = employee.ID || "";
                            const empFacility = employee.Facility || "Unknown";
                            facilitiesSet.add(empFacility);
  
                            if (selectedFacility !== "All" && empFacility !== selectedFacility) {
                                continue;
                            }
  
                            // FIX: Append "_St" to day keys when fetching schedule from Firebase.
                            const schedule = selectedDays.reduce((schedule, day, index) => {
                                const dateObj = daysInRange[index];
                                const dateStr = dateObj.dateStr;
                                const status = getStatusForEmployeeOnDate(
                                    employeeId,
                                    timeOffData,
                                    lateData,
                                    earlyData,
                                    volunteerData,
                                    absentData,
                                    dateStr
                                );
  
                                // Changed employee[day] to employee[day + "_St"] because the day keys in Firebase have "_St" appended.
                                let scheduleText = employee[day + "_St"] || "Off";
  
                                if (status === "Request Off" || status === "Absent") {
                                    scheduleText = "Off";
                                }
  
                                if (status && status !== "Request Off" && status !== "Absent") {
                                    scheduleText += ` (${status})`;
                                }
  
                                schedule[day] = scheduleText;
                                return schedule;
                            }, {});
  
                            const overallStatus = getOverallStatusForEmployee(employeeId, timeOffData, lateData, earlyData, volunteerData, absentData, daysInRange);
  
                            const worksOnDays = selectedDays.some(
                                (day) => {
                                    const sched = schedule[day] || "Off";
                                    return sched.toLowerCase() !== "off";
                                }
                            );
  
                            if (showOffCheckbox.checked || worksOnDays) {
                                filteredEmployees.push({
                                    id: employeeId,
                                    department: employee.Department,
                                    position: employee.Position,
                                    facility: empFacility,
                                    firstName: employee["First Name"],
                                    lastName: employee["Last Name"],
                                    schedule: schedule,
                                    status: overallStatus
                                });
  
                                if (worksOnDays) {
                                    const department = employee.Department || "Unknown";
                                    departmentCounts[department] =
                                        (departmentCounts[department] || 0) + 1;
  
                                    if (!employeesByDepartment[department]) {
                                        employeesByDepartment[department] = [];
                                    }
                                    employeesByDepartment[department].push(employee["First Name"]);
                                    employeesByDepartment["Total"].push(employee["First Name"]);
  
                                    const position = employee.Position || "Unknown";
                                    positionCounts[position] =
                                        (positionCounts[position] || 0) + 1;
  
                                    if (!employeesByPosition[position]) {
                                        employeesByPosition[position] = [];
                                    }
                                    employeesByPosition[position].push(employee["First Name"]);
                                    employeesByPosition["Total"].push(employee["First Name"]);
                                }
                            }
  
                            const department = employee.Department || "Unknown";
                            let totalHours = 0;
  
                            daysInRange.forEach((dayObj, index) => {
                                const day = dayObj.day;
                                const dateStr = dayObj.dateStr;
                                const scheduleText = schedule[day] || "Off";
                                const status = getStatusForEmployeeOnDate(
                                    employeeId,
                                    timeOffData,
                                    lateData,
                                    earlyData,
                                    volunteerData,
                                    absentData,
                                    dateStr
                                );
  
                                if (
                                    scheduleText.toLowerCase() !== "off" &&
                                    status !== "Request Off" &&
                                    status !== "Absent"
                                ) {
                                    if (day.toLowerCase() === "saturday") {
                                        totalHours += 9; 
                                    } else {
                                        totalHours += 8;
                                    }
                                }
                            });
  
                            if (totalHours > 0) {
                                departmentHours[department] =
                                    (departmentHours[department] || 0) + totalHours;
                            }
                        }
  
                        allEmployees = filteredEmployees;
  
                        renderDepartmentSummary(departmentCounts, employeesByDepartment);
                        renderPositionSummary(positionCounts, employeesByPosition);
                        renderTotalsSummary(departmentHours);
                        renderEmployeeTable(filteredEmployees, daysInRange);
  
                        const facilities = Array.from(facilitiesSet);
                        if (facilityFilterSelect.options.length <= 1) {
                            populateFacilityFilter(facilities);
                        }
                    })
                    .catch((error) => {
                        console.error("Error fetching employee data:", error);
                    });
            })
            .catch((error) => {
                console.error("Error fetching status data:", error);
            });
    }
  
    function getStatusForEmployeeOnDate(
        employeeId,
        timeOffData,
        lateData,
        earlyData,
        volunteerData,
        absentData,
        dateStr
    ) {
        let status = "";
  
        const statusChecks = [
            { data: timeOffData, action: "Request Off", result: "Request Off" },
            { data: absentData, action: "Absent", result: "Absent" },
            { data: lateData, action: "Late", result: "Late" },
            { data: earlyData, action: "Leave Early", result: "Left Early" },
            { data: volunteerData, action: "Volunteer", result: "Volunteer" },
        ];
  
        for (const check of statusChecks) {
            for (const key in check.data) {
                const record = check.data[key];
                if (
                    record.ID === employeeId &&
                    record.date === dateStr &&
                    record.action === check.action
                ) {
                    status = check.result;
                    return status;
                }
            }
        }
  
        return status;
    }
  
    function getOverallStatusForEmployee(
        employeeId,
        timeOffData,
        lateData,
        earlyData,
        volunteerData,
        absentData,
        daysInRange
    ) {
        let statusSet = new Set();
  
        daysInRange.forEach((dayObj) => {
            const dateStr = dayObj.dateStr;
            const status = getStatusForEmployeeOnDate(
                employeeId,
                timeOffData,
                lateData,
                earlyData,
                volunteerData,
                absentData,
                dateStr
            );
  
            if (status) {
                statusSet.add(status);
            }
        });
  
        return Array.from(statusSet).join(", ");
    }
  
    function renderDepartmentSummary(departmentCounts, employeesByDepartment) {
        departmentSummary.innerHTML = "";
  
        if (Object.keys(departmentCounts).length === 0) {
            departmentSummary.style.display = "none";
            return;
        }
  
        departmentSummary.style.display = "flex";
        let totalCount = 0;
  
        for (const count of Object.values(departmentCounts)) {
            totalCount += count;
        }
        const totalItem = document.createElement("div");
        totalItem.className = "summary-item total";
        totalItem.innerHTML = `<strong>Total</strong>: ${totalCount}`;
        totalItem.setAttribute(
            "data-tooltip",
            employeesByDepartment["Total"]?.join(", ") || ""
        );
        departmentSummary.appendChild(totalItem);
  
        for (const [department, count] of Object.entries(departmentCounts)) {
            const summaryItem = document.createElement("div");
            summaryItem.className = "summary-item";
            summaryItem.innerHTML = `<strong>${department}</strong>: ${count}`;
            const employeeList = employeesByDepartment[department] || [];
            summaryItem.setAttribute("data-tooltip", employeeList.join(", "));
            departmentSummary.appendChild(summaryItem);
        }
    }
  
    function renderPositionSummary(positionCounts, employeesByPosition) {
        positionSummary.innerHTML = "";
  
        if (Object.keys(positionCounts).length === 0) {
            positionSummary.style.display = "none";
            return;
        }
  
        positionSummary.style.display = "flex";
        let totalCount = 0;
  
        for (const count of Object.values(positionCounts)) {
            totalCount += count;
        }
        const totalItem = document.createElement("div");
        totalItem.className = "summary-item total";
        totalItem.innerHTML = `<strong>Total</strong>: ${totalCount}`;
        totalItem.setAttribute(
            "data-tooltip",
            employeesByPosition["Total"]?.join(", ") || ""
        );
        positionSummary.appendChild(totalItem);
  
        for (const [position, count] of Object.entries(positionCounts)) {
            const summaryItem = document.createElement("div");
            summaryItem.className = "summary-item";
            summaryItem.innerHTML = `<strong>${position}</strong>: ${count}`;
            const employeeList = employeesByPosition[position] || [];
            summaryItem.setAttribute("data-tooltip", employeeList.join(", "));
            positionSummary.appendChild(summaryItem);
        }
    }
  
    function renderTotalsSummary(departmentHours) {
        totalsSummary.innerHTML = "";
  
        let grandTotal = 0;
        for (const hours of Object.values(departmentHours)) {
            grandTotal += hours;
        }
  
        const totalItem = document.createElement("div");
        totalItem.className = "summary-item total";
        totalItem.innerHTML = `<strong>Total Hours</strong>: ${grandTotal}`;
        totalsSummary.appendChild(totalItem);
  
        for (const [department, hours] of Object.entries(departmentHours)) {
            const summaryItem = document.createElement("div");
            summaryItem.className = "summary-item";
            summaryItem.innerHTML = `<strong>${department}</strong>: ${hours}`;
            totalsSummary.appendChild(summaryItem);
        }
    }
  
    function getDaysInRange(startDateStr, endDateStr) {
        const dateArray = [];
  
        const [startYear, startMonth, startDay] = startDateStr.split("-").map(Number);
        const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
  
        let currentDate = new Date(startYear, startMonth - 1, startDay);
        const stopDate = new Date(endYear, endMonth - 1, endDay);
  
        while (currentDate <= stopDate) {
            const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" });
            dateArray.push({
                date: new Date(currentDate),
                day: dayName,
                dateStr: formatDate(currentDate),
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
  
        return dateArray;
    }
  
    function renderEmployeeTable(employees, daysInRange) {
        employeeTable.innerHTML = "";
  
        const showNotes = showNotesCheckbox.checked;
  
        const headers = [
            { text: "Department", key: "department" },
            { text: "Position", key: "position" },
            { text: "First Name", key: "firstName" },
            { text: "Last Name", key: "lastName" },
            ...daysInRange.map((dayObj) => ({ text: dayObj.day, key: dayObj.day })),
            { text: "Action", key: "status" }
        ];
  
        if (showNotes) {
            headers.push({ text: "Notes", key: "notes" });
        }
  
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = headers
            .map((header) => `<th data-key="${header.key}">${header.text}</th>`)
            .join("");
        const thead = employeeTable.parentElement.querySelector("thead");
        thead.innerHTML = "";
        thead.appendChild(headerRow);
  
        headers.forEach((header) => {
            const th = thead.querySelector(`th[data-key="${header.key}"]`);
            th.style.cursor = "pointer";
            th.addEventListener("click", () => {
                sortTableByColumn(header.key);
            });
        });
  
        const filteredEmployees = applySearchFilter(employees);
        const singleDaySelected = (startDateInput.value === endDateInput.value);
        const selectedDates = daysInRange.map(d => d.dateStr);
  
        filteredEmployees.forEach((employee) => {
            const row = document.createElement("tr");
  
            const scheduleCellsHTML = daysInRange
                .map((dayObj) => {
                    const day = dayObj.day;
                    const scheduleText = employee.schedule[day] || "Off";
                    return `<td>${scheduleText}</td>`;
                })
                .join("");
  
            row.innerHTML = `
              <td>${employee.department || "N/A"}</td>
              <td>${employee.position || "N/A"}</td>
              <td>${employee.firstName || "N/A"}</td>
              <td>${employee.lastName || "N/A"}</td>
              ${scheduleCellsHTML}
              <td>${employee.status || ""}</td>
            `;
  
            if (showNotes) {
                let combinedNotes = [];
                selectedDates.forEach(dateStr => {
                    if (employeeNotesData[employee.id] && employeeNotesData[employee.id][dateStr]) {
                        combinedNotes = combinedNotes.concat(employeeNotesData[employee.id][dateStr]);
                    }
                });
                const notesText = combinedNotes.join("\n");
                const notesCell = document.createElement("td");
                notesCell.className = "notes-cell";
  
                if (singleDaySelected) {
                    const notesSelect = document.createElement("select");
                    const defaultOption = document.createElement("option");
                    defaultOption.value = "";
                    defaultOption.textContent = "Select Note...";
                    notesSelect.appendChild(defaultOption);
  
                    predefinedNotes.forEach(note => {
                        const option = document.createElement("option");
                        option.value = note;
                        option.textContent = note;
                        notesSelect.appendChild(option);
                    });
  
                    if (notesText && predefinedNotes.includes(notesText)) {
                        notesSelect.value = notesText;
                    } else if (notesText) {
                        notesSelect.value = "Custom";
                    }
  
                    const customTextarea = document.createElement("textarea");
                    customTextarea.style.width = "100%";
                    customTextarea.style.height = "40px";
                    customTextarea.style.display = "none";
  
                    if (notesSelect.value === "Custom") {
                        customTextarea.value = notesText;
                        customTextarea.style.display = "block";
                    }
  
                    notesSelect.addEventListener("change", () => {
                        if (notesSelect.value === "Custom") {
                            customTextarea.style.display = "block";
                            customTextarea.focus();
                        } else {
                            customTextarea.style.display = "none";
                            customTextarea.value = "";
                            saveEmployeeNotes(employee.id, startDateInput.value, notesSelect.value);
                        }
                    });
  
                    customTextarea.addEventListener("blur", () => {
                        if (notesSelect.value === "Custom") {
                            const customNote = customTextarea.value.trim();
                            saveEmployeeNotes(employee.id, startDateInput.value, customNote);
                        }
                    });
  
                    notesCell.appendChild(notesSelect);
                    notesCell.appendChild(customTextarea);
                } else {
                    notesCell.textContent = notesText;
                }
  
                row.appendChild(notesCell);
            }
  
            row.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                showContextMenu(event, employee);
            });
            employeeTable.appendChild(row);
        });
  
        document.addEventListener("click", hideContextMenu);
    }
  
    function sortTableByColumn(columnKey) {
        sortDirection[columnKey] = !sortDirection[columnKey];
        const employeesToSort = [...allEmployees];
  
        employeesToSort.sort((a, b) => {
            let valueA, valueB;
  
            if (columnKey in a) {
                valueA = a[columnKey];
                valueB = b[columnKey];
            } else {
                if (columnKey === "notes") {
                    const selectedDates = getDaysInRange(startDateInput.value, endDateInput.value).map(d => d.dateStr);
                    valueA = getCombinedNotes(a.id, selectedDates).toLowerCase();
                    valueB = getCombinedNotes(b.id, selectedDates).toLowerCase();
                } else {
                    valueA = a.schedule[columnKey] || "";
                    valueB = b.schedule[columnKey] || "";
                }
            }
  
            if (typeof valueA === "string") {
                valueA = valueA.toLowerCase();
            }
            if (typeof valueB === "string") {
                valueB = valueB.toLowerCase();
            }
  
            if (valueA < valueB) {
                return sortDirection[columnKey] ? -1 : 1;
            }
            if (valueA > valueB) {
                return sortDirection[columnKey] ? 1 : -1;
            }
            return 0;
        });
  
        renderEmployeeTable(employeesToSort, getDaysInRange(startDateInput.value, endDateInput.value));
    }
  
    function getCombinedNotes(employeeId, dateStrArray) {
        let combined = [];
        dateStrArray.forEach(dateStr => {
            if (employeeNotesData[employeeId] && employeeNotesData[employeeId][dateStr]) {
                combined = combined.concat(employeeNotesData[employeeId][dateStr]);
            }
        });
        return combined.join("\n");
    }
  
    function applySearchFilter(employees) {
        const searchTerm = searchBar.value.trim().toLowerCase();
        if (!searchTerm) {
            return employees;
        }
  
        return employees.filter((employee) => {
            const fieldsToSearch = [
                employee.department,
                employee.position,
                employee.firstName,
                employee.lastName,
                employee.status,
                employee.facility,
                ...Object.values(employee.schedule),
                getCombinedNotes(employee.id, getDaysInRange(startDateInput.value, endDateInput.value).map(d=>d.dateStr))
            ];
  
            return fieldsToSearch.some((field) =>
                field && field.toLowerCase().includes(searchTerm)
            );
        });
    }
  
    function showContextMenu(event, employee) {
        hideContextMenu();
        contextMenu = document.createElement("div");
        contextMenu.className = "custom-context-menu";
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.left = `${event.pageX}px`;
  
        const menuItems = [
            { text: "Request Off", action: "Request Off", node: "Time_off" },
            { text: "Late", action: "Late", node: "Late" },
            { text: "Left Early", action: "Leave Early", node: "Early" },
            { text: "Volunteer", action: "Volunteer", node: "Volunteer" },
            { text: "Absent", action: "Absent", node: "Absent" },
        ];
  
        menuItems.forEach((item) => {
            const menuItem = document.createElement("div");
            menuItem.className = "context-menu-item";
            menuItem.textContent = item.text;
            menuItem.addEventListener("click", () => {
                handleMenuAction(item.node, employee, item.action);
            });
            contextMenu.appendChild(menuItem);
        });
  
        document.body.appendChild(contextMenu);
    }
  
    function hideContextMenu() {
        if (contextMenu) {
            document.body.removeChild(contextMenu);
            contextMenu = null;
        }
    }
  
    function handleMenuAction(nodeName, employee, action) {
        const selectedDate = startDateInput.value;
  
        const employeeId = employee.id || employee.ID || "";
  
        const data = {
            ID: employeeId,
            "First Name": employee.firstName,
            "Last Name": employee.lastName,
            date: selectedDate,
            action: action,
        };
  
        db.ref(`${nodeName}`).push(data)
            .then(() => {
                alert(`${action} recorded for ${employee.firstName} ${employee.lastName} on ${selectedDate}.`);
                updateTable();
            })
            .catch((error) => {
                console.error(`Error updating ${nodeName}:`, error);
            });
  
        hideContextMenu();
    }
  
    function saveEmployeeNotes(employeeId, dateStr, notes) {
        const timestamp = new Date().toISOString();
        const data = {
            ID: employeeId,
            date: dateStr,
            notes: notes,
            timestamp: timestamp
        };
  
        const noteKey = employeeId + "_" + dateStr.replace(/-/g,'_');
  
        db.ref('Employee_Note/' + noteKey).set(data)
            .then(() => {
                if (!employeeNotesData[employeeId]) {
                    employeeNotesData[employeeId] = {};
                }
                employeeNotesData[employeeId][dateStr] = notes ? [notes] : [];
            })
            .catch((error) => {
                console.error("Error saving notes:", error);
            });
    }
  
    function updateTable() {
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
  
        const [startYear, startMonth, startDay] = startDateStr.split("-").map(Number);
        const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
  
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const endDate = new Date(endYear, endMonth - 1, endDay);
  
        if (startDate > endDate) {
            alert("Start date cannot be after the end date!");
            return;
        }
  
        fetchEmployeesForRange(startDateStr, endDateStr);
    }
  
    previousBtn.addEventListener("click", () => {
        const [startYear, startMonth, startDay] = startDateInput.value.split("-").map(Number);
        const [endYear, endMonth, endDay] = endDateInput.value.split("-").map(Number);
  
        const startDate = new Date(startYear, startMonth - 1, startDay - 1);
        const endDate = new Date(endYear, endMonth - 1, endDay - 1);
  
        startDateInput.value = formatDate(startDate);
        endDateInput.value = formatDate(endDate);
  
        updateTable();
    });
  
    nextBtn.addEventListener("click", () => {
        const [startYear, startMonth, startDay] = startDateInput.value.split("-").map(Number);
        const [endYear, endMonth, endDay] = endDateInput.value.split("-").map(Number);
  
        const startDate = new Date(startYear, startMonth - 1, startDay + 1);
        const endDate = new Date(endYear, endMonth - 1, endDay + 1);
  
        startDateInput.value = formatDate(startDate);
        endDateInput.value = formatDate(endDate);
  
        updateTable();
    });
  
    showOffCheckbox.addEventListener("change", updateTable);
    showNotesCheckbox.addEventListener("change", updateTable);
  
    startDateInput.addEventListener("change", updateTable);
    endDateInput.addEventListener("change", updateTable);
  
    searchBar.addEventListener("input", () => {
        renderEmployeeTable(allEmployees, getDaysInRange(startDateInput.value, endDateInput.value));
    });
  
    facilityFilterSelect.addEventListener("change", updateTable);
  
    // New function to copy names
    function copyNamesToClipboard() {
        // Use currently displayed employees after search and filters
        // The currently displayed employees are the ones used in the last render call
        // We can use filteredEmployees in renderEmployeeTable logic or just filter again:
        const filtered = applySearchFilter(allEmployees);
        
        // Format each as "FirstName LastName"
        const nameLines = filtered.map(emp => `${emp.firstName} ${emp.lastName}`).join("\n");
  
        navigator.clipboard.writeText(nameLines)
            .then(() => {
                alert("Names copied to clipboard!");
            })
            .catch((error) => {
                console.error("Failed to copy text:", error);
            });
    }
  
    copyNamesBtn.addEventListener("click", copyNamesToClipboard);
  
    updateTable();
  });
  