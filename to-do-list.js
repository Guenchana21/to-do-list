// ---- Element references ----
const input = document.getElementById("task-input");
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

const STORAGE_KEY = "todo-tasks";
let currentFilter = "all";
