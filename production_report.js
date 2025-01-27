document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    // Initialize the Firebase database reference
    const database = firebase.database();

    // Listen for Enter keypress in the input field for QR scanning
    document.getElementById('qrInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const QR = document.getElementById('qrInput').value.trim();
            if (QR) {
                fetchProductionData(QR);
                // Clear the input field after successful scan
                document.getElementById('qrInput').value = '';
            } else {
                alert("Please enter a valid QR code.");
            }
        }
    });

    const openCameraBtn = document.getElementById('openCameraBtn');
    const qrInput = document.getElementById('qrInput');
    const qrReaderElement = document.getElementById('qr-reader');
    let qrScannerActive = false;
    
    // Function to start the QR code scanner
    function startQrScanner() {
        const html5QrCode = new Html5Qrcode("qr-reader");
    
        html5QrCode.start(
            { facingMode: "environment" }, // Use back camera
            {
                fps: 10, // Set the number of frames per second
                qrbox: { width: 250, height: 250 } // Display the QR scanning box
            },
            (decodedText, decodedResult) => {
                // When QR code is scanned
                qrInput.value = decodedText; // Populate the qrInput field
    
                // Automatically fetch production data after scanning
                fetchProductionData(decodedText);
    
                // Clear the qrInput field after scanning
                qrInput.value = '';
    
                // Stop the scanner after successful scan
                html5QrCode.stop().then(() => {
                    console.log("QR Code Scanning Stopped.");
                    qrReaderElement.style.display = "none"; // Hide camera feed
                    qrScannerActive = false;
                }).catch(err => {
                    console.error("Failed to stop scanning", err);
                });
            },
            (errorMessage) => {
                // QR code scan failed, handle error
                console.warn(`QR code scan failed: ${errorMessage}`);
            }
        ).catch(err => {
            console.error("Failed to start QR scanner", err);
        });
    }
    
    // Toggle QR code scanner on button click
    openCameraBtn.addEventListener('click', function () {
        if (!qrScannerActive) {
            qrReaderElement.style.display = "block"; // Show the camera feed
            startQrScanner();
            qrScannerActive = true;
        }
    });
    
    
// Fetch production data based on QR code (in real-time)
function fetchProductionData(QR) {
    database.ref('Master_Task').on('value', snapshot => {
        let foundEntries = [];
        let term = null; // Store the term (key of the parent node)

        snapshot.forEach(childSnapshot => {
            const termData = childSnapshot.val();
            const currentTerm = childSnapshot.key; // Get the term (e.g., '403')

            Object.keys(termData).forEach(key => {
                const entry = termData[key];
                if (entry.QR === QR) {
                    foundEntries.push({ ...entry, term: currentTerm, key: key });
                }
            });
        });

        if (foundEntries.length > 0) {
            // Check if any of the found entries need their Start time set
            foundEntries.forEach(entry => {
                if (!entry.Start) {
                    const currentTime = getCurrentTime();
                    entry.Start = currentTime;

                    // Update Firebase with the new Start time
                    updateFirebaseData(entry.term, entry.key, { Start: currentTime }).then(() => {
                        location.reload(); // Reload the page after setting the Start time
                    });
                } else {
                    // Display the data for all matching entries
                    displayTable(foundEntries);
                }
            });
        } else {
            alert('No data found for the QR code.');
        }
    });
}

// Function to display data in a table
function displayTable(entries) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = ''; // Clear existing data
    
    entries.forEach(entry => {
        // Update the Product title dynamically in H2
        const productTitle = document.getElementById('productTitle');
        productTitle.textContent = `Product: ${entry.Product || 'Product'}`;

        // First data row (Term, FC, Meal, etc.)
        const dataRow1 = document.createElement('tr');
        dataRow1.innerHTML = `
            <td>Term: ${entry.term || ''}</td>
            <td>FC: ${entry.Facility || ''}</td>
            <td>Meal: ${entry.Meal || ''}</td>
            <td>Cycle: ${entry.Cycle || ''}</td>
            <td>Product: ${entry.Product || ''}</td>
            <td>Count: ${entry["Count"] || ''}</td>
            <td>Task: ${entry.Task || ''}</td>
            <td>Project Hours: ${parseFloat(entry["Project Hours"] || 0).toFixed(2)}</td>
            <td>Man Hours: ${parseFloat(entry["Man Hours"] || 0).toFixed(2)}</td>
            <td>Day: ${entry.Day || ''}</td>
            <td>Status: ${calculateStatus(entry.Start, entry.End)}</td>
        `;

        // Second header row (Start, Break, End, etc.)
        const headerRow2 = document.createElement('tr');
        headerRow2.innerHTML = `
            <th>Start</th>
            <th>Break</th>
            <th>End</th>
            <th>Lead</th>
            <th>Headcount</th>
            <th>Produced Qty</th>
            <th>Duration</th>
            <th>Actual Manhours</th>
            <th>Variance</th>
            <th>Teams</th>
            <th>Notes</th>
            <th>Actions</th>
        `;

        // Second data row
        const dataRow2 = document.createElement('tr');
        const currentTime = getCurrentTime();
        const startTime = entry.Start || currentTime;
        const duration = calculateDuration(startTime, entry.End, entry.Break);
        const actualManhours = calculateActualManhours(entry.Headcount, duration);
        const variance = calculateVariance(entry["Man Hours"], actualManhours);
        const endTime = entry.Start && areRequiredFieldsFilled(entry) ? currentTime : entry.End;

        dataRow2.innerHTML = `
        <td><input type="time" value="${startTime}" /></td>
        <td><input type="number" value="${entry.Break || ''}" min="0" /></td>
        <td><input type="time" value="${endTime}" ${!areRequiredFieldsFilled(entry) ? 'disabled' : ''} /></td>
        <td contenteditable="true" class="editable">${entry.Lead || ''}</td>
        <td contenteditable="true" class="editable">${entry.Headcount || ''}</td>
        <td contenteditable="true" class="editable">${entry["Produced Qty"] || ''}</td>
        <td>${duration.toFixed(2)}</td>
        <td>${actualManhours.toFixed(2)}</td>
        <td>${variance}%</td>
        <td contenteditable="true" class="editable">${entry.Teams || ''}</td>
        <td contenteditable="true" class="editable">${entry.Notes || ''}</td>
        <td><button class="update-btn" data-term="${entry.term}" data-key="${entry.key}">Update</button></td>
    `;
    

        tbody.appendChild(dataRow1); // First data row
        tbody.appendChild(headerRow2); // Second header row
        tbody.appendChild(dataRow2); // Second data row

        if (entry.Start) {
            highlightRequiredFields(dataRow2);
        }
    });

    addEventListeners(entries); // Pass entries to addEventListeners
}

// Add event listeners for all update buttons
function addEventListeners(entries) {  // Pass entries (foundEntries) as a parameter
    const updateButtons = document.querySelectorAll('.update-btn');

    updateButtons.forEach(button => {
        // Add listener for manual "Update" button click
        button.addEventListener('click', function() {
            performUpdate(button);
        });

        // Automatically trigger update when "End" time is entered or set
        const row2 = button.closest('tr');
        const endTimeInput = row2.children[2].querySelector('input'); // End time input field

        if (endTimeInput) {
            // Listener for manual input in the "End" time field
            endTimeInput.addEventListener('input', function() {
                if (endTimeInput.value) {
                    button.click(); // Automatically trigger update when End time is entered
                }
            });

            // Automatically check and set End time if conditions are met
            const entry = getEntryForRow(row2, entries);  // Pass the entries array here
            checkAndSetEndTime(entry, row2, endTimeInput);  // Automatically set End time and trigger update if necessary
        }
    });
}

// Automatically set the end time if required fields are filled
function checkAndSetEndTime(entry, dataRow2, endTimeInput) {
    if (areRequiredFieldsFilled(entry) && !endTimeInput.value) {
        const currentTime = getCurrentTime();  // Automatically set the current time as End time
        endTimeInput.value = currentTime;      // Set the End time input value

        // Trigger the calculation and update process
        const updateButton = dataRow2.querySelector('.update-btn');
        if (updateButton) {
            updateButton.click();  // Trigger the update button click programmatically
        }
    }
}

// Check if Lead, Headcount, ProducedQty, and Break are filled
function areRequiredFieldsFilled(entry) {
    return entry.Lead && entry.Headcount && entry["Produced Qty"] && entry.Break;
}

// Highlight Lead, Headcount, and ProducedQty fields if Start exists
function highlightRequiredFields(dataRow2) {
    const editableFields = dataRow2.querySelectorAll('.editable');
    editableFields.forEach(field => {
        field.style.backgroundColor = 'yellow';
    });
}

// Fetch the entry for the current row (use `entries` array)
function getEntryForRow(row, entries) {
    const term = row.closest('tr').dataset.term;
    const key = row.closest('tr').dataset.key;
    const entry = entries.find(e => e.term === term && e.key === key);
    return entry || {};
}

// Perform update logic
function performUpdate(button) {
    const row1 = button.closest('tr').previousSibling; // Get the first row (basic data)
    const row2 = button.closest('tr'); // Get the second row (additional details)
    const term = button.dataset.term;
    const entryKey = button.dataset.key;

    // Extract values from the table
    const startTime = row2.children[0].querySelector('input').value;
    const breakTime = row2.children[1].querySelector('input').value;
    const endTime = row2.children[2].querySelector('input').value;
    const lead = row2.children[3].textContent.trim();
    const headcount = row2.children[4].textContent.trim();
    const producedQty = row2.children[5].textContent.trim(); // Correctly fetched
    const teams = row2.children[9].textContent.trim();
    const notes = row2.children[10].textContent.trim();

    // Perform calculations before updating Firebase
    const duration = calculateDuration(startTime, endTime, breakTime);
    const actualManhours = calculateActualManhours(headcount, duration);
    const variance = calculateVariance(row1.children[8].textContent, actualManhours); // Assuming Man Hours are in the 9th column (index 8)

    // Prepare updated data with calculated fields
    const updatedData = {
        Start: startTime,
        Break: breakTime,
        End: endTime,
        Lead: lead,
        Headcount: headcount,
        "Produced Qty": producedQty, // Correctly use "Produced Qty"
        Duration: duration.toFixed(2), // Duration in hours
        "Actual Manhours": actualManhours.toFixed(2), // Actual Manhours
        Variance: variance + '%', // Variance as a percentage
        Notes: notes,
        Teams: teams
    };

    // Update Firebase with the new data including the calculated fields
    updateFirebaseData(term, entryKey, updatedData);
}

// Function to update data in Firebase
function updateFirebaseData(term, entryKey, updatedData) {
    return database.ref(`Master_Task/${term}/${entryKey}`).update(updatedData)
        .then(() => {
            // Show the success message
            const successMessage = document.getElementById('success-message');
            successMessage.classList.add('show');

            // Hide the message after 3 seconds
            setTimeout(() => {
                successMessage.classList.remove('show');
            }, 3000);
        })
        .catch(err => {
            console.error('Error updating data:', err);
        });
}

// Utility function to get the current time in HH:MM format
function getCurrentTime() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes}`;
}

// Utility function to calculate duration (in hours)
function calculateDuration(startTime, endTime, breakTime) {
    if (!startTime || !endTime) return 0; // Return 0 for missing times
    const start = new Date(`01/01/2000 ${startTime}`);
    const end = new Date(`01/01/2000 ${endTime}`);
    const breakMinutes = parseInt(breakTime, 10) || 0;
    const totalMinutes = Math.floor((end - start) / 60000) - breakMinutes;
    return totalMinutes / 60; // Convert to hours
}

// Utility function to calculate actual manhours
function calculateActualManhours(headcount, duration) {
    if (!headcount || !duration) return 0;
    return headcount * duration;
}

// Utility function to calculate variance
function calculateVariance(manHours, actualManhours) {
    if (!manHours || !actualManhours) return 0;
    const difference = manHours - actualManhours;
    return ((difference / manHours) * 100).toFixed(2); // Return percentage
}

// Utility function to determine the status
function calculateStatus(start, end) {
    if (start && end) {
        return "Complete";
    } else if (start) {
        return "In Progress";
    } else {
        return "Not Started";
    }
}
});