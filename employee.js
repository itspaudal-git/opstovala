

// Initialize Firebase if not already done
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  // References to your Realtime Database
  const db = firebase.database();
  
  // DOM Elements
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
  const copyNamesBtn = document.getElementById("copy-names-btn");
  
  // We'll store the raw DB data here in real-time
  let employeesData = {};
  let timeOffData = {};
  let lateData = {};
  let earlyData = {};
  let volunteerData = {};
  let absentData = {};
  let notesData = {};
  
  // Track once all data is loaded at least once
  const dataLoaded = {
    employees: false,
    timeOff: false,
    late: false,
    early: false,
    volunteer: false,
    absent: false,
    notes: false
  };
  
  // We keep a global list of employees for sorting/searching
  let allEmployees = [];
  let sortDirection = {};
  let employeeNotesData = {};
  
  // Predefined notes (used for the select dropdown)
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
  
  // Any note in this list EXCLUDES that day entirely
  const excludeNotes = [
    "No Call/No Show",
    "Called out after start of shift",
    "Callout",
    "Bereavement",
    "Dr Notes",
    "Callout (Sick Time)"
  ];
  
  // Listen for real-time data updates on all relevant nodes
  function listenToFirebase() {
    // Employees
    db.ref("Employee").on("value", (snapshot) => {
      employeesData = snapshot.val() || {};
      dataLoaded.employees = true;
      updateTableIfReady();
    });
  
    // Time_off
    db.ref("Time_off").on("value", (snapshot) => {
      timeOffData = snapshot.val() || {};
      dataLoaded.timeOff = true;
      updateTableIfReady();
    });
  
    // Late
    db.ref("Late").on("value", (snapshot) => {
      lateData = snapshot.val() || {};
      dataLoaded.late = true;
      updateTableIfReady();
    });
  
    // Early
    db.ref("Early").on("value", (snapshot) => {
      earlyData = snapshot.val() || {};
      dataLoaded.early = true;
      updateTableIfReady();
    });
  
    // Volunteer
    db.ref("Volunteer").on("value", (snapshot) => {
      volunteerData = snapshot.val() || {};
      dataLoaded.volunteer = true;
      updateTableIfReady();
    });
  
    // Absent
    db.ref("Absent").on("value", (snapshot) => {
      absentData = snapshot.val() || {};
      dataLoaded.absent = true;
      updateTableIfReady();
    });
  
    // Notes
    db.ref("Employee_Note").on("value", (snapshot) => {
      notesData = snapshot.val() || {};
      dataLoaded.notes = true;
      updateTableIfReady();
    });
  }
  
  // Only call updateTable() after all references have loaded once
  function updateTableIfReady() {
    if (
      dataLoaded.employees &&
      dataLoaded.timeOff &&
      dataLoaded.late &&
      dataLoaded.early &&
      dataLoaded.volunteer &&
      dataLoaded.absent &&
      dataLoaded.notes
    ) {
      updateTable();
    }
  }
  
  // Initialize date fields to current date
  function updateDates() {
    const now = new Date();
    const currentDate = new Date(now);
    startDateInput.value = formatDate(currentDate);
    endDateInput.value = formatDate(currentDate);
  }
  
  // Schedule daily refresh at midnight (optional)
  function scheduleMidnightUpdate() {
    const now = new Date();
    const timeToMidnight =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,0,0
      ).getTime() - now.getTime();
  
    setTimeout(() => {
      updateDates();
      updateTable();
      scheduleMidnightUpdate();
    }, timeToMidnight);
  }
  
  // Format JS Date object to YYYY-MM-DD
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // Return array of date objects for the range
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
  
  // Identify special status (Request Off, Late, etc) from DB
  function getStatusForEmployeeOnDate(employeeId, dateStr) {
    // Time_off => "Request Off"
    for (const key in timeOffData) {
      const record = timeOffData[key];
      if (
        record.ID === employeeId &&
        record.date === dateStr &&
        record.action === "Request Off"
      ) {
        return "Request Off";
      }
    }
  
    // Absent => "Absent"
    for (const key in absentData) {
      const record = absentData[key];
      if (
        record.ID === employeeId &&
        record.date === dateStr &&
        record.action === "Absent"
      ) {
        return "Absent";
      }
    }
  
    // Late => "Late"
    for (const key in lateData) {
      const record = lateData[key];
      if (
        record.ID === employeeId &&
        record.date === dateStr &&
        record.action === "Late"
      ) {
        return "Late";
      }
    }
  
    // Early => "Left Early"
    for (const key in earlyData) {
      const record = earlyData[key];
      if (
        record.ID === employeeId &&
        record.date === dateStr &&
        record.action === "Leave Early"
      ) {
        return "Left Early";
      }
    }
  
    // Volunteer => "Volunteer"
    for (const key in volunteerData) {
      const record = volunteerData[key];
      if (
        record.ID === employeeId &&
        record.date === dateStr &&
        record.action === "Volunteer"
      ) {
        return "Volunteer";
      }
    }
  
    return "";
  }
  
  // Summarize statuses across all selected days for the "Action" column
  function getOverallStatusForEmployee(employeeId, daysInRange) {
    let statusSet = new Set();
    daysInRange.forEach((dayObj) => {
      const dateStr = dayObj.dateStr;
      const status = getStatusForEmployeeOnDate(employeeId, dateStr);
      if (status) {
        statusSet.add(status);
      }
    });
    return Array.from(statusSet).join(", ");
  }
  
  // Rebuild employeeNotesData from DB notesData
  function rebuildEmployeeNotesData() {
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
  }
  
  // Core function to filter employees and re-render
  function updateTable() {
    // Rebuild local notes structure
    rebuildEmployeeNotesData();
  
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
  
    const daysInRange = getDaysInRange(startDateStr, endDateStr);
    const selectedDays = daysInRange.map((d) => d.day);
  
    const filteredEmployees = [];
    // We'll track how many employees 'work' for each department/position
    const departmentCounts = {};
    const positionCounts = {};
    // For tooltip listing
    const employeesByDepartment = { Total: [] };
    const employeesByPosition = { Total: [] };
    // Hours by department
    const departmentHours = {};
    // Facilities
    const facilitiesSet = new Set();
  
    const selectedFacility = facilityFilterSelect.value || "All";
  
    // Iterate over all employees from DB
    for (const key in employeesData) {
      const employee = employeesData[key];
  
      // Skip employees who are NOT "Active" (e.g. "Inactive")
      if (employee.Status !== "Active") {
        continue;
      }
  
      const employeeId = employee.ID || "";
      const empFacility = employee.Facility || "Unknown";
      facilitiesSet.add(empFacility);
  
      // If user selected a specific facility, skip others
      if (selectedFacility !== "All" && empFacility !== selectedFacility) {
        continue;
      }
  
      // Build schedule for each day
      const schedule = selectedDays.reduce((acc, day, index) => {
        const dateObj = daysInRange[index];
        const dateStr = dateObj.dateStr;
        const status = getStatusForEmployeeOnDate(employeeId, dateStr);
  
        // The DB might store actual day schedule under day + "_St"
        let scheduleText = employee[day + "_St"] || "Off";
  
        // If "Request Off" or "Absent", treat as Off
        if (status === "Request Off" || status === "Absent") {
          scheduleText = "Off";
        }
  
        // Add short status label if not Off/Request Off/Absent
        if (status && status !== "Request Off" && status !== "Absent") {
          scheduleText += ` (${status})`;
        }
  
        acc[day] = scheduleText;
        return acc;
      }, {});
  
      // Overall status
      const overallStatus = getOverallStatusForEmployee(employeeId, daysInRange);
  
      // Determine if there's ANY day the employee truly "works"
      let worksAnyDay = false;
      daysInRange.forEach((dayObj) => {
        const day = dayObj.day;
        const dateStr = dayObj.dateStr;
        const scheduleText = schedule[day] || "Off";
        const status = getStatusForEmployeeOnDate(employeeId, dateStr);
  
        const dayNotes = (employeeNotesData[employeeId] && employeeNotesData[employeeId][dateStr])
          ? employeeNotesData[employeeId][dateStr]
          : [];
        const dayHasExcludedNote = dayNotes.some((n) => excludeNotes.includes(n));
  
        // If not "Off", not request off, not absent, and no exclude note => they worked
        if (
          scheduleText.toLowerCase() !== "off" &&
          status !== "Request Off" &&
          status !== "Absent" &&
          !dayHasExcludedNote
        ) {
          worksAnyDay = true;
        }
      });
  
      // If user wants to see OFF employees or the employee actually works
      if (showOffCheckbox.checked || worksAnyDay) {
        filteredEmployees.push({
          id: employeeId,
          department: employee.Department,
          position: employee.Position,
          facility: empFacility,
          firstName: employee["First Name"],
          lastName: employee["Last Name"],
          schedule: schedule,
          status: overallStatus,
        });
  
        // If they worked at least one day, increment department/position counts
        if (worksAnyDay) {
          const department = employee.Department || "Unknown";
          departmentCounts[department] = (departmentCounts[department] || 0) + 1;
          if (!employeesByDepartment[department]) {
            employeesByDepartment[department] = [];
          }
          employeesByDepartment[department].push(employee["First Name"]);
          employeesByDepartment["Total"].push(employee["First Name"]);
  
          const position = employee.Position || "Unknown";
          positionCounts[position] = (positionCounts[position] || 0) + 1;
          if (!employeesByPosition[position]) {
            employeesByPosition[position] = [];
          }
          employeesByPosition[position].push(employee["First Name"]);
          employeesByPosition["Total"].push(employee["First Name"]);
        }
      }
  
      // Calculate hours (similarly skipping days with exclude notes)
      const department = employee.Department || "Unknown";
      let totalHours = 0;
  
      daysInRange.forEach((dayObj) => {
        const day = dayObj.day;
        const dateStr = dayObj.dateStr;
        const scheduleText = schedule[day] || "Off";
        const status = getStatusForEmployeeOnDate(employeeId, dateStr);
        
        const dayNotes = (employeeNotesData[employeeId] && employeeNotesData[employeeId][dateStr])
          ? employeeNotesData[employeeId][dateStr]
          : [];
        const dayHasExcludedNote = dayNotes.some((n) => excludeNotes.includes(n));
  
        // Only add hours if not off, not request off, not absent, no excluded note
        if (
          scheduleText.toLowerCase() !== "off" &&
          status !== "Request Off" &&
          status !== "Absent" &&
          !dayHasExcludedNote
        ) {
          // Example logic: 9 hours on Saturday, 8 hours otherwise
          if (day.toLowerCase() === "saturday") {
            totalHours += 9;
          } else {
            totalHours += 8;
          }
        }
      });
  
      if (totalHours > 0) {
        departmentHours[department] = (departmentHours[department] || 0) + totalHours;
      }
    }
  
    // Keep a global reference for sorting and searching
    allEmployees = filteredEmployees;
  
    // Render Summaries & Table
    renderDepartmentSummary(departmentCounts, employeesByDepartment);
    renderPositionSummary(positionCounts, employeesByPosition);
    renderTotalsSummary(departmentHours);
    renderEmployeeTable(filteredEmployees, daysInRange);
  
    // Build facility dropdown only once if it has no options yet (beyond "All")
    if (facilityFilterSelect.options.length <= 1) {
      const facArr = Array.from(facilitiesSet);
      populateFacilityFilter(facArr);
    }
  }
  
  
  // Populate facility filter with unique facility values
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
  
  // RENDERING: Department summary
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
  
  // RENDERING: Position summary
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
  
  // RENDERING: Totals summary (department hours + grand total)
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
  
  // RENDERING: Main table
  function renderEmployeeTable(employees, daysInRange) {
    employeeTable.innerHTML = "";
  
    const showNotes = showNotesCheckbox.checked;
    // Build table headers
    const headers = [
      { text: "Department", key: "department" },
      { text: "Position", key: "position" },
      { text: "First Name", key: "firstName" },
      { text: "Last Name", key: "lastName" },
      ...daysInRange.map(dayObj => ({ text: dayObj.day, key: dayObj.day })),
      { text: "Action", key: "status" }
    ];
    if (showNotes) {
      headers.push({ text: "Notes", key: "notes" });
    }
  
    const thead = employeeTable.parentElement.querySelector("thead");
    thead.innerHTML = "";
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = headers
      .map((h) => `<th data-key="${h.key}">${h.text}</th>`)
      .join("");
    thead.appendChild(headerRow);
  
    headers.forEach(header => {
      const th = thead.querySelector(`th[data-key="${header.key}"]`);
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        sortTableByColumn(header.key);
      });
    });
  
    // Filter again by search term
    const filteredEmployees = applySearchFilter(employees);
  
    // Single-day mode vs multi-day
    const singleDaySelected = (startDateInput.value === endDateInput.value);
    const selectedDates = daysInRange.map(d => d.dateStr);
  
    // Build rows
    filteredEmployees.forEach(employee => {
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
  
        // If single day, allow note selection
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
  
          // If notesText is exactly one of the predefined, select it; else "Custom"
          if (notesText && predefinedNotes.includes(notesText)) {
            notesSelect.value = notesText;
          } else if (notesText) {
            notesSelect.value = "Custom";
          }
  
          const customTextarea = document.createElement("textarea");
          customTextarea.style.width = "100%";
          customTextarea.style.height = "40px";
          customTextarea.style.display = "none";
  
          // If "Custom", show the textarea with the existing text
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
          // Multi-day: just display them
          notesCell.textContent = notesText;
        }
        row.appendChild(notesCell);
      }
  
      employeeTable.appendChild(row);
    });
  }
  
  // Sorting
  function sortTableByColumn(columnKey) {
    sortDirection[columnKey] = !sortDirection[columnKey];
    const employeesToSort = [...allEmployees];
  
    employeesToSort.sort((a, b) => {
      let valueA, valueB;
  
      // If the key is directly on the object
      if (columnKey in a) {
        valueA = a[columnKey];
        valueB = b[columnKey];
      } else {
        // Could be a schedule day or notes
        if (columnKey === "notes") {
          const selectedDates = getDaysInRange(startDateInput.value, endDateInput.value).map(d => d.dateStr);
          valueA = getCombinedNotes(a.id, selectedDates).toLowerCase();
          valueB = getCombinedNotes(b.id, selectedDates).toLowerCase();
        } else {
          valueA = a.schedule[columnKey] || "";
          valueB = b.schedule[columnKey] || "";
        }
      }
  
      // Compare strings or numbers
      if (typeof valueA === "string") valueA = valueA.toLowerCase();
      if (typeof valueB === "string") valueB = valueB.toLowerCase();
  
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
  
  // Combine notes from multiple dates for an employee
  function getCombinedNotes(employeeId, dateStrArray) {
    let combined = [];
    dateStrArray.forEach(dateStr => {
      if (employeeNotesData[employeeId] && employeeNotesData[employeeId][dateStr]) {
        combined = combined.concat(employeeNotesData[employeeId][dateStr]);
      }
    });
    return combined.join("\n");
  }
  
  // Searching
  function applySearchFilter(employees) {
    const searchTerm = searchBar.value.trim().toLowerCase();
    if (!searchTerm) {
      return employees;
    }
  
    const dateStrArray = getDaysInRange(startDateInput.value, endDateInput.value).map(d=>d.dateStr);
  
    return employees.filter((employee) => {
      const fieldsToSearch = [
        employee.department,
        employee.position,
        employee.firstName,
        employee.lastName,
        employee.status,
        employee.facility,
        ...Object.values(employee.schedule),
        getCombinedNotes(employee.id, dateStrArray)
      ];
  
      return fieldsToSearch.some((field) =>
        field && field.toLowerCase().includes(searchTerm)
      );
    });
  }
  
  // Save or update notes for an employee
  function saveEmployeeNotes(employeeId, dateStr, notes) {
    const timestamp = new Date().toISOString();
    const data = {
      ID: employeeId,
      date: dateStr,
      notes: notes,
      timestamp: timestamp
    };
  
    // A possible unique key structure: "EmpID_2025_01_15"
    const noteKey = employeeId + "_" + dateStr.replace(/-/g,'_');
  
    db.ref("Employee_Note/" + noteKey).set(data)
      .then(() => {
        // Update local structure so user sees immediate effect
        if (!employeeNotesData[employeeId]) {
          employeeNotesData[employeeId] = {};
        }
        employeeNotesData[employeeId][dateStr] = notes ? [notes] : [];
      })
      .catch((error) => {
        console.error("Error saving notes:", error);
      });
  }
  
  // Copy displayed names to clipboard
  function copyNamesToClipboard() {
    const filtered = applySearchFilter(allEmployees);
    const nameLines = filtered.map(emp => `${emp.firstName} ${emp.lastName}`).join("\n");
  
    navigator.clipboard.writeText(nameLines)
      .then(() => {
        alert("Names copied to clipboard!");
      })
      .catch((error) => {
        console.error("Failed to copy text:", error);
      });
  }
  
  // NAV + EVENT LISTENERS
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
  facilityFilterSelect.addEventListener("change", updateTable);
  
  startDateInput.addEventListener("change", updateTable);
  endDateInput.addEventListener("change", updateTable);
  searchBar.addEventListener("input", () => {
    // Rerender table (search filter)
    renderEmployeeTable(allEmployees, getDaysInRange(startDateInput.value, endDateInput.value));
  });
  
  copyNamesBtn.addEventListener("click", copyNamesToClipboard);
  
  // On page load
  document.addEventListener("DOMContentLoaded", function() {
    updateDates();
    scheduleMidnightUpdate();  // optional daily date shift
    listenToFirebase();        // Start real-time listeners
  });
  