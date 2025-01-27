const storageRef = firebase.storage().ref();

// Get modal elements
const modal = document.getElementById('pdfModal');
const modalCloseBtn = document.getElementById('closeModal');
const pdfViewer = document.getElementById('pdfViewer');
const fullScreenBtn = document.getElementById('fullScreenBtn');

// Function to close the modal
if (modalCloseBtn) {
    modalCloseBtn.onclick = function() {
        modal.style.display = "none";
    }
}

// Full-Screen functionality
if (fullScreenBtn) {
    fullScreenBtn.onclick = function() {
        if (pdfViewer.requestFullscreen) {
            pdfViewer.requestFullscreen();
        } else if (pdfViewer.mozRequestFullScreen) { // Firefox
            pdfViewer.mozRequestFullScreen();
        } else if (pdfViewer.webkitRequestFullscreen) { // Chrome, Safari and Opera
            pdfViewer.webkitRequestFullscreen();
        } else if (pdfViewer.msRequestFullscreen) { // IE/Edge
            pdfViewer.msRequestFullscreen();
        }
    }
}

// Function to fetch files from Firebase Storage
function fetchFiles() {
    const fileList = document.getElementById('fileList');
    if (!fileList) {
        console.error('fileList element not found.');
        return;
    }
    fileList.innerHTML = ''; // Clear the file list before adding new files

    // Get the 'BOL/' folder from Firebase Storage
    storageRef.child('BOL').listAll().then((res) => {
        let files = res.items;

        if (files.length === 0) {
            const noResults = document.getElementById('noResults');
            if (noResults) {
                noResults.style.display = 'block';
            }
            return;
        }

        // Fetch metadata for each file
        const metadataPromises = files.map(fileRef => fileRef.getMetadata());

        Promise.all(metadataPromises).then((metadataArray) => {
            // Combine fileRefs with metadata
            const filesWithMetadata = files.map((fileRef, index) => ({
                fileRef,
                metadata: metadataArray[index]
            }));

            // Sort files by time uploaded (most recent first)
            filesWithMetadata.sort((a, b) => {
                return new Date(b.metadata.timeCreated) - new Date(a.metadata.timeCreated);
            });

            // Show only the first 50 files
            filesWithMetadata.slice(0, 50).forEach(({fileRef, metadata}) => {
                displayFile(fileRef, metadata);
            });
        }).catch((error) => {
            console.error('Error fetching metadata:', error);
            alert('Failed to fetch file metadata.');
        });
    }).catch((error) => {
        console.error('Error fetching files:', error);
        alert('Failed to fetch files.');
    });
}

// Function to display a single file
function displayFile(fileRef, metadata) {
    const fileList = document.getElementById('fileList');
    if (!fileList) {
        console.error('fileList element not found.');
        return;
    }

    const fileName = metadata.name;
    const fileTime = new Date(metadata.timeCreated).toLocaleString();

    // Get download URL
    fileRef.getDownloadURL().then((url) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${fileName}</td>
            <td><a href="${url}" target="_blank">Download</a></td>
            <td>${fileTime}</td>
            <td><button onclick="viewPDF('${url}')">View</button></td>
        `;
        fileList.appendChild(row);
    }).catch((error) => {
        console.error('Error getting download URL:', error);
    });
}

// Function to open PDF in modal
function viewPDF(pdfUrl) {
    if (modal && pdfViewer) {
        modal.style.display = "block";
        pdfViewer.src = pdfUrl;
    } else {
        console.error('Modal or pdfViewer elements not found.');
    }
}

// Function to search for files by name
function searchFiles() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        console.error('searchInput element not found.');
        return;
    }
    const query = searchInput.value.toLowerCase();
    const fileList = document.getElementById('fileList');
    if (!fileList) {
        console.error('fileList element not found.');
        return;
    }
    const rows = fileList.getElementsByTagName('tr');
    let found = false;

    for (let i = 0; i < rows.length; i++) {
        const fileNameCell = rows[i].getElementsByTagName('td')[0];
        const fileName = fileNameCell ? fileNameCell.textContent.toLowerCase() : '';

        if (fileName.indexOf(query) > -1) {
            rows[i].style.display = '';
            found = true;
        } else {
            rows[i].style.display = 'none';
        }
    }

    const noResults = document.getElementById('noResults');
    if (noResults) {
        noResults.style.display = found ? 'none' : 'block';
    }
}

// Fetch files on page load after authentication
window.onload = function() {
    // Ensure that window.auth is defined
    if (window.auth && window.auth.currentUser) {
        fetchFiles();
    } else {
        console.log('User not authenticated, files will be fetched after authentication.');
        // Listen to auth state changes to fetch files when authenticated
        window.auth.onAuthStateChanged(function(user) {
            if (user) {
                fetchFiles();
            }
        });
    }
};

// Close the modal if the user clicks outside of it
window.onclick = function(event) {
    if (modal && event.target == modal) {
        modal.style.display = "none";
    }
};
