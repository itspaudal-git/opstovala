// Check if Firebase is already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // If already initialized, use that one
}

const database = firebase.database();

// DOM elements
const searchButton = document.getElementById('searchButton');
const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];

// Search and display data
searchButton.addEventListener('click', () => {
    const term = document.getElementById('searchTerm').value;
    const facility = document.getElementById('searchFacility').value;
    const day = document.getElementById('searchDay').value;

    dataTable.innerHTML = ''; // Clear previous results

    // Reference to the "Packout" node in Firebase
    const packoutRef = database.ref('Packout');

    packoutRef.once('value', (snapshot) => {
        snapshot.forEach((termSnapshot) => {
            const termKey = termSnapshot.key;
            if (term && termKey !== term) return; // Filter by term

            termSnapshot.forEach((entrySnapshot) => {
                const entry = entrySnapshot.val();

                if (
                    (!facility || entry.Facility === facility) &&
                    (!day || entry.Day === day)
                ) {
                    // Create a new row in the table for each matching entry
                    const row = dataTable.insertRow();
                    row.insertCell(0).textContent = entry.Term;
                    row.insertCell(1).textContent = entry.Date;
                    row.insertCell(2).textContent = entry.Time;
                    row.insertCell(3).textContent = entry.Meal;
                    row.insertCell(4).textContent = entry.Day;
                    row.insertCell(5).textContent = entry.Facility;
                }
            });
        });
    });
});
