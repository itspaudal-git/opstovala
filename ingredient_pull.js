let tableData = []; // Store the fetched data globally
let sortState = {}; // Track sorting state for each column

// Fetch Data Button Event Listener
document.getElementById('fetchButton').addEventListener('click', async function () {
    const term = document.getElementById('termInput').value;
    const facility = document.getElementById('facilitySelect').value;

    if (!term) {
        alert('Please enter a term.');
        return;
    }

    try {
        // Fetch production records from the API
        const productionRecordUrl = `https://misevala-api.tvla.co/v0/productionRecords/${term}?facilityNetwork=${facility}`;
        const productionRecordResponse = await fetch(productionRecordUrl);
        if (!productionRecordResponse.ok) {
            throw new Error(`API request failed with status: ${productionRecordResponse.status}`);
        }
        const productionRecord = await productionRecordResponse.json();

        // Log the API response for debugging
        console.log('API Response:', productionRecord);

        // Validate the production record data
        if (!productionRecord || !productionRecord.cycles || !productionRecord.cycles['1'] || !productionRecord.cycles['2']) {
            throw new Error('Invalid production record data: Missing cycles or meals');
        }

        // Fetch ignore list from GitHub
        const ignoreListUrl = 'https://raw.githubusercontent.com/itspaudal-git/ignore_list/main/ignore_wips.json';
        const ignoreListResponse = await fetch(ignoreListUrl);
        if (!ignoreListResponse.ok) {
            throw new Error('Failed to fetch ignore list data');
        }
        const ignoreList = await ignoreListResponse.json();

        // Convert ignore list "Product" into a list
        const ignoreProducts = ignoreList.map(item => item.Product);

        // Process the data (similar to your Python logic)
        const cycles = productionRecord.cycles;
        const cycle1Meals = cycles['1'].meals;
        const cycle2Meals = cycles['2'].meals;
        const cycle1Parts = cycles['1'].parts;

        const partData = [];
        for (const part of cycle1Parts) {
            const tags = part.tags;
            const productTitle = part.title.split(" - ")[0];

            for (const tag of tags) {
                const category = tag.category;
                const title = tag.title;

                if (category === "mix" && ["batch_mix", "sauce_mix", "planetary_mixer"].some(keyword => title.includes(keyword))) {
                    partData.push(productTitle);
                } else if (category === "cook" && ["kettle", "oven"].some(keyword => title.includes(keyword))) {
                    partData.push(productTitle);
                } else if (category === "manual" && title.includes("vcm")) {
                    partData.push(productTitle);
                }
            }
        }

        const allProductTitles = [...new Set(partData)]; // Remove duplicates
        tableData = []; // Reset table data

        for (const [c1, c2] of zip(cycle1Meals, cycle2Meals)) {
            const mealCode1 = c1.mealCode;
            const mealCode2 = c2.mealCode;
            const billOfMaterials1 = c1.billOfMaterials;
            const billOfMaterials2 = c2.billOfMaterials;

            for (const [bom1, bom2] of zip(billOfMaterials1, billOfMaterials2)) {
                const name = bom1.title.split(" - 2")[0];
                if (allProductTitles.includes(name) || ignoreProducts.includes(name)) {
                    continue;
                }

                const weight1 = bom1.totalWeightRequiredPounds;
                const weight2 = bom2.totalWeightRequiredPounds;

                const tagsBom1 = bom1.tags;
                const tagsBom2 = bom2.tags;

                const portionLocationBom1 = extractTagValue(tagsBom1, "portion_location");
                const portionDateBom1 = extractTagValue(tagsBom1, "portion_date");
                const portionLocationBom2 = extractTagValue(tagsBom2, "portion_location");
                const portionDateBom2 = extractTagValue(tagsBom2, "portion_date");

                for (const item of tagsBom1) {
                    if (item.category === "container") {
                        const containerTitle = item.title;
                        let task = null;

                        if (["bag", "tray 1 bag", "tray 2 bag"].includes(containerTitle)) {
                            task = "Bandsealing";
                        } else if (["tray 1", "tray 2", "tray 1 sealed body armor", "tray 2 sealed body armor", "sealed body armor"].includes(containerTitle)) {
                            task = "Tray Sealing";
                        } else if (containerTitle === "dry sachet") {
                            task = "Dry Sachet";
                        } else if (containerTitle === "sachet") {
                            task = "Liquid Sachet";
                        } else if (["1 oz cup", "2 oz cup", "2 oz oval cup"].includes(containerTitle)) {
                            task = "Cup Portioning";
                        }

                        if (task) {
                            if (portionDateBom1 === portionDateBom2) {
                                // If dates are the same, combine the data
                                const weight = round(weight1 + weight2, 2);
                                if (weight === 0) {
                                    continue;
                                }

                                const mealNo = `${mealCode1}_${mealCode2}`;
                                const itemData = [facility, mealNo, "Combine", name, task, weight.toFixed(2), portionDateBom1, false]; // Added checked: false
                                const existingItem = tableData.find(d => d[0] === facility && d[3] === name && d[4] === task && d[6] === portionDateBom1);

                                if (existingItem) {
                                    // Update weight
                                    existingItem[5] = (parseFloat(existingItem[5]) + weight).toFixed(2);

                                    // Update Meal No (ensure unique meal codes)
                                    if (typeof existingItem[1] === 'string') {
                                        const existingMealNo = existingItem[1].split('_');
                                        const newMealNo = mealNo.split('_');
                                        const combinedMealNo = [...new Set([...existingMealNo, ...newMealNo])].join('_');
                                        existingItem[1] = combinedMealNo;
                                    } else {
                                        console.error('Invalid Meal No:', existingItem[1]);
                                        existingItem[1] = mealNo; // Reset to the new mealNo if invalid
                                    }
                                } else {
                                    tableData.push(itemData);
                                }
                            } else {
                                // If dates are different, add separate rows for each cycle
                                if (weight1 !== 0) {
                                    const itemData1 = [facility, mealCode1, "1", name, task, weight1.toFixed(2), portionDateBom1, false]; // Added checked: false
                                    tableData.push(itemData1);
                                }
                                if (weight2 !== 0) {
                                    const itemData2 = [facility, mealCode2, "2", name, task, weight2.toFixed(2), portionDateBom2, false]; // Added checked: false
                                    tableData.push(itemData2);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Display the data in a table
        displayDataInTable(tableData);
    } catch (error) {
        console.error('Error:', error);
        alert(`An error occurred: ${error.message}`);
    }
});

// Submit Button Event Listener
document.getElementById('submitButton').addEventListener('click', async function () {
    const term = document.getElementById('termInput').value;
    const facility = document.getElementById('facilitySelect').value;

    if (!term) {
        alert('Please enter a term before submitting.');
        return;
    }

    if (tableData.length === 0) {
        alert('No data to submit. Please fetch data first.');
        return;
    }

    try {
        // Reference to the Firebase database
        const database = firebase.database();
        const inventoryRef = database.ref('Inventory');

        // Fetch existing data for the term
        const snapshot = await inventoryRef.child(term).once('value');
        let existingData = snapshot.exists() ? snapshot.val() : [];

        if (facility === "chicago") {
            // Replace data for Chicago
            existingData = tableData.filter(row => row[0] === "chicago");
        } else if (facility === "slc") {
            // Append data for SLC
            existingData = existingData.concat(tableData.filter(row => row[0] === "slc"));
        }

        // Save the updated data to Firebase
        await inventoryRef.child(term).set(existingData);

        // alert('Data submitted successfully!');
    } catch (error) {
        console.error('Error submitting data:', error);
        alert(`An error occurred while submitting data: ${error.message}`);
    }
});

// Load Data Button Event Listener
document.getElementById('loadButton').addEventListener('click', async function () {
    const loadTerm = document.getElementById('loadTermInput').value;

    if (!loadTerm) {
        alert('Please enter a term to load.');
        return;
    }

    try {
        // Reference to the Firebase database
        const database = firebase.database();
        const inventoryRef = database.ref('Inventory');

        // Fetch data for the specified term
        const snapshot = await inventoryRef.child(loadTerm).once('value');

        if (snapshot.exists()) {
            // Data exists, update the table
            const data = snapshot.val();
            tableData = data; // Update global tableData
            displayDataInTable(tableData);
            // alert('Data loaded successfully!');
        } else {
            // No data found for the term
            alert(`No data found for term: ${loadTerm}`);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        alert(`An error occurred while loading data: ${error.message}`);
    }
});

// Search Functionality
document.getElementById('searchInput').addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const filteredData = tableData.filter(row => 
        row.some(cell => cell.toString().toLowerCase().includes(searchTerm))
    );
    displayDataInTable(filteredData);
});

// Helper Functions
function zip(...arrays) {
    return arrays[0].map((_, i) => arrays.map(array => array[i]));
}

function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

function extractTagValue(tags, category) {
    const tag = tags.find(t => t.category === category);
    return tag ? tag.title : null;
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function displayDataInTable(data) {
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th onclick="sortTable(0)">Facility</th>
                <th onclick="sortTable(1)">Meal No</th>
                <th onclick="sortTable(2)">Cycle</th>
                <th onclick="sortTable(3)">Name</th>
                <th onclick="sortTable(4)">Task</th>
                <th onclick="sortTable(5)">Weight (lbs)</th>
                <th onclick="sortTable(6)">Date</th>
                <th>Checked</th>
            </tr>
        </thead>
        <tbody>
            ${data.map((row, index) => `
                <tr id="row-${index}" class="${row[7] ? 'checked-row' : ''}">
                    <td>${row[0]}</td> <!-- Facility -->
                    <td class="meal-no-cell" title="${row[1]}">${truncateText(row[1], 12)}</td> <!-- Meal No -->
                    <td>${row[2]}</td> <!-- Cycle -->
                    <td>${row[3]}</td> <!-- Name -->
                    <td>${row[4]}</td> <!-- Task -->
                    <td>${row[5]}</td> <!-- Weight (lbs) -->
                    <td>${row[6]}</td> <!-- Date -->
                    <td><input type="checkbox" ${row[7] ? 'checked' : ''} onchange="toggleCheck(${index})"></td> <!-- Checked -->
                </tr>
            `).join('')}
        </tbody>
    `;
    const display = document.getElementById('dataDisplay');
    display.innerHTML = '';
    display.appendChild(table);
}

// Sort Table Function
function sortTable(columnIndex) {
    if (!sortState[columnIndex]) {
        sortState[columnIndex] = 'asc';
    } else if (sortState[columnIndex] === 'asc') {
        sortState[columnIndex] = 'desc';
    } else {
        sortState[columnIndex] = null;
    }

    tableData.sort((a, b) => {
        if (sortState[columnIndex] === 'asc') {
            return a[columnIndex] > b[columnIndex] ? 1 : -1;
        } else if (sortState[columnIndex] === 'desc') {
            return a[columnIndex] < b[columnIndex] ? 1 : -1;
        } else {
            return 0; // No sorting
        }
    });

    displayDataInTable(tableData);
}

// Toggle Check Function
function toggleCheck(index) {
    tableData[index][7] = !tableData[index][7]; // Toggle checked state
    const row = document.getElementById(`row-${index}`);
    row.classList.toggle('checked-row', tableData[index][7]);

    // Save checked state to Firebase
    const term = document.getElementById('termInput').value;
    if (term) {
        const database = firebase.database();
        const inventoryRef = database.ref('Inventory');
        inventoryRef.child(term).set(tableData);
    }
}

// Helper function to truncate text
function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
}