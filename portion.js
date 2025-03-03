/***********************************************
 * portion.js
 ***********************************************/

// Initialize Firebase (assuming firebaseConfig is in credd.js)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

// We'll store the fetched tasks here so we can filter or render them
let allFetchedTasks = [];

// For convenience, define an array of allowed tasks
const allowedTasks = [
  "Liquid Sachet Depositing",
  "Dry Sachet Depositing",
  "Tray Portioning and Sealing",
  "Band Sealing",
  "Cup Portioining"
];

/**
 * Listen for real-time changes to a given term's path.
 * Instead of "once('value')", we use "on('value')" to keep the UI up to date.
 */
document.getElementById("fetchDataBtn").addEventListener("click", function () {
  const term = document.getElementById("termInput").value.trim();
  if (!term) {
    alert("Please enter a valid term");
    return;
  }

  // Clear any old data
  document.getElementById("tasksContainer").innerHTML = "Loading...";

  const path = `Master_Task/${term}`;

  // Stop any previous .on() listener so it doesn’t accumulate multiple
  db.ref(path).off("value");

  // Now attach a new realtime listener
  db.ref(path).on("value", (snapshot) => {
    if (!snapshot.exists()) {
      document.getElementById("tasksContainer").innerHTML =
        `No data found for term ${term}`;
      allFetchedTasks = [];
      return;
    }

    const data = snapshot.val();
    let parsedEntries = [];

    if (Array.isArray(data)) {
      parsedEntries = parseArray(term, data);
    } else if (typeof data === "object") {
      parsedEntries = parseDictionary(term, data);
    } else {
      console.log("Unhandled data structure at", path);
    }

    // Store the entire result set
    allFetchedTasks = parsedEntries;

    // Apply front-end filters + re-render
    applyFiltersAndRender();
  }, (error) => {
    console.error("Error reading data:", error);
    document.getElementById("tasksContainer").innerHTML =
      "Error fetching data. Check console.";
  });
});

/**
 * Parse array from Firebase
 * Only keep items where Task is in our allowed tasks array
 */
function parseArray(term, tasksArray) {
  const entries = [];
  tasksArray.forEach((entryDict, index) => {
    if (!allowedTasks.includes(entryDict["Task"])) {
      return;
    }
    entries.push(buildEntry(term, index, entryDict));
  });
  return entries;
}

/**
 * Parse dictionary from Firebase
 * Sort keys numerically (similar to Swift approach)
 * Only keep items where Task is in our allowed tasks array
 */
function parseDictionary(term, tasksDict) {
  const entries = [];
  const sortedKeys = Object.keys(tasksDict).sort((a, b) => {
    const ai = parseInt(a), bi = parseInt(b);
    if (!isNaN(ai) && !isNaN(bi)) {
      return ai - bi;
    }
    return a.localeCompare(b);
  });

  sortedKeys.forEach((key) => {
    const dict = tasksDict[key];
    if (typeof dict === "object") {
      if (!allowedTasks.includes(dict["Task"])) {
        return;
      }
      const index = parseInt(key) || 0;
      entries.push(buildEntry(term, index, dict));
    }
  });

  return entries;
}

/**
 * Convert a time string (e.g. "07:30" or "7:30") to 12-hour format "HH:MM AM/PM"
 */
function formatTimeTo12Hour(timeStr) {
  if (!timeStr) {
    return ""; // if empty, return empty
  }
  
  // Attempt to parse "HH:MM", ignoring seconds if present
  const parts = timeStr.split(":");
  if (parts.length < 2) {
    // If we can't properly split into hours & minutes, return original string
    return timeStr;
  }

  let hours = parseInt(parts[0], 10);
  let minutes = parseInt(parts[1], 10);

  // If parse fails, just return the original string
  if (isNaN(hours) || isNaN(minutes)) {
    return timeStr;
  }

  let ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12

  // Zero-pad hours & minutes
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");

  return `${hh}:${mm} ${ampm}`;
}

/**
 * Determine status based on Start/End times
 *  - "Released": both are empty
 *  - "In Progress": Start is not empty, End is empty
 *  - "Complete": both are not empty
 */
function computeStatus(startStr, endStr) {
  const hasStart = startStr !== "";
  const hasEnd = endStr !== "";

  if (!hasStart && !hasEnd) {
    return "Released";
  } else if (hasStart && !hasEnd) {
    return "In Progress";
  } else if (hasStart && hasEnd) {
    return "Complete";
  }
  // Default fallback
  return "";
}

/**
 * Build one entry object
 */
function buildEntry(term, index, entryDict) {
  // Convert the "Start" and "End" values to 12-hour format
  const rawStart = entryDict["Start"] || "";
  const rawEnd   = entryDict["End"] || "";

  const formattedStart = formatTimeTo12Hour(rawStart);
  const formattedEnd   = formatTimeTo12Hour(rawEnd);

  // Compute status
  const status = computeStatus(rawStart.trim(), rawEnd.trim());

  return {
    id: `${term}-${index}`,
    term: term,
    indexNum: index, // the numeric key in the DB

    facility: entryDict["Facility"] || "",
    meal: entryDict["Meal"] || "",
    cycle: entryDict["Cycle"] || "",
    count: entryDict["Count"] || "",
    product: entryDict["Product"] || "",
    task: entryDict["Task"] || "",
    equipment: entryDict["Equipment"] || "",

    peopleAssigned: entryDict["People Assigned"] || "",

    headcount: entryDict["Headcount"] || "",
    
    // Use the 12-hour format for display
    setup: entryDict["Setup"] || "",
    start: formattedStart,
    breakTime: entryDict["Break"] || "",
    end: formattedEnd,
    cleanup: entryDict["Cleanup"] || "",

    lead: entryDict["Lead"] || "",
    producedQty: entryDict["Produced Qty"] || "",
    day: entryDict["Day"] || "",

    teams: entryDict["Teams"] || "",
    notes: entryDict["Notes"] || "",

    cleanPriorToStart: entryDict["CleanPriorToStart"] === true,
    traysCheck: entryDict["traysCheck"] === true,
    cookingVerification: entryDict["CookingVerification"] || "",
    managerVerification: entryDict["ManagerVerification"] || "",
    cookingDate: entryDict["CookingDate"] || "",
    sampleDelivered: entryDict["SampleDelivered"] || "",
    passSensoryTest: entryDict["PassSensoryTest"] || "",

    // Sleeving fields (or any additional fields)
    numbersOfTrays: entryDict["numbersoftrays"] || "",
    compCheck: entryDict["compchecks"] === true,
    sealsCheck: entryDict["sealscheck"] === true,
    bbd: entryDict["bbd"] || "",
    sleevingqa: entryDict["sleevingqa"] || "",
    sleevinglead: entryDict["sleevinglead"] || "",
    sleevingcloser: entryDict["sleevingcloser"] || "",

    // Status
    status: status,
  };
}

/**
 * Applies additional front-end filters and re-renders the table
 */
function applyFiltersAndRender() {
  const facilityFilter = document.getElementById("facilityInput").value.trim().toLowerCase();
  const productFilter  = document.getElementById("productInput").value.trim().toLowerCase();
  const taskFilter     = document.getElementById("taskInput").value.trim().toLowerCase();
  const mealFilter     = document.getElementById("mealInput").value.trim().toLowerCase();
  const dayFilter      = document.getElementById("dayInput").value.trim().toLowerCase();
  const statusFilter   = document.getElementById("statusInput").value.trim().toLowerCase();

  // Filter in JavaScript
  const filtered = allFetchedTasks.filter((entry) => {
    if (facilityFilter && !entry.facility.toLowerCase().includes(facilityFilter)) return false;
    if (productFilter  && !entry.product.toLowerCase().includes(productFilter))   return false;
    if (taskFilter     && !entry.task.toLowerCase().includes(taskFilter))         return false;
    if (mealFilter     && !entry.meal.toLowerCase().includes(mealFilter))         return false;
    if (dayFilter      && !entry.day.toLowerCase().includes(dayFilter))           return false;
    // New Status filter
    if (statusFilter   && !entry.status.toLowerCase().includes(statusFilter))     return false;
    return true;
  });

  // Render as table
  renderTasksAsTable(filtered);
}

/**
 * Renders tasks as a table with headers, and makes each cell editable
 */
function renderTasksAsTable(taskEntries) {
  const container = document.getElementById("tasksContainer");
  container.innerHTML = "";

  if (taskEntries.length === 0) {
    container.textContent = "No entries match your filters.";
    return;
  }

  // Define the columns & their display labels
  const columns = [
    { key: 'facility',            label: 'Facility' },
    { key: 'meal',                label: 'Meal' },
    { key: 'cycle',               label: 'Cycle' },
    { key: 'count',               label: 'Count' },
    { key: 'product',             label: 'Product' },
    { key: 'task',                label: 'Task' },
    { key: 'equipment',           label: 'Equipment' },
    { key: 'peopleAssigned',      label: 'People Assigned' },
    { key: 'headcount',           label: 'Headcount' },
    { key: 'setup',               label: 'Setup' },
    { key: 'start',               label: 'Start' },
    { key: 'breakTime',           label: 'Break' },
    { key: 'end',                 label: 'End' },
    { key: 'cleanup',             label: 'Cleanup' },
    { key: 'lead',                label: 'Lead' },
    { key: 'producedQty',         label: 'Produced Qty' },
    { key: 'day',                 label: 'Day' },
    { key: 'teams',               label: 'Teams' },
    { key: 'notes',               label: 'Notes' },
    { key: 'cleanPriorToStart',   label: 'Clean Prior?' },
    { key: 'traysCheck', label: 'Tray Check?' },
    { key: 'compCheck',           label: 'Comp Check' },
    { key: 'sealsCheck',          label: 'Seals Check' },
    { key: 'status',              label: 'Status' },
    
    { key: 'cookingVerification', label: 'Cooking Verif.' },
    { key: 'managerVerification', label: 'Manager Verif.' },
    { key: 'cookingDate',         label: 'Cooking Date' },
    { key: 'sampleDelivered',     label: 'Sample Delivered' },
    { key: 'passSensoryTest',     label: 'Sensory Test' },
    { key: 'numbersOfTrays',      label: 'Num of Trays' },
    { key: 'bbd',                 label: 'Best By Date' },
    { key: 'sleevingqa',          label: 'Sleeving QA' },
    { key: 'sleevinglead',        label: 'Sleeving Lead' },
    { key: 'sleevingcloser',      label: 'Sleeving Closer' },

  ];

  // Create the table
  const table = document.createElement("table");
  table.classList.add("data-table");

  // Thead
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement("tbody");
  taskEntries.forEach((entry) => {
    const row = document.createElement("tr");

    columns.forEach((col) => {
      const td = document.createElement("td");
      let value = entry[col.key];

      // Convert boolean to "Yes"/"No"
      if (typeof value === "boolean") {
        value = value ? "Yes" : "No";
      }

      td.textContent = value;

      // Make cell editable
      // (Depending on your use case, you might NOT want the "Status" column itself editable,
      //  but we'll leave it consistent here for demonstration.)
      td.contentEditable = true;
      
      // When user clicks away (blur), update Firebase if changed
      td.addEventListener("blur", () => {
        const newValue = td.textContent.trim();
        const oldValue = entry[col.key];

        // Only update if changed
        if (newValue !== String(oldValue)) {
          // If oldValue was a boolean, interpret "yes"/"true"/"1" as true, else false
          let toStoreValue = newValue;
          if (oldValue === true || oldValue === false) {
            toStoreValue = /^(yes|true|1)$/i.test(newValue);
          }

          updateFieldInFirebase(entry, col.key, toStoreValue);
        }
      });

      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

/**
 * Update a single field in Firebase
 * path: Master_Task/<term>/<index>/<fieldName>
 */
function updateFieldInFirebase(entry, fieldName, newValue) {
  const termKey = entry.term;
  const idx = entry.indexNum; // the numeric key in the DB

  // If the user edits "Start" or "End", they might have changed the time format
  // but we do NOT reconvert here, so it will be stored in DB as typed unless
  // you want to parse it back to 24-hr or store it in 12-hr. 
  // (Adjust logic as desired.)

  const path = `Master_Task/${termKey}/${idx}/${mapToFirebaseField(fieldName)}`;
  db.ref(path).set(newValue, (error) => {
    if (error) {
      console.error("Error updating field:", error);
    } else {
      showNotification("Update successful");
    }
  });
}

/**
 * Optionally map your local keys to the exact DB field name
 */
function mapToFirebaseField(fieldName) {
  switch (fieldName) {
    // Fields that differ due to spaces or casing:
    case "peopleAssigned":  return "People Assigned";
    case "producedQty":     return "Produced Qty";

    // Sleeving fields that differ
    case "numbersOfTrays":  return "numbersoftrays";   // JavaScript vs DB
    case "compCheck":       return "compchecks";
    case "sealsCheck":      return "sealscheck";

    // "status" is not typically in DB, so no mapping. 
    // If you don't want it saved, you might exclude it from editing.

    default:
      return fieldName;
  }
}

/**
 * Show a "Update successful" notification top-right for 3 seconds
 */
function showNotification(message) {
  const note = document.createElement("div");
  note.textContent = message;
  // Basic style
  note.style.position = "fixed";
  note.style.top = "20px";
  note.style.right = "20px";
  note.style.background = "green";
  note.style.color = "white";
  note.style.padding = "10px 20px";
  note.style.borderRadius = "5px";
  note.style.fontSize = "1rem";
  note.style.zIndex = 9999;

  document.body.appendChild(note);

  // Remove after 3 seconds
  setTimeout(() => {
    note.remove();
  }, 3000);
}
