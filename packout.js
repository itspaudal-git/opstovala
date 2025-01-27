// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

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

// Display Term and Day
const termDisplay = document.getElementById('termDisplay');
const dayDisplay = document.getElementById('dayDisplay');
const facilitySelect = document.getElementById('facilitySelect');

const currentTerm = calculateCurrentTerm();
termDisplay.textContent = currentTerm;

const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
dayDisplay.textContent = currentDay;

// Check for browser compatibility
if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Sorry, your browser does not support speech recognition.');
} else {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true; // Keep listening until stopped
    recognition.interimResults = false; // Return only final results
    recognition.lang = 'en-US';

    // Elements
    const statusDiv = document.getElementById('status');
    const logDiv = document.getElementById('log');

    // Start Recognition
    recognition.start();
    statusDiv.textContent = 'Listening for meal numbers...';

    recognition.onresult = function(event) {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim();
                processTranscript(transcript);
            }
        }
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error detected: ' + event.error);
        statusDiv.textContent = 'Error occurred: ' + event.error;
        // Restart recognition if needed
        if (event.error === 'no-speech' || event.error === 'network') {
            recognition.stop();
            recognition.start();
        }
    };

    recognition.onend = function() {
        // Restart recognition if it stops unexpectedly
        recognition.start();
    };

    function processTranscript(transcript) {
        console.log('Heard:', transcript);
        // Regular expression to match "Meal Number X"
        const regex = /meal\s+(number\s+)?(\d+)/i;
        const match = transcript.match(regex);

        if (match && match[2]) {
            const mealNumber = match[2];
            const currentDate = new Date();
            const dateString = currentDate.toLocaleDateString();
            const timeString = currentDate.toLocaleTimeString();
            const facility = facilitySelect.value;
            const day = currentDay;
            const term = currentTerm;

            // Log data to Firebase under "Packout/Term" node
            const packoutRef = database.ref(`Packout/${term}`).push();
            packoutRef.set({
                Date: dateString,
                Time: timeString,
                Meal: mealNumber,
                Day: day,
                Facility: facility,
                Term: term
            }, function(error) {
                if (error) {
                    console.error('Error writing to Firebase:', error);
                } else {
                    console.log('Data saved successfully.');
                    displayLog({
                        Date: dateString,
                        Time: timeString,
                        Meal: mealNumber,
                        Day: day,
                        Facility: facility,
                        Term: term
                    });
                }
            });
        } else {
            console.log('No meal number detected in the transcript.');
        }
    }

    function displayLog(entry) {
        const logEntry = document.createElement('p');
        logEntry.textContent = `Term: ${entry.Term}, Date: ${entry.Date}, Time: ${entry.Time}, Meal: ${entry.Meal}, Day: ${entry.Day}, Facility: ${entry.Facility}`;
        logDiv.insertBefore(logEntry, logDiv.firstChild);
    }
}
