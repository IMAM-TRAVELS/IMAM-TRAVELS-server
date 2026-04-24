// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCjvPyH-rd2mayh8hEKrAwoxq4p-EMR0Bw",
    authDomain: "imam-tavel-company.firebaseapp.com",
    projectId: "imam-tavel-company",
    storageBucket: "imam-tavel-company.firebasestorage.app",
    messagingSenderId: "357684577696",
    appId: "1:357684577696:web:642ef6f708043345afd0c5",
    databaseURL: "https://imam-tavel-company-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

// Firebase Initialize
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// ==========================================
// 2. SIDEBAR & UI LOGIC
// ==========================================
function switchService(serviceName) {
    const ticketSidebar = document.getElementById('ticketSidebar');
    const visaSidebar = document.getElementById('visaSidebar');
    const accountsSidebar = document.getElementById('accountsSidebar');

    if (ticketSidebar) ticketSidebar.style.display = 'none';
    if (visaSidebar) visaSidebar.style.display = 'none';
    if (accountsSidebar) accountsSidebar.style.display = 'none';

    if (serviceName === 'visa' && visaSidebar) {
        visaSidebar.style.display = 'block';
    } else if (serviceName === 'accounts' && accountsSidebar) {
        accountsSidebar.style.display = 'block';
    } else if (ticketSidebar) {
        ticketSidebar.style.display = 'block';
    }
}

function toggleMenu(menuId) {
    const menus = document.querySelectorAll('.menu-content');
    const headers = document.querySelectorAll('.menu-head');

    menus.forEach(m => m.classList.remove('show'));
    headers.forEach(h => h.classList.remove('active'));

    const target = document.getElementById(menuId);
    if (target) {
        target.classList.add('show');
    }
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// Clock Update
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        const date = now.toLocaleDateString('en-GB'); 
        const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        clockElement.innerText = `${date} | ${time}`;
    }
}
setInterval(updateClock, 1000);

// ==========================================
// 3. CONTACT BOOK - SAVE DATA (ADD NEW)
// ==========================================
function saveToFirebase() {
    // Inputs se values lena
    const name = document.getElementById('add_name').value;
    const phone = document.getElementById('add_phone').value;
    const country = document.getElementById('countrySelect').value;
    const city = document.getElementById('citySelect').value;

    // Validation
    if (!name || !phone || !country || !city) {
        alert("Please fill all required fields: Name, Phone, Country, and City.");
        return;
    }

    // Server par data save karna
    database.ref('contacts').push({
        fullName: name,
        contactNo: phone,
        country: country,
        city: city,
        timestamp: Date.now()
    })
    .then(() => {
        alert("Contact successfully saved to server!");
        // Form Reset
        document.getElementById('add_name').value = "";
        document.getElementById('add_phone').value = "";
        document.getElementById('countrySelect').value = "";
        document.getElementById('citySelect').innerHTML = '<option value="">Select City</option>';
    })
    .catch((error) => {
        console.error("Firebase Error:", error);
        alert("Failed to save data. Please check your connection.");
    });
}

// ==========================================
// 4. CONTACT BOOK - SEARCH & FILTER (FETCH DATA)
// ==========================================
function fetchData() {
    const sCountry = document.getElementById('searchCountry').value;
    const sCity = document.getElementById('searchCity').value.toLowerCase();
    const tableBody = document.getElementById('serverData');

    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Searching server...</td></tr>';

    database.ref('contacts').once('value', (snapshot) => {
        tableBody.innerHTML = '';
        const data = snapshot.val();
        let found = false;

        if (data) {
            Object.keys(data).forEach(key => {
                const item = data[key];

                // Logic: Agar sCountry "" (All Countries) hai to sab dikhao, warna match karo
                const countryMatch = (sCountry === "" || item.country === sCountry);
                const cityMatch = (sCity === "" || (item.city && item.city.toLowerCase().includes(sCity)));

                if (countryMatch && cityMatch) {
                    found = true;
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
                            <td>Admin</td>
                            <td>
                                <button onclick="deleteRow('${key}')" style="color:red; border:none; background:none; cursor:pointer;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>`;
                }
            });

            if (!found) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No records match your search.</td></tr>';
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Server is empty.</td></tr>';
        }
    });
}

// Delete Logic
function deleteRow(id) {
    if (confirm("Are you sure you want to delete this contact?")) {
        database.ref('contacts/' + id).remove().then(() => {
            fetchData(); // Table refresh karein delete ke baad
        });
    }
}

// ==========================================
// 5. DROPDOWN LOGIC (COUNTRY & CITY)
// ==========================================
const countryCityData = {
        "Afghanistan": ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif"],
        "Albania": ["Tirana", "Durrës", "Vlorë"],
        "Algeria": ["Algiers", "Oran", "Constantine"],
        "Andorra": ["Andorra la Vella"],
        "Angola": ["Luanda", "Huambo"],
        "Antigua and Barbuda": ["St. John's"],
        "Argentina": ["Buenos Aires", "Córdoba", "Rosario"],
        "Armenia": ["Yerevan"],
        "Australia": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
        "Austria": ["Vienna", "Salzburg", "Innsbruck"],
        "Azerbaijan": ["Baku"],
        "Bahamas": ["Nassau"],
        "Bahrain": ["Manama", "Muharraq"],
        "Bangladesh": ["Dhaka", "Chittagong", "Khulna", "Sylhet"],
        "Barbados": ["Bridgetown"],
        "Belarus": ["Minsk"],
        "Belgium": ["Brussels", "Antwerp", "Ghent"],
        "Belize": ["Belize City"],
        "Benin": ["Porto-Novo"],
        "Bhutan": ["Thimphu"],
        "Bolivia": ["La Paz", "Sucre"],
        "Bosnia and Herzegovina": ["Sarajevo"],
        "Botswana": ["Gaborone"],
        "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília"],
        "Brunei": ["Bandar Seri Begawan"],
        "Bulgaria": ["Sofia"],
        "Burkina Faso": ["Ouagadougou"],
        "Burundi": ["Gitega"],
        "Cabo Verde": ["Praia"],
        "Cambodia": ["Phnom Penh"],
        "Cameroon": ["Yaoundé"],
        "Canada": ["Toronto", "Montreal", "Vancouver", "Ottawa"],
        "Central African Republic": ["Bangui"],
        "Chad": ["N'Djamena"],
        "Chile": ["Santiago"],
        "China": ["Beijing", "Shanghai", "Guangzhou", "Shenzhen"],
        "Colombia": ["Bogotá"],
        "Comoros": ["Moroni"],
        "Congo": ["Brazzaville"],
        "Costa Rica": ["San José"],
        "Croatia": ["Zagreb"],
        "Cuba": ["Havana"],
        "Cyprus": ["Nicosia"],
        "Czechia": ["Prague"],
        "Denmark": ["Copenhagen"],
        "Djibouti": ["Djibouti City"],
        "Dominica": ["Roseau"],
        "Dominican Republic": ["Santo Domingo"],
        "Ecuador": ["Quito"],
        "Egypt": ["Cairo", "Alexandria", "Giza"],
        "El Salvador": ["San Salvador"],
        "Equatorial Guinea": ["Malabo"],
        "Eritrea": ["Asmara"],
        "Estonia": ["Tallinn"],
        "Eswatini": ["Mbabane"],
        "Ethiopia": ["Addis Ababa"],
        "Fiji": ["Suva"],
        "Finland": ["Helsinki"],
        "France": ["Paris", "Marseille", "Lyon"],
        "Gabon": ["Libreville"],
        "Gambia": ["Banjul"],
        "Georgia": ["Tbilisi"],
        "Germany": ["Berlin", "Munich", "Hamburg", "Frankfurt"],
        "Ghana": ["Accra"],
        "Greece": ["Athens"],
        "Grenada": ["St. George's"],
        "Guatemala": ["Guatemala City"],
        "Guinea": ["Conakry"],
        "Guinea-Bissau": ["Bissau"],
        "Guyana": ["Georgetown"],
        "Haiti": ["Port-au-Prince"],
        "Honduras": ["Tegucigalpa"],
        "Hungary": ["Budapest"],
        "Iceland": ["Reykjavík"],
        "India": ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"],
        "Indonesia": ["Jakarta", "Surabaya"],
        "Iran": ["Tehran", "Mashhad"],
        "Iraq": ["Baghdad", "Basra"],
        "Ireland": ["Dublin", "Cork"],
        "Israel": ["Jerusalem", "Tel Aviv"],
        "Italy": ["Rome", "Milan", "Naples"],
        "Jamaica": ["Kingston"],
        "Japan": ["Tokyo", "Osaka", "Yokohama"],
        "Jordan": ["Amman"],
        "Kazakhstan": ["Almaty", "Nur-Sultan"],
        "Kenya": ["Nairobi"],
        "Kiribati": ["Tarawa"],
        "Kuwait": ["Kuwait City"],
        "Kyrgyzstan": ["Bishkek"],
        "Laos": ["Vientiane"],
        "Latvia": ["Riga"],
        "Lebanon": ["Beirut"],
        "Lesotho": ["Maseru"],
        "Liberia": ["Monrovia"],
        "Libya": ["Tripoli", "Benghazi"],
        "Liechtenstein": ["Vaduz"],
        "Lithuania": ["Vilnius"],
        "Luxembourg": ["Luxembourg City"],
        "Madagascar": ["Antananarivo"],
        "Malawi": ["Lilongwe"],
        "Malaysia": ["Kuala Lumpur", "George Town"],
        "Maldives": ["Malé"],
        "Mali": ["Bamako"],
        "Malta": ["Valletta"],
        "Marshall Islands": ["Majuro"],
        "Mauritania": ["Nouakchott"],
        "Mauritius": ["Port Louis"],
        "Mexico": ["Mexico City", "Guadalajara"],
        "Micronesia": ["Palikir"],
        "Moldova": ["Chisinau"],
        "Monaco": ["Monaco"],
        "Mongolia": ["Ulaanbaatar"],
        "Montenegro": ["Podgorica"],
        "Morocco": ["Casablanca", "Rabat"],
        "Mozambique": ["Maputo"],
        "Myanmar": ["Yangon"],
        "Namibia": ["Windhoek"],
        "Nauru": ["Yaren"],
        "Nepal": ["Kathmandu"],
        "Netherlands": ["Amsterdam", "Rotterdam"],
        "New Zealand": ["Auckland", "Wellington"],
        "Nicaragua": ["Managua"],
        "Niger": ["Niamey"],
        "Nigeria": ["Lagos", "Abuja"],
        "North Korea": ["Pyongyang"],
        "North Macedonia": ["Skopje"],
        "Norway": ["Oslo"],
        "Oman": ["Muscat"],
        "Pakistan": ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi", "Sialkot", "Gujranwala"],
        "Palau": ["Ngerulmud"],
        "Palestine State": ["Jerusalem", "Gaza City", "Ramallah"],
        "Panama": ["Panama City"],
        "Papua New Guinea": ["Port Moresby"],
        "Paraguay": ["Asunción"],
        "Peru": ["Lima"],
        "Philippines": ["Manila", "Quezon City"],
        "Poland": ["Warsaw", "Kraków"],
        "Portugal": ["Lisbon", "Porto"],
        "Qatar": ["Doha"],
        "Romania": ["Bucharest"],
        "Russia": ["Moscow", "Saint Petersburg"],
        "Rwanda": ["Kigali"],
        "Saint Kitts and Nevis": ["Basseterre"],
        "Saint Lucia": ["Castries"],
        "Saint Vincent and the Grenadines": ["Kingstown"],
        "Samoa": ["Apia"],
        "San Marino": ["San Marino"],
        "Sao Tome and Principe": ["São Tomé"],
        "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam"],
        "Senegal": ["Dakar"],
        "Serbia": ["Belgrade"],
        "Seychelles": ["Victoria"],
        "Sierra Leone": ["Freetown"],
        "Singapore": ["Singapore"],
        "Slovakia": ["Bratislava"],
        "Slovenia": ["Ljubljana"],
        "Solomon Islands": ["Honiara"],
        "Somalia": ["Mogadishu"],
        "South Africa": ["Johannesburg", "Cape Town"],
        "South Korea": ["Seoul", "Busan"],
        "South Sudan": ["Juba"],
        "Spain": ["Madrid", "Barcelona"],
        "Sri Lanka": ["Colombo", "Kandy"],
        "Sudan": ["Khartoum"],
        "Suriname": ["Paramaribo"],
        "Sweden": ["Stockholm"],
        "Switzerland": ["Zurich", "Geneva"],
        "Syria": ["Damascus", "Aleppo"],
        "Tajikistan": ["Dushanbe"],
        "Tanzania": ["Dar es Salaam"],
        "Thailand": ["Bangkok", "Phuket"],
        "Timor-Leste": ["Dili"],
        "Togo": ["Lomé"],
        "Tonga": ["Nukuʻalofa"],
        "Trinidad and Tobago": ["Port of Spain"],
        "Tunisia": ["Tunis"],
        "Turkey": ["Istanbul", "Ankara", "Izmir"],
        "Turkmenistan": ["Ashgabat"],
        "Tuvalu": ["Funafuti"],
        "Uganda": ["Kampala"],
        "Ukraine": ["Kyiv", "Kharkiv"],
        "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
        "United Kingdom": ["London", "Manchester", "Birmingham", "Glasgow"],
        "United States of America": ["New York", "Los Angeles", "Chicago", "Houston"],
        "Uruguay": ["Montevideo"],
        "Uzbekistan": ["Tashkent", "Samarkand"],
        "Vanuatu": ["Port Vila"],
        "Venezuela": ["Caracas"],
        "Vietnam": ["Ho Chi Minh City", "Hanoi"],
        "Yemen": ["Sana'a"],
        "Zambia": ["Lusaka"],
        "Zimbabwe": ["Harare"]
};


// Event listener for Country Dropdowns (Add New Section)
const countrySelect = document.getElementById('countrySelect');
if (countrySelect) {
    countrySelect.addEventListener('change', function() {
        const citySelect = document.getElementById('citySelect');
        const selected = this.value;
        citySelect.innerHTML = '<option value="">Select City</option>';
        if (countryCityData[selected]) {
            countryCityData[selected].forEach(city => {
                citySelect.innerHTML += `<option value="${city}">${city}</option>`;
            });
        }
    });
}

// Auto-load data on page load (Optional)
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    // Agar aap chahte hain ke page load hote hi saara data dikhe:
    // fetchData(); 
});

// Search button dabane par ye function chalega
// handleSearch function ko update karein
function handleSearch() {
    console.log("Search button clicked!");
    
    // table-container ko show karein agar wo hidden hai
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.style.display = "block";
    }
    
    fetchData();
}

// Country change hone par City dropdown update karne ka logic (Search ke liye)
const searchCountry = document.getElementById('searchCountry');
if (searchCountry) {
    searchCountry.addEventListener('change', function() {
        const searchCity = document.getElementById('searchCity');
        const selected = this.value;
        searchCity.innerHTML = '<option value="">Select City</option>';
        if (countryCityData[selected]) {
            countryCityData[selected].forEach(city => {
                searchCity.innerHTML += `<option value="${city}">${city}</option>`;
            });
        }
    });
}



// ==========================================
// 6. LOGIN & ACCESS CONTROL
// ==========================================

function handleLogin(event) {
    event.preventDefault();
    const uName = document.getElementById('login_user').value;
    const uPass = document.getElementById('login_pass').value;
    const uComp = document.getElementById('login_company').value;

    database.ref('users').once('value').then((snapshot) => {
        const allUsers = snapshot.val();
        let found = false;
        let loggedInUser = null;

        ["admins", "workers"].forEach(group => {
            if (allUsers && allUsers[group]) {
                Object.keys(allUsers[group]).forEach(key => {
                    const user = allUsers[group][key];
                    if (user.username === uName && String(user.password) === String(uPass) && user.companyid === uComp) {
                        found = true;
                        loggedInUser = user;
                        loggedInUser.role = group;
                    }
                });
            }
        });

        if (found) {
            // Role save karein aur dashboard par bhejein
            localStorage.setItem('role', loggedInUser.role);
            window.location.href = "ticket.html"; 
        } else {
            alert("Login Failed! Please check your credentials.");
        }
    }).catch(err => {
        console.error("Database Error:", err);
        alert("Server connection failed.");
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('role'); // Role check karein
    
    // Elements ko select karein
    const allProfilesBtn = document.getElementById('allProfilesBtn');
    const userAccountsItem = document.getElementById('userAccountsItem');
    const changePasswordItem = document.getElementById('changePasswordItem');
    const miscSettingsItem = document.getElementById('miscSettingsItem');
    

    // Admin Access Logic
    if (userRole !== 'admins') {
        if (allProfilesBtn) allProfilesBtn.style.display = 'none';
        if (userAccountsItem) userAccountsItem.style.display = 'none';
        if (changePasswordItem) changePasswordItem.style.display = 'none';
        if (miscSettingsItem) miscSettingsItem.style.display = 'none';
    } else {
        // Agar Admin hai to sab dikhao
        if (allProfilesBtn) allProfilesBtn.style.display = 'inline-block';
        if (userAccountsItem) userAccountsItem.style.display = 'flex';
        if (changePasswordItem) changePasswordItem.style.display = 'flex';
        if (miscSettingsItem) miscSettingsItem.style.display = 'flex';
    }
    
    updateClock(); // Clock function
});