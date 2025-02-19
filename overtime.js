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
  // Debug log for date key
  console.log("Parsing date:", { original: date, year, month, day });
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
  console.log("Fetching Overtime data for key:", dateKey, " and facility:", facilityFilter);
  const overtimeRef = db.ref(`Overtime/${dateKey}`);
  const employeeRef = db.ref("Employee");

  const [overtimeSnapshot, employeeSnapshot] = await Promise.all([
    overtimeRef.once("value"),
    employeeRef.once("value"),
  ]);

  const overtimeData = overtimeSnapshot.val() || {};
  const employeeData = employeeSnapshot.val() || {};

  // -- Only include employees whose Status is "Active"
  const rows = Object.entries(overtimeData).map(([positionId, overtimeEntry]) => {
    const employeeEntry = Object.values(employeeData).find(
      (employee) =>
        employee.ID === positionId &&
        (!facilityFilter || employee.Facility === facilityFilter) &&
        (employee.Status === "Active")
    );

    if (employeeEntry) {
      return {
        positionId,
        facility: employeeEntry.Facility || "N/A",
        firstName: employeeEntry["First Name"] || "N/A",
        lastName: employeeEntry["Last Name"] || "N/A",
        currentHours: overtimeEntry.Current_Hours || 0,

        sunday_st: employeeEntry.Sunday_St || "",
        sunday_end: employeeEntry.Sunday_End || "",
        monday_st: employeeEntry.Monday_St || "",
        monday_end: employeeEntry.Monday_End || "",
        tuesday_st: employeeEntry.Tuesday_St || "",
        tuesday_end: employeeEntry.Tuesday_End || "",
        wednesday_st: employeeEntry.Wednesday_St || "",
        wednesday_end: employeeEntry.Wednesday_End || "",
        thursday_st: employeeEntry.Thursday_St || "",
        thursday_end: employeeEntry.Thursday_End || "",
        friday_st: employeeEntry.Friday_St || "",
        friday_end: employeeEntry.Friday_End || "",
        saturday_st: employeeEntry.Saturday_St || "",
        saturday_end: employeeEntry.Saturday_End || ""
      };
    }
    return null;
  });

  return rows.filter((row) => row !== null);
}

// Helper to parse a time string like "7:00 AM" or "15:30" into minutes from midnight
function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;

  let time = timeStr.trim().toUpperCase();
  let isPM = false;
  let isAM = false;

  if (time.includes("AM")) {
    isAM = true;
    time = time.replace("AM", "").trim();
  } else if (time.includes("PM")) {
    isPM = true;
    time = time.replace("PM", "").trim();
  }

  const [hh, mm] = time.split(":");
  let hours = parseInt(hh, 10);
  let minutes = parseInt(mm || "0", 10);

  if (isNaN(hours) || isNaN(minutes)) return null;

  // Convert 12-hour format to 24-hour
  if (isPM && hours < 12) {
    hours += 12;
  }
  if (isAM && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

// Helper to parse shift duration
function parseDayValue(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const start = parseTime(startStr);
  const end = parseTime(endStr);
  if (start == null || end == null) return 0;

  let diff = end - start;
  // If negative, assume it crosses midnight (optional logic)
  if (diff < 0) {
    diff += 24 * 60;
  }
  const hours = diff / 60;
  return hours < 0 ? 0 : hours;
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

    const currentHoursDisplay = (row.currentHours === 0) ? "Off" : row.currentHours.toFixed(2);
    tr.appendChild(createCell(currentHoursDisplay));

    const dayValuesMap = {
      Sunday:   { start: row.sunday_st,   end: row.sunday_end },
      Monday:   { start: row.monday_st,   end: row.monday_end },
      Tuesday:  { start: row.tuesday_st,  end: row.tuesday_end },
      Wednesday:{ start: row.wednesday_st,end: row.wednesday_end },
      Thursday: { start: row.thursday_st, end: row.thursday_end },
      Friday:   { start: row.friday_st,   end: row.friday_end },
      Saturday: { start: row.saturday_st, end: row.saturday_end },
    };

    let totalHours = row.currentHours;
    const selectedDate = new Date(dateInput.value + "T00:00:00");

    visibleDays.forEach((day, index) => {
      const dayDate = new Date(selectedDate.getTime() + index * 24 * 3600 * 1000);
      const yyyy = dayDate.getFullYear();
      const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
      const dd = String(dayDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      let hours = parseDayValue(dayValuesMap[day].start, dayValuesMap[day].end);

      if (checkTimeOff(row.positionId, dateStr)) {
        hours = 0;
        tr.appendChild(createCell("Off"));
      } else {
        tr.appendChild(createCell(hours === 0 ? "Off" : hours.toFixed(2)));
      }
      totalHours += hours || 0;
    });

    const totalCell = createCell(totalHours.toFixed(2));
    applyTotalColor(totalCell, totalHours);
    tr.appendChild(totalCell);

    const hoursAvailable = Math.max(40 - row.currentHours, 0);
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

  const dayValuesMap = {
    Sunday:   { start: row.sunday_st,   end: row.sunday_end },
    Monday:   { start: row.monday_st,   end: row.monday_end },
    Tuesday:  { start: row.tuesday_st,  end: row.tuesday_end },
    Wednesday:{ start: row.wednesday_st,end: row.wednesday_end },
    Thursday: { start: row.thursday_st, end: row.thursday_end },
    Friday:   { start: row.friday_st,   end: row.friday_end },
    Saturday: { start: row.saturday_st, end: row.saturday_end },
  };

  visibleDays.forEach((day, index) => {
    const dayDate = new Date(selectedDate.getTime() + index * 24 * 3600 * 1000);
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    let hours = parseDayValue(dayValuesMap[day].start, dayValuesMap[day].end);
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
  console.log("Latest date key from Firebase is:", latestDateKey);

  const [m, d, y] = latestDateKey.split("-");
  const formattedDate = `${y}-${m}-${d}`;
  console.log("Setting date input to:", formattedDate);
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

  console.log("Loading data for:", dateInput.value, " => ", dateKey, "Facility:", facilityFilter);
  const data = await fetchOvertimeData(dateKey, facilityFilter);

  globalData = data;
  currentSortColumn = null;
  currentSortDirection = 'asc';

  console.log("Fetched data (globalData):", globalData);
  renderTable(data, dayOfWeek);
}

// Real-time listener for Time_off data
function listenToTimeOff() {
  const timeOffRef = db.ref("Time_off");
  timeOffRef.on("value", (snapshot) => {
    const val = snapshot.val() || {};
    timeOffData = {};

    // Each entry has { "First Name", "ID", "Last Name", "action", "date" }
    // We only care if action = "Request Off"
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

// Updated parseCSV function to handle tab-delimited data
function parseCSV(content) {
  // If your file truly uses tabs between fields, split on "\t"
  const lines = content.split("\n").map((line) => line.trim());
  // Grab the first line as headers
  const headers = lines.shift().split("\t").map((header) => header.trim());
  console.log("Headers found:", headers);

  const rows = lines.map((line) => {
    const values = line.split("\t");
    return values.reduce((acc, value, index) => {
      acc[headers[index]] = value.trim();
      return acc;
    }, {});
  });
  return rows;
}

// Upload and process the file
async function processFile(file) {
  const selectedDateKey = formatDateForFirebase(dateInput.value);
  const selectedFacility = facilityInput.value;
  if (!selectedDateKey || (!selectedFacility && selectedFacility !== "")) {
    alert("Please select a date and facility before uploading.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (event) {
    const content = event.target.result;
    let rows = [];
    if (file.name.endsWith(".csv")) {
      // Actually treat it as .tsv if your data is tab-delimited:
      rows = parseCSV(content);
    } else if (file.name.endsWith(".xlsx")) {
      // Use XLSX library to parse XLSX file
      const workbook = XLSX.read(content, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      console.log("XLSX Rows found:", rows);
    }

    // Debug: show rows read from file
    console.log("Rows read from file:", rows);

    const positionIdMap = {};

    // Safely handle raw fields as strings:
    rows.forEach((row) => {
      // We look for EXACT keys "Position ID" and "Total Hours"
      //   Adjust these if your columns differ
      const rawPosId = String(row["Position ID"] ?? "");
      const rawTotal = String(row["Total Hours"] ?? "");

      // Remove extra quotes if they exist, e.g. "\"6ZK001631\""
      const cleanedPosId = rawPosId.replace(/"/g, "");
      const cleanedTotal = rawTotal.replace(/"/g, "");

      const positionId = cleanedPosId;
      const totalHours = parseFloat(cleanedTotal);

      console.log("Row check:", { positionId, totalHours });

      if (positionId && !isNaN(totalHours)) {
        positionIdMap[positionId] = totalHours;
      }
    });

    console.log("positionIdMap built from file:", positionIdMap);

    // Fetch existing data from Firebase
    const overtimeRef = db.ref(`Overtime/${selectedDateKey}`);
    const existingSnapshot = await overtimeRef.once("value");
    const existingData = existingSnapshot.val() || {};
    console.log("Existing data at Overtime/" + selectedDateKey, existingData);

    // Update Firebase with new/updated data
    let writeCount = 0;
    for (let [positionId, totalHours] of Object.entries(positionIdMap)) {
      // Only set if there's new or updated hours
      if (!existingData[positionId] || existingData[positionId].Current_Hours !== totalHours) {
        await overtimeRef.child(positionId).set({
          Current_Hours: totalHours,
          Location: selectedFacility,
          Position_ID: positionId,
        });
        writeCount++;
      }
    }

    alert("File processed and data updated successfully. (" + writeCount + " record(s) written)");
    await loadData(); // Reload data to reflect updates
  };

  // If your file is truly tab-delimited, it might still use .csv as extension
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
