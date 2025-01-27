document.getElementById('downloadcompc1').addEventListener('click', () => generateCompPDF(1));
document.getElementById('downloadcompc2').addEventListener('click', () => generateCompPDF(2));

function generateCompPDF(cycle) {
    const term = document.getElementById('searchTerm').value.trim();
    const facility = document.getElementById('facilitySelect').value; // Selected facility

    if (term === '') {
        document.getElementById('status').textContent = "Please enter a term.";
        return;
    }

    const url = `https://misevala-api.tvla.co/v0/productionRecords/${term}?facilityNetwork=${facility}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const meals = data['cycles'][cycle]['meals'];
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            meals.forEach((meal, index) => {
                const mealNo = meal['mealCode'];
                const mealDescription = meal['apiMealTitle'];
                const qty = meal['totalMeals'];
                const termID = data['termID'];

                // Here, we extract the correct sleeving location for each meal
                const sleevingLoc = meal['tags'].find(tag => tag['category'] === "sleeving_location")?.title || 'N/A';

                // Special containers to be excluded
                const specialContainers = [
                    "tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra",
                    "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"
                ];

                // Extract and filter materials, excluding special containers
                const materials = meal['billOfMaterials']
                    .map(material => {
                        const name = material['title'];
                        const container = material['tags'].find(tag => tag['category'] === "container")?.title || 'N/A';
                        return { name, container };
                    })
                    .filter(material => !specialContainers.includes(material.container.toLowerCase())); // Filter out special containers

                // Pass the dynamically retrieved sleeving location to the function
                addStyledMealToPDF(doc, termID, mealNo, mealDescription, qty, cycle, materials, sleevingLoc);

                if (index < meals.length - 1) {
                    doc.addPage();
                }
            });

            // Open the PDF in a new window for print preview
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
        })
        .catch(error => {
            document.getElementById('status').textContent = "Error fetching data: " + error.message;
        });
}


function addStyledMealToPDF(doc, termID, mealNo, mealDescription, qty, cycle, materials, sleevingLoc) {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Load custom font if needed
    doc.setFont('helvetica', 'bold');

    // Add title with larger font size and bold style
    doc.setFontSize(22);
    const titleTerm = `Term: ${termID}`;
    const titleMealNo = `Meal No: ${mealNo}`;
    const titleDescription = `${mealDescription}`;

    const termTextWidth = doc.getTextWidth(titleTerm);
    const mealTextWidth = doc.getTextWidth(titleMealNo);
    const descriptionTextWidth = doc.getTextWidth(titleDescription);

    const termX = (pageWidth - termTextWidth) / 2;
    const mealX = (pageWidth - mealTextWidth) / 2;
    const descriptionX = (pageWidth - descriptionTextWidth) / 2;

    // Add section with a gray background box for visual grouping
    doc.setFillColor(230, 230, 230); // Light gray background
    doc.rect(20, 10, pageWidth - 40, 35, 'F'); // Adjusted height for better spacing

    doc.setFontSize(20);
    doc.setTextColor(50, 50, 50);
    doc.text(titleTerm, termX, 25); // Centered and adjusted Y position
    doc.text(titleMealNo, mealX, 35); // Centered and adjusted Y position
    doc.text(titleDescription, descriptionX, 45); // Centered and adjusted Y position

    // Add quantity, cycle, and correct sleeving location with spacing
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(`Quantity: ${qty}`, 20, 60);
    doc.text(`Cycle: ${cycle}`, 80, 60);
    doc.text(`Shipping Location: ${sleevingLoc}`, 140, 60); // Adjusted X position

    // Add section heading for Materials with a separator line
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Materials:', 20, 70);
    doc.line(20, 72, pageWidth - 20, 72); // Draw separator line

    // Materials section with better formatting and aligned text
    materials.forEach((material, index) => {
        const rowY = 80 + (index * 10);

        if (material.container.toLowerCase().startsWith("tray")) {
            doc.setFont('helvetica', 'bold'); // Make "tray" items bold
        } else {
            doc.setFont('helvetica', 'normal'); // Normal font for other items
        }

        // Slight indentation for rows and aligned columns
        doc.text(`${material.name}`, 30, rowY);
        doc.text(`........`, 100, rowY); // Dots to connect name and container
        doc.text(`${material.container}`, 120, rowY);
    });
}
