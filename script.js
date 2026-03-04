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
let currentVariantIndex = 0;

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
    if (!container) return;
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
            subSection.innerHTML = subCat !== "General" ? 
                `<h3 class="sub-category-title" style="color: #888; margin-left: 10px; text-transform: uppercase; font-size: 0.9rem;">${subCat}</h3><div class="monster-grid"></div>` : 
                `<div class="monster-grid"></div>`;

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
                const isOwnedGeneric = ownedMonsters.has(m.name);
                const card = document.createElement('div');
                card.className = `monster-card ${isOwnedGeneric ? 'owned' : ''}`;

                card.innerHTML = `
                    <div class="card-click-area">
                        <img src="img/${m.variants ? m.variants[0].image : m.images[0]}">
                    </div>
                    <h3>${m.name}</h3>
                    <div class="status-container">
                        <input type="checkbox" ${isOwnedGeneric ? 'checked' : ''}>
                        <span class="status-text">IN COLLECTION</span>
                    </div>`;

                card.querySelector('.card-click-area').onclick = () => openModal(m);

                card.querySelector('.status-container').onclick = (e) => {
                    e.stopPropagation();
                    const check = e.currentTarget.querySelector('input');
                    if (e.target !== check) check.checked = !check.checked;
                    toggleOwnership({ fullName: m.name, name: m.name }, check.checked);
                };

                grid.appendChild(card);
            });
            subContainer.appendChild(subSection);
        });
        container.appendChild(section);
    });
}

function openModal(m) {
    currentVariantIndex = 0;
    renderModalContent(m);
    modal.style.display = "block";
}

function renderModalContent(m) {
    const variants = m.variants || [{ 
        variantName: "Standard", 
        image: m.images ? m.images[0] : "", 
        size: m.size || "500", 
        description: m.description || "" 
    }];
    
    const v = variants[currentVariantIndex];
    const isGenericOwned = ownedMonsters.has(m.name);
    const isVariantOwned = ownedMonsters.has(`${m.name}_${v.variantName}`);

    let flavorHtml = (m.flavor && m.flavor.trim() !== "") ? `<p class="modal-flavor">Flavor: <strong>${m.flavor}</strong></p>` : "";

    document.getElementById('modal-body').innerHTML = `
        <div class="variant-slider">
            <button class="slider-btn" id="prevVar"><</button>
            <img src="img/${v.image}" class="variant-img">
            <button class="slider-btn" id="nextVar">></button>
        </div>
        <h2 style="color:#32cd32;">${m.name}</h2>
        <p style="color: #888; font-size: 0.8rem;">${v.variantName} - ${v.size}ml</p>
        
        <button class="add-variant-btn ${isVariantOwned ? 'owned' : ''}" id="toggleVariant">
            ${isVariantOwned ? '✓ VARIANT IN COLLECTION' : '+ ADD THIS VERSION'}
        </button>

        ${flavorHtml}
        <p class="modal-description">${v.description}</p>
        
        <div class="status-container ${isGenericOwned ? 'owned' : ''}" id="toggleGeneric" style="margin-top:20px; border:1px solid #333; border-radius:8px;">
             <input type="checkbox" ${isGenericOwned ? 'checked' : ''}>
             <span class="status-text">GENERIC POSSESSION</span>
        </div>
    `;

    document.getElementById('prevVar').onclick = () => {
        currentVariantIndex = (currentVariantIndex > 0) ? currentVariantIndex - 1 : variants.length - 1;
        renderModalContent(m);
    };

    document.getElementById('nextVar').onclick = () => {
        currentVariantIndex = (currentVariantIndex < variants.length - 1) ? currentVariantIndex + 1 : 0;
        renderModalContent(m);
    };

    document.getElementById('toggleVariant').onclick = () => {
        const id = `${m.name}_${v.variantName}`;
        toggleOwnership({ fullName: id, name: m.name, variantName: v.variantName, actualSize: v.size }, !isVariantOwned);
        renderModalContent(m);
    };

    document.getElementById('toggleGeneric').onclick = () => {
        toggleOwnership({ fullName: m.name, name: m.name }, !isGenericOwned);
        renderModalContent(m);
    };
}

async function toggleOwnership(m, shouldOwn) {
    const identifier = m.fullName;
    
    if (shouldOwn) {
        ownedMonsters.add(identifier);
    } else {
        ownedMonsters.delete(identifier);
    }

    if (currentUser) {
        const colRef = db.collection("monster_collections").doc(currentUser.uid).collection("owned");
        try {
            if (shouldOwn) {
                await colRef.doc(identifier).set({ 
                    name: identifier, 
                    baseName: m.name,
                    size: m.actualSize || "",
                    variantName: m.variantName || "Generic",
                    dateAdded: firebase.firestore.FieldValue.serverTimestamp() 
                });
            } else {
                await colRef.doc(identifier).delete();
            }
        } catch (e) {
            console.error("Firebase Error:", e);
        }
    } else {
        localStorage.setItem('myMonsters', JSON.stringify(Array.from(ownedMonsters)));
        renderMonsters();
    }
}