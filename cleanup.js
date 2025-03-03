document.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded fired. Checking Firebase initialization...');

  // Initialize Firebase
  if (!firebase.apps.length) {
    console.log('[DEBUG] Initializing Firebase...');
    firebase.initializeApp(firebaseConfig);
  }

  const cleanupBtn = document.getElementById('cleanupBtn');
  if (!cleanupBtn) {
    console.error('No element with id="cleanupBtn" found in HTML!');
    return;
  }

  cleanupBtn.addEventListener('click', () => {
    console.log('[DEBUG] Cleanup button clicked - removing any item that has no Term or an empty Term.');

    const masterRef = firebase.database().ref('Master_Task');
    masterRef.once('value')
      .then(snapshot => {
        const masterData = snapshot.val();
        if (!masterData) {
          console.warn('[DEBUG] No data in Master_Task.');
          return;
        }

        const updates = {};

        // Loop over each top-level key in Master_Task
        Object.entries(masterData).forEach(([nodeKey, childArray]) => {
          if (Array.isArray(childArray)) {
            console.log(`Inspecting array under "${nodeKey}" with length: ${childArray.length}`);
            childArray.forEach((item, index) => {
              // If the item doesn't exist, or .Term is missing, or .Term is ""
              if (!item || !('Term' in item) || item.Term.trim() === '') {
                console.log(`[DEBUG] Deleting ${nodeKey}/${index} because 'Term' is missing or empty:`, item);
                updates[`${nodeKey}/${index}`] = null; // null => delete
              } else {
                console.log(`[DEBUG] Keeping ${nodeKey}/${index}, item.Term="${item.Term}"`);
              }
            });
          }
        });

        const pathsToDelete = Object.keys(updates).length;
        if (pathsToDelete === 0) {
          console.log('[DEBUG] No items found with missing/empty Term. Nothing to delete.');
          return;
        }

        console.log(`[DEBUG] Deleting ${pathsToDelete} item(s) with missing/empty Term...`);
        masterRef.update(updates)
          .then(() => {
            console.log('[DEBUG] Bulk deletion complete.');
            alert(`Deleted ${pathsToDelete} item(s) missing or empty Term.`);
          })
          .catch(err => {
            console.error('Error in bulk deletion:', err);
          });
      })
      .catch(err => {
        console.error('Error reading Master_Task:', err);
      });
  });
});
