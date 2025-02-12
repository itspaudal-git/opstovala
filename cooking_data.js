// Initialize Firebase (already done in credd.js)

// Reference to the Firebase Realtime Database
const database = firebase.database();

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

// Function to fetch and display cooking and cooling data in real-time
function fetchCookingData() {
  const tableBody = document.querySelector("#data-table tbody");
  const termKeyInput = document.getElementById("termKey");
  const termKey = termKeyInput.value.trim() || calculateCurrentTerm();

  // Set the calculated term key in the input field
  termKeyInput.value = termKey;

  // Clear existing table rows
  tableBody.innerHTML = "";

  if (!termKey) {
    alert("Please enter a valid Term Key.");
    return;
  }

  // Reference to the specific termKey in Firebase
  const cookingRef = database.ref(`Master_Task/${termKey}`);

  // Listen for real-time changes
  cookingRef.on("value", (snapshot) => {
    // Clear existing table rows
    tableBody.innerHTML = "";

    if (!snapshot.exists()) {
      alert("No data found for the provided Term Key.");
      return;
    }

    snapshot.forEach((entrySnapshot) => {
      const entryKey = entrySnapshot.key;
      const entryData = entrySnapshot.val();

      // Iterate through all child nodes to find Cooking_Cooling, Cooking_Cooling1, Cooking_Cooling2, etc.
      for (const key in entryData) {
        if (key.startsWith("Cooking_Cooling")) {
          const cookingData = entryData[key];

          // Create a new row for the table
          const row = document.createElement("tr");

          // Add data to the row
          row.innerHTML = `
            <td>${termKey}</td>
            <td>${entryData.Meal || ""}</td>
            <td>${entryData.Product || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/equipment">${cookingData.equipment || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/cartNumber">${cookingData.cartNumber || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/cookingTemp">${cookingData.cookingTemp || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/ccpMet">${cookingData.ccpMet || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/initials">${cookingData.initials || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/correctiveActions">${cookingData.correctiveActions || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage1TimeBelow135">${cookingData.stage1TimeBelow135 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage1Cooling1">${cookingData.stage1Cooling1 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage1Cooling1Time">${cookingData.stage1Cooling1Time || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage1Cooling2">${cookingData.stage1Cooling2 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage1Cooling2Time">${cookingData.stage1Cooling2Time || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage1_manager_verification">${cookingData.stage1_manager_verification || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling3">${cookingData.stage2Cooling3 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling3Time">${cookingData.stage2Cooling3Time || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling4">${cookingData.stage2Cooling4 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling4Time">${cookingData.stage2Cooling4Time || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling5">${cookingData.stage2Cooling5 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling5Time">${cookingData.stage2Cooling5Time || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling6">${cookingData.stage2Cooling6 || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2Cooling6Time">${cookingData.stage2Cooling6Time || ""}</td>
            <td class="editable" data-path="${termKey}/${entryKey}/${key}/stage2_manager_verification">${cookingData.stage2_manager_verification || ""}</td>
          `;

          // Append the row to the table
          tableBody.appendChild(row);
        }
      }
    });

    // Add event listeners for editable cells
    addEditListeners();
  }, (error) => {
    console.error("Error fetching data: ", error);
    alert("An error occurred while fetching data.");
  });
}

// Function to add event listeners for editable cells
function addEditListeners() {
  const editableCells = document.querySelectorAll(".editable");

  editableCells.forEach((cell) => {
    cell.addEventListener("click", () => {
      cell.contentEditable = true;
      cell.focus();
    });

    cell.addEventListener("blur", () => {
      cell.contentEditable = false;
      const newValue = cell.textContent.trim();
      const path = cell.getAttribute("data-path");

      // Update Firebase
      database.ref(`Master_Task/${path}`).set(newValue, (error) => {
        if (error) {
          console.error("Error updating data: ", error);
        } else {
          // Show "Saved" indicator
          const savedIndicator = document.getElementById("saved-indicator");
          savedIndicator.style.display = "block";
          setTimeout(() => {
            savedIndicator.style.display = "none";
          }, 2000); // Hide after 2 seconds
        }
      });
    });
  });
}

// Automatically fetch data for the calculated current term on page load
document.addEventListener("DOMContentLoaded", fetchCookingData);
