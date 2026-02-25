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
const saveSection = document.getElementById('save-section');

loginBtn.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        userInfo.innerText = `Hi, ${user.displayName}`;
        saveSection.classList.remove('hidden');
        loadUserCollection();
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userInfo.innerText = "";
        saveSection.classList.add('hidden');
        ownedMonsters.clear();
        renderMonsters();
    }
});

async function loadUserCollection() {
    if (!currentUser) return;
    db.collection("monster_collections").doc(currentUser.uid).collection("owned")
        .onSnapshot(snapshot => {
            ownedMonsters.clear();
            snapshot.forEach(doc => ownedMonsters.add(doc.data().name));
            renderMonsters();
        });
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

    monsterList.forEach((m, index) => {
        if (!categories[m.category]) categories[m.category] = [];
        categories[m.category].push({...m, id: index});
    });

    for (const cat in categories) {
        const section = document.createElement('section');
        section.className = 'category-section';
        section.innerHTML = `<h2 class="category-title">${cat}</h2><div class="monster-grid"></div>`;
        
        categories[cat].forEach(m => {
            const isOwned = ownedMonsters.has(m.name);
            const card = document.createElement('div');
            card.className = `monster-card ${isOwned ? 'owned' : ''}`;
            card.innerHTML = `
                <img src="img/${m.images[0]}">
                <h3>${m.name}</h3>
                ${isOwned ? '<span class="owned-badge">✓ Owned</span>' : ''}
            `;
            card.onclick = () => openModal(m);
            section.querySelector('.monster-grid').appendChild(card);
        });
        container.appendChild(section);
    }
}

function openModal(m) {
    const isOwned = ownedMonsters.has(m.name);
    document.getElementById('modal-body').innerHTML = `
        <img src="img/${m.images[0]}" style="width:100px">
        <h2>${m.name}</h2>
        <p><strong>Category:</strong> ${m.category}</p>
        <span class="size-tag">${m.size}ml</span>
    `;
    
    const btn = document.getElementById('add-to-collection-btn');
    if (isOwned) {
        btn.innerText = "Already in Collection";
        btn.style.opacity = "0.5";
        btn.onclick = null;
    } else {
        btn.innerText = "Add to my Collection";
        btn.style.opacity = "1";
        btn.onclick = () => saveToFirebase(m);
    }
    
    modal.style.display = "block";
}

async function saveToFirebase(m) {
    if (!currentUser) return;
    try {
        await db.collection("monster_collections").doc(currentUser.uid).collection("owned").add({
            name: m.name,
            category: m.category,
            size: m.size,
            dateAdded: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        alert("Error saving: check permissions");
    }
}

document.querySelector('.close-button').onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };

loadMonsters();