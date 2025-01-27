// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Firebase references
const db = firebase.database();
const masterTaskRef = db.ref('Master_Task');
const archiveRef = db.ref('Archive');

// DOM elements
const masterTaskList = document.getElementById('masterTaskList');
const archiveList = document.getElementById('archiveList');

// Event listeners for drag-and-drop
masterTaskList.addEventListener('dragstart', handleDragStart);
archiveList.addEventListener('dragstart', handleDragStart);

masterTaskList.addEventListener('dragover', handleDragOver);
archiveList.addEventListener('dragover', handleDragOver);

masterTaskList.addEventListener('drop', handleDrop);
archiveList.addEventListener('drop', handleDrop);

// Load initial data
function loadData() {
    masterTaskRef.on('value', (snapshot) => {
        const data = snapshot.val();
        displayTasks(data, masterTaskList, 'Master_Task');
    });

    archiveRef.on('value', (snapshot) => {
        const data = snapshot.val();
        displayTasks(data, archiveList, 'Archive');
    });
}

// Display tasks in the provided list element
function displayTasks(tasks, listElement, source) {
    listElement.innerHTML = ''; // Clear current list
    for (const term in tasks) {
        const taskItem = document.createElement('div');
        taskItem.textContent = `Term: ${term}`;
        taskItem.className = 'task-item';
        taskItem.draggable = true;
        taskItem.dataset.term = term;
        taskItem.dataset.source = source;
        listElement.appendChild(taskItem);
    }
}

// Drag event handlers
let draggedItem = null;

function handleDragStart(e) {
    e.target.classList.add('dragging');
    draggedItem = e.target;
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedItem && e.target.classList.contains('task-list')) {
        const term = draggedItem.dataset.term;
        const source = draggedItem.dataset.source;
        const destination = e.target.id === 'masterTaskList' ? 'Master_Task' : 'Archive';

        if (source !== destination) {
            moveTask(term, source, destination);
        }
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
}

// Move task between nodes in Firebase
function moveTask(term, source, destination) {
    const sourceRef = source === 'Master_Task' ? masterTaskRef : archiveRef;
    const destinationRef = destination === 'Master_Task' ? masterTaskRef : archiveRef;

    sourceRef.child(term).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Remove from source and add to destination
            destinationRef.child(term).set(data, (error) => {
                if (!error) {
                    sourceRef.child(term).remove(); // Remove from source node
                } else {
                    console.error('Error moving task:', error);
                }
            });
        }
    });
}

// Load initial data
loadData();
