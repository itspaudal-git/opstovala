// Check if Firebase app is already initialized to avoid duplicate app error
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();
const storage = firebase.storage();

const tableBody = document.getElementById('bolTableBody');
const destinationCheckbox = document.getElementById('destinationCheckbox');
const destinationLabel = document.getElementById('destinationLabel');
const termInput = document.getElementById('termInput');
const loadTermButton = document.getElementById('loadTerm');
const generateButton = document.getElementById('generateBOL');
const dayDropdown = document.getElementById('dayDropdown');
const runDropdown = document.getElementById('runDropdown');
const notification = document.getElementById('notification');

// References to filter inputs and buttons
const itemFilterInput = document.getElementById('itemFilter');
const typeFilterInput = document.getElementById('typeFilter');
const transportFilterInput = document.getElementById('transportFilter');
const dayFilterInput = document.getElementById('dayFilter');
const applyFiltersButton = document.getElementById('applyFilters');
const clearFiltersButton = document.getElementById('clearFilters');

// Add event listeners for filter buttons
applyFiltersButton.addEventListener('click', applyFilters);
clearFiltersButton.addEventListener('click', clearFilters);

let filteredData = []; // Store the data globally for duplication and deletion

// Object to keep track of sort directions
let sortDirections = {};

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

// Function to show notification
function showNotification(message) {
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000); // 2 seconds
}

// Function to load data from Firebase for a specific term
function loadData(term, destination) {
    database.ref(`Transfer/${term}`).once('value', (snapshot) => {
        const data = snapshot.val();
        tableBody.innerHTML = ''; // Clear the table body
        filteredData = []; // Clear filteredData
        let days = new Set();
        let runs = new Set();
        let items = new Set();
        let types = new Set();
        let transports = new Set();

        if (data) {
            data.forEach((entry, index) => {
                if (entry.Destination === destination) {
                    filteredData.push({ ...entry, term, key: index });

                    days.add(entry.Day);
                    runs.add(entry.Run);
                    items.add(entry.Item);
                    types.add(entry.Type);
                    transports.add(entry["Transported In"]);
                }
            });

            // Populate dropdowns and datalists
            populateDropdown(dayDropdown, days);
            populateDropdown(runDropdown, runs);
            populateDatalist('itemOptions', items);
            populateDatalist('typeOptions', types);
            populateDatalist('transportOptions', transports);
            populateDatalist('dayOptions', days);

            // Display the data
            displayData(filteredData);
        } else {
            alert(`No data found for term ${term}`);
        }
    });
}

// Helper function to populate dropdowns
function populateDropdown(dropdown, items) {
    dropdown.innerHTML = '';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        dropdown.appendChild(option);
    });
}

// Helper function to populate datalists
function populateDatalist(datalistId, items) {
    const datalist = document.getElementById(datalistId);
    datalist.innerHTML = '';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);
    });
}

// Function to display data in the table with dropdowns for Day and Run
function displayData(data) {
    tableBody.innerHTML = ''; // Clear the table body
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    data.forEach(entry => {
        const isSelected = entry.Selected || false;
        const row = document.createElement('tr');
        row.setAttribute('data-unique-id', `${entry.term}-${entry.key}`); // Add unique ID to row

        const displayDay = entry.Day ? entry.Day : daysOfWeek[0]; // Use the day from Firebase or default to the first day
        const displayRun = entry.Run ? entry.Run : '1st Run'; // Use the run from Firebase or default to "1st Run"

        if (isSelected) {
            row.style.backgroundColor = 'lightgreen';
        } else {
            row.style.backgroundColor = '';
        }

        row.innerHTML = `
            <td contenteditable="true">${entry.Term}</td>
            <td contenteditable="true">${entry.Cycle}</td>
            <td contenteditable="true">${entry.Meal}</td>
            <td contenteditable="true">${entry.Item}</td>
            <td contenteditable="true">${entry.Type}</td>
            <td contenteditable="true">${entry.Qty}</td>
            <td contenteditable="true">${entry.Unit}</td>
            <td contenteditable="true">${entry["Transported In"]}</td>
            <td>${createDayDropdown(displayDay)}</td> <!-- Replace Day cell with dropdown -->
            <td>${createRunDropdown(displayRun)}</td> <!-- Replace Run cell with dropdown -->
            <td>${entry.Destination}</td>
            <td contenteditable="true">${entry.Remarks || ''}</td>
            <td><input type="checkbox" ${isSelected ? 'checked' : ''} data-index="${entry.key}" data-term="${entry.term}" class="select-checkbox"></td>
        `;
        tableBody.appendChild(row);

        // Attach event listeners for real-time updates
        attachRealTimeUpdateListeners(row, entry.term, entry.key);
    });
}

// Function to create a dropdown with the days of the week
function createDayDropdown(selectedDay) {
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let dropdown = `<select class="day-dropdown">`;

    daysOfWeek.forEach(day => {
        dropdown += `<option value="${day}" ${day === selectedDay ? 'selected' : ''}>${day}</option>`;
    });

    dropdown += `</select>`;
    return dropdown;
}

// Function to create a dropdown with run options
function createRunDropdown(selectedRun) {
    const runOptions = ["1st Run", "2nd Run", "3rd Run"];
    let dropdown = `<select class="run-dropdown">`;

    runOptions.forEach(run => {
        dropdown += `<option value="${run}" ${run === selectedRun ? 'selected' : ''}>${run}</option>`;
    });

    dropdown += `</select>`;
    return dropdown;
}

// Function to attach real-time update listeners to each row's elements
function attachRealTimeUpdateListeners(row, term, index) {
    // Listen for dropdown changes in Day and Run dropdowns
    row.querySelector('.day-dropdown').addEventListener('change', function () {
        updateEntry(term, index);
    });

    row.querySelector('.run-dropdown').addEventListener('change', function () {
        updateEntry(term, index);
    });

    // Listen for changes in contenteditable fields (e.g., Remarks)
    row.cells[11].addEventListener('input', function () {
        updateEntry(term, index);
    });

    // Listen for checkbox state change
    row.cells[12].querySelector('input[type="checkbox"]').addEventListener('change', function () {
        updateEntry(term, index);
    });
}

// Function to apply filters
function applyFilters() {
    const itemFilter = itemFilterInput.value.trim().toLowerCase();
    const typeFilter = typeFilterInput.value.trim().toLowerCase();
    const transportFilter = transportFilterInput.value.trim().toLowerCase();
    const dayFilter = dayFilterInput.value.trim().toLowerCase();

    // Filter the filteredData array
    const filteredResults = filteredData.filter(entry => {
        const itemMatch = itemFilter === '' || (entry.Item && entry.Item.toLowerCase().includes(itemFilter));
        const typeMatch = typeFilter === '' || (entry.Type && entry.Type.toLowerCase().includes(typeFilter));
        const transportMatch = transportFilter === '' || (entry["Transported In"] && entry["Transported In"].toLowerCase().includes(transportFilter));
        const dayMatch = dayFilter === '' || (entry.Day && entry.Day.toLowerCase().includes(dayFilter));

        return itemMatch && typeMatch && transportMatch && dayMatch;
    });

    // Display the filtered results
    displayData(filteredResults);
}

// Function to clear filters
function clearFilters() {
    itemFilterInput.value = '';
    typeFilterInput.value = '';
    transportFilterInput.value = '';
    dayFilterInput.value = '';

    // Display all data
    displayData(filteredData);
}

// Add event listeners to table headers for sorting
const headers = document.querySelectorAll('#bolTable th');
headers.forEach((header, index) => {
    header.addEventListener('click', function () {
        sortTableByColumn(index);
    });
});

// Mapping of column indices to data keys
const columnKeyMap = {
    0: 'Term',
    1: 'Cycle',
    2: 'Meal',
    3: 'Item',
    4: 'Type',
    5: 'Qty',
    6: 'Unit',
    7: 'Transported In',
    8: 'Day',
    9: 'Run',
    10: 'Destination',
    11: 'Remarks'
};

// Function to sort the table by a given column
function sortTableByColumn(columnIndex) {
    const columnKey = columnKeyMap[columnIndex];

    if (!columnKey) return; // If the column is not one of the data columns, exit

    // Determine sort direction
    if (!sortDirections[columnKey]) {
        sortDirections[columnKey] = 'asc';
    } else {
        sortDirections[columnKey] = sortDirections[columnKey] === 'asc' ? 'desc' : 'asc';
    }

    const sortedData = [...filteredData].sort((a, b) => {
        let aValue = (a[columnKey] || '').toLowerCase();
        let bValue = (b[columnKey] || '').toLowerCase();

        // Handle numeric sorting for Qty
        if (columnKey === 'Qty') {
            aValue = parseFloat(aValue) || 0;
            bValue = parseFloat(bValue) || 0;
        }

        if (aValue < bValue) {
            return sortDirections[columnKey] === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortDirections[columnKey] === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Display the sorted data
    displayData(sortedData);
}

// Function to duplicate a row
function duplicateRow(row) {
    const uniqueId = row.dataset.uniqueId; // Retrieve the uniqueId from the row
    const [term, index] = uniqueId.split('-'); // Extract term and index from uniqueId
    const entryToCopy = filteredData.find(entry => `${entry.term}-${entry.key}` === uniqueId); // Find the entry in your data

    if (entryToCopy) {
        // Fetch the current term data from Firebase to determine the next available key
        database.ref(`Transfer/${term}`).once('value')
            .then(snapshot => {
                const termData = snapshot.val();
                const numericKeys = Object.keys(termData).filter(key => !isNaN(key)); // Only numeric keys
                let maxKey = numericKeys.length > 0 ? Math.max(...numericKeys.map(Number)) : -1;

                // Set the new key to be maxKey + 1
                let newKey = (maxKey + 1).toString();
                const newEntry = { ...entryToCopy, key: newKey }; // Create a new entry with the new key

                // Add the new entry to Firebase under the same term with a new key
                return database.ref(`Transfer/${term}/${newKey}`).set(newEntry);
            })
            .then(() => {
                showNotification('Row duplicated successfully!');
                const destination = destinationCheckbox.checked ? 'Tubeway' : 'Pershing';
                loadData(term, destination); // Refresh the table to display the new row
            })
            .catch(err => console.error('Error duplicating row in Firebase:', err));
    } else {
        console.error('Error: Entry not found for duplication.');
    }
}

// Function to delete a row
function deleteRow(row) {
    const uniqueId = row.dataset.uniqueId; // Retrieve the uniqueId from the row
    const [term, index] = uniqueId.split('-'); // Extract term and index from uniqueId

    if (confirm('Are you sure you want to delete this row?')) {
        database.ref(`Transfer/${term}/${index}`).remove()
            .then(() => {
                showNotification('Row deleted successfully!');
                const destination = destinationCheckbox.checked ? 'Tubeway' : 'Pershing';
                loadData(term, destination); // Refresh the table to remove the deleted row
            })
            .catch(err => console.error('Error deleting row in Firebase:', err));
    }
}

loadTermButton.addEventListener('click', function () {
    const term = termInput.value.trim();
    const destination = destinationCheckbox.checked ? 'Tubeway' : 'Pershing';
    if (term) {
        loadData(term, destination);
    } else {
        alert('Please enter a term');
    }
});

destinationCheckbox.addEventListener('change', function () {
    const term = termInput.value.trim();
    const destination = this.checked ? 'Tubeway' : 'Pershing';
    destinationLabel.textContent = destination;
    if (term) {
        loadData(term, destination);
    }
});

// Generate BOL button event listener
generateButton.addEventListener('click', async function () {
    const selectedDay = dayDropdown.value.trim(); // Get selected day from dropdown and trim whitespace
    const selectedRun = runDropdown.value.trim(); // Get selected run from dropdown and trim whitespace
    const destination = destinationCheckbox.checked ? 'Tubeway' : 'Pershing';

    // Log the selected values for debugging
    console.log(`Selected Day: ${selectedDay}, Selected Run: ${selectedRun}, Destination: ${destination}`);

    const shippingAddress = destination === 'Tubeway'
        ? 'Ship To:\nPershing\n815 W Pershing Rd Chicago, IL- 60609'
        : 'Ship To:\nTubeway\n248 Tubeway Dr Carol Stream, IL 60188';

    const shipFromAddress = destination === 'Tubeway'
        ? 'Ship From:\nTubeway\n248 Tubeway Dr Carol Stream, IL 60188'
        : 'Ship From:\nPershing\n815 W Pershing Rd Chicago, IL- 60609';

    const sealNumber = prompt("Enter Seal Number:");
    const outgoingTemp = prompt("Enter Outgoing Temp:");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');

    // Define pageHeight at the beginning of the code
    const pageHeight = doc.internal.pageSize.height;

    // Center title
    doc.setFontSize(18);
    const titleText = 'Bill of Lading';
    const titleWidth = doc.getTextWidth(titleText);
    const pageWidth = doc.internal.pageSize.width;
    const centerPosition = (pageWidth - titleWidth) / 2;
    doc.text(titleText, centerPosition, 40);

    // Ship To and Ship From
    doc.setFontSize(11);
    const today = new Date().toLocaleDateString();
    doc.text(`Date: ${today}`, 40, 70);
    doc.text(shippingAddress, 40, 90);    // Ship To
    doc.text(shipFromAddress, 40, 150);   // Ship From

    // Day, Run, Seal Number, Outgoing Temp, BOL Number
    doc.text(`Day: ${selectedDay}`, 350, 70);
    doc.text(`Run: ${selectedRun}`, 350, 90);
    doc.text(`Seal Number: ${sealNumber}`, 350, 110);
    const term = termInput.value.trim();
    const bolNumber = `${term}${destination}${selectedDay}${selectedRun}`;
    doc.text(`BOL Number: ${bolNumber}`, 350, 130);
    doc.text(`Outgoing Temp: ${outgoingTemp}`, 350, 150);
    doc.text('Incoming Temp: ________', 350, 170);

    const headers = ['Cycle', 'Meal', 'Item', 'Type', 'Qty', 'Unit', 'Transported In', 'Remarks'];
    const rows = [];

    // Iterate through the table rows to find matching rows
    const rowsData = tableBody.querySelectorAll('tr');
    rowsData.forEach((row) => {
        const selected = row.cells[12].querySelector('input[type="checkbox"]').checked; // Check if the row is selected
        const rowDay = row.cells[8].querySelector('select').value.trim(); // Get the day value from the dropdown in the row
        const rowRun = row.cells[9].querySelector('select').value.trim(); // Get the run value from the dropdown in the row

        // Log the values to see what is being compared
        console.log(`Row Day: ${rowDay}, Row Run: ${rowRun}, Selected: ${selected}`);

        // Include only rows that are selected and match the selected Day and Run
        if (selected && rowDay === selectedDay && rowRun === selectedRun) {
            const cycle = row.cells[1].textContent.trim();
            const meal = row.cells[2].textContent.trim();
            const item = row.cells[3].textContent.trim();
            const type = row.cells[4].textContent.trim();
            const qty = row.cells[5].textContent.trim();
            const unit = row.cells[6].textContent.trim();
            const transportedIn = row.cells[7].textContent.trim();
            const remarks = row.cells[11].textContent.trim();
            rows.push([cycle, meal, item, type, qty, unit, transportedIn, remarks]);
        }
    });

    // Log the rows to see which rows are included
    console.log('Rows included in PDF:', rows);

    if (rows.length > 0) {
        // Use autoTable to format the table correctly
        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 200,  // Adjust starting Y position
            styles: {
                fontSize: 10,
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: [255, 255, 255], // White text
            },
            columnStyles: {
                0: { cellWidth: 'auto' },  // Cycle
                1: { cellWidth: 'auto' },  // Meal
                2: { cellWidth: 180 },     // Item (set to 3 inches or 216 points)
                3: { cellWidth: 'auto' },  // Type
                4: { cellWidth: 'auto' },  // Qty
                5: { cellWidth: 'auto' },  // Unit
                6: { cellWidth: 'auto' },  // Transported In
                7: { cellWidth: 100 },  // Remarks
            },
            tableWidth: 'wrap' // Ensures the table doesn't exceed the page width
        });
        

        let finalY = doc.lastAutoTable.finalY || 200; // Get the final Y position after the table

        if (finalY > pageHeight - 100) {
            doc.addPage(); // Add a new page if needed
            finalY = 40; // Reset Y position for the new page
        }

        doc.setFontSize(12);
        doc.text('Carrier Signature: ____________________', 40, finalY + 30);
        doc.text('Pickup Date: ____________________', 300, finalY + 30);
        doc.text(`Today's Date: ${today}`, 40, finalY + 60);
    } else {
        alert('No data selected for the PDF or no data matches the selected Day and Run.');
        return;
    }

    // Save locally (optional)
    doc.save(`${bolNumber}.pdf`);



    // Convert PDF to Blob and upload to Firebase Storage
    const pdfBlob = doc.output('blob'); // Create a blob from the PDF

    // Upload the PDF to Firebase Storage
    const storageRef = firebase.storage().ref();
    const pdfRef = storageRef.child(`BOL/${bolNumber}.pdf`);

    try {
        // Upload the Blob to Firebase Storage
        const snapshot = await pdfRef.put(pdfBlob);
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log('PDF uploaded successfully! Download URL:', downloadURL);
    } catch (error) {
        console.error('Error uploading PDF:', error);
        alert('Error uploading PDF to Firebase Storage');
    }
});


// Function to update a specific entry in Firebase for Transfer
function updateEntry(term, index) {
    const row = document.querySelector(`tr[data-unique-id="${term}-${index}"]`); // Get the row using the unique ID

    // Capture the new values from the contenteditable fields and the dropdowns
    const updatedEntry = {
        Term: row.cells[0].textContent.trim(),
        Cycle: row.cells[1].textContent.trim(),
        Meal: row.cells[2].textContent.trim(),
        Item: row.cells[3].textContent.trim(),
        Type: row.cells[4].textContent.trim(),
        Qty: row.cells[5].textContent.trim(),
        Unit: row.cells[6].textContent.trim(),
        "Transported In": row.cells[7].textContent.trim(),
        Day: row.cells[8].querySelector('select').value.trim(), // Get the value from the day dropdown in the row
        Run: row.cells[9].querySelector('select').value.trim(), // Get the value from the run dropdown in the row
        Destination: row.cells[10].textContent.trim(), // Not editable, but captured
        Remarks: row.cells[11].textContent.trim(),
        Selected: row.cells[12].querySelector('input[type="checkbox"]').checked // Get the checkbox state
    };

    // Update the entry in Firebase based on the term and index
    database.ref(`Transfer/${term}/${index}`).update(updatedEntry, function (error) {
        if (error) {
            alert('Error updating entry: ' + error.message);
        } else {
            showNotification('Data updated successfully!');
            // Update the row's background color based on the 'Selected' state
            if (updatedEntry.Selected) {
                row.style.backgroundColor = 'lightgreen';
            } else {
                row.style.backgroundColor = '';
            }

            // Update the entry in filteredData
            const entryIndex = filteredData.findIndex(entry => entry.term === term && entry.key == index);
            if (entryIndex !== -1) {
                filteredData[entryIndex] = { ...updatedEntry, term, key: index };
            }
        }
    });
}

// Attach the event listener to the update buttons after the Transfer table is populated
document.addEventListener('click', function (event) {
    if (event.target && event.target.classList.contains('update-btn')) {
        const index = event.target.getAttribute('data-index');
        const term = event.target.getAttribute('data-term');

        // Call the function to update the entry in Firebase
        updateEntry(term, index);
    }
});



// Attach the event listener to the update buttons after the Transfer table is populated
document.addEventListener('click', function (event) {
    if (event.target && event.target.classList.contains('update-btn')) {
        const index = event.target.getAttribute('data-index');
        const term = event.target.getAttribute('data-term');

        // Call the function to update the entry in Firebase
        updateEntry(term, index);
    }
});

// Function to show the custom context menu
function showContextMenu(event, targetRow) {
    event.preventDefault();  // Prevent the default right-click menu

    // Remove any existing context menus
    const existingMenu = document.querySelector('.custom-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Create the custom context menu
    const contextMenu = document.createElement('div');
    contextMenu.classList.add('custom-context-menu');

    // Duplicate Row option
    const duplicateOption = document.createElement('div');
    duplicateOption.textContent = 'Duplicate Row';
    duplicateOption.addEventListener('click', function () {
        duplicateRow(targetRow); // Call the duplicateRow function
        contextMenu.remove();
    });

    // Delete Row option
    const deleteOption = document.createElement('div');
    deleteOption.textContent = 'Delete Row';
    deleteOption.addEventListener('click', function () {
        deleteRow(targetRow); // Call the deleteRow function
        contextMenu.remove();
    });

    // Add options to context menu
    contextMenu.appendChild(duplicateOption);
    contextMenu.appendChild(deleteOption);

    // Position the context menu at the mouse position
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.style.left = `${event.pageX}px`;

    // Append the context menu to the document body
    document.body.appendChild(contextMenu);
}

// Event listener to trigger the context menu on right-click
document.addEventListener('contextmenu', function (event) {
    const targetRow = event.target.closest('tr');  // Get the closest table row
    if (targetRow && targetRow.dataset.uniqueId) {    // Ensure it's a valid row with a uniqueId
        showContextMenu(event, targetRow);
    }
});

// Event listener to close the context menu when clicking elsewhere
document.addEventListener('click', function (event) {
    const contextMenu = document.querySelector('.custom-context-menu');
    if (contextMenu && !contextMenu.contains(event.target)) {
        contextMenu.remove();
    }
});

// Load the default term on page load
window.onload = function () {
    termInput.value = calculateCurrentTerm();
    const term = termInput.value.trim();
    // Optionally, you can automatically load data for the default term
    const destination = destinationCheckbox.checked ? 'Tubeway' : 'Pershing';
    loadData(term, destination);
};
