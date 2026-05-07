// script_7.js ki pehli 5-6 lines aisi honi chahiye:
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getDatabase, ref, push, set, onValue, update, remove, serverTimestamp, get, child } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// File ke shuru mein is line ko check karein


// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
// Import the functions you need from the SDKs you need
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjvPyH-rd2mayh8hEKrAwoxq4p-EMR0Bw",
  authDomain: "imam-tavel-company.firebaseapp.com",
  databaseURL: "https://imam-tavel-company-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "imam-tavel-company",
  storageBucket: "imam-tavel-company.firebasestorage.app",
  messagingSenderId: "357684577696",
  appId: "1:357684577696:web:642ef6f708043345afd0c5",
  measurementId: "G-H5QTGK0CNT"
};

// Line 22-27 ko isse badal dein:
const app = initializeApp(firebaseConfig);
const database = getDatabase(app); // Realtime DB ke liye
const db = getFirestore(app); 
const firestoreDB = getFirestore(app);      // Firestore ke liye

// GLOBAL reference banayein taake har jagah use ho sake
window.dbRef = ref(database);
window.database = database;

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split("/").pop();

    if (page !== "" && page !== "index.html") {
        if (!localStorage.getItem('username')) {
            window.location.href = "index.html";
            return;
        }
    }

    updateClock();
    setInterval(updateClock, 1000);
    
    // Foran permissions apply karein[cite: 5]
    window.applyRoleBasedAccess();
});


window.logoutUser = function() {
    localStorage.clear();
    window.location.replace("index.html");
};

// ==========================================
// 2. CORE UI & DASHBOARD LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    applyRoleBasedAccess(); 
    
    // Sidebar link logic
    const userAccountsItem = document.getElementById('userAccountsItem');
    if (userAccountsItem) {
        userAccountsItem.addEventListener('click', () => { window.location.href = 'user_accounts.html'; });
    }
});

function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        clockElement.innerText = `${now.toLocaleDateString('en-GB')} | ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

function switchService(serviceName) {
    const sidebars = ['ticketSidebar', 'visaSidebar', 'accountsSidebar'];
    sidebars.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const targetId = serviceName === 'visa' ? 'visaSidebar' : (serviceName === 'accounts' ? 'accountsSidebar' : 'ticketSidebar');
    const target = document.getElementById(targetId);
    if (target) target.style.display = 'block';
}

function toggleMenu(menuId) {
    document.querySelectorAll('.menu-content').forEach(m => m.classList.remove('show'));
    const target = document.getElementById(menuId);
    if (target) target.classList.add('show');
}

// ==========================================
// 3. AUTHENTICATION & SECURITY (UPDATED)
// ==========================================
window.handleLogin = function(event) {
    event.preventDefault();

    // 1. Loading dikhao
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'flex';
    
    const uName = document.getElementById('login_user').value.trim();
    const uPass = document.getElementById('login_pass').value.trim();
    const uComp = document.getElementById('login_company').value.trim();

    // Firebase se users ka data check karein
    const dbRef = ref(database);
    get(child(dbRef, 'users')).then((snapshot) => {
        const allUsers = snapshot.val();
        let foundUser = null;

        if (!allUsers) {
            if (loader) loader.style.display = 'none'; // Hide on error
            alert("Server Error: No users found!");
            return;
        }

        // Admins aur Workers dono groups mein search karein
        ["admins", "workers"].forEach(group => {
            if (allUsers[group]) {
                Object.keys(allUsers[group]).forEach(key => {
                    const u = allUsers[group][key];
                    
                    // DATABASE vs INPUT Comparison
                    // 1. Password ko String banaya (taake number hone par bhi match ho)
                    // 2. Username ko lowercase kiya (taake Case-Sensitivity ka masla na ho)
                    const dbPass = String(u.password);
                    const dbUser = String(u.username).toLowerCase();
                    const inputUser = uName.toLowerCase();

                    if (dbUser === inputUser && dbPass === uPass && u.companyid === uComp) {
                        foundUser = { ...u, role: group, uid: key };
                    }
                });
            }
        });

        if (foundUser) {
            // Login successful: Data local storage mein save karein
            localStorage.setItem('role', foundUser.role);
            localStorage.setItem('username', foundUser.username);
            window.location.href = "ticket.html"; 
        }
        else {
            // 2. Galat login par loading chhupao
            if (loader) loader.style.display = 'none';
            alert("Invalid Credentials!");
        }
    }).catch(err => {
        console.error("Database Error:", err);
        alert("Server connection failed!");
    });
}

window.applyRoleBasedAccess = function() {
    // Trim kiya taake space ka masla na ho
    const userRole = (localStorage.getItem('role') || "").trim().toLowerCase(); 
    
    const adminItems = [
        'userAccountsItem', 
        'changePasswordItem', 
        'allProfilesBtn', 
        'miscSettingsItem', 
        'chartOfAccountsItem', 
        'userDeleteItem'
    ];
    
    adminItems.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Sirf 'admins' ko dikhao, baqi sab ke liye hidden
            if (userRole === 'admins') {
                el.style.display = 'flex';
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        }
    });
};



// ==========================================
// 4. CONTACT BOOK SYSTEM
// ==========================================
// ==========================================
// 4. CONTACT BOOK SYSTEM - FIXED SAVE FUNCTION
// ==========================================
window.saveToFirebase = function() {
    // 1. Sare Input Elements ko fetch karein
    const nameElem = document.getElementById('add_name');
    const phoneElem = document.getElementById('add_phone');
    const countryElem = document.getElementById('countrySelect');
    const cityElem = document.getElementById('citySelect');
    const whatsappElem = document.getElementById('add_whatsapp');
    const emailElem = document.getElementById('add_email');
    const companyElem = document.getElementById('add_company');
    const positionElem = document.getElementById('add_position');

    // 2. Mandatory elements ki safety check
    if (!nameElem || !phoneElem) {
        console.error("Critical Error: HTML input IDs (add_name or add_phone) are missing!");
        alert("System Error: Form inputs not found.");
        return;
    }

    // 3. Values extract karein aur trim karein (extra spaces khatam karne ke liye)
    const name = nameElem.value.trim();
    const phone = phoneElem.value.trim();
    const country = countryElem ? countryElem.value : "";
    const city = cityElem ? cityElem.value : "";
    const whatsapp = whatsappElem ? whatsappElem.value.trim() : "";
    const email = emailElem ? emailElem.value.trim() : "";
    const company = companyElem ? companyElem.value.trim() : "";
    const position = positionElem ? positionElem.value : "";

    // 4. Validation: Name aur Phone lazmi hona chahiye
    if (!name || !phone) { 
        alert("Error: Full Name and Contact No are required!"); 
        return; 
    }

    // 5. Firebase Reference banayein[cite: 3]
    // 'database' variable wahi hai jo aapne script ke shuru mein initialize kiya hai[cite: 3]
    const contactsRef = ref(database, 'contacts'); 

    // 6. Modular 'push' use karein (v9 syntax)[cite: 3]
    push(contactsRef, {
        fullName: name,
        contactNo: phone,
        whatsappNo: whatsapp,
        email: email,
        companyName: company,
        position: position,
        country: country,
        city: city,
        addedBy: localStorage.getItem('username'),
        timestamp: serverTimestamp() // Yeh server ka waqt record karega[cite: 3]
    })
    .then(() => {
        alert("Success: Contact saved to server!");
        // Data save hone ke baad list wale page par wapis jayein[cite: 3]
        window.location.href = "Contact_Book_Inquiry.html"; 
    })
    .catch((err) => {
        console.error("Firebase Push Error:", err);
        alert("Error saving contact: " + err.message);
    });
};

// ==========================================
// 4. CONTACT BOOK SYSTEM - UPDATED SEARCH
// ==========================================

window.handleSearch = function() {
    // 1. Saare variables ko define karein (IDs aapke HTML se match karti hain)
    const userSelect = document.getElementById('filter-user');
    const selectedUser = userSelect ? userSelect.value : "All Users";
    
    const sCountry = document.getElementById('searchCountry')?.value || "";
    const sCity = (document.getElementById('searchCity')?.value || "").toLowerCase();
    const sName = (document.getElementById('searchName')?.value || "").toLowerCase();
    const sPhone = (document.getElementById('searchPhone')?.value || "").toLowerCase();
    const sWhatsapp = (document.getElementById('searchWhatsapp')?.value || "").toLowerCase();
    const sCompany = (document.getElementById('searchCompany')?.value || "").toLowerCase();

    const tableBody = document.getElementById('serverData');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Fetching data from server...</td></tr>';

    // 2. MODULAR SDK GET FUNCTION (v9+)
    get(ref(database, 'contacts')).then((snapshot) => {
        tableBody.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) { 
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No records found.</td></tr>'; 
            return; 
        }

        Object.keys(data).forEach(key => {
            const item = data[key];

            // 3. Filtering Logic
            const matchesUser = (selectedUser === "All Users") || (item.addedBy === selectedUser);
            const matchesCountry = (sCountry === "" || item.country === sCountry);
            const matchesCity = (sCity === "" || (item.city && item.city.toLowerCase().includes(sCity)));
            const matchesName = (sName === "" || (item.fullName && item.fullName.toLowerCase().includes(sName)));
            const matchesPhone = (sPhone === "" || (item.contactNo && item.contactNo.toLowerCase().includes(sPhone)));
            const matchesWhatsapp = (sWhatsapp === "" || (item.whatsappNo && item.whatsappNo.toLowerCase().includes(sWhatsapp)));
            const matchesCompany = (sCompany === "" || (item.companyName && item.companyName.toLowerCase().includes(sCompany)));

            // Sab filters match hon to he row dikhayein
            if (matchesUser && matchesCountry && matchesCity && matchesName && matchesPhone && matchesWhatsapp && matchesCompany) {
                tableBody.innerHTML += `
                    <tr>
                        <td>${item.fullName || '-'}</td>
                        <td>${item.contactNo || '-'}</td>
                        <td>${item.whatsappNo || '-'}</td>
                        <td>${item.email || '-'}</td>
                        <td>${item.companyName || '-'}</td>
                        <td>${item.position || '-'}</td>
                        <td>${item.city || '-'}</td>
                        <td>${item.country || '-'}</td>
                        <td>${item.addedBy || '-'}</td>
                        <td>
                           <button class="action-btn edit-btn" onclick="editContact('${key}')">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>`;
            }
        });

        // Agar filtering ke baad koi result na bache
        if (tableBody.innerHTML === '') {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No matching records found.</td></tr>';
        }

    }).catch(err => {
        console.error("Search Error:", err);
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:red;">Error: ' + err.message + '</td></tr>';
    });
}

// Function ko window ke sath attach karein
window.openAddModal = function() {
    const modal = document.getElementById('addUserModal');
    if (modal) modal.style.display = 'block';
};

window.closeAddModal = function() {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addUserForm').reset();
    }
};

window.closeModal = function() {
    const modal = document.getElementById('editUserModal');
    if (modal) modal.style.display = 'none';
};


const addUserForm = document.getElementById('addUserForm');

if (addUserForm) {
    addUserForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const role = document.getElementById('add_role').value;
        const userData = {
            username: document.getElementById('add_username').value,
            email: document.getElementById('add_email').value,
            companyid: document.getElementById('add_companyid').value,
            password: "123" // Naye user ke liye default password set kar diya
        };

        const usersListRef = ref(database, `users/${role}`); 
        const newUserRef = push(usersListRef);
        
        set(newUserRef, userData)
            .then(() => {
                alert("New User Created Successfully!");
                // Input fields saaf karein
                addUserForm.reset();
                closeAddModal();
                // Data refresh karne ke liye
                const loadBtn = document.getElementById('loadDataBtn');
                if(loadBtn) loadBtn.click(); 
            })
            .catch(error => alert("Error: " + error.message));
    });
}


// ==========================================
// 5. USER MANAGEMENT (LIVE SERVER DATA)
// ==========================================

if (document.getElementById('loadDataBtn')) {
    document.getElementById('loadDataBtn').addEventListener('click', function() {
        const userTableBody = document.getElementById('userTableBody');
        const btn = this;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
        
        // MODULAR WAY: onValue use karein
        const usersRef = ref(database, 'users');
        onValue(usersRef, (snapshot) => {
            userTableBody.innerHTML = ""; 
            const allData = snapshot.val();
            
            if (allData) {
                ["admins", "workers"].forEach(group => {
                    if (allData[group]) {
                        Object.keys(allData[group]).forEach(key => {
                            const user = allData[group][key];
                            userTableBody.innerHTML += `
                                <tr>
                                    <td><strong>${user.username || 'No Name'}</strong></td>
                                    <td>${user.email || 'N/A'}</td>
                                    <td><code>${user.companyid || 'N/A'}</code></td>
                                    <td><span class="badge ${group === 'admins' ? 'badge-admin' : 'badge-worker'}">${group.toUpperCase()}</span></td>
                                    <td><span class="status-active">● Online</span></td>
                                    <td>
                                        <button class="action-btn edit-btn" onclick="openEditModal('${group}', '${key}', '${user.username}', '${user.email}', '${user.companyid}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </td>
                                </tr>`;
                        });
                    }
                });
                btn.innerHTML = '<i class="fas fa-check"></i> Server Sync Done';
            } else {
                userTableBody.innerHTML = "<tr><td colspan='6'>No users found.</td></tr>";
            }
        });
    });
}



// Modal functions
window.openEditModal = function(group, key, username, email, companyid) {
    // Hidden path set karein taake pata chale kis user ko update karna hai
    document.getElementById('edit_user_path').value = `${group}/${key}`;
    
    // Purana data fill karein
    document.getElementById('edit_username').value = username;
    document.getElementById('edit_email').value = email;
    document.getElementById('edit_companyid').value = companyid;
    document.getElementById('edit_role').value = group;
    
    // Password field ko hamesha khali rakhein (security aur clarity ke liye)
    const passField = document.getElementById('edit_password');
    if(passField) passField.value = ""; 
    
    document.getElementById('editUserModal').style.display = 'block';
}


// ... upar addUserForm ka code hoga ...

// ==========================================
// EDIT USER LOGIC (YAHAN PASTE KAREIN)
// ==========================================
const editUserForm = document.getElementById('editUserForm');

if (editUserForm) {
    editUserForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const path = document.getElementById('edit_user_path').value;
        const newRole = document.getElementById('edit_role').value;
        const oldRole = path.split('/')[0];
        const userKey = path.split('/')[1];
        const newPassword = document.getElementById('edit_password').value.trim();

        const updatedData = {
            username: document.getElementById('edit_username').value,
            email: document.getElementById('edit_email').value,
            companyid: document.getElementById('edit_companyid').value,
            password: newPassword !== "" ? newPassword : "123456" 
        };

        if (newRole !== oldRole) {
            // Role change hone par purana delete aur naya set[cite: 1]
            set(ref(database, `users/${newRole}/${userKey}`), updatedData)
                .then(() => remove(ref(database, `users/${oldRole}/${userKey}`))) // 'remove' ab define ho chuka hai
                .then(() => {
                    alert("User Role & Data Updated!");
                    location.reload();
                })
                .catch(err => console.error(err));
        } else {
            // Sirf data ya password update karne ke liye[cite: 1, 4]
            update(ref(database, `users/${path}`), updatedData) // 'update' ab define ho chuka hai
                .then(() => {
                    alert("User Updated Successfully!");
                    document.getElementById('editUserModal').style.display = 'none';
                    document.getElementById('loadDataBtn').click();
                })
                .catch(err => console.error(err));
        }
    });
}




function finishUpdate() {
    alert("User Data Updated Successfully!");
    closeModal();
    document.getElementById('loadDataBtn').click(); // Refresh table
}


window.deleteUserAccount = function(path) {
    if(confirm("DANGER: Are you sure you want to delete this account permanently?")) {
        ref(database, 'users/' + path).remove().then(() => {
            alert("User deleted successfully.");
            document.getElementById('loadDataBtn').click(); // Refresh list
        });
    }
}




// ==========================================
// 6. QUERY MANAGEMENT SYSTEM (New)
// ==========================================

window.saveQueryToFirebase = function() {
    // 1. Data collect karein
    const queryData = {
        date: document.getElementById('date')?.value || "",
        name: document.getElementById('q_name')?.value || "",
        mobile: document.getElementById('q_mobile')?.value || "",
        whatsapp: document.getElementById('q_whatsapp')?.value || "",
        email: document.getElementById('q_email')?.value || "",
        city: document.getElementById('q_city')?.value || "",
        type: document.getElementById('q_type')?.value || "GENERAL INFORMATION",
        source: document.getElementById('q_source')?.value || "PHONE",
        description: document.getElementById('q_description')?.value || "",
        forwardedTo: document.getElementById('q_forwarded_to')?.value || "-", 
        assignedBy: localStorage.getItem('username') || 'HASEEB RAZA',
        status: document.getElementById('q_status')?.value || 'Active', 
        timestamp: serverTimestamp() // Yeh serverTimestamp aapne import kiya hua hai
    };

    // 2. Validation
    if (!queryData.name || !queryData.mobile) {
        alert("Please fill Name and Mobile number!");
        return;
    }

    // 3. FIX: Modular Syntax use karein
    // ref(database, 'queries').push(queryData) <-- Yeh galat tha
    const queriesListRef = ref(database, 'queries'); 
    
    push(queriesListRef, queryData) // Sahi tarika: push(reference, data)
        .then(() => {
            alert("Query Saved Successfully!");
            window.location.href = "query_inquiry.html";
        })
        .catch(err => {
            console.error("Save Error:", err);
            alert("Error: " + err.message);
        });
}

// --- SERVER SE DATA LANE KA FUNCTION (MODIFIED) ---
window.fetchQueriesFromServer = function() {
    const tableBody = document.getElementById('queryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="14" style="text-align:center;">Loading data from server...</td></tr>';

    // Firebase v9+ Modular syntax: onValue()
    const queriesRef = ref(database, 'queries');
    onValue(queriesRef, (snapshot) => {
        tableBody.innerHTML = ''; 
        const data = snapshot.val();

        if (!data) {
            tableBody.innerHTML = '<tr><td colspan="14" style="text-align:center;">No data found in server.</td></tr>';
            return;
        }

        Object.keys(data).forEach(key => {
            const q = data[key];
            const row = `
                <tr>
                    <td><button class="btn-update">UPDATE</button></td>
                    <td><span class="status-badge ${q.status?.toLowerCase() || 'active'}">${q.status || 'Active'}</span></td>
                    <td>${q.date || '-'}</td>
                    <td>${q.source || '-'}</td>
                    <td>${q.type || '-'}</td>
                    <td><strong>${q.name || '-'}</strong></td>
                    <td>${q.mobile || '-'}</td>
                    <td>${q.whatsapp || '-'}</td>
                    <td>${q.email || '-'}</td>
                    <td><div class="remark-cell" title="${q.description}">${q.description || '-'}</div></td>
                    <td>${q.forwardedTo || '-'}</td>
                    <td>${q.assignedBy || '-'}</td>
                    <td><input type="checkbox" ${q.followUp ? 'checked' : ''}></td>
                    <td><i class="fa fa-file-invoice" style="cursor:pointer;"></i></td>
                </tr>`;
            tableBody.innerHTML += row;
        });
    });
}


// Page load hote hi function ko call karein
if(window.location.pathname.includes('query_inquiry.html')){
    document.addEventListener('DOMContentLoaded', fetchQueriesFromServer);
}


// Global Variable[cite: 3]
window.currentStatusFilter = 'All'; 

// Filter Button Click Function[cite: 3]
window.filterByStatus = function(status) {
    window.currentStatusFilter = status;
    console.log("Filter set to:", status);
    window.searchQueries(); // Search ko dobara call karein
};


window.searchQueries = function() {
    const tableBody = document.getElementById('queryTableBody');
    if (!tableBody) return;

    // --- Inputs se values lein ---
    const sName = (document.getElementById('filter_name')?.value || "").toLowerCase();
    const sMobile = (document.getElementById('filter_mobile')?.value || "");
    const sWhatsapp = (document.getElementById('filter_whatsapp')?.value || "");
    
    // NAYE FILTERS: User aur Forwarded To dropdowns ki values
    const sUser = document.getElementById('filter_user_dropdown')?.value || "All Users";
    const sForwarded = document.getElementById('filter_forwarded_dropdown')?.value || "All Users";

    tableBody.innerHTML = '<tr><td colspan="14" style="text-align:center;">Filtering...</td></tr>';

    const queriesRef = ref(database, 'queries');
    get(queriesRef).then((snapshot) => {
        tableBody.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) {
            updateButtonCounts(0, 0, 0, 0);
            tableBody.innerHTML = '<tr><td colspan="14" style="text-align:center;">No data found.</td></tr>';
            return;
        }

        let cDone = 0, cProcessing = 0, cActive = 0, cAll = 0;

        Object.keys(data).forEach(key => {
            const q = data[key];
            const qStatus = q.status || 'Active';

            // 1. Status Counts (Pure database ka total)
            cAll++;
            if (qStatus.toLowerCase() === 'done') cDone++;
            else if (qStatus.toLowerCase() === 'processing') cProcessing++;
            else if (qStatus.toLowerCase() === 'active') cActive++;

            // 2. Filtering Logic
            const matchesName = (q.name || "").toLowerCase().includes(sName);
            const matchesMobile = (q.mobile || "").includes(sMobile);
            const matchesWhatsapp = (q.whatsapp || "").includes(sWhatsapp);
            const matchesStatus = (window.currentStatusFilter === 'All' || 
                                   qStatus.toLowerCase() === window.currentStatusFilter.toLowerCase());
            
            // NAYA FILTER LOGIC: Assigned By aur Forwarded To match karein
            const matchesUser = (sUser === "All Users" || (q.assignedBy === sUser));
            const matchesForwarded = (sForwarded === "All Users" || (q.forwardedTo === sForwarded));

            // Agar saari conditions match karein to row dikhayein
            if (matchesName && matchesMobile && matchesWhatsapp && matchesStatus && matchesUser && matchesForwarded) {
                const row = `
                    <tr>
                        <td><button class="btn-update" onclick="manualUpdateStatus('${key}', this)">UPDATE</button></td>
                        <td>
                            <select class="status-dropdown ${qStatus.toLowerCase()}">
                                <option value="Active" ${qStatus === 'Active' ? 'selected' : ''}>ACTIVE</option>
                                <option value="Processing" ${qStatus === 'Processing' ? 'selected' : ''}>PROCESSING</option>
                                <option value="Done" ${qStatus === 'Done' ? 'selected' : ''}>DONE</option>
                            </select>
                        </td>
                        <td>${q.date || '-'}</td>
                        <td>${q.source || '-'}</td>
                        <td>${q.type || '-'}</td>
                        <td><strong>${q.name || '-'}</strong></td>
                        <td>${q.mobile || '-'}</td>
                        <td>${q.whatsapp || '-'}</td>
                        <td>${q.email || '-'}</td>
                        <td><div class="remark-cell">${q.description || '-'}</div></td>
                        <td>${q.forwardedTo || '-'}</td>
                        <td>${q.assignedBy || '-'}</td>
                        <td><input type="checkbox" ${q.followUp ? 'checked' : ''}></td>
                        <td><i class="fa fa-file-invoice"></i></td>
                    </tr>`;
                tableBody.innerHTML += row;
            }
        });

        // 3. UI Update
        updateButtonCounts(cDone, cProcessing, cActive, cAll);

    }).catch(err => {
        console.error("Firebase Error:", err);
        tableBody.innerHTML = '<tr><td colspan="14" style="color:red;">Error loading data.</td></tr>';
    });
};

// Buttons ko update karne ka asaan function
function updateButtonCounts(done, proc, active, all) {
    if(document.getElementById('btn-done')) document.getElementById('btn-done').innerText = `II Done(${done})`;
    if(document.getElementById('btn-processing')) document.getElementById('btn-processing').innerText = `▲ Processing(${proc})`;
    if(document.getElementById('btn-active')) document.getElementById('btn-active').innerText = `👍 Active(${active})`;
    if(document.getElementById('btn-all')) document.getElementById('btn-all').innerText = `Ξ ALL(${all})`;
}


if(window.location.pathname.includes('query_inquiry.html')){
    document.addEventListener('DOMContentLoaded', () => {
        window.searchQueries(); // Window version call karein[cite: 3]
    });
}

// Firebase connection status check karne ke liye
const connectedRef = ref(database, ".info/connected");

onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        console.log("Connected to Server");
        // Jab connection wapis aaye, tabhi data fetch karein
        if (typeof window.searchQueries === "function") {
            window.searchQueries();
        }
    } else {
        console.log("Searching for connection...");
        const tableBody = document.getElementById('queryTableBody');
        if (tableBody && tableBody.innerHTML === "") {
            tableBody.innerHTML = '<tr><td colspan="14" style="text-align:center;">Reconnecting to server...</td></tr>';
        }
    }
});

function updateQueryStatus(queryId, newStatus) {
    ref(database, 'queries/' + queryId).update({
        status: newStatus
    }).then(() => {
        console.log("Status updated to: " + newStatus);
        searchQueries(); // Status change hote hi list refresh ho jaye
    }).catch(err => alert("Error updating status: " + err.message));
}

// Function ko window object ke sath attach karein taake HTML ise access kar sake
window.manualUpdateStatus = function(queryId, btn) {
    // 1. Button ke zariye row aur dropdown dhundna
    const row = btn.closest('tr');
    const dropdown = row.querySelector('.status-dropdown');
    
    if (!dropdown) {
        console.error("Status dropdown not found in the row!");
        return;
    }

    const newStatus = dropdown.value;

    // 2. Visual feedback (Button disable karna)
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    // 3. Firebase Update (Modular v9+ Syntax)
    // 'update' aur 'ref' aapne file ke top par import kiye hue hain
    update(ref(database, 'queries/' + queryId), {
        status: newStatus
    }).then(() => {
        alert("Status Updated to: " + newStatus);
        btn.innerText = originalText;
        btn.disabled = false;
        
        // Agar aap chahte hain ke update ke baad list refresh ho:
        if (typeof window.searchQueries === "function") {
            window.searchQueries(); 
        }
    }).catch(err => {
        alert("Error updating status: " + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    });
};

// Click event listener for the entire table body
// Ismein 'if' condition lagayi hai taake error na aaye
document.addEventListener('click', function(e) {
    const tableBody = document.getElementById('queryTableBody');
    
    // Agar page par table nahi hai, to ye code aage nahi chalega
    if (!tableBody) return; 

    // Check if the clicked element is our Update button
    if (e.target && e.target.classList.contains('btn-manual-save')) {
        const row = e.target.closest('tr');
        const queryId = row.getAttribute('data-key');
        const newStatus = row.querySelector('.status-dropdown').value;

        // Visual feedback
        const btn = e.target;
        const originalText = btn.innerText;
        btn.innerText = "SAVING...";
        btn.disabled = true;

        ref(database, 'queries/' + queryId).update({
            status: newStatus
        }).then(() => {
            alert("Updated Successfully!");
            btn.innerText = originalText;
            btn.disabled = false;
            // List refresh karein
            if (typeof searchQueries === "function") searchQueries();
        }).catch(err => {
            alert("Error: " + err.message);
            btn.innerText = originalText;
            btn.disabled = false;
        });
    }
});

// Add this to your existing script.js
function toggleAccordion(id) {
    const element = document.getElementById(id);
    if (element.style.display === "block") {
        element.style.display = "none";
    } else {
        element.style.display = "block";
    }
    
    // Toggle Icon Rotation (Optional)
    const icon = event.currentTarget.querySelector('i');
    if(icon.classList.contains('fa-caret-right')) {
        icon.classList.replace('fa-caret-right', 'fa-caret-down');
    } else {
        icon.classList.replace('fa-caret-down', 'fa-caret-right');
    }
}


const tableBody = document.getElementById('visaTableBody');

if (tableBody) {
    // Data fetch karna aur list mein dikhana
    const q = query(collection(db, "visas"), orderBy("createdAt", "asc"));
    
    // ... Firebase init code ...

    onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = ""; 
        snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            
            // Same to same row structure with icons
            const row = `
                <tr>
                    <td>${data.name.toUpperCase()}</td>
                    <td class="icon-col">
                        <a href="#" onclick="editVisa('${id}')">
                            <img src="edit_icon.png" width="16" alt="Edit"> 
                        </a>
                    </td>
                    <td class="icon-col">
                        <a href="#" onclick="deleteVisa('${id}')">
                            <img src="delete_icon.png" width="16" alt="Delete">
                        </a>
                    </td>
                </tr>`;
            tableBody.innerHTML += row;
        });
    });
}

// Server se users fetch karke dropdowns mein bharne ka function
window.loadUsersIntoDropdowns = function() {
    const userDropdown = document.getElementById('filter_user_dropdown');
    if (!userDropdown) return;

    const usersRef = ref(database, 'users');
    get(usersRef).then((snapshot) => {
        const allData = snapshot.val();
        if (!allData) return;

        // Dropdown clear karein (siwaye "All Users" ke)
        userDropdown.innerHTML = '<option value="All Users">All Users</option>';

        const groups = ["admins", "workers"];
        groups.forEach(group => {
            if (allData[group]) {
                Object.keys(allData[group]).forEach(key => {
                    const user = allData[group][key];
                    const userName = user.username;
                    
                    // Option element banayein
                    const option = `<option value="${userName}">${userName}</option>`;
                    userDropdown.innerHTML += option;
                });
            }
        });
    }).catch(err => console.error("Error loading users:", err));
};

window.saveBookingToFirebase = function() {
    // 1. Pax Details Section
    const title = document.getElementById('pax_title')?.value || "";
    const surname = document.getElementById('pax_surname')?.value.trim() || "";
    const givenName = document.getElementById('pax_givenname')?.value.trim() || "";
    const fatherName = document.getElementById('pax_fh_name')?.value.trim() || "";
    const contactNo = document.getElementById('pax_contact')?.value.trim() || "";
    const whatsappNo = document.getElementById('pax_whatsapp_no')?.value.trim() || "";
    const passportNo = document.getElementById('pax_pp_no')?.value.trim() || "";
    const dob = document.getElementById('pax_dob')?.value || "";
    const ppExpire = document.getElementById('pax_pp_expire')?.value || "";
    const city = document.getElementById('searchCity')?.value || "";
    const country = document.getElementById('searchCountry')?.value || "";
    const agent = document.getElementById('searchAgent')?.value || "";
    const datetime = document.getElementById('pax_datetime')?.value || "";
    const ticketno = document.getElementById('pax_ticket_no')?.value || "";
    // 2. Airline & Fare Detail Section
    const route = document.getElementById('airline_route')?.value.trim() || "";
    const carrier = document.getElementById('airline_carrier')?.value || "";
    const pnr = document.getElementById('airline_pnr')?.value.trim() || "";
    const gdsPnr = document.getElementById('airline_gds_pnr')?.value.trim() || "";
    const fare = document.getElementById('airline_fare')?.value || "0";
    const taxes = document.getElementById('airline_taxes')?.value || "0";
    const totalFare = document.getElementById('airline_total_fare')?.value || "0";
    const salePrice = document.getElementById('airline_sale')?.value || "0";
    const remarks = document.getElementById('airline_remarks')?.value || "";

    // Validation
    if (surname === "" || contactNo === "") {
        alert("Error: Please fill Surname and Contact Number!");
        return;
    }

    // 3. Complete Data Object
    const bookingData = {
        transNo: "TEMP" + Date.now().toString().slice(-5),
        title: title,
        surname: surname,
        givenName: givenName,
        fatherName: fatherName,
        contactNo: contactNo,
        whatsappNo: whatsappNo,
        passportNo: passportNo,
        dob: dob,
        ppExpire: ppExpire,
        city: city,
        country: country,
        agent: agent,
        datetime: datetime,
        ticketno: ticketno,
        // Airline details
        route: route,
        carrier: carrier,
        pnr: pnr,
        gdsPnr: gdsPnr,
        fare: fare,
        taxes: taxes,
        totalFare: totalFare,
        salePrice: salePrice,
        remarks: remarks,
        // Meta data
        addedBy: localStorage.getItem('username') || "Admin",
        timestamp: serverTimestamp() //[cite: 3]
    };

    const bookingsRef = ref(database, 'bookings'); 
    
    push(bookingsRef, bookingData)
        .then(() => {
            alert("Full Booking Saved Successfully!");
            window.location.href = "temporary_booking.html"; //[cite: 10]
        })
        .catch((err) => {
            alert("Firebase Error: " + err.message);
        });
};

// ==========================================
// --- TICKETING DATA FETCH FUNCTION ---
// ==========================================
window.fetchTicketingData = function() {
    const tableBody = document.getElementById('tempBookingData');
    if (!tableBody) return;

    // Table saaf karein aur loading dikhayein
    tableBody.innerHTML = '<tr><td colspan="16" style="text-align:center;">Searching data on server...</td></tr>';

    const bookingsRef = ref(database, 'bookings');
    
    // 'get' use karne se data sirf ek baar fetch hoga jab click karenge
    get(bookingsRef).then((snapshot) => {
        tableBody.innerHTML = ''; 
        const data = snapshot.val();

        if (!data) {
            tableBody.innerHTML = '<tr><td colspan="16" style="text-align:center;">No records found.</td></tr>';
            return;
        }

        Object.keys(data).forEach((key, index) => {
            const b = data[key];
            const row = `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${b.title || ''} ${b.surname || '-'} ${b.givenName || ''}</strong></td>
                    <td>${b.contactNo || '-'}</td>
                    <td>${b.whatsappNo || '-'}</td>
                    <td>${b.pnr || '-'}</td>
                    <td>${b.gdsPnr || '-'}</td>
                    <td style="text-align:right;">${b.fare || '0'}</td>
                    <td style="text-align:right;">${b.taxes || '0'}</td>
                    <td style="text-align:right;">${b.totalFare || '0'}</td>
                    <td style="text-align:right;">${b.salePrice || '0'}</td>
                    <td>${b.carrier || '-'}</td>
                    <td style="font-size: 11px;">${b.timestamp ? new Date(b.timestamp).toLocaleString() : '-'}</td>
                    <td>${b.addedBy || '-'}</td>
                    <td style="text-align:center;"><input type="checkbox" checked disabled></td>
                    <td style="text-align:center;"><i class="fa fa-users" title="PP: ${b.passportNo || 'N/A'}"></i></td>
                    <td style="text-align:center;">
                        <button class="action-btn edit-btn" onclick="editBooking('${key}')">
                            <i class="fas fa-edit" style="color:#007bff;"></i>
                        </button>
                    </td>
                </tr>`;
            tableBody.innerHTML += row;
        });
    }).catch((error) => {
        console.error("Search Error:", error);
        tableBody.innerHTML = `<tr><td colspan="16" style="text-align:center; color:red;">Error: ${error.message}</td></tr>`;
    });
};

// --- EDIT FUNCTION (ReferenceError fix karne ke liye) ---
window.editBooking = function(key) {
    console.log("Editing booking key:", key);
    alert("Editing feature for ID: " + key + " is active. Logic can be added here.");
    // Example: window.location.href = `edit_booking.html?id=${key}`;
};

// ==========================================
// --- AUTO-LOAD LOGIC ---
// ==========================================
// Sirf page ki basic cheezon ke liye (Data load nahi karega)
document.addEventListener('DOMContentLoaded', () => {
    console.log("Page Ready. Waiting for search click...");
});