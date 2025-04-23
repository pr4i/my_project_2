// Константы для VAPID (должны совпадать с сервером)
const VAPID_PUBLIC_KEY = 'BEA_enwGTHQ6Oe4Wo777yTxJaRwY1z6iYeGDvbJTGxDWwVQ5umwaj7N2nhx23FIUIPI7Di_yzu0tW3wwv9TEtns';
const PORT = 4000;

// DOM элементы
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const allBtn = document.getElementById('allBtn');
const activeBtn = document.getElementById('activeBtn');
const completedBtn = document.getElementById('completedBtn');
const notificationBtn = document.getElementById('notificationBtn');
const notificationStatus = document.getElementById('notificationStatus');

// Состояние приложения
let tasks = [];
let currentFilter = 'all';
let subscription = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    renderTasks();
    setupEventListeners();
    checkNotificationSupport();
    checkServiceWorker();
});

// Загрузка задач из localStorage
function loadTasks() {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
}

// Сохранение задач в localStorage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Отображение задач в зависимости от фильтра
function renderTasks() {
    taskList.innerHTML = '';
    
    const filteredTasks = tasks.filter(task => {
        if (currentFilter === 'active') return !task.completed;
        if (currentFilter === 'completed') return task.completed;
        return true;
    });
    
    filteredTasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${task.text}</span>
            <button class="delete-btn">Удалить</button>
        `;
        
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', () => toggleTask(index));
        
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTask(index));
        
        taskList.appendChild(li);
    });
}

// Добавление новой задачи
function addTask() {
    const text = taskInput.value.trim();
    if (text) {
        tasks.push({ text, completed: false });
        saveTasks();
        renderTasks();
        taskInput.value = '';

        console.log('Добавлена новая задача:', tasks);

        // Отправка уведомления
        if (subscription) {
            sendNotification('Новая задача', `Добавлена: "${text}"`);
        }
    }
}

function toggleTask(index) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
    renderTasks();

    console.log('Обновлен статус задачи:', tasks);
}

function deleteTask(index) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();

    console.log('Удалена задача:', tasks);
}

// Переключение статуса задачи
function toggleTask(index) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
    renderTasks();
}

// Удаление задачи
function deleteTask(index) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
}

// Установка обработчиков событий
function setupEventListeners() {
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    
    allBtn.addEventListener('click', () => {
        currentFilter = 'all';
        updateActiveFilter();
        renderTasks();
    });
    
    activeBtn.addEventListener('click', () => {
        currentFilter = 'active';
        updateActiveFilter();
        renderTasks();
    });
    
    completedBtn.addEventListener('click', () => {
        currentFilter = 'completed';
        updateActiveFilter();
        renderTasks();
    });
    
    notificationBtn.addEventListener('click', toggleNotifications);
}

// Обновление активного фильтра
function updateActiveFilter() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (currentFilter === 'all') allBtn.classList.add('active');
    if (currentFilter === 'active') activeBtn.classList.add('active');
    if (currentFilter === 'completed') completedBtn.classList.add('active');
}

// Проверка поддержки уведомлений
function checkNotificationSupport() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'Уведомления не поддерживаются в вашем браузере';
        notificationBtn.disabled = true;
    }
}

// Проверка и регистрация Service Worker
async function checkServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker зарегистрирован');
            
            // Проверка существующей подписки
            subscription = await reg.pushManager.getSubscription();
            updateNotificationUI();
        } catch (error) {
            console.error('Ошибка регистрации Service Worker:', error);
        }
    }
}

// Переключение уведомлений
async function toggleNotifications() {
    if (subscription) {
        await unsubscribe();
    } else {
        await subscribe();
    }
}

// Подписка на уведомления
async function subscribe() {
    try {
        const reg = await navigator.serviceWorker.ready;
        subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        // Отправка подписки на сервер
        await fetch(`http://localhost:${PORT}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        
        updateNotificationUI();
        startReminderInterval();
        
        notificationStatus.textContent = 'Уведомления включены';
        notificationStatus.style.color = 'green';
    } catch (error) {
        console.error('Ошибка подписки:', error);
        notificationStatus.textContent = 'Ошибка при включении уведомлений';
        notificationStatus.style.color = 'red';
    }
}

// Отписка от уведомлений
async function unsubscribe() {
    try {
        await subscription.unsubscribe();
        
        // Отправка запроса на сервер для удаления подписки
        await fetch(`http://localhost:${PORT}/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        
        subscription = null;
        clearReminderInterval();
        updateNotificationUI();
        
        notificationStatus.textContent = 'Уведомления отключены';
        notificationStatus.style.color = 'gray';
    } catch (error) {
        console.error('Ошибка отписки:', error);
        notificationStatus.textContent = 'Ошибка при отключении уведомлений';
        notificationStatus.style.color = 'red';
    }
}

// Обновление UI кнопки уведомлений
function updateNotificationUI() {
    if (subscription) {
        notificationBtn.textContent = 'Отключить уведомления';
    } else {
        notificationBtn.textContent = 'Включить уведомления';
    }
}

// Отправка тестового уведомления
async function sendNotification(title, body) {
    console.log('Отправка запроса на сервер для уведомления:', { title, body });
    try {
        await fetch(`http://localhost:4000/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body })
        });
        console.log('Запрос успешно выполнен.');
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
    }
}

// Интервал для напоминаний
let reminderInterval = null;

function startReminderInterval() {
    console.log('Запуск интервала напоминаний...');
    reminderInterval = setInterval(() => {
        const activeTasks = tasks.filter(task => !task.completed);
        console.log('Проверка активных задач:', activeTasks);

        if (activeTasks.length > 0) {
            console.log('Отправка напоминания...');
            sendNotification(
                'Напоминание',
                `У вас ${activeTasks.length} невыполненных задач!`
            );
        } else {
            console.log('Нет активных задач для напоминания.');
        }
    }, 10000); // 10 секунд для тестирования
}

function clearReminderInterval() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
    }
}

// Вспомогательная функция для преобразования ключа
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}