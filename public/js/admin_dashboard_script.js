              // Function to show a specific section and hide others
        function showSection(sectionId) {
            const sections = ['dashboardContentContainer', 'profileSection', 'changePasswordSection', 'userListSection', 'addSensorSection','addControllerSection','addHomeSection','registerUserSection'];
            sections.forEach(id => {
                const section = document.getElementById(id);
                if (section) {
                    section.style.display = (id === sectionId) ? 'block' : 'none';
                }
            });
            // Also close the sidebar on mobile
            document.getElementById('check').checked = false;
        }
        
        
        
        
        
        // async function fetchDashboardData() {
        //     const token = localStorage.getItem('token');
        //     const userRole = localStorage.getItem('userRole');

        //     if (!token || userRole !== 'admin') {
        //         alert('Unauthorized access. Redirecting to login page.');
        //         window.location.href = '/login.html'; // Or '/'
        //         return;
        //     }

        //     document.getElementById('loading').style.display = 'block';

        //     try {
        //         const response = await fetch('/api/admin/dashboard-data', {
        //             headers: {
        //                 'x-auth-token': token
        //             }
        //         });

        //         const data = await response.json();
        //         document.getElementById('loading').style.display = 'none';

        //         if (response.ok) {
        //             displayAdminData(data);
        //         } else {
        //             document.getElementById('errorMessage').textContent = data.message || 'Failed to fetch admin dashboard data.';
        //             document.getElementById('errorMessage').style.display = 'block';
        //             if (response.status === 401 || response.status === 403) {
        //                  alert('Session expired or unauthorized. Please log in again.');
        //                  logout();
        //             }
        //         }
        //     } catch (error) {
        //         console.error('Error fetching dashboard data:', error);
        //         document.getElementById('loading').style.display = 'none';
        //         document.getElementById('errorMessage').textContent = 'Network error. Could not connect to the server.';
        //         document.getElementById('errorMessage').style.display = 'block';
        //     }
        // }

        // function displayAdminData(data) {
        //     const contentDiv = document.getElementById('dashboardContent');
        //     contentDiv.innerHTML = ''; // Clear previous content

        //     if (data.allUsersData && data.allUsersData.length > 0) {
        //         data.allUsersData.forEach(user => {
        //             const userSection = document.createElement('div');
        //             userSection.className = 'user-section';
        //             userSection.innerHTML = `
        //                 <h3>User: ${user.firstName} ${user.lastName} (${user.username})</h3>
        //                 <div class="user-info">
        //                     <p>Email: ${user.email || 'N/A'}</p>
        //                     <p>Phone: ${user.phoneNumber || 'N/A'}</p>
        //                     <p>Address: ${user.address ? `${user.address.street}, ${user.address.city}` : 'N/A'}</p>
        //                     <p>Pref: Low Water Notify: ${user.preferences.notifyOnLowWater ? 'Yes' : 'No'}, Threshold: ${user.preferences.waterLevelThreshold}%</p>
        //                 </div>
        //             `;

        //             if (user.homes && user.homes.length > 0) {
        //                 user.homes.forEach(home => {
        //                     const homeCard = document.createElement('div');
        //                     homeCard.className = 'home-card';
        //                     homeCard.innerHTML = `
        //                         <h4>Home: ${home.name} <small>(${home.description})</small></h4>
        //                         <p>Location: Lat: ${home.location.latitude}, Lng: ${home.location.longitude}</p>
        //                         <p>Tanks: ${home.waterTanks.map(t => `${t.name} (${t.capacityLitres}L)`).join(', ')}</p>
        //                     `;

        //                     if (home.controllers && home.controllers.length > 0) {
        //                         home.controllers.forEach(controller => {
        //                             const controllerCard = document.createElement('div');
        //                             controllerCard.className = 'controller-card';
        //                             controllerCard.innerHTML = `
        //                                 <h5>Controller: ${controller.name} (${controller.controllerHardwareId})</h5>
        //                                 <p>Firmware: ${controller.firmwareVersion} | Status: ${controller.status} | Last Heartbeat: ${new Date(controller.lastHeartbeat).toLocaleString()}</p>
        //                             `;

        //                             if (controller.sensors && controller.sensors.length > 0) {
        //                                 const sensorsDiv = document.createElement('div');
        //                                 sensorsDiv.innerHTML = '<h6>Sensors:</h6>';
        //                                 controller.sensors.forEach(sensor => {
        //                                     const sensorDiv = document.createElement('div');
        //                                     sensorDiv.className = 'sensor-data';
        //                                     sensorDiv.innerHTML = `
        //                                         <strong>${sensor.name} (${sensor.type})</strong>
        //                                     `;
        //                                     if (sensor.readings && sensor.readings.length > 0) {
        //                                         const latestReading = sensor.readings[0]; // Most recent reading
        //                                         sensorDiv.innerHTML += `
        //                                             <p>Latest Value: ${latestReading.value} ${latestReading.unit || ''} (at ${new Date(latestReading.timestamp).toLocaleTimeString()})</p>
        //                                             <p>Status: ${latestReading.status || 'N/A'}</p>
        //                                         `;
        //                                     } else {
        //                                         sensorDiv.innerHTML += `<p>No recent readings.</p>`;
        //                                     }
        //                                     sensorsDiv.appendChild(sensorDiv);
        //                                 });
        //                                 controllerCard.appendChild(sensorsDiv);
        //                             } else {
        //                                 controllerCard.innerHTML += `<p>No sensors found for this controller.</p>`;
        //                             }
        //                             homeCard.appendChild(controllerCard);
        //                         });
        //                     } else {
        //                         homeCard.innerHTML += `<p>No controllers found for this home.</p>`;
        //                     }
        //                     userSection.appendChild(homeCard);
        //                 });
        //             } else {
        //                 userSection.innerHTML += `<p>No homes found for this user.</p>`;
        //             }
        //             contentDiv.appendChild(userSection);
        //         });
        //     } else {
        //         contentDiv.innerHTML = '<p>No user data available to display.</p>';
        //     }
        // }

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            localStorage.removeItem('username');
            window.location.href = '/login.html'; // Or '/'
        }

  
        async function checkAdminStatus() {
            const token = localStorage.getItem('token');
            const userRole = localStorage.getItem('userRole');

            if (!token || userRole !== 'admin') {
                alert('Unauthorized access. Redirecting to login.');
                window.location.href = '/login.html';
                return false;
            }
            return true;
        }
            
        async function fetchDashboardStats() {
            const isAuthorized = await checkAdminStatus();
            if (!isAuthorized) return;

            const token = localStorage.getItem('token');
            const loadingDiv = document.getElementById('loadingStats');
            const errorDiv = document.getElementById('errorMessageStats');

            loadingDiv.style.display = 'block';
            errorDiv.style.display = 'none';

            try {
                const response = await fetch('/api/admin/dashboard-stats', {
                    headers: { 'x-auth-token': token }
                });
                const data = await response.json();

                loadingDiv.style.display = 'none';

                if (response.ok) {
                    document.getElementById('totalUsers').textContent = data.stats.totalUsers;
                    document.getElementById('totalHomes').textContent = data.stats.totalHomes;
                    document.getElementById('totalControllers').textContent = data.stats.totalControllers;
                    document.getElementById('totalSensors').textContent = data.stats.totalSensors;
                } else {
                    errorDiv.textContent = data.message || 'Failed to load dashboard statistics.';
                    errorDiv.style.display = 'block';
                    if (response.status === 401 || response.status === 403) { logout(); }
                }
            } catch (error) {
                console.error('Error fetching dashboard statistics:', error);
                loadingDiv.style.display = 'none';
                errorDiv.textContent = 'Network error. Could not connect to the server.';
                errorDiv.style.display = 'block';
            }
        }

  

  



async function fetchAndRenderProfile() {
    console.log('hello');
            const profileContentDiv = document.getElementById('profileDetails');

            try {
            
                const token = localStorage.getItem('token');

                if (!token) {
                    profileContentDiv.innerHTML = '<p class="error-message">Error: No authentication token found. Please log in.</p>';
                    return;
                }

                const response = await fetch('/api/admin/profile', {
                    method: 'GET',
                    headers: {
                        'x-auth-token': token
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch profile data');
                }

                const data = await response.json();
                let html = `
                    <div class="user-info">
                        <h2>User Information</h2>
                        <p><strong>Name:</strong> ${data.admin.firstname} ${data.admin.lastname} </p>

                        <p><strong>Username:</strong> ${data.admin.username}</p>
                        <p><strong>Email:</strong> ${data.admin.email}</p>

                    </div>
                `;

             

                profileContentDiv.innerHTML = html;

            } catch (error) {
                console.error('Error fetching profile:', error);
                profileContentDiv.innerHTML = `<p class="error-message">Error: ${error.message || 'Could not load profile data.'}</p>`;
            }
        }



async function fetchAndRenderChangePasswordForm() {
    const changePwdDiv = document.getElementById('Changepwd');
    // Display loading message immediately, and ensure it's removed when done
    changePwdDiv.innerHTML = '<p class="message loading-message">Loading password change form...</p>';

    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || (userRole !== 'admin' && userRole !== 'user')) {
        changePwdDiv.innerHTML = '<p class="message error-message">Unauthorized: Please log in to change your password.</p>';
        setTimeout(logout, 2000); // Redirect after a short delay
        return;
    }

    // HTML content for the password change form
    // The 'message' div inside the form has a unique ID for this instance
    const formHtml = `
        <form id="dynamicChangePasswordForm">
            <div class="form-group">
                <label for="oldPassword">Old Password:</label>
                <input type="password" id="oldPassword" name="oldPassword" required>
            </div>

            <div class="form-group">
                <label for="newPassword">New Password:</label>
                <input type="password" id="newPassword" name="newPassword" required>
            </div>

            <div class="form-group">
                <label for="confirmNewPassword">Confirm New Password:</label>
                <input type="password" id="confirmNewPassword" name="confirmNewPassword" required>
            </div>

            <button type="submit" class="btn-submit">
                <i class="fa-solid fa-key"></i> Change Password
            </button>
            <div id="changePasswordMessage" class="message"></div> <!-- Unique ID for messages related to this form -->
        </form>
    `;

    // 1. Inject the form HTML into the DOM
    changePwdDiv.innerHTML = formHtml;

    // 2. NOW get the references to the elements INSIDE the newly injected HTML
    const dynamicChangePasswordForm = document.getElementById('dynamicChangePasswordForm');
    const msgDiv = document.getElementById('changePasswordMessage'); 

    // Add a basic check in case an element isn't found (though unlikely if HTML is correct)
    if (!dynamicChangePasswordForm || !msgDiv) {
        changePwdDiv.innerHTML = '<p class="message error-message">Error: Could not render password change form components.</p>';
        console.error("Failed to find dynamic form elements after injection.");
        return;
    }

    // 3. Attach the event listener to the newly referenced form
    dynamicChangePasswordForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        msgDiv.textContent = ''; // Clear previous messages
        msgDiv.className = 'message'; // Reset class (to ensure 'display: none' is reset)

        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            msgDiv.textContent = 'New password and confirm new password do not match.';
            msgDiv.classList.add('error');
            msgDiv.style.display = 'block'; // Make message visible
            return;
        }

        if (newPassword.length < 6) {
            msgDiv.textContent = 'New password must be at least 6 characters long.';
            msgDiv.classList.add('error');
            msgDiv.style.display = 'block'; // Make message visible
            return;
        }

        try {
            const response = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token // Use the token from local storage
                },
                body: JSON.stringify({ oldPassword, newPassword, confirmNewPassword })
            });

            const data = await response.json();

            if (response.ok) {
                msgDiv.textContent = data.message;
                msgDiv.classList.add('success');
                // Clear the form fields after successful change
                dynamicChangePasswordForm.reset();
            } else {
                msgDiv.textContent = data.message || 'Failed to change password.';
                msgDiv.classList.add('error');
                if (response.status === 401 || response.status === 403) {
                    msgDiv.textContent += ' Redirecting to login.';
                    setTimeout(logout, 2000); 
                }
            }
            msgDiv.style.display = 'block'; // Make message visible after fetch attempt
        } catch (error) {
            console.error('Network error:', error);
            msgDiv.textContent = 'Could not connect to the server.';
            msgDiv.classList.add('error');
            msgDiv.style.display = 'block'; // Make message visible
        }
    });
}
        



// Function to fetch and render the user list section on the dashboard
async function fetchAndRenderUserListSection() {
    const userListSectionDiv = document.getElementById('userListSection');
    const usersListDiv = document.getElementById('usersList');

    // Update the section title
    const sectionTitleH3 = userListSectionDiv.querySelector('h3');
    if (sectionTitleH3) {
        sectionTitleH3.innerHTML = '<i class="fa-solid fa-users"></i> All Regular Users';
    }

    // Display loading message immediately
    usersListDiv.innerHTML = '<p class="message loading-message">Loading users...</p>';
    userListSectionDiv.style.display = 'block'; // Ensure the section is visible

    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    // Authorization check
    if (!token || userRole !== 'admin') {
        usersListDiv.innerHTML = '<p class="message error-message">Unauthorized: Only administrators can view the user list. Redirecting to login.</p>';
        setTimeout(logout, 2000); // Redirect after a short delay
        return;
    }

    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'x-auth-token': token }
        });
        const users = await response.json();

        if (response.ok) {
            if (users.length === 0) {
                usersListDiv.innerHTML = '<p class="message no-data-message">No regular users found.</p>';
            } else {
                // Clear the loading message/previous content
                usersListDiv.innerHTML = '';

                // Create a list (<ul>) to hold the users
                const userListUl = document.createElement('ul');
                userListUl.className = 'user-list'; // Apply your existing user-list styling

                users.forEach(user => {
                    const listItem = document.createElement('li');
                    listItem.className = 'user-list-item'; // Apply existing list item styling
                    listItem.innerHTML = `
                        <div class="user-info-text">
                            <strong>${user.firstName} ${user.lastName || ''}</strong><br>
                            <span>Username: ${user.username}</span>
                        </div>
                        <button class="view-details-btn" data-user-id="${user._id}">
                            <i class="fa-solid fa-circle-info"></i> View Details
                        </button>
                    `;
                    userListUl.appendChild(listItem);
                });
                usersListDiv.appendChild(userListUl);

                // Attach event listeners for all "View Details" buttons after they are added to the DOM
                document.querySelectorAll('.view-details-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const userId = event.currentTarget.dataset.userId;
                        showUserDetailsModal(userId);
                    });
                });
            }
        } else {
            // Handle API errors
            usersListDiv.innerHTML = `<p class="message error-message">${users.message || 'Failed to load user list.'}</p>`;
            if (response.status === 401 || response.status === 403) {
                usersListDiv.innerHTML += ' <p class="message error-message">Redirecting to login.</p>';
                setTimeout(logout, 2000); // Redirect on unauthorized/forbidden
            }
        }
    } catch (error) {
        console.error('Network error fetching user list:', error);
        usersListDiv.innerHTML = '<p class="message error-message">Network error: Could not connect to the server to fetch users.</p>';
    }
}

// Function to show the user details modal
async function showUserDetailsModal(userId) {
    const modal = document.getElementById('userModal'); // This is correctly defined here
    const modalUserName = document.getElementById('modalUserName');
    const modalBodyContent = document.getElementById('modalBodyContent');
    const loadingModalDiv = document.getElementById('loadingModal');
    const modalErrorMessageDiv = document.getElementById('modalErrorMessage');

    // Clear previous content and show loading state
    modalUserName.textContent = 'Loading User...';
    modalBodyContent.innerHTML = '';
    modalErrorMessageDiv.style.display = 'none';
    loadingModalDiv.style.display = 'block';
    modal.style.display = 'block'; // Make the modal visible

    const token = localStorage.getItem('token');
    if (!token) {
        logout(); // Redirect if no token
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: { 'x-auth-token': token }
        });
        const data = await response.json();

        loadingModalDiv.style.display = 'none'; // Hide loading after fetch

        if (response.ok) {
            // --- FIX HERE: Pass the 'modal' element to displayUserDetails ---
            displayUserDetails(data, modal); // Now displayUserDetails receives 'modal'
        } else {
            modalErrorMessageDiv.textContent = data.message || 'Failed to load user details.';
            modalErrorMessageDiv.style.display = 'block';
            if (response.status === 401 || response.status === 403) {
                modalErrorMessageDiv.textContent += ' Redirecting to login.';
                setTimeout(logout, 2000);
            }
        }
    } catch (error) {
        console.error('Network error fetching user details:', error);
        loadingModalDiv.style.display = 'none';
        modalErrorMessageDiv.textContent = 'Network error. Could not connect to the server to fetch user details.';
        modalErrorMessageDiv.style.display = 'block';
    }
}

// Helper function to render user details into the modal body
// --- FIX HERE: Accept 'modalElement' as a parameter ---
function displayUserDetails(data, modalElement) { // 'modalElement' now holds the reference to the modal
    const modalUserName = document.getElementById('modalUserName');
    const modalBodyContent = document.getElementById('modalBodyContent');
    modalBodyContent.innerHTML = ''; // Clear existing content

    const user = data.user;
    modalUserName.textContent = `${user.firstName} ${user.lastName || ''} Details`; // Set modal title

    // User Info Section
    const userInfoSection = document.createElement('div');
    userInfoSection.className = 'modal-section';
    userInfoSection.innerHTML = `
        <h4><i class="fa-solid fa-user"></i> User Profile</h4>
        <div class="modal-item-details">
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${user.phoneNumber || 'N/A'}</p>
            <p><strong>Address:</strong> ${user.address ? `${user.address.street || ''}, ${user.address.city || ''}, ${user.address.state || ''} ${user.address.zipCode || ''}, ${user.address.country || ''}` : 'N/A'}</p>
            <p><strong>Preferences:</strong> Notify Low Water: ${user.preferences.notifyOnLowWater ? 'Yes' : 'No'}, Threshold: ${user.preferences.waterLevelThreshold}%</p>
        </div>
    `;
    modalBodyContent.appendChild(userInfoSection);

    // Homes Section
    if (data.homes && data.homes.length > 0) {
        const homesSection = document.createElement('div');
        homesSection.className = 'modal-section';
        homesSection.innerHTML = '<h4><i class="fa-solid fa-house-chimney"></i> Assigned Homes</h4>';
        data.homes.forEach(home => {
            const homeDiv = document.createElement('div');
            homeDiv.className = 'modal-item-details';
            homeDiv.innerHTML = `
                <p><strong>Home:</strong> ${home.name} (${home.description || 'No description'})</p>
                <p>Location: Lat: ${home.location.latitude}, Lng: ${home.location.longitude}</p>
                <p>Tanks: ${home.waterTanks.map(t => `${t.name} (${t.capacityLitres}L)`).join(', ') || 'N/A'}</p>
            `;

            // Controllers Section within Home
            if (home.controllers && home.controllers.length > 0) {
                const controllersList = document.createElement('ul');
                home.controllers.forEach(controller => {
                    const controllerLi = document.createElement('li');
                    controllerLi.innerHTML = `
                        <div class="modal-item-details">
                            <p><strong><i class="fa-solid fa-microchip"></i> Controller:</strong> ${controller.name} (${controller.controllerHardwareId})</p>
                            <p>Status: ${controller.status}, Firmware: ${controller.firmwareVersion}, Last Seen: ${new Date(controller.lastHeartbeat).toLocaleString()}</p>
                        </div>
                    `;

                    // Sensors Section within Controller
                    if (controller.sensors && controller.sensors.length > 0) {
                        const sensorsList = document.createElement('ul');
                        sensorsList.style.listStyle = 'disc'; // Changed from circle for better readability
                        sensorsList.style.marginLeft = '20px'; // Indent for hierarchy
                        controller.sensors.forEach(sensor => {
                            const sensorLi = document.createElement('li');
                            sensorLi.innerHTML = `
                                <p><strong><i class="fa-solid fa-gauge-high"></i> Sensor:</strong> ${sensor.name} (${sensor.type})</p>
                                <p>Model: ${sensor.model || 'N/A'}, Pin: ${sensor.pin || 'N/A'}</p>
                            `;
                            if (sensor.latestReading) {
                                sensorLi.innerHTML += `<p>Latest Reading: ${sensor.latestReading.value} ${sensor.latestReading.unit || ''} (at ${new Date(sensor.latestReading.timestamp).toLocaleTimeString()})</p>`;
                                sensorLi.innerHTML += `<p>Reading Status: ${sensor.latestReading.status || 'N/A'}</p>`;
                            } else {
                                sensorLi.innerHTML += `<p>No recent readings.</p>`;
                            }
                            sensorsList.appendChild(sensorLi);
                        });
                        controllerLi.appendChild(sensorsList);
                    } else {
                        controllerLi.innerHTML += `<p>No sensors for this controller.</p>`;
                    }
                    controllersList.appendChild(controllerLi);
                });
                homeDiv.appendChild(controllersList);
            } else {
                homeDiv.innerHTML += `<p>No controllers for this home.</p>`;
            }
            homesSection.appendChild(homeDiv);
        });
        modalBodyContent.appendChild(homesSection);
    } else {
        modalBodyContent.innerHTML += '<div class="modal-section"><p>No homes assigned to this user.</p></div>';
    }

    // Add close button functionality if not already handled by a global listener
    // --- FIX HERE: Use the passed 'modalElement' ---
    const closeButton = modalElement.querySelector('.close-button');
    if (closeButton && !closeButton.__eventListenerAdded) { // Prevent adding multiple listeners
        closeButton.addEventListener('click', () => {
            modalElement.style.display = 'none'; // Use modalElement to hide the modal
        });
        closeButton.__eventListenerAdded = true; // Mark as added
    }
}



// Function to render the user registration form section
async function renderRegisterUserSection() {
    const registerUserSectionDiv = document.getElementById('registerUserSection');
    const userRegisterFormContainerDiv = document.getElementById('userRegisterFormContainer');

    // Update the section title
    const sectionTitleH3 = registerUserSectionDiv.querySelector('h3');
    if (sectionTitleH3) {
        sectionTitleH3.innerHTML = '<i class="fa-solid fa-user-plus"></i> Register New User';
    }

    // Display loading message immediately
    userRegisterFormContainerDiv.innerHTML = '<p class="message loading-message">Loading registration form...</p>';
    registerUserSectionDiv.style.display = 'block'; // Ensure the section is visible

    // We don't need to fetch the form HTML from a separate file.
    // We'll generate it directly here.

    const registrationFormHTML = `
        <div class="register-container">
            <h2>New User Details</h2>
            <form id="registerForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name</label>
                        <input type="text" id="firstName" name="firstName" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name</label>
                        <input type="text" id="lastName" name="lastName">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="email">Contact Email</label>
                        <input type="email" id="email" name="email">
                    </div>
                    <div class="form-group">
                        <label for="phoneNumber">Phone Number</label>
                        <input type="tel" id="phoneNumber" name="phoneNumber">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="street">Street Address</label>
                        <input type="text" id="street" name="street">
                    </div>
                    <div class="form-group">
                        <label for="city">City</label>
                        <input type="text" id="city" name="city">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="state">State</label>
                        <input type="text" id="state" name="state">
                    </div>
                    <div class="form-group">
                        <label for="zipCode">Zip Code</label>
                        <input type="text" id="zipCode" name="zipCode">
                    </div>
                </div>

                <div class="form-group">
                    <label for="country">Country</label>
                    <input type="text" id="country" name="country" value="India">
                </div>

                <div class="form-group checkbox-group">
                    <input type="checkbox" id="notifyOnLowWater" name="notifyOnLowWater" checked>
                    <label for="notifyOnLowWater">Notify on Low Water</label>
                </div>
                <div class="form-group">
                    <label for="waterLevelThreshold">Low Water Threshold (%)</label>
                    <input type="number" id="waterLevelThreshold" name="waterLevelThreshold" min="1" max="100" value="20">
                </div>

                <button type="submit" class="btn-register">
                    <i class="fa-solid fa-user-plus"></i> Register User
                </button>
                <div id="message" class="message"></div>
            </form>
        </div>
    `;

    // Inject the HTML into the container
    userRegisterFormContainerDiv.innerHTML = registrationFormHTML;

    // Attach the event listener to the form *after* it's been added to the DOM
    document.getElementById('registerForm').addEventListener('submit', async function(event) {
        event.preventDefault();

        // Check admin status before proceeding with form submission
        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('userRole');

        if (!token || userRole !== 'admin') {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = 'Unauthorized: Only administrators can register new users. Redirecting to login.';
            messageDiv.classList.add('error');
            setTimeout(logout, 2000); // Using the shared logout function
            return;
        }

        const messageDiv = document.getElementById('message');
        messageDiv.textContent = '';
        messageDiv.className = 'message'; // Reset classes

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            email: document.getElementById('email').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            address: {
                street: document.getElementById('street').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                zipCode: document.getElementById('zipCode').value,
                country: document.getElementById('country').value
            },
            preferences: {
                notifyOnLowWater: document.getElementById('notifyOnLowWater').checked,
                waterLevelThreshold: parseInt(document.getElementById('waterLevelThreshold').value, 10)
            }
        };

        // Simple client-side validation for required fields
        if (!formData.firstName || !formData.username || !formData.password) {
            messageDiv.textContent = 'Please fill in First Name, Username, and Password.';
            messageDiv.classList.add('error-message'); // Use the common error-message class
            return;
        }

        try {
            const response = await fetch('/api/admin/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': localStorage.getItem('token')
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = data.message;
                messageDiv.classList.add('success-message'); // Add a success-message class for styling
                // Clear form for new entry
                document.getElementById('registerForm').reset();
                document.getElementById('notifyOnLowWater').checked = true;
                document.getElementById('waterLevelThreshold').value = 20;
            } else {
                messageDiv.textContent = data.message || 'User registration failed.';
                messageDiv.classList.add('error-message');
                if (response.status === 401 || response.status === 403) {
                    alert('Session expired or unauthorized. Please log in again.');
                    logout(); // Use the shared logout function
                }
            }
        } catch (error) {
            console.error('Network error:', error);
            messageDiv.textContent = 'Could not connect to the server.';
            messageDiv.classList.add('error-message');
        }
    });
}




// Function to render the Add New Home form section
async function renderAddHomeSection() {
    const addHomeSectionDiv = document.getElementById('addHomeSection');
    const addHomeFormContainerDiv = document.getElementById('addHomeFormContainer');

    // Update the section title
    const sectionTitleH3 = addHomeSectionDiv.querySelector('h3');
    if (sectionTitleH3) {
        sectionTitleH3.innerHTML = '<i class="fa-solid fa-house-chimney-medical"></i> Add New Home';
    }

    // Display loading message immediately
    addHomeFormContainerDiv.innerHTML = '<p class="message loading-message">Loading Add Home form...</p>';
    addHomeSectionDiv.style.display = 'block'; // Ensure the section is visible

    const addHomeFormHTML = `
        <div class="container add-home-container"> <h2>Home Details</h2>
            <form id="addHomeForm">
                <div class="form-group">
                    <label for="userId">Assign to User:</label>
                    <select id="userId" name="userId" required>
                        <option value="">-- Select a User --</option>
                        </select>
                </div>

                <div class="form-group">
                    <label for="homeName">Home Name:</label>
                    <input type="text" id="homeName" name="homeName" required>
                </div>

                <div class="form-group">
                    <label for="description">Description (Optional):</label>
                    <textarea id="description" name="description" rows="3"></textarea>
                </div>

                <div class="form-group">
                    <label for="latitude">Latitude:</label>
                    <input type="number" id="latitude" name="latitude" step="any" required>
                </div>

                <div class="form-group">
                    <label for="longitude">Longitude:</label>
                    <input type="number" id="longitude" name="longitude" step="any" required>
                </div>

                <h3>Initial Water Tank (Optional)</h3>
                <div class="form-group">
                    <label for="tankName">Tank Name:</label>
                    <input type="text" id="tankName" name="tankName" placeholder="e.g., Main Overhead Tank">
                </div>
                <div class="form-group">
                    <label for="tankCapacity">Capacity (Litres):</label>
                    <input type="number" id="tankCapacity" name="tankCapacity" min="1" placeholder="e.g., 1000">
                </div>

                <button type="submit" class="btn-submit">
                    <i class="fa-solid fa-house-chimney-medical"></i> Add Home
                </button>
                <div id="message" class="message"> </div>
            </form>
        </div>
    `;

    // Inject the HTML into the container
    addHomeFormContainerDiv.innerHTML = addHomeFormHTML;

    // After injecting the form, populate the user dropdown and attach the submit listener
    await populateUsersDropdown();
     attachAddHomeFormListener();
}

// Helper function to fetch and populate the user dropdown
async function populateUsersDropdown() {
    const userIdSelect = document.getElementById('userId');
    if (!userIdSelect) return; // Exit if the select element isn't found (e.g., section not loaded yet)

    userIdSelect.innerHTML = '<option value="">-- Loading Users --</option>'; // Placeholder

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Authentication token missing. Please log in.');
        logout(); // Assuming a global logout function exists
        return;
    }

    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'x-auth-token': token }
        });
        const users = await response.json();

        if (response.ok) {
            userIdSelect.innerHTML = '<option value="">-- Select a User --</option>'; // Reset
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user._id;
                option.textContent = `${user.firstName} ${user.lastName || ''} (${user.username})`;
                userIdSelect.appendChild(option);
            });
        } else {
            alert(users.message || 'Failed to load users for dropdown.');
            if (response.status === 401 || response.status === 403) {
                logout();
            }
            userIdSelect.innerHTML = '<option value="">-- Failed to load users --</option>';
        }
    } catch (error) {
        console.error('Error fetching users for dropdown:', error);
        alert('Network error: Could not connect to the server to fetch users.');
        userIdSelect.innerHTML = '<option value="">-- Network Error --</option>';
    }
}

// Helper function to attach the form submit listener
function attachAddHomeFormListener() {
    const addHomeForm = document.getElementById('addHomeForm');
    if (!addHomeForm) return; // Exit if the form isn't found

    addHomeForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('userRole');

        if (!token || userRole !== 'admin') {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = 'Unauthorized: Only administrators can add homes. Redirecting to login.';
            messageDiv.classList.add('error-message');
            setTimeout(logout, 2000);
            return;
        }

        const messageDiv = document.getElementById('message');
        messageDiv.textContent = '';
        messageDiv.className = 'message';

        const formData = {
            userId: document.getElementById('userId').value,
            name: document.getElementById('homeName').value,
            description: document.getElementById('description').value,
            latitude: parseFloat(document.getElementById('latitude').value),
            longitude: parseFloat(document.getElementById('longitude').value)
            
        };

        // Handle optional tank data
        const tankName = document.getElementById('tankName').value;
        const tankCapacity = document.getElementById('tankCapacity').value;

        if (tankName && tankCapacity) {
            formData.waterTanks = [{
                
                name: tankName,
                capacityLitres: parseInt(tankCapacity, 10)
            }];
        } else if (tankName || tankCapacity) { // If only one of them is provided
             messageDiv.textContent = 'Please provide both Tank Name and Capacity, or leave both blank.';
             messageDiv.classList.add('error-message');
             return;
        }


        // Basic validation for required fields
        if (!formData.userId || !formData.name || isNaN(formData.latitude) || isNaN(formData.longitude)) {
            messageDiv.textContent = 'Please fill in all required home details: User, Home Name, Latitude, and Longitude.';
            messageDiv.classList.add('error-message');
            return;
        }

        try {
            const response = await fetch('/api/admin/homes/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();


            if (response.ok) {
                alert(data.message);
                messageDiv.textContent = data.message;
                messageDiv.classList.add('success-message');
                // Clear form for new entry
                addHomeForm.reset();
                // Re-populate dropdown to ensure it's reset to default
                await populateUsersDropdown();
            } else {
                messageDiv.textContent = data.message || 'Failed to add home.';
                messageDiv.classList.add('error-message');
                if (response.status === 401 || response.status === 403) {
                    alert('Session expired or unauthorized. Please log in again.');
                    logout();
                }
            }
        } catch (error) {
            console.error('Network error:', error);
            messageDiv.textContent = 'Could not connect to the server.';
            messageDiv.classList.add('error-message');
        }
    });
}


// Function to render the Add New Controller form section
async function renderAddControllerSection() {
    const addControllerSectionDiv = document.getElementById('addControllerSection');
    const addControllerFormContainerDiv = document.getElementById('addControllerFormContainer');

    // Update the section title
    const sectionTitleH3 = addControllerSectionDiv.querySelector('h3');
    if (sectionTitleH3) {
        sectionTitleH3.innerHTML = '<i class="fa-solid fa-microchip"></i> Add New Controller';
    }

    // Display loading message immediately
    addControllerFormContainerDiv.innerHTML = '<p class="message loading-message">Loading Add Controller form...</p>';
    addControllerSectionDiv.style.display = 'block'; // Ensure the section is visible

    const addControllerFormHTML = `
        <div class="container add-controller-container"> <h2>Controller Details</h2>
            <form id="addControllerForm">
                <div class="form-group">
                    <label for="homeId">Assign to Home:</label>
                    <select id="homeId" name="homeId" required>
                        <option value="">-- Select a Home --</option>
                        </select>
                </div>

                <div class="form-group">
                    <label for="controllerHardwareId">Hardware ID (MAC Address):</label>
                    <input type="text" id="controllerHardwareId" name="controllerHardwareId" required placeholder="e.g., A1:B2:C3:D4:E5:F6">
                </div>

                <div class="form-group">
                    <label for="name">Controller Name:</label>
                    <input type="text" id="name" name="name" required placeholder="e.g., Main Pump Controller">
                </div>

                <div class="form-group">
                    <label for="locationDescription">Location Description (Optional):</label>
                    <input type="text" id="locationDescription" name="locationDescription" placeholder="e.g., Near main water tank">
                </div>

                <div class="form-group">
                    <label for="firmwareVersion">Firmware Version (Optional):</label>
                    <input type="text" id="firmwareVersion" name="firmwareVersion" value="1.0.0">
                </div>

                <div class="form-group">
                    <label for="status">Status (Optional):</label>
                    <select id="status" name="status">
                        <option value="offline">Offline</option>
                        <option value="online" selected>Online</option>
                        <option value="fault">Fault</option>
                    </select>
                </div>

                <button type="submit" class="btn-submit">
                    <i class="fa-solid fa-microchip"></i> Add Controller
                </button>
                <div id="message" class="message"></div>
            </form>
        </div>
    `;

    // Inject the HTML into the container
    addControllerFormContainerDiv.innerHTML = addControllerFormHTML;

    // After injecting the form, populate the homes dropdown and attach the submit listener
    await populateHomesDropdown();
    attachAddControllerFormListener();
}

// Helper function to fetch and populate the homes dropdown
async function populateHomesDropdown() {
    const homeIdSelect = document.getElementById('homeId');
    if (!homeIdSelect) return; // Exit if the select element isn't found

    homeIdSelect.innerHTML = '<option value="">-- Loading Homes --</option>';

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Authentication token missing. Please log in.');
        logout(); // Assuming a global logout function
        return;
    }

    try {
        const response = await fetch('/api/admin/homes', { // API call to get all homes
            headers: { 'x-auth-token': token }
        });
        const homes = await response.json();

        if (response.ok) {
            homeIdSelect.innerHTML = '<option value="">-- Select a Home --</option>';
            homes.forEach(home => {
                const option = document.createElement('option');
                option.value = home._id;
                // Display home name and associated user's username if available
                const userDisplay = home.userId && home.userId.username ? ` (User: ${home.userId.username})` : '';
                option.textContent = `${home.name}${userDisplay}`;
                homeIdSelect.appendChild(option);
            });
        } else {
            alert(homes.message || 'Failed to load homes for dropdown.');
            if (response.status === 401 || response.status === 403) {
                logout();
            }
            homeIdSelect.innerHTML = '<option value="">-- Failed to load homes --</option>';
        }
    } catch (error) {
        console.error('Error fetching homes for dropdown:', error);
        alert('Network error: Could not connect to the server to fetch homes.');
        homeIdSelect.innerHTML = '<option value="">-- Network Error --</option>';
    }
}

// Helper function to attach the form submit listener
function attachAddControllerFormListener() {
    const addControllerForm = document.getElementById('addControllerForm');
    if (!addControllerForm) return; // Exit if the form isn't found

    addControllerForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('userRole');

        if (!token || userRole !== 'admin') {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = 'Unauthorized: Only administrators can add controllers. Redirecting to login.';
            messageDiv.classList.add('error-message');
            setTimeout(logout, 2000);
            return;
        }

        const messageDiv = document.getElementById('message');
        messageDiv.textContent = '';
        messageDiv.className = 'message';

        const formData = {
            homeId: document.getElementById('homeId').value,
            controllerHardwareId: document.getElementById('controllerHardwareId').value,
            name: document.getElementById('name').value,
            locationDescription: document.getElementById('locationDescription').value,
            firmwareVersion: document.getElementById('firmwareVersion').value,
            status: document.getElementById('status').value
        };

        // Basic validation
        if (!formData.homeId || !formData.controllerHardwareId || !formData.name) {
            messageDiv.textContent = 'Please fill in all required fields: Assign to Home, Hardware ID, and Controller Name.';
            messageDiv.classList.add('error-message');
            return;
        }

        try {
            const response = await fetch('/api/admin/controllers/add', { // API call to add controller
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = data.message;
                messageDiv.classList.add('success-message');
                // Clear form for new entry
                addControllerForm.reset();
                // Re-populate dropdown to ensure it's reset to default
                await populateHomesDropdown();
                document.getElementById('status').value = 'online'; // Reset status to default 'online'
            } else {
                messageDiv.textContent = data.message || 'Controller addition failed.';
                messageDiv.classList.add('error-message');
                if (response.status === 401 || response.status === 403) {
                    alert('Session expired or unauthorized. Please log in again.');
                    logout();
                }
            }
        } catch (error) {
            console.error('Network error:', error);
            messageDiv.textContent = 'Could not connect to the server.';
            messageDiv.classList.add('error-message');
        }
    });
}





// --- Helper Function for displaying messages ---
/**
 * Displays a message in a specified message div.
 * @param {HTMLElement} messageDiv The div element to display the message in.
 * @param {string} text The message text.
 * @param {'success'|'error'|'loading'|'info'} type The type of message to style it.
 * @param {number} [timeout=0] How long to display the message before clearing (in ms). 0 means no timeout.
 */
function displayMessage(messageDiv, text, type, timeout = 0) {
    messageDiv.textContent = text;
    messageDiv.className = 'message'; // Reset classes first

    switch (type) {
        case 'success':
            messageDiv.classList.add('success-message');
            break;
        case 'error':
            messageDiv.classList.add('error-message');
            break;
        case 'loading':
            messageDiv.classList.add('loading-message');
            break;
        case 'info':
            messageDiv.classList.add('info-message'); // You might need to add this class to your CSS
            break;
    }

    if (timeout > 0) {
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, timeout);
    }
}

// --- Function to render the Add New Sensor form section ---
async function renderAddSensorSection() {
    const addSensorSectionDiv = document.getElementById('addSensorSection');
    const addSensorFormContainerDiv = document.getElementById('addSensorFormContainer');

    // Update the section title
    const sectionTitleH3 = addSensorSectionDiv.querySelector('h3');
    if (sectionTitleH3) {
        sectionTitleH3.innerHTML = '<i class="fa-solid fa-sensor"></i> Add New Sensor';
    }

    // Display loading message immediately
    displayMessage(addSensorFormContainerDiv, 'Loading Add Sensor form...', 'loading');
    addSensorSectionDiv.style.display = 'block'; // Ensure the section is visible

    const addSensorFormHTML = `
        <div class="container add-sensor-container">
            <h2>Sensor Details</h2>
            <form id="addSensorForm">
                <div class="form-group">
                    <label for="controllerId">Assign to Controller:</label>
                    <select id="controllerId" name="controllerId" required>
                        <option value="">-- Select a Controller --</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="sensorHardwareId">Sensor Hardware ID (Optional):</label>
                    <input type="text" id="sensorHardwareId" name="sensorHardwareId" placeholder="e.g., WL-A1B2C3D4">
                </div>

                <div class="form-group">
                    <label for="type">Sensor Type:</label>
                    <select id="type" name="type" required>
                        <option value="">-- Select Type --</option>
                        <option value="water_level">Water Level</option>
                        <option value="water_flow">Water Flow</option>
                        <option value="rain_status">Rain Status</option>
                        <option value="temperature">Temperature</option>
                        <option value="humidity">Humidity</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="sensorname">Sensor Name:</label>
                    <input type="text" id="sensorname" name="name" required placeholder="e.g., Sump Level Sensor">
                </div>

                <div class="form-group">
                    <label for="model">Model (Optional):</label>
                    <input type="text" id="model" name="model" placeholder="e.g., HC-SR04">
                </div>

                <div class="form-group">
                    <label for="pin">GPIO Pin (Optional):</label>
                    <input type="text" id="pin" name="pin" placeholder="e.g., GPIO16">
                </div>

                <div class="form-group">
                    <label for="unit">Unit (Optional, e.g., %, L/min, boolean, °C):</label>
                    <input type="text" id="unit" name="unit" placeholder="e.g., %">
                </div>

                <div class="form-group">
                    <label for="associatedTankId">Associated Tank ID (Optional):</label>
                    <input type="text" id="associatedTankId" name="associatedTankId" placeholder="e.g., main_overhead_tank">
                    <small>This must match a \`tankId\` defined in the assigned Home of the Controller.</small>
                </div>

                <div class="form-group">
                    <label for="calibrationData">Calibration Data (JSON, Optional):</label>
                    <textarea id="calibrationData" name="calibrationData" rows="2" placeholder='{"key": "value"}'></textarea>
                    <small>e.g., \`{"maxDistanceCm": 200, "tankHeightCm": 150}\` for water level</small>
                </div>

                <button type="submit" class="btn-submit">
                    <i class="fa-solid fa-plus"></i> Add Sensor
                </button>
                <div id="message" class="message"></div>
            </form>
        </div>
    `;

    // Inject the HTML into the container
    addSensorFormContainerDiv.innerHTML = addSensorFormHTML;

    // After injecting the form, populate the controllers dropdown and attach the submit listener
    await populateControllersDropdown();
     attachAddSensorFormListener();

}

// --- Helper function to fetch and populate the controllers dropdown ---
async function populateControllersDropdown() {
    const controllerIdSelect = document.getElementById('controllerId');
    if (!controllerIdSelect) {
        console.error('Controller ID select element not found.');
        return;
    }

    controllerIdSelect.innerHTML = '<option value="">-- Loading Controllers --</option>';

    const { token } = localStorage;
    if (!token) {
        alert('Authentication token missing. Please log in.');
        logout();
        return;
    }

    try {
        const response = await fetch('/api/admin/controllers', {
            headers: { 'x-auth-token': token }
        });
        const controllers = await response.json();

        if (response.ok) {
            controllerIdSelect.innerHTML = '<option value="">-- Select a Controller --</option>';
            controllers.forEach(controller => {
                const option = document.createElement('option');
                option.value = controller._id;
                const homeDisplay = controller.homeId && controller.homeId.name ? ` (Home: ${controller.homeId.name})` : '';
                option.textContent = `${controller.name}${homeDisplay}`;
                controllerIdSelect.appendChild(option);
            });
        } else {
            alert(controllers.message || 'Failed to load controllers for dropdown.');
            if (response.status === 401 || response.status === 403) {
                logout();
            }
            controllerIdSelect.innerHTML = '<option value="">-- Failed to load controllers --</option>';
        }
    } catch (error) {
        console.error('Error fetching controllers for dropdown:', error);
        alert('Network error: Could not connect to the server to fetch controllers.');
        controllerIdSelect.innerHTML = '<option value="">-- Network Error --</option>';
    }
}

// --- Helper function to attach the form submit listener for adding a sensor ---
function attachAddSensorFormListener() {


    const addSensorForm = document.getElementById('addSensorForm');
    const messageDiv = document.getElementById('message');

    if (!addSensorForm) {
        console.error('Add Sensor form element not found.');
        return;
    }
    if (!messageDiv) {
        console.error('Message div element not found in Add Sensor form.');
        return;
    }



    addSensorForm.addEventListener('submit', async function(event) {
        event.preventDefault();


        const { token, userRole } = localStorage;

        if (!token || userRole !== 'admin') {
            displayMessage(messageDiv, 'Unauthorized: Only administrators can add sensors. Redirecting to login.', 'error');
            setTimeout(logout, 2000);
            return;
        }


        displayMessage(messageDiv, '', 'info'); // Clear previous messages

        const formData = {
            controllerId: document.getElementById('controllerId').value,
            sensorHardwareId: document.getElementById('sensorHardwareId').value || undefined,
            type: document.getElementById('type').value,
            name: document.getElementById('sensorname').value,
            model: document.getElementById('model').value || undefined,
            pin: document.getElementById('pin').value || undefined,
            unit: document.getElementById('unit').value || undefined,
            associatedTankId: document.getElementById('associatedTankId').value || undefined
        };






        const calibrationDataInput = document.getElementById('calibrationData').value;
        if (calibrationDataInput) {
            try {
                formData.calibrationData = JSON.parse(calibrationDataInput);
            } catch (e) {
                displayMessage(messageDiv, 'Invalid Calibration Data JSON format. Please ensure it\'s valid JSON.', 'error');
                return;
            }
        } else {
            formData.calibrationData = undefined;
        }


        if (!formData.controllerId || !formData.type || !formData.name) {
                                                                    console.log("ddddddddddddd");


            displayMessage(messageDiv, 'Please fill in all required fields: Assign to Controller, Sensor Type, and Sensor Name.', 'error');
            return;
        }



        try {
            const response = await fetch('/api/admin/sensors/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(messageDiv, data.message, 'success', 3000); // Display for 3 seconds
                addSensorForm.reset();
                await populateControllersDropdown(); // Re-populate dropdown
                document.getElementById('type').value = ''; // Reset type dropdown
            } else {
                displayMessage(messageDiv, data.message || 'Sensor addition failed.', 'error');
                if (response.status === 401 || response.status === 403) {
                    alert('Session expired or unauthorized. Please log in again.');
                    logout();
                }
            }
        } catch (error) {
            console.error('Network error:', error);
            displayMessage(messageDiv, 'Could not connect to the server.', 'error');
        }
    });
}

// --- Global Functions (Ensure these are defined once in your admin-dashboard.js) ---
/**
 * Logs out the user by clearing local storage and redirecting to the login page.
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
}

/**
 * Checks if the current user is an authenticated admin.
 * @returns {Promise<boolean>} True if admin, false otherwise.
 */
async function checkAdminStatus() {
    const { token, userRole } = localStorage;
    if (!token || userRole !== 'admin') {
        // Optionally, you might want to redirect here if checkAdminStatus is called on page load
        // and a user isn't an admin. For form submissions, the specific listener handles it.
        return false;
    }
    return true;
}


        document.addEventListener('DOMContentLoaded', fetchDashboardStats);



         // Consolidated DOMContentLoaded listener to initialize the dashboard
        document.addEventListener('DOMContentLoaded', async () => {
            const userRole = localStorage.getItem('userRole');
            if (userRole !== 'admin') {
                displayMessage('Unauthorized access. Redirecting to login.', 'error');
                logout();
                return;
            }

            const today = new Date();
            currentYear = today.getFullYear();
            currentMonth = today.getMonth() + 1; 

            await fetchDashboardStats();
            await fetchAndRenderProfile();
            await fetchAndRenderChangePasswordForm();
            await fetchAndRenderUserListSection(); 
            await renderRegisterUserSection();
            await renderAddHomeSection();
            await renderAddControllerSection();
            await renderAddSensorSection(); 
            showSection('dashboardContentContainer');

           

        


        });
