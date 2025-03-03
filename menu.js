// menu.js

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // Initialize Firebase app if not already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized.');
    } else {
        console.log('Firebase already initialized.');
    }

    const auth = firebase.auth();
    window.database = firebase.database();
    const database = firebase.database();
    const roleUrl = 'https://raw.githubusercontent.com/itspaudal-git/ignore_list/main/role.json';

    // Expose auth and database globally
    window.auth = auth;
    window.database = database;

    const menuContainer = document.getElementById('menu-container');
    const sidebar = document.getElementById('sidebar');
    const userInfoDiv = document.getElementById('user-info');
    const logoutButton = document.getElementById('logout-button');
    const loginContainer = document.getElementById('login-container');

    // Define the different menus for various roles
    const menus = {
        "Production": [
            {
                name: "Production", 
                submenus: [
                    { name: "Monitor", link: "air.html" },
                    { name: "Master Task List", link: "aaa.html" },
                    { name: "Equipment View", link: "display_planning.html" },
                    { name: "Daily Planning", link: "daily_planning_v2.html" },
                    { name: "Jen", link: "master_task_view.html" },
                    { name: "EOD Report", link: "eod.html" },
                    { name: "Name Report", link: "project.html" },
                    { name: "Daily Schedule", link: "employee.html" },
                    { name: "Overtime", link: "overtime.html" },
                    { name: "Yield", link: "new_yield.html" },
                    { name: "Transfer", link: "transfer.html" },
                    { name: "Wip/Tower/Sleeving Verification", link: "buil_master_task.html" },
                    { name: "Addon/ De-Coupled Add on", link: "sot.html" },
                    { name: "Portion/Cooking Verification", link: "verificationv1.html" }
                ]
            }
        ],

        "HR": [
            {
                name: "HR", 
                submenus: [
                    { name: "Daily Schedule", link: "employee.html" },
                    { name: "Overtime", link: "overtime.html" },
                    { name: "Attendance", link: "manage_employee.html" },
                    { name: "Equipment View", link: "display_planning.html" },
                    { name: "EOD Report", link: "eod.html" },
                    { name: "Name Report", link: "project.html" }
                ]
            }
        ],
        "Warehouse": [
            {
                name: "Warehouse", 
                submenus: [
                    { name: "Transfer", link: "transfer.html" },
                    { name: "BOL", link: "bol.html" },
                    { name: "Ingredient Pull", link: "ingredient_pull.html" }
                ]
            }
        ],
        "Manager": [
            {
                name: "Production", 
                submenus: [
                    { name: "Master Task List", link: "aaa.html" },
                    { name: "Equipment View", link: "display_planning.html" },
                    { name: "Jen", link: "master_task_view.html" },
                    { name: "Monitor", link: "air.html" },
                    { name: "Transfer", link: "transfer.html" },
                    { name: "Yield", link: "new_yield.html" },
                    { name: "Dashboard", link: "daily_productionv2.html" },
                    { name: "Scan Production", link: "production_report.html" },
                    { name: "Daily Planning", link: "daily_planning_v2.html" },
                    { name: "EOD Report", link: "eod.html" },
                    { name: "Name Report", link: "project.html" },
                    { name: "Wip/Tower/Sleeving Verification", link: "buil_master_task.html" },
                    { name: "Addon/ De-Coupled Add on", link: "sot.html" },
                    { name: "Portion/Cooking Verification", link: "verificationv1.html" }
                ]
            },
            {
                name: "HR", 
                submenus: [
                    { name: "Daily Schedule", link: "employee.html" },
                    { name: "Overtime", link: "overtime.html" },
                    { name: "Attendance", link: "manage_employee.html" }
                ]
            },
            {
                name: "Warehouse", 
                submenus: [
                    { name: "Transfer", link: "transfer.html" },
                    { name: "BOL", link: "bol.html" },
                    { name: "Ingredient Pull", link: "ingredient_pull.html" }
                ]
            },
            {
                name: "Quality", 
                submenus: [
                    { name: "QA Dashboard", link: "quality.html" },
                    { name: "Sleeving", link: "sleeving.html" },
                    { name: "Cooking/Cooling", link: "cooking_data_view.html" }
                ]
            },
            {
                name: "Reports", 
                submenus: [
                    { name: "Yield", link: "new_yield.html" },
                    { name: "MPH", link: "mph.html" },
                    { name: "Looker", link: "looker.html" },
                    { name: "Old Yield", link: "yield.html" },
                    { name: "Term Error", link: "error.html" },
                    { name: "Old Time Studies", link: "study.html" },
                    { name: "Packout", link: "packout.html" }
                ]
            }
        ],
        "Admin": [
            {
                name: "Production", 
                submenus: [
                    { name: "Master Task List", link: "aaa.html" },
                    { name: "Equipment View", link: "display_planning.html" },
                    { name: "Monitor", link: "air.html" },
                    { name: "Dashboard", link: "daily_productionv2.html" },
                    { name: "Daily Planning", link: "daily_planning_v2.html" },
                    { name: "Jen", link: "master_task_view.html" },
                    { name: "EOD Report", link: "eod.html" },
                    { name: "Name Report", link: "project.html" },
                    { name: "Wip/Tower/Sleeving Verification", link: "buil_master_task.html" },
                    { name: "Addon/ De-Coupled Add on", link: "sot.html" },
                    { name: "Portion/Cooking Verification", link: "verificationv1.html" }
                ]
            },
            {
                name: "HR", 
                submenus: [
                    { name: "Daily Schedule", link: "employee.html" },
                    { name: "Overtime", link: "overtime.html" },
                    { name: "Attendance", link: "manage_employee.html" }
                ]
            },
            {
                name: "Warehouse", 
                submenus: [
                    { name: "Transfer", link: "transfer.html" },
                    { name: "BOL", link: "bol.html" },
                    { name: "Ingredient Pull", link: "ingredient_pull.html" }
                ]
            },
            {
                name: "Quality", 
                submenus: [
                    { name: "QA Dashboard", link: "quality.html" },
                    { name: "Sleeving", link: "sleeving.html" },
                    { name: "Cooking/Cooling", link: "cooking_data.html" },
                    { name: "Line Haul", link: "linehaul.html" }
                ]
            },
            {
                name: "Reports", 
                submenus: [
                    { name: "Yield", link: "new_yield.html" },
                    { name: "MPH", link: "mph.html" },
                    { name: "Looker", link: "looker.html" },
                    { name: "Old Yield", link: "yield.html" },
                    { name: "Term Error", link: "error.html" },
                    { name: "Old Time Studies", link: "study.html" },
                    { name: "Packout", link: "packout.html" },
                    { name: "Dashboard", link: "daily_productionv2.html" }
                ]
            },
            {
                name: "Admin", 
                submenus: [
                    { name: "BOL", link: "bol.html" },
                    { name: "Archive", link: "archive.html" },
                    { name: "Status", link: "status.html" },
                    { name: "Documentation", link: "documentation.html" }
                ]
            }
        ]
    };

    console.log('Menus object:', menus);

    // Login Button Event Listener
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await auth.signInWithPopup(provider);
                const user = result.user;

                console.log('User logged in:', user.email);

                if (user.email.endsWith('@tovala.com')) {
                    await storeUserData(user); // Save user info to Realtime Database
                    await fetchUserRole(user.email);
                    if (loginContainer) {
                        loginContainer.style.display = 'none';
                    }
                    if (userInfoDiv) {
                        userInfoDiv.style.display = 'flex';
                    }
                    if (logoutButton) {
                        logoutButton.style.display = 'block';
                    }
                } else {
                    await auth.signOut();
                    alert('Please login with your Tovala email address.');
                }
            } catch (error) {
                console.error('Login Error:', error);
                alert(`Login failed: ${error.message}`);
            }
        });
    } else {
        console.error('Login button not found.');
    }

    // Logout Button Event Listener
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                if (sidebar) {
                    sidebar.style.display = 'none';
                }
                if (loginContainer) {
                    loginContainer.style.display = 'block';
                }
                if (userInfoDiv) {
                    userInfoDiv.innerHTML = '';
                    userInfoDiv.style.display = 'none';
                }
                if (logoutButton) {
                    logoutButton.style.display = 'none';
                }
                console.log('User logged out.');
            }).catch((error) => {
                console.error('Logout Error:', error);
                alert(`Logout failed: ${error.message}`);
            });
        });
    } else {
        console.error('Logout button not found.');
    }

    /**
     * Store user data in Firebase Realtime Database under /User/:uid
     */
    async function storeUserData(user) {
        try {
            const userRef = database.ref('User/' + user.uid);
            // We set placeholders for role/facility; they'll be updated in fetchUserRole
            await userRef.set({
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                uid: user.uid,
                role: null,
                facility: null
            });
            console.log('User data stored successfully.');
        } catch (error) {
            console.error('Error storing user data:', error);
            alert('Failed to store user data.');
        }
    }

    /**
     * Fetch user role and facility from your JSON (role.json).
     * Then update both fields in the Realtime Database and store
     * the facility in localStorage so other pages can read it.
     */
    async function fetchUserRole(email) {
        try {
            const response = await fetch(roleUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const roles = await response.json();

            console.log('Fetched roles:', roles); // Debugging

            const userRoleEntry = roles.find(role => role.Email.toLowerCase() === email.toLowerCase());

            console.log('User Role Entry:', userRoleEntry); // Debugging

            if (userRoleEntry) {
                // Update user role and facility in Realtime Database
                const user = auth.currentUser;
                if (user) {
                    const userRef = database.ref('User/' + user.uid);
                    await userRef.update({
                        role: userRoleEntry.Role,
                        facility: userRoleEntry.Facility
                    });
                    console.log(`Updated user role to: ${userRoleEntry.Role}`);
                    console.log(`Updated user facility to: ${userRoleEntry.Facility}`);

                    // ****** IMPORTANT: Save facility in localStorage ******
                    localStorage.setItem('userFacility', userRoleEntry.Facility || 'All');
                }
                loadMenu(userRoleEntry.Role);
            } else {
                alert('Your role is not defined in the system.');
                await auth.signOut();
            }
        } catch (error) {
            console.error('Error fetching user role:', error);
            alert('Failed to fetch user role.');
        }
    }

    /**
     * Load the sidebar menus based on the user's role.
     */
    function loadMenu(role) {
        console.log(`Loading menu for role: "${role}"`);
        if (sidebar) {
            sidebar.style.display = 'flex';
        }
        if (menuContainer) {
            menuContainer.innerHTML = '';
        }

        const resolvedRole = menus[role] || menus[menus[role]];
        console.log('Resolved Role:', resolvedRole);

        const userMenus = menus[role] || menus[menus[role]];
        console.log('User Menus:', userMenus);

        if (!userMenus) {
            console.error(`No menus found for role: "${role}"`);
            return;
        }

        userMenus.forEach(menu => {
            if (menuContainer) {
                const menuButton = document.createElement('button');
                menuButton.textContent = menu.name;
                menuContainer.appendChild(menuButton);

                if (menu.submenus) {
                    const submenuDiv = document.createElement('div');
                    submenuDiv.className = 'submenu';

                    menu.submenus.forEach(sub => {
                        const submenuButton = document.createElement('button');
                        submenuButton.textContent = sub.name;
                        submenuButton.onclick = () => window.open(sub.link, '_blank');
                        submenuDiv.appendChild(submenuButton);
                    });

                    menuButton.onclick = () => {
                        submenuDiv.style.display =
                            submenuDiv.style.display === 'block' ? 'none' : 'block';
                    };

                    menuContainer.appendChild(submenuDiv);
                }
            }
        });
    }

    /**
     * Auth state listener: on page load or refresh, if there's a user,
     * fetch their data and role. Otherwise show login button.
     */
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            if (loginContainer) {
                loginContainer.style.display = 'none';
            }
            if (userInfoDiv) {
                userInfoDiv.style.display = 'flex';
            }
            if (logoutButton) {
                logoutButton.style.display = 'block';
            }

            // Display user info
            displayUserInfo(user);

            // Ensure user is recorded in DB
            await storeUserData(user);

            // Fetch role from the external JSON
            await fetchUserRole(user.email);

        } else {
            if (sidebar) {
                sidebar.style.display = 'none';
            }
            if (loginContainer) {
                loginContainer.style.display = 'block';
            }
            if (userInfoDiv) {
                userInfoDiv.innerHTML = '';
                userInfoDiv.style.display = 'none';
            }
            if (logoutButton) {
                logoutButton.style.display = 'none';
            }
            console.log('No user is signed in.');
        }
    });

    /**
     * Display the user's name and photo in the header area.
     */
    function displayUserInfo(user) {
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                <p>Welcome, ${user.displayName}</p>
                <img src="${user.photoURL}" alt="User Photo">
            `;
            console.log('Displayed user info.');
        } else {
            console.error('user-info div not found.');
        }
    }
});
