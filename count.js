document.getElementById('term-form').addEventListener('submit', function(e) {
  e.preventDefault(); // Prevent the form from submitting
  const term = document.getElementById('term').value;
  
  if (term) {
    populateData(term);
  } else {
    alert('Please enter a term.');
  }
});

async function populateData(apiNumber) {
  const facility_networks = ['chicago', 'slc'];
  const tableBody = document.getElementById('table-body');
  
  // Clear previous data
  tableBody.innerHTML = '';

  // Initialize totals
  let slcCycle1Total = 0, slcCycle2Total = 0, chicagoCycle1Total = 0, chicagoCycle2Total = 0, countTotalMeals = 0;

  const sheetData = await getSheetData(); // Fetch data from the "Count" sheet

  facility_networks.forEach(network => {
    fetch(`https://misevala-api.tvla.co/v0/productionRecords/${apiNumber}?facilityNetwork=${network}`)
      .then(response => response.json())
      .then(json => {
        for (let cycle_number = 1; cycle_number <= 2; cycle_number++) {
          const cycle = json.cycles[cycle_number.toString()].meals;

          cycle.forEach(meal => {
            const row = document.createElement('tr');
            
            // Get Original Count based on Cycle
            const originalCount = getOriginalCount(sheetData, network, meal.mealCode, cycle_number);
            const totalMeals = meal.totalMeals || 0;

            // Ensure proper comparison
            const originalCountValue = parseInt(originalCount) || 0;
            const totalMealsValue = parseInt(totalMeals) || 0;

            // Highlight the row if Total Meals and Original Count are different
            const highlightStyle = (totalMealsValue !== originalCountValue) ? 'background-color: #fdd;' : '';

            // Create the table row with input fields for GLP1 and Count Update
            row.innerHTML = `
              <td>${network}</td>
              <td>${meal.mealCode}</td>
              <td>${cycle_number}</td>
              <td style="${highlightStyle}">${meal.shortTitle}</td>
              <td>${meal.id}</td>
              <td>${totalMeals}</td>
              <td class="original-count">${originalCount}</td>
              <td><input type="number" class="glp1-input" data-original-count="${originalCount}" value="0"></td>
              <td class="count-update">${originalCount}</td>
            `;
            tableBody.appendChild(row);

            // Calculate totals based on network and cycle
            if (network === 'slc' && cycle_number === 1) slcCycle1Total += totalMeals;
            if (network === 'slc' && cycle_number === 2) slcCycle2Total += totalMeals;
            if (network === 'chicago' && cycle_number === 1) chicagoCycle1Total += totalMeals;
            if (network === 'chicago' && cycle_number === 2) chicagoCycle2Total += totalMeals;

            countTotalMeals += totalMeals;
          });
        }
        addGLP1EventListeners(); // Attach event listeners after populating the table

        // Update totals on the right
        document.getElementById('slc-cycle1-total').textContent = slcCycle1Total;
        document.getElementById('slc-cycle2-total').textContent = slcCycle2Total;
        document.getElementById('chicago-cycle1-total').textContent = chicagoCycle1Total;
        document.getElementById('chicago-cycle2-total').textContent = chicagoCycle2Total;
        // document.getElementById('count-total-meals').textContent = countTotalMeals;
      })
      .catch(error => console.error('Error fetching data:', error));
  });
}

// Function to fetch data from Google Sheets
async function getSheetData() {
  const sheetId = '13D1yI4rg5ytHAYUs6t1ETRrfBrSyi4gyBomo_KwAEjk';
  const apiKey = 'AIzaSyD88EDpKFf-3d1lSuN9a-qUtvUd-HRF8hY';
  const sheetName = 'Count';
  const range = 'A:F'; 

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${range}?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.values;
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return null;
  }
}

// Function to get Original Count based on the conditions
function getOriginalCount(sheetData, network, mealNo, cycleNumber) {
  if (!sheetData) return '-';

  // Iterate over the rows in the sheet data
  for (let i = 1; i < sheetData.length; i++) {
    const sheetMealNo = sheetData[i][0];  // Column A in the sheet (Meal No)
    const sheetNetwork = sheetData[i][4]; // Column E in the sheet (Network)
    const originalCountCycle1 = sheetData[i][2]; // Column C for Cycle 1
    const originalCountCycle2 = sheetData[i][3]; // Column D for Cycle 2

    // Check if the Network and Meal No match, and get the Original Count based on the Cycle
    if (sheetNetwork === network && sheetMealNo == mealNo) {
      if (cycleNumber === 1) {
        return originalCountCycle1 || '-'; // Return value from Column C for Cycle 1
      } else if (cycleNumber === 2) {
        return originalCountCycle2 || '-'; // Return value from Column D for Cycle 2
      }
    }
  }
  return '-';
}

// Function to add event listeners to GLP1 inputs
function addGLP1EventListeners() {
  const glp1Inputs = document.querySelectorAll('.glp1-input');

  glp1Inputs.forEach(input => {
    input.addEventListener('input', function() {
      const originalCount = parseInt(this.dataset.originalCount);
      const glp1Value = parseInt(this.value) || 0;
      const countUpdate = originalCount + glp1Value;

      // Update the Count Update column
      const countUpdateCell = this.parentElement.nextElementSibling;
      countUpdateCell.textContent = countUpdate;
    });
  });
}

async function updateTotalMeals(apiNumber) {
  const tableRows = document.querySelectorAll("#data-table tbody tr");
  const loadingMessage = document.getElementById('loading-message');
  const successMessage = document.getElementById('success-message');

  // Show the loading message
  loadingMessage.style.display = 'block';
  successMessage.style.display = 'none';

  let updateCount = 0;

  tableRows.forEach((row, index) => {
    const mealID = row.cells[4].textContent; // mealID is the ID column (cell 5)
    const totalMeals = row.cells[8].textContent; // Count Update value is in cell 9
    const shortTitle = row.cells[3].textContent; // Short Title is in cell 4

    // Check if totalMeals is valid and can be pushed
    if (totalMeals !== undefined && totalMeals !== null && totalMeals !== 0 && !isNaN(totalMeals)) {  
      const data = {
        "totalMeals": parseInt(totalMeals), // Ensure it's a number
        "shortTitle": shortTitle // Include shortTitle in the payload
      };

      const options = {
        "method": "PUT",
        "body": JSON.stringify(data),
        "headers": { "Content-Type": "application/json" }
      };

      // Construct the API endpoint with termID and mealID
      const url = `https://misevala-api.tvla.co/v0/productionRecords/${apiNumber}/productionMeals/${mealID}`;

      // Send the PUT request
      fetch(url, options)
        .then(response => {
          if (response.ok) {
            updateCount++;
          } else {
            // Log error details
            return response.json().then(errorData => {
              console.error(`Error with ${mealID}: ${response.status} ${response.statusText}`, errorData);
            });
          }
          if (index === tableRows.length - 1) {
            // Hide loading and show success message after all updates
            loadingMessage.style.display = 'none';
            successMessage.style.display = 'block';
          }
        })
        .catch(error => {
          console.error('Error during fetch: ', error);
          // Hide loading and show success message after all updates
          loadingMessage.style.display = 'none';
          successMessage.style.display = 'block';
        });
    } else {
      console.log(`Skipping row ${index + 1} due to invalid totalMeals:`, totalMeals);
    }
  });
}


// Button click event to trigger the update function
document.getElementById('update-button').addEventListener('click', function() {
  const termID = document.getElementById('term').value;
  updateTotalMeals(termID); // Push updates for the current term
});
