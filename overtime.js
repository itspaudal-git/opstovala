// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const dateInput = document.getElementById("date");
const facilityInput = document.getElementById("facility");
const tableBody = document.getElementById("data-table");
const tableHead = document.getElementById("table-head");
const selectedDaySpan = document.getElementById("selected-day");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let globalData = [];
let currentDayOfWeek = 0;
let visibleDays = [];
let currentSortColumn = null;
let currentSortDirection = 'asc'; // or 'desc'

// This will hold the time off data in a structure like:
// timeOffData[id][dateString] = true if off that day
let timeOffData = {};

// Format date for Firebase keys (MM-DD-YYYY)
function formatDateForFirebase(date) {
  const [year, month, day] = date.split("-");
  return `${month}-${day}-${year}`;
}

// Fetch the latest available date from Firebase
async function fetchLatestDate() {
  const overtimeRef = db.ref("Overtime");
  const snapshot = await overtimeRef.orderByKey().limitToLast(1).once("value");
  const val = snapshot.val();
  if (!val) return null;
  const latestKey = Object.keys(val)[0];
  return latestKey;
}

// Fetch data from Firebase Overtime and Employee nodes
async function fetchOvertimeData(dateKey, facilityFilter) {
  const overtimeRef = db.ref(`Overtime/${dateKey}`);
  const employeeRef = db.ref("Employee");

  const [overtimeSnapshot, employeeSnapshot] = await Promise.all([
    overtimeRef.once("value"),
    employeeRef.once("value"),
  ]);

  const overtimeData = overtimeSnapshot.val() || {};
  const employeeData = employeeSnapshot.val() || {};

  const rows = Object.entries(overtimeData).map(([positionId, overtimeEntry]) => {
    const employeeEntry = Object.values(employeeData).find(
      (employee) => employee.ID === positionId && (!facilityFilter || employee.Facility === facilityFilter)
    );

    if (employeeEntry) {
      return {
        positionId,
        facility: employeeEntry.Facility || "N/A",
        firstName: employeeEntry["First Name"] || "N/A",
        lastName: employeeEntry["Last Name"] || "N/A",
        currentHours: overtimeEntry.Current_Hours || 0,
        sunday: employeeEntry.Sunday || "N/A",
        monday: employeeEntry.Monday || "N/A",
        tuesday: employeeEntry.Tuesday || "N/A",
        wednesday: employeeEntry.Wednesday || "N/A",
        thursday: employeeEntry.Thursday || "N/A",
        friday: employeeEntry.Friday || "N/A",
        saturday: employeeEntry.Saturday || "N/A",
      };
    }

    return null;
  });

  return rows.filter((row) => row !== null);
}

// Helper to format hours: if zero return "Off", else format to two decimals
function formatHours(val) {
  if (val === 0 || val === null) {
    return "Off";
  }
  return val.toFixed(2);
}

// Render the table dynamically based on the selected day and facility
function renderTable(data, dayOfWeek) {
  tableBody.innerHTML = "";
  tableHead.innerHTML = "";

  visibleDays = WEEKDAYS.slice(dayOfWeek);

  // Always visible columns:
  const columns = [
    { name: "Facility", sortKey: null, type: "string" },
    { name: "Position ID", sortKey: null, type: "string" },
    { name: "First Name", sortKey: "firstName", type: "string" },
    { name: "Last Name", sortKey: null, type: "string" },
    { name: "Current Hours", sortKey: "currentHours", type: "number" }
  ];

  visibleDays.forEach(day => {
    columns.push({ name: day, sortKey: null, type: "number" });
  });

  columns.push({ name: "Total", sortKey: "total", type: "number" });
  columns.push({ name: "Hours Available", sortKey: "hoursAvailable", type: "number" });

  const headerRow = document.createElement("tr");

  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.name;
    if (col.sortKey) {
      th.classList.add("sortable");
      th.dataset.sortKey = col.sortKey;
      th.dataset.type = col.type;
      if (currentSortColumn === col.sortKey) {
        th.classList.add(currentSortDirection);
      }
      th.addEventListener("click", () => handleSortClick(col.sortKey, col.type));
    }
    headerRow.appendChild(th);
  });

  tableHead.appendChild(headerRow);

  data.forEach((row) => {
    const tr = document.createElement("tr");

    tr.appendChild(createCell(row.facility));
    tr.appendChild(createCell(row.positionId));
    tr.appendChild(createCell(row.firstName));
    tr.appendChild(createCell(row.lastName));

    // Current Hours as Off if 0
    const currentHoursDisplay = formatHours(row.currentHours);
    const currentHoursCell = createCell(currentHoursDisplay);
    tr.appendChild(currentHoursCell);

    const dayValuesMap = {
      Sunday: row.sunday,
      Monday: row.monday,
      Tuesday: row.tuesday,
      Wednesday: row.wednesday,
      Thursday: row.thursday,
      Friday: row.friday,
      Saturday: row.saturday,
    };

    let totalHours = row.currentHours;

    // Calculate the actual date for each visible day and check timeOff
    // We know the selectedDate from dateInput
    const selectedDate = new Date(dateInput.value + "T00:00:00");

    visibleDays.forEach((day, index) => {
      // Compute the date for this column
      const dayDate = new Date(selectedDate.getTime() + index * 24 * 3600 * 1000);
      const yyyy = dayDate.getFullYear();
      const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(dayDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      let hours = parseDayValue(dayValuesMap[day]);
      
      // Check if this employee has time off on dateStr
      const isOff = checkTimeOff(row.positionId, dateStr);
      let dayDisplay;
      if (isOff) {
        dayDisplay = "Off";
        hours = 0; // If off, treat hours as 0 for total calculation
      } else {
        dayDisplay = (hours === 0) ? "Off" : hours.toFixed(2);
      }

      const dayCell = createCell(dayDisplay);
      tr.appendChild(dayCell);

      totalHours += hours || 0;
    });

    // Compute total and hoursAvailable
    const total = totalHours;
    // HoursAvailable is only based on currentHours as per user's request
    const hoursAvailable = Math.max(40 - row.currentHours, 0);

    // Total cell with color coding (still numeric)
    const totalCell = createCell(total.toFixed(2));
    applyTotalColor(totalCell, total);
    tr.appendChild(totalCell);

    // Hours Available cell with color coding (still numeric)
    const haCell = createCell(hoursAvailable.toFixed(2));
    applyHoursAvailableColor(haCell, hoursAvailable);
    tr.appendChild(haCell);

    tableBody.appendChild(tr);
  });
}

// Check if an employee is off on a given date using the timeOffData
function checkTimeOff(positionId, dateStr) {
  if (!timeOffData[positionId]) return false;
  return !!timeOffData[positionId][dateStr];
}

// Helper to parse the daily value into hours
function parseDayValue(value) {
  if (typeof value === "string") {
    if (value.includes("AM") || value.includes("PM")) {
      return 8; // Assume AM/PM string = 8 hours
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  } else if (typeof value === "number") {
    return value;
  }
  return 0;
}

// Helper to create a table cell
function createCell(content) {
  const td = document.createElement("td");
  td.textContent = content;
  return td;
}

// Apply color coding for Total
function applyTotalColor(cell, total) {
  if (total >= 39 && total < 55) {
    cell.style.backgroundColor = "#FFC0CB"; // Pink
    cell.style.color = "#000000";
  } else if (total >= 55) {
    cell.style.backgroundColor = "#FF0000"; // Red
    cell.style.color = "#ffffff";
  } else {
    cell.style.backgroundColor = "";
    cell.style.color = "#000000";
  }
}

// Apply color coding for Hours Available
function applyHoursAvailableColor(cell, hoursAvailable) {
  if (hoursAvailable === 0) {
    cell.style.backgroundColor = "#90EE90"; // Light green
    cell.style.color = "#000000";
  } else if (hoursAvailable > 0 && hoursAvailable <= 10) {
    cell.style.backgroundColor = "#006400"; // Dark green
    cell.style.color = "#ffffff";
  } else {
    cell.style.backgroundColor = "#ffffff";
    cell.style.color = "#000000";
  }
}

// Sorting logic
function handleSortClick(sortKey, type) {
  if (currentSortColumn === sortKey) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = sortKey;
    currentSortDirection = 'asc';
  }

  sortData(globalData, sortKey, type, currentSortDirection);
  renderTable(globalData, currentDayOfWeek);
}

// Sort data in place
function sortData(data, sortKey, type, direction) {
  data.sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "total") {
      valA = computeTotalForRow(a);
      valB = computeTotalForRow(b);
    }
    if (sortKey === "hoursAvailable") {
      valA = Math.max(40 - a.currentHours, 0);
      valB = Math.max(40 - b.currentHours, 0);
    }

    if (type === "number") {
      valA = Number(valA);
      valB = Number(valB);
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

// Compute total hours for a given row for sorting if needed
function computeTotalForRow(row) {
  let totalHours = row.currentHours;
  const selectedDate = new Date(dateInput.value + "T00:00:00");

  visibleDays.forEach((day, index) => {
    const dayDate = new Date(selectedDate.getTime() + index * 24 * 3600 * 1000);
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    let hours = parseDayValue(row[day.toLowerCase()]);
    // Check time off
    if (checkTimeOff(row.positionId, dateStr)) {
      hours = 0;
    }
    totalHours += hours || 0;
  });
  return totalHours;
}

async function initializeData() {
  const latestDateKey = await fetchLatestDate();
  if (!latestDateKey) {
    console.error("No date available in Firebase");
    return;
  }

  const [m, d, y] = latestDateKey.split("-");
  const formattedDate = `${y}-${m}-${d}`;
  dateInput.value = formattedDate;

  // Load the data for the latest date
  await loadData();
}

// Load Data and Render Table
async function loadData() {
  const dateKey = formatDateForFirebase(dateInput.value);
  const selectedDate = new Date(dateInput.value + "T00:00:00");
  const dayOfWeek = selectedDate.getUTCDay();
  currentDayOfWeek = dayOfWeek;
  const facilityFilter = facilityInput.value.trim();
  selectedDaySpan.textContent = `(${WEEKDAYS[dayOfWeek]})`;

  const data = await fetchOvertimeData(dateKey, facilityFilter);

  globalData = data;
  currentSortColumn = null;
  currentSortDirection = 'asc';

  renderTable(data, dayOfWeek);
}

// Real-time listener for Time_off data
function listenToTimeOff() {
  const timeOffRef = db.ref("Time_off");
  timeOffRef.on("value", (snapshot) => {
    const val = snapshot.val() || {};
    timeOffData = {};

    // Process timeOff data into our structure
    // Each entry has { "First Name", "ID", "Last Name", "action", "date" }
    // We only care if action = "Request Off" to consider them off.
    for (let key in val) {
      const entry = val[key];
      const id = entry.ID;
      const date = entry.date;
      const action = entry.action;
      if (!id || !date) continue;
      if (action === "Request Off") {
        if (!timeOffData[id]) {
          timeOffData[id] = {};
        }
        timeOffData[id][date] = true;
      }
    }

    // If we already have globalData loaded, re-render the table to reflect changes
    if (globalData.length > 0) {
      renderTable(globalData, currentDayOfWeek);
    }
  });
}

dateInput.addEventListener("change", loadData);
facilityInput.addEventListener("change", loadData);
// Helper function to parse CSV content
function parseCSV(content) {
  const lines = content.split("\n").map((line) => line.trim());
  const headers = lines.shift().split(",").map((header) => header.trim());
  const rows = lines.map((line) =>
    line.split(",").reduce((acc, value, index) => {
      acc[headers[index]] = value.trim();
      return acc;
    }, {})
  );
  return rows;
}

// Upload and process the file
async function processFile(file) {
  const selectedDateKey = formatDateForFirebase(dateInput.value);
  const selectedFacility = facilityInput.value;
  if (!selectedDateKey || !selectedFacility) {
    alert("Please select a date and facility before uploading.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (event) {
    const content = event.target.result;
    let rows = [];
    if (file.name.endsWith(".csv")) {
      rows = parseCSV(content);
    } else if (file.name.endsWith(".xlsx")) {
      // Use XLSX library to parse XLSX file
      const workbook = XLSX.read(content, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    // Extract relevant data
    const positionIdMap = {};
    rows.forEach((row) => {
      const positionId = row["Position ID"];
      const totalHours = parseFloat(row["Total Hours"]);
      if (positionId && !isNaN(totalHours)) {
        positionIdMap[positionId] = totalHours;
      }
    });

    // Fetch existing data from Firebase
    const overtimeRef = db.ref(`Overtime/${selectedDateKey}`);
    const existingSnapshot = await overtimeRef.once("value");
    const existingData = existingSnapshot.val() || {};

    // Update Firebase with new/updated data
    Object.entries(positionIdMap).forEach(([positionId, totalHours]) => {
      if (!existingData[positionId] || existingData[positionId].Current_Hours !== totalHours) {
        overtimeRef.child(positionId).set({
          Current_Hours: totalHours,
          Location: selectedFacility,
          Position_ID: positionId,
        });
      }
    });

    alert("File processed and data updated successfully.");
    await loadData(); // Reload data to reflect updates
  };

  if (file.name.endsWith(".csv")) {
    reader.readAsText(file);
  } else if (file.name.endsWith(".xlsx")) {
    reader.readAsBinaryString(file);
  }
}

// Attach event listener to upload button
document.getElementById("upload-button").addEventListener("click", () => {
  const fileInput = document.getElementById("file-upload");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a file to upload.");
    return;
  }
  processFile(file);
});

// Initialize page and start listening to Time_off updates
initializeData();
listenToTimeOff();
