document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOMContentLoaded fired. Checking Firebase initialization...');
  
    // Initialize Firebase if not already done
    if (!firebase.apps.length) {
      console.log('[DEBUG] Initializing Firebase app...');
      firebase.initializeApp(firebaseConfig);
    } else {
      console.log('[DEBUG] Firebase app already initialized.');
    }
  
    // Grab the button
    const cleanupBtn = document.getElementById('cleanupBtn');
    if (!cleanupBtn) {
      console.error('Could not find <button id="cleanupBtn"> in the HTML!');
      return;
    }
  
    // On button click, delete items that have "Term":"425"
    cleanupBtn.addEventListener('click', () => {
      console.log('[DEBUG] Cleanup button clicked. Will read Master_Task data...');
  
      // Reference your "Master_Task" node in Realtime Database
      const masterRef = firebase.database().ref('Master_Task');
  
      // 1. Read the entire node
      masterRef.once('value')
        .then(snapshot => {
          const data = snapshot.val();
          if (!data) {
            console.warn('[DEBUG] No data in Master_Task. Nothing to delete.');
            return;
          }
  
          console.log('[DEBUG] Fetched Master_Task data:', data);
  
          // We'll store "paths to delete" in a single update operation
          const updates = {};
  
          // 2. Loop over each top-level key in "Master_Task" (e.g. "100", "425", etc.)
          Object.entries(data).forEach(([trimmedTermKey, childArray]) => {
            console.log(`\n[DEBUG] Top-level key: "${trimmedTermKey}". Value:`, childArray);
  
            // Typically childArray is an array of items
            if (Array.isArray(childArray)) {
              console.log(`[DEBUG] This key has an array with length = ${childArray.length}`);
  
              // 3. For each item in that array, we build a new object to hold extra info
              childArray.forEach((item, index) => {
                // For debugging, let's log the raw item
                console.log(`  [${trimmedTermKey}/${index}] =>`, item);
  
                // Build a new object that includes item + 'key' + 'term' (the top-level key)
                const newObj = { 
                  ...item,           // all fields from the DB item
                  key: index,        // the array index
                  term: trimmedTermKey.trim() // the top-level key, trimmed
                };
  
                console.log('    newObj =', newObj);
  
                // 4. If we want to delete items that DO have "Term":"425",
                //    we can check if the DB field item.Term === "425".
                //    Or, if we want to check newObj.term, we do that. 
                //    (Here let's assume we specifically want to match item.Term === "425".)
                if (item && item.Term === '424') {
                  console.log(`    --> Marking for DELETE because item.Term = "${item.Term}"`);
                  
                  // We'll set the path to null => means delete
                  updates[`${trimmedTermKey}/${index}`] = null;
                }
              });
            } else {
              console.log(`[DEBUG] Key "${trimmedTermKey}" is not an array, ignoring.`);
            }
          });
  
          // 5. If we found no paths to delete, we do nothing
          const numDeletes = Object.keys(updates).length;
          if (numDeletes === 0) {
            console.log('[DEBUG] No items found that match "Term"="425". Nothing to delete.');
            return;
          }
  
          // 6. Bulk update to delete all matched items at once
          console.log(`[DEBUG] Found ${numDeletes} item(s) with "Term"="425". Deleting now...`);
          masterRef.update(updates)
            .then(() => {
              console.log('[DEBUG] Bulk deletion complete! The matching items were removed.');
              alert(`Deleted ${numDeletes} item(s) that had "Term"="425". Check console for details.`);
            })
            .catch(err => {
              console.error('[ERROR] Bulk delete failed:', err);
            });
        })
        .catch(err => {
          console.error('[ERROR] Reading Master_Task failed:', err);
        });
    });
  });
  