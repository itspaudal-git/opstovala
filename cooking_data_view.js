// Initialize Firebase (already done in credd.js)

// Reference to the Firebase Realtime Database
const database = firebase.database();

// Function to fetch and display cooking and cooling data in real-time
function fetchCookingData() {
  const tableBody = document.querySelector("#data-table tbody");
  const termKey = document.getElementById("termKey").value.trim();

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
            <td>${cookingData.equipment || ""}</td>
            <td>${cookingData.cartNumber || ""}</td>
            <td>${cookingData.cookingTemp || ""}</td>
            <td>${cookingData.ccpMet || ""}</td>
            <td>${cookingData.initials || ""}</td>
            <td>${cookingData.correctiveActions || ""}</td>
            <td>${cookingData.stage1TimeBelow135 || ""}</td>
            <td>${cookingData.stage1Cooling1 || ""}</td>
            <td>${cookingData.stage1Cooling1Time || ""}</td>
            <td>${cookingData.stage1Cooling2 || ""}</td>
            <td>${cookingData.stage1Cooling2Time || ""}</td>
            <td>${cookingData.stage2Cooling3 || ""}</td>
            <td>${cookingData.stage2Cooling3Time || ""}</td>
            <td>${cookingData.stage2Cooling4 || ""}</td>
            <td>${cookingData.stage2Cooling4Time || ""}</td>
            <td>${cookingData.stage2Cooling5 || ""}</td>
            <td>${cookingData.stage2Cooling5Time || ""}</td>
            <td>${cookingData.stage2Cooling6 || ""}</td>
            <td>${cookingData.stage2Cooling6Time || ""}</td>
          `;

          // Append the row to the table
          tableBody.appendChild(row);
        }
      }
    });
  }, (error) => {
    console.error("Error fetching data: ", error);
    alert("An error occurred while fetching data.");
  });
}

// Call the function to start listening for real-time updates
fetchCookingData();