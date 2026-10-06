// ---- Element references ----
const input = document.getElementById("task-input");
const dueInput = document.getElementById("due-input");
const priorityInput = document.getElementById("priority-input");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const addBtn = document.getElementById("add-btn");
const profileSelect = document.getElementById("profile-select");
const addProfileBtn = document.getElementById("add-profile-btn");
const profileForm = document.getElementById("profile-form");
const profileNameInput = document.getElementById("profile-name-input");
const cancelProfileBtn = document.getElementById("cancel-profile-btn");
const list = document.getElementById("task-list");
const errorMsg = document.getElementById("error-msg");
let countLabel = document.getElementById("count-label");
let doneLabel = document.getElementById("done-label");
const emptyState = document.getElementById("empty-state");
const filterButtons = document.querySelectorAll(".filter-btn");

const quoteBtn = document.getElementById("quote-btn");
const quoteText = document.getElementById("quote-text");
const quoteAuthor = document.getElementById("quote-author");

const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toastUndo = document.getElementById("toast-undo");

const MORNING_STORAGE_KEY = "morning-tasks";
const NIGHT_STORAGE_KEY = "night-tasks";
const PROFILES_STORAGE_KEY = "todo-profiles";
const ACTIVE_PROFILE_STORAGE_KEY = "todo-active-profile";
const DEFAULT_PROFILE = { id: "default", name: "My profile" };
let profiles = [DEFAULT_PROFILE];
let activeProfileId = DEFAULT_PROFILE.id;
let currentFilter = "all";
let currentSearch = "";
let currentSort = "manual";
let lastDeleted = null; // { node, next } — used by Undo
let toastTimer = null;

// =========================================================
// CORE REQUIREMENT 1: Input & Validation
// =========================================================
function handleAddTask() {
    const value = input.value.trim();

    if (value === "") {
        errorMsg.textContent = "Please enter a task before adding.";
        input.classList.remove("shake");
        void input.offsetWidth; // restart animation
        input.classList.add("shake");
        input.focus();
        return;
    }

    errorMsg.textContent = "";
    createTask(value, false, dueInput.value, priorityInput.value);
    saveTasks();
    input.value = "";
    dueInput.value = "";
    priorityInput.value = "medium";
    input.focus();
    applySort();
}

function getCurrentStorageKey() {
    const themeKey = document.body.classList.contains("night-mode")
        ? NIGHT_STORAGE_KEY
        : MORNING_STORAGE_KEY;
    return activeProfileId === DEFAULT_PROFILE.id
        ? themeKey
        : `${activeProfileId}-${themeKey}`;
}

// =========================================================
// CORE REQUIREMENT 2: Dynamic List Creation
// =========================================================
function createTask(text, isDone, due, priority, note = "", pinned = false) {
    const li = document.createElement("li");
    li.draggable = true;
    if (isDone) li.classList.add("done");
    if (due) li.dataset.due = due;
    li.dataset.priority = priority || "medium";
    li.dataset.pinned = pinned ? "true" : "false";

    // Drag handle
    const handle = document.createElement("button");
    handle.className = "drag-handle";
    handle.type = "button";
    handle.setAttribute("aria-label", "Drag to reorder");
    handle.innerHTML = `
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2" cy="2" r="1.5"></circle><circle cx="8" cy="2" r="1.5"></circle>
            <circle cx="2" cy="8" r="1.5"></circle><circle cx="8" cy="8" r="1.5"></circle>
            <circle cx="2" cy="14" r="1.5"></circle><circle cx="8" cy="14" r="1.5"></circle>
        </svg>`;

    // Checkbox
    const check = document.createElement("button");
    check.className = "check";
    check.type = "button";
    check.setAttribute("aria-label", "Mark task complete");
    check.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"
             stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;

    // Task text + due badge live together in one column
    const main = document.createElement("div");
    main.className = "task-main";

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = text;
    span.title = "Double-click to edit";

    // Due-date badge
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "due-badge";
    badge.title = "Click to change due date";

    const dateEditor = document.createElement("input");
    dateEditor.type = "date";
    dateEditor.className = "due-editor";
    dateEditor.tabIndex = -1;

    badge.addEventListener("click", () => {
        dateEditor.value = li.dataset.due || "";
        try {
            dateEditor.showPicker();
        } catch (err) {
            dateEditor.focus();
            dateEditor.click();
        }
    });

    dateEditor.addEventListener("change", () => {
        if (dateEditor.value) {
            li.dataset.due = dateEditor.value;
        } else {
            delete li.dataset.due;
        }
        renderDue(li);
        saveTasks();
    });

    main.appendChild(span);
    main.appendChild(badge);
    main.appendChild(dateEditor);

    // Priority tag
    const priorityBadge = document.createElement("button");
    priorityBadge.type = "button";
    priorityBadge.className = "priority-badge";
    priorityBadge.title = "Click to change priority";

    priorityBadge.addEventListener("click", () => {
        const order = ["low", "medium", "high"];
        const current = li.dataset.priority || "medium";
        const nextIndex = (order.indexOf(current) + 1) % order.length;
        li.dataset.priority = order[nextIndex];
        renderPriority(li);
        saveTasks();
        applySort();
    });

    main.appendChild(priorityBadge);

    const noteButton = document.createElement("button");
    noteButton.className = "note-toggle";
    noteButton.type = "button";
    noteButton.textContent = note ? "Edit note" : "+ Add note";
    noteButton.setAttribute("aria-expanded", "false");

    const noteEditor = document.createElement("textarea");
    noteEditor.className = "task-notes";
    noteEditor.placeholder = "Add details or notes for this task...";
    noteEditor.setAttribute("aria-label", `Notes for ${text}`);
    noteEditor.value = note;

    noteButton.addEventListener("click", () => {
        const isOpen = noteEditor.classList.toggle("open");
        noteButton.setAttribute("aria-expanded", String(isOpen));
        noteButton.textContent = isOpen
            ? "Hide note"
            : noteEditor.value.trim()
              ? "Edit note"
              : "+ Add note";
        if (isOpen) noteEditor.focus();
    });

    noteEditor.addEventListener("input", () => {
        noteButton.textContent = noteEditor.value.trim() ? "Edit note" : "+ Add note";
        saveTasks();
        applyFilter();
    });

    main.appendChild(noteButton);
    main.appendChild(noteEditor);

    const pin = document.createElement("button");
    pin.className = "pin-btn";
    pin.type = "button";
    pin.setAttribute("aria-label", pinned ? "Unpin task" : "Pin task");
    pin.setAttribute("aria-pressed", String(pinned));
    pin.title = pinned ? "Unpin task" : "Pin task";
    pin.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 3H8l1.5 6L6 12v2h5v7l1 1 1-1v-7h5v-2l-3.5-3L16 3Z"></path>
        </svg>`;

    pin.addEventListener("click", () => {
        const isPinned = li.dataset.pinned !== "true";
        li.dataset.pinned = String(isPinned);
        pin.setAttribute("aria-pressed", String(isPinned));
        pin.setAttribute("aria-label", isPinned ? "Unpin task" : "Pin task");
        pin.title = isPinned ? "Unpin task" : "Pin task";
        applySort();
        saveTasks();
    });

    // Delete button
    const del = document.createElement("button");
    del.className = "delete-btn";
    del.type = "button";
    del.setAttribute("aria-label", "Delete task");
    del.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;

    check.addEventListener("click", () => {
        li.classList.toggle("done");
        renderDue(li);
        updateCounts();
        applyFilter();
        saveTasks();
    });

    del.addEventListener("click", () => deleteTask(li));

    span.addEventListener("dblclick", () => startEdit(span, li));

    li.addEventListener("dragstart", () => li.classList.add("dragging"));
    li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        if (currentSort !== "manual") {
            currentSort = "manual";
            sortSelect.value = "manual";
        }
        applySort();
        saveTasks();
    });

    li.appendChild(handle);
    li.appendChild(check);
    li.appendChild(main);
    li.appendChild(pin);
    li.appendChild(del);

    list.appendChild(li);
    renderDue(li);
    renderPriority(li);
    updateCounts();
}

function renderPriority(li) {
    const badge = li.querySelector(".priority-badge");
    const priority = li.dataset.priority || "medium";
    const labels = { low: "Low", medium: "Medium", high: "High" };
    badge.className = `priority-badge ${priority}`;
    badge.textContent = labels[priority];
}

// =========================================================
// Edit a task
// =========================================================
function startEdit(span, li) {
    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "edit-input";
    editor.value = span.textContent;

    li.draggable = false;
    span.replaceWith(editor);
    editor.focus();
    editor.select();

    let finished = false;

    function finish(save) {
        if (finished) return;
        finished = true;

        const newText = editor.value.trim();
        if (save && newText !== "") span.textContent = newText;

        editor.replaceWith(span);
        li.draggable = true;
        saveTasks();
    }

    editor.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
    });

    editor.addEventListener("blur", () => finish(true));
}

// =========================================================
// Due dates
// =========================================================
function todayString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

function renderDue(li) {
    const badge = li.querySelector(".due-badge");
    const due = li.dataset.due;

    if (!due) {
        badge.className = "due-badge empty";
        badge.textContent = "+ Add due date";
        return;
    }

    const pretty = new Date(due + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
    const today = todayString();
    const isDone = li.classList.contains("done");

    badge.className = "due-badge";

    if (!isDone && due < today) {
        badge.classList.add("overdue");
        badge.textContent = `Overdue · ${pretty}`;
    } else if (!isDone && due === today) {
        badge.classList.add("today");
        badge.textContent = "Due today";
    } else {
        badge.textContent = `Due ${pretty}`;
    }
}

// =========================================================
// Delete with Undo
// =========================================================
function deleteTask(li) {
    lastDeleted = { node: li, next: li.nextElementSibling };
    li.remove();
    updateCounts();
    saveTasks();
    showToast("Task deleted");
}

function showToast(message) {
    toastMsg.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        lastDeleted = null;
    }, 5000);
}

toastUndo.addEventListener("click", () => {
    if (!lastDeleted) return;

    const { node, next } = lastDeleted;
    if (next && next.parentNode === list) {
        list.insertBefore(node, next);
    } else {
        list.appendChild(node);
    }

    lastDeleted = null;
    clearTimeout(toastTimer);
    toast.classList.remove("show");

    updateCounts();
    applyFilter();
    saveTasks();
});

// ---- Drag-to-reorder ----
function getDragAfterElement(container, y) {
    const items = [...container.querySelectorAll("li:not(.dragging)")];
    return items.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        },
        { offset: Number.NEGATIVE_INFINITY },
    ).element;
}

list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = list.querySelector(".dragging");
    if (!dragging) return;
    const afterElement = getDragAfterElement(list, e.clientY);
    if (afterElement == null) {
        list.appendChild(dragging);
    } else {
        list.insertBefore(dragging, afterElement);
    }
});

// =========================================================
// Sort
// =========================================================
const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

function applySort() {
    const items = [...list.querySelectorAll("li")];
    items.sort((a, b) => {
        const pinOrder = Number(b.dataset.pinned === "true") -
            Number(a.dataset.pinned === "true");
        if (pinOrder) return pinOrder;
        if (currentSort === "due") {
            const aDue = a.dataset.due || "9999-99-99";
            const bDue = b.dataset.due || "9999-99-99";
            return aDue.localeCompare(bDue);
        }
        if (currentSort === "priority") {
            const aRank = PRIORITY_RANK[a.dataset.priority || "medium"];
            const bRank = PRIORITY_RANK[b.dataset.priority || "medium"];
            return bRank - aRank;
        }
        return 0;
    });

    items.forEach((li) => list.appendChild(li));
}

sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    applySort();
    saveTasks();
});

function applyFilter() {
    const items = list.querySelectorAll("li");
    items.forEach((li) => {
        const isDone = li.classList.contains("done");
        let show = true;
        if (currentFilter === "active") show = !isDone;
        if (currentFilter === "done") show = isDone;

        if (show && currentSearch) {
            const text = li.querySelector(".task-text").textContent.toLowerCase();
            const note = li.querySelector(".task-notes").value.toLowerCase();
            show = text.includes(currentSearch) || note.includes(currentSearch);
        }

        li.style.display = show ? "flex" : "none";
    });
    toggleEmptyState();
}

searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value.trim().toLowerCase();
    applyFilter();
});

filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        applyFilter();
    });
});

// =========================================================
// Counters & empty state
// =========================================================
function updateCounts() {
    const items = list.querySelectorAll("li");
    const doneItems = list.querySelectorAll("li.done");
    countLabel.textContent = `${items.length} task${items.length === 1 ? "" : "s"}`;
    doneLabel.textContent = items.length ? `${doneItems.length} done` : "";
    toggleEmptyState();
}

function toggleEmptyState() {
    const visibleItems = [...list.querySelectorAll("li")].filter(
        (li) => li.style.display !== "none",
    );
    emptyState.style.display = visibleItems.length === 0 ? "block" : "none";
}

// =========================================================
// Persistence
// =========================================================
function saveTasks() {
    try {
        const items = [...list.querySelectorAll("li")].map((li) => ({
            text: li.querySelector(".task-text").textContent,
            done: li.classList.contains("done"),
            due: li.dataset.due || "",
            priority: li.dataset.priority || "medium",
            note: li.querySelector(".task-notes").value,
            pinned: li.dataset.pinned === "true",
        }));

        localStorage.setItem(getCurrentStorageKey(), JSON.stringify(items));
    } catch (err) {
        console.log(err);
    }
}

function myFunction() {
    const body = document.body;
    const button = document.getElementById("mode-btn");

    saveTasks();
    body.classList.toggle("night-mode");

    if (body.classList.contains("night-mode")) {
        button.innerHTML = `
            <svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>
            </svg>`;
        button.setAttribute("aria-label", "Switch to light mode");
        button.title = "Switch to light mode";
    } else {
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.4 15.5A8.5 8.5 0 0 1 8.5 3.6 8.5 8.5 0 1 0 20.4 15.5Z"></path>
            </svg>`;
        button.setAttribute("aria-label", "Switch to dark mode");
        button.title = "Switch to dark mode";
    }

    list.innerHTML = "";

    currentFilter = "all";
    currentSearch = "";

    filterButtons.forEach((btn) => {
        btn.classList.remove("active");
        if (btn.dataset.filter === "all") {
            btn.classList.add("active");
        }
    });

    searchInput.value = "";

    loadTasks();
    updateCounts();
    applySort();
    applyFilter();
}

function loadTasks() {
    try {
        const raw = localStorage.getItem(getCurrentStorageKey());
        if (!raw) return;

        const items = JSON.parse(raw);
        items.forEach((item) =>
            createTask(
                item.text,
                item.done,
                item.due,
                item.priority,
                item.note || "",
                item.pinned === true,
            ),
        );

        applySort();
        applyFilter();
    } catch (err) {
        console.log(err);
    }

}

function initializeProfiles() {
    try {
        const storedProfiles = JSON.parse(
            localStorage.getItem(PROFILES_STORAGE_KEY) || "null",
        );
        if (Array.isArray(storedProfiles)) {
            profiles = storedProfiles.filter(
                (profile) =>
                    profile &&
                    typeof profile.id === "string" &&
                    typeof profile.name === "string",
            );
        }
        if (!profiles.some((profile) => profile.id === DEFAULT_PROFILE.id)) {
            profiles.unshift(DEFAULT_PROFILE);
        }

        const requestedProfile = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
        activeProfileId = profiles.some((profile) => profile.id === requestedProfile)
            ? requestedProfile
            : DEFAULT_PROFILE.id;
        renderProfiles();
    } catch (err) {
        errorMsg.textContent = "Could not load local profiles from this browser.";
        console.error("Could not load local profiles.", err);
    }
}

function renderProfiles() {
    profileSelect.replaceChildren();
    profiles.forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        profileSelect.appendChild(option);
    });
    profileSelect.value = activeProfileId;
}

profileSelect.addEventListener("change", () => {
    saveTasks();
    activeProfileId = profileSelect.value;
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
    list.replaceChildren();
    loadTasks();
    updateCounts();
    applySort();
    applyFilter();
});

addProfileBtn.addEventListener("click", () => {
    profileForm.hidden = !profileForm.hidden;
    if (!profileForm.hidden) profileNameInput.focus();
});

cancelProfileBtn.addEventListener("click", () => {
    profileForm.hidden = true;
    profileNameInput.value = "";
    errorMsg.textContent = "";
});

profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const cleanName = profileNameInput.value.trim();
    if (!cleanName) {
        errorMsg.textContent = "Please enter a name for the profile.";
        return;
    }
    if (profiles.some((profile) => profile.name.toLowerCase() === cleanName.toLowerCase())) {
        errorMsg.textContent = "A profile with that name already exists.";
        return;
    }

    const profile = {
        id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: cleanName,
    };
    const updatedProfiles = [...profiles, profile];
    try {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedProfiles));
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profile.id);
        profiles = updatedProfiles;
        activeProfileId = profile.id;
        renderProfiles();
        list.replaceChildren();
        updateCounts();
        applySort();
        applyFilter();
        profileForm.reset();
        profileForm.hidden = true;
        errorMsg.textContent = "";
    } catch (err) {
        errorMsg.textContent = "Could not save this profile in local storage.";
        console.error("Could not save local profile.", err);
    }
});

// =========================================================
// Motivational Quotes
// =========================================================
async function fetchQuote() {
    quoteBtn.disabled = true;
    quoteBtn.textContent = "Loading...";
    quoteText.textContent = "Fetching a quote...";
    quoteAuthor.textContent = "";

    try {
        const response = await fetch("https://dummyjson.com/quotes/random");
        if (!response.ok) throw new Error("Request failed");
        const data = await response.json();

        quoteText.textContent = `"${data.quote}"`;
        quoteAuthor.textContent = `— ${data.author}`;
    } catch (err) {
        quoteText.textContent =
            "Couldn't load a quote — check your connection and try again.";
        quoteAuthor.textContent = "";
    } finally {
        quoteBtn.disabled = false;
        quoteBtn.textContent = "New Quote";
    }
}

quoteBtn.addEventListener("click", () => {
    fetchQuote();
    restartQuoteTimer();
});

const QUOTE_INTERVAL_MS = 5000;
let quoteTimer = null;

function restartQuoteTimer() {
    clearInterval(quoteTimer);
    quoteTimer = setInterval(fetchQuote, QUOTE_INTERVAL_MS);
}

// =========================================================
// Wiring
// =========================================================
addBtn.addEventListener("click", handleAddTask);

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddTask();
});

dueInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddTask();
});

input.addEventListener("input", () => {
    if (errorMsg.textContent) errorMsg.textContent = "";
});

// ---- Init ----
initializeProfiles();
loadTasks();
updateCounts();
applySort();
fetchQuote();
restartQuoteTimer();
