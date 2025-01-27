document.getElementById('fetchData').addEventListener('click', fetchData);

document.getElementById('searchTerm').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        fetchData();
    }
});

let globalTermID = ''; // Declare a global variable to hold the termID

function fetchData() {
    const term = document.getElementById('searchTerm').value.trim();
    const facility = document.getElementById('facilitySelect').value; // Get the selected facility

    if (term === '') {
        document.getElementById('status').textContent = "Please enter a term.";
        return;
    }

    // Build the URL dynamically based on the selected facility
    const url = `https://misevala-api.tvla.co/v0/productionRecords/${term}?facilityNetwork=${facility}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            globalTermID = data['termID']; // Assign termID to the global variable
            processAndDisplayData(data);
        })
        .catch(error => {
            document.getElementById('status').textContent = "Error fetching data: " + error.message;
        });
}

// Mapping function for container types to Task
function mapContainerToTask(container) {
    const taskMappings = {
        '1 oz cup': 'Cup Portioning',
        '2 oz cup': 'Cup Portioning',
        '2 oz oval cup': 'Cup Portioning',
        'sachet': 'Liquid Sachet',
        'tray 1 sachet': 'Liquid Sachet',
        'tray 2 sachet': 'Liquid Sachet',
        'dry sachet': 'Dry Sachet',
        'tray 1 dry sachet': 'Dry Sachet',
        'tray 2 dry sachet': 'Dry Sachet',
        'tray 1 bag': 'Band Sealing/tin',
        'tray 2 bag': 'Band Sealing/tin',
        'tray 1 veggie bags': 'Band Sealing/tin',
        'tray 2 veggie bags': 'Band Sealing/tin',
        'tray 1 mushroom bags': 'Band Sealing/tin',
        'tray 2 mushroom bags': 'Band Sealing/tin',
        'tray 1 9x14 bag': 'Band Sealing/tin',
        'tray 1 14x16 bag': 'Band Sealing/tin',
        'tray 2 9x14 bag': 'Band Sealing/tin',
        'tray 2 14x16 bag': 'Band Sealing/tin',
        '14x16 bag': 'Band Sealing',
        '9x14 bag': 'Band Sealing',
        'veggie bags': 'Band Sealing',
        'mushroom bags': 'Band Sealing',
        'tray 1': 'Tray Sealing',
        'tray 2': 'Tray Sealing',
        'sealed body armor': 'Tray Sealing',
        'tray 1 sealed body armor': 'Tray Sealing',
        'tray 2 sealed body armor': 'Tray Sealing'
    };

    return taskMappings[container] || '';
}

function processAndDisplayData(packageJson) {
    const termID = packageJson['termID'] || 'N/A'; // Ensure termID is passed, use 'N/A' as fallback
    const cycle1 = packageJson['cycles']['1']['meals'];
    const cycle2 = packageJson['cycles']['2']['meals'];
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';  // Clear existing rows

    const SleevingdaysOptions = [
        'N/A',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
    ];
    const binsOptions = [
        'N/A',
        'Red Bins',
        'Blue Bins',
        'Trays',
    ];
    const sleevingOptions = [
        'Standard',
        'Tall Boi',
        'Drop Shelf',
        'NGT Drop Shelf',
        'Short Boi',
        'NGT Tall Boi',
    ];

    let previousMealNo = null;
    const specialContainers = [
        "tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra", "tray 1 sealed body armor","tray 2 sealed body armor",
        "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"
    ];

    cycle1.forEach((item, index) => {
        const mealNo = item['mealCode'];
        const name = item['apiMealTitle'];
        const qty1 = item['totalMeals'];
        const qty2 = cycle2[index]['totalMeals'];
        const meal_id_c1 = item['id']; // Meal ID for Cycle 1
        const meal_id_c2 = cycle2[index]['id']; // Meal ID for Cycle 2

        if (!name.includes("PAU")) {
            const sleevingLoc = item['tags'].find(tag => tag['category'] === "sleeving_location")?.title || '';
            const sleevingConfig = item['tags'].find(tag => tag['category'] === "sleeving_configuration")?.title || '';
            const binsConfig = item['tags'].find(tag => tag['category'] === 'sleeving_bins_configuration')?.title || 'N/A';

            // Retrieve sleeving days for both cycles
            const sleevingDay1 = item['tags'].find(tag => tag['category'] === 'sleeving_day')?.title || 'N/A';
            const sleevingDay2 = cycle2[index]['tags'].find(tag => tag['category'] === 'sleeving_day_c2')?.title || 'N/A';

            // Store these variables in the row so they can be accessed when generating the PDF

            let bom1 = item['billOfMaterials'].filter(material => {
                const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
                return container.toLowerCase() !== 'n/a' && container.toLowerCase() !== 'na';
            });
            let bom2 = cycle2[index]['billOfMaterials'].filter(material => {
                const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
                return container.toLowerCase() !== 'n/a' && container.toLowerCase() !== 'na';
            });

            let tray1Items = [];
            let tray2Items = [];
            let otherItems = [];
            let specialItems = [];

            bom1.forEach((material, materialIndex) => {
                // Extract necessary details from the material
                const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
                const portion_location = material['tags'].find(tag => tag['category'] === "portion_location")?.title || ''; 
                const name = material['title'];  // Name of the material
                const uom = `${Math.round(material['qtyPounds'] * 453.59237)} g`;  // Convert qtyPounds to grams
                let mapTag = material['tags'].find(tag => tag['category'] === 'MAP')?.title || '';
                
                // Exclude "no MAP" from being displayed
                if (mapTag === 'no MAP') mapTag = '';  
            
                let trayTag = material['tags'].find(tag => tag['category'] === 'spare_tray')?.title || '';
                // Exclude "normal" tray tags from being displayed
                if (trayTag === 'normal') trayTag = '';  
            
                const day1 = material['tags'].find(tag => tag['category'] === 'portion_date')?.title || 'N/A';
                const day2 = bom2[materialIndex]?.tags?.find(tag => tag['category'] === 'portion_date')?.title || 'N/A';
                const task = mapContainerToTask(container);  // Map container type to task
            
                // Ensure that all fields are pushed based on container type
                if (specialContainers.includes(container.toLowerCase())) {
                    // Push to specialItems array with all relevant fields
                    specialItems.push({
                        mealNo, name, uom, container, mapTag, trayTag, day1, day2, task, portion_location, termID 
                    });
                } else if (container.startsWith("tray 1")) {
                    // Push to tray1Items array with all relevant fields
                    tray1Items.push({
                        mealNo, 
                        name, 
                        uom, 
                        container, 
                        mapTag, 
                        trayTag, 
                        day1, 
                        day2, 
                        task, 
                        portion_location
                    });
                } else if (container.startsWith("tray 2")) {
                    // Push to tray2Items array with all relevant fields
                    tray2Items.push({
                        mealNo, 
                        name, 
                        uom, 
                        container, 
                        mapTag, 
                        trayTag, 
                        day1, 
                        day2, 
                        task, 
                        portion_location
                    });
                } else {
                    // Push to otherItems array with all relevant fields
                    otherItems.push({
                        mealNo, 
                        name, 
                        uom, 
                        container, 
                        mapTag, 
                        trayTag, 
                        day1, 
                        day2, 
                        task, 
                        portion_location
                    });
                }
            });
            
            if (previousMealNo !== null && mealNo !== previousMealNo) {
                const dividerRow = document.createElement('tr');
                dividerRow.classList.add('row-divider');
                dividerRow.innerHTML = '<td colspan="14"></td>'; // Adjusted colspan to match the number of columns
                tableBody.appendChild(dividerRow);
            }

            // Add the row for the meal itself
            const row = document.createElement('tr');
            row.setAttribute('data-term-id', termID);  // Store termID in the row for future use
            row.setAttribute('data-sleeving-loc', sleevingLoc);  // Store sleevingLoc
            row.setAttribute('data-sleeving-config', sleevingConfig);  // Store sleevingConfig
            row.innerHTML = `
                <td style="font-weight: bold;">${mealNo}</td>
                <td style="font-weight: bold;">${qty1}</td>
                <td style="font-weight: bold;">${qty2}</td>
                <td style="font-weight: bold;">${name}</td>
                <td style="font-weight: bold;">
    <select
        class="sleeving-configuration-dropdown"
        id="sleeving-configuration-${mealNo}"
        onchange="updateSleevingConfig('${mealNo}', '${meal_id_c1}', '${meal_id_c2}', 'both', this.value, document.getElementById('bins-configuration-${mealNo}').value, document.getElementById('sleeving-day-c1-${mealNo}').value, document.getElementById('sleeving-day-c2-${mealNo}').value)">
        ${sleevingOptions.map(option => `
            <option value="${option}" ${option === sleevingConfig ? 'selected' : ''}>${option}</option>
        `).join('')}
    </select>
                </td>
                <td id="sleeving-location-${mealNo}" style="font-weight: bold;">${sleevingLoc}</td>
                <td style="font-weight: bold;">Sleeving</td>
                <td>
    <select
        id="sleeving-day-c1-${mealNo}"
        class="sleeving-day-dropdown"
        onchange="updateSleevingConfig('${mealNo}', '${meal_id_c1}', null, '1', document.getElementById('sleeving-configuration-${mealNo}').value, document.getElementById('bins-configuration-${mealNo}').value, this.value, null)">
        ${SleevingdaysOptions.map(option => `
            <option value="${option}" ${option === sleevingDay1 ? 'selected' : ''}>${option}</option>
        `).join('')}
    </select>
                </td>
                <td>
    <select
        id="sleeving-day-c2-${mealNo}"
        class="sleeving-day-dropdown"
        onchange="updateSleevingConfig('${mealNo}', null, '${meal_id_c2}', '2', document.getElementById('sleeving-configuration-${mealNo}').value, document.getElementById('bins-configuration-${mealNo}').value, null, this.value)">
        ${SleevingdaysOptions.map(option => `
            <option value="${option}" ${option === sleevingDay2 ? 'selected' : ''}>${option}</option>
        `).join('')}
    </select>
                </td>
                <td style="font-weight: bold;"></td>
                <td style="font-weight: bold;">
    <select
        id="bins-configuration-${mealNo}"
        class="bins-configuration-dropdown"
        onchange="updateSleevingConfig('${mealNo}', '${meal_id_c1}', '${meal_id_c2}', 'both', document.getElementById('sleeving-configuration-${mealNo}').value, this.value, document.getElementById('sleeving-day-c1-${mealNo}').value, document.getElementById('sleeving-day-c2-${mealNo}').value)">
        ${binsOptions.map(option => `
            <option value="${option}" ${option === binsConfig ? 'selected' : ''}>${option}</option>
        `).join('')}
    </select>
                </td>
                <td style="font-weight: bold;">Sleeving</td>
                <td><button class="download-c1-sleeve">Download C1</button></td>
                <td><button class="download-c2-sleeve">Download C2</button></td>
            `;
            tableBody.appendChild(row);

            // Handle tray 1 items
            if (tray1Items.length > 0) {
                const tray1Row = document.createElement('tr');
                tray1Row.setAttribute('data-term-id', termID);  // Store termID in the row for future use
                tray1Row.innerHTML = `
                    <td>${mealNo}</td>
                    <td>${qty1}</td>
                    <td>${qty2}</td>
                    <td>${tray1Items.map(item => item.name).join(" & ")}</td> <!-- Added '&' -->
                    <td>${tray1Items.map(item => item.uom).join(" & ")}</td> <!-- Added '&' -->
                    <td>${tray1Items[0].portion_location}</td>
                    <td>${tray1Items[0].container}</td>
                    <td>${tray1Items[0].day1}</td>
                    <td>${tray1Items[0].day2}</td>
                    <td>${tray1Items[0].mapTag !== '' ? tray1Items[0].mapTag : ''}</td>
                    <td>${tray1Items[0].trayTag !== '' ? tray1Items[0].trayTag : ''}</td>
                    <td>${tray1Items[0].task}</td>
                    <td><button class="download-c1">Download C1</button></td>
                    <td><button class="download-c2">Download C2</button></td>
                `;
                tableBody.appendChild(tray1Row);
            }

            // Handle tray 2 items
            if (tray2Items.length > 0) {
                const tray2Row = document.createElement('tr');
                tray2Row.setAttribute('data-term-id', termID);  // Store termID in the row for future use
                tray2Row.innerHTML = `
                    <td>${mealNo}</td>
                    <td>${qty1}</td>
                    <td>${qty2}</td>
                    <td>${tray2Items.map(item => item.name).join(" & ")}</td> <!-- Added '&' -->
                    <td>${tray2Items.map(item => item.uom).join(" & ")}</td> <!-- Added '&' -->
                    <td>${tray2Items[0].portion_location}</td>
                    <td>${tray2Items[0].container}</td>
                    <td>${tray2Items[0].day1}</td>
                    <td>${tray2Items[0].day2}</td>
                    <td>${tray2Items[0].mapTag !== '' ? tray2Items[0].mapTag : ''}</td>
                    <td>${tray2Items[0].trayTag !== '' ? tray2Items[0].trayTag : ''}</td>
                    <td>${tray2Items[0].task}</td>
                    <td><button class="download-c1">Download C1</button></td>
                    <td><button class="download-c2">Download C2</button></td>
                `;
                tableBody.appendChild(tray2Row);
            }

            // Add remaining other items
            otherItems.forEach(item => {
                const materialRow = document.createElement('tr');
                materialRow.setAttribute('data-term-id', termID);  // Store termID in the row for future use
                materialRow.innerHTML = `
                    <td>${mealNo}</td>
                    <td>${qty1}</td>
                    <td>${qty2}</td>
                    <td>${item.name}</td> <!-- No '&' -->
                    <td>${item.uom}</td>
                    <td>${item.portion_location}</td>
                    <td>${item.container}</td>
                    <td>${item.day1}</td>
                    <td>${item.day2}</td>
                    <td>${item.mapTag !== '' ? item.mapTag : ''}</td>
                    <td>${item.trayTag !== '' ? item.trayTag : ''}</td>
                    <td>${item.task}</td>
                    <td><button class="download-c1">Download C1</button></td>
                    <td><button class="download-c2">Download C2</button></td>
                `;
                tableBody.appendChild(materialRow);
            });

            // Add the special items at the bottom of the mealNo group
            specialItems.forEach(item => {
                const specialRow = document.createElement('tr');
                specialRow.style.backgroundColor = "yellow"; // Highlight the row with yellow
                specialRow.setAttribute('data-term-id', item.termID);  // Ensure termID is passed for special items
                specialRow.innerHTML = `
                    <td>${item.mealNo || ''}</td>
                    <td>${qty1 || ''}</td>
                    <td>${qty2 || ''}</td>
                    <td>${item.name}</td> <!-- No '&' -->
                    <td>${item.uom}</td>
                    <td>${item.portion_location}</td>
                    <td>${item.container}</td>
                    <td>${item.day1}</td>
                    <td>${item.day2}</td>
                    <td>${item.mapTag !== '' ? item.mapTag : ''}</td>
                    <td>${item.trayTag !== '' ? item.trayTag : ''}</td>
                    <td>${item.task}</td>
                    <td><button class="download-c1">Download C1</button></td>
                    <td><button class="download-c2">Download C2</button></td>
                `;
                tableBody.appendChild(specialRow);
            });

            previousMealNo = mealNo;
        }
    });

    document.getElementById('status').textContent = "Loading... Complete!";
}

function updateSleevingConfig(mealNo, meal_id_c1, meal_id_c2, cycle, newConfig, newBinsConfig, newSleevingDay1, newSleevingDay2) {
    // Get the current sleeving location from the existing data
    const sleevingLoc = document.querySelector(`#sleeving-location-${mealNo}`).textContent || 'N/A';

    // Provide fallback values if necessary
    newConfig = newConfig || 'N/A';
    newBinsConfig = newBinsConfig || 'N/A';

    // Update the target URL and payload based on the cycle
    if (cycle === 'both') {
        // Update both cycles
        if (meal_id_c1) {
            updateSleevingConfig(mealNo, meal_id_c1, null, '1', newConfig, newBinsConfig, newSleevingDay1, null);
        }
        if (meal_id_c2) {
            updateSleevingConfig(mealNo, null, meal_id_c2, '2', newConfig, newBinsConfig, null, newSleevingDay2);
        }
        return;
    }

    let meal_id = meal_id_c1 || meal_id_c2;
    if (!meal_id) {
        console.error('Meal ID is missing for cycle:', cycle);
        return;
    }

    const url = `https://misevala-api.tvla.co/v0/productionRecords/${globalTermID}/productionMeals/${meal_id}/tags`;

    // Build the payload
    let payloadToSend = {
        "tags": [
            { "category": "sleeving_location", "title": sleevingLoc },
            { "category": "sleeving_configuration", "title": newConfig },
            { "category": "sleeving_bins_configuration", "title": newBinsConfig },
        ]
    };

    if (cycle === '1') {
        payloadToSend.tags.push({ "category": "sleeving_day", "title": newSleevingDay1 || 'N/A' });
    } else if (cycle === '2') {
        payloadToSend.tags.push({ "category": "sleeving_day_c2", "title": newSleevingDay2 || 'N/A' });
    }

    // Log the payload and URL for debugging
    console.log("URL:", url);
    console.log("Payload to send:", payloadToSend);

    // Send the PUT request to update the tags
    fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
            // Add authentication if required
        },
        body: JSON.stringify(payloadToSend)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`Server error: ${response.status} - ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Updated successfully:', data);
        document.getElementById('status').textContent = `Configuration for Meal ${mealNo} updated successfully for Cycle ${cycle}.`;
    })
    .catch(error => {
        console.error('Error updating:', error);
        document.getElementById('status').textContent = `Error updating configuration for Meal ${mealNo} Cycle ${cycle}: ${error.message}`;
    });
}


document.addEventListener('click', function(event) {
    if (event.target.classList.contains('download-c1-sleeve') || event.target.classList.contains('download-c2-sleeve')) {
        const row = event.target.closest('tr');
        const mealNo = row.querySelector('td:first-child').textContent.trim();
        const termID = row.getAttribute('data-term-id');
        const sleevingLoc = row.getAttribute('data-sleeving-loc');  // Retrieve sleevingLoc from the row
        const sleevingConfig = row.getAttribute('data-sleeving-config');  // Retrieve sleevingConfig from the row
        const mealDescription = row.querySelector('td:nth-child(4)').textContent.trim();
        if (mealDescription.includes('SOT')) {
            console.log(`Skipping meal with description containing 'SOT': ${mealDescription}`);
            return;  // Skip to the next iteration
        }
        const qty1 = row.querySelector('td:nth-child(2)').textContent.trim();
        const qty2 = row.querySelector('td:nth-child(3)').textContent.trim();

        // Collect rows with the same term ID and mealNo
        const rows = document.querySelectorAll(`[data-term-id="${termID}"]`);

        const components = [];
        rows.forEach((itemRow) => {
            const rowMealNo = itemRow.querySelector('td:first-child').textContent.trim();
            if (rowMealNo === mealNo) {
                const componentCell = itemRow.querySelector('td:nth-child(4)');
                const containerCell = itemRow.querySelector('td:nth-child(7)');
                const traysCell = itemRow.querySelector('td:nth-child(11)');

                if (componentCell && containerCell && traysCell) {
                    const component = componentCell.textContent.trim();
                    const container = containerCell.textContent.trim();
                    const trays = traysCell.textContent.trim();

                    if (container.toLowerCase() === 'sleeving') {
                        return;
                    }

                    components.push({ component, container, trays });
                }
            }
        });

        // Generate PDF based on the button clicked (C1 or C2)
        let doc;
        if (event.target.classList.contains('download-c1-sleeve')) {
            doc = generateSecondPDF(mealNo, mealDescription, sleevingConfig, qty1, components, termID, sleevingLoc, 1);
        } else {
            doc = generateSecondPDF(mealNo, mealDescription, sleevingConfig, qty2, components, termID, sleevingLoc, 2);
        }

        // Convert the PDF to a blob and open it in a new window for print preview
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl, '_blank');
        
        // Ensure the print preview is triggered once the PDF is loaded
        printWindow.onload = function() {
            printWindow.print();
        };
    }
});




function generateSecondPDF(mealNo, mealDescription, configuration, quantity, components, termID, sleevingLoc, cycle) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();  // Make sure jsPDF is initialized properly
    let currentY = 20;

    // Generate the QR code data
    const capitalizedSleevingLoc = sleevingLoc.charAt(0).toUpperCase() + sleevingLoc.slice(1);
    const qrCodeData = `${termID}${capitalizedSleevingLoc}${mealNo}${cycle}`;

    // Create QR Code using QRious
    const qr = new QRious({
        value: qrCodeData,
        size: 50  // Keep QR code at a size of 50 for better visibility
    });
    const qrCodeImage = qr.toDataURL();

    // Set fill color to gray for the title background
    doc.setFillColor(211, 211, 211);

    // Draw a gray rectangle behind the title
    doc.rect(30, currentY, 130, 10, 'F');

    // Add Title text
    doc.setFontSize(16);
    doc.text('SLEEVING VERIFICATION / INSPECTION FORM', 30, currentY + 7);

    // Add the QR code to the top-right corner
    doc.addImage(qrCodeImage, 'PNG', 180, currentY - 5, 20, 20);
    // Update currentY after adding title
    currentY += 15;

    // Set font size for form fields
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    // Draw form fields like Date, Start Time, etc.
    const formFieldHeight = 8;
    const formFieldWidth = 30;

    // Check for page overflow before adding form fields
    currentY = checkPageOverflow(doc, currentY, formFieldHeight * 2);

    doc.rect(20, currentY, formFieldWidth, formFieldHeight);  // 'Date'
    doc.rect(50, currentY, 40, formFieldHeight);  // 'Start Time'
    doc.rect(90, currentY, 35, formFieldHeight);  // 'Break (min)'
    doc.rect(125, currentY, 35, formFieldHeight); // 'Lunch (min)'
    doc.rect(160, currentY, 35, formFieldHeight); // 'End Time'

    // Add labels for form fields
    doc.text('Date', 25, currentY + 5);
    doc.text('Start Time AM/PM', 55, currentY + 5);
    doc.text('Break (min)', 95, currentY + 5);
    doc.text('Lunch (min)', 130, currentY + 5);
    doc.text('End Time AM/PM', 165, currentY + 5);

    // Add empty form fields for input
    currentY += formFieldHeight;
    doc.rect(20, currentY, formFieldWidth, formFieldHeight);  // Empty 'Date' field
    doc.rect(50, currentY, 40, formFieldHeight);  // Empty 'Start Time' field
    doc.rect(90, currentY, 35, formFieldHeight);  // Empty 'Break (min)' field
    doc.rect(125, currentY, 35, formFieldHeight);  // Empty 'Lunch (min)' field
    doc.rect(160, currentY, 35, formFieldHeight);  // Empty 'End Time' field

    // Update currentY after adding form fields
    currentY += formFieldHeight + 10; // Add some spacing before the next section

    // Add table header for Term, Meal, Description, Configuration, Quantity
    doc.setFontSize(12);
    const rowHeight = 10;

    const columnPositions = {
        termX: 20,
        termWidth: 20,
        mealX: 40,  // Original X position for 'Meal'
        mealWidth: 25,  // Increase width of 'Meal' by 5 units to widen the column
        descriptionX: 65,  // Adjust this X position to follow the new 'Meal' width
        descriptionWidth: 80,
        configX: 145,  // Adjust this X position accordingly
        configWidth: 35,
        qtyX: 180,  // Adjust this X position accordingly
        qtyWidth: 30
    };
    

    // Table header
    doc.rect(columnPositions.termX, currentY, columnPositions.termWidth, rowHeight);
    doc.rect(columnPositions.mealX, currentY, columnPositions.mealWidth, rowHeight);
    doc.rect(columnPositions.descriptionX, currentY, columnPositions.descriptionWidth, rowHeight);
    doc.rect(columnPositions.configX, currentY, columnPositions.configWidth, rowHeight);
    doc.rect(columnPositions.qtyX, currentY, columnPositions.qtyWidth, rowHeight);

    // Header text
    doc.text('Term', columnPositions.termX + 5, currentY + 7);
    doc.text('Meal', columnPositions.mealX + 5, currentY + 7);
    doc.text('Description', columnPositions.descriptionX + 5, currentY + 7);
    doc.text('Configuration', columnPositions.configX + 5, currentY + 7);
    doc.text('Quantity', columnPositions.qtyX + 5, currentY + 7);

    // Update currentY after header
    currentY += rowHeight;

    // Wrap the description to limit it to 2 rows
    let wrappedDescription = doc.splitTextToSize(mealDescription, columnPositions.descriptionWidth - 5);

    // Limit description to 2 lines if necessary
    if (wrappedDescription.length > 2) {
        wrappedDescription = wrappedDescription.slice(0, 2);
        wrappedDescription[1] = wrappedDescription[1] + '...';
    }

    // Wrap the configuration text to limit it to 2 rows
    let wrappedConfiguration = doc.splitTextToSize(configuration, columnPositions.configWidth - 5);

    // Limit configuration to 2 lines if necessary
    if (wrappedConfiguration.length > 2) {
        wrappedConfiguration = wrappedConfiguration.slice(0, 2);
        wrappedConfiguration[1] = wrappedConfiguration[1] + '...';
    }

    // Calculate the height needed for the data row
    const dataRowHeight = rowHeight * Math.max(wrappedDescription.length, wrappedConfiguration.length, 1);

    // Check for page overflow before adding data row
    currentY = checkPageOverflow(doc, currentY, dataRowHeight);

    // Data row for Term, Meal, Description, Configuration, and Quantity
    doc.rect(columnPositions.termX, currentY, columnPositions.termWidth, dataRowHeight);
    doc.rect(columnPositions.mealX, currentY, columnPositions.mealWidth, dataRowHeight);
    doc.rect(columnPositions.descriptionX, currentY, columnPositions.descriptionWidth, dataRowHeight);
    doc.rect(columnPositions.configX, currentY, columnPositions.configWidth, dataRowHeight);
    doc.rect(columnPositions.qtyX, currentY, columnPositions.qtyWidth, dataRowHeight);

    // Add text data
    doc.text(termID, columnPositions.termX + 5, currentY + 7);
    doc.text(mealNo, columnPositions.mealX + 5, currentY + 7);
    doc.text(wrappedDescription, columnPositions.descriptionX + 5, currentY + 7);
    doc.text(wrappedConfiguration, columnPositions.configX + 5, currentY + 7);
    doc.text(quantity, columnPositions.qtyX + 5, currentY + 7);

    // Update currentY after data row
    currentY += dataRowHeight + 10; // Add some spacing before the next section

    // Remove the preemptive check for page overflow here
    // Call helper function to add component/container table
    currentY = addComponentTable(doc, components, currentY);

    // Add some spacing before the next section
    currentY += 10;

    // Call helper function to add trays, component check, seals check, and headcount
    currentY = addTrayAndChecks(doc, currentY);

    // Add some spacing before the next section
    currentY += 10;

    // Call helper function to add hourly checks section
    currentY = addHourlyChecks(doc, currentY);
    // Return the generated document
    return doc;
}

// Helper function for component/container table
function addComponentTable(doc, components, currentY) {
    const trayWidth = 20;
    const componentWidth = 100;
    const containerWidth = 40;
    const rowHeight = 10; // Base row height for one line of text

    // Table header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold'); // Set font to bold for headers

    // Column positions based on cumulative width
    const trayX = 20;
    const componentX = trayX + trayWidth;
    const containerX = componentX + componentWidth;

    // Draw the table header (excluding '# of Trays' column)
    doc.rect(trayX, currentY, trayWidth, rowHeight);
    doc.rect(componentX, currentY, componentWidth, rowHeight);
    doc.rect(containerX, currentY, containerWidth, rowHeight);

    // Header text
    doc.text('Tray', trayX + 5, currentY + 7);
    doc.text('Component', componentX + 5, currentY + 7);
    doc.text('Container', containerX + 5, currentY + 7);

    // Reset the font to normal for the table data
    doc.setFont('helvetica', 'normal');

    // Update currentY to start the data rows
    currentY += rowHeight;

    // Rows for each component
    components.forEach((item) => {
        let trayType = item.container.toLowerCase().includes('tray 1') ? 'Tray 1' :
                       item.container.toLowerCase().includes('tray 2') ? 'Tray 2' : 'Garnish';

        // Wrap text for component and container cells
        const wrappedComponent = doc.splitTextToSize(item.component, componentWidth - 10);
        const wrappedContainer = doc.splitTextToSize(item.container, containerWidth - 10);
        const lineHeightFactor = 1.0;

        // Determine the maximum number of lines needed for this row
        const maxLines = Math.max(wrappedComponent.length, wrappedContainer.length);

        // Adjust the cell height to be 0.7 of the rowHeight
        const cellHeight = rowHeight * maxLines * lineHeightFactor * 0.7;


        // Check for page overflow before adding this row
        currentY = checkPageOverflow(doc, currentY, cellHeight);

        // Draw rectangles for the entire row without '# of Trays'
        doc.rect(trayX, currentY, trayWidth, cellHeight);
        doc.rect(componentX, currentY, componentWidth, cellHeight);
        doc.rect(containerX, currentY, containerWidth, cellHeight);

        // Vertical alignment for text in cells
        let textY = currentY + 5; // Starting Y position for text in the cell

        // Add text to the cells
        doc.text(trayType, trayX + 5, textY);
        doc.text(wrappedComponent, componentX + 5, textY, { maxWidth: componentWidth - 5, lineHeightFactor: 1.2 });
        doc.text(wrappedContainer, containerX + 5, textY, { maxWidth: containerWidth - 5, lineHeightFactor: 1.2 });

        // Update currentY for the next row
        currentY += cellHeight;

        // Check the number of trays and add an extra row if more than 1
        const trayCount = parseInt(item.trays.match(/\d+/)); // Extract the number of trays (e.g., "2 trays" => 2)
        if (trayCount > 1) {
            const extraTrays = trayCount - 1;
            doc.setFont('helvetica', 'bold');
            const extraTrayText = `${extraTrays} Extra Tray${extraTrays > 1 ? 's' : ''} Require`;
            
            // Add an extra row with the required trays
            currentY = checkPageOverflow(doc, currentY, rowHeight); // Ensure it doesn't overflow the page
            doc.rect(trayX, currentY, trayWidth, rowHeight);
            doc.rect(componentX, currentY, componentWidth, rowHeight);
            doc.rect(containerX, currentY, containerWidth, rowHeight);

            // Add text for the extra tray row
            doc.text(trayType, trayX + 5, currentY + 7);
            doc.text(extraTrayText, componentX + 5, currentY + 7);
            doc.setFont('helvetica', 'normal');
            doc.text('Aluminum Tray', containerX + 5, currentY + 7);

            // Update currentY after adding extra tray row
            currentY += rowHeight;
        }
    });

    // Return the final Y position after the table
    return currentY;
}




// Helper function to add trays, component check, seals check, and headcount
function addTrayAndChecks(doc, currentY) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const rowHeight = 12;

    // First row: # of Trays, Component Check, Seals Check, Headcount, Best by date, and an empty cell
    const trayX = 20;
    const trayWidth1 = 30;
    const componentCheckWidth = 30;
    const sealsCheckWidth = 30;
    const headcountWidth = 30;
    const bestByDateWidth = 30;
    const emptyCellWidth = 30;

    const componentCheckX = trayX + trayWidth1;
    const sealsCheckX = componentCheckX + componentCheckWidth;
    const headcountX = sealsCheckX + sealsCheckWidth;
    const bestByDateX = headcountX + headcountWidth;
    const emptyCellX = bestByDateX + bestByDateWidth;

    const requiredHeight = rowHeight + 12 + rowHeight + 12 + rowHeight;

    // Check for page overflow before adding this section
    currentY = checkPageOverflow(doc, currentY, requiredHeight);

    // Draw first row rectangles
    doc.rect(trayX, currentY, trayWidth1, rowHeight);  // '# of Trays'
    doc.rect(componentCheckX, currentY, componentCheckWidth, rowHeight);  // 'Component Check'
    doc.rect(sealsCheckX, currentY, sealsCheckWidth, rowHeight);  // 'Seals Check'
    doc.rect(headcountX, currentY, headcountWidth, rowHeight);  // 'Headcount'
    doc.rect(bestByDateX, currentY, bestByDateWidth, rowHeight);  // 'Best by date'
    doc.rect(emptyCellX, currentY, emptyCellWidth, rowHeight);  // Empty cell after 'Best by date'

    // Add labels for the first row fields
    doc.text('# of Trays', trayX + 5, currentY + 7);
    doc.text('Component Check', componentCheckX + 2, currentY + 7);
    doc.text('Seals Check', sealsCheckX + 5, currentY + 7);
    doc.text('Headcount ____', headcountX + 5, currentY + 7);
    doc.text('Best by date', bestByDateX + 2, currentY + 7);

    // Add checkboxes for the first row
    const checkboxSize = 5;
    doc.rect(trayX + trayWidth1 - 10, currentY + 1, checkboxSize, checkboxSize);  // Checkbox for '# of Trays'
    doc.rect(componentCheckX + componentCheckWidth - 10, currentY + 1, checkboxSize, checkboxSize);  // Checkbox for 'Component Check'
    doc.rect(sealsCheckX + sealsCheckWidth - 10, currentY + 1, checkboxSize, checkboxSize);  // Checkbox for 'Seals Check'

    // Second row: QA, Leadership, Produced Qty
    const qaX = 20;
    const qaWidth = 40;
    const leadershipX = qaX + qaWidth;
    const leadershipWidth = 60;
    const producedQtyX = leadershipX + leadershipWidth;
    const producedQtyWidth = 50;

    const row2Y = currentY + rowHeight + 0;

    // Draw second row rectangles
    doc.rect(qaX, row2Y, qaWidth, rowHeight);  // QA
    doc.rect(leadershipX, row2Y, leadershipWidth, rowHeight);  // Leadership
    doc.rect(producedQtyX, row2Y, producedQtyWidth, rowHeight);  // Produced Qty

    // Text for second row
    doc.text('QA:___________', qaX + 2, row2Y + 7);
    doc.text('Leadership:___________', leadershipX + 2, row2Y + 7);
    doc.text('Produced Qty:______', producedQtyX + 2, row2Y + 7);

    // Third row: Box Closer
    const boxCloserX = 20;
    const boxCloserWidth1 = 150;
    const row3Y1 = row2Y + rowHeight + 0;

    // Draw third row rectangle
    doc.rect(boxCloserX, row3Y1, boxCloserWidth1, rowHeight);  // Box Closer
    doc.text('Box Closer____________________________________', boxCloserX + 5, row3Y1 + 7);

    // Return updated currentY
    return row3Y1 + rowHeight;
}

// Helper function for hourly checks
function addHourlyChecks(doc, currentY) {
    const boxHeight = 10;
    const boxWidth = 18;

    // Title for Hourly Checks
    doc.setFont('helvetica', 'normal');
    const title = 'Hourly Checks';
    const titleWidth = doc.getTextWidth(title);
    const centerX = (210 - titleWidth) / 2;
    doc.text(title, centerX, currentY);

    // Update currentY after title
    currentY += 5;

    // Hourly boxes
    for (let i = 0; i < 8; i++) {
        const boxX = 15 + (i * (boxWidth + 5));
        const labelY = currentY + 10;
        const boxY = labelY + 5;

        // Check for page overflow before adding each hour box
        currentY = checkPageOverflow(doc, currentY, boxHeight + 15);

        doc.text(`Hour ${i + 1}`, boxX + 2, labelY);
        doc.rect(boxX, boxY, boxWidth, boxHeight);
    }

    // Return updated currentY
    return currentY + boxHeight + 15;
}


// Helper function to check for page overflow
function checkPageOverflow(doc, currentY, requiredHeight) {
    const pageHeight = doc.internal.pageSize.height;
    if (currentY + requiredHeight > pageHeight) {
        doc.addPage();
        return 20;  // Reset Y position after adding a new page
    }
    return currentY;
}
