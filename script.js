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
    loadUserCollection();
    loadMonsters('data.json');
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

let currentFile = 'data.json'; 

async function loadMonsters(fileName = 'data.json') {
    currentFile = fileName;
    const response = await fetch(fileName);
    monsterList = await response.json();

    if (fileName === 'data2.json') {
        document.body.classList.add('redbull-theme');
    } else {
        document.body.classList.remove('redbull-theme');
    }
    
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
        const fixedOrder = { "Classic": -2, "Special": 101, "People": 100 };
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

            categories[cat][subCat].forEach(m => {
                const isOwnedGeneric = ownedMonsters.has(m.name);
                const card = document.createElement('div');
                card.className = `monster-card ${isOwnedGeneric ? 'owned' : ''}`;

                let rawImage = "";
                if (m.variants && m.variants.length > 0) {
                    rawImage = m.variants[0].image;
                } else {
                    rawImage = m.image || (m.images ? m.images : "");
                }

                let imageSrc = Array.isArray(rawImage) ? rawImage[0] : (rawImage || "default.png");

                card.innerHTML = `
                    <div class="card-click-area">
                        <img src="img/${imageSrc}" onerror="this.src='img/placeholder.png'">
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
    const variants = (m.variants && m.variants.length > 0) ? m.variants : [{ 
        variantName: "Standard", 
        image: m.image || (m.images ? m.images : ""), 
        size: m.size || "500", 
        description: m.description || "" 
    }];
    
    const v = variants[currentVariantIndex];
    const rawImage = v.image || "";
    const imgArray = Array.isArray(rawImage) ? rawImage : (rawImage !== "" ? [rawImage] : []);
    const mainImg = imgArray.length > 0 ? imgArray[0] : "placeholder.png";
    
    const isGenericOwned = ownedMonsters.has(m.name);
    const isVariantOwned = ownedMonsters.has(`${m.name}_${v.variantName}`);

    let thumbnailsHtml = "";
    // Se ci sono più immagini, creiamo le miniature ma saltiamo la prima (index 0)
    if (imgArray.length > 1) {
        thumbnailsHtml = `<div class="thumb-container">`;
        imgArray.forEach((img, index) => {
            if (index === 0) return; // SALTA LA PRIMA IMMAGINE PER EVITARE DOPPIONI
            thumbnailsHtml += `
                <a href="img/${img}" data-fancybox="gallery-${currentVariantIndex}">
                    <img src="img/${img}" class="thumb-img">
                </a>`;
        });
        thumbnailsHtml += `</div>`;
    }

    let flavorHtml = (m.flavor && m.flavor.trim() !== "") ? `<p class="modal-flavor">Flavor: <strong>${m.flavor}</strong></p>` : "";

    document.getElementById('modal-body').innerHTML = `
        <div class="variant-slider">
            <button class="slider-btn" id="prevVar"><</button>
            <div class="main-image-wrapper">
                <a href="img/${mainImg}" data-fancybox="gallery-${currentVariantIndex}">
                    <img src="img/${mainImg}" class="variant-img" style="cursor: zoom-in;">
                </a>
            </div>
            <button class="slider-btn" id="nextVar">></button>
        </div>
        
        ${thumbnailsHtml}

        <h2 style="color:#32cd32;">${m.name}</h2>
        <p style="color: #888; font-size: 0.8rem;">${v.variantName} ${v.size ? '- ' + v.size + 'ml' : ''}</p>
        
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
        toggleOwnership({ 
            fullName: id, 
            name: m.name, 
            variantName: v.variantName, 
            actualSize: v.size 
        }, !isVariantOwned);
        renderModalContent(m);
    };

    document.getElementById('toggleGeneric').onclick = () => {
        toggleOwnership({ fullName: m.name, name: m.name }, !isGenericOwned);
        renderModalContent(m);
    };
}
document.addEventListener('click', function (event) {
    if (event.target.closest('[data-fancybox]')) {
        event.preventDefault();
    }
}, false);

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
function initFancybox() {
    Fancybox.bind("[data-fancybox]", {
        Toolbar: false,
        Thumbs: false,
        Caption: false,
        Html: {
            counter: false
        },
        Images: {
            Panzoom: {
                zoomOnWheel: true,
            },
        },
        click: "close",
        showClass: "f-fadeIn",
        hideClass: "f-fadeOut"
    });
}

initFancybox();