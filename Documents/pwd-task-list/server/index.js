require('dotenv').config();
const express = require('express');
const webPush = require('web-push');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('VAPID Public Key:', process.env.VAPID_PUBLIC_KEY);
console.log('VAPID Private Key:', process.env.VAPID_PRIVATE_KEY ? '***hidden***' : 'not set');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Инициализация VAPID
webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Хранилище подписок
let subscriptions = [];

// API для подписки
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
        console.error('Неверные данные подписки:', subscription);
        return res.status(400).json({ error: 'Неверные данные подписки' });
    }

    if (!subscriptions.some(s => s.endpoint === subscription.endpoint)) {
        subscriptions.push(subscription);
        console.log('Добавлена новая подписка:', subscription.endpoint);
    } else {
        console.log('Подписка уже существует:', subscription.endpoint);
    }

    res.status(201).json({});
});

// API для отписки
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) {
        console.error('Неверные данные отписки:', req.body);
        return res.status(400).json({ error: 'Необходимо указать endpoint' });
    }

    const initialLength = subscriptions.length;
    subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
    if (subscriptions.length < initialLength) {
        console.log('Удалена подписка:', endpoint);
    } else {
        console.log('Подписка не найдена:', endpoint);
    }

    res.status(200).json({});
});

// Отправка уведомлений
app.post('/send-notification', (req, res) => {
    const { title, body } = req.body;

    if (!title || !body) {
        console.error('Недостаточно данных для отправки уведомления');
        return res.status(400).json({ error: 'Необходимо указать title и body' });
    }

    const payload = JSON.stringify({
        title: title,
        body: body,
        icon: '/icons/icon-192.png'
    });

    console.log('Отправка уведомления:', { title, body });

    const results = [];
    const promises = subscriptions.map(sub =>
        webPush.sendNotification(sub, payload)
            .then(() => {
                console.log('Уведомление успешно отправлено:', sub.endpoint);
                results.push({ status: 'success', endpoint: sub.endpoint });
            })
            .catch(err => {
                console.error('Ошибка отправки уведомления:', { endpoint: sub.endpoint, error: err.message });
                results.push({ status: 'error', endpoint: sub.endpoint, error: err.message });
            })
    );

    Promise.all(promises)
        .then(() => {
            console.log('Результаты отправки:', results);
            res.json({ results });
        })
        .catch(err => {
            console.error('Критическая ошибка при отправке:', err);
            res.status(500).json({ error: err.message });
        });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});