
/* ============================================================
   GLOBAL STATE
============================================================ */
let balance = 0;
let inRound = false;
let betPlaced = false;
let cashedOut = false;
let currentMultiplier = 1.0;
let crashPoint = 0;
let betAmount = 0;
let autoCashoutValue = null;

let betHistory = [];
let countdownActive = false;
let countdownValue = 5;
let roundId = 1;

let isLoggedIn = false;
let currentUserPhone = null;

let totalRounds = 0;
let totalVolume = 0;

let smokeTrail = []; // for plane trail

/* ============================================================
   ELEMENTS
============================================================ */
const canvas = document.getElementById("crashCanvas");
const ctx = canvas.getContext("2d");

const balanceDisplay = document.getElementById("balanceDisplay");
const multiplierDisplay = document.getElementById("multiplierDisplay");
const roundStatus = document.getElementById("roundStatus");
const crashPointDisplay = document.getElementById("crashPointDisplay");
const roundIdDisplay = document.getElementById("roundIdDisplay");
const betHistoryEl = document.getElementById("betHistory");
const liveBetsEl = document.getElementById("liveBets");

const betButton = document.getElementById("betButton");
const cashoutButton = document.getElementById("cashoutButton");
const betAmountInput = document.getElementById("betAmount");
const autoCashoutInput = document.getElementById("autoCashout");
const potentialPayoutEl = document.getElementById("potentialPayout");

const authModal = document.getElementById("authModal");
const loginModalInner = document.getElementById("loginModalInner");
const signupModalInner = document.getElementById("signupModalInner");
const loginPhoneInput = document.getElementById("loginPhone");
const loginPassInput = document.getElementById("loginPass");
const rememberMeInput = document.getElementById("rememberMe");
const signupNameInput = document.getElementById("signupName");
const signupPhoneInput = document.getElementById("signupPhone");
const signupPassInput = document.getElementById("signupPass");
const profilePhoneEl = document.getElementById("profilePhone");

const depositModal = document.getElementById("depositModal");
const depositAmountInput = document.getElementById("depositAmount");
const depositHelpModal = document.getElementById("depositHelpModal");

const adminModal = document.getElementById("adminModal");
const adminTotalRounds = document.getElementById("adminTotalRounds");
const adminTotalVolume = document.getElementById("adminTotalVolume");

/* ============================================================
   CANVAS RESIZE
============================================================ */
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

/* ============================================================
   AUTH + USER STORAGE
============================================================ */
function showAuthModal() {
    authModal.classList.remove("hidden");
    loginModalInner.classList.remove("hidden");
    signupModalInner.classList.add("hidden");
}

function hideAuthModal() {
    authModal.classList.add("hidden");
}

function switchToSignup() {
    loginModalInner.classList.add("hidden");
    signupModalInner.classList.remove("hidden");
}

function switchToLogin() {
    signupModalInner.classList.add("hidden");
    loginModalInner.classList.remove("hidden");
}

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem("users") || "{}");
    } catch {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

function loginUser() {
    const phone = loginPhoneInput.value.trim();
    const pass = loginPassInput.value;
    const remember = rememberMeInput.checked;

    if (!phone || !pass) {
        alert("Enter phone and password");
        return;
    }

    if (!/^07\d{8}$/.test(phone)) {
        alert("Enter a valid M-Pesa number (07XXXXXXXX)");
        return;
    }

    const users = getUsers();
    if (!users[phone]) {
        alert("This number is not registered. Create an account first.");
        switchToSignup();
        signupPhoneInput.value = phone;
        return;
    }

    if (users[phone].password !== pass) {
        alert("Incorrect password");
        return;
    }

    isLoggedIn = true;
    currentUserPhone = phone;
    profilePhoneEl.innerText = phone;

    if (remember) {
        localStorage.setItem("sessionPhone", phone);
    } else {
        localStorage.removeItem("sessionPhone");
    }

    hideAuthModal();
}

function signupUser() {
    const name = signupNameInput.value.trim();
    const phone = signupPhoneInput.value.trim();
    const pass = signupPassInput.value;

    if (!name || !phone || !pass) {
        alert("Fill all fields");
        return;
    }

    if (!/^07\d{8}$/.test(phone)) {
        alert("Enter a valid M-Pesa number (07XXXXXXXX)");
        return;
    }

    if (pass.length < 4) {
        alert("Password must be at least 4 characters");
        return;
    }

    const users = getUsers();
    if (users[phone]) {
        alert("This number is already registered");
        return;
    }

    users[phone] = { name, password: pass };
    saveUsers(users);

    isLoggedIn = true;
    currentUserPhone = phone;
    profilePhoneEl.innerText = phone;

    localStorage.setItem("sessionPhone", phone);

    hideAuthModal();
}

/* ============================================================
   BALANCE + DEPOSIT
============================================================ */
function updateBalance() {
    balanceDisplay.innerText = `KSh ${balance.toFixed(2)}`;
}

function openDepositModal() {
    depositModal.classList.remove("hidden");
}

function closeDepositModal() {
    depositModal.classList.add("hidden");
}

function openDepositHelp() {
    depositHelpModal.classList.remove("hidden");
}

function closeDepositHelp() {
    depositHelpModal.classList.add("hidden");
}

function confirmDeposit() {
    const amount = Number(depositAmountInput.value);
    if (!amount || amount <= 0) {
        alert("Enter a valid amount");
        return;
    }
    // Just update balance silently, then show manual menu
    balance += amount;
    updateBalance(); false
    closeDepositModal();
    openDepositHelp();
}

/* ============================================================
   ADMIN STATS
============================================================ */
function openAdminModal() {
    adminTotalRounds.innerText = totalRounds.toString();
    adminTotalVolume.innerText = totalVolume.toFixed(2);
    adminModal.classList.remove("hidden");
}

function closeAdminModal() {
    adminModal.classList.add("hidden");
}

/* ============================================================
   CRASH DISTRIBUTION (UNPREDICTABLE)
============================================================ */
function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.35) {
        // 35% ultra-low: 1.01–1.30 (lightning crashes)
        return Number((1.01 + Math.random() * 0.29).toFixed(2));
    } else if (r < 0.75) {
        // 40% low-mid: 1.30–3.00
        return Number((1.3 + Math.random() * 1.7).toFixed(2));
    } else if (r < 0.95) {
        // 20% mid-high: 3–8x
        return Number((3 + Math.random() * 5).toFixed(2));
    } else {
        // 5% rare high: 8–20x
        return Number((8 + Math.random() * 12).toFixed(2));
    }
}

/* ============================================================
   GAME FLOW
============================================================ */
function startCountdown() {
    countdownActive = true;
    countdownValue = 9;
    roundStatus.innerText = "Next round in...";
    let timer = setInterval(() => {
        if (!countdownActive) {
            clearInterval(timer);
            return;
        }
        countdownValue--;
        if (countdownValue <= 0) {
            clearInterval(timer);
            countdownActive = false;
            startRound();
        }
    }, 1000);
}

function startRound() {
    inRound = true;
    betPlaced = false;
    cashedOut = false;
    currentMultiplier = 1.0;
    smokeTrail = [];
    
    crashPoint = generateCrashPoint();
    crashPointDisplay.innerText = `${crashPoint.toFixed(2)}x`;
    roundStatus.innerText = "Round live";
    roundIdDisplay.innerText = `#${roundId++}`;
    totalRounds++;

    betButton.classList.remove("hidden");
    cashoutButton.classList.add("hidden");
    potentialPayoutEl.innerText = "KSh 0.00";

    animateCrash();
}

/* ============================================================
   ANIMATION LOOP
============================================================ */
function animateCrash() {
    if (!inRound && !countdownActive) return;

    // Fade trail
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // COUNTDOWN PHASE
    if (countdownActive) {
        const t = (5 - countdownValue) / 5; // 0 → 1
        const eased = Math.pow(t, 1.5);
        const cdProgress = eased * 0.9;

        let cdX = canvas.width * cdProgress;
        let cdY = canvas.height - (canvas.height * cdProgress * 0.65);
        if (cdY < canvas.height * 0.25) cdY = canvas.height * 0.25;

        ctx.fillStyle = "#ffd600";
        ctx.font = "bold 26px Arial";
        ctx.fillText(countdownValue, cdX + 10, cdY - 10);

        ctx.save();
        ctx.translate(cdX, cdY);
        ctx.rotate(Date.now() / 150);
        ctx.strokeStyle = "#00ff99";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        requestAnimationFrame(animateCrash);
        return;
    }

    // LIVE ROUND PHASE
    // Variable speed: faster as multiplier grows (can crash "from center" quickly)
    currentMultiplier += 0.015 + currentMultiplier * 0.003;
    multiplierDisplay.innerText = `${currentMultiplier.toFixed(2)}x`;

    // CURVED LINE
    let progress = currentMultiplier / crashPoint;
    if (progress > 1) progress = 1;

    const curve = Math.pow(progress, 1.8); // easing

    let lineX = canvas.width * curve;
    let lineY = canvas.height - (canvas.height * curve * 0.75);
    if (lineY < canvas.height * 0.2) lineY = canvas.height * 0.2;

    // Smoke trail
    smokeTrail.push({ x: lineX, y: lineY, alpha: 1 });
    if (smokeTrail.length > 80) smokeTrail.shift();

    smokeTrail.forEach(p => {
        ctx.fillStyle = `rgba(0, 255, 153, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x - 10, p.y + 6, 3, 0, Math.PI * 2);
        ctx.fill();
        p.alpha -= 0.02;
    });

    // Draw line
    ctx.strokeStyle = "rgba(0, 255, 153, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(lineX, lineY);
    ctx.stroke();

    // Plane icon (triangle)
    ctx.save();
    ctx.translate(lineX, lineY);
    ctx.rotate(-Math.PI / 8);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, 6);
    ctx.lineTo(-14, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Floating multiplier
    ctx.fillStyle = "#00ff99";
    ctx.font = "bold 18px Arial";
    ctx.fillText(currentMultiplier.toFixed(2) + "x", lineX + 10, lineY - 10);

    // Auto cashout
    if (betPlaced && !cashedOut && autoCashoutValue && currentMultiplier >= autoCashoutValue) {
        cashOut();
    }

    // Potential payout
    if (betPlaced && !cashedOut) {
        const potential = betAmount * currentMultiplier;
        potentialPayoutEl.innerText = `KSh ${potential.toFixed(2)}`;
        cashoutButton.innerText = `CASHOUT KSh ${potential.toFixed(2)}`;
    }

    // Crash
    if (currentMultiplier >= crashPoint) {
        crash();
        return;
    }

    requestAnimationFrame(animateCrash);
}

/* ============================================================
   CRASH EVENT
============================================================ */
function crash() {
    inRound = true;
    multiplierDisplay.innerText = "CRASHED";
    roundStatus.innerText = "Crashed";

    // Flash effect
    ctx.fillStyle = "rgba(255, 0, 51, 0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (betPlaced && !cashedOut) {
        addBetHistory("Lost", betAmount, currentMultiplier);
    }

    setTimeout(() => {
        startCountdown();
    }, 1500);
}

/* ============================================================
   BETTING SYSTEM
============================================================ */
function handleBetClick() {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }

    if (!countdownActive) {
        alert("Wait for next round");
        return;
    }

    const amount = Number(betAmountInput.value);
    if (!amount || amount <= 0) {
        alert("Enter a valid amount");
        return;
    }

    if (amount > balance) {
        openDepositModal();
        return;
    }

    placeBet(amount);
}

function placeBet(amount) {
    betAmount = amount;
    autoCashoutValue = Number(autoCashoutInput.value) || null;

    if (betAmount > balance) {
        alert("Insufficient balance");
        return;
    }

    balance -= betAmount;
    updateBalance();

    betPlaced = true;
    cashedOut = false;
    totalVolume += betAmount;

    betButton.classList.add("hidden");
    cashoutButton.classList.remove("hidden");
}

function cashOut() {
    if (!betPlaced || cashedOut) return;

    cashedOut = true;
    const winnings = betAmount * currentMultiplier;
    balance += winnings;
    updateBalance();

    addBetHistory("Won", winnings, currentMultiplier);

    cashoutButton.classList.add("hidden");
    betButton.classList.remove("hidden");
    potentialPayoutEl.innerText = "KSh 0.00";
}

function addBetHistory(result, amount, multiplier) {
    betHistory.unshift(`${result}: KSh ${amount.toFixed(2)} @ ${multiplier.toFixed(2)}x`);
    if (betHistory.length > 20) betHistory.pop();

    betHistoryEl.innerHTML = betHistory.map(b => `<div>${b}</div>`).join("");
}

/* ============================================================
   LIVE BETS FEED (FAKE DATA)
============================================================ */
const fakeNames = ["Kevin", "Mary", "Brian", "Cynthia", "Ali", "John", "Grace", "Sam", "Ivy", "Derrick"];

function randomLiveBet() {
    const name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    const amt = Math.floor(Math.random() * 900 + 100);
    const multi = (Math.random() * 5 + 1).toFixed(2);
    const result = Math.random() < 0.6 ? "Won" : "Lost";
    const line = `${name} ${result}: KSh ${amt} @ ${multi}x`;
    const div = document.createElement("div");
    div.textContent = line;
    liveBetsEl.prepend(div);
    if (liveBetsEl.children.length > 25) {
        liveBetsEl.removeChild(liveBetsEl.lastChild);
    }
}

setInterval(randomLiveBet, 2500);

/* ============================================================
   EVENT BINDINGS
============================================================ */
document.getElementById("authBtn").addEventListener("click", showAuthModal);
document.getElementById("toSignup").addEventListener("click", switchToSignup);
document.getElementById("toLogin").addEventListener("click", switchToLogin);
document.getElementById("loginSubmit").addEventListener("click", loginUser);
document.getElementById("signupSubmit").addEventListener("click", signupUser);

document.getElementById("depositBtn").addEventListener("click", () => {
    if (!isLoggedIn) {
        showAuthModal();
        return;
    }
    openDepositModal();
});
document.getElementById("withdrawBtn").addEventListener("click", () => {
    alert("MINIMUM WITHDRAWAL LIMIT 500KSH to  new users");
});

document.getElementById("depositConfirm").addEventListener("click", confirmDeposit);
document.getElementById("depositCancel").addEventListener("click", closeDepositModal);
document.getElementById("depositHelpClose").addEventListener("click", closeDepositHelp);

betButton.addEventListener("click", handleBetClick);
cashoutButton.addEventListener("click", cashOut);

// Simple admin shortcut: double-click logo
document.querySelector(".logo").addEventListener("dblclick", openAdminModal);
document.getElementById("adminClose").addEventListener("click", closeAdminModal);

/* ============================================================
   STARTUP
============================================================ */
(function init() {
    const sessionPhone = localStorage.getItem("sessionPhone");
    if (sessionPhone) {
        isLoggedIn = true;
        currentUserPhone = sessionPhone;
        profilePhoneEl.innerText = sessionPhone;
    }
    updateBalance();
    startCountdown();
})();
