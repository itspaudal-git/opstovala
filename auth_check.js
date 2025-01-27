// Initialize Firebase (only if not already initialized)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// Check user authentication status and email domain
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Authenticated user:", user.email);
        if (user.email.endsWith('@tovala.com')) {
            // Allow the user to stay on the page
            console.log('User is authenticated and authorized');
        } else {
            // Sign out the user if they are not authorized and redirect them
            console.log('Unauthorized user, redirecting to login page');
            auth.signOut().then(() => {
                window.location.href = 'index.html'; // Redirect to login page
            });
        }
    } else {
        // No user is signed in, redirect to login page
        console.log('No user signed in, redirecting to login');
        window.location.href = 'index.html'; // Redirect to login page
    }
});
