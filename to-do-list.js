// ---- Element references ----
const input = document.getElementById("task-input");
const dueInput = document.getElementById("due-input");
const addBtn = document.getElementById("add-btn");
const list = document.getElementById("task-list");
const errorMsg = document.getElementById("error-msg");
const countLabel = document.getElementById("count-label");
const doneLabel = document.getElementById("done-label");
const emptyState = document.getElementById("empty-state");
const filterButtons = document.querySelectorAll(".filter-btn");

const quoteBtn = document.getElementById("quote-btn");
const quoteText = document.getElementById("quote-text");
const quoteAuthor = document.getElementById("quote-author");

const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toastUndo = document.getElementById("toast-undo");

const STORAGE_KEY = "todo-tasks";
let currentFilter = "all";
let lastDeleted = null; // { node, next } — used by Undo
let toastTimer = null;

// =========================================================
// CORE REQUIREMENT 1: Input & Validation
// =========================================================
function handleAddTask() {
    const value = input.value.trim();

    if (value === "") {
        // Alert the user if the field is empty
        errorMsg.textContent = "Please enter a task before adding.";

        input.classList.remove("shake");
        void input.offsetWidth; // restart animation
        input.classList.add("shake");
        input.focus();
        return;
    }

    errorMsg.textContent = "";
    createTask(value, false, dueInput.value);
    saveTasks();
    input.value = "";
    dueInput.value = "";
    input.focus();
}

// =========================================================
// CORE REQUIREMENT 2: Dynamic List Creation
// =========================================================
function createTask(text, isDone, due) {
    // Create a new <li> element, insert text content, append to <ul>
    const li = document.createElement("li");
    li.draggable = true;
    if (isDone) li.classList.add("done");
    if (due) li.dataset.due = due;

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
    span.textContent = text; // insert text content
    span.title = "Double-click to edit";

    const badge = document.createElement("span");
    badge.className = "due-badge";

    main.appendChild(span);
    main.appendChild(badge);

    // Bonus Feature: Delete button
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

    // Double-click the text to edit it
    span.addEventListener("dblclick", () => startEdit(span, li));

    li.addEventListener("dragstart", () => li.classList.add("dragging"));
    li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        saveTasks();
    });

    li.appendChild(handle);
    li.appendChild(check);
    li.appendChild(main);
    li.appendChild(del);

    list.appendChild(li); // append the new <li> to the <ul>
    renderDue(li);
    updateCounts();
}

// =========================================================
// Edit a task (double-click the text)
// =========================================================
function startEdit(span, li) {
    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "edit-input";
    editor.value = span.textContent;

    li.draggable = false; // so you can select text while editing
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
        badge.className = "due-badge";
        badge.textContent = "";
        return;
    }

    const pretty = new Date(due + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
    const today = todayString();
    const isDone = li.classList.contains("done");

    badge.className = "due-badge show";

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
        lastDeleted = null; // too late to undo now
    }, 5000);
}

toastUndo.addEventListener("click", () => {
    if (!lastDeleted) return;

    const { node, next } = lastDeleted;
    if (next && next.parentNode === list) {
        list.insertBefore(node, next); // put it back where it was
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
// Filters (All / Active / Done)
// =========================================================
function applyFilter() {
    const items = list.querySelectorAll("li");
    items.forEach((li) => {
        const isDone = li.classList.contains("done");
        let show = true;
        if (currentFilter === "active") show = !isDone;
        if (currentFilter === "done") show = isDone;
        li.style.display = show ? "flex" : "none";
    });
    toggleEmptyState();
}

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
// Persistence (state survives a page refresh)
// =========================================================
function saveTasks() {
    try {
        const items = [...list.querySelectorAll("li")].map((li) => ({
            text: li.querySelector(".task-text").textContent,
            done: li.classList.contains("done"),
            due: li.dataset.due || "",
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
        // Storage unavailable (e.g. opened via file:// in some browsers) — skip silently
    }
}

function loadTasks() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const items = JSON.parse(raw);
        items.forEach((item) => createTask(item.text, item.done, item.due));
        applyFilter();
    } catch (err) {
        // Storage unavailable or corrupted — just start with an empty list
    }
}

// =========================================================
// Homework: Fetch Motivational Quotes
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

quoteBtn.addEventListener("click", fetchQuote);

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
loadTasks();
updateCounts();
fetchQuote();
