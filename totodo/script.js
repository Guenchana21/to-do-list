/* =========================================
   ELEMENTS
========================================= */

const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");

const taskModal = document.getElementById("task-modal");
const deleteModal = document.getElementById("delete-modal");

const taskForm = document.getElementById("task-form");

const taskTitle = document.getElementById("task-title");
const taskDescription = document.getElementById("task-description");
const taskPriority = document.getElementById("task-priority");
const taskCategory = document.getElementById("task-category");
const taskDueDate = document.getElementById("task-due-date");

const searchInput = document.getElementById("search-input");

const priorityFilter = document.getElementById("priority-filter");

const categoryFilter = document.getElementById("category-filter");

const statusFilter = document.getElementById("status-filter");

const sortSelect = document.getElementById("sort-select");

const totalTasks = document.getElementById("total-tasks");

const completedTasks = document.getElementById("completed-tasks");

const pendingTasks = document.getElementById("pending-tasks");

const overdueTasks = document.getElementById("overdue-tasks");

const progressPercentage = document.getElementById("progress-percentage");

const progressFill = document.getElementById("progress-fill");

const progressMessage = document.getElementById("progress-message");

const taskCount = document.getElementById("task-count");

const taskSectionTitle = document.getElementById("task-section-title");

const toast = document.getElementById("toast");

const toastMessage = document.getElementById("toast-message");

const toastIcon = document.getElementById("toast-icon");

const themeToggle = document.getElementById("theme-toggle");

const themeIcon = document.getElementById("theme-icon");

const themeText = document.getElementById("theme-text");

/* =========================================
   APPLICATION STATE
========================================= */

let tasks = [];

let editingTaskId = null;

let deletingTaskId = null;

let currentView = "all";

/* =========================================
   LOAD TASKS
========================================= */

function loadTasks() {
    const savedTasks = localStorage.getItem("taskflow_tasks");

    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
}

/* =========================================
   SAVE TASKS
========================================= */

function saveTasks() {
    localStorage.setItem("taskflow_tasks", JSON.stringify(tasks));
}

/* =========================================
   CREATE UNIQUE ID
========================================= */

function createId() {
    return Date.now().toString() + Math.random().toString(16).slice(2);
}

/* =========================================
   OPEN ADD MODAL
========================================= */

function openAddModal() {
    editingTaskId = null;

    document.getElementById("modal-title").textContent = "Add New Task";

    taskForm.reset();

    taskPriority.value = "Medium";

    taskCategory.value = "Work";

    taskModal.classList.add("show");

    setTimeout(() => {
        taskTitle.focus();
    }, 100);
}

/* =========================================
   OPEN EDIT MODAL
========================================= */

function openEditModal(id) {
    const task = tasks.find((task) => task.id === id);

    if (!task) return;

    editingTaskId = id;

    document.getElementById("modal-title").textContent = "Edit Task";

    taskTitle.value = task.title;

    taskDescription.value = task.description || "";

    taskPriority.value = task.priority;

    taskCategory.value = task.category;

    taskDueDate.value = task.dueDate || "";

    taskModal.classList.add("show");
}

/* =========================================
   CLOSE TASK MODAL
========================================= */

function closeTaskModal() {
    taskModal.classList.remove("show");

    editingTaskId = null;
}

/* =========================================
   CREATE OR UPDATE TASK
========================================= */

taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title = taskTitle.value.trim();

    if (!title) {
        showToast("Please enter a task title.", "⚠");

        return;
    }

    /* EDIT EXISTING TASK */

    if (editingTaskId) {
        const task = tasks.find((task) => task.id === editingTaskId);

        if (task) {
            task.title = title;

            task.description = taskDescription.value.trim();

            task.priority = taskPriority.value;

            task.category = taskCategory.value;

            task.dueDate = taskDueDate.value;
        }

        showToast("Task updated successfully.");
    } else {
        /* CREATE NEW TASK */
        const newTask = {
            id: createId(),

            title: title,

            description: taskDescription.value.trim(),

            priority: taskPriority.value,

            category: taskCategory.value,

            dueDate: taskDueDate.value,

            completed: false,

            createdAt: new Date().toISOString(),
        };

        tasks.push(newTask);

        showToast("Task added successfully.");
    }

    saveTasks();

    closeTaskModal();

    renderTasks();
});

/* =========================================
   RENDER TASKS
========================================= */

function renderTasks() {
    let filteredTasks = getFilteredTasks();

    filteredTasks = sortTasks(filteredTasks);

    taskList.innerHTML = "";

    if (filteredTasks.length === 0) {
        emptyState.style.display = "block";
    } else {
        emptyState.style.display = "none";
    }

    filteredTasks.forEach((task) => {
        const taskElement = createTaskElement(task);

        taskList.appendChild(taskElement);
    });

    updateStatistics();
}

/* =========================================
   CREATE TASK ELEMENT
========================================= */

function createTaskElement(task) {
    const article = document.createElement("article");

    article.className = "task-card";

    if (task.completed) {
        article.classList.add("completed");
    }

    const checkbox = document.createElement("button");

    checkbox.className = "task-checkbox";

    checkbox.innerHTML = task.completed ? "✓" : "";

    checkbox.title = task.completed ? "Mark as active" : "Mark as completed";

    checkbox.addEventListener("click", () => toggleTask(task.id));

    const content = document.createElement("div");

    content.className = "task-content";

    const title = document.createElement("div");

    title.className = "task-title";

    title.textContent = task.title;

    content.appendChild(title);

    if (task.description) {
        const description = document.createElement("div");

        description.className = "task-description";

        description.textContent = task.description;

        content.appendChild(description);
    }

    const meta = document.createElement("div");

    meta.className = "task-meta";

    /* PRIORITY */

    const priority = document.createElement("span");

    priority.className = `badge priority-${task.priority.toLowerCase()}`;

    priority.textContent = task.priority;

    meta.appendChild(priority);

    /* CATEGORY */

    const category = document.createElement("span");

    category.className = "badge category-badge";

    category.textContent = task.category;

    meta.appendChild(category);

    /* DUE DATE */

    if (task.dueDate) {
        const dueDate = document.createElement("span");

        dueDate.className = "due-date";

        const date = new Date(task.dueDate);

        dueDate.textContent = "📅 " + formatDate(date);

        if (isOverdue(task) && !task.completed) {
            dueDate.classList.add("overdue");

            dueDate.textContent = "⚠ " + formatDate(date) + " • Overdue";
        }

        meta.appendChild(dueDate);
    }

    content.appendChild(meta);

    /* ACTIONS */

    const actions = document.createElement("div");

    actions.className = "task-actions";

    const editButton = document.createElement("button");

    editButton.className = "task-action";

    editButton.innerHTML = "✏️";

    editButton.title = "Edit task";

    editButton.addEventListener("click", () => openEditModal(task.id));

    const deleteButton = document.createElement("button");

    deleteButton.className = "task-action";

    deleteButton.innerHTML = "🗑️";

    deleteButton.title = "Delete task";

    deleteButton.addEventListener("click", () => openDeleteModal(task.id));

    actions.appendChild(editButton);

    actions.appendChild(deleteButton);

    article.appendChild(checkbox);

    article.appendChild(content);

    article.appendChild(actions);

    return article;
}

/* =========================================
   TOGGLE TASK
========================================= */

function toggleTask(id) {
    const task = tasks.find((task) => task.id === id);

    if (!task) return;

    task.completed = !task.completed;

    saveTasks();

    renderTasks();

    if (task.completed) {
        showToast("Task completed! 🎉");
    } else {
        showToast("Task marked as active.");
    }
}

/* =========================================
   DELETE MODAL
========================================= */

function openDeleteModal(id) {
    deletingTaskId = id;

    deleteModal.classList.add("show");
}

function closeDeleteModal() {
    deletingTaskId = null;

    deleteModal.classList.remove("show");
}

/* CONFIRM DELETE */

document
    .getElementById("confirm-delete")
    .addEventListener("click", function () {
        if (!deletingTaskId) return;

        tasks = tasks.filter((task) => task.id !== deletingTaskId);

        saveTasks();

        closeDeleteModal();

        renderTasks();

        showToast("Task deleted.");
    });

/* CANCEL DELETE */

document
    .getElementById("cancel-delete")
    .addEventListener("click", closeDeleteModal);

/* =========================================
   FILTER TASKS
========================================= */

function getFilteredTasks() {
    let result = [...tasks];

    /* SEARCH */

    const search = searchInput.value.trim().toLowerCase();

    if (search) {
        result = result.filter(
            (task) =>
                task.title.toLowerCase().includes(search) ||
                task.description.toLowerCase().includes(search),
        );
    }

    /* PRIORITY */

    const priority = priorityFilter.value;

    if (priority !== "all") {
        result = result.filter((task) => task.priority === priority);
    }

    /* CATEGORY */

    const category = categoryFilter.value;

    if (category !== "all") {
        result = result.filter((task) => task.category === category);
    }

    /* STATUS */

    const status = statusFilter.value;

    if (status === "active") {
        result = result.filter((task) => !task.completed);
    }

    if (status === "completed") {
        result = result.filter((task) => task.completed);
    }

    /* SIDEBAR VIEWS */

    if (currentView === "completed") {
        result = result.filter((task) => task.completed);
    }

    if (currentView === "today") {
        result = result.filter((task) => isToday(task.dueDate));
    }

    if (currentView === "upcoming") {
        result = result.filter((task) => isUpcoming(task));
    }

    return result;
}

/* =========================================
   SORT TASKS
========================================= */

function sortTasks(taskArray) {
    const sort = sortSelect.value;

    if (sort === "newest") {
        return taskArray.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
    }

    if (sort === "oldest") {
        return taskArray.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
    }

    if (sort === "priority") {
        const priorityOrder = {
            High: 1,

            Medium: 2,

            Low: 3,
        };

        return taskArray.sort(
            (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
        );
    }

    if (sort === "dueDate") {
        return taskArray.sort((a, b) => {
            if (!a.dueDate) return 1;

            if (!b.dueDate) return -1;

            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }

    return taskArray;
}

/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStatistics() {
    const total = tasks.length;

    const completed = tasks.filter((task) => task.completed).length;

    const pending = total - completed;

    const overdue = tasks.filter(
        (task) => isOverdue(task) && !task.completed,
    ).length;

    totalTasks.textContent = total;

    completedTasks.textContent = completed;

    pendingTasks.textContent = pending;

    overdueTasks.textContent = overdue;

    /* PROGRESS */

    let percentage = 0;

    if (total > 0) {
        percentage = Math.round((completed / total) * 100);
    }

    progressPercentage.textContent = percentage + "%";

    progressFill.style.width = percentage + "%";

    /* PROGRESS MESSAGE */

    if (total === 0) {
        progressMessage.textContent = "Let's get started!";
    } else if (percentage === 100) {
        progressMessage.textContent = "Everything completed! 🎉";
    } else if (percentage >= 75) {
        progressMessage.textContent = "Almost there! 🔥";
    } else if (percentage >= 50) {
        progressMessage.textContent = "Great progress! 💪";
    } else {
        progressMessage.textContent = "Keep going! 🚀";
    }

    /* TASK COUNT */

    const visibleTasks = getFilteredTasks().length;

    taskCount.textContent = `${visibleTasks} ${
        visibleTasks === 1 ? "task" : "tasks"
    }`;
}

/* =========================================
   DATE HELPERS
========================================= */

function formatDate(date) {
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function isToday(dateString) {
    if (!dateString) return false;

    const date = new Date(dateString);

    const today = new Date();

    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
}

function isUpcoming(task) {
    if (!task.dueDate) {
        return false;
    }

    const due = new Date(task.dueDate);

    const now = new Date();

    return due > now && !task.completed;
}

function isOverdue(task) {
    if (!task.dueDate) {
        return false;
    }

    return new Date(task.dueDate) < new Date();
}

/* =========================================
   TOAST NOTIFICATION
========================================= */

let toastTimeout;

function showToast(message, icon = "✓") {
    toastMessage.textContent = message;

    toastIcon.textContent = icon;

    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

/* =========================================
   THEME
========================================= */

function loadTheme() {
    const savedTheme = localStorage.getItem("taskflow_theme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark");

        themeIcon.textContent = "☀️";

        themeText.textContent = "Light Mode";
    } else {
        document.body.classList.remove("dark");

        themeIcon.textContent = "🌙";

        themeText.textContent = "Dark Mode";
    }
}

function toggleTheme() {
    document.body.classList.toggle("dark");

    const isDark = document.body.classList.contains("dark");

    if (isDark) {
        localStorage.setItem("taskflow_theme", "dark");

        themeIcon.textContent = "☀️";

        themeText.textContent = "Light Mode";

        showToast("Dark mode enabled.");
    } else {
        localStorage.setItem("taskflow_theme", "light");

        themeIcon.textContent = "🌙";

        themeText.textContent = "Dark Mode";

        showToast("Light mode enabled.");
    }
}

/* =========================================
   CURRENT DATE
========================================= */

function displayCurrentDate() {
    const today = new Date();

    document.getElementById("current-date").textContent =
        today.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        });
}

/* =========================================
   NAVIGATION
========================================= */

document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach((item) => {
            item.classList.remove("active");
        });

        this.classList.add("active");

        currentView = this.dataset.view;

        const titles = {
            all: "All Tasks",

            today: "Today's Tasks",

            upcoming: "Upcoming Tasks",

            completed: "Completed Tasks",
        };

        taskSectionTitle.textContent = titles[currentView];

        renderTasks();
    });
});

/* =========================================
   CATEGORY SIDEBAR
========================================= */

document.querySelectorAll(".category-link").forEach((button) => {
    button.addEventListener("click", function () {
        categoryFilter.value = this.dataset.category;

        currentView = "all";

        taskSectionTitle.textContent = "All Tasks";

        renderTasks();
    });
});

/* =========================================
   EVENT LISTENERS
========================================= */

document
    .getElementById("add-task-header")
    .addEventListener("click", openAddModal);

document
    .getElementById("empty-add-button")
    .addEventListener("click", openAddModal);

document
    .getElementById("close-modal")
    .addEventListener("click", closeTaskModal);

document
    .getElementById("cancel-task")
    .addEventListener("click", closeTaskModal);

themeToggle.addEventListener("click", toggleTheme);

/* SEARCH */

searchInput.addEventListener("input", renderTasks);

/* FILTERS */

priorityFilter.addEventListener("change", renderTasks);

categoryFilter.addEventListener("change", renderTasks);

statusFilter.addEventListener("change", renderTasks);

sortSelect.addEventListener("change", renderTasks);

/* CLEAR COMPLETED */

document
    .getElementById("clear-completed")
    .addEventListener("click", function () {
        const completedCount = tasks.filter((task) => task.completed).length;

        if (completedCount === 0) {
            showToast("There are no completed tasks.", "⚠");

            return;
        }

        tasks = tasks.filter((task) => !task.completed);

        saveTasks();

        renderTasks();

        showToast("Completed tasks cleared.");
    });

/* =========================================
   CLOSE MODALS BY CLICKING OUTSIDE
========================================= */

taskModal.addEventListener("click", function (event) {
    if (event.target === taskModal) {
        closeTaskModal();
    }
});

deleteModal.addEventListener("click", function (event) {
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
});

/* =========================================
   ESCAPE KEY
========================================= */

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeTaskModal();

        closeDeleteModal();
    }
});

/* =========================================
   INITIALIZE APP
========================================= */

loadTasks();

loadTheme();

displayCurrentDate();

renderTasks();
