const firebaseConfig = {
    apiKey: "AIzaSyCcdcsIWEZ1j6Vq0_ImyNRxna2bJyVYWL0",
    authDomain: "gt-database-fedcd.firebaseapp.com",
    projectId: "gt-database-fedcd",
    storageBucket: "gt-database-fedcd.firebasestorage.app",
    messagingSenderId: "542867018660",
    appId: "1:542867018660:web:dacf4c5243e37259d32731"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let monsterList = [];
let ownedMonsters = new Set();

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const modal = document.getElementById('monster-modal');

document.querySelector('.close-button').onclick = () => {
    modal.style.display = "none";
};

window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

loginBtn.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        userInfo.innerText = `Hi, ${user.displayName}`;
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userInfo.innerText = "";
    }
    loadMonsters();
    loadUserCollection();
});

async function loadUserCollection() {
    if (currentUser) {
        db.collection("monster_collections").doc(currentUser.uid).collection("owned")
            .onSnapshot(snapshot => {
                ownedMonsters.clear();
                snapshot.forEach(doc => ownedMonsters.add(doc.data().name));
                renderMonsters();
            });
    } else {
        const localData = JSON.parse(localStorage.getItem('myMonsters')) || [];
        ownedMonsters = new Set(localData);
        renderMonsters();
    }
}

async function loadMonsters() {
    const response = await fetch('data.json');
    monsterList = await response.json();
    renderMonsters();
}

function renderMonsters() {
    const container = document.getElementById('container');
    container.innerHTML = "";
    const categories = {};

    monsterList.forEach(m => {
        if (!categories[m.category]) categories[m.category] = {};
        
        const subCat = m.category2 || "General";
        if (!categories[m.category][subCat]) categories[m.category][subCat] = [];
        
        categories[m.category][subCat].push(m);
    });

    const sortedCategories = Object.keys(categories).sort((a, b) => {
        const fixedOrder = { "Classic": -2, "People": 100, "Special": 101 };
        const orderA = fixedOrder[a] !== undefined ? fixedOrder[a] : 0;
        const orderB = fixedOrder[b] !== undefined ? fixedOrder[b] : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
    });

    sortedCategories.forEach(cat => {
        const section = document.createElement('section');
        section.className = 'category-section';
        section.innerHTML = `<h2 class="category-title">${cat}</h2><div class="sub-categories-container"></div>`;
        const subContainer = section.querySelector('.sub-categories-container');

        const sortedSubCategories = Object.keys(categories[cat]).sort((a, b) => {
            if (a === "General") return -1;
            if (b === "General") return 1;
            return a.localeCompare(b);
        });

        sortedSubCategories.forEach(subCat => {
            const subSection = document.createElement('div');
            subSection.className = 'sub-category-group';
            
            if (subCat !== "General") {
                subSection.innerHTML = `<h3 class="sub-category-title" style="color: #888; margin-left: 10px; text-transform: uppercase; font-size: 0.9rem;">${subCat}</h3><div class="monster-grid"></div>`;
            } else {
                subSection.innerHTML = `<div class="monster-grid"></div>`;
            }

            const grid = subSection.querySelector('.monster-grid');

            categories[cat][subCat].sort((a, b) => {
                if (cat === "Classic") {
                    const classicOrder = { "Monster Energy": -2, "Monster Energy Zero Sugar": -1 };
                    const orderA = classicOrder[a.name] !== undefined ? classicOrder[a.name] : 0;
                    const orderB = classicOrder[b.name] !== undefined ? classicOrder[b.name] : 0;
                    if (orderA !== orderB) return orderA - orderB;
                }
                return a.name.localeCompare(b.name);
            });

            categories[cat][subCat].forEach(m => {
                const isOwned1 = ownedMonsters.has(`${m.name}_${m.size}ml`);
                const isOwned2 = m.size2 ? ownedMonsters.has(`${m.name}_${m.size2}ml`) : false;

                const card = document.createElement('div');
                card.className = `monster-card ${(isOwned1 || isOwned2) ? 'owned' : ''}`;

                let statusHtml = "";
                if (m.size2) {
                    statusHtml = `
                        <div class="dual-status-container">
                            <div class="status-container" data-size="${m.size}">
                                <input type="checkbox" ${isOwned1 ? 'checked' : ''}>
                                <span class="status-text">${m.size}<span class="size-label">ml</span></span>
                            </div>
                            <div class="status-container" data-size="${m.size2}">
                                <input type="checkbox" ${isOwned2 ? 'checked' : ''}>
                                <span class="status-text">${m.size2}<span class="size-label">ml</span></span>
                            </div>
                        </div>`;
                } else {
                    statusHtml = `
                        <div class="status-container" data-size="${m.size}">
                            <input type="checkbox" ${isOwned1 ? 'checked' : ''}>
                            <span class="status-text">IN COLLECTION</span>
                        </div>`;
                }

                card.innerHTML = `
                    <div class="card-click-area">
                        <img src="img/${m.images[0]}">
                    </div>
                    <h3>${m.name}</h3>
                    ${statusHtml}`;

                card.querySelector('.card-click-area').onclick = () => openModal(m);

                const statusBtns = card.querySelectorAll('.status-container');
                statusBtns.forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const check = btn.querySelector('input');
                        const selectedSize = btn.getAttribute('data-size');
                        if (e.target !== check) check.checked = !check.checked;
                        const identifier = `${m.name}_${selectedSize}ml`;
                        const monsterVariant = { ...m, fullName: identifier, actualSize: selectedSize };
                        toggleOwnership(monsterVariant, check.checked);
                    };
                });

                grid.appendChild(card);
            });
            subContainer.appendChild(subSection);
        });
        container.appendChild(section);
    });
}

function openModal(m) {
    const isOwned1 = ownedMonsters.has(`${m.name}_${m.size}ml`);
    const isOwned2 = m.size2 ? ownedMonsters.has(`${m.name}_${m.size2}ml`) : false;

    let statusHtml = "";
    if (m.size2) {
        statusHtml = `
            <div class="dual-status-container" style="margin-top:20px; border:1px solid #333; border-radius:8px;">
                <div class="status-container" data-size="${m.size}">
                    <input type="checkbox" ${isOwned1 ? 'checked' : ''}>
                    <span class="status-text">${m.size}ml</span>
                </div>
                <div class="status-container" data-size="${m.size2}">
                    <input type="checkbox" ${isOwned2 ? 'checked' : ''}>
                    <span class="status-text">${m.size2}ml</span>
                </div>
            </div>
        `;
    } else {
        statusHtml = `
            <div class="status-container" data-size="${m.size}" style="margin-top:20px; border:1px solid #333; border-radius:8px;">
                <input type="checkbox" ${isOwned1 ? 'checked' : ''}>
                <span class="status-text">IN COLLECTION (${m.size}ml)</span>
            </div>
        `;
    }

    document.getElementById('modal-body').innerHTML = `
        <img src="img/${m.images[0]}" style="width:120px; margin-bottom:15px;">
        <h2 style="color:#32cd32; margin-bottom:5px;">${m.name}</h2>
        <p style="margin-bottom:15px;">Category: <strong>${m.category}</strong></p>
        ${statusHtml}
    `;

    const modalBtns = document.querySelectorAll('#modal-body .status-container');
    modalBtns.forEach(btn => {
        btn.onclick = () => {
            const check = btn.querySelector('input');
            const selectedSize = btn.getAttribute('data-size');
            check.checked = !check.checked;
            
            const monsterVariant = { ...m, fullName: `${m.name}_${selectedSize}ml`, actualSize: selectedSize };
            toggleOwnership(monsterVariant, check.checked);
        };
    });

    modal.style.display = "block";
}

async function toggleOwnership(m, shouldOwn) {
    const identifier = m.fullName || `${m.name}_${m.size}ml`;
    
    if (currentUser) {
        const colRef = db.collection("monster_collections").doc(currentUser.uid).collection("owned");
        try {
            if (shouldOwn) {
                await colRef.add({ 
                    name: identifier, 
                    baseName: m.name,
                    size: m.actualSize || m.size,
                    dateAdded: firebase.firestore.FieldValue.serverTimestamp() 
                });
            } else {
                const query = await colRef.where("name", "==", identifier).get();
                const batch = db.batch();
                query.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        } catch (e) {
            console.error("Firebase Error:", e);
        }
    } else {
        let localData = JSON.parse(localStorage.getItem('myMonsters')) || [];
        if (shouldOwn) {
            if (!localData.includes(identifier)) localData.push(identifier);
        } else {
            localData = localData.filter(name => name !== identifier);
        }
        localStorage.setItem('myMonsters', JSON.stringify(localData));
        ownedMonsters = new Set(localData);
        renderMonsters();
    }
}
function openModal(m) {
    const isOwned1 = ownedMonsters.has(`${m.name}_${m.size}ml`);
    const isOwned2 = m.size2 ? ownedMonsters.has(`${m.name}_${m.size2}ml`) : false;

    let flavorHtml = (m.flavor && m.flavor.trim() !== "") ? `<p class="modal-flavor">Flavor: <strong>${m.flavor}</strong></p>` : "";
    let descriptionHtml = (m.description && m.description.trim() !== "") ? `<p class="modal-description">${m.description}</p>` : "";

    let statusHtml = "";
    if (m.size2) {
        statusHtml = `
            <div class="dual-status-container" style="margin-top:20px; border:1px solid #333; border-radius:8px;">
                <div class="status-container" data-size="${m.size}">
                    <input type="checkbox" ${isOwned1 ? 'checked' : ''}>
                    <span class="status-text">${m.size}ml</span>
                </div>
                <div class="status-container" data-size="${m.size2}">
                    <input type="checkbox" ${isOwned2 ? 'checked' : ''}>
                    <span class="status-text">${m.size2}ml</span>
                </div>
            </div>`;
    } else {
        statusHtml = `
            <div class="status-container" data-size="${m.size}" style="margin-top:20px; border:1px solid #333; border-radius:8px;">
                <input type="checkbox" ${isOwned1 ? 'checked' : ''}>
                <span class="status-text">IN COLLECTION (${m.size}ml)</span>
            </div>`;
    }

    document.getElementById('modal-body').innerHTML = `
        <img src="img/${m.images[0]}" style="width:120px; margin-bottom:15px;" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
        <h2 style="color:#32cd32; margin-bottom:10px;">${m.name}</h2>
        <p style="margin-bottom:5px; font-size: 0.9rem; color: #888;">Category: <strong>${m.category}</strong></p>
        ${flavorHtml}
        ${descriptionHtml}
        ${statusHtml}`;

    const modalBtns = document.querySelectorAll('#modal-body .status-container');
    modalBtns.forEach(btn => {
        btn.onclick = () => {
            const check = btn.querySelector('input');
            const selectedSize = btn.getAttribute('data-size');
            check.checked = !check.checked;
            
            const identifier = `${m.name}_${selectedSize}ml`;
            toggleOwnership({ ...m, fullName: identifier, actualSize: selectedSize }, check.checked);
        };
    });

    modal.style.display = "block";
}