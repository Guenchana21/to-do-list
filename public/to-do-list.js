// ---- Element references ----
const input = document.getElementById("task-input");
const dueInput = document.getElementById("due-input");
const priorityInput = document.getElementById("priority-input");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const taskForm = document.getElementById("task-form");
const list = document.getElementById("task-list");
const errorMsg = document.getElementById("error-msg");
let countLabel = document.getElementById("count-label");
let doneLabel = document.getElementById("done-label");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptyMessage = document.getElementById("empty-message");
const greetingLabel = document.getElementById("greeting-label");
const todayDate = document.getElementById("today-date");
const progressLabel = document.getElementById("progress-label");
const taskProgress = document.getElementById("task-progress");
const filterButtons = document.querySelectorAll(".filter-btn");
const taskDetailDialog = document.getElementById("task-detail-dialog");
const taskDetailForm = document.getElementById("task-detail-form");
const taskDetailHeading = document.getElementById("task-detail-heading");
const taskDetailTitle = document.getElementById("detail-title");
const taskDetailNote = document.getElementById("detail-note");
const taskDetailDue = document.getElementById("detail-due");
const taskDetailPriority = document.getElementById("detail-priority");
const taskDetailStatus = document.getElementById("detail-status");
const taskDetailDone = document.getElementById("detail-done");
let activeDetailTask = null;

const quoteText = document.getElementById("quote-text");
const quoteAuthor = document.getElementById("quote-author");

const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toastUndo = document.getElementById("toast-undo");

const MORNING_STORAGE_KEY = "morning-tasks";
const NIGHT_STORAGE_KEY = "night-tasks";
const ACTIVE_PROFILE_STORAGE_KEY = "todo-active-profile";
const TASK_STATUSES = {
    waiting: "Waiting for customer",
    in_progress: "In Progress",
    escalated: "Escalated",
    pending: "Pending",
    canceled: "Canceled",
    resolved: "Resolved",
};
Object.entries(TASK_STATUSES).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    taskDetailStatus.appendChild(option);
});
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
    return document.body.classList.contains("night-mode")
        ? NIGHT_STORAGE_KEY
        : MORNING_STORAGE_KEY;
}

// =========================================================
// CORE REQUIREMENT 2: Dynamic List Creation
// =========================================================
function createTask(
    text,
    isDone,
    due,
    priority,
    note = "",
    pinned = false,
    status = "pending",
) {
    const li = document.createElement("li");
    li.draggable = true;
    if (isDone) li.classList.add("done");
    if (due) li.dataset.due = due;
    li.dataset.priority = priority || "medium";
    li.dataset.pinned = pinned ? "true" : "false";
    li.dataset.status = Object.prototype.hasOwnProperty.call(
        TASK_STATUSES,
        status,
    )
        ? status
        : "pending";

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

    // Task text and any assigned due-date badge live together in one column.
    const main = document.createElement("div");
    main.className = "task-main";

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = text;
    span.title = "Double-click to edit";

    const badge = document.createElement("span");
    badge.className = "due-badge";

    main.appendChild(span);
    main.appendChild(badge);

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

    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select";
    statusSelect.setAttribute("aria-label", `Status for task: ${text}`);
    statusSelect.title = "Change task status";
    Object.entries(TASK_STATUSES).forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        statusSelect.appendChild(option);
    });
    statusSelect.value = li.dataset.status;
    statusSelect.dataset.status = li.dataset.status;
    statusSelect.addEventListener("change", () => {
        li.dataset.status = statusSelect.value;
        statusSelect.dataset.status = statusSelect.value;
        saveTasks();
    });

    main.appendChild(statusSelect);

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
        noteButton.textContent = noteEditor.value.trim()
            ? "Edit note"
            : "+ Add note";
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

    span.setAttribute("role", "button");
    span.tabIndex = 0;
    span.setAttribute("aria-label", `Open details for ${text}`);
    span.title = "Click to view or edit task details";
    span.addEventListener("click", () => openTaskDetails(li));
    span.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTaskDetails(li);
        }
    });

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

function openTaskDetails(li) {
    activeDetailTask = li;
    const taskText = li.querySelector(".task-text").textContent;
    taskDetailHeading.textContent = taskText;
    taskDetailTitle.value = taskText;
    taskDetailNote.value = li.querySelector(".task-notes").value;
    taskDetailDue.value = li.dataset.due || "";
    taskDetailPriority.value = li.dataset.priority || "medium";
    taskDetailStatus.value = li.dataset.status || "pending";
    taskDetailDone.checked = li.classList.contains("done");
    taskDetailDialog.showModal();
    taskDetailTitle.focus();
}

taskDetailTitle.addEventListener("input", () => {
    taskDetailHeading.textContent = taskDetailTitle.value || "Task details";
});

taskDetailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeDetailTask) return;

    const title = taskDetailTitle.value.trim();
    if (!title) {
        taskDetailTitle.focus();
        return;
    }

    const li = activeDetailTask;
    const taskText = li.querySelector(".task-text");
    const notes = li.querySelector(".task-notes");
    const noteButton = li.querySelector(".note-toggle");
    const statusSelect = li.querySelector(".status-select");

    taskText.textContent = title;
    taskText.setAttribute("aria-label", `Open details for ${title}`);
    taskText.title = "Click to view or edit task details";
    notes.value = taskDetailNote.value;
    notes.setAttribute("aria-label", `Notes for ${title}`);
    noteButton.textContent = notes.value.trim() ? "Edit note" : "+ Add note";
    li.dataset.due = taskDetailDue.value;
    li.dataset.priority = taskDetailPriority.value;
    li.dataset.status = taskDetailStatus.value;
    statusSelect.value = taskDetailStatus.value;
    li.classList.toggle("done", taskDetailDone.checked);

    renderDue(li);
    renderPriority(li);
    updateCounts();
    applySort();
    applyFilter();
    saveTasks();
    taskDetailDialog.close();
});

document
    .getElementById("task-detail-close")
    .addEventListener("click", () => taskDetailDialog.close());
document
    .getElementById("task-detail-cancel")
    .addEventListener("click", () => taskDetailDialog.close());
taskDetailDialog.addEventListener("close", () => {
    activeDetailTask = null;
});

function renderPriority(li) {
    const badge = li.querySelector(".priority-badge");
    const priority = li.dataset.priority || "medium";
    const labels = { low: "Low", medium: "Medium", high: "High" };
    badge.className = `priority-badge ${priority}`;
    badge.textContent = labels[priority];
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
        badge.hidden = true;
        return;
    }

    badge.hidden = false;
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
        const pinOrder =
            Number(b.dataset.pinned === "true") -
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
            const text = li
                .querySelector(".task-text")
                .textContent.toLowerCase();
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
    updateDashboard(items.length, doneItems.length);
    toggleEmptyState();
}

function updateDashboard(total, completed) {
    const now = new Date();
    const hour = now.getHours();
    greetingLabel.textContent =
        hour < 12
            ? "Good morning."
            : hour < 18
              ? "Good afternoon."
              : "Good evening.";
    todayDate.textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    todayDate.dateTime = now.toISOString().slice(0, 10);
    progressLabel.textContent = `${completed} of ${total} task${total === 1 ? "" : "s"} complete`;
    taskProgress.max = Math.max(total, 1);
    taskProgress.value = completed;
}

function toggleEmptyState() {
    const visibleItems = [...list.querySelectorAll("li")].filter(
        (li) => li.style.display !== "none",
    );
    emptyState.style.display = visibleItems.length === 0 ? "block" : "none";
    if (visibleItems.length > 0) return;

    if (currentSearch) {
        emptyTitle.textContent = "No matching tasks";
        emptyMessage.textContent = "Try another search term.";
    } else if (currentFilter === "done") {
        emptyTitle.textContent = "No completed tasks yet";
        emptyMessage.textContent = "Completed tasks will show up here.";
    } else if (currentFilter === "active" && list.children.length > 0) {
        emptyTitle.textContent = "All caught up!";
        emptyMessage.textContent = "You have no active tasks right now.";
    } else {
        emptyTitle.textContent = "Nothing on your list yet";
        emptyMessage.textContent = "Add a task above to get started.";
    }
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
            status: li.dataset.status || "pending",
            note: li.querySelector(".task-notes").value,
            pinned: li.dataset.pinned === "true",
        }));

        localStorage.setItem(getCurrentStorageKey(), JSON.stringify(items));
        return true;
    } catch (err) {
        errorMsg.textContent =
            "Could not save tasks in this browser. Check available storage and try again.";
        console.error("Could not save tasks to local storage.", err);
        return false;
    }
}

function myFunction() {
    const body = document.body;
    const button = document.getElementById("mode-btn");

    saveTasks();
    body.classList.toggle("night-mode");

    if (body.classList.contains("night-mode")) {
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.4 15.5A8.5 8.5 0 0 1 8.5 3.6 8.5 8.5 0 1 0 20.4 15.5Z"></path>
            </svg>`;
        button.setAttribute("aria-label", "Switch to light mode");
        button.title = "Switch to light mode";
    } else {
        button.innerHTML = `
            <svg class="sun-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>
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
                item.status || "pending",
            ),
        );

        applySort();
        applyFilter();
    } catch (err) {
        errorMsg.textContent =
            "Could not load saved tasks from this browser. Your saved data was not changed.";
        console.error("Could not load tasks from local storage.", err);
    }
}

function migrateActiveProfileTasks() {
    try {
        const activeProfileId = localStorage.getItem(
            ACTIVE_PROFILE_STORAGE_KEY,
        );
        if (!activeProfileId || !activeProfileId.startsWith("profile-")) return;

        for (const themeKey of [MORNING_STORAGE_KEY, NIGHT_STORAGE_KEY]) {
            const sourceKey = `${activeProfileId}-${themeKey}`;
            const migrationKey = `todo-migrated-${sourceKey}`;
            if (localStorage.getItem(migrationKey)) continue;

            const sourceValue = localStorage.getItem(sourceKey);
            if (sourceValue !== null) {
                const sourceTasks = JSON.parse(sourceValue);
                if (!Array.isArray(sourceTasks)) {
                    throw new Error(
                        `Stored tasks for ${sourceKey} are not a list.`,
                    );
                }

                const destinationValue = localStorage.getItem(themeKey);
                const destinationTasks = destinationValue
                    ? JSON.parse(destinationValue)
                    : [];
                if (!Array.isArray(destinationTasks)) {
                    throw new Error(
                        `Stored tasks for ${themeKey} are not a list.`,
                    );
                }
                localStorage.setItem(
                    themeKey,
                    JSON.stringify([...destinationTasks, ...sourceTasks]),
                );
            }
            localStorage.setItem(migrationKey, "true");
        }
    } catch (err) {
        errorMsg.textContent =
            "Could not move tasks from the selected local profile. Your saved data is unchanged.";
        console.error("Could not migrate local profile tasks.", err);
    }
}

// =========================================================
// Motivational Quotes
// =========================================================
const QUOTE_INTERVAL_MS = 5000;
const QUOTE_FADE_DURATION_MS = 700;
let quoteTimer = null;
let quoteIsChanging = false;

async function fetchQuote() {
    if (quoteIsChanging) return;
    quoteIsChanging = true;

    let nextQuote;
    let nextAuthor;
    try {
        const response = await fetch("https://dummyjson.com/quotes/random");
        if (!response.ok) throw new Error("Request failed");
        const data = await response.json();

        nextQuote = `"${data.quote}"`;
        nextAuthor = `— ${data.author}`;
    } catch (err) {
        nextQuote =
            "Couldn't load a quote — check your connection and try again.";
        nextAuthor = "";
    }

    quoteText.classList.add("is-fading");
    quoteAuthor.classList.add("is-fading");

    try {
        await new Promise((resolve) =>
            setTimeout(resolve, QUOTE_FADE_DURATION_MS),
        );
        quoteText.textContent = nextQuote;
        quoteAuthor.textContent = nextAuthor;
    } finally {
        quoteText.classList.remove("is-fading");
        quoteAuthor.classList.remove("is-fading");
        quoteIsChanging = false;
    }
}

function restartQuoteTimer() {
    clearInterval(quoteTimer);
    quoteTimer = setInterval(fetchQuote, QUOTE_INTERVAL_MS);
}

// =========================================================
// Wiring
// =========================================================
taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAddTask();
});

dueInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddTask();
});

input.addEventListener("input", () => {
    if (errorMsg.textContent) errorMsg.textContent = "";
});

// ---- Init ----
migrateActiveProfileTasks();
loadTasks();
updateCounts();
applySort();
fetchQuote();
restartQuoteTimer();
