/***********************************************
 * sleeving.js
 ***********************************************/

// Initialize Firebase (assuming firebaseConfig is in credd.js)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  const db = firebase.database();
  
  // We'll store the fetched tasks here so we can filter or render them
  let allFetchedTasks = [];
  
  /**
   * Listen for real-time changes to a given term's path.
   * So instead of "once('value')", we do "on('value')" to keep the UI up to date.
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
   * Only keep items where "Task" == "Sleeving"
   */
  function parseArray(term, tasksArray) {
    const entries = [];
    tasksArray.forEach((entryDict, index) => {
      // If you only want "Sleeving" tasks, skip others:
      if (entryDict["Task"] !== "Sleeving") return;
      entries.push(buildEntry(term, index, entryDict));
    });
    return entries;
  }
  
  /**
   * Parse dictionary from Firebase
   * Sort keys numerically (similar to Swift approach)
   * Only keep items where "Task" == "Sleeving"
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
        // If not "Sleeving", skip
        if (dict["Task"] !== "Sleeving") return;
  
        const index = parseInt(key) || 0;
        entries.push(buildEntry(term, index, dict));
      }
    });
  
    return entries;
  }
  
  /**
   * Build one entry object
   */
  function buildEntry(term, index, entryDict) {
    return {
      id: `${term}-${index}`,
      term: term,
      // We'll need the original index for updates to the DB path
      // e.g. Master_Task/<term>/<index>/<fieldName>
      indexNum: index,
  
      facility: entryDict["Facility"] || "",
      meal: entryDict["Meal"] || "",
      cycle: entryDict["Cycle"] || "",
      count: entryDict["Count"] || "",
      product: entryDict["Product"] || "",
      task: entryDict["Task"] || "",
      equipment: entryDict["Equipment"] || "",
  
      peopleAssigned: entryDict["People Assigned"] || "",
  
      headcount: entryDict["Headcount"] || "",
      setup: entryDict["Setup"] || "",
      start: entryDict["Start"] || "",
      breakTime: entryDict["Break"] || "",
      end: entryDict["End"] || "",
      cleanup: entryDict["Cleanup"] || "",
  
      lead: entryDict["Lead"] || "",
      producedQty: entryDict["Produced Qty"] || "",
      day: entryDict["Day"] || "",
  
      teams: entryDict["Teams"] || "",
      notes: entryDict["Notes"] || "",
  
      cleanPriorToStart: entryDict["CleanPriorToStart"] === true,
      ingredientsVerified: entryDict["IngredientsVerified"] === true,
      cookingVerification: entryDict["CookingVerification"] || "",
      managerVerification: entryDict["ManagerVerification"] || "",
      cookingDate: entryDict["CookingDate"] || "",
      sampleDelivered: entryDict["SampleDelivered"] || "",
      passSensoryTest: entryDict["PassSensoryTest"] || "",
  
      // Sleeve_Tray
      sleeve_Tray1: entryDict["Sleeve_Tray1"] || "",
      sleeve_Tray2: entryDict["Sleeve_Tray2"] || "",
      sleeve_Tray3: entryDict["Sleeve_Tray3"] || "",
      sleeve_Tray4: entryDict["Sleeve_Tray4"] || "",
  
      // Garnish
      garnish1: entryDict["Garnish1"] || "",
      garnish2: entryDict["Garnish2"] || "",
      garnish3: entryDict["Garnish3"] || "",
      garnish4: entryDict["Garnish4"] || "",
      garnish5: entryDict["Garnish5"] || "",
      garnish6: entryDict["Garnish6"] || "",
      garnish7: entryDict["Garnish7"] || "",
      garnish8: entryDict["Garnish8"] || "",
      garnish9: entryDict["Garnish9"] || "",
      garnish10: entryDict["Garnish10"] || "",
      garnish11: entryDict["Garnish11"] || "",
      garnish12: entryDict["Garnish12"] || "",
      garnish13: entryDict["Garnish13"] || "",
      garnish14: entryDict["Garnish14"] || "",
      garnish15: entryDict["Garnish15"] || "",
      garnish16: entryDict["Garnish16"] || "",
  
      // Sleeving fields
      numbersOfTrays: entryDict["numbersoftrays"] || "",
      compCheck: entryDict["compchecks"] === true,
      sealsCheck: entryDict["sealscheck"] === true,
      bbd: entryDict["bbd"] || "",
      sleevingqa: entryDict["sleevingqa"] || "",
      sleevinglead: entryDict["sleevinglead"] || "",
      sleevingcloser: entryDict["sleevingcloser"] || "",
  
      hour_1: entryDict["hour_1"] || "",
      hour_2: entryDict["hour_2"] || "",
      hour_3: entryDict["hour_3"] || "",
      hour_4: entryDict["hour_4"] || "",
      hour_5: entryDict["hour_5"] || "",
      hour_6: entryDict["hour_6"] || "",
      hour_7: entryDict["hour_7"] || "",
      hour_8: entryDict["hour_8"] || "",
      hour_9: entryDict["hour_9"] || "",
      hour_10: entryDict["hour_10"] || "",
      hour_11: entryDict["hour_11"] || "",
      hour_12: entryDict["hour_12"] || "",
    };
  }
  
  /**
   * Applies additional front-end filters (facility, product, etc.) and then renders as table
   */
  function applyFiltersAndRender() {
    const facilityFilter = document.getElementById("facilityInput").value.trim().toLowerCase();
    const productFilter  = document.getElementById("productInput").value.trim().toLowerCase();
    const taskFilter     = document.getElementById("taskInput").value.trim().toLowerCase();
    const mealFilter     = document.getElementById("mealInput").value.trim().toLowerCase();
    const dayFilter      = document.getElementById("dayInput").value.trim().toLowerCase();
  
    // Filter in JavaScript
    const filtered = allFetchedTasks.filter((entry) => {
      if (facilityFilter && !entry.facility.toLowerCase().includes(facilityFilter)) return false;
      if (productFilter  && !entry.product.toLowerCase().includes(productFilter))   return false;
      if (taskFilter     && !entry.task.toLowerCase().includes(taskFilter))         return false;
      if (mealFilter     && !entry.meal.toLowerCase().includes(mealFilter))         return false;
      if (dayFilter      && !entry.day.toLowerCase().includes(dayFilter))           return false;
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
      { key: 'ingredientsVerified', label: 'Ingredients OK?' },
      { key: 'cookingVerification', label: 'Cooking Verif.' },
      { key: 'managerVerification', label: 'Manager Verif.' },
      { key: 'cookingDate',         label: 'Cooking Date' },
      { key: 'sampleDelivered',     label: 'Sample Delivered' },
      { key: 'passSensoryTest',     label: 'Sensory Test' },
  
      // Sleeve_Tray
      { key: 'sleeve_Tray1', label: 'Component 1' },
      { key: 'sleeve_Tray2', label: 'Comp 1 Trays' },
      { key: 'sleeve_Tray3', label: 'Component 2' },
      { key: 'sleeve_Tray4', label: 'Comp 2 Trays' },
  
      // Garnish
      { key: 'garnish1',  label: 'Garnish1' },
      { key: 'garnish2',  label: 'Garnish2' },
      { key: 'garnish3',  label: 'Garnish3' },
      { key: 'garnish4',  label: 'Garnish4' },
      { key: 'garnish5',  label: 'Garnish5' },
      { key: 'garnish6',  label: 'Garnish6' },
      { key: 'garnish7',  label: 'Garnish7' },
      { key: 'garnish8',  label: 'Garnish8' },
      { key: 'garnish9',  label: 'Garnish9' },
      { key: 'garnish10', label: 'Garnish10' },
      { key: 'garnish11', label: 'Garnish11' },
      { key: 'garnish12', label: 'Garnish12' },
      { key: 'garnish13', label: 'Garnish13' },
      { key: 'garnish14', label: 'Garnish14' },
      { key: 'garnish15', label: 'Garnish15' },
      { key: 'garnish16', label: 'Garnish16' },
  
      // Sleeving fields
      { key: 'numbersOfTrays', label: 'Num of Trays' },
      { key: 'compCheck',      label: 'Comp Check' },
      { key: 'sealsCheck',     label: 'Seals Check' },
      { key: 'bbd',            label: 'Best By Date' },
      { key: 'sleevingqa',     label: 'Sleeving QA' },
      { key: 'sleevinglead',   label: 'Sleeving Lead' },
      { key: 'sleevingcloser', label: 'Sleeving Closer' },
  
      // Hours
      { key: 'hour_1',  label: 'Hour 1' },
      { key: 'hour_2',  label: 'Hour 2' },
      { key: 'hour_3',  label: 'Hour 3' },
      { key: 'hour_4',  label: 'Hour 4' },
      { key: 'hour_5',  label: 'Hour 5' },
      { key: 'hour_6',  label: 'Hour 6' },
      { key: 'hour_7',  label: 'Hour 7' },
      { key: 'hour_8',  label: 'Hour 8' },
      { key: 'hour_9',  label: 'Hour 9' },
      { key: 'hour_10', label: 'Hour 10' },
      { key: 'hour_11', label: 'Hour 11' },
      { key: 'hour_12', label: 'Hour 12' }
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
        td.contentEditable = true;
        
        // When user clicks away (blur), update Firebase if changed
        td.addEventListener("blur", () => {
          const newValue = td.textContent.trim();
          const oldValue = entry[col.key];
  
          // Only update if changed
          if (newValue !== oldValue.toString()) {
            // If oldValue was a boolean, convert "Yes"/"No"
            let toStoreValue = newValue;
            if (oldValue === true || oldValue === false) {
              // interpret "yes" or "true" or "1" as true, else false
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
   * (If your local property matches the DB name exactly, you can return fieldName directly.)
   */
  function mapToFirebaseField(fieldName) {
    switch (fieldName) {
      // Fields that differ due to spaces or casing:
      case "peopleAssigned":  return "People Assigned";
      case "producedQty":     return "Produced Qty";
  
      // Sleeve_Tray (underscores vs. capital letters)
      case "sleeve_Tray1":    return "Sleeve_Tray1";
      case "sleeve_Tray2":    return "Sleeve_Tray2";
      case "sleeve_Tray3":    return "Sleeve_Tray3";
      case "sleeve_Tray4":    return "Sleeve_Tray4";
  
      // Garnish
      case "garnish1":        return "Garnish1";
      case "garnish2":        return "Garnish2";
      case "garnish3":        return "Garnish3";
      case "garnish4":        return "Garnish4";
      case "garnish5":        return "Garnish5";
      case "garnish6":        return "Garnish6";
      case "garnish7":        return "Garnish7";
      case "garnish8":        return "Garnish8";
      case "garnish9":        return "Garnish9";
      case "garnish10":       return "Garnish10";
      case "garnish11":       return "Garnish11";
      case "garnish12":       return "Garnish12";
      case "garnish13":       return "Garnish13";
      case "garnish14":       return "Garnish14";
      case "garnish15":       return "Garnish15";
      case "garnish16":       return "Garnish16";
  
      // New Sleeving fields that differ
      case "numbersOfTrays":  return "numbersoftrays";   // JavaScript vs DB
      case "compCheck":       return "compchecks";
      case "sealsCheck":      return "sealscheck";
  
      // If the local property name and DB key are the same, just do:
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
  