document.querySelector('#downloadtowerc1').addEventListener('click', function () {
    downloadTowersheetPDF(true); // For Cycle 1
});

document.querySelector('#downloadtowerc2').addEventListener('click', function () {
    downloadTowersheetPDF(false); // For Cycle 2
});

function downloadTowersheetPDF(isCycle1) {
    const { jsPDF } = window.jspdf;  // Access jsPDF from the global object
    const facilitySelect = document.getElementById('facilitySelect2');  // Facility dropdown
    const selectedFacility = facilitySelect.value;  // Get selected facility
    let tableRows = Array.from(document.querySelectorAll('#dataTable tbody tr'));

    // Filter rows based on matching 'portion_location' and the selected facility
    tableRows = tableRows.filter(row => {
        if (!row || row.cells.length < 12) {
            return false; // Skip rows that do not have enough cells
        }
        const portion_location = row.cells[5]?.textContent || '';  // Location column (6th column)
        return portion_location === selectedFacility;  // Only include rows where portion_location matches the selected facility
    });

    // Initialize jsPDF instance
    const doc = new jsPDF();
    let isContentAdded = false;

    // Loop through each row and generate the content for the PDF
    tableRows.forEach((row, index) => {
        const task = row.cells[6]?.textContent.trim(); // Task column (7th column)
        if (task === "Sleeving") {
            const mealNo = row.cells[0]?.textContent.trim();  // Meal No
            const mealDescription = row.cells[3]?.textContent.trim();  // Meal Description
            const quantity = isCycle1 ? row.cells[1]?.textContent.trim() : row.cells[2]?.textContent.trim();  // Original Quantity for Cycle 1 or 2
            const termID = row.getAttribute('data-term-id');  // Term ID
            const sleevingLoc = row.getAttribute('data-sleeving-loc');  // Sleeving Location

            // Fetch the selected value of bins configuration from the dropdown in column 10
            let binsConfigSelect = row.querySelector('td:nth-child(11) select');  // Access the dropdown in column 10
            let binsConfig = binsConfigSelect ? binsConfigSelect.value : 'N/A';  // Get the selected value

            let tower_ct, bins_ct, notes;

            // Conditional logic for different bins configurations
            if (binsConfig === "Red Bins") {
                tower_ct = 160;  // Meals per tower for Red Bins
                bins_ct = 16;    // Bins per tower for Red Bins
                bins_ct1 = 10;
                notes = "16 meals per bin, 10 bins totaling 160 meals in a tower";
            } else if (binsConfig === "Blue Bins") {
                tower_ct = 240;  // Meals per tower for Blue Bins
                bins_ct = 12;    // Bins per tower for Blue Bins
                bins_ct1 = 20;
                notes = "12 short boi boxes per bin, 2 bins wide per blue dollie can stack 10 high per tower (240 meals per tower)";
            } else if (binsConfig === "Trays") {
                tower_ct = 216;  // Meals per tower for Blue Bins
                bins_ct = 18;    // Bins per tower for Blue Bins
                bins_ct1 = 12;
                notes = "It's 12 bins, 18 meals per bin, 216 total";
            } else {
                tower_ct = 160;  // Meals per tower for default configuration
                bins_ct = 16;    // Bins per tower for default configuration
                bins_ct1 = 10;
                notes = "Default : 16 meals per bin, 10 bins totaling 160 meals in a tower";
            }

            // Calculate total number of towers required based on quantity
            const totalTowers = Math.ceil(quantity / tower_ct);

            // Loop through each tower and create a new page for each one
            for (let towerNum = 1; towerNum <= totalTowers; towerNum++) {
                if (isContentAdded) {
                    doc.addPage();
                }

                // Title Term in Red
                doc.setFont("Arial", "bold");
                doc.setFontSize(48);
                doc.setTextColor(255, 0, 0);
                doc.text('Term ' + String(termID), 105, 35, null, null, 'center');

                // Reset text color and font for the next section
                doc.setTextColor(0, 0, 0);
                doc.setFont("Arial", "normal");
                doc.setFontSize(40);

                // Display MEAL with Cycle 1 or 2
                if (isCycle1) {
                    doc.text('MEAL ' + String(mealNo), 105, 55, null, null, 'center');
                } else {
                    doc.text('MEAL ' + String(mealNo) + ' -A', 105, 55, null, null, 'center');
                }

                // Display meal description with a filled background
                doc.setFillColor(0, 255, 255);
                doc.setFontSize(42);
                doc.setFont("Arial", "bold");
                doc.rect(10, 65, 190, 20, 'F');  // Create a filled rectangle
                // Wrap and display meal description
                const wrappedMealDescription = doc.splitTextToSize(String(mealDescription), 180);  // Adjust the width if needed
                doc.text(wrappedMealDescription, 15, 80);

                // Display Tower 1 and Tower 2
                doc.setFont("Times", "normal");
                doc.setFontSize(52);
                doc.text('Tower ' + towerNum, 105, 130, null, null, 'center');
                doc.text('OF', 105, 160, null, null, 'center');
                doc.text('Tower ' + totalTowers, 105, 190, null, null, 'center');

                // Display bins and meals for the current tower
                if (towerNum === totalTowers) {
                    let remainingMeals = quantity % tower_ct;
                    let remainingBins = Math.floor(remainingMeals / bins_ct);
                    let remainingMealsLastBin = remainingMeals % bins_ct;

                    doc.setFont("Arial", "bold");
                    doc.setFontSize(36);
                    doc.text(`Bins ${remainingBins} Meals ${remainingMealsLastBin}`, 105, 220, null, null, 'center');
                } else {
                    doc.setFont("Arial", "bold");
                    doc.setFontSize(36);
                    doc.text(`Bins ${bins_ct1} Meals 0`, 105, 220, null, null, 'center');
                }

                // Wrap and display notes section
                const wrappedNotes = doc.splitTextToSize(notes, 180);  // Adjust the width if needed
                doc.setFont("Arial", "normal");
                doc.setFontSize(24);
                doc.text(wrappedNotes, 105, 240, null, null, 'center');

                // Add binsConfig at the bottom of the page
                doc.setFont("Arial", "bold");
                doc.setFontSize(18);  // Adjust the font size if needed
                doc.text(`Bins Config: ${binsConfig}`, 105, 290, null, null, 'center');  // Display binsConfig below the notes


                isContentAdded = true;
            }
        }
    });

    // // Save the PDF if content has been added
    // if (isContentAdded) {
    //     doc.save(`Facility_${selectedFacility}_Cycle${isCycle1 ? '1' : '2'}.pdf`);
    // } else {
    //     alert('No data to download for the selected facility and cycle.');
    // }
// Save the PDF if content has been added
if (isContentAdded) {
    // Open the PDF in a new window for print preview
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
} else {
    alert('No data to download for the selected facility and cycle.');
}

}
