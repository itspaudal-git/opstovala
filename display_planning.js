// Firebase configuration and initialization
if (!firebase.apps.length) {
    const firebaseConfig = {
        // Your Firebase configuration details here
    };
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Use existing app if already initialized
}

const database = firebase.database();

// Variables for Gantt chart and timeline rendering
const ganttChart = document.getElementById('ganttChart');
const dayOptions = document.getElementById('dayOptions');
const taskOptions = document.getElementById('taskOptions');
const equipmentOptions = document.getElementById('equipmentOptions');
const facilityOptions = document.getElementById('facilityOptions');

// Helper variables to store unique dropdown options
let uniqueDays = new Set();
let uniqueTasks = new Set();
let uniqueEquipments = new Set();
let uniqueFacilities = new Set();

// Facility dropdown options
const defaultFacilityOptions = ['Tubeway', 'Pershing', 'Westvala'];

// Populate facilityOptions datalist with default values
defaultFacilityOptions.forEach((facility) => {
    const option = document.createElement('option');
    option.value = facility;
    facilityOptions.appendChild(option);
});

// Constants for chart dimensions and scaling
const chartStartHour = 5; // Starting hour for the chart (5:00 AM)
const totalChartHours = 12; // Display from 5:00 AM to 5:00 PM (12 hours if you want 4:00 PM you can adjust)
const pixelsPerInch = 96; // Number of pixels per inch
const hourSpacingInInches = 3; // Spacing for each hour in inches
const pixelsPerHour = hourSpacingInInches * pixelsPerInch; // Calculate px per hour
const chartWidth = totalChartHours * pixelsPerHour; // Total width
const pixelsPerMinute = pixelsPerHour / 60; // Pixels per minute

// Set Gantt chart width dynamically
ganttChart.style.width = `${chartWidth}px`;

// Create tooltip element
const tooltip = document.createElement('div');
tooltip.id = 'tooltip';
tooltip.style.position = 'absolute';
tooltip.style.padding = '10px';
tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
tooltip.style.color = 'white';
tooltip.style.borderRadius = '5px';
tooltip.style.pointerEvents = 'none';
tooltip.style.zIndex = '150';
tooltip.style.display = 'none';
document.body.appendChild(tooltip);

// Create and display time labels above the Gantt chart
function renderTimeLabels() {
    const timeLabelsContainer = document.createElement('div');
    timeLabelsContainer.className = 'time-labels-container';
    timeLabelsContainer.style.position = 'absolute';
    timeLabelsContainer.style.top = '0';
    timeLabelsContainer.style.left = '0';
    timeLabelsContainer.style.height = '30px';
    timeLabelsContainer.style.width = '100%';
    timeLabelsContainer.style.display = 'flex';
    timeLabelsContainer.style.justifyContent = 'space-between';
    timeLabelsContainer.style.padding = '0 10px';
    timeLabelsContainer.style.zIndex = '100';

    // 5:00 AM to 4:00 PM labels (adjust if you want 5:00 PM)
    const timeLabels = [
        '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM',
        '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
    ];

    timeLabels.forEach((label) => {
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.style.width = `${pixelsPerHour}px`;
        timeLabel.style.textAlign = 'center';
        timeLabel.style.borderRight = '1px solid #ddd';
        timeLabel.style.fontWeight = 'bold';
        timeLabel.textContent = label;
        timeLabelsContainer.appendChild(timeLabel);
    });

    ganttChart.appendChild(timeLabelsContainer);
}

// Render the red line for current time
function renderCurrentTimeLine() {
    const currentTimeLine = document.createElement('div');
    currentTimeLine.id = 'currentTimeLine';
    currentTimeLine.style.position = 'absolute';
    currentTimeLine.style.width = '2px';
    currentTimeLine.style.height = `${ganttChart.scrollHeight}px`;
    currentTimeLine.style.backgroundColor = 'red';
    currentTimeLine.style.top = '0';
    currentTimeLine.style.zIndex = '110';

    ganttChart.appendChild(currentTimeLine);

    updateCurrentTimeLine(currentTimeLine);
    setInterval(() => updateCurrentTimeLine(currentTimeLine), 60000); // update every minute
}

// Calculate current timeline position
function updateCurrentTimeLine(lineElement) {
    const now = new Date();
    const minutesSinceStart = (now.getHours() - chartStartHour) * 60 + now.getMinutes();
    const position = minutesSinceStart * pixelsPerMinute;
    lineElement.style.left = `${position}px`;
}

// Ensure the red line updates on scroll
window.addEventListener('scroll', () => {
    const currentTimeLine = document.getElementById('currentTimeLine');
    if (currentTimeLine) {
        updateCurrentTimeLine(currentTimeLine);
    }
});

// Render highlighted area for elapsed time
function renderHighlightedTimeArea() {
    let highlightedArea = document.getElementById('highlightedArea');

    if (!highlightedArea) {
        highlightedArea = document.createElement('div');
        highlightedArea.id = 'highlightedArea';
        highlightedArea.style.position = 'absolute';
        highlightedArea.style.height = '30px'; 
        highlightedArea.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
        highlightedArea.style.top = '0px';
        highlightedArea.style.left = '0px';
        highlightedArea.style.zIndex = '100';
        highlightedArea.style.pointerEvents = 'none';

        const timeLabelsContainer = document.querySelector('.time-labels-container');
        if (timeLabelsContainer) {
            timeLabelsContainer.appendChild(highlightedArea);
        }
    }

    updateHighlightedTimeArea(highlightedArea);

    setInterval(() => updateHighlightedTimeArea(highlightedArea), 60000); // update every minute
}

function updateHighlightedTimeArea(areaElement) {
    const now = new Date();
    const minutesSinceStart = (now.getHours() - chartStartHour) * 60 + now.getMinutes();
    const width = Math.min(minutesSinceStart * pixelsPerMinute, chartWidth);
    areaElement.style.width = `${width}px`;
}

// Data arrays
let masterTaskData = [];
let filteredData = [];

// Grab our filter inputs
const termInput = document.getElementById('termInput');
const dayInput = document.getElementById('dayInput');
const taskInput = document.getElementById('taskInput');
const equipmentInput = document.getElementById('equipmentInput');
const facilityInput = document.getElementById('facilityInput');

// Listen for changes
[termInput, facilityInput].forEach(input => {
    input.addEventListener('input', updateDropdowns);
});
[dayInput, taskInput, equipmentInput].forEach(input => {
    input.addEventListener('input', loadData);
});

// Calculate the current term
function calculateCurrentTerm() {
    const baseTerm = 403; // example starting term
    const startDate = new Date('2024-09-15'); 
    const currentDate = new Date();

    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksPassed = Math.floor((currentDate - startDate) / msPerWeek);
    return baseTerm + weeksPassed;
}

// Update dropdown options
function updateDropdowns() {
    const termValue = termInput.value.trim();
    const facilityValue = facilityInput.value.trim();

    uniqueDays = new Set();
    uniqueTasks = new Set();
    uniqueEquipments = new Set();

    masterTaskData.forEach((item) => {
        const termMatch = termValue === '' || (item.Term && item.Term.toString().trim() === termValue);
        const facilityMatch = facilityValue === '' || (item.Facility && item.Facility.toLowerCase().includes(facilityValue.toLowerCase()));

        if (termMatch && facilityMatch) {
            if (item.Day) uniqueDays.add(item.Day);
            if (item.Task) uniqueTasks.add(item.Task);
            if (item.Equipment) uniqueEquipments.add(item.Equipment);
        }
    });

    populateDropdownOptions();
    loadData();
}

// Populate dropdowns
function populateDropdownOptions() {
    dayOptions.innerHTML = '';
    taskOptions.innerHTML = '';
    equipmentOptions.innerHTML = '';

    uniqueDays.forEach((day) => {
        const option = document.createElement('option');
        option.value = day;
        dayOptions.appendChild(option);
    });

    uniqueTasks.forEach((task) => {
        const option = document.createElement('option');
        option.value = task;
        taskOptions.appendChild(option);
    });

    uniqueEquipments.forEach((equipment) => {
        const option = document.createElement('option');
        option.value = equipment;
        equipmentOptions.appendChild(option);
    });
}

// Load data based on filters
function loadData() {
    const termValue = termInput.value.trim();
    const dayValue = dayInput.value.trim();
    const taskValue = taskInput.value.trim();
    const equipmentValue = equipmentInput.value.trim();
    const facilityValue = facilityInput.value.trim();

    filteredData = masterTaskData.filter((item) => {
        const termMatch = termValue === '' || (item.Term && item.Term.toString().trim() === termValue);
        const dayMatch = dayValue === '' || (item.Day && item.Day.toLowerCase().includes(dayValue.toLowerCase()));
        const equipmentMatch = equipmentValue === '' || (item.Equipment && item.Equipment.toLowerCase().includes(equipmentValue.toLowerCase()));
        const facilityMatch = facilityValue === '' || (item.Facility && item.Facility.toLowerCase().includes(facilityValue.toLowerCase()));

        // Handle multiple tasks if user enters comma-separated tasks
        const taskArray = taskValue.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');
        const itemTask = item.Task ? item.Task.toLowerCase() : '';
        const taskMatch = taskArray.length === 0 || taskArray.some(taskTerm => itemTask.includes(taskTerm));

        return termMatch && dayMatch && taskMatch && equipmentMatch && facilityMatch;
    });

    renderGanttChart(filteredData);
}

// Fetch data
database.ref('Master_Task').on('value', (snapshot) => {
    masterTaskData = [];
    snapshot.forEach((termSnapshot) => {
        termSnapshot.forEach((taskSnapshot) => {
            const task = taskSnapshot.val();
            task.key = taskSnapshot.key;
            masterTaskData.push(task);

            if (task.Day) uniqueDays.add(task.Day);
            if (task.Task) uniqueTasks.add(task.Task);
            if (task.Equipment) uniqueEquipments.add(task.Equipment);
            if (task.Facility) uniqueFacilities.add(task.Facility);
        });
    });

    populateDropdownOptions();
    updateDropdowns();
});

// Auto set term on load
window.onload = () => {
    termInput.value = calculateCurrentTerm();
    loadData();
    renderTimeLabels();
    renderCurrentTimeLine();
    renderHighlightedTimeArea();
};

// Calculate bar width from Start_Time/End_Time
function calculateBarWidth(start, end) {
    if (!start || !end) return 0;
    const minutesDuration = (end - start) / (1000 * 60); 
    const width = minutesDuration * pixelsPerMinute;
    return Math.max(width, 60); // min width for visibility
}

// Bar position from Start_Time
function calculateBarPosition(start) {
    if (!start) return 0;
    const startTime = new Date(start);
    const startHour = startTime.getHours() - chartStartHour;
    const minutes = startTime.getMinutes();
    const totalMinutes = startHour * 60 + minutes;
    return totalMinutes * pixelsPerMinute;
}

// Determine status from Start and End
function determineTaskStatus(task) {
    const hasStart = !!task.Start; // e.g. '10:00 AM' if set
    const hasEnd = !!task.End;     // e.g. '11:00 AM' if set

    if (hasStart && hasEnd) {
        return 'Complete';         // Both Start and End => Complete
    } else if (hasStart && !hasEnd) {
        return 'In Progress';      // Start set, End not set => In Progress
    }
    // Otherwise, no Start or we can't deduce => "Not Specified" 
    // We’ll return '' here, then handle color logic separately
    return '';
}

// Decide bar color from derived status and current time vs End_Time
function getBarColor(task) {
    const status = determineTaskStatus(task); 
    if (status === 'Complete') {
        // Light Green
        return 'lightgreen';
    } else if (status === 'In Progress') {
        // Light Yellow
        return 'lightyellow';
    } else {
        // If neither Complete nor In Progress, check if current time > End_Time
        if (task.End_Time) {
            const end = parseTime(task.End_Time);
            if (end && new Date() > end) {
                // Pink (overdue)
                return 'pink';
            }
        }
        // Otherwise default light gray
        return 'lightgray';
    }
}

// Render Gantt chart with tasks
function renderGanttChart(tasks) {
    // Clear existing chart
    ganttChart.innerHTML = '';
    // Re-render the time labels
    renderTimeLabels();

    // Group by equipment
    const equipmentGroups = new Map();

    tasks.forEach((task) => {
        const { Equipment } = task;
        if (!equipmentGroups.has(Equipment)) {
            equipmentGroups.set(Equipment, []);
        }
        equipmentGroups.get(Equipment).push(task);
    });

    let rowIndex = 1;

    equipmentGroups.forEach((taskList) => {
        taskList.forEach((task) => {
            const taskStart = parseTime(task.Start_Time);
            const taskEnd = parseTime(task.End_Time);

            if (!taskStart || !taskEnd) return; // skip if missing times

            const barWidth = calculateBarWidth(taskStart, taskEnd);
            const barPosition = calculateBarPosition(taskStart);

            const taskBar = document.createElement('div');
            taskBar.className = 'task-bar';
            taskBar.style.left = `${barPosition}px`;
            taskBar.style.width = `${barWidth}px`;
            taskBar.style.top = rowIndex === 1 ? '70px' : `${rowIndex * 70}px`;
            taskBar.style.position = 'absolute';
            taskBar.style.height = '50px';
            taskBar.style.padding = '5px';
            taskBar.style.whiteSpace = 'normal';
            taskBar.style.boxSizing = 'border-box';
            taskBar.style.overflow = 'visible';

            // Set color based on Start/End and current time
            taskBar.style.backgroundColor = getBarColor(task);

            // Bar label
            taskBar.textContent = `${task.Product || ''} (${formatTimeRange(taskStart, taskEnd)})`;

            // We'll use the key for editing
            const taskKey = task.key || task.index;
            const taskTerm = task.Term || 'unknown-term';

            // Tooltip event listeners
            taskBar.addEventListener('mouseenter', (e) => showTooltip(e, task));
            taskBar.addEventListener('mousemove', moveTooltip);
            taskBar.addEventListener('mouseleave', hideTooltip);

            // Double-click => prompt new Start_Time
            taskBar.addEventListener('dblclick', () => {
                const newStartTime = prompt(
                    `Enter a new Start time for ${task.Product} (HH:MM AM/PM)`,
                    task.Start_Time || ''
                );
                if (newStartTime) {
                    const parsedStart = parseTime(newStartTime);
                    if (parsedStart) {
                        const updates = {};
                        updates[`Master_Task/${taskTerm}/${taskKey}/Start_Time`] = newStartTime;

                        database.ref().update(updates, (error) => {
                            if (error) {
                                alert('Error updating Start time: ' + error.message);
                            } else {
                                showNotification('Start time updated successfully!');
                                task.Start_Time = newStartTime; 
                                renderGanttChart(filteredData); 
                            }
                        });
                    } else {
                        alert('Invalid time format. Please use HH:MM AM/PM format.');
                    }
                }
            });

            ganttChart.appendChild(taskBar);
        });
        rowIndex++;
    });
}

// Parse time from "HH:MM AM/PM" into Date
function parseTime(timeString) {
    if (!timeString) return null;
    const [time, period] = timeString.split(' ');
    const [hours, minutes] = time.split(':').map(Number);

    let formattedHours = hours;
    if (period === 'PM' && hours !== 12) {
        formattedHours += 12;
    }
    if (period === 'AM' && hours === 12) {
        formattedHours = 0;
    }

    const date = new Date();
    date.setHours(formattedHours, minutes, 0, 0);
    return date;
}

// Format time range
function formatTimeRange(start, end) {
    if (!start || !end) return '';
    return `${start.getHours().toString().padStart(2, '0')}:${start
        .getMinutes()
        .toString()
        .padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
}

// Show tooltip
function showTooltip(e, task) {
    tooltip.style.display = 'block';

    // Derive status from Start/End
    let derivedStatus = determineTaskStatus(task);
    if (!derivedStatus) derivedStatus = 'Not Specified';

    // Build tooltip content
    tooltip.innerHTML = `
        <strong>Lead:</strong> ${task.Lead || ''}
        <br><strong>Meal:</strong> ${task.Meal || ''}
        <br><strong>Cycle:</strong> ${task.Cycle || ''}
        <br><strong>Start (Production):</strong> ${task.Start || ''}
        <br><strong>End (Production):</strong> ${task.End || ''}
        <br><strong>Start_Time (Planning):</strong> ${task.Start_Time || ''}
        <br><strong>End_Time (Planning):</strong> ${task.End_Time || ''}
        <br><strong>Equipment:</strong> ${task.Equipment || ''}
        <br><strong>Product:</strong> ${task.Product || ''}
        <br><strong>Count:</strong> ${task.Count || ''}
        <br><strong>Project Hours:</strong> ${parseFloat(task['Project Hours'] || 0).toFixed(2)}
        <br><strong>Status:</strong> ${derivedStatus}
        <br><strong>Teams:</strong> ${task.Teams || ''}
    `;
}

// Move tooltip with mouse
function moveTooltip(e) {
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
}

// Hide tooltip
function hideTooltip() {
    tooltip.style.display = 'none';
}

// Show notification
function showNotification(message) {
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
        notificationContainer.style.color = 'white';
        notificationContainer.style.padding = '15px 25px';
        notificationContainer.style.borderRadius = '8px';
        notificationContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        notificationContainer.style.zIndex = '1000';
        notificationContainer.style.fontSize = '16px';
        document.body.appendChild(notificationContainer);
    }

    notificationContainer.textContent = message;
    notificationContainer.style.display = 'block';

    setTimeout(() => {
        notificationContainer.style.display = 'none';
    }, 3000);
}
