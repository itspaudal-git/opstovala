// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  } else {
    firebase.app();
  }
  
  const dbRef = firebase.database().ref("Packout");
  
  // Predefined linehaul columns
  const tubewayLinehauls = [
    "LEW", "CAL", "VEHO PHY", "OCA", "OLB", "UDS", "FedEx CHI", "UPS - UPC"
  ];
  const westvalaLinehauls = [
    "AXL - SFO", "AXL - LAX", "OnTrac Reno", "FedEx Dallas",
    "Veho", "FedEx- SLC", "UPS - SLC", "OnTrac - SLC"
  ];
  
  // On DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    const termInput = document.getElementById("calculatedTerm");
    const facilitySelect = document.getElementById("searchFacility");
    const cycleSelect = document.getElementById("searchCycle");
    const lineSelect = document.getElementById("searchLine");
    const daySelect = document.getElementById("searchDay"); // New Day filter
    const btnSearch = document.getElementById("btnSearch");
    const resultsTable = document.getElementById("resultsTable");
  
    // Calculate the current term automatically, then allow user to override
    const currentTerm = calculateCurrentTerm();
    termInput.value = currentTerm; // user can still edit
  
    // Function to fetch and render data based on filters
    const fetchAndRenderData = async () => {
      const termVal = termInput.value.trim();
      const facilityVal = facilitySelect.value;
      const cycleVal = cycleSelect.value;
      const lineVal = lineSelect.value;
      const dayVal = daySelect.value; // New Day filter value
  
      if (!termVal) {
        alert("Please enter a valid Term.");
        return;
      }
  
      // Clear table before new search
      resultsTable.innerHTML = "";
  
      try {
        // Pull data from DB: Packout/{termVal}
        const termSnap = await dbRef.child(termVal).once("value");
        if (!termSnap.exists()) {
          // No data for that term => show empty table with headers
          renderTableHeaders(resultsTable, facilityVal);
          return;
        }
  
        // We'll gather rows from selected facility (or all), day arrays, etc.
        const facilitiesData = termSnap.val();
        const facilityKeys = (facilityVal === "All")
          ? Object.keys(facilitiesData)
          : [facilityVal];
  
        let allRows = [];
  
        facilityKeys.forEach(facKey => {
          const dayObject = facilitiesData[facKey];
          if (!dayObject) return; // This facility not in data
  
          // Filter by day if needed
          Object.keys(dayObject).forEach(day => {
            if (dayVal !== "All" && day !== dayVal) {
              return; // Skip if day doesn't match
            }
  
            const maybeArr = dayObject[day];
            if (Array.isArray(maybeArr)) {
              maybeArr.forEach(slotObj => {
                // Filter by cycle if needed
                if (cycleVal !== "All" && slotObj["Cycle"] !== cycleVal) {
                  return;
                }
                // Filter by line if needed
                if (lineVal !== "All" && slotObj["Line"] !== lineVal) {
                  return;
                }
                // Keep it
                allRows.push(slotObj);
              });
            }
          });
        });
  
        // Now build table
        renderTableHeaders(resultsTable, facilityVal);
  
        const tBody = document.createElement("tbody");
        allRows.forEach(row => {
          const tr = document.createElement("tr");
  
          // Term
          const tdTerm = document.createElement("td");
          tdTerm.textContent = row["Term"] || "";
          tr.appendChild(tdTerm);
  
          // Facility
          const tdFac = document.createElement("td");
          tdFac.textContent = row["Facility"] || "";
          tr.appendChild(tdFac);
  
          // Cycle
          const tdCycle = document.createElement("td");
          tdCycle.textContent = row["Cycle"] || "";
          tr.appendChild(tdCycle);
  
          // Line
          const tdLine = document.createElement("td");
          tdLine.textContent = row["Line"] || "";
          tr.appendChild(tdLine);
  
          // Slotmap
          const tdSlotmap = document.createElement("td");
          tdSlotmap.textContent = row["Slotmap"] || "";
          tr.appendChild(tdSlotmap);
  
          // Decide which linehauls to show
          let columnsToShow = [];
          if (facilityVal === "All") {
            columnsToShow = [...tubewayLinehauls, ...westvalaLinehauls];
          } else if (facilityVal === "Tubeway") {
            columnsToShow = tubewayLinehauls;
          } else if (facilityVal === "Westvala") {
            columnsToShow = westvalaLinehauls;
          }
          columnsToShow.forEach(colName => {
            const td = document.createElement("td");
            td.textContent = row[colName] || "";
            tr.appendChild(td);
          });
  
          tBody.appendChild(tr);
        });
  
        resultsTable.appendChild(tBody);
  
      } catch (err) {
        console.error("Error reading data from Firebase:", err);
        alert("Error reading data from Firebase. See console for details.");
      }
    };
  
    // Set up real-time listener
    const setupRealtimeListener = () => {
      const termVal = termInput.value.trim();
      if (!termVal) return;
  
      dbRef.child(termVal).on("value", (snapshot) => {
        fetchAndRenderData();
      });
    };
  
    // On Search button click
    btnSearch.addEventListener("click", () => {
      fetchAndRenderData();
      setupRealtimeListener();
    });
  
    // Initial fetch and render
    fetchAndRenderData();
    setupRealtimeListener();
  });
  
  /**
   * Renders the <thead> for the table:
   * Term,Facility,Cycle,Line,Slotmap, plus linehaul columns.
   */
  function renderTableHeaders(tableElem, facilityVal) {
    tableElem.innerHTML = "";
  
    const tHead = document.createElement("thead");
    const tr = document.createElement("tr");
  
    // Base columns
    const baseHeaders = ["Term", "Facility", "Cycle", "Line", "Slotmap"];
    baseHeaders.forEach(hdr => {
      const th = document.createElement("th");
      th.textContent = hdr;
      tr.appendChild(th);
    });
  
    // Decide which linehauls to show
    let columnsToShow = [];
    if (facilityVal === "All") {
      columnsToShow = [...tubewayLinehauls, ...westvalaLinehauls];
    } else if (facilityVal === "Tubeway") {
      columnsToShow = tubewayLinehauls;
    } else if (facilityVal === "Westvala") {
      columnsToShow = westvalaLinehauls;
    }
  
    columnsToShow.forEach(linehaul => {
      const th = document.createElement("th");
      th.textContent = linehaul;
      tr.appendChild(th);
    });
  
    tHead.appendChild(tr);
    tableElem.appendChild(tHead);
  }
  
  /**
   * Function to calculate the current term number based on the current week.
   * Adjust baseTerm and startDate as needed.
   */
  function calculateCurrentTerm() {
    const baseTerm = 403; // Starting term
    const startDate = new Date('2024-09-15'); // Starting date of term 403
    const currentDate = new Date();
  
    // Calculate weeks difference
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksPassed = Math.floor((currentDate - startDate) / msPerWeek);
  
    return baseTerm + weeksPassed;
  }