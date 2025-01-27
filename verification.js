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

document.addEventListener('DOMContentLoaded', function () {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const database = firebase.database();
    let rawData = [];
    let filteredData = [];
    let facilityOptions = new Set();
    let taskOptions = new Set();
    let productOptions = new Set();
    let termOptions = new Set(); // Added term options for filtering
    let currentSortField = 'term';
    let currentSortDirection = 'asc';

    // Define the cookingTasks object at the top-level scope
    const cookingTasks = {
        'Batch Mix': 220,
        'Sauce Mix': 400,
        'Open': 400,
        'Drain': 400,
        'Kettle': 10,
        "Oven": 120,
        "Thaw": 5000,
        "VCM": 25,
        "Planetary Mix": 75,
        "Skillet": 10
    };

    // Calculate the current term and set it as the default search term
    const currentTerm = calculateCurrentTerm();
    document.getElementById('searchTerm').value = currentTerm; // Set the input field to the current term

    // Fetch data from Firebase
    database.ref('Master_Task').once('value').then(snapshot => {
        rawData = snapshot.val();
        populateFilters();
        setupSearchAutoComplete();
        displayData();  // Automatically display the data for the current term
    });

    function populateFilters() {
        filteredData = [];

        for (let term in rawData) {
            const trimmedTerm = term.trim(); // Trim the term to avoid trailing spaces
            const termData = rawData[term];
            if (Array.isArray(termData)) {
                termData.forEach(entry => {
                    filteredData.push({ term: trimmedTerm, ...entry });
                    if (entry.Facility) {
                        facilityOptions.add(entry.Facility);
                    }
                    if (entry.Task) {
                        taskOptions.add(entry.Task);
                    }
                    if (entry.Product) {
                        productOptions.add(entry.Product);
                    }
                    if (term) {
                        termOptions.add(trimmedTerm);
                    }
                });
            }
        }
    }

    function setupSearchAutoComplete() {
        const searchFacilityInput = document.getElementById('searchFacility');
        const facilitySuggestionsBox = document.getElementById('facilitySuggestions');
        const searchTaskInput = document.getElementById('searchTask');
        const taskSuggestionsBox = document.getElementById('taskSuggestions');
        const searchProductInput = document.getElementById('searchProduct');
        const productSuggestionsBox = document.getElementById('productSuggestions');
        const searchTermInput = document.getElementById('searchTerm');
        const termSuggestionsBox = document.getElementById('termSuggestions');

        // Event listeners for auto-complete inputs (Facility, Task, Product, Term)
        setupAutoComplete(searchFacilityInput, facilitySuggestionsBox, facilityOptions);
        setupAutoComplete(searchTaskInput, taskSuggestionsBox, taskOptions);
        setupAutoComplete(searchProductInput, productSuggestionsBox, productOptions);
        setupAutoComplete(searchTermInput, termSuggestionsBox, termOptions);
    }

    function setupAutoComplete(inputElement, suggestionsBox, optionsSet) {
        inputElement.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            suggestionsBox.innerHTML = '';

            if (searchTerm.length > 0) {
                const suggestions = Array.from(optionsSet)
                    .filter(option => option.toLowerCase().includes(searchTerm));

                suggestions.forEach(suggestion => {
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.textContent = suggestion;
                    suggestionDiv.addEventListener('click', function () {
                        inputElement.value = suggestion;
                        suggestionsBox.innerHTML = '';
                        displayData(); // Update the table based on the selected suggestion
                    });
                    suggestionsBox.appendChild(suggestionDiv);
                });
            }
        });
    }

    function displayData() {
        const searchFacility = document.getElementById('searchFacility').value.toLowerCase();
        const searchTask = document.getElementById('searchTask').value.toLowerCase();
        const searchProduct = document.getElementById('searchProduct').value.toLowerCase();
        const searchTerm = document.getElementById('searchTerm').value.toLowerCase();

        const filtered = filteredData.filter(entry => {
            const facility = entry.Facility ? entry.Facility.toLowerCase() : "";
            const task = entry.Task ? entry.Task.toLowerCase() : "";
            const product = entry.Product ? entry.Product.toLowerCase() : "";
            const term = entry.term ? entry.term.toLowerCase() : "";

            return facility.includes(searchFacility) && task.includes(searchTask) && product.includes(searchProduct) && term.includes(searchTerm);
        });

        displayTable(filtered);
    }

    function displayTable(data) {
        const tbody = document.getElementById('dataTable').querySelector('tbody');
        tbody.innerHTML = '';

        // Sort data before displaying
        data.sort((a, b) => {
            let fieldA = a[currentSortField];
            let fieldB = b[currentSortField];

            // Handle numeric sorting
            if (!isNaN(parseFloat(fieldA)) && !isNaN(parseFloat(fieldB))) {
                fieldA = parseFloat(fieldA);
                fieldB = parseFloat(fieldB);
            }

            if (fieldA < fieldB) return currentSortDirection === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        data.forEach((entry) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.term}</td>
                <td>${entry.Facility || ''}</td>
                <td>${entry.Meal || ''}</td>
                <td>${entry.Cycle || ''}</td>
                <td>${entry.Product || ''}</td>
                <td>${entry.Count || ''}</td>
                <td>${entry.Task || ''}</td>
                <td>${entry.Equipment || ''}</td>
                <td>${parseFloat(entry["Project Hours"] || 0).toFixed(2)}</td>
                <td>${parseFloat(entry["Man Hours"] || 0).toFixed(2)}</td>
                <td>${entry.Day || ''}</td>
                <td><button class="generate-pdf-btn">Generate PDF</button></td>
            `;
            tbody.appendChild(row);
        });

        // Attach the click event listener to each "Generate PDF" button
        document.querySelectorAll('.generate-pdf-btn').forEach(button => {
            button.addEventListener('click', function () {
                const row = button.closest('tr');
                const entry = {
                    term: row.children[0].textContent,
                    Facility: row.children[1].textContent,
                    Meal: row.children[2].textContent,
                    Cycle: row.children[3].textContent,
                    Product: row.children[4].textContent,
                    Count: row.children[5].textContent,
                    Task: row.children[6].textContent,
                    Equipment: row.children[7].textContent,
                    "Project Hours": row.children[8].textContent,
                    "Man Hours": row.children[9].textContent,
                    Day: row.children[10].textContent,
                };
                generatePDF(entry);
            });
        });
    }


    function extractTableData() {
        const table = document.getElementById('dataTable');
        const rows = table.querySelectorAll('tbody tr');
        const data = [];

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const entry = {
                term: cells[0].textContent,
                Facility: cells[1].textContent,
                Meal: cells[2].textContent,
                Cycle: cells[3].textContent,
                Product: cells[4].textContent,
                Count: cells[5].textContent,
                Task: cells[6].textContent,
                Equipment: cells[7].textContent,
                "Project Hours": cells[8].textContent,
                "Man Hours": cells[9].textContent,
                Day: cells[10].textContent,
            };
            data.push(entry);
        });

        return data;
    }

    document.getElementById('downloadPdfButton').addEventListener('click', function () {
        const tableData = extractTableData();

        if (tableData.length > 0) {
            // Create two PDFs, one for Cooking and one for Portioning
            const { jsPDF } = window.jspdf;
            const cookingDoc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            const portioningDoc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            let cookingEntries = 0;
            let portioningEntries = 0;

            tableData.forEach((entry, index) => {
                if (cookingTasks.hasOwnProperty(entry.Task)) {
                    if (cookingEntries > 0) cookingDoc.addPage(); // Add a new page for each entry
                    generatePDFContent(cookingDoc, entry);
                    cookingEntries++;
                } else {
                    if (portioningEntries > 0) portioningDoc.addPage(); // Add a new page for each entry
                    generatePDFContent(portioningDoc, entry);
                    portioningEntries++;
                }
            });

            // Save the PDFs if they have entries
            if (cookingEntries > 0) cookingDoc.save('Combined_Cooking_Inspection_Forms.pdf');
            if (portioningEntries > 0) portioningDoc.save('Combined_Portioning_Inspection_Forms.pdf');
        }
    });

    function generatePDFContent(doc, entry) {
        // Exclude if the task is "Sleeving"
        if (entry.Task === "Sleeving") {
            return; // Do not generate PDF for "Sleeving" tasks
        }
    
        const isCookingForm = cookingTasks.hasOwnProperty(entry.Task);
        const formTitle = isCookingForm ? "COOKING/ INSPECTION FORM" : "PORTIONING/ INSPECTION FORM";
        
        // Set up page margins and font size
        const pageWidth = 297;  // A4 landscape width in mm
        const margin = 5;
        const lineHeight = 8;
        const checkboxSize = 5;  // Define checkboxSize here
    
        // Header details based on form type
        doc.setFont("Arial", "");  // Set to Arial with normal weight
        doc.setFontSize(10);
        const headerTitle = isCookingForm ? "CK001" : "PD001";
        doc.text(headerTitle, margin, margin);
        doc.text("ISSUE DATE : 09/15/2024", margin + 50, margin);
        doc.text("REVISION NUMBER : 1", margin + 140, margin);
        doc.text("SUPERSEDES : 10/1/2023", margin + 220, margin);
    
        // QR Code generation
        const qrData = `${entry.term.trim()}${entry.Facility}${entry.Day}${entry.Meal}${entry.Count}`;
    
        const qrCanvas = document.createElement('canvas'); // Create a canvas element
        const qr = new QRious({
            element: qrCanvas, // Canvas element
            value: qrData, // QR code data (term, facility, count)
            size: 50, // Size of the QR code
            level: 'H' // Error correction level
        });
    
        const imgData = qrCanvas.toDataURL('image/png'); // Convert QR code to base64 image
        doc.addImage(imgData, 'PNG', 247, 10, 30, 30); // Place QR code at top right
    
        // Set gray highlight for the title
        doc.setFontSize(24);
        const titleWidth = doc.getTextWidth(formTitle); // Measure the title width
        const highlightX = (pageWidth - titleWidth) / 2 - 10; // Adjust X position of the highlight to center it
        const highlightWidth = titleWidth + 20; // Adjust width to slightly pad the title width
    
        doc.setFillColor(169, 169, 169);  // Light gray color
        doc.rect(highlightX, margin + 10, highlightWidth, lineHeight + 10, "F"); // Use adjusted X and width for the highlight
        doc.setTextColor(0, 0, 0);  // Black text
        doc.text(formTitle, pageWidth / 2, margin + 20, { align: 'center' });

    
        // Adjusting the positions for Term, Meal, Day, and Qty
        doc.setFontSize(14);
        const qtyLabel = isCookingForm ? `LB. ${entry.Count}` : `Qty : ${entry.Count}`;
        doc.text(`Term : ${entry.term}                   Facility : ${entry.Facility}                Meal : ${entry.Meal}                   ${qtyLabel}            ${entry.Day}`, margin, margin + 32);

        // Highlight Product Name
        doc.setFillColor(255, 255, 0);  // Yellow background
        doc.setFontSize(20);
        doc.rect(margin, margin + 42, pageWidth - 2 * margin, lineHeight + 12, "F");
        doc.text(`${entry.Product}`, pageWidth / 2, margin + 52, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Setup : ____ mins  | Start Time : ____________ AM / PM | Break : ____ mins  | End Time : ____________ AM / PM  | Cleanup : ____ mins", margin, margin + 67);

        // Positioning Task and other details based on form type
        if (isCookingForm) {
            doc.text(`Task : ${entry.Task}         Equipment : ${entry.Equipment}                Ending Bulk Weight : __________ LBS          Staff:         `, margin, margin + 82);
        } else {
            doc.text("Lead : __________________", margin, margin + 82);
            doc.text("Produced Qty. ________", margin + 100, margin + 82);
        }

        // Adding the container table
        if (isCookingForm) {
            doc.setFontSize(12);
            const containersNeeded = Math.min(Math.ceil(entry.Count / cookingTasks[entry.Task]), 72);  // Limit to 72 containers
            const colCount = 8; // Number of columns per row
            const rowCount = Math.ceil(containersNeeded / colCount); // Total rows needed

            let startX = margin;
            let startY = margin + 92;
            const colWidth = (pageWidth - 2 * margin) / colCount;
            const rowHeight = 9;

            let cntrNumber = 1;

            for (let row = 0; row < rowCount; row++) {
                for (let col = 0; col < colCount && cntrNumber <= containersNeeded; col++) {
                    doc.rect(startX + col * colWidth, startY + row * rowHeight, colWidth, rowHeight);
                    doc.text(`Cntr ${cntrNumber}`, startX + col * colWidth + 2, startY + row * rowHeight + rowHeight - 2);
                    cntrNumber++;
                }
            }

            startY += rowCount * rowHeight + 5;

            doc.rect(margin, startY, checkboxSize, checkboxSize);
            doc.text("Clean prior to Start: initial____                                    Manager Verification:                                     Sample Delivered: Y / N  initial ____", margin + checkboxSize + 2, startY + 5);
            startY += 15;
            doc.rect(margin, startY, checkboxSize, checkboxSize);
            doc.text("Ingredients Verified: initial____                                   Date : __________                                          Pass Sensory Test: Y / N / NA  initial ____", margin + checkboxSize + 2, startY + 5);
            startY += 25;
        } else {
            // doc.text("Alt_hrs : ______ hours", margin, margin + 97);
            doc.text(`Task : ${entry.Task}`, margin + 100, margin + 97);
            doc.text(`Cycle : ${entry.Cycle}`, margin + 200, margin + 97);

            let checkboxPosition = margin + 112;
            doc.rect(margin, checkboxPosition, checkboxSize, checkboxSize);
            doc.text("Clean prior to Start: initial____", margin + checkboxSize + 2, checkboxPosition + 5);
            checkboxPosition += 15;
            if (entry.Task === "Tray Portioning and Sealing") {
                doc.rect(margin, checkboxPosition, checkboxSize, checkboxSize);
                doc.text("Trays Check: initial____", margin + checkboxSize + 2, checkboxPosition + 5);
            }
            doc.setTextColor(255, 0, 0);
            doc.text("Leadership Verification:", margin, checkboxPosition + 25);
            doc.text("Notes:", margin, checkboxPosition + 35);
        }
    }

    window.generatePDF = function (entry) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        generatePDFContent(doc, entry);

        // Save the generated PDF
        const fileName = cookingTasks.hasOwnProperty(entry.Task) ? 'Cooking_Inspection_Form.pdf' : 'Portioning_Inspection_Form.pdf';
        doc.save(fileName);
    };

    // Sorting functionality
    const headers = document.querySelectorAll('#dataTable thead th');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.getAttribute('data-sort');
            if (currentSortField === sortField) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = sortField;
                currentSortDirection = 'asc';
            }

            // Remove sort classes from all headers
            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

            // Add the relevant sort class to the active header
            if (currentSortDirection === 'asc') {
                header.classList.add('sort-asc');
            } else {
                header.classList.add('sort-desc');
            }

            displayTable(filteredData); // Only refresh the table with sorted data
        });
    });
});





function addDataToFirebase(rowData) {
    // Initialize Firebase if not already done
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const database = firebase.database();

    // Prepare the data object based on the rowData
    const dataToAdd = {
        term: rowData.term,
        Facility: rowData.Facility || '',
        Meal: rowData.Meal || '',
        Cycle: rowData.Cycle || '',
        Product: rowData.Product || '',
        Count: rowData.Count || '',
        Task: rowData.Task || '',
        Equipment: rowData.Equipment || '',
        "Project Hours": parseFloat(rowData["Project Hours"] || 0).toFixed(2),
        "Man Hours": parseFloat(rowData["Man Hours"] || 0).toFixed(2),
        Day: rowData.Day || ''
    };

    // Reference to the Firebase location where the data should be added/updated
    const termRef = database.ref(`Master_Task/${rowData.term}`);

    // Push the data to Firebase
    termRef.push(dataToAdd)
        .then(() => {
            console.log("Data added successfully to Firebase");
        })
        .catch((error) => {
            console.error("Error adding data to Firebase:", error);
        });
}

// Example function to extract data from a row and pass it to the above function
function extractRowAndAddToFirebase(rowElement) {
    const cells = rowElement.querySelectorAll('td');
    const rowData = {
        term: cells[0].textContent,
        Facility: cells[1].textContent,
        Meal: cells[2].textContent,
        Cycle: cells[3].textContent,
        Product: cells[4].textContent,
        Count: cells[5].textContent,
        Task: cells[6].textContent,
        Equipment: cells[7].textContent,
        "Project Hours": cells[8].textContent,
        "Man Hours": cells[9].textContent,
        Day: cells[10].textContent,
    };

    // Call the function to add the data to Firebase
    addDataToFirebase(rowData);
}

